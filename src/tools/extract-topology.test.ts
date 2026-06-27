// =====================================================================
// tools/extract-topology.test.ts — M3 extractor acceptance assertions.
//
// Wired into the validation harness (src/validation/jobs.ts) so it runs as
// part of `npm run validate`. Pure: re-derives + re-solves the generated
// topologies (no DB needed). Guards: determinism, per-family quotable floors,
// hinge-direction mapping, content/key sanity, and that EVERY quotable design
// still solves through the real engine with leaf count == quantityOfSquares.
// =====================================================================

import { runExtractor, apexOfTriangle } from "./extract-topology.ts";
import { DERIVED } from "../catalog/derived-topologies.generated.ts";
import { solveTopology } from "../engine/topology.ts";
import { computeHardware } from "../engine/hardware.ts";
import { SUNNYPLAST_70 } from "../catalog/system-sunnyplast.ts";
import type { CellNode, Design, SashKind } from "../types.ts";

const VALID_CONTENT = new Set<SashKind>([
  "fixed", "casement-top", "casement-side-left", "casement-side-right",
  "tilt-turn", "door-left", "door-right",
]);

function eachLeaf(n: CellNode, fn: (cell: { content: SashKind; sashKey?: string }) => void): void {
  if (n.kind === "leaf") { fn(n.cell); return; }
  if (n.kind === "hsplit") { eachLeaf(n.top, fn); eachLeaf(n.bottom, fn); }
  else { eachLeaf(n.left, fn); eachLeaf(n.right, fn); }
}
function leafCount(n: CellNode): number {
  if (n.kind === "leaf") return 1;
  return n.kind === "hsplit" ? leafCount(n.top) + leafCount(n.bottom) : leafCount(n.left) + leafCount(n.right);
}

type ExpectFn = (label: string, actual: any, expected: any) => void;

export function validateExtractor(expect: ExpectFn): void {
  console.log("\n==================================================");
  console.log("M3 SVG→topology extractor");
  console.log("==================================================");

  // 1. Determinism — re-deriving from the SVGs yields byte-identical output.
  const a = JSON.stringify(runExtractor().derived);
  const b = JSON.stringify(runExtractor().derived);
  expect("extractor is deterministic", a === b, true);

  // 2. Per-family quotable floors / gating.
  const fam = (f: string) => Object.values(DERIVED).filter((e) => e.meta.family === f);
  const q = (f: string) => fam(f).filter((e) => e.quotable).length;
  console.log("\n[Family gating]");
  expect("casement quotable ≥ 340", q("casement") >= 340, true);
  expect("door quotable = 16", q("door"), 16);
  expect("tilt-turn present, all gated false", fam("tilt-turn").length >= 120 && q("tilt-turn") === 0, true);
  expect("french present, all gated false", fam("french").length >= 10 && q("french") === 0, true);
  expect("sliding excluded from DERIVED (deferred)", fam("sliding").length, 0);

  // 3. Hinge apex → direction mapping (captured from real SVGs).
  console.log("\n[Hinge direction]");
  expect("apex up → top", apexOfTriangle([[162, 838], [500, 162], [838, 838]])?.dir, "top");
  expect("apex left → left", apexOfTriangle([[638, 162], [162, 1050], [638, 1938]])?.dir, "left");
  expect("apex right → right", apexOfTriangle([[162, 162], [638, 1050], [162, 1938]])?.dir, "right");

  // 4. Content/key sanity (ALL entries) + every quotable design solves cleanly.
  console.log("\n[Solve + sanity]");
  let solveFails = 0, keyFails = 0, countFails = 0;
  for (const [id, e] of Object.entries(DERIVED)) {
    eachLeaf(e.topology, (cell) => {
      if (!VALID_CONTENT.has(cell.content)) keyFails++;
      if (cell.sashKey && !SUNNYPLAST_70.sashes[cell.sashKey]) keyFails++;
    });
    if (!e.quotable) continue;
    const isDoor = e.meta.family === "door" || e.meta.family === "french";
    const design: Design = { designId: id, name: id, productType: isDoor ? "door" : "window", frameKey: e.frameKey, topology: e.topology };
    try {
      const g = solveTopology(design, e.meta.refW, e.meta.refH, SUNNYPLAST_70);
      computeHardware(g, SUNNYPLAST_70);
      for (const c of g.cells) if (c.daylight.w <= 0 || c.daylight.h <= 0) throw new Error("collapsed");
    } catch { solveFails++; }
    if (e.meta.squares != null && leafCount(e.topology) !== e.meta.squares) countFails++;
  }
  expect("all quotable designs solve through the engine", solveFails, 0);
  expect("every leaf content/sashKey is valid", keyFails, 0);
  expect("quotable leaf count == quantityOfSquares", countFails, 0);
}
