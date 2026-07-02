// =====================================================================
// tools/extract-topology.ts — SVG → CellNode topology extractor (M3).
//
// Build/seed-time ONLY. This lives OUTSIDE src/engine/* on purpose: the
// pure engine never reads SVGs. This tool derives a fabrication topology
// DETERMINISTICALLY from each collection design's `imageSvg`, validates it
// through the real engine (`solveTopology` + `computeHardware`), and emits
// `src/catalog/derived-topologies.generated.ts`. `prisma/seed.ts` then
// applies that data (topology + tier-gated `quotable`) by `externalId`.
//
// Why this is not "guessing" (golden rule): the SVGs encode the structure.
//   • <g layertype="Diagram"> has one *_component group per element:
//       Root/Frame    — full outer rect (the design's canvas, = aspect proxy)
//       Sightline     — one per cell; translate+bbox = the cell DAYLIGHT rect
//       Sash          — one per OPENING cell; its presence = "this cell opens"
//   • <g layertype="HingePointers"> has one triangle per opening cell whose
//     APEX points to the hinge edge (top / left / right).
//   • `quantityOfSquares` corroborates the leaf count.
//
// Drawing constants (SVG render units, NOT engine fabrication values —
// verified constant across the whole casement/door/T&T set):
//   DRAW_FRAME_FACE = 70  (canvas edge → fixed-cell daylight, and divider face)
//   DRAW_SASH_OVERLAP = 28 (sash outer extends 28 past the rebate face)
// So a cell's "rebate footprint" (its share of the window, bounded by divider
// centrelines) is: fixed → its daylight rect; sash → sash-outer inset by 28.
// Adjacent rebate rects abut across a ~70 gap whose centre is the divider line.
// =====================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CellNode, Design, SashKind } from "../types.ts";
import { solveTopology } from "../engine/topology.ts";
import { computeHardware } from "../engine/hardware.ts";
import { SUNNYPLAST_70 } from "../catalog/system-sunnyplast.ts";

const TOL = 6; // mm tolerance for edge/coordinate comparisons (drawing is integer)
const DRAW_SASH_OVERLAP = 28;

// ---- families -------------------------------------------------------

export type Family = "casement" | "tilt-turn" | "door" | "french" | "sliding";
export type Calibration = "calibrated" | "structural" | "uncalibrated" | "deferred";

interface FamilyRule {
  family: Family;
  frameKey: string;
  sashKey: string;
  calibration: Calibration;
  /** Whether designs of this family may be marked quotable in M3. */
  eligible: boolean;
}

const FAMILY_RULES: Record<Family, FamilyRule> = {
  casement: { family: "casement", frameKey: "frame-5ch", sashKey: "sash-t", calibration: "calibrated", eligible: true },
  door: { family: "door", frameKey: "frame-6ch", sashKey: "sash-door-z", calibration: "calibrated", eligible: true },
  // French: CALIBRATED from Job 00000264 (docs/french-door/) — frame-french
  // (SPQ-6-11252 @ face 48), Z door sash SPQ-5-45252 (face 105 / overlap 20),
  // STULP french-mullion between the meeting leaves, bead-32. See CLAUDE.md
  // "## French Door".
  french: { family: "french", frameKey: "frame-french", sashKey: "sash-door-z-fr", calibration: "calibrated", eligible: true },
  "tilt-turn": { family: "tilt-turn", frameKey: "frame-5ch", sashKey: "sash-t", calibration: "uncalibrated", eligible: false },
  sliding: { family: "sliding", frameKey: "frame-5ch", sashKey: "sash-t", calibration: "deferred", eligible: false },
};

/** Maps a collection JSON filename → family. */
export function familyForFile(filename: string): Family {
  const f = filename.toLowerCase();
  if (f.includes("tilt")) return "tilt-turn";
  if (f.includes("french")) return "french";
  if (f.includes("sliding")) return "sliding";
  if (f.includes("door")) return "door";
  return "casement";
}

// ---- SVG geometry parsing ------------------------------------------

export interface XYWH { x: number; y: number; w: number; h: number; }
export interface Triangle { ax: number; ay: number; dir: "top" | "bottom" | "left" | "right"; }
export interface ParsedSvg {
  canvas: { w: number; h: number };
  cells: XYWH[];     // Sightline daylight rects (one per cell)
  sashes: XYWH[];    // Sash-outer rects (one per opening cell)
  hinges: Triangle[];
}

