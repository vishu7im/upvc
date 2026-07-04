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
import { validateSvg } from "../engine/svg.test.ts";

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
  /** Optional per-quote split overrides (French unequal-leaf job). */
  splitRatios?: Record<string, number>;
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

// ---------- SLIDING PATIO jobs -----------------------------------------
// Calibrated from patio-docs/ Jobs 44 ("test uk Andrei londra", 1900×2100)
// and 48 ("Andrei Uk nr 2", 2210×2310) — Windowmaker saw-cut docs, both
// 2-panel (Culisant 1C + Ccv fixa). These SUPERSEDE the earlier Job 104
// (yogi test) docs. Constants (finished sizes; printed = finished + 3mm/end
// weld on frame & sash only):
//   frame face 48 (Ext = W/H, Int = Ext − 96); sash face 85 (Int = Ext − 170);
//   bead SPQ-1-51252 = sashInt + 40; glass = beadInt + 30;
//   panel Ext: bypass (W+10)/n − 6, height H − 86;
//   steel = barInt + 30 (endClearance −15/end) — AO44X12 frame, AU26X26 sash;
//   aux profiles: track W−95, channel cap H−95, slide cap H−96 + (W−45)×2,
//   sash cap panelExtH−2 per panel, AD55142/GLIS16 panelExtW−99 per FIXED panel.
// designIds are the collection design UUIDs (the seed attaches the topology by
// externalId == designId). Reinforcement int == ext (square-cut steel).

const JOB_44_ANDREI: ExpectedJob = {
  // Every row below is a printed doc line converted to finished size (−3mm/end
  // on welded frame/sash cuts; steel/bead/aux print unwelded). XO design: the
  // doc's panel 1 is the slider (left), panel 2 fixed.
  name: "Job 44 Andrei: 1900×2100 sliding patio (2-panel: slide left + fixed)",
  designId: "fbf4592c-ee97-4ac9-ba96-862370213bff",
  widthMm: 1900,
  heightMm: 2100,
  bars: [
    // Frame (face 48) — printed 1906/2106
    { code: "SPQ-GL-10252", ext: 1900, int: 1804, orientation: "H" },
    { code: "SPQ-GL-10252", ext: 2100, int: 2004, orientation: "V" },
    // Sash (face 85), both panels identical — printed 955/2020
    { code: "SPQ-GL-20252", ext: 949,  int: 779,  orientation: "H" },
    { code: "SPQ-GL-20252", ext: 2014, int: 1844, orientation: "V" },
    // Beads ("Bagheta ptr.24mm") — printed 819/1884 (no weld add)
    { code: "SPQ-1-51252", ext: 819,  int: 779,  orientation: "H" },
    { code: "SPQ-1-51252", ext: 1884, int: 1844, orientation: "V" },
    // Frame steel (= frameInt + 30) — printed 1834/2034
    { code: "AO44X12", ext: 1834, int: 1834, orientation: "H" },
    { code: "AO44X12", ext: 2034, int: 2034, orientation: "V" },
    // Sash steel (= sashInt + 30) — printed 809/1874
    { code: "AU26X26", ext: 809,  int: 809,  orientation: "H" },
    { code: "AU26X26", ext: 1874, int: 1874, orientation: "V" },
    // Auxiliary profiles — every ProfilAuxiliar doc row
    { code: "AD16014",      ext: 1805, orientation: "H" }, // slide track = W − 95
    { code: "GLIS17",       ext: 2005, orientation: "V" }, // channel cap = H − 95
    { code: "SPQ-GL-10253", ext: 2004, orientation: "V" }, // slide cap = H − 96
    { code: "SPQ-GL-10253", ext: 1855, orientation: "H" }, // slide cap = W − 45 (×2)
    { code: "SPQ-GL-20253", ext: 2012, orientation: "V" }, // sash cap = panelExtH − 2
    { code: "AD55142",      ext: 850,  orientation: "H" }, // big frame cap = panelExtW − 99
    { code: "GLIS16",       ext: 850,  orientation: "H" }, // fixed-panel cap = panelExtW − 99
  ],
  glass: [{ width: 809, height: 1874 }], // doc "Gol 24mm 809 × 1874" ×2
  gaskets: [{ code: "GKT-02", lengthMm: 10732 }], // Σ glass perimeter (formula; not on the doc)
  hardware: [
    { code: "SL-FIX-SUP",   qty: 7 },  // 1 fixed panel × 7
    { code: "SL-HDL-W",     qty: 1 },  // 1 slider
    { code: "DR-CYL-BR",    qty: 1 },
    { code: "SL-LOCK-KEEP", qty: 1 },
    { code: "SL-ROLLER",    qty: 2 },
  ],
};

