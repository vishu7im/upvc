// =====================================================================
// validation/jobs.ts — proves the engine reproduces Quotila's output
// for Jobs 85, 88, 90, to the millimetre.
//
// Run with:  npm run validate
// =====================================================================

import { solve } from "../engine/solve.ts";
import { loadCatalog } from "../catalog/index.ts";
import type { QuoteOutput } from "../types.ts";
import { validateExtractor } from "../tools/extract-topology.test.ts";
import { validatePricing } from "../engine/pricing.test.ts";

interface ExpectedBar {
  code: string;
  ext: number;
  int?: number;
  orientation?: "H" | "V";
}
interface ExpectedJob {
  name: string;
  designId: string;
  widthMm: number;
  heightMm: number;
  bars: ExpectedBar[];
  glass: { width: number; height: number }[];
  gaskets: { code: string; lengthMm: number }[];
  hardware: { code: string; qty: number }[];
}

// ---------- EXPECTED VALUES (from your actual Quotila docs) ----------

const JOB_85: ExpectedJob = {
  name: "Job 85: 1200×1200 top-hung over fixed (Z-transom)",
  designId: "win-th-over-fixed-z",
  widthMm: 1200,
  heightMm: 1200,
  bars: [
    // Frame
    { code: "SPQ-5-10252", ext: 1200, int: 1072, orientation: "H" },   // top
    { code: "SPQ-5-10252", ext: 1200, int: 1072, orientation: "H" },   // bottom
    { code: "SPQ-5-10252", ext: 400,  int: 336,  orientation: "V" },   // left top
    { code: "SPQ-5-10252", ext: 800,  int: 736,  orientation: "V" },   // left bottom
    { code: "SPQ-5-10252", ext: 400,  int: 336,  orientation: "V" },   // right top
    { code: "SPQ-5-10252", ext: 800,  int: 736,  orientation: "V" },   // right bottom
    // Z-transom
    { code: "SPQ-005-30252", ext: 1206, int: 1072, orientation: "H" },
    // Top sash (T Sash) — 1128 × 358.5 outer
    { code: "SPQ-T-SASH", ext: 1128,  int: 970,    orientation: "H" }, // head
    { code: "SPQ-T-SASH", ext: 1128,  int: 970,    orientation: "H" }, // sill
    { code: "SPQ-T-SASH", ext: 358.5, int: 200.5,  orientation: "V" }, // left
    { code: "SPQ-T-SASH", ext: 358.5, int: 200.5,  orientation: "V" }, // right
    // Beads — top sash (970 × 200.5 inner)
    { code: "BEAD-28", ext: 1010,  int: 970,   orientation: "H" }, // top×2 → recorded as Ext 1010
    { code: "BEAD-28", ext: 1010,  int: 970,   orientation: "H" },
    { code: "BEAD-28", ext: 240.5, int: 200.5, orientation: "V" },
    { code: "BEAD-28", ext: 240.5, int: 200.5, orientation: "V" },
    // Beads — bottom fixed (1072 × 702.5 cell daylight)
    { code: "BEAD-28", ext: 1112,  int: 1072,  orientation: "H" },
    { code: "BEAD-28", ext: 1112,  int: 1072,  orientation: "H" },
    { code: "BEAD-28", ext: 742.5, int: 702.5, orientation: "V" },
    { code: "BEAD-28", ext: 742.5, int: 702.5, orientation: "V" },
  ],
  glass: [
    // Top sash: bead Int 970×200.5 + 2×18.5 sash glass rebate = 1007 × 237.5 (Quotila rounds 237.5→238)
    { width: 1007, height: 237.5 },
    // Bottom fixed: bead Int 1072×702.5 + 2×15 frame glass rebate = 1102 × 732.5
    { width: 1102, height: 732.5 },
  ],
  gaskets: [
    { code: "GKT-01", lengthMm: 5946 },  // 2 × (1128+358.5+1128+358.5) = 5946
    { code: "GKT-02", lengthMm: 6158 },  // matches Quotila value
  ],
  hardware: [
    { code: "MUSH-STR",   qty: 4 },
    { code: "RUNUP-BLK",  qty: 2 },
    { code: "HDL-INLINE", qty: 1 },
    { code: "ESPAG-1000", qty: 1 },
    { code: "FH-8",       qty: 1 },
  ],
};

