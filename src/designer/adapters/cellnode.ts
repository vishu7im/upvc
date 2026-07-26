// =====================================================================
// designer/adapters/cellnode.ts — the engine adapter for CellNode families
// (casement windows now; entrance/french doors later).
//
//   Spec/00-architecture/product-family-plugin.md §3 (adapter contract +
//   componentId scheme) · Spec/01-windows-module/phase-2-line-item-core.md.
//
// PURE: immutable tree transforms + projections of already-solved geometry.
// No I/O, no catalog access beyond the ProfileSystem handed in via context.
//
// ComponentId scheme (stable, position-derived — NEVER a uuid, so ids survive
// re-solves, serialization and line-item duplication):
//   cell:<path>          the leaf cell region  (type sash when sash-bearing,
//                        glass otherwise; <path> = the engine pathId, "root.top")
//   cell:<path>/glass    the glass pane inside a SASH cell
//   divider:<path>       the transom/mullion of the split node at <path>
//                        (midrail dividers repeat the cell path, suffixed #i)
//   edge:top|bottom|left|right   the outer-frame edges
//   cill                 the fitted cill, when present
//
// TOPOLOGY EDITS map onto existing engine concepts only — no new engine math:
//   split              inserts an hsplit/vsplit node (engine: solveTopology walk)
//   add-midrail        appends to CellSpec.midrails (calibrated Job 00000264)
//   convert-component / set-sash-kind   change leaf content (existing SashKinds)
//   remove-divider     collapses a split whose children are both leaves
// "equal" positions are the midpoint of the target cell's solved bounds — the
// engine centres a divider on its ratio line (topology.ts), so a mid-bounds
// centre yields equal daylight children by construction.
// =====================================================================

import type {
  CellNode,
  CellSpec,
  ProfileSystem,
  QuoteInput,
  QuoteView,
  Rect,
  SashKind,
  SolvedGeometry,
} from "../../types.ts";
import type { ComponentType, TopologyEdit } from "../option-types.ts";
import type {
  AdapterEditContext,
  ComponentRef,
  EngineAdapter,
  EngineEffectOutputs,
  LineItemDraft,
} from "../line-item-types.ts";
import type { Design } from "../../types.ts";

/** Thrown for illegal edits / unknown componentIds, so callers can convert to Issues. */
export class AdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterError";
  }
}

// ---------------------------------------------------------------------
// ComponentId parsing & tree walking
// ---------------------------------------------------------------------

export interface ParsedComponentId {
  kind: "cell" | "divider" | "edge" | "cill";
  /** Engine pathId ("root.top") for cell/divider; edge side for edge. */
  path: string;
  /** "glass" | "sash" sub-component of a cell, when addressed. */
  sub?: string;
}

export function parseComponentId(id: string): ParsedComponentId {
  if (id === "cill") return { kind: "cill", path: "" };
  const m = /^(cell|divider|edge):([^/]+)(?:\/(\w+))?$/.exec(id);
  if (!m) throw new AdapterError(`Malformed componentId: "${id}"`);
  const [, kind, path, sub] = m;
  return { kind: kind as ParsedComponentId["kind"], path, ...(sub ? { sub } : {}) };
}

/** Path segments after "root" (["top","left",…]); throws on foreign path roots. */
function pathSegments(path: string): string[] {
  const parts = path.split(".");
  if (parts[0] !== "root") throw new AdapterError(`Component path must start at "root": ${path}`);
  return parts.slice(1);
}

/**
 * Replace the node at `path` with `fn(node)`, immutably. Every node on the
 * way down is cloned; everything else is shared. Sliding rows are rejected —
 * they belong to the sliding adapter.
 */
function replaceAt(node: CellNode, segs: string[], fn: (n: CellNode) => CellNode): CellNode {
  if (segs.length === 0) return fn(node);
  const [head, ...rest] = segs;
  if (node.kind === "hsplit" && (head === "top" || head === "bottom")) {
    return { ...node, [head]: replaceAt(node[head], rest, fn) };
  }
  if (node.kind === "vsplit" && (head === "left" || head === "right")) {
    return { ...node, [head]: replaceAt(node[head], rest, fn) };
  }
  if (node.kind === "sliding") {
    throw new AdapterError("Sliding topologies use the sliding adapter, not cellnode");
  }
  throw new AdapterError(`No node at path segment "${head}" (node kind: ${node.kind})`);
}