function bboxOfPath(d: string): XYWH | null {
  const nums = (d.match(/-?\d+\.?\d*/g) ?? []).map(Number);
  if (nums.length < 4) return null;
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) { xs.push(nums[i]); ys.push(nums[i + 1]); }
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

/** For a *_component comment, read the following group's translate + path/rect bbox. */
function componentRects(svg: string, compName: string): XYWH[] {
  const out: XYWH[] = [];
  const re = new RegExp(`<!--\\s*${compName}_component[^>]*-->`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) {
    const seg = svg.slice(m.index + m[0].length, m.index + m[0].length + 700);
    const tr = seg.match(/translate\(([-\d.]+) ([-\d.]+)\)/);
    if (!tr) continue;
    const tx = Number(tr[1]), ty = Number(tr[2]);
    const pa = seg.match(/<path[^>]*\bd="(M[^"]+)"/);
    if (pa) {
      const bb = bboxOfPath(pa[1]);
      if (bb) { out.push({ x: tx + bb.x, y: ty + bb.y, w: bb.w, h: bb.h }); continue; }
    }
    const rc = seg.match(/<rect[^>]*width="([-\d.]+)"[^>]*height="([-\d.]+)"/);
    if (rc) out.push({ x: tx, y: ty, w: Number(rc[1]), h: Number(rc[2]) });
  }
  return out;
}

/** Apex direction of a hinge triangle (apex = the vertex opposite the shared-coordinate base). */
export function apexOfTriangle(pts: [number, number][]): Triangle | null {
  if (pts.length < 3) return null;
  const [p, q, r] = pts;
  // Three candidate bases; pick the pair that best shares a coordinate.
  const cands: { base: [[number, number], [number, number]]; apex: [number, number]; dx: number; dy: number }[] = [
    { base: [p, q], apex: r, dx: Math.abs(p[0] - q[0]), dy: Math.abs(p[1] - q[1]) },
    { base: [p, r], apex: q, dx: Math.abs(p[0] - r[0]), dy: Math.abs(p[1] - r[1]) },
    { base: [q, r], apex: p, dx: Math.abs(q[0] - r[0]), dy: Math.abs(q[1] - r[1]) },
  ];
  const vert = cands.reduce((a, b) => (b.dx < a.dx ? b : a));   // base shares x → vertical base
  const horiz = cands.reduce((a, b) => (b.dy < a.dy ? b : a));  // base shares y → horizontal base
  if (vert.dx <= horiz.dy) {
    const dir = vert.apex[0] < vert.base[0][0] ? "left" : "right";
    return { ax: vert.apex[0], ay: vert.apex[1], dir };
  }
  const dir = horiz.apex[1] < horiz.base[0][1] ? "top" : "bottom";
  return { ax: horiz.apex[0], ay: horiz.apex[1], dir };
}

export function parseSvg(svg: string): ParsedSvg {
  const roots = componentRects(svg, "Root");
  const frames = componentRects(svg, "Frame");
  const root = roots[0] ?? frames[0];
  if (!root) throw new Error("no Root/Frame component");
  const canvas = { w: root.w, h: root.h };

  const cells = componentRects(svg, "Sightline");
  const sashes = componentRects(svg, "Sash");

  // Hinge triangles live in the HingePointers layer; coords are canvas-absolute.
  const hinges: Triangle[] = [];
  const hi = svg.indexOf("HingePointers");
  if (hi >= 0) {
    const tail = svg.slice(hi);
    for (const pm of tail.matchAll(/<path[^>]*\bd="(M[^"]+)"/g)) {
      // A hinge path may concatenate several sub-paths ("M ... M ..."); the
      // first "M ..." segment is the pointer triangle (extra spines ignored).
      const firstSeg = pm[1].split(/(?=M)/)[0];
      const nums = (firstSeg.match(/-?\d+\.?\d*/g) ?? []).map(Number);
      const pts: [number, number][] = [];
      for (let i = 0; i + 1 < nums.length && pts.length < 3; i += 2) pts.push([nums[i], nums[i + 1]]);
      const tri = apexOfTriangle(pts);
      if (tri) hinges.push(tri);
    }
  }
  return { canvas, cells, sashes, hinges };
}

// ---- cell classification + grid reconstruction ----------------------

interface ClassifiedCell {
  rebate: XYWH;        // footprint at divider-rebate level
  content: SashKind;
  sashKey?: string;
}