const JOB_88: ExpectedJob = {
  name: "Job 88: 800×1200 top-hung + side-hung (T-transom)",
  designId: "win-th-over-sh-t",
  widthMm: 800,
  heightMm: 1200,
  bars: [
    // Frame
    { code: "SPQ-5-10252", ext: 800,  int: 672,  orientation: "H" },
    { code: "SPQ-5-10252", ext: 800,  int: 672,  orientation: "H" },
    { code: "SPQ-5-10252", ext: 1200, int: 1072, orientation: "V" },
    { code: "SPQ-5-10252", ext: 1200, int: 1072, orientation: "V" },
    // T-transom
    { code: "SPQ-05-20252", ext: 806, int: 672, orientation: "H" },
    // Top sash (728 × 358.5 outer)
    { code: "SPQ-T-SASH", ext: 728,   int: 570,   orientation: "H" },
    { code: "SPQ-T-SASH", ext: 728,   int: 570,   orientation: "H" },
    { code: "SPQ-T-SASH", ext: 358.5, int: 200.5, orientation: "V" },
    { code: "SPQ-T-SASH", ext: 358.5, int: 200.5, orientation: "V" },
    // Bottom sash (728 × 758.5 outer)
    { code: "SPQ-T-SASH", ext: 728,   int: 570,   orientation: "H" },
    { code: "SPQ-T-SASH", ext: 728,   int: 570,   orientation: "H" },
    { code: "SPQ-T-SASH", ext: 758.5, int: 600.5, orientation: "V" },
    { code: "SPQ-T-SASH", ext: 758.5, int: 600.5, orientation: "V" },
    // Beads
    { code: "BEAD-28", ext: 610,   int: 570,   orientation: "H" },
    { code: "BEAD-28", ext: 610,   int: 570,   orientation: "H" },
    { code: "BEAD-28", ext: 610,   int: 570,   orientation: "H" },
    { code: "BEAD-28", ext: 610,   int: 570,   orientation: "H" },
    { code: "BEAD-28", ext: 240.5, int: 200.5, orientation: "V" },
    { code: "BEAD-28", ext: 240.5, int: 200.5, orientation: "V" },
    { code: "BEAD-28", ext: 640.5, int: 600.5, orientation: "V" },
    { code: "BEAD-28", ext: 640.5, int: 600.5, orientation: "V" },
  ],
  glass: [
    { width: 607, height: 237.5 },
    { width: 607, height: 637.5 },
  ],
  gaskets: [
    { code: "GKT-01", lengthMm: 10292 }, // 2 × (sash1_perim + sash2_perim)
    { code: "GKT-02", lengthMm: 4178 },  // matches Quotila value
  ],
  hardware: [
    { code: "MUSH-STR",   qty: 4 },   // 2 per 600mm espag × 2 espags
    { code: "HDL-INLINE", qty: 2 },
    { code: "ESPAG-600",  qty: 2 },
    { code: "FH-8",       qty: 1 },
    { code: "FH-16",      qty: 1 },
  ],
};

const JOB_90: ExpectedJob = {
  name: "Job 90: 1400×2000 single door with sidelight & toplights",
  designId: "door-sidelight-toplights",
  widthMm: 1400,
  heightMm: 2000,
  bars: [
    // Frame (68mm 6-Chamber)
    { code: "SPQ-6-11252", ext: 1400, int: 1264, orientation: "H" },
    { code: "SPQ-6-11252", ext: 1400, int: 1264, orientation: "H" },
    { code: "SPQ-6-11252", ext: 2000, int: 1864, orientation: "V" },
    { code: "SPQ-6-11252", ext: 2000, int: 1864, orientation: "V" },
    // Mullion (full-height) + 2 transom pieces
    { code: "SPQ-5-30252", ext: 2020, int: 1864, orientation: "V" },  // mullion
    { code: "SPQ-5-30252", ext: 749,  int: 593,  orientation: "H" },  // top-left transom
    { code: "SPQ-5-30252", ext: 749,  int: 593,  orientation: "H" },  // top-right transom
    // Door sash (649 × 1549)
    { code: "SPQ-DOOR-Z", ext: 649,  int: 439,  orientation: "H" },
    { code: "SPQ-DOOR-Z", ext: 649,  int: 439,  orientation: "H" },
    { code: "SPQ-DOOR-Z", ext: 1549, int: 1339, orientation: "V" },
    { code: "SPQ-DOOR-Z", ext: 1549, int: 1339, orientation: "V" },
  ],
  glass: [
    // Top-left fixed (cell 593 × 293): 593+30 × 293+30 = 623 × 323
    { width: 623, height: 323 },
    // Top-right fixed: same
    { width: 623, height: 323 },
    // Sidelight fixed (cell 593 × 1493): 623 × 1523
    { width: 623, height: 1523 },
    // Door (sash inner 439 × 1339 + 2×15 = 469 × 1369)
    { width: 469, height: 1369 },
  ],
  gaskets: [
    { code: "GKT-01", lengthMm: 8792 }, // 2 × door sash perim
    { code: "GKT-02", lengthMm: 11752 }, // sum of all 4 glass perims
  ],
  hardware: [
    { code: "DR-HDL-LL",   qty: 1 },
    { code: "DR-FLAG-W",   qty: 3 },
    { code: "DR-LOCK-STD", qty: 1 },
    { code: "DR-CYL-BR",   qty: 1 },
    { code: "DR-KEEP-RH",  qty: 1 },
    { code: "RUNUP-BLK",   qty: 1 },
  ],
};

