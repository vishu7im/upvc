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

  // ---- phase 5: internal + schematic views ---------------------------
  validateViewOptions(expect, g, base);

  // ---- realistic presentation style ----------------------------------
  validateRealisticStyle(expect, g, base);
}

/**
 * The opt-in presentation style. Same discipline as joints/colour/views: the
 * historical call shape is untouched, and everything it adds is derived from
 * rects the solver already produced.
 */
function validateRealisticStyle(expect: Expect, g: SolvedGeometry, base: string): void {
  // 11. Omitted or explicitly flat ⇒ the historical drawing, byte for byte.
  expect('style:"flat" ⇒ byte-identical', renderSvg(g, { style: "flat" }), base);
  expect("base SVG has no <defs>", base.includes("<defs>"), false);
  expect("base SVG has no shadow filter", base.includes("feDropShadow"), false);

  const real = renderSvg(g, { style: "realistic" });
  expect("realistic adds a defs block", real.includes("<defs>"), true);
  expect("realistic casts one drop shadow", (real.match(/feDropShadow/g) ?? []).length, 1);
  expect("realistic keeps the historical viewBox", real.slice(0, real.indexOf(">")), base.slice(0, base.indexOf(">")));

  // 12. Every ring is drawn as four mitred faces. This fixture has the outer
  // frame, one sash ring, one sash bead ring and one fixed-pane bead ring = 4
  // rings × 4 faces, plus 2 faces for each of the transom and mullion bevels.
  const faces = (real.match(/<polygon points="[^"]*" fill="url\(/g) ?? []).length;
  expect("realistic draws 4 faces per ring + 2 per divider bar", faces, 4 * 4 + 2 * 2);

  // 13. Gradients are derived from the finish, so a tinted unit carries its own
  // set and the grey default carries the default set — never both.
  const tinted = renderSvg(g, { style: "realistic", colour: { outsideHex: "#4a2418" } });
  expect("realistic derives its gradient ids from the finish", tinted.includes('id="w4a2418-t"'), true);
  expect("a different finish ⇒ different ids", real.includes('id="w4a2418-t"'), false);

  // 14. Woodgrain is catalog data: no flag ⇒ no filter, whatever the colour is.
  expect("no texture ⇒ no grain filter", tinted.includes("feTurbulence"), false);
  const grained = renderSvg(g, { style: "realistic", colour: { outsideHex: "#4a2418", grain: true } });
  expect("texture ⇒ grain filters emitted", (grained.match(/feTurbulence/g) ?? []).length, 2);
  expect("grain is applied to the faces", grained.includes("filter=\"url(#w4a2418g-grainH)\""), true);

  // 15. A technical drawing must stay flat, so schematic wins over style.
  expect(
    "schematic + realistic ⇒ the schematic drawing",
    renderSvg(g, { style: "realistic", schematic: {} }),
    renderSvg(g, { schematic: {} }),
  );

  // 16. The internal elevation still mirrors, and its shadow is applied OUTSIDE
  // the mirror so both sides are lit from the same direction.
  const realInternal = renderSvg(g, { style: "realistic", view: "internal" });
  expect("realistic internal still mirrors", realInternal.includes('matrix(-1 0 0 1 1200 0)'), true);
  expect(
    "the shadow group wraps the mirror, not the other way round",
    realInternal.indexOf("-shadow)") < realInternal.indexOf("matrix(-1"),
    true,
  );
  expect("realistic internal still draws handles", realInternal.includes('id="handles"'), true);

  // 17. Other families render without throwing (French carries a glazing-only
  // pane with no sash rects; sliding carries framed panels and no divider).
  const french = renderSvg(makeFrenchGeometry(), { style: "realistic" });
  expect("French renders realistically", french.startsWith("<svg"), true);
  const sliding = renderSvg(makeSlidingGeometry(), { style: "realistic" });
  expect("sliding renders realistically", sliding.startsWith("<svg"), true);
}