const JOB_48_ANDREI: ExpectedJob = {
  name: "Job 48 Andrei: 2210×2310 sliding patio (2-panel: slide left + fixed)",
  designId: "fbf4592c-ee97-4ac9-ba96-862370213bff",
  widthMm: 2210,
  heightMm: 2310,
  bars: [
    // Frame — printed 2216/2316
    { code: "SPQ-GL-10252", ext: 2210, int: 2114, orientation: "H" },
    { code: "SPQ-GL-10252", ext: 2310, int: 2214, orientation: "V" },
    // Sash — printed 1110/2230
    { code: "SPQ-GL-20252", ext: 1104, int: 934,  orientation: "H" },
    { code: "SPQ-GL-20252", ext: 2224, int: 2054, orientation: "V" },
    // Beads — printed 974/2094
    { code: "SPQ-1-51252", ext: 974,  int: 934,  orientation: "H" },
    { code: "SPQ-1-51252", ext: 2094, int: 2054, orientation: "V" },
    // Steel — printed 2144/2244 (frame), 964/2084 (sash)
    { code: "AO44X12", ext: 2144, int: 2144, orientation: "H" },
    { code: "AO44X12", ext: 2244, int: 2244, orientation: "V" },
    { code: "AU26X26", ext: 964,  int: 964,  orientation: "H" },
    { code: "AU26X26", ext: 2084, int: 2084, orientation: "V" },
    // Auxiliary profiles
    { code: "AD16014",      ext: 2115, orientation: "H" },
    { code: "GLIS17",       ext: 2215, orientation: "V" },
    { code: "SPQ-GL-10253", ext: 2214, orientation: "V" },
    { code: "SPQ-GL-10253", ext: 2165, orientation: "H" },
    { code: "SPQ-GL-20253", ext: 2222, orientation: "V" },
    { code: "AD55142",      ext: 1005, orientation: "H" },
    { code: "GLIS16",       ext: 1005, orientation: "H" },
  ],
  glass: [{ width: 964, height: 2084 }], // doc "Gol 24mm 964 × 2084" ×2
  gaskets: [{ code: "GKT-02", lengthMm: 12192 }],
  hardware: [
    { code: "SL-FIX-SUP",   qty: 7 },
    { code: "SL-HDL-W",     qty: 1 },
    { code: "DR-CYL-BR",    qty: 1 },
    { code: "SL-LOCK-KEEP", qty: 1 },
    { code: "SL-ROLLER",    qty: 2 },
  ],
};

// The three old Job 104 (yogi) sizes stay as FORMULA-CONSISTENCY jobs: their
// expected values are recomputed under the Jobs 44/48 constants (they no
// longer match the superseded yogi docs). OXO also exercises the multi-panel
// aux rules; OXXO keeps its centre-meeting K=79 (uncalibrated against the new
// settings — needs an Andrei-era OXXO doc).

const JOB_SL_OX: ExpectedJob = {
  name: "Sliding OX 1500×1750 (formula-consistency, Jobs 44/48 constants)",
  designId: "0057bd49-577c-4b61-bf5f-f8d69ca760b3",
  widthMm: 1500,
  heightMm: 1750,
  bars: [
    { code: "SPQ-GL-10252", ext: 1500, int: 1404, orientation: "H" },
    { code: "SPQ-GL-10252", ext: 1750, int: 1654, orientation: "V" },
    // Panel: (1500+10)/2 − 6 = 749; height 1750 − 86 = 1664
    { code: "SPQ-GL-20252", ext: 749,  int: 579,  orientation: "H" },
    { code: "SPQ-GL-20252", ext: 1664, int: 1494, orientation: "V" },
    { code: "SPQ-1-51252", ext: 619,  int: 579,  orientation: "H" },
    { code: "SPQ-1-51252", ext: 1534, int: 1494, orientation: "V" },
    { code: "AO44X12", ext: 1434, int: 1434, orientation: "H" },
    { code: "AO44X12", ext: 1684, int: 1684, orientation: "V" },
    { code: "AU26X26", ext: 609,  int: 609,  orientation: "H" },
    { code: "AU26X26", ext: 1524, int: 1524, orientation: "V" },
  ],
  glass: [{ width: 609, height: 1524 }],
  gaskets: [{ code: "GKT-02", lengthMm: 8532 }],
  hardware: [
    { code: "SL-FIX-SUP",   qty: 7 },
    { code: "SL-HDL-W",     qty: 1 },
    { code: "DR-CYL-BR",    qty: 1 },
    { code: "SL-LOCK-KEEP", qty: 1 },
    { code: "SL-ROLLER",    qty: 2 },
  ],
};