// ---------- SLIDING PATIO jobs (Job 104 — yogi test 1, 2, 4) ---------
// Calibrated from the supplied patio-docs/ work orders + cutting lists (all
// height 1750). Frame face 48, sash face 85, bead face 20, glass rebate 15,
// reinforcement = bar Int − 10 (endClearance 5/end). Panel width:
//   bypass (W+3)/n − 6  [OX/OXO];  centre-meeting (W+79)/4 − 6  [OXXO].
// designIds are the collection design UUIDs (the seed attaches the topology by
// externalId == designId). Reinforcement int == ext (square-cut steel).

const JOB_104_OX: ExpectedJob = {
  name: "Job 104 OX: 1500×1750 sliding patio (2-panel: 1 fixed + 1 slide)",
  designId: "0057bd49-577c-4b61-bf5f-f8d69ca760b3",
  widthMm: 1500,
  heightMm: 1750,
  bars: [
    // Frame (face 48)
    { code: "SPQ-SL-FRAME", ext: 1500, int: 1404, orientation: "H" },
    { code: "SPQ-SL-FRAME", ext: 1750, int: 1654, orientation: "V" },
    // Sash (face 85) — both panels cut identically
    { code: "SPQ-SL-SASH", ext: 745.5, int: 575.5, orientation: "H" },
    { code: "SPQ-SL-SASH", ext: 1671,  int: 1501,  orientation: "V" },
    // Beads (face 20)
    { code: "BEAD-28", ext: 615.5, int: 575.5, orientation: "H" },
    { code: "BEAD-28", ext: 1541,  int: 1501,  orientation: "V" },
    // Frame reinforcement 44×12 (= frameInt − 10)
    { code: "REINF-44x12", ext: 1394, int: 1394, orientation: "H" },
    { code: "REINF-44x12", ext: 1644, int: 1644, orientation: "V" },
    // Sash reinforcement 25×27 U (= sashInt − 10)
    { code: "REINF-25x27-U", ext: 565.5, int: 565.5, orientation: "H" },
    { code: "REINF-25x27-U", ext: 1491,  int: 1491,  orientation: "V" },
  ],
  glass: [{ width: 606, height: 1531 }],
  gaskets: [{ code: "GKT-02", lengthMm: 8546 }], // Σ glass perimeter (exact)
  hardware: [
    { code: "SL-FIX-SUP",  qty: 7 },  // 1 fixed panel × 7
    { code: "SL-HDL-W",    qty: 1 },  // 1 slider
    { code: "DR-CYL-BR",   qty: 1 },
    { code: "SL-LOCK-KEEP", qty: 1 },
    { code: "SL-ROLLER",   qty: 2 },
  ],
};