/**
 * Internal (mirrored + handled) and schematic (annotated technical) elevations.
 * Both are opt-in render options with the same byte-identity discipline as
 * joints/colour above.
 */
function validateViewOptions(expect: Expect, g: SolvedGeometry, base: string): void {
  // 6. Requesting the default view explicitly changes nothing.
  expect('view:"external" ⇒ byte-identical', renderSvg(g, { view: "external" }), base);
  expect("base SVG has no mirror transform", base.includes("matrix(-1"), false);
  expect("base SVG has no handles layer", base.includes('id="handles"'), false);
  expect("base SVG has no annotations", base.includes("<text"), false);

  // 7. Internal = the same drawing mirrored about the window centreline. The
  // viewBox is symmetric about x = w/2, so it is unchanged by the mirror.
  const internal = renderSvg(g, { view: "internal" });
  expect("internal mirrors about w (1200)", internal.includes('transform="matrix(-1 0 0 1 1200 0)"'), true);
  expect(
    "internal viewBox unchanged",
    internal.slice(0, internal.indexOf(">")),
    base.slice(0, base.indexOf(">")),
  );
  const bodyLines = base
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("<rect") || l.startsWith("<polyline"));
  expect(
    "internal keeps every base shape verbatim (only the transform is new)",
    bodyLines.every((l) => internal.includes(l)),
    true,
  );

  // 8. Handles: the fixture's sash is casement-side-left (hinge LEFT), so the
  // handle is on its right stile when seen from outside — and therefore on the
  // LEFT half of that sash in the mirrored internal elevation.
  expect("internal adds a handles layer", internal.includes('id="handles"'), true);
  const handles = handleRects(internal);
  expect("one sash ⇒ handle glyph drawn (rose + lever)", handles.length, 2);
  // Sash ring R(84,84,486,636) mirrors to x 630..1116, centre 873.
  const sashCentreMirrored = 1200 - (84 + 486 / 2);
  expect(
    "hinge-left sash: handle sits on the sash's LEFT half internally",
    handles.every((r) => r.x + r.w / 2 < sashCentreMirrored),
    true,
  );
  expect(
    "handle stays inside the mirrored sash ring",
    handles.every((r) => r.x >= 1200 - (84 + 486) && r.x + r.w <= 1200 - 84),
    true,
  );

  // 9. Schematic: technical style + the annotation layer, with every number
  // read off the solved rects (frame face 64, sash ring face 36, glass sizes
  // rounded exactly as bars.ts#emitGlass rounds them).
  const schematic = renderSvg(g, { schematic: { faceWidths: true, glassSizes: true } });
  expect("schematic adds the annotation layer", schematic.includes('id="schematic"'), true);
  expect("schematic drops the grey profile fill", schematic.includes("#e6e6e6"), false);
  expect("schematic frame face 64", schematic.includes(">64</text>"), true);
  expect("schematic sash ring face 36", schematic.includes(">36</text>"), true);
  expect("schematic glass size of the sash pane", schematic.includes(">384 × 534</text>"), true);
  expect("schematic glass size of the fixed pane", schematic.includes(">980 × 584</text>"), true);

  // Each annotation family can be switched off independently.
  const facesOnly = renderSvg(g, { schematic: { faceWidths: true, glassSizes: false } });
  expect("faceWidths only: no glass labels", facesOnly.includes("×"), false);
  expect("faceWidths only: still annotates the frame", facesOnly.includes(">64</text>"), true);
  const glassOnly = renderSvg(g, { schematic: { faceWidths: false, glassSizes: true } });
  expect("glassSizes only: no face labels", glassOnly.includes(">64</text>"), false);
  expect("glassSizes only: still annotates the panes", glassOnly.includes(">384 × 534</text>"), true);

  // 10. Other families render without crashing: a French leaf pair (stulp
  // mullion + a midrail glazing pane that carries NO sash rects) and a sliding
  // row (panels whose hinge edge is deliberately unmapped, so no handle).
  const french = renderSvg(makeFrenchGeometry(), { view: "internal", schematic: {} });
  expect("French pair renders in internal+schematic", french.startsWith("<svg"), true);
  expect("French leaves get handles on the meeting stiles", french.includes('id="handles"'), true);
  const sliding = renderSvg(makeSlidingGeometry(), { view: "internal", schematic: {} });
  expect("sliding renders in internal+schematic", sliding.startsWith("<svg"), true);
  expect("sliding panels get NO invented handle side", sliding.includes('id="handles"'), false);
}