function centre(r: XYWH): [number, number] { return [r.x + r.w / 2, r.y + r.h / 2]; }
function contains(r: XYWH, x: number, y: number): boolean {
  return x >= r.x - TOL && x <= r.x + r.w + TOL && y >= r.y - TOL && y <= r.y + r.h + TOL;
}
function inset(r: XYWH, by: number): XYWH { return { x: r.x + by, y: r.y + by, w: r.w - 2 * by, h: r.h - 2 * by }; }

function dirToContent(family: Family, dir: Triangle["dir"]): SashKind {
  if (family === "tilt-turn") return "tilt-turn";
  if (family === "door" || family === "french") {
    return dir === "right" ? "door-right" : "door-left"; // doors hinge on a side
  }
  // casement
  if (dir === "top" || dir === "bottom") return "casement-top";
  return dir === "left" ? "casement-side-left" : "casement-side-right";
}

function classifyCells(parsed: ParsedSvg, rule: FamilyRule): ClassifiedCell[] {
  const out: ClassifiedCell[] = [];
  for (const cell of parsed.cells) {
    const [cx, cy] = centre(cell);
    const sash = parsed.sashes.find((s) => contains(s, cx, cy));
    if (!sash) { out.push({ rebate: cell, content: "fixed" }); continue; }
    // Opening cell: rebate footprint = sash-outer inset by the overlap.
    const rebate = inset(sash, DRAW_SASH_OVERLAP);
    const hinge = parsed.hinges.find((h) => contains(rebate, h.ax, h.ay));
    if (!hinge) { out.push({ rebate, content: "fixed" }); continue; } // belt-and-braces
    out.push({ rebate, content: dirToContent(rule.family, hinge.dir), sashKey: rule.sashKey });
  }
  // Deterministic order: top-to-bottom, left-to-right.
  out.sort((a, b) => a.rebate.y - b.rebate.y || a.rebate.x - b.rebate.x);
  return out;
}

class NonGuillotineError extends Error {}

interface Cut { pos: number; a: ClassifiedCell[]; b: ClassifiedCell[]; }

/** Find a full-span guillotine cut along axis "y" (horizontal) or "x" (vertical). */
function findCut(cells: ClassifiedCell[], axis: "x" | "y"): Cut | null {
  const lo = (c: ClassifiedCell) => (axis === "y" ? c.rebate.y : c.rebate.x);
  const hi = (c: ClassifiedCell) => (axis === "y" ? c.rebate.y + c.rebate.h : c.rebate.x + c.rebate.w);
  const sorted = [...cells].sort((c1, c2) => lo(c1) - lo(c2));
  let maxHi = hi(sorted[0]);
  for (let i = 1; i < sorted.length; i++) {
    if (lo(sorted[i]) > maxHi + TOL) {
      const pos = (maxHi + lo(sorted[i])) / 2;
      // No cell straddles `pos` (guaranteed by the sweep): clean bipartition.
      const a = cells.filter((c) => hi(c) <= pos);
      const b = cells.filter((c) => lo(c) >= pos);
      if (a.length && b.length && a.length + b.length === cells.length) return { pos, a, b };
    }
    maxHi = Math.max(maxHi, hi(sorted[i]));
  }
  return null;
}

interface BuildCtx { canvas: { w: number; h: number }; family: Family; }

function buildTree(cells: ClassifiedCell[], ctx: BuildCtx): CellNode {
  if (cells.length === 1) {
    const c = cells[0];
    return { kind: "leaf", cell: { content: c.content, ...(c.sashKey ? { sashKey: c.sashKey } : {}) } };
  }
  const hCut = findCut(cells, "y");
  if (hCut) {
    return {
      kind: "hsplit",
      splitAtRatio: round4(hCut.pos / ctx.canvas.h),
      transomKey: "transom-t-67", // T/Z not encoded in SVG → default T; root Z applied later
      top: buildTree(hCut.a, ctx),
      bottom: buildTree(hCut.b, ctx),
    };
  }
  const vCut = findCut(cells, "x");
  if (vCut) {
    const left = buildTree(vCut.a, ctx);
    const right = buildTree(vCut.b, ctx);
    let mullionKey = "mullion-78";
    // FRENCH pairing (calibrated Job 00000264): wherever two door leaves MEET
    // across a vertical cut (directly, or at the touching edge of nested
    // vsplits — e.g. door|door|fixed), the divider is the STULP French mullion
    // and the leaves become the master (left, handle side per the docs'
    // "L.RDoSlv") and slave (right, stulp + shootbolt) with the French sash/bead.
    // An already-rewritten leaf no longer starts with "door-", so a leaf can
    // never join two pairs.
    if (ctx.family === "french") {
      const l = edgeLeaf(left, "right");
      const r = edgeLeaf(right, "left");
      if (l && r && l.cell.content.startsWith("door-") && r.cell.content.startsWith("door-")) {
        mullionKey = "french-mullion";
        l.cell = { ...l.cell, content: "french-door-master", beadKey: "bead-32" };
        r.cell = { ...r.cell, content: "french-door-slave", beadKey: "bead-32" };
      }
    }
    return {
      kind: "vsplit",
      splitAtRatio: round4(vCut.pos / ctx.canvas.w),
      mullionKey,
      left,
      right,
    };
  }
  throw new NonGuillotineError("layout is not guillotine-partitionable");
}