const JOB_104_OXO: ExpectedJob = {
  name: "Job 104 OXO: 2000×1750 sliding patio (3-panel)",
  designId: "8a1b8a80-e31a-4f0b-aa62-2771e04ec985",
  widthMm: 2000,
  heightMm: 1750,
  bars: [
    { code: "SPQ-SL-FRAME", ext: 2000, int: 1904, orientation: "H" },
    { code: "SPQ-SL-FRAME", ext: 1750, int: 1654, orientation: "V" },
    { code: "SPQ-SL-SASH", ext: 661.7, int: 491.7, orientation: "H" },
    { code: "SPQ-SL-SASH", ext: 1671,  int: 1501,  orientation: "V" },
    { code: "BEAD-28", ext: 531.7, int: 491.7, orientation: "H" },
    { code: "BEAD-28", ext: 1541,  int: 1501,  orientation: "V" },
    { code: "REINF-44x12", ext: 1894, int: 1894, orientation: "H" },
    { code: "REINF-44x12", ext: 1644, int: 1644, orientation: "V" },
    { code: "REINF-25x27-U", ext: 481.7, int: 481.7, orientation: "H" },
    { code: "REINF-25x27-U", ext: 1491,  int: 1491,  orientation: "V" },
  ],
  glass: [{ width: 522, height: 1531 }],
  gaskets: [{ code: "GKT-02", lengthMm: 12316 }],
  hardware: [
    { code: "SL-FIX-SUP", qty: 14 }, // 2 fixed panels × 7
    { code: "SL-HDL-W",   qty: 1 },  // 1 slider
    { code: "SL-ROLLER",  qty: 2 },
  ],
};

const JOB_104_OXXO: ExpectedJob = {
  name: "Job 104 OXXO: 2600×1750 sliding patio (4-panel, centre-meeting)",
  designId: "bd0ad364-3313-442d-871f-db7fab0502c4",
  widthMm: 2600,
  heightMm: 1750,
  bars: [
    { code: "SPQ-SL-FRAME", ext: 2600, int: 2504, orientation: "H" },
    { code: "SPQ-SL-FRAME", ext: 1750, int: 1654, orientation: "V" },
    // OXXO panel width = (2600+79)/4 − 6 = 663.75 → 663.8 (matches PDF 663.7/663.8)
    { code: "SPQ-SL-SASH", ext: 663.8, int: 493.8, orientation: "H" },
    { code: "SPQ-SL-SASH", ext: 1671,  int: 1501,  orientation: "V" },
    { code: "BEAD-28", ext: 533.8, int: 493.8, orientation: "H" },
    { code: "BEAD-28", ext: 1541,  int: 1501,  orientation: "V" },
    { code: "REINF-44x12", ext: 2494, int: 2494, orientation: "H" },
    { code: "REINF-44x12", ext: 1644, int: 1644, orientation: "V" },
    { code: "REINF-25x27-U", ext: 483.8, int: 483.8, orientation: "H" },
    { code: "REINF-25x27-U", ext: 1491,  int: 1491,  orientation: "V" },
  ],
  glass: [{ width: 524, height: 1531 }],
  gaskets: [{ code: "GKT-02", lengthMm: 16438 }],
  hardware: [
    { code: "SL-FIX-SUP", qty: 14 }, // 2 fixed panels × 7
    { code: "SL-HDL-W",   qty: 2 },  // 2 sliders
    { code: "SL-ROLLER",  qty: 4 },  // 2 per slider
  ],
};

// ---------- runner ---------------------------------------------------

let passCount = 0, failCount = 0;

function approxEq(a: number, b: number, tol = 0.6): boolean {
  // 0.6mm tolerance for rounding (Quotila rounds to nearest 0.5mm sometimes).
  return Math.abs(a - b) <= tol;
}

function expect(label: string, actual: any, expected: any): void {
  const ok = typeof expected === "number" ? approxEq(actual, expected) : actual === expected;
  if (ok) {
    passCount++;
    // console.log(`  ✓ ${label}: ${actual}`);
  } else {
    failCount++;
    console.log(`  ✗ ${label}: expected ${expected}, got ${actual}`);
  }
}