function nodeAt(node: CellNode, segs: string[]): CellNode {
  let cur = node;
  for (const head of segs) {
    if (cur.kind === "hsplit" && (head === "top" || head === "bottom")) cur = cur[head];
    else if (cur.kind === "vsplit" && (head === "left" || head === "right")) cur = cur[head];
    else throw new AdapterError(`No node at path segment "${head}" (node kind: ${cur.kind})`);
  }
  return cur;
}

// ---------------------------------------------------------------------
// listComponents — addressable components from solved geometry
// ---------------------------------------------------------------------

function cellLabel(path: string, content: SashKind): string {
  const where = path === "root" ? "" : ` (${path.replace(/^root\./, "")})`;
  if (content === "fixed") return `Fixed glass${where}`;
  return `${content}${where}`;
}

export function listComponents(geometry: SolvedGeometry): ComponentRef[] {
  const out: ComponentRef[] = [];
  const { outer, rootDaylight: day } = geometry;

  // Frame edges: the strips between the outer rect and the root daylight.
  const edges: { side: string; rect: Rect }[] = [
    { side: "top", rect: { x: 0, y: 0, w: outer.w, h: day.y } },
    { side: "bottom", rect: { x: 0, y: day.y + day.h, w: outer.w, h: outer.h - day.y - day.h } },
    { side: "left", rect: { x: 0, y: day.y, w: day.x, h: day.h } },
    { side: "right", rect: { x: day.x + day.w, y: day.y, w: outer.w - day.x - day.w, h: day.h } },
  ];
  for (const e of edges) {
    out.push({ componentId: `edge:${e.side}`, type: "frame-edge", label: `Frame ${e.side}`, rect: e.rect, path: e.side });
  }

  for (const cell of geometry.cells) {
    const isSash = Boolean(cell.sashOuter);
    out.push({
      componentId: `cell:${cell.pathId}`,
      type: isSash ? "sash" : "glass",
      label: cellLabel(cell.pathId, cell.content),
      rect: isSash ? cell.sashOuter! : cell.glassRect,
      path: cell.pathId,
      kind: cell.content,
    });
    if (isSash) {
      out.push({
        componentId: `cell:${cell.pathId}/glass`,
        type: "glass",
        label: `Glass in ${cellLabel(cell.pathId, cell.content)}`,
        rect: cell.glassRect,
        path: cell.pathId,
      });
    }
  }

  // Dividers. Split-node dividers carry the split node's path (unique); midrail
  // dividers repeat their host cell's path, so repeats get a #i suffix.
  const seen = new Map<string, number>();
  const divider = (parentPathId: string, type: ComponentType, rect: Rect, joint: string) => {
    const n = seen.get(parentPathId) ?? 0;
    seen.set(parentPathId, n + 1);
    const id = n === 0 ? `divider:${parentPathId}` : `divider:${parentPathId}#${n}`;
    out.push({ componentId: id, type, label: `${type} at ${parentPathId}`, rect, path: parentPathId, kind: joint });
  };
  for (const t of geometry.transoms) divider(t.parentPathId, "transom", t.rect, t.jointType);
  for (const m of geometry.mullions) divider(m.parentPathId, "mullion", m.rect, m.jointType);

  if (geometry.cill) {
    out.push({ componentId: "cill", type: "cill", label: geometry.cill.name, rect: geometry.cill.rect, path: "cill" });
  }

  return out;
}

// ---------------------------------------------------------------------
// applyEdit — immutable topology transforms
// ---------------------------------------------------------------------

/**
 * Default divider profiles for designer-inserted splits: the same defaults the
 * M3 extractor applies to every collection design (transom-t-67 for horizontal
 * cuts, mullion-78 for vertical) — no new fabrication assumption.
 */
const DEFAULT_TRANSOM_KEY = "transom-t-67";
const DEFAULT_MULLION_KEY = "mullion-78";
/** French-calibrated midrail profile (Job 00000264) — the only midrail in the catalog. */
const DEFAULT_MIDRAIL_KEY = "midrail-67";
/** The calibrated casement sash profile — every casement design's sash key. */
const DEFAULT_SASH_KEY = "sash-t";
/**
 * Sash kind used when a conversion doesn't specify one. A UI default only
 * (phase 3/4 sends an explicit kind): top-hung, the commonest opener in the
 * calibrated jobs (85/88). Not a fabrication rule — any kind is buildable.
 */
const DEFAULT_SASH_KIND: SashKind = "casement-top";

function solvedCellAt(ctx: AdapterEditContext, path: string) {
  const cell = ctx.geometry.cells.find((c) => c.pathId === path);
  if (!cell) throw new AdapterError(`No solved cell at path "${path}"`);
  return cell;
}