/** The `<rect>`s inside the handles layer, as numbers. */
function handleRects(svg: string): Rect[] {
  const layer = svg.slice(svg.indexOf('<g id="handles"'));
  const out: Rect[] = [];
  for (const m of layer.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/g)) {
    out.push({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) });
  }
  return out;
}

/** Two French leaves meeting on a stulp, the left one with a midrail pane. */
function makeFrenchGeometry(): SolvedGeometry {
  return {
    outer: R(0, 0, 1700, 2100),
    rootDaylight: R(48, 48, 1604, 2004),
    transoms: [],
    mullions: [
      { rect: R(826, 48, 48, 2004), parentPathId: "root", mullionKey: "french-mullion", extLengthMm: 2004, intLengthMm: 2004, jointType: "S" },
    ],
    cells: [
      {
        pathId: "root.left", outer: R(48, 48, 778, 2004), daylight: R(48, 48, 778, 2004),
        content: "french-door-master", beadKey: "bead-32", glassKey: "g", sashKey: "sash-door-t-fr",
        sashOuter: R(28, 28, 818, 2044), sashInner: R(133, 133, 608, 1834),
        glassRect: R(148, 148, 578, 869), beadIntW: 578, beadIntH: 869,
      },
      {
        pathId: "root.left#p2", outer: R(48, 1000, 778, 1052), daylight: R(48, 1000, 778, 1052),
        content: "french-door-master", beadKey: "bead-32", glassKey: "g",
        glassRect: R(148, 1098, 578, 869), beadIntW: 578, beadIntH: 869,
      },
      {
        pathId: "root.right", outer: R(874, 48, 778, 2004), daylight: R(874, 48, 778, 2004),
        content: "french-door-slave", beadKey: "bead-32", glassKey: "g", sashKey: "sash-door-z-fr",
        sashOuter: R(854, 28, 818, 2044), sashInner: R(959, 133, 608, 1834),
        glassRect: R(974, 148, 578, 1804), beadIntW: 578, beadIntH: 1804,
      },
    ],
  } as unknown as SolvedGeometry;
}

/** A 2-panel sliding patio (framed panels, no transom/mullion). */
function makeSlidingGeometry(): SolvedGeometry {
  return {
    outer: R(0, 0, 1900, 2100),
    rootDaylight: R(48, 48, 1804, 2004),
    transoms: [],
    mullions: [],
    cells: [
      {
        pathId: "root.p1", outer: R(48, 48, 902, 2004), daylight: R(48, 48, 902, 2004),
        content: "sliding-slide-left", beadKey: "bead-sl-24", glassKey: "g", sashKey: "sash-sliding",
        sashOuter: R(48, 48, 949, 2014), sashInner: R(133, 133, 779, 1844),
        glassRect: R(148, 148, 749, 1814), beadIntW: 749, beadIntH: 1814,
      },
      {
        pathId: "root.p2", outer: R(950, 48, 902, 2004), daylight: R(950, 48, 902, 2004),
        content: "sliding-fixed", beadKey: "bead-sl-24", glassKey: "g", sashKey: "sash-sliding",
        sashOuter: R(903, 48, 949, 2014), sashInner: R(988, 133, 779, 1844),
        glassRect: R(1003, 148, 749, 1814), beadIntW: 749, beadIntH: 1814,
      },
    ],
  } as unknown as SolvedGeometry;
}