function validate(job: ExpectedJob): void {
  console.log("\n==================================================");
  console.log(job.name);
  console.log("==================================================");
  const result: QuoteOutput = solve({
    orderNo: "TEST",
    customer: "Validation",
    designId: job.designId,
    widthMm: job.widthMm,
    heightMm: job.heightMm,
    systemId: "sunnyplast-70",
  });

  // --- Bars: each expected bar must exist (by code + Ext + orientation).
  // Search profiles AND reinforcement (reinforcement lives in a separate array
  // but is also a cut bar; sliding-patio jobs assert reinforcement lengths).
  console.log("\n[Bars]");
  const allBars = [...result.parts.bars, ...result.parts.reinforcement];
  for (const expected of job.bars) {
    const matches = allBars.filter(
      (b) => b.code === expected.code &&
             approxEq(b.extMm, expected.ext) &&
             (!expected.orientation || b.orientation === expected.orientation)
    );
    expect(
      `${expected.code} Ext=${expected.ext} ${expected.orientation ?? ""}`,
      matches.length > 0,
      true,
    );
    if (matches.length > 0 && expected.int !== undefined) {
      expect(`  → Int=${expected.int}`, matches[0].intMm, expected.int);
    }
  }

  // --- Glass: every expected dimension pair must exist somewhere
  console.log("\n[Glass]");
  for (const eg of job.glass) {
    const match = result.parts.glass.find(
      (g) =>
        (approxEq(g.widthMm, eg.width) && approxEq(g.heightMm, eg.height)) ||
        (approxEq(g.widthMm, eg.height) && approxEq(g.heightMm, eg.width)),
    );
    expect(`${eg.width} × ${eg.height}`, !!match, true);
  }

  // --- Gaskets
  console.log("\n[Gaskets]");
  for (const eg of job.gaskets) {
    const match = result.parts.gaskets.find((g) => g.code === eg.code);
    expect(eg.code, match?.lengthMm ?? -1, eg.lengthMm);
  }

  // --- Hardware
  console.log("\n[Hardware]");
  for (const eh of job.hardware) {
    const match = result.parts.hardware.find((h) => h.code === eh.code);
    expect(`${eh.code} qty=${eh.qty}`, match?.qty ?? 0, eh.qty);
  }
}

// ---------- Custom-mode check ---------------------------------------
// Proves per-quote allowance overrides flow through the engine.
// Job 85 frame-5ch faceWidth defaults to 64 → frame top Int = 1200 - 2*64 = 1072.
// Override faceWidth to 70 → Int must become 1200 - 2*70 = 1060.
function validateCustomMode(): void {
  console.log("\n==================================================");
  console.log("Custom mode: frame-5ch faceWidth override 64 → 70");
  console.log("==================================================");

  const def: QuoteOutput = solve({
    orderNo: "TEST", customer: "Validation",
    designId: "win-th-over-fixed-z", widthMm: 1200, heightMm: 1200,
    systemId: "sunnyplast-70",
  });
  const defTop = def.parts.bars.find(
    (b) => b.code === "SPQ-5-10252" && b.position === "Frame top",
  );
  expect("default frame top Int = 1072", defTop?.intMm ?? -1, 1072);

  const custom: QuoteOutput = solve({
    orderNo: "TEST", customer: "Validation",
    designId: "win-th-over-fixed-z", widthMm: 1200, heightMm: 1200,
    systemId: "sunnyplast-70",
    mode: "custom",
    overrides: { frames: { "frame-5ch": { faceWidth: 70 } } },
  });
  const cusTop = custom.parts.bars.find(
    (b) => b.code === "SPQ-5-10252" && b.position === "Frame top",
  );
  expect("custom frame top Int = 1060", cusTop?.intMm ?? -1, 1060);

  // Default mode must remain unchanged after a custom solve (no catalog mutation).
  const def2: QuoteOutput = solve({
    orderNo: "TEST", customer: "Validation",
    designId: "win-th-over-fixed-z", widthMm: 1200, heightMm: 1200,
    systemId: "sunnyplast-70",
  });
  const def2Top = def2.parts.bars.find(
    (b) => b.code === "SPQ-5-10252" && b.position === "Frame top",
  );
  expect("default unchanged after custom solve (Int = 1072)", def2Top?.intMm ?? -1, 1072);
}