const JOB_SL_OXO: ExpectedJob = {
  name: "Sliding OXO 2000×1750 (formula-consistency, Jobs 44/48 constants)",
  designId: "8a1b8a80-e31a-4f0b-aa62-2771e04ec985",
  widthMm: 2000,
  heightMm: 1750,
  bars: [
    { code: "SPQ-GL-10252", ext: 2000, int: 1904, orientation: "H" },
    { code: "SPQ-GL-10252", ext: 1750, int: 1654, orientation: "V" },
    // Panel: (2000+10)/3 − 6 = 664; height 1664
    { code: "SPQ-GL-20252", ext: 664,  int: 494,  orientation: "H" },
    { code: "SPQ-GL-20252", ext: 1664, int: 1494, orientation: "V" },
    { code: "SPQ-1-51252", ext: 534,  int: 494,  orientation: "H" },
    { code: "SPQ-1-51252", ext: 1534, int: 1494, orientation: "V" },
    { code: "AO44X12", ext: 1934, int: 1934, orientation: "H" },
    { code: "AO44X12", ext: 1684, int: 1684, orientation: "V" },
    { code: "AU26X26", ext: 524,  int: 524,  orientation: "H" },
    { code: "AU26X26", ext: 1524, int: 1524, orientation: "V" },
    // Multi-panel aux coverage (per-FIXED-panel caps, 2 fixed panels here)
    { code: "AD16014",      ext: 1905, orientation: "H" },
    { code: "GLIS17",       ext: 1655, orientation: "V" },
    { code: "SPQ-GL-10253", ext: 1654, orientation: "V" },
    { code: "SPQ-GL-10253", ext: 1955, orientation: "H" },
    { code: "SPQ-GL-20253", ext: 1662, orientation: "V" },
    { code: "AD55142",      ext: 565,  orientation: "H" },
    { code: "GLIS16",       ext: 565,  orientation: "H" },
  ],
  glass: [{ width: 524, height: 1524 }],
  gaskets: [{ code: "GKT-02", lengthMm: 12288 }],
  hardware: [
    { code: "SL-FIX-SUP", qty: 14 }, // 2 fixed panels × 7
    { code: "SL-HDL-W",   qty: 1 },  // 1 slider
    { code: "SL-ROLLER",  qty: 2 },
  ],
};

const JOB_SL_OXXO: ExpectedJob = {
  name: "Sliding OXXO 2600×1750 (formula-consistency; centre-meeting K=79 uncalibrated)",
  designId: "bd0ad364-3313-442d-871f-db7fab0502c4",
  widthMm: 2600,
  heightMm: 1750,
  bars: [
    { code: "SPQ-GL-10252", ext: 2600, int: 2504, orientation: "H" },
    { code: "SPQ-GL-10252", ext: 1750, int: 1654, orientation: "V" },
    // OXXO panel width = (2600+79)/4 − 6 = 663.75 → 663.8; height 1664
    { code: "SPQ-GL-20252", ext: 663.8, int: 493.8, orientation: "H" },
    { code: "SPQ-GL-20252", ext: 1664,  int: 1494,  orientation: "V" },
    { code: "SPQ-1-51252", ext: 533.8, int: 493.8, orientation: "H" },
    { code: "SPQ-1-51252", ext: 1534,  int: 1494,  orientation: "V" },
    { code: "AO44X12", ext: 2534, int: 2534, orientation: "H" },
    { code: "AO44X12", ext: 1684, int: 1684, orientation: "V" },
    { code: "AU26X26", ext: 523.8, int: 523.8, orientation: "H" },
    { code: "AU26X26", ext: 1524,  int: 1524,  orientation: "V" },
  ],
  glass: [{ width: 523.8, height: 1524 }],
  gaskets: [{ code: "GKT-02", lengthMm: 16382 }],
  hardware: [
    { code: "SL-FIX-SUP", qty: 14 }, // 2 fixed panels × 7
    { code: "SL-HDL-W",   qty: 2 },  // 2 sliders
    { code: "SL-ROLLER",  qty: 4 },  // 2 per slider
  ],
};