/** The single leaf touching a subtree's left/right edge (descends vsplits only). */
function edgeLeaf(n: CellNode, side: "left" | "right"): Extract<CellNode, { kind: "leaf" }> | null {
  if (n.kind === "leaf") return n;
  if (n.kind === "vsplit") return edgeLeaf(side === "left" ? n.left : n.right, side);
  return null; // hsplit/sliding: no single adjacent leaf on a vertical edge
}

function round4(n: number): number { return Math.round(n * 10000) / 10000; }
function leafCount(n: CellNode): number {
  if (n.kind === "leaf") return 1;
  if (n.kind === "sliding") return n.panels.length;
  return n.kind === "hsplit" ? leafCount(n.top) + leafCount(n.bottom) : leafCount(n.left) + leafCount(n.right);
}

/** Job-85 fidelity: a root-level top-hung-over-fixed uses a Z-transom (breaks jambs). */
function applyRootZTransom(topo: CellNode): CellNode {
  if (topo.kind === "hsplit" && topo.top.kind === "leaf" && topo.bottom.kind === "leaf" &&
      topo.top.cell.content === "casement-top" && topo.bottom.cell.content === "fixed") {
    return { ...topo, transomKey: "transom-z-67" };
  }
  return topo;
}

// ---- per-design extraction + self-validation ------------------------

export interface DerivedMeta {
  family: Family;
  calibration: Calibration;
  source: "svg-extractor";
  squares: number | null;
  leaves: number;
  refW: number;
  refH: number;
  reason?: string;
}
export interface DerivedEntry {
  topology: CellNode;
  frameKey: string;
  quotable: boolean;
  meta: DerivedMeta;
}

export interface CollectionDesign {
  designId: string;
  name: string;
  quantityOfSquares?: number | null;
  imageSvg: string;
}

export type ExtractResult =
  | { ok: true; entry: DerivedEntry }
  | { ok: false; reason: string; family: Family };

function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, n)); }

/** Build + validate a topology for one collection design. Pure (no I/O). */
export function extractDesign(d: CollectionDesign, family: Family): ExtractResult {
  const rule = FAMILY_RULES[family];
  if (family === "sliding") return { ok: false, reason: "sliding deferred (no calibrated profiles)", family };

  let parsed: ParsedSvg;
  try { parsed = parseSvg(d.imageSvg); }
  catch (e: any) { return { ok: false, reason: `parse failed: ${e.message}`, family }; }
  if (parsed.cells.length === 0) return { ok: false, reason: "no cells", family };

  const cells = classifyCells(parsed, rule);
  const ctx: BuildCtx = { canvas: parsed.canvas, family };
  let topo: CellNode;
  try { topo = applyRootZTransom(buildTree(cells, ctx)); }
  catch (e: any) { return { ok: false, reason: e.message, family }; }

  const leaves = leafCount(topo);
  if (d.quantityOfSquares != null && leaves !== d.quantityOfSquares) {
    return { ok: false, reason: `leaf ${leaves} != squares ${d.quantityOfSquares}`, family };
  }

  // Self-validate through the REAL engine at a reference size (canvas aspect).
  const refW = clamp(Math.round(parsed.canvas.w), 400, 3000);
  const refH = clamp(Math.round(parsed.canvas.h), 400, 3000);
  const design: Design = { designId: d.designId, name: d.name, productType: family === "door" || family === "french" ? "door" : "window", frameKey: rule.frameKey, topology: topo };
  let solveOk = true, reason: string | undefined;
  try {
    const geom = solveTopology(design, refW, refH, SUNNYPLAST_70);
    computeHardware(geom, SUNNYPLAST_70);
    for (const c of geom.cells) if (c.daylight.w <= 0 || c.daylight.h <= 0) throw new Error("cell collapsed ≤0");
  } catch (e: any) { solveOk = false; reason = `solve failed: ${e.message}`; }

  const quotable = rule.eligible && solveOk;
  // Eligible families MUST solve to be emitted as quotable; if they don't, reject.
  if (rule.eligible && !solveOk) return { ok: false, reason: reason!, family };

  return {
    ok: true,
    entry: {
      topology: topo,
      frameKey: rule.frameKey,
      quotable,
      meta: { family, calibration: rule.calibration, source: "svg-extractor", squares: d.quantityOfSquares ?? null, leaves, refW, refH, reason },
    },
  };
}