// ---------- Welding-shrinkage check --------------------------------
// Proves weldedExtMm = extMm + weldAllowanceMm × weldedEndCount, that extMm is
// UNTOUCHED (so the geometry assertions above stay valid), and that the welded-end
// count is derived correctly per joint (frame corner=2, Z-jamb=1, transom=2,
// bead/steel=0). Per-profile allowance seeds to 0 (inherit) and the global
// Settings default seeds to 2.5, so the effective allowance is 2.5 mm/end.
function validateWeldMath(): void {
  console.log("\n==================================================");
  console.log("Welding shrinkage compensation");
  console.log("==================================================");

  const job85: QuoteOutput = solve({
    orderNo: "TEST", customer: "Validation",
    designId: "win-th-over-fixed-z", widthMm: 1200, heightMm: 1200,
    systemId: "sunnyplast-70",
  });

  // Frame top (continuous, "\ - /"): 2 welded ends; extMm untouched at 1200;
  // welded = 1200 + 2×2.5 = 1205.
  const frameTop = job85.parts.bars.find(
    (b) => b.code === "SPQ-5-10252" && b.position === "Frame top",
  );
  expect("frame top extMm unchanged = 1200", frameTop?.extMm ?? -1, 1200);
  expect("frame top weldedEndCount = 2", frameTop?.weldedEndCount ?? -1, 2);
  expect("frame top weldedExtMm = 1205", frameTop?.weldedExtMm ?? -1, 1205);

  // Z-broken jamb ("\ - Y]"): only the mitered end is welded → 1 end.
  // extMm 400 → welded = 400 + 1×2.5 = 402.5.
  const jambTop = job85.parts.bars.find(
    (b) => b.code === "SPQ-5-10252" && b.position === "Frame left top",
  );
  expect("Z-jamb weldedEndCount = 1", jambTop?.weldedEndCount ?? -1, 1);
  expect("Z-jamb weldedExtMm = 402.5", jambTop?.weldedExtMm ?? -1, 402.5);

  // Z-transom (horns "< - >"): 2 welded ends; extMm 1206 → welded = 1211.
  const transom = job85.parts.bars.find((b) => b.code === "SPQ-005-30252");
  expect("transom weldedEndCount = 2", transom?.weldedEndCount ?? -1, 2);
  expect("transom weldedExtMm = 1211", transom?.weldedExtMm ?? -1, 1211);

  // Bead (square "[ - ]", allowance 0): no welds, welded == finished.
  const bead = job85.parts.bars.find((b) => b.code === "BEAD-28");
  expect("bead weldedEndCount = 0", bead?.weldedEndCount ?? -1, 0);
  expect("bead weldedExtMm == extMm", bead?.weldedExtMm ?? -1, bead?.extMm ?? -2);

  // Reinforcement (steel insert): never welded.
  const steel = job85.parts.reinforcement[0];
  expect("reinforcement weldedEndCount = 0", steel?.weldedEndCount ?? -1, 0);

  // Override path: bump frame-5ch weld allowance to 5 mm/end → frame top welded
  // = extMm + 2×5 = +10. extMm still untouched.
  const custom: QuoteOutput = solve({
    orderNo: "TEST", customer: "Validation",
    designId: "win-th-over-fixed-z", widthMm: 1200, heightMm: 1200,
    systemId: "sunnyplast-70",
    mode: "custom",
    overrides: { frames: { "frame-5ch": { weldAllowanceMm: 5 } } },
  });
  const cusTop = custom.parts.bars.find(
    (b) => b.code === "SPQ-5-10252" && b.position === "Frame top",
  );
  expect("override frame top extMm still 1200", cusTop?.extMm ?? -1, 1200);
  expect("override frame top weldedExtMm = 1210", cusTop?.weldedExtMm ?? -1, 1210);

  // Default mode unchanged after a custom solve (no catalog mutation).
  const def2: QuoteOutput = solve({
    orderNo: "TEST", customer: "Validation",
    designId: "win-th-over-fixed-z", widthMm: 1200, heightMm: 1200,
    systemId: "sunnyplast-70",
  });
  const def2Top = def2.parts.bars.find(
    (b) => b.code === "SPQ-5-10252" && b.position === "Frame top",
  );
  expect("default weld unchanged after custom (welded = 1205)", def2Top?.weldedExtMm ?? -1, 1205);
}

// Load the catalog from PostgreSQL before solving, then run all jobs.
(async () => {
  await loadCatalog();

  [JOB_85, JOB_88, JOB_90, JOB_104_OX, JOB_104_OXO, JOB_104_OXXO].forEach(validate);
  validateCustomMode();
  validateWeldMath();
  validateExtractor(expect);
  validatePricing(expect);

  console.log("\n==================================================");
  console.log(`RESULTS:  ${passCount} passed,  ${failCount} failed`);
  console.log("==================================================");
  process.exit(failCount === 0 ? 0 : 1);
})();