function requireLeaf(node: CellNode, path: string): Extract<CellNode, { kind: "leaf" }> {
  if (node.kind !== "leaf") throw new AdapterError(`Component at "${path}" is not a leaf cell (kind: ${node.kind})`);
  return node;
}

function ratioOrThrow(edit: { position: "equal" | "at-ratio"; atRatio?: number }, equal: () => number): number {
  if (edit.position === "at-ratio") {
    if (!Number.isFinite(edit.atRatio) || edit.atRatio! <= 0 || edit.atRatio! >= 1) {
      throw new AdapterError(`"at-ratio" needs atRatio in (0,1), got ${edit.atRatio}`);
    }
    return edit.atRatio!;
  }
  return equal();
}

export function applyEdit(topology: CellNode, edit: TopologyEdit, ctx: AdapterEditContext): CellNode {
  const target = parseComponentId(edit.componentId);

  switch (edit.op) {
    case "split": {
      if (target.kind !== "cell") throw new AdapterError(`split targets a cell, got "${edit.componentId}"`);
      const segs = pathSegments(target.path);
      const solved = solvedCellAt(ctx, target.path);
      const isH = edit.axis === "horizontal";
      // Equal ⇒ divider centred at the midpoint of the cell's bounds; the
      // engine centres the divider on ratio × window (topology.ts), so the two
      // children get equal daylight by construction.
      const ratio = ratioOrThrow(edit, () =>
        isH
          ? (solved.outer.y + solved.outer.h / 2) / ctx.heightMm
          : (solved.outer.x + solved.outer.w / 2) / ctx.widthMm,
      );
      const dividerKey = edit.dividerKey ?? (isH ? DEFAULT_TRANSOM_KEY : DEFAULT_MULLION_KEY);
      if (!ctx.system.transoms[dividerKey]) {
        throw new AdapterError(`Unknown divider profile: ${dividerKey}`);
      }
      return replaceAt(topology, segs, (node) => {
        const leaf = requireLeaf(node, target.path);
        if (leaf.cell.midrails?.length) {
          throw new AdapterError(`Cell "${target.path}" has midrails — remove them before splitting`);
        }
        const clone = (): CellNode => ({ kind: "leaf", cell: { ...leaf.cell } });
        return isH
          ? { kind: "hsplit", splitAtRatio: ratio, transomKey: dividerKey, top: clone(), bottom: clone() }
          : { kind: "vsplit", splitAtRatio: ratio, mullionKey: dividerKey, left: clone(), right: clone() };
      });
    }

    case "add-midrail": {
      if (target.kind !== "cell") throw new AdapterError(`add-midrail targets a cell, got "${edit.componentId}"`);
      const segs = pathSegments(target.path);
      const solved = solvedCellAt(ctx, target.path);
      if (!solved.sashInner) {
        throw new AdapterError(`Cell "${target.path}" has no sash — midrails weld inside a sash ring`);
      }
      // Equal ⇒ the midrail centreline at the middle of the sash's glazing
      // opening; atRatio is a FULL-window fraction (CellSpec.midrails contract).
      const ratio = ratioOrThrow(edit, () => (solved.sashInner!.y + solved.sashInner!.h / 2) / ctx.heightMm);
      const transomKey = edit.transomKey ?? DEFAULT_MIDRAIL_KEY;
      if (!ctx.system.transoms[transomKey]) throw new AdapterError(`Unknown midrail profile: ${transomKey}`);
      return replaceAt(topology, segs, (node) => {
        const leaf = requireLeaf(node, target.path);
        const midrails = [...(leaf.cell.midrails ?? []), { transomKey, atRatio: ratio }];
        return { kind: "leaf", cell: { ...leaf.cell, midrails } };
      });
    }

    case "convert-component": {
      if (target.kind !== "cell") throw new AdapterError(`convert-component targets a cell, got "${edit.componentId}"`);
      const segs = pathSegments(target.path);
      return replaceAt(topology, segs, (node) => {
        const leaf = requireLeaf(node, target.path);
        if (edit.to === "glass" || edit.to === "panel") {
          // Panels are catalog glass rows (Q5): structurally identical to fixed
          // glazing — the panel ROW is then chosen via glazing.glass-type.
          const { sashKey: _s, midrails: _m, ...rest } = leaf.cell;
          return { kind: "leaf", cell: { ...rest, content: "fixed" } };
        }
        if (edit.to === "sash") {
          const kind = edit.kind ?? DEFAULT_SASH_KIND;
          if (!ctx.system.sashes[leaf.cell.sashKey ?? DEFAULT_SASH_KEY]) {
            throw new AdapterError(`Unknown sash profile: ${leaf.cell.sashKey ?? DEFAULT_SASH_KEY}`);
          }
          return {
            kind: "leaf",
            cell: { ...leaf.cell, content: kind, sashKey: leaf.cell.sashKey ?? DEFAULT_SASH_KEY },
          };
        }
        throw new AdapterError(`Cannot convert a cell to "${edit.to}"`);
      });
    }

    case "set-sash-kind": {
      if (target.kind !== "cell") throw new AdapterError(`set-sash-kind targets a cell, got "${edit.componentId}"`);
      const segs = pathSegments(target.path);
      return replaceAt(topology, segs, (node) => {
        const leaf = requireLeaf(node, target.path);
        if (edit.kind === "fixed") {
          const { sashKey: _s, midrails: _m, ...rest } = leaf.cell;
          return { kind: "leaf", cell: { ...rest, content: "fixed" } };
        }
        if (!ctx.system.sashes[leaf.cell.sashKey ?? DEFAULT_SASH_KEY]) {
          throw new AdapterError(`Unknown sash profile: ${leaf.cell.sashKey ?? DEFAULT_SASH_KEY}`);
        }
        return {
          kind: "leaf",
          cell: { ...leaf.cell, content: edit.kind, sashKey: leaf.cell.sashKey ?? DEFAULT_SASH_KEY },
        };
      });
    }

    case "remove-divider": {
      if (target.kind !== "divider") throw new AdapterError(`remove-divider targets a divider, got "${edit.componentId}"`);
      if (target.path.includes("#")) {
        throw new AdapterError("Midrail dividers are removed by editing the cell's midrails, not remove-divider");
      }
      const segs = pathSegments(target.path);
      const node = nodeAt(topology, segs);
      if (node.kind === "leaf" || node.kind === "sliding") {
        // A midrail divider shares its host CELL's path — reject with guidance.
        throw new AdapterError(`No split divider at "${target.path}"`);
      }
      const [a, b] = node.kind === "hsplit" ? [node.top, node.bottom] : [node.left, node.right];
      if (a.kind !== "leaf" || b.kind !== "leaf") {
        throw new AdapterError(
          `Cannot remove the divider at "${target.path}": both sides must be plain cells (remove nested dividers first)`,
        );
      }
      // The merged cell keeps the FIRST (top/left) child's spec.
      return replaceAt(topology, segs, () => ({ kind: "leaf", cell: { ...a.cell } }));
    }
  }
}