// ---- runner: read collection files → write generated artifact -------

const __dirname = dirname(fileURLToPath(import.meta.url));
const COLLECTIONS = join(__dirname, "..", "..", "collections", "product-degins");
const OUT = join(__dirname, "..", "catalog", "derived-topologies.generated.ts");

const FILES: string[] = [
  "01-Sunny Plast 70mm Casement.json",
  "02-Sunny Plast 70mm Tilt & Turn.json",
  "03-Sunny Plast 70mm Single Door.json",
  "04-Sunny Plast 70mm French Door.json",
  "05-Sunny Plast Sliding Patio.json",
];

export function runExtractor(): { derived: Record<string, DerivedEntry>; report: string } {
  const derived: Record<string, DerivedEntry> = {};
  const stats: Record<string, { total: number; quotable: number; gated: number; rejected: number }> = {};

  for (const file of FILES) {
    const family = familyForFile(file);
    const s = (stats[family] ??= { total: 0, quotable: 0, gated: 0, rejected: 0 });
    let raw: any;
    try { raw = JSON.parse(readFileSync(join(COLLECTIONS, file), "utf8")); }
    catch { continue; }
    const list: CollectionDesign[] = raw.filteredList ?? [];
    for (const d of list) {
      s.total++;
      const res = extractDesign(d, family);
      if (!res.ok) { s.rejected++; continue; }
      derived[d.designId] = res.entry;
      if (res.entry.quotable) s.quotable++; else s.gated++;
    }
  }

  const lines = ["Family        total  quotable  gated  rejected"];
  for (const [fam, s] of Object.entries(stats)) {
    lines.push(`${fam.padEnd(12)}  ${String(s.total).padStart(5)}  ${String(s.quotable).padStart(8)}  ${String(s.gated).padStart(5)}  ${String(s.rejected).padStart(8)}`);
  }
  return { derived, report: lines.join("\n") };
}

function writeGenerated(derived: Record<string, DerivedEntry>): void {
  // Deterministic key order for stable diffs.
  const ordered: Record<string, DerivedEntry> = {};
  for (const k of Object.keys(derived).sort()) ordered[k] = derived[k];
  const header = `// AUTO-GENERATED by src/tools/extract-topology.ts — DO NOT EDIT BY HAND.
// Run \`npx tsx src/tools/extract-topology.ts\` to regenerate.
// Each entry maps a collection design's externalId → a derived CellNode topology,
// validated through the engine, plus tier-gated quotability + calibration metadata.
import type { CellNode } from "../types.ts";

export type Calibration = "calibrated" | "structural" | "uncalibrated" | "deferred";
export interface DerivedMeta {
  family: string; calibration: Calibration; source: "svg-extractor";
  squares: number | null; leaves: number; refW: number; refH: number; reason?: string;
}
export interface DerivedEntry { topology: CellNode; frameKey: string; quotable: boolean; meta: DerivedMeta; }

export const DERIVED: Record<string, DerivedEntry> = ${JSON.stringify(ordered, null, 2)};
`;
  writeFileSync(OUT, header, "utf8");
}

// Run when invoked directly (tsx src/tools/extract-topology.ts).
if (import.meta.url === `file://${process.argv[1]}`) {
  const { derived, report } = runExtractor();
  writeGenerated(derived);
  console.log(report);
  console.log(`\nWrote ${Object.keys(derived).length} derived topologies → ${OUT}`);
}