// ---------- FRENCH DOOR jobs (Job 00000264 — docs/french-door/) ------
// Calibrated from 5 Windowmaker production docs (Design 408, all 1700×2100,
// "PR01 70mm Casement Series"). Printed saw sizes carry a 3 mm/end weld
// allowance on mitred/horned cuts; the assertions below use FINISHED (ext)
// sizes — the welded (printed) sizes are asserted in validateFrenchWeld().
// Constants: frame-french face 48 (KASA 70-48), door sash face 105 / overlap 20
// (both the 105mm T sash SPQ-5-47252 and the 85mm Z sash SPQ-5-45252 cut
// identically), STULP french-mullion face 48 square-cut, bead face 20, glass
// rebate 15, midrail T/M SM 67.

const JOB_264_T: ExpectedJob = {
  name: "Job 00000264 (doc 0): 1700×2100 French door, T sash, full-height glass",
  designId: "door-french-t",
  widthMm: 1700,
  heightMm: 2100,
  bars: [
    // Frame (printed 1706/2106 = +2×3 weld)
    { code: "SPQ-6-11252", ext: 1700, int: 1604, orientation: "H" },
    { code: "SPQ-6-11252", ext: 2100, int: 2004, orientation: "V" },
    // French mullion — square cut, Ext == Int == daylight H (printed 2004 [ ])
    { code: "SPQ-1-46252", ext: 2004, int: 2004, orientation: "V" },
    // T door sash (printed 824/2050 = +2×3 weld)
    { code: "SPQ-5-47252", ext: 818,  int: 608,  orientation: "H" },
    { code: "SPQ-5-47252", ext: 2044, int: 1834, orientation: "V" },
    // Beads (printed exactly — square cut, no weld)
    { code: "SPQ-1-52253", ext: 648,  int: 608,  orientation: "H" },
    { code: "SPQ-1-52253", ext: 1874, int: 1834, orientation: "V" },
  ],
  glass: [
    { width: 638, height: 1864 },
    { width: 638, height: 1864 },
  ],
  gaskets: [
    { code: "SP_GSKFM", lengthMm: 2004 },  // French mullion gasket = mullion length
    { code: "SP_S001",  lengthMm: 22576 }, // Σ per leaf: sash perim + daylight perim
  ],
  hardware: [
    { code: "SPQ-2-91252", qty: 2 },  // inverter caps (2 per French mullion)
    { code: "SP_CBLOCK01", qty: 8 },  // cavity locking blocks (4 per leaf)
    { code: "SP_GBRIDGE",  qty: 16 }, // glazing bridges (8 per glass pane × 2)
  ],
};