// ---------------------------------------------------------------------
// Per-cell glass/bead pinning (component-scoped selections)
// ---------------------------------------------------------------------

/** Immutably pin a CellSpec field on the leaf at `path`. */
export function pinCellField(
  topology: CellNode,
  path: string,
  patch: Partial<Pick<CellSpec, "glassKey" | "beadKey">>,
): CellNode {
  return replaceAt(topology, pathSegments(path), (node) => {
    const leaf = requireLeaf(node, path);
    return { kind: "leaf", cell: { ...leaf.cell, ...patch } };
  });
}

/** Immutably pin a CellSpec field on EVERY leaf (item-level bead/glass). */
export function pinAllCells(
  topology: CellNode,
  patch: Partial<Pick<CellSpec, "glassKey" | "beadKey">>,
): CellNode {
  if (topology.kind === "leaf") return { kind: "leaf", cell: { ...topology.cell, ...patch } };
  if (topology.kind === "sliding") {
    throw new AdapterError("Sliding topologies use the sliding adapter, not cellnode");
  }
  if (topology.kind === "hsplit") {
    return { ...topology, top: pinAllCells(topology.top, patch), bottom: pinAllCells(topology.bottom, patch) };
  }
  return { ...topology, left: pinAllCells(topology.left, patch), right: pinAllCells(topology.right, patch) };
}

// ---------------------------------------------------------------------
// Equal-split mode (draft.splitMode === "equalSplit")
// ---------------------------------------------------------------------

/**
 * splitRatios that make every same-axis run of cells share its daylight
 * equally. Works per "chain": a run of same-axis split nodes forming a path
 * (n dividers ⇒ n+1 slots). Within a region [start,end] the engine gives cell
 * daylights of (span − Σfaces)/n when divider i's centre sits at
 * start + i×cell + faces-so-far + face_i/2 — pure restatement of the engine's
 * "divider centred on ratio × window" rule (topology.ts), no new geometry.
 */
