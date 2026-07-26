// =====================================================================
// engine/limits.test.ts — size/weight limit + sash-weight assertions.
//
// Pure unit test (no DB). Wired into `npm run validate` via
// validateLimits(expect), like the M5 pricing test and the U7 svg test.
//
// The centrepiece is the CROSS-CHECK in section 2: the manual prints both a
// sash-weight formula (p71) and a table of max sizes+weights (p70), and the
// two are independent. Reproducing every printed max weight from its printed
// max size via the formula proves BOTH the formula reading and the table
// transcription at once — the strongest verification available without a
// production job.
// =====================================================================

import {
  GLAZING_KG_PER_MM_PER_M2,
  MAX_TRANSOM_MULLION_LENGTH_MM,
  OVERSIZE_TOLERANCE,
  SIZE_LIMITS,
  STANDARD_UNIT_PANES_MM,
  TRICKLE_VENT,
  checkSizeLimits,
  findSizeLimit,
  glazingWeightPerM2,
  sashWeightKg,
  wedgeCount,
} from "./limits.ts";
import type { Rect, SashKind, SolvedGeometry } from "../types.ts";

type Expect = (label: string, actual: any, expected: any) => void;

const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** One-sash geometry sized to order, for the checker assertions. */
function oneSash(
  content: SashKind,
  sashW: number,
  sashH: number,
  outer: Rect = R(0, 0, 1200, 1500),
): SolvedGeometry {
  return {
    outer,
    rootDaylight: R(64, 64, outer.w - 128, outer.h - 128),
    transoms: [],
    mullions: [],
    cells: [
      {
        pathId: "root",
        outer: R(64, 64, sashW + 20, sashH + 20),
        daylight: R(94, 94, sashW - 40, sashH - 40),
        content,
        beadKey: "bead",
        glassKey: "g",
        sashKey: "sash",
        sashOuter: R(64, 64, sashW, sashH),
        sashInner: R(100, 100, sashW - 72, sashH - 72),
        glassRect: R(115, 115, sashW - 102, sashH - 102),
        beadIntW: sashW - 102,
        beadIntH: sashH - 102,
      },
    ],
  } as unknown as SolvedGeometry;
}