const JOB_264_MIDRAIL: ExpectedJob = {
  name: "Job 00000264 (docs 1/4): 1700×2100 French door, Z sash, midrail per leaf",
  designId: "door-french-midrail",
  widthMm: 1700,
  heightMm: 2100,
  bars: [
    { code: "SPQ-6-11252", ext: 1700, int: 1604, orientation: "H" },
    { code: "SPQ-6-11252", ext: 2100, int: 2004, orientation: "V" },
    { code: "SPQ-1-46252", ext: 2004, int: 2004, orientation: "V" },
    // Z door sash — SAME cut sizes as the T sash (both face 105)
    { code: "SPQ-5-45252", ext: 818,  int: 608,  orientation: "H" },
    { code: "SPQ-5-45252", ext: 2044, int: 1834, orientation: "V" },
    // Midrail T/M SM inside each sash ring (printed 748 <> = +2×3 weld)
    { code: "SPQ-005-30252", ext: 742, int: 608, orientation: "H" },
    // Beads: 2 panes per leaf (printed 648w / 924h; engine 923.5 within 0.5)
    { code: "SPQ-1-52253", ext: 648,   int: 608,   orientation: "H" },
    { code: "SPQ-1-52253", ext: 923.5, int: 883.5, orientation: "V" },
  ],
  glass: [
    // Printed 638 × 914 (engine 913.5, within Quotila-style 0.5 rounding)
    { width: 638, height: 913.5 },
    { width: 638, height: 913.5 },
    { width: 638, height: 913.5 },
    { width: 638, height: 913.5 },
  ],
  gaskets: [
    { code: "SP_GSKFM", lengthMm: 2004 },
    { code: "SP_S001",  lengthMm: 22576 }, // invariant vs doc 0 — midrails don't change it
  ],
  hardware: [
    { code: "SPQ-2-91252", qty: 2 },
    { code: "SP_CBLOCK01", qty: 8 },
    { code: "SP_GBRIDGE",  qty: 32 }, // 8 per pane × 4 panes
  ],
};