export function equalSplitRatios(
  topology: CellNode,
  widthMm: number,
  heightMm: number,
  system: ProfileSystem,
  frameFaceWidth: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  const day: Rect = {
    x: frameFaceWidth,
    y: frameFaceWidth,
    w: widthMm - 2 * frameFaceWidth,
    h: heightMm - 2 * frameFaceWidth,
  };
  walkEqual(topology, "root", day, system, widthMm, heightMm, out);
  return out;
}

function dividerFace(system: ProfileSystem, key: string): number {
  const t = system.transoms[key];
  if (!t) throw new AdapterError(`Unknown divider profile: ${key}`);
  return t.faceWidth;
}

function walkEqual(
  node: CellNode,
  pathId: string,
  bounds: Rect,
  system: ProfileSystem,
  windowW: number,
  windowH: number,
  out: Record<string, number>,
): void {
  if (node.kind === "leaf") return;
  if (node.kind === "sliding") throw new AdapterError("Sliding topologies use the sliding adapter, not cellnode");

  const axis = node.kind;
  // Flatten the maximal same-axis chain under this node (in order).
  const slots: { node: CellNode; pathId: string }[] = [];
  const dividers: { pathId: string; face: number }[] = [];
  const flatten = (n: CellNode, p: string) => {
    if (n.kind === axis) {
      const [first, second] =
        n.kind === "hsplit"
          ? ([[n.top, p + ".top"], [n.bottom, p + ".bottom"]] as const)
          : ([[n.left, p + ".left"], [n.right, p + ".right"]] as const);
      flatten(first[0], first[1]);
      dividers.push({ pathId: p, face: dividerFace(system, n.kind === "hsplit" ? n.transomKey : n.mullionKey) });
      flatten(second[0], second[1]);
    } else {
      slots.push({ node: n, pathId: p });
    }
  };
  flatten(node, pathId);

  const horizontal = axis === "hsplit"; // hsplit stacks slots vertically
  const start = horizontal ? bounds.y : bounds.x;
  const span = horizontal ? bounds.h : bounds.w;
  const window = horizontal ? windowH : windowW;
  const totalFace = dividers.reduce((s, d) => s + d.face, 0);
  const cellSpan = (span - totalFace) / slots.length;
  if (cellSpan <= 0) throw new AdapterError(`Equal split leaves no room at "${pathId}"`);

  // Assign each divider's ratio and each slot's sub-bounds, in order.
  let cursor = start;
  for (let i = 0; i < slots.length; i++) {
    const slotStart = cursor;
    cursor += cellSpan;
    const sub: Rect = horizontal
      ? { x: bounds.x, y: slotStart, w: bounds.w, h: cellSpan }
      : { x: slotStart, y: bounds.y, w: cellSpan, h: bounds.h };
    walkEqual(slots[i].node, slots[i].pathId, sub, system, windowW, windowH, out);
    if (i < dividers.length) {
      out[dividers[i].pathId] = (cursor + dividers[i].face / 2) / window;
      cursor += dividers[i].face;
    }
  }
}

// ---------------------------------------------------------------------
// toQuoteInput
// ---------------------------------------------------------------------

export function toQuoteInput(args: {
  draft: LineItemDraft;
  design: Design;
  workingTopology: CellNode;
  topologyEdited: boolean;
  effects: EngineEffectOutputs;
  splitRatios?: Record<string, number>;
  views?: QuoteView[];
  svgStyle?: QuoteInput["svgStyle"];
}): QuoteInput {
  const { draft, workingTopology, topologyEdited, effects, splitRatios, views, svgStyle } = args;
  return {
    orderNo: "DESIGNER",
    customer: "Designer",
    designId: draft.designId,
    widthMm: draft.dimensions.widthMm,
    heightMm: draft.dimensions.heightMm,
    systemId: draft.systemId,
    ...(splitRatios && Object.keys(splitRatios).length ? { splitRatios } : {}),
    ...(effects.glassKey ? { glassKey: effects.glassKey } : {}),
    ...(effects.colourKey ? { colourKey: effects.colourKey } : {}),
    ...(effects.colourKeyOutside ? { colourKeyOutside: effects.colourKeyOutside } : {}),
    ...(effects.cillKey ? { cillKey: effects.cillKey } : {}),
    ...(effects.frameKey ? { frameKey: effects.frameKey } : {}),
    ...(effects.hardwareOverrides && Object.keys(effects.hardwareOverrides).length
      ? { hardwareOverrides: effects.hardwareOverrides }
      : {}),
    ...(topologyEdited ? { topologyOverride: workingTopology } : {}),
    ...(views?.length ? { views } : {}),
    ...(svgStyle ? { svgStyle } : {}),
  };
}

export const cellnodeAdapter: EngineAdapter = { applyEdit, listComponents, toQuoteInput };