export function validateLimits(expect: Expect): void {
  console.log("\n==================================================");
  console.log("HAWDIO size limits & sash-weight formula");
  console.log("==================================================");

  // ------------------------------------------------------------------
  // 1. The manual's own worked example, verbatim — HAWDIO p71 (PDF 73).
  //    "eg. 8.4/14/6 = ... of glass (14.4mm)"  → the 14mm SPACER is excluded
  //    "eg. 14.4 x 2.5 = 36kg/m²"
  // ------------------------------------------------------------------
  console.log("\n[p71 worked example]");
  expect("1mm of glass weighs 2.5 kg/m²", GLAZING_KG_PER_MM_PER_M2, 2.5);
  expect("8.4/14/6 unit → 14.4mm of glass (spacer excluded)", 8.4 + 6, 14.4);
  expect("14.4mm × 2.5 = 36 kg/m²", round2(glazingWeightPerM2([8.4, 6])), 36);
  // The formula line: sash kg = kg/m² × w(m) × h(m). A 1m × 1m sash of that
  // unit therefore weighs exactly its kg/m² figure.
  expect("1000×1000 sash of that unit = 36 kg", round2(sashWeightKg([8.4, 6], 1000, 1000)), 36);
  expect("half-area sash halves the weight", round2(sashWeightKg([8.4, 6], 500, 1000)), 18);

  // ------------------------------------------------------------------
  // 2. CROSS-CHECK — every printed max weight (p70) must be reproducible
  //    from its printed max size via the p71 formula on the printed
  //    4-20-4 basis (8mm glass ⇒ 20 kg/m²). Independent pages agreeing to
  //    1 d.p. on all 10 rows validates the whole transcription.
  // ------------------------------------------------------------------
  console.log("\n[p70 × p71 cross-check: every row]");
  expect("4-20-4 basis = 8mm glass", STANDARD_UNIT_PANES_MM.reduce((a, b) => a + b, 0), 8);
  expect("4-20-4 basis = 20 kg/m²", glazingWeightPerM2(STANDARD_UNIT_PANES_MM), 20);
  expect("p70 rows transcribed", SIZE_LIMITS.length, 10);

  for (const l of SIZE_LIMITS) {
    const derived = sashWeightKg(STANDARD_UNIT_PANES_MM, l.maxWidthMm, l.maxHeightMm);
    expect(
      `${l.key}: ${l.maxWidthMm}×${l.maxHeightMm} × 20kg/m² = ${l.maxWeightKg} kg`,
      round1(derived),
      round1(l.maxWeightKg),
    );
  }

  // Spot-assert a few printed values literally, so a bad edit to the table is
  // caught even if someone "fixes" the weights to match.
  const byKey = (k: string) => SIZE_LIMITS.find((l) => l.key === k)!;
  expect("casement top hung max w", byKey("casement-top-hung").maxWidthMm, 1265);
  expect("casement top hung max h", byKey("casement-top-hung").maxHeightMm, 1342);
  expect("casement side hung max w", byKey("casement-side-hung").maxWidthMm, 715);
  expect("tilt&turn vent max", byKey("tilt-turn-vent").maxWidthMm, 1402);
  expect("residential door max h", byKey("residential-door").maxHeightMm, 2156);
  expect("french door max w", byKey("french-door").maxWidthMm, 998);
  expect("fixed is an OUTER FRAME limit", byKey("fixed").measuredOn, "outerFrame");
  expect("fixed max 3000w × 2000h", `${byKey("fixed").maxWidthMm}×${byKey("fixed").maxHeightMm}`, "3000×2000");
  expect("longest transom/mullion = 1.8m", MAX_TRANSOM_MULLION_LENGTH_MM, 1800);
  expect("10% rule tolerance", OVERSIZE_TOLERANCE, 1.1);
  expect("every row carries a HAWDIO cite", SIZE_LIMITS.every((l) => l.source.includes("HAWDIO p70")), true);

  // ------------------------------------------------------------------
  // 3. Family mapping — rows only govern the SashKinds they really cover.
  // ------------------------------------------------------------------
  console.log("\n[family mapping]");
  expect("casement-top → top-hung row", findSizeLimit("casement-top")?.key, "casement-top-hung");
  expect("casement-side-left → side-hung row", findSizeLimit("casement-side-left")?.key, "casement-side-hung");
  expect("tilt-turn → T&T row", findSizeLimit("tilt-turn")?.key, "tilt-turn-vent");
  expect("door-left → residential door row", findSizeLimit("door-left")?.key, "residential-door");
  expect("french-door-master → french row", findSizeLimit("french-door-master")?.key, "french-door");
  // Sliding has NO row on p70 — must stay unmapped rather than borrow one.
  expect("sliding-fixed has no p70 limit", findSizeLimit("sliding-fixed"), undefined);
  expect("sliding-slide-left has no p70 limit", findSizeLimit("sliding-slide-left"), undefined);
  expect("fixed lights have no sash limit", findSizeLimit("fixed"), undefined);

  // ------------------------------------------------------------------
  // 4. checkSizeLimits behaviour.
  // ------------------------------------------------------------------
  console.log("\n[checkSizeLimits]");

  // Comfortably inside every limit ⇒ silent.
  expect("in-limit side-hung sash ⇒ no issues", checkSizeLimits(oneSash("casement-side-left", 700, 1300)).length, 0);

  // Exactly ON the printed max is allowed (the rule is "may not exceed").
  expect(
    "sash exactly at the printed max ⇒ no issues",
    checkSizeLimits(oneSash("casement-side-left", 715, 1342)).length,
    0,
  );

  // Over max but inside +10%, and light enough ⇒ WARNING (the 10% rule).
  // 750×1200: 0.75×1.2×20 = 18 kg ≤ 19.2, width 750 ≤ 715×1.1 = 786.5.
  const tenPct = checkSizeLimits(oneSash("casement-side-left", 750, 1200));
  expect("within-10% oversize ⇒ 1 issue", tenPct.length, 1);
  expect("within-10% oversize ⇒ warning", tenPct[0].severity, "warning");
  expect("within-10% oversize ⇒ code", tenPct[0].code, "sash-oversize");
  expect("issue carries its page cite", tenPct[0].source.includes("HAWDIO p70"), true);

  // Beyond +10% ⇒ ERROR. 900 > 715×1.1 = 786.5.
  const beyond = checkSizeLimits(oneSash("casement-side-left", 900, 1200));
  expect("beyond-10% ⇒ has an error", beyond.some((i) => i.code === "sash-oversize-beyond-10pct"), true);
  expect(
    "beyond-10% error severity",
    beyond.find((i) => i.code === "sash-oversize-beyond-10pct")?.severity,
    "error",
  );

  // Overweight while inside the dimensional maxima ⇒ error via the formula.
  // A top-hung 1265×1342 on 4-20-4 is 33.95 kg (OK); with a 8.4/14/6 unit
  // (36 kg/m²) it becomes 61.1 kg — well over the printed 34 kg.
  const heavy = checkSizeLimits(oneSash("casement-top", 1265, 1342), { paneThicknessesMm: [8.4, 6] });
  expect("heavy glazing ⇒ overweight error", heavy.some((i) => i.code === "sash-overweight"), true);
  expect(
    "same sash on the 4-20-4 basis is fine",
    checkSizeLimits(oneSash("casement-top", 1265, 1342)).length,
    0,
  );
  // Unknown make-up ⇒ skip the weight check rather than guess.
  expect(
    "empty pane list ⇒ weight check skipped",
    checkSizeLimits(oneSash("casement-top", 1265, 1342), { paneThicknessesMm: [] })
      .some((i) => i.code === "sash-overweight"),
    false,
  );

  // Families the manual doesn't cover are never judged.
  expect(
    "oversize sliding panel ⇒ no sash issues (no p70 row)",
    checkSizeLimits(oneSash("sliding-slide-left", 2000, 2400, R(0, 0, 2200, 2500)))
      .filter((i) => i.code.startsWith("sash-")).length,
    0,
  );

  // Whole-unit limit is measured on the outer frame.
  const bigUnit = checkSizeLimits(oneSash("fixed", 900, 900, R(0, 0, 3200, 1800)));
  expect("outer frame over 3000 wide ⇒ unit-oversize", bigUnit.some((i) => i.code === "unit-oversize"), true);
  expect(
    "3000×2000 outer frame exactly ⇒ no unit issue",
    checkSizeLimits(oneSash("fixed", 900, 900, R(0, 0, 3000, 2000))).some((i) => i.code === "unit-oversize"),
    false,
  );

  // Transom/mullion length rule.
  const longBar = {
    ...oneSash("fixed", 900, 900, R(0, 0, 2000, 1500)),
    transoms: [{ rect: R(0, 0, 1900, 20), parentPathId: "root", transomKey: "t", extLengthMm: 1900, intLengthMm: 1900, jointType: "T" }],
  } as unknown as SolvedGeometry;
  expect("1900mm transom ⇒ divider-too-long", checkSizeLimits(longBar).some((i) => i.code === "divider-too-long"), true);

  // ------------------------------------------------------------------
  // 5. Wedge counts (p66) + trickle vents (p68) — recorded reference data.
  // ------------------------------------------------------------------
  console.log("\n[p66 wedges / p68 trickle vents]");
  expect("<800 ⇒ 0 wedges", wedgeCount(799), 0);
  expect("800 is not '>800' ⇒ 0 wedges", wedgeCount(800), 0);
  expect(">800 ⇒ 1 wedge", wedgeCount(801), 1);
  expect("1200 is not '>1200' ⇒ 1 wedge", wedgeCount(1200), 1);
  expect(">1200 ⇒ 2 wedges", wedgeCount(1201), 2);
  expect("vent slot width 13mm", TRICKLE_VENT.slotWidthMm, 13);
  expect("casement vent offset 8", TRICKLE_VENT.offsetMm.casement70, 8);
  expect("T&T vent offset 10", TRICKLE_VENT.offsetMm.tiltTurn, 10);
  expect("French door vent offset 25", TRICKLE_VENT.offsetMm.frenchDoor, 25);

  // ------------------------------------------------------------------
  // 6. Purity — the checker must not mutate the geometry it inspects.
  // ------------------------------------------------------------------
  console.log("\n[purity]");
  const g = oneSash("casement-side-left", 900, 1400);
  const before = JSON.stringify(g);
  checkSizeLimits(g);
  expect("checkSizeLimits does not mutate geometry", JSON.stringify(g), before);
}
