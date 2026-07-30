// =====================================================================
// catalog/glyphs.test.ts — the hardware glyph contract.
//
// DB-free and pure, like pricing.test.ts / basket.test.ts: it reads the
// hand-written catalog + the generated stock list and asserts the drawing is
// deterministic, covers every substitutable category, and never throws on an
// unfamiliar part.
//
// What it deliberately does NOT assert: what the picture looks like. That is a
// drawing, and a drawing is allowed to be redrawn — nothing downstream depends
// on the path data.
// =====================================================================

import type { HardwareItem } from "../types.ts";
import { SUNNYPLAST_70 } from "./system-sunnyplast.ts";
import { glyphFinishFor, glyphShapeFor, hardwareGlyph } from "./glyphs.ts";

type Expect = (label: string, actual: unknown, expected: unknown) => void;

const item = (name: string, financialCategory: string): HardwareItem => ({
  code: "X",
  name,
  financialCategory,
  cost: 0,
  price: 0,
  per: "pc",
  weight: 0,
});

export function validateGlyphs(expect: Expect): void {
  console.log("\n==================================================");
  console.log("Hardware glyphs (doors phase 3)");
  console.log("==================================================");

  const hw = SUNNYPLAST_70.hardware;

  // ---- 1. Every hardware row draws, and draws the same way twice ------
  let threw = 0;
  let empty = 0;
  for (const part of Object.values(hw)) {
    let svg = "";
    try {
      svg = hardwareGlyph(part);
    } catch {
      threw += 1;
      continue;
    }
    if (!svg.startsWith("<svg") || !svg.endsWith("</svg>")) empty += 1;
    if (svg !== hardwareGlyph(part)) empty += 1; // determinism, per part
  }
  expect("no catalog hardware part throws", threw, 0);
  expect("every part yields a well-formed, deterministic SVG", empty, 0);
  expect("the catalog really is large enough to matter", Object.keys(hw).length > 100, true);

  // ---- 2. The five substitutable categories each get their own shape --
  const shapes = new Set(
    Object.values(hw)
      .filter((h) =>
        ["Door Handle", "Casement Handles", "Cylinders", "Door Hinge", "Door Lock"].includes(
          h.financialCategory,
        ),
      )
      .map((h) => glyphShapeFor(h)),
  );
  expect("no substitutable part falls back to the generic fitting", shapes.has("generic"), false);
  expect("at least eight distinct shapes are drawn", shapes.size >= 8, true);

  // ---- 3. Shape is chosen from the supplier's own wording ------------
  const cases: [string, string, string][] = [
    ["White Handle Lever/Lever (Short Backplate)", "Door Handle", "door-handle-lever-lever"],
    ["White Handle Lever/Lever (Long Backplate)", "Door Handle", "door-handle-lever-lever-long"],
    ["Gold Handle Lever/Pad (Short Backplate)", "Door Handle", "door-handle-lever-pad"],
    ["Bar Handle 1200 Inline", "Door Handle", "door-handle-bar"],
    ["White Cranked Handle", "Casement Handles", "casement-handle-cranked"],
    ["Black Monkeytail Handle", "Casement Handles", "casement-handle-monkeytail"],
    ["White Inline Handle", "Casement Handles", "casement-handle-inline"],
    ["Brass Cylinder Thumbturn", "Cylinders", "cylinder-thumbturn"],
    ["Brass Cylinder", "Cylinders", "cylinder"],
    ["Flag Hinge White", "Door Hinge", "hinge-flag"],
    ["High Security Hinge", "Door Hinge", "hinge-butt"],
    ["Standard Door Lock", "Door Lock", "lock"],
    ["L/H Keep Set", "Door Lock", "keep"],
  ];
  for (const [name, cat, shape] of cases) {
    expect(`"${name}" draws as ${shape}`, glyphShapeFor(item(name, cat)), shape);
  }

  // ---- 4. Finish comes from the SAME chips the pickers filter by -----
  expect("a white part is tinted white", glyphFinishFor(item("White Handle", "Door Handle")), "fin-white");
  expect("longest-first: antique bronze is not swallowed by bronze",
    glyphFinishFor(item("Antique Bronze Monkeytail Handle", "Casement Handles")), "fin-antique-bronze");
  expect("an unnamed finish earns none", glyphFinishFor(item("Door Restrictor", "Door Lock")), "");
  // Two finishes of the same shape must actually differ, or the picker is a
  // wall of identical tiles.
  const white = hardwareGlyph(item("White Handle Lever/Lever (Short Backplate)", "Door Handle"));
  const gold = hardwareGlyph(item("Gold Handle Lever/Lever (Short Backplate)", "Door Handle"));
  expect("two finishes of one shape render differently", white === gold, false);
  expect("the finish rides in the gradient id", gold.includes("fin-gold"), true);

  // ---- 5. An unknown part degrades, it does not fail ------------------
  const odd = item("Something Nobody Modelled", "Sundries");
  expect("an unknown category falls back to the generic fitting", glyphShapeFor(odd), "generic");
  expect("and still renders", hardwareGlyph(odd).startsWith("<svg"), true);

  // ---- 6. The SVG is self-contained and safe to inline ---------------
  const svg = hardwareGlyph(item('Brass "Euro" Cylinder & Key <set>', "Cylinders"));
  // (The xmlns declaration is a namespace, not a fetch — a REFERENCE would be
  // an href/src, an <image>, or a <use>.)
  expect("no external reference", /\b(?:xlink:href|href|src)=|<image|<use\s/.test(svg), false);
  expect("no script", svg.includes("<script"), false);
  expect("the label is XML-escaped", svg.includes("&quot;") && svg.includes("&lt;set&gt;"), true);
  expect("it declares a viewBox and no fixed size",
    svg.includes('viewBox="0 0 96 96"') && !/\swidth="/.test(svg), true);
}
