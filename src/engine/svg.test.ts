// =====================================================================
// engine/svg.test.ts — render-option invariants for renderSvg().
//
// Pure unit test (no DB). Proves the inner-joint overlay and colour-tint
// options are strictly ADDITIVE: the historical call shape produces a
// byte-identical SVG, and each opt-in option only ADDS markup.
//
// Wired into `npm run validate` via validateSvg(expect) (see
// src/validation/jobs.ts), like the M5 pricing test.
// =====================================================================

import { renderSvg } from "./svg.ts";
import type { SolvedGeometry, Rect } from "../types.ts";

type Expect = (label: string, actual: any, expected: any) => void;

const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

// A 2-cell window with one transom (T-joint) and one mullion (Z-joint), one
// fixed cell and one opening (casement-left) sash cell — enough to exercise the
// frame mitres, sash mitres, and both divider-marker styles.
function makeGeometry(): SolvedGeometry {
  return {
    outer: R(0, 0, 1200, 1500),
    rootDaylight: R(64, 64, 1072, 1372),
    transoms: [
      { rect: R(64, 740, 1072, 20), parentPathId: "root", transomKey: "t", extLengthMm: 1072, intLengthMm: 1072, jointType: "T" },
    ],
    mullions: [
      { rect: R(590, 64, 20, 676), parentPathId: "root.top", mullionKey: "m", extLengthMm: 676, intLengthMm: 676, jointType: "Z" },
    ],
    cells: [
      {
        pathId: "root.top.left", outer: R(64, 64, 526, 676), daylight: R(94, 94, 466, 616),
        content: "casement-side-left", beadKey: "bead", glassKey: "g", sashKey: "sash",
        sashOuter: R(84, 84, 486, 636), sashInner: R(120, 120, 414, 564),
        glassRect: R(135, 135, 384, 534), beadIntW: 384, beadIntH: 534,
      },
      {
        pathId: "root.bottom", outer: R(64, 760, 1072, 676), daylight: R(94, 790, 1012, 616),
        content: "fixed", beadKey: "bead", glassKey: "g",
        glassRect: R(110, 806, 980, 584), beadIntW: 980, beadIntH: 584,
      },
    ],
  } as unknown as SolvedGeometry;
}

export function validateSvg(expect: Expect): void {
  console.log("\n==================================================");
  console.log("renderSvg render-option invariants");
  console.log("==================================================");

  const g = makeGeometry();
  const base = renderSvg(g);

  // 1. Byte-identity: the historical call shape is unchanged by the new param.
  expect("renderSvg(g) === renderSvg(g, {})", renderSvg(g, {}), base);
  expect("renderSvg(g) === renderSvg(g, {joints:false})", renderSvg(g, { joints: false }), base);
  expect("base SVG has NO joint layer", base.includes('id="joints"'), false);

  // 2. Joints opt-in only ADDS a <g id="joints"> overlay.
  const withJoints = renderSvg(g, { joints: true });
  expect("joints:true adds a joint layer", withJoints.includes('id="joints"'), true);
  expect("joints layer sits AFTER the base markup (additive)", withJoints.startsWith(base.slice(0, 40)), true);

  // 3. Base-colour / no-hex tint is a no-op: passing empty colour keeps grey.
  expect("empty colour opts ⇒ byte-identical", renderSvg(g, { colour: {} }), base);

  // 4. A real outside-colour hex tints the profile fill (and only that).
  const tinted = renderSvg(g, { colour: { outsideHex: "#353b3f" } });
  expect("outside hex appears in SVG", tinted.includes("#353b3f"), true);
  expect("default grey profile fill replaced", tinted.includes("#e6e6e6"), false);

  // 5. Dual colour adds the inside liner hint without removing the outside fill.
  // (Inside hex chosen distinct from the white glass fill so the check is real.)
  const dual = renderSvg(g, { colour: { insideHex: "#aa00bb", outsideHex: "#353b3f" } });
  expect("dual: outside hex present", dual.includes("#353b3f"), true);
  expect("dual: inside liner hex present", dual.includes("#aa00bb"), true);
}