// Docs 2/3: unequal leaves (printed sashes 724/924 = finished 718/918). Same
// 1700×2100 window; the stulp centreline moves to x = 48 + 678 + 24 = 750.
// Uses the COLLECTION design (externalId aee13358…, the pure Z-sash pair) +
// the generic splitRatios override — proving the derived topology AND the
// drag-to-resize path reproduce the docs.
const JOB_264_UNEQUAL: ExpectedJob = {
  name: "Job 00000264 (docs 2/3): 1700×2100 French door, unequal leaves 718/918",
  designId: "aee13358-f0ec-4be5-992a-d3abad4642f9",
  widthMm: 1700,
  heightMm: 2100,
  splitRatios: { root: 750 / 1700 },
  bars: [
    { code: "SPQ-6-11252", ext: 1700, int: 1604, orientation: "H" },
    { code: "SPQ-6-11252", ext: 2100, int: 2004, orientation: "V" },
    { code: "SPQ-1-46252", ext: 2004, int: 2004, orientation: "V" },
    // Narrow leaf (printed 724 → 718), wide leaf (printed 924 → 918)
    { code: "SPQ-5-45252", ext: 718,  int: 508,  orientation: "H" },
    { code: "SPQ-5-45252", ext: 918,  int: 708,  orientation: "H" },
    { code: "SPQ-5-45252", ext: 2044, int: 1834, orientation: "V" },
    // Beads (printed 548 / 748 / 1874)
    { code: "SPQ-1-52253", ext: 548,  int: 508,  orientation: "H" },
    { code: "SPQ-1-52253", ext: 748,  int: 708,  orientation: "H" },
    { code: "SPQ-1-52253", ext: 1874, int: 1834, orientation: "V" },
  ],
  glass: [
    { width: 538, height: 1864 },
    { width: 738, height: 1864 },
  ],
  gaskets: [
    { code: "SP_GSKFM", lengthMm: 2004 },
    { code: "SP_S001",  lengthMm: 22576 }, // invariant across the split (docs agree)
  ],
  hardware: [
    { code: "SPQ-2-91252", qty: 2 },
    { code: "SP_CBLOCK01", qty: 8 },
    { code: "SP_GBRIDGE",  qty: 16 },
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
    ...(job.splitRatios ? { splitRatios: job.splitRatios } : {}),
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

// ---------- Sliding drag-to-resize spans ----------------------------
// Proves: (a) equal panels (no overrides) reproduce the calibrated cut list
// byte-identically; (b) a dragged boundary produces unequal panels via
// panelExtᵢ = fᵢ·(W+10) − 6, whose widths still sum to the equal-case total.
function validateSlidingSpans(): void {
  console.log("\n==================================================");
  console.log("Sliding patio — drag-to-resize spans (OX 1500×1750)");
  console.log("==================================================");
  const OX = "0057bd49-577c-4b61-bf5f-f8d69ca760b3"; // collection UUID for the OX design
  const base = {
    orderNo: "TEST", customer: "Validation", systemId: "sunnyplast-70",
    designId: OX, widthMm: 1500, heightMm: 1750,
  };
  const sashHorWidths = (out: QuoteOutput): number[] =>
    out.parts.bars.filter((b) => b.code === "SPQ-GL-20252" && b.orientation === "H").map((b) => b.extMm);

  // (a) equal default — byte-identical to the calibrated formula.
  const eq = sashHorWidths(solve({ ...base }));
  expect("equal: 4 sash-H bars (2 panels)", eq.length, 4);
  expect("equal: every panel 749", eq.every((w) => approxEq(w, 749)), true);

  // (b) drag boundary b1 → 0.40: panel1 = 0.40·1510−6 = 598, panel2 = 900.
  const dragged = sashHorWidths(solve({ ...base, splitRatios: { "root.b1": 0.4 } }));
  expect("dragged: panel 598 present", dragged.some((w) => approxEq(w, 598)), true);
  expect("dragged: panel 900 present", dragged.some((w) => approxEq(w, 900)), true);
  const distinct = Array.from(new Set(dragged.map((w) => Math.round(w * 10) / 10)));
  expect("dragged: spans sum to equal-case total 1498", distinct.reduce((a, b) => a + b, 0), 1498);
}

// ---------- Sliding welded (printed) saw sizes -----------------------
// Jobs 44/48 print SAW sizes = finished + 3 mm/end on the mitred frame/sash
// cuts (per-profile weldAllowanceMm = 3, so these hold even if the GLOBAL weld
// default drifts in the DB). Beads/steel/aux are square-cut ⇒ print unchanged.
function validateSlidingWeld(): void {
  console.log("\n==================================================");
  console.log("Sliding patio — welded saw sizes (Job 44, 1900×2100)");
  console.log("==================================================");

  const out: QuoteOutput = solve({
    orderNo: "TEST", customer: "Validation",
    designId: "fbf4592c-ee97-4ac9-ba96-862370213bff", widthMm: 1900, heightMm: 2100,
    systemId: "sunnyplast-70",
  });
  const find = (code: string, ext: number) =>
    out.parts.bars.find((b) => b.code === code && Math.abs(b.extMm - ext) <= 0.6);

  expect("frame welded 1906 (printed)", find("SPQ-GL-10252", 1900)?.weldedExtMm ?? -1, 1906);
  expect("frame welded 2106 (printed)", find("SPQ-GL-10252", 2100)?.weldedExtMm ?? -1, 2106);
  expect("sash welded 955 (printed)",  find("SPQ-GL-20252", 949)?.weldedExtMm ?? -1, 955);
  expect("sash welded 2020 (printed)", find("SPQ-GL-20252", 2014)?.weldedExtMm ?? -1, 2020);
  expect("bead prints unwelded (819)", find("SPQ-1-51252", 819)?.weldedExtMm ?? -1, 819);
  expect("aux prints unwelded (1805)", find("AD16014", 1805)?.weldedExtMm ?? -1, 1805);
  const steel = out.parts.reinforcement.find((b) => b.code === "AU26X26" && Math.abs(b.extMm - 1874) <= 0.6);
  expect("sash steel prints unwelded (1874)", steel?.weldedExtMm ?? -1, 1874);
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

// ---------- French door welded (printed) saw sizes -------------------
// Job 00000264 prints SAW sizes = finished + 3 mm/end on mitred/horned cuts
// (per-profile weldAllowanceMm = 3 on the French parts, so these hold even if
// the GLOBAL weld default drifts in the DB). Square cuts print unchanged.
// Also proves the equal-split default of the collection pair design (no
// splitRatios ⇒ sashes 818, the docs' 824 printed).
function validateFrenchDoor(): void {
  console.log("\n==================================================");
  console.log("French door — welded saw sizes + equal default");
  console.log("==================================================");

  const out: QuoteOutput = solve({
    orderNo: "TEST", customer: "Validation",
    designId: "door-french-midrail", widthMm: 1700, heightMm: 2100,
    systemId: "sunnyplast-70",
  });
  const find = (code: string, ext: number) =>
    out.parts.bars.find((b) => b.code === code && Math.abs(b.extMm - ext) <= 0.6);

  expect("frame welded 1706 (printed)", find("SPQ-6-11252", 1700)?.weldedExtMm ?? -1, 1706);
  expect("frame welded 2106 (printed)", out.parts.bars.find((b) => b.code === "SPQ-6-11252" && b.extMm === 2100)?.weldedExtMm ?? -1, 2106);
  expect("sash welded 824 (printed)", find("SPQ-5-45252", 818)?.weldedExtMm ?? -1, 824);
  expect("sash welded 2050 (printed)", find("SPQ-5-45252", 2044)?.weldedExtMm ?? -1, 2050);
  expect("midrail welded 748 (printed)", find("SPQ-005-30252", 742)?.weldedExtMm ?? -1, 748);
  expect("French mullion square-cut — welded == 2004", find("SPQ-1-46252", 2004)?.weldedExtMm ?? -1, 2004);
  expect("French mullion end prep [ - ]", find("SPQ-1-46252", 2004)?.endPrep ?? "?", "[ - ]");

  // Collection pair design, no overrides ⇒ equal leaves (818 each, docs 0/1/4).
  const eq: QuoteOutput = solve({
    orderNo: "TEST", customer: "Validation",
    designId: "aee13358-f0ec-4be5-992a-d3abad4642f9", widthMm: 1700, heightMm: 2100,
    systemId: "sunnyplast-70",
  });
  const sashH = eq.parts.bars.filter((b) => b.code === "SPQ-5-45252" && b.orientation === "H");
  expect("equal default: 4 horizontal sash bars", sashH.length, 4);
  expect("equal default: every sash 818", sashH.every((b) => Math.abs(b.extMm - 818) <= 0.6), true);
  // French leaves are excluded from the casement gaskets (docs list neither).
  const g1 = eq.parts.gaskets.find((g) => g.code === "GKT-01");
  const g2 = eq.parts.gaskets.find((g) => g.code === "GKT-02");
  expect("French quote: Gasket 01 empty", g1?.lengthMm ?? 0, 0);
  expect("French quote: Gasket 02 empty", g2?.lengthMm ?? 0, 0);
}

// Inside/outside colour + joint overlay are additive: a default quote, a
// White+White quote, and the same quote are all byte-identical (geometry +
// pricing + SVG). The joints flag only ADDS overlay markup and never changes
// pricing. Uses the real catalog (only White seeded), so this proves the
// no-op/byte-identical guarantee end-to-end through solve().
function validateColourAndJoints(): void {
  console.log("\n==================================================");
  console.log("Inside/outside colour + joint overlay (additive)");
  console.log("==================================================");

  const baseInput = {
    orderNo: "TEST", customer: "Validation",
    designId: "win-th-over-fixed-z", widthMm: 1200, heightMm: 1200,
    systemId: "sunnyplast-70",
  } as const;

  const plain = solve({ ...baseInput });
  const whiteWhite = solve({ ...baseInput, colourKey: "white", colourKeyOutside: "white" });
  expect("White+White grandTotal == default", whiteWhite.pricing.totals.grandTotal, plain.pricing.totals.grandTotal);
  expect("White+White SVG byte-identical", whiteWhite.geometry.svg, plain.geometry.svg);

  const joints = solve({ ...baseInput, showJoints: true });
  expect("showJoints adds joint layer", joints.geometry.svg.includes('id="joints"'), true);
  expect("default SVG has no joint layer", plain.geometry.svg.includes('id="joints"'), false);
  expect("showJoints does NOT change pricing", joints.pricing.totals.grandTotal, plain.pricing.totals.grandTotal);
}

// Load the catalog from PostgreSQL before solving, then run all jobs.
(async () => {
  await loadCatalog();

  [
    JOB_85, JOB_88, JOB_90,
    JOB_44_ANDREI, JOB_48_ANDREI,
    JOB_SL_OX, JOB_SL_OXO, JOB_SL_OXXO,
    JOB_264_T, JOB_264_MIDRAIL, JOB_264_UNEQUAL,
  ].forEach(validate);
  validateSlidingSpans();
  validateSlidingWeld();
  validateFrenchDoor();
  validateCustomMode();
  validateWeldMath();
  validateColourAndJoints();
  validateExtractor(expect);
  validatePricing(expect);
  validateSvg(expect);

  console.log("\n==================================================");
  console.log(`RESULTS:  ${passCount} passed,  ${failCount} failed`);
  console.log("==================================================");
  process.exit(failCount === 0 ? 0 : 1);
})();
