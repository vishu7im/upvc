// =====================================================================
// validation/jobs.ts — proves the engine reproduces Quotila's output
// for Jobs 85, 88, 90, to the millimetre.
//
// Run with:  npm run validate
// =====================================================================

import { solve } from "../engine/solve.ts";
import { solveTopology } from "../engine/topology.ts";
import { getDesign, getSystem, loadCatalog } from "../catalog/index.ts";
import { renderWorkOrder } from "../engine/documents.ts";
import type { CellNode, CellSpec, QuoteOutput } from "../types.ts";
import { validateExtractor } from "../tools/extract-topology.test.ts";
import { validatePricing } from "../engine/pricing.test.ts";
import { validateSvg } from "../engine/svg.test.ts";
import { validateLimits } from "../engine/limits.test.ts";
import { validateEdTable } from "../catalog/ed-table.test.ts";
import { validateGlyphs } from "../catalog/glyphs.test.ts";
import { validateRules } from "../designer/rules.test.ts";
import { validateOptionSystem } from "../designer/options.test.ts";
import { validateDesigner } from "../designer/resolve.test.ts";
import { validateBasket } from "../designer/basket.test.ts";
import { validateSupplierPrices } from "./prices.test.ts";

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
    { code: "SPQ-05-30252", ext: 1128,  int: 970,    orientation: "H" }, // head
    { code: "SPQ-05-30252", ext: 1128,  int: 970,    orientation: "H" }, // sill
    { code: "SPQ-05-30252", ext: 358.5, int: 200.5,  orientation: "V" }, // left
    { code: "SPQ-05-30252", ext: 358.5, int: 200.5,  orientation: "V" }, // right
    // Beads — top sash (970 × 200.5 inner)
    { code: "SPQ-1-51252", ext: 1010,  int: 970,   orientation: "H" }, // top×2 → recorded as Ext 1010
    { code: "SPQ-1-51252", ext: 1010,  int: 970,   orientation: "H" },
    { code: "SPQ-1-51252", ext: 240.5, int: 200.5, orientation: "V" },
    { code: "SPQ-1-51252", ext: 240.5, int: 200.5, orientation: "V" },
    // Beads — bottom fixed (1072 × 702.5 cell daylight)
    { code: "SPQ-1-51252", ext: 1112,  int: 1072,  orientation: "H" },
    { code: "SPQ-1-51252", ext: 1112,  int: 1072,  orientation: "H" },
    { code: "SPQ-1-51252", ext: 742.5, int: 702.5, orientation: "V" },
    { code: "SPQ-1-51252", ext: 742.5, int: 702.5, orientation: "V" },
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
    // Frame — head and sill.
    { code: "SPQ-5-10252", ext: 800,  int: 672,  orientation: "H" },
    { code: "SPQ-5-10252", ext: 800,  int: 672,  orientation: "H" },
    // Frame — jambs, BROKEN by the root transom into 400 + 800 per side.
    //
    // RE-BASELINED 2026-07-30 (owner decision). Quotila's Job 88 doc printed
    // continuous jambs here — `{ ext: 1200, int: 1072, orientation: "V" } × 2`
    // — but the reference configurator breaks the jambs under ANY frame-level
    // divider, T as well as Z, and the owner chose that convention for every
    // product. Job 173 p4 is the evidence (405 + 1575 under a T transom in a
    // 1970 frame); Job 85 already printed the break under a Z. Spec/questions.md
    // Q25 records the conflict.
    { code: "SPQ-5-10252", ext: 400,  int: 336,  orientation: "V" },
    { code: "SPQ-5-10252", ext: 800,  int: 736,  orientation: "V" },
    // T-transom. RE-BASELINED with the jambs: Quotila printed 806 (= Int 672 +
    // 2 × 67, the cell-to-cell horn rule). A frame-BREAKING T transom instead
    // spans the frame's full outer width (Job 173 p4: 984 over a 975 frame),
    // so Ext = 800 here and the saw size is 809 (4.5 mm of weld per end).
    { code: "SPQ-05-20252", ext: 800, int: 672, orientation: "H" },
    // Top sash (728 × 358.5 outer)
    { code: "SPQ-05-30252", ext: 728,   int: 570,   orientation: "H" },
    { code: "SPQ-05-30252", ext: 728,   int: 570,   orientation: "H" },
    { code: "SPQ-05-30252", ext: 358.5, int: 200.5, orientation: "V" },
    { code: "SPQ-05-30252", ext: 358.5, int: 200.5, orientation: "V" },
    // Bottom sash (728 × 758.5 outer)
    { code: "SPQ-05-30252", ext: 728,   int: 570,   orientation: "H" },
    { code: "SPQ-05-30252", ext: 728,   int: 570,   orientation: "H" },
    { code: "SPQ-05-30252", ext: 758.5, int: 600.5, orientation: "V" },
    { code: "SPQ-05-30252", ext: 758.5, int: 600.5, orientation: "V" },
    // Beads
    { code: "SPQ-1-51252", ext: 610,   int: 570,   orientation: "H" },
    { code: "SPQ-1-51252", ext: 610,   int: 570,   orientation: "H" },
    { code: "SPQ-1-51252", ext: 610,   int: 570,   orientation: "H" },
    { code: "SPQ-1-51252", ext: 610,   int: 570,   orientation: "H" },
    { code: "SPQ-1-51252", ext: 240.5, int: 200.5, orientation: "V" },
    { code: "SPQ-1-51252", ext: 240.5, int: 200.5, orientation: "V" },
    { code: "SPQ-1-51252", ext: 640.5, int: 600.5, orientation: "V" },
    { code: "SPQ-1-51252", ext: 640.5, int: 600.5, orientation: "V" },
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
    { code: "SPQ-5-45252", ext: 649,  int: 439,  orientation: "H" },
    { code: "SPQ-5-45252", ext: 649,  int: 439,  orientation: "H" },
    { code: "SPQ-5-45252", ext: 1549, int: 1339, orientation: "V" },
    { code: "SPQ-5-45252", ext: 1549, int: 1339, orientation: "V" },
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
//   panel Ext: bypass (W+10)/n − 3, height H − 83;
//   steel = barInt + 30 (endClearance −15/end) — AO44X12 frame, AU26X26 sash;
//   aux profiles: track W−95, channel cap H−95, slide cap H−96 + (W−45)×2,
//   sash cap panelExtH−2 per panel, AD55142/GLIS16 panelExtW−102 per FIXED panel.
// designIds are the collection design UUIDs (the seed attaches the topology by
// externalId == designId). Reinforcement int == ext (square-cut steel).
//
// RE-BASELINED 2026-08-10 (patio.pdf, 07 Aug 2026 — see the F1–F4 block below).
// That package re-issued the 31 Jul jobs with every panel 3 mm bigger in BOTH
// axes, so the PANEL rows of Jobs 44/48 are superseded: their sash/bead/glass/
// sash-steel/sash-cap figures below are the Andrei documents' printed values +3,
// and their own printed values (949×2014 @ 1900×2100, 1104×2224 @ 2210×2310) are
// still asserted — reproduced from the catalog by setting the sliding sash's
// panelClearance back to 6/86 in validateSlidingPanelEnvelope(). Frame, frame
// steel and every auxiliary row are UNCHANGED, exactly as both packages print.

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
    // Sash (face 85), both panels identical — the doc prints 955/2020; under the
    // 07 Aug envelope (3/83) the panel is 952 × 2017, printed 958/2023.
    { code: "SPQ-GL-20252", ext: 952,  int: 782,  orientation: "H" },
    { code: "SPQ-GL-20252", ext: 2017, int: 1847, orientation: "V" },
    // Beads ("Bagheta ptr.24mm") — doc 819/1884, now 822/1887 (no weld add)
    { code: "SPQ-1-51252", ext: 822,  int: 782,  orientation: "H" },
    { code: "SPQ-1-51252", ext: 1887, int: 1847, orientation: "V" },
    // Frame steel (= frameInt + 30) — printed 1834/2034 (frame is unchanged)
    { code: "AO44X12", ext: 1834, int: 1834, orientation: "H" },
    { code: "AO44X12", ext: 2034, int: 2034, orientation: "V" },
    // Sash steel (= sashInt + 30) — doc 809/1874, now 812/1877
    { code: "AU26X26", ext: 812,  int: 812,  orientation: "H" },
    { code: "AU26X26", ext: 1877, int: 1877, orientation: "V" },
    // Auxiliary profiles — every ProfilAuxiliar doc row
    { code: "AD16014",      ext: 1805, orientation: "H" }, // slide track = W − 95
    { code: "GLIS17",       ext: 2005, orientation: "V" }, // channel cap = H − 95
    { code: "SPQ-GL-10253", ext: 2004, orientation: "V" }, // slide cap = H − 96
    { code: "SPQ-GL-10253", ext: 1855, orientation: "H" }, // slide cap = W − 45 (×2)
    { code: "SPQ-GL-20253", ext: 2015, orientation: "V" }, // sash cap = panelExtH − 2 (doc 2012)
    { code: "AD55142",      ext: 850,  orientation: "H" }, // big frame cap = panelExtW − 102 (doc value, unmoved)
    { code: "GLIS16",       ext: 850,  orientation: "H" }, // fixed-panel cap = panelExtW − 102
  ],
  glass: [{ width: 812, height: 1877 }], // doc "Gol 24mm 809 × 1874" ×2, +3 under the 07 Aug envelope
  gaskets: [{ code: "GKT-02", lengthMm: 10756 }], // Σ glass perimeter (formula; not on the doc)
  hardware: [
    { code: "GLIS-03",   qty: 7 },  // 1 fixed panel × 7
    { code: "GLIS-09",     qty: 1 },  // 1 slider
    { code: "GLIS-12",    qty: 1 },
    { code: "GLIS-10", qty: 1 },
    { code: "GLIS-13",    qty: 2 },
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
    // Sash — doc prints 1110/2230; under the 07 Aug envelope 1107 × 2227
    { code: "SPQ-GL-20252", ext: 1107, int: 937,  orientation: "H" },
    { code: "SPQ-GL-20252", ext: 2227, int: 2057, orientation: "V" },
    // Beads — doc 974/2094, now 977/2097
    { code: "SPQ-1-51252", ext: 977,  int: 937,  orientation: "H" },
    { code: "SPQ-1-51252", ext: 2097, int: 2057, orientation: "V" },
    // Steel — printed 2144/2244 (frame, unchanged), 964/2084 → 967/2087 (sash)
    { code: "AO44X12", ext: 2144, int: 2144, orientation: "H" },
    { code: "AO44X12", ext: 2244, int: 2244, orientation: "V" },
    { code: "AU26X26", ext: 967,  int: 967,  orientation: "H" },
    { code: "AU26X26", ext: 2087, int: 2087, orientation: "V" },
    // Auxiliary profiles
    { code: "AD16014",      ext: 2115, orientation: "H" },
    { code: "GLIS17",       ext: 2215, orientation: "V" },
    { code: "SPQ-GL-10253", ext: 2214, orientation: "V" },
    { code: "SPQ-GL-10253", ext: 2165, orientation: "H" },
    { code: "SPQ-GL-20253", ext: 2225, orientation: "V" }, // panelExtH − 2 (doc 2222)
    { code: "AD55142",      ext: 1005, orientation: "H" }, // doc value, unmoved (panelExtW − 102)
    { code: "GLIS16",       ext: 1005, orientation: "H" },
  ],
  glass: [{ width: 967, height: 2087 }], // doc "Gol 24mm 964 × 2084" ×2, +3
  gaskets: [{ code: "GKT-02", lengthMm: 12216 }],
  hardware: [
    { code: "GLIS-03",   qty: 7 },
    { code: "GLIS-09",     qty: 1 },
    { code: "GLIS-12",    qty: 1 },
    { code: "GLIS-10", qty: 1 },
    { code: "GLIS-13",    qty: 2 },
  ],
};

// ---------- patio.pdf (F1–F4) ------------------------------------------
// Owner package, printed 07 Aug 2026 ("100 SOFT UK"): four sliding items, all
// 2000 high, covering 2-, 3- and 4-panel layouts — the multi-panel evidence the
// Jobs 44/48 calibration was missing. Same Windowmaker layout as patio-docs/.
// It RE-ISSUES the four items of patio_calibration.pdf (31 Jul, now deleted);
// the assertions below are the 07 Aug figures.
//
// WHAT THEY PROVE. Every frame, sash, bead, steel and glass row reproduces from
// the constants already in the catalog (frame face 48, sash face 85, bead + 40,
// glass + 30, steel Int + 30, 3 mm/end weld) — EXCEPT two:
//
//  1. the panel-width constant K, which the 31 Jul package showed is per
//     configuration, not one bypass value (unchanged by the re-issue):
//       F1 n=2  K=10 (agrees with Jobs 44/48)
//       F2 n=3  K=3   ·  F4 n=3  K=3   (two independent widths + slider positions)
//       F3 n=4 meeting K=92 (replaces 79, which rested on the superseded Job 104)
//     See topology.ts#PANEL_WIDTH_K.
//  2. the panel ENVELOPE, which the re-issue moved. A line-by-line diff of the
//     two packages shows exactly one substantive change: every panel is 3 mm
//     bigger in BOTH axes (sash saw 1005/1920 → 1008/1923, bead 869/1784 →
//     872/1787, sash steel + glass 859×1774 → 862×1777, the panel-tracking cap
//     SPQ-GL-20253 1912 → 1915), while the frame, the frame steel, EVERY
//     auxiliary row and every quantity are identical. So `panelExt =
//     f×(W+K) − 6` / `H − 86` became `− 3` / `− 83`, and because the same
//     physical profiles printed both, the two deductions are now CATALOG data
//     (SashSection.panelClearance) rather than engine constants.
//
// WHAT THEY DO NOT SETTLE — deliberately NOT asserted (Spec/questions.md Q27):
// the auxiliary profiles. F1 prints NO AD55142 and NO GLIS16 although it has a
// fixed panel, while Jobs 44/48 (also 2-panel, one fixed) print both; and the
// AD16014 / GLIS17 / SPQ-GL-10253 / GLIS16 lengths follow no rule that holds
// across the four samples. F2–F4 also print an AD55144 ("Piesa inchidere 3/4
// canaturi") the catalog does not have. The aux rows below are asserted ONLY on
// F1, and only the three whose Jobs 44/48 rule the document confirms.

const JOB_PATIO_F1: ExpectedJob = {
  name: "patio.pdf F1: 2000×2000 sliding patio (2-panel OX) — doc-exact",
  designId: "0057bd49-577c-4b61-bf5f-f8d69ca760b3", // OX: fixed + slide left
  widthMm: 2000,
  heightMm: 2000,
  bars: [
    // Frame SPQ-GL-10252 — printed 2006.0 on all four edges (= 2000 + 2×3 weld)
    { code: "SPQ-GL-10252", ext: 2000, int: 1904, orientation: "H" },
    { code: "SPQ-GL-10252", ext: 2000, int: 1904, orientation: "V" },
    // Frame steel AO44X12 — printed 1934.0 (= frame Int + 30)
    { code: "AO44X12", ext: 1934, int: 1934, orientation: "H" },
    { code: "AO44X12", ext: 1934, int: 1934, orientation: "V" },
    // Sash SPQ-GL-20252 — printed 1923.0 / 1008.0.
    // Width: (2000 + 10)/2 − 3 = 1002.  Height: 2000 − 83 = 1917.
    { code: "SPQ-GL-20252", ext: 1002, int: 832,  orientation: "H" },
    { code: "SPQ-GL-20252", ext: 1917, int: 1747, orientation: "V" },
    // Sash steel AU26X26 — printed 862.0 / 1777.0
    { code: "AU26X26", ext: 862,  int: 862,  orientation: "H" },
    { code: "AU26X26", ext: 1777, int: 1777, orientation: "V" },
    // Bead SPQ-1-51252 — printed 872.0 / 1787.0 (no weld add)
    { code: "SPQ-1-51252", ext: 872,  int: 832,  orientation: "H" },
    { code: "SPQ-1-51252", ext: 1787, int: 1747, orientation: "V" },
    // Auxiliaries the document confirms against the Jobs 44/48 rules
    { code: "AD16014",      ext: 1905, orientation: "H" }, // W − 95
    { code: "GLIS17",       ext: 1905, orientation: "V" }, // H − 95
    { code: "SPQ-GL-10253", ext: 1904, orientation: "V" }, // H − 96
    { code: "SPQ-GL-10253", ext: 1955, orientation: "H" }, // W − 45, ×2
    // The one aux row that TRACKS the panel: it moved 1912 → 1915 with the
    // envelope, which is the independent confirmation that the panel really is
    // 3 mm taller (a cap cut to panelExtH − 2 cannot move on its own).
    { code: "SPQ-GL-20253", ext: 1915, orientation: "V" }, // panelExtH − 2
    // AD55142 / GLIS16 are NOT asserted — the document omits them entirely
    // although this item has a fixed panel. See the block comment above.
  ],
  glass: [{ width: 862, height: 1777 }], // doc "862 x 1777, 24mm Low-E4 +DIAMANT MARO+(Ar)" ×2
  gaskets: [{ code: "GKT-02", lengthMm: 10556 }], // Σ glass perimeter (formula; not on the doc)
  hardware: [
    { code: "GLIS-03", qty: 7 }, // 1 fixed panel × 7
    { code: "GLIS-09", qty: 1 },
    { code: "GLIS-12", qty: 1 },
    { code: "GLIS-10", qty: 1 },
    { code: "GLIS-13", qty: 2 },
  ],
};

const JOB_PATIO_F2: ExpectedJob = {
  name: "patio.pdf F2: 3000×2000 sliding patio (3-panel XOO) — K=3",
  designId: "1ae6a0b0-3eb8-4b7a-bafb-6118ec554b52", // XOO: slide right + 2 fixed
  widthMm: 3000,
  heightMm: 2000,
  bars: [
    // Frame — printed 3006.0 (H) / 2006.0 (V); steel 2934.0 / 1934.0
    { code: "SPQ-GL-10252", ext: 3000, int: 2904, orientation: "H" },
    { code: "SPQ-GL-10252", ext: 2000, int: 1904, orientation: "V" },
    { code: "AO44X12", ext: 2934, int: 2934, orientation: "H" },
    { code: "AO44X12", ext: 1934, int: 1934, orientation: "V" },
    // Sash — printed 1004.0 / 1923.0. Width: (3000 + 3)/3 − 3 = 998.
    // K=3 is what the 31 Jul package corrected (the old K=10 gave 997.3);
    // the −3 clearance is what the 07 Aug re-issue corrected.
    { code: "SPQ-GL-20252", ext: 998,  int: 828,  orientation: "H" },
    { code: "SPQ-GL-20252", ext: 1917, int: 1747, orientation: "V" },
    // Sash steel — printed 858.0 / 1777.0
    { code: "AU26X26", ext: 858,  int: 858,  orientation: "H" },
    { code: "AU26X26", ext: 1777, int: 1777, orientation: "V" },
    // Bead — printed 868.0 / 1787.0
    { code: "SPQ-1-51252", ext: 868,  int: 828,  orientation: "H" },
    { code: "SPQ-1-51252", ext: 1787, int: 1747, orientation: "V" },
  ],
  glass: [{ width: 858, height: 1777 }], // doc "858 x 1777, 24mm Low-E4 +DIAMANT MARO+(Ar)" ×3
  gaskets: [{ code: "GKT-02", lengthMm: 15810 }],
  hardware: [
    { code: "GLIS-03", qty: 14 }, // 2 fixed panels × 7
    { code: "GLIS-09", qty: 1 },
  ],
};

const JOB_PATIO_F3: ExpectedJob = {
  name: "patio.pdf F3: 4000×2000 sliding patio (4-panel OXXO) — K=92",
  designId: "bd0ad364-3313-442d-871f-db7fab0502c4", // OXXO centre-meeting
  widthMm: 4000,
  heightMm: 2000,
  bars: [
    // Frame — printed 4006.0 / 2006.0; steel 3934.0 / 1934.0
    { code: "SPQ-GL-10252", ext: 4000, int: 3904, orientation: "H" },
    { code: "SPQ-GL-10252", ext: 2000, int: 1904, orientation: "V" },
    { code: "AO44X12", ext: 3934, int: 3934, orientation: "H" },
    { code: "AO44X12", ext: 1934, int: 1934, orientation: "V" },
    // Sash — printed 1026.0 / 1923.0. Width: (4000 + 92)/4 − 3 = 1020.
    // This is the FIRST production document for a centre-meeting patio; the old
    // K=79 (Job 104, superseded) would have given 1017.75.
    { code: "SPQ-GL-20252", ext: 1020, int: 850,  orientation: "H" },
    { code: "SPQ-GL-20252", ext: 1917, int: 1747, orientation: "V" },
    // Sash steel — printed 880.0 / 1777.0
    { code: "AU26X26", ext: 880,  int: 880,  orientation: "H" },
    { code: "AU26X26", ext: 1777, int: 1777, orientation: "V" },
    // Bead — printed 890.0 / 1787.0
    { code: "SPQ-1-51252", ext: 890,  int: 850,  orientation: "H" },
    { code: "SPQ-1-51252", ext: 1787, int: 1747, orientation: "V" },
  ],
  glass: [{ width: 880, height: 1777 }], // doc "880 x 1777, 24mm Low-E4 +DIAMANT MARO+(Ar)" ×4
  gaskets: [{ code: "GKT-02", lengthMm: 21256 }],
  hardware: [
    { code: "GLIS-03", qty: 14 }, // 2 fixed panels × 7
    { code: "GLIS-09", qty: 2 },  // 2 sliders
  ],
};

const JOB_PATIO_F4: ExpectedJob = {
  name: "patio.pdf F4: 3500×2000 sliding patio (3-panel OXO) — K=3",
  designId: "8a1b8a80-e31a-4f0b-aa62-2771e04ec985", // OXO slide left
  widthMm: 3500,
  heightMm: 2000,
  bars: [
    // Frame — printed 3506.0 / 2006.0; steel 3434.0 / 1934.0
    { code: "SPQ-GL-10252", ext: 3500, int: 3404, orientation: "H" },
    { code: "SPQ-GL-10252", ext: 2000, int: 1904, orientation: "V" },
    { code: "AO44X12", ext: 3434, int: 3434, orientation: "H" },
    { code: "AO44X12", ext: 1934, int: 1934, orientation: "V" },
    // Sash — printed 1170.7 / 1923.0. Width: (3500 + 3)/3 − 3 = 1164.6…
    // The SECOND independent 3-panel data point, at a different width and with
    // the slider in the middle rather than on the end — it agrees on K = 3.
    { code: "SPQ-GL-20252", ext: 1164.7, int: 994.7, orientation: "H" },
    { code: "SPQ-GL-20252", ext: 1917,   int: 1747,  orientation: "V" },
    // Sash steel — printed 1024.7 / 1777.0
    { code: "AU26X26", ext: 1024.7, int: 1024.7, orientation: "H" },
    { code: "AU26X26", ext: 1777,   int: 1777,   orientation: "V" },
    // Bead — printed 1034.7 / 1787.0
    { code: "SPQ-1-51252", ext: 1034.7, int: 994.7, orientation: "H" },
    { code: "SPQ-1-51252", ext: 1787,   int: 1747,  orientation: "V" },
  ],
  // The doc prints the glass as 1025 × 1777 — its own rounding of 1024.7 (it
  // prints beads to 1 dp but glass to the whole millimetre). Ours now rounds
  // printed lengths the same way (documents.ts#mm), so the paperwork agrees.
  glass: [{ width: 1024.7, height: 1777 }],
  gaskets: [{ code: "GKT-02", lengthMm: 16810.2 }],
  hardware: [
    { code: "GLIS-03", qty: 14 },
    { code: "GLIS-09", qty: 1 },
  ],
};

// The three old Job 104 (yogi) sizes stay as FORMULA-CONSISTENCY jobs: their
// expected values are recomputed under the current constants (they no longer
// match the superseded yogi docs). OXO also exercises the multi-panel aux
// rules. Both OXO and OXXO were re-baselined on 2026-08-04 when
// patio_calibration.pdf corrected K for n=3 (10 → 3) and n=4 (79 → 92), and all
// three again on 2026-08-10 when patio.pdf moved the panel envelope to 3/83.

const JOB_SL_OX: ExpectedJob = {
  name: "Sliding OX 1500×1750 (formula-consistency, Jobs 44/48 constants)",
  designId: "0057bd49-577c-4b61-bf5f-f8d69ca760b3",
  widthMm: 1500,
  heightMm: 1750,
  bars: [
    { code: "SPQ-GL-10252", ext: 1500, int: 1404, orientation: "H" },
    { code: "SPQ-GL-10252", ext: 1750, int: 1654, orientation: "V" },
    // Panel: (1500+10)/2 − 3 = 752; height 1750 − 83 = 1667
    { code: "SPQ-GL-20252", ext: 752,  int: 582,  orientation: "H" },
    { code: "SPQ-GL-20252", ext: 1667, int: 1497, orientation: "V" },
    { code: "SPQ-1-51252", ext: 622,  int: 582,  orientation: "H" },
    { code: "SPQ-1-51252", ext: 1537, int: 1497, orientation: "V" },
    { code: "AO44X12", ext: 1434, int: 1434, orientation: "H" },
    { code: "AO44X12", ext: 1684, int: 1684, orientation: "V" },
    { code: "AU26X26", ext: 612,  int: 612,  orientation: "H" },
    { code: "AU26X26", ext: 1527, int: 1527, orientation: "V" },
  ],
  glass: [{ width: 612, height: 1527 }],
  gaskets: [{ code: "GKT-02", lengthMm: 8556 }],
  hardware: [
    { code: "GLIS-03",   qty: 7 },
    { code: "GLIS-09",     qty: 1 },
    { code: "GLIS-12",    qty: 1 },
    { code: "GLIS-10", qty: 1 },
    { code: "GLIS-13",    qty: 2 },
  ],
};

const JOB_SL_OXO: ExpectedJob = {
  name: "Sliding OXO 2000×1750 (formula-consistency; 3-panel K=3 from patio_calibration)",
  designId: "8a1b8a80-e31a-4f0b-aa62-2771e04ec985",
  widthMm: 2000,
  heightMm: 1750,
  bars: [
    { code: "SPQ-GL-10252", ext: 2000, int: 1904, orientation: "H" },
    { code: "SPQ-GL-10252", ext: 1750, int: 1654, orientation: "V" },
    // Panel: (2000+3)/3 − 3 = 664.6… (K=3, patio.pdf F2/F4); height 1750−83=1667
    { code: "SPQ-GL-20252", ext: 664.7, int: 494.7, orientation: "H" },
    { code: "SPQ-GL-20252", ext: 1667,  int: 1497,  orientation: "V" },
    { code: "SPQ-1-51252", ext: 534.7, int: 494.7, orientation: "H" },
    { code: "SPQ-1-51252", ext: 1537,  int: 1497,  orientation: "V" },
    { code: "AO44X12", ext: 1934, int: 1934, orientation: "H" },
    { code: "AO44X12", ext: 1684, int: 1684, orientation: "V" },
    { code: "AU26X26", ext: 524.7, int: 524.7, orientation: "H" },
    { code: "AU26X26", ext: 1527,  int: 1527,  orientation: "V" },
    // Multi-panel aux coverage (per-FIXED-panel caps, 2 fixed panels here).
    // These follow the Jobs 44/48 rules, which neither patio package confirms
    // for n ≥ 3 — kept as a regression guard on the rule we have, not as a
    // claim about the document. See Spec/questions.md Q27. (AD55142/GLIS16
    // stay 562.7: the panel grew 3 and the constant absorbed 3.)
    { code: "AD16014",      ext: 1905, orientation: "H" },
    { code: "GLIS17",       ext: 1655, orientation: "V" },
    { code: "SPQ-GL-10253", ext: 1654, orientation: "V" },
    { code: "SPQ-GL-10253", ext: 1955, orientation: "H" },
    { code: "SPQ-GL-20253", ext: 1665, orientation: "V" },
    { code: "AD55142",      ext: 562.7, orientation: "H" },
    { code: "GLIS16",       ext: 562.7, orientation: "H" },
  ],
  glass: [{ width: 524.7, height: 1527 }],
  gaskets: [{ code: "GKT-02", lengthMm: 12310.2 }],
  hardware: [
    { code: "GLIS-03", qty: 14 }, // 2 fixed panels × 7
    { code: "GLIS-09",   qty: 1 },  // 1 slider
    { code: "GLIS-13",  qty: 2 },
  ],
};

const JOB_SL_OXXO: ExpectedJob = {
  name: "Sliding OXXO 2600×1750 (formula-consistency; centre-meeting K=92)",
  designId: "bd0ad364-3313-442d-871f-db7fab0502c4",
  widthMm: 2600,
  heightMm: 1750,
  bars: [
    { code: "SPQ-GL-10252", ext: 2600, int: 2504, orientation: "H" },
    { code: "SPQ-GL-10252", ext: 1750, int: 1654, orientation: "V" },
    // OXXO panel width = (2600+92)/4 − 3 = 670 (K=92, patio.pdf F3 — the first
    // real centre-meeting document; was 666.75 under the old K=79).
    { code: "SPQ-GL-20252", ext: 670,  int: 500,  orientation: "H" },
    { code: "SPQ-GL-20252", ext: 1667, int: 1497, orientation: "V" },
    { code: "SPQ-1-51252", ext: 540,  int: 500,  orientation: "H" },
    { code: "SPQ-1-51252", ext: 1537, int: 1497, orientation: "V" },
    { code: "AO44X12", ext: 2534, int: 2534, orientation: "H" },
    { code: "AO44X12", ext: 1684, int: 1684, orientation: "V" },
    { code: "AU26X26", ext: 530,  int: 530,  orientation: "H" },
    { code: "AU26X26", ext: 1527, int: 1527, orientation: "V" },
  ],
  glass: [{ width: 530, height: 1527 }],
  gaskets: [{ code: "GKT-02", lengthMm: 16456 }],
  hardware: [
    { code: "GLIS-03", qty: 14 }, // 2 fixed panels × 7
    { code: "GLIS-09",   qty: 2 },  // 2 sliders
    { code: "GLIS-13",  qty: 4 },  // 2 per slider
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

/** Same 1-dp rounding the engine's own cut lengths use (bars.ts#round1). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

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
// panelExtᵢ = fᵢ·(W+10) − 3, whose widths still sum to the equal-case total.
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
  expect("equal: every panel 752", eq.every((w) => approxEq(w, 752)), true);

  // (b) drag boundary b1 → 0.40: panel1 = 0.40·1510−3 = 601, panel2 = 903.
  const dragged = sashHorWidths(solve({ ...base, splitRatios: { "root.b1": 0.4 } }));
  expect("dragged: panel 601 present", dragged.some((w) => approxEq(w, 601)), true);
  expect("dragged: panel 903 present", dragged.some((w) => approxEq(w, 903)), true);
  const distinct = Array.from(new Set(dragged.map((w) => Math.round(w * 10) / 10)));
  expect("dragged: spans sum to equal-case total 1504", distinct.reduce((a, b) => a + b, 0), 1504);
}

// ---------- Sliding panel envelope (the catalog seam) ----------------
// The two envelope deductions are CATALOG data on the sliding sash profile
// (SashSection.panelClearance), not engine constants, because the same physical
// profiles printed two different envelopes four weeks apart:
//   6 / 86 — patio_calibration.pdf (31 Jul 2026) + Jobs 44/48 (patio-docs/)
//   3 / 83 — patio.pdf (07 Aug 2026), the current production setting
// This proves (a) the seeded/migrated catalog carries 3/83, and (b) that ONE
// value is the whole difference: feeding the superseded 6/86 back through the
// pure solver reproduces the Andrei documents' printed panels exactly, so the
// older paperwork stays reproducible instead of merely being remembered.
// =====================================================================
// SLIDING PART NAMES — the owner's own English catalog is the source
//
// `SUNNY PLAST SLIDING SYSTEM.pdf` names every sliding profile and fitting,
// and the production documents use the SAME supplier codes, so the code is the
// join key. The 2026-08-04 field fix removed the Romanian names transcribed
// from Jobs 44/48 but invented descriptive English ones instead of using the
// catalog's, so patio paperwork printed "Aluminium Slide Track" where the
// owner's catalog says "Aluminium sliding rail".
//
// These assertions pin the names so a future catalog edit cannot drift back,
// and they record the three DELIBERATE deviations as intent rather than
// omission. Names are cosmetic to the cut math — nothing here asserts a
// length — but they are what the shop floor and the supplier order from.
// =====================================================================
function validateSlidingNames(): void {
  console.log("\n==================================================");
  console.log("Sliding part names — English catalog (matched by code)");
  console.log("==================================================");

  const system = getSystem("sunnyplast-70");
  if (!system) {
    console.log("  (skipped — sunnyplast-70 not seeded)");
    return;
  }

  // partKey -> the name printed in SUNNY PLAST SLIDING SYSTEM.pdf.
  const profiles: Array<[Record<string, { code: string; name: string }>, string, string, string]> = [
    [system.auxiliaries ?? {}, "aux-track-alu",         "AD16014",      "Aluminium Sliding Rail"],
    [system.auxiliaries ?? {}, "aux-cap-frame-alu",     "AD55142",      "Threshold Cover Trim"],
    [system.auxiliaries ?? {}, "aux-cap-frame-slide",   "SPQ-GL-10253", "Sliding Frame Cover"],
    [system.auxiliaries ?? {}, "aux-cap-sash-pvc",      "SPQ-GL-20253", "U-PVC Interlock & Sash Cover"],
    [system.auxiliaries ?? {}, "aux-3-4-panel-adapter", "AD55144",      "3 & 4 Panel Adapter"],
    [system.reinforcement ?? {}, "reinf-44x12",         "AO44X12",      "Reinforcement 44x12x44x12"],
  ];
  for (const [rec, key, code, name] of profiles) {
    expect(`${key} code ${code}`, rec[key]?.code ?? "(missing)", code);
    expect(`${key} name = catalog "${name}"`, rec[key]?.name ?? "(missing)", name);
  }

  const hw: Array<[string, string, string]> = [
    ["hw-patio-handle-white",  "GLIS-09", "Patio Handle Set"],
    ["hw-patio-lock-keep",     "GLIS-10", "Patio Door Lock & Keep Set"],
    ["hw-patio-roller",        "GLIS-13", "Sliding Rolls"],
    ["hw-panel-stopper",       "GLIS-04", "Bump Stop"],
    ["hw-fixed-panel-support", "GLIS-03", "Fixed Panel Support Spacer"],
    ["hw-brush-top",           "GLIS-01", "Top Brush Block"],
    ["hw-brush-bottom",        "GLIS-02", "Bottom Brush Block"],
  ];
  for (const [key, code, name] of hw) {
    expect(`${key} code ${code}`, system.hardware[key]?.code ?? "(missing)", code);
    expect(`${key} name = catalog "${name}"`, system.hardware[key]?.name ?? "(missing)", name);
  }

  // ---- the three deliberate deviations, asserted so they stay deliberate ----
  // GLIS16/GLIS17 are absent from the English catalog (it lists no GLIS 16/17),
  // so there is nothing to match them against.
  expect("GLIS16 keeps its descriptive name (not in the catalog)",
    system.auxiliaries?.["aux-cap-fixed-panel"]?.name ?? "", "Fixed Panel Cap");
  expect("GLIS17 keeps its descriptive name (not in the catalog)",
    system.auxiliaries?.["aux-cap-frame-channel"]?.name ?? "", "Frame Channel Cap");
  // The catalog's second reinforcement reads "Reinforcement 27x25x27" and
  // prints NO code, while this code and the calibrated section both say 26x26.
  expect("AU26X26 keeps its code-accurate name (catalog prints no code)",
    system.reinforcement?.["reinf-25x27-u"]?.name ?? "", "26 x 26 U Steel Reinforcement");
  // One supplier code, two catalog rows — the qualifiers keep them apart in
  // Admin > Catalog (cf. frame-french vs frame-6ch).
  expect("bead-28 name", system.beads["bead-28"]?.name ?? "", "Bead 28mm");
  expect("bead-sl-24 name", system.beads["bead-sl-24"]?.name ?? "", "Bead 24mm Glazing");
  expect("the two beads share one supplier code",
    system.beads["bead-28"]?.code === system.beads["bead-sl-24"]?.code, true);
  expect("...but are distinguishable by name",
    system.beads["bead-28"]?.name !== system.beads["bead-sl-24"]?.name, true);

  // The 3 & 4 panel adapter is INERT: priced and orderable, but no cut rule
  // emits it, because its printed lengths fit no rule (questions.md Q27).
  const oxo = getDesign("8a1b8a80-e31a-4f0b-aa62-2771e04ec985"); // OXO Slide Left (3-panel)
  if (oxo) {
    const q = solve({
      orderNo: "AD55144-inert-check", customer: "validation",
      systemId: "sunnyplast-70", designId: oxo.designId, widthMm: 3000, heightMm: 2000,
    });
    expect("AD55144 emits no cut row (inert — Q27)",
      q.parts.bars.some((b) => b.code === "AD55144"), false);
  }
}

function validateSlidingPanelEnvelope(): void {
  console.log("\n==================================================");
  console.log("Sliding patio — panel envelope is catalog data");
  console.log("==================================================");

  const OX = "fbf4592c-ee97-4ac9-ba96-862370213bff"; // Job 44/48's XO design
  const design = getDesign(OX);
  const system = getSystem("sunnyplast-70");
  if (!design || !system) {
    console.log("  (skipped — the sliding designs are not seeded)");
    return;
  }

  const env = system.sashes["sash-sliding"]?.panelClearance;
  expect("catalog carries the panel envelope on sash-sliding", Boolean(env), true);
  expect("catalog width clearance = 3 (patio.pdf)", env?.widthMm ?? -1, 3);
  expect("catalog height deduction = 83 (patio.pdf)", env?.heightMm ?? -1, 83);

  // A panel's Ext rect, straight off the pure solver (Job 44's 1900×2100).
  const panelRect = (sys: typeof system) => {
    const geom = solveTopology(design, 1900, 2100, sys);
    return geom.cells.find((c) => c.content.startsWith("sliding"))?.sashOuter;
  };

  const now = panelRect(system);
  expect("07 Aug envelope: panel 952 wide", round1(now?.w ?? -1), 952);
  expect("07 Aug envelope: panel 2017 high", round1(now?.h ?? -1), 2017);

  // Clone the system with the SUPERSEDED envelope — nothing else changes.
  const legacy = {
    ...system,
    sashes: {
      ...system.sashes,
      "sash-sliding": {
        ...system.sashes["sash-sliding"],
        panelClearance: { widthMm: 6, heightMm: 86 },
      },
    },
  };
  const before = panelRect(legacy);
  expect("6/86 reproduces Job 44's printed panel width (949)", round1(before?.w ?? -1), 949);
  expect("6/86 reproduces Job 44's printed panel height (2014)", round1(before?.h ?? -1), 2014);
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
  // The doc prints 955/2020; under the 07 Aug panel envelope (3/83) the same
  // +3 mm/end rule prints 958/2023. The weld rule is what is asserted here.
  expect("sash welded 958 (printed)",  find("SPQ-GL-20252", 952)?.weldedExtMm ?? -1, 958);
  expect("sash welded 2023 (printed)", find("SPQ-GL-20252", 2017)?.weldedExtMm ?? -1, 2023);
  expect("bead prints unwelded (822)", find("SPQ-1-51252", 822)?.weldedExtMm ?? -1, 822);
  expect("aux prints unwelded (1805)", find("AD16014", 1805)?.weldedExtMm ?? -1, 1805);
  const steel = out.parts.reinforcement.find((b) => b.code === "AU26X26" && Math.abs(b.extMm - 1877) <= 0.6);
  expect("sash steel prints unwelded (1877)", steel?.weldedExtMm ?? -1, 1877);
}

// ---------- Welding-shrinkage check --------------------------------
// Proves weldedExtMm = extMm + weldAllowanceMm × weldedEndCount, that extMm is
// UNTOUCHED (so the geometry assertions above stay valid), and that the welded-end
// count is derived correctly per joint (frame corner=2, broken jamb=2, transom=2,
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

  // Broken jamb ("\ - Y]"): BOTH ends are welded — the mitred corner and the
  // Y-notch that welds onto the transom → 2 ends. extMm 400 → 400 + 2×2.5 = 405.
  //
  // RE-BASELINED 2026-07-30. This counted 1 end (402.5) on the assumption that a
  // Y-notch is a dry joint; Job 173 p4 prints 405 + 1575 for jamb pieces that
  // measure 400 + 1570 to the transom centreline, i.e. 5 mm on EACH piece. The
  // finished sizes (extMm) are untouched, so every geometry assertion above —
  // including Job 85's own 400/800 — is unaffected.
  const jambTop = job85.parts.bars.find(
    (b) => b.code === "SPQ-5-10252" && b.position === "Frame left top",
  );
  expect("broken-jamb weldedEndCount = 2", jambTop?.weldedEndCount ?? -1, 2);
  expect("broken-jamb extMm untouched = 400", jambTop?.extMm ?? -1, 400);
  expect("broken-jamb weldedExtMm = 405", jambTop?.weldedExtMm ?? -1, 405);

  // Z-transom (horns "< - >"): 2 welded ends; extMm 1206 → welded = 1211.
  const transom = job85.parts.bars.find((b) => b.code === "SPQ-005-30252");
  expect("transom weldedEndCount = 2", transom?.weldedEndCount ?? -1, 2);
  expect("transom weldedExtMm = 1211", transom?.weldedExtMm ?? -1, 1211);

  // Bead (square "[ - ]", allowance 0): no welds, welded == finished.
  const bead = job85.parts.bars.find((b) => b.code === "SPQ-1-51252");
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

// Elevation variants (Designer phase 5). Additive like the joint overlay: asking
// for them renders extra SVG and changes NOTHING else, and the schematic's
// annotations are the same numbers the cutting list prints (both read the solved
// rects — the schematic label rounds exactly as bars.ts#emitGlass does).
function validateViews(): void {
  console.log("\n==================================================");
  console.log("Elevation views — internal + schematic (additive)");
  console.log("==================================================");

  const baseInput = {
    orderNo: "TEST", customer: "Validation",
    designId: "win-th-over-fixed-z", widthMm: 1200, heightMm: 1200,
    systemId: "sunnyplast-70",
  } as const;

  const plain = solve({ ...baseInput });
  const withViews = solve({ ...baseInput, views: ["internal", "schematic"] });

  expect("default quote carries no extra views", plain.geometry.svgViews, undefined);
  expect("views do NOT change the external SVG", withViews.geometry.svg, plain.geometry.svg);
  expect("views do NOT change pricing", withViews.pricing.totals.grandTotal, plain.pricing.totals.grandTotal);
  expect("views do NOT change the cut list", JSON.stringify(withViews.parts), JSON.stringify(plain.parts));
  expect(
    "views do NOT change the documents",
    withViews.documents.cuttingList === plain.documents.cuttingList,
    true,
  );

  const internal = withViews.geometry.svgViews?.internal ?? "";
  const schematic = withViews.geometry.svgViews?.schematic ?? "";
  expect("internal is mirrored about the window width", internal.includes("matrix(-1 0 0 1 1200 0)"), true);
  expect("internal draws the sash handles", internal.includes('id="handles"'), true);
  expect("schematic carries the annotation layer", schematic.includes('id="schematic"'), true);

  // Every glass row the cutting list prints appears as a pane label, AS PRINTED.
  // Since 2026-08-04 both surfaces round a length to the whole millimetre
  // (documents.ts#mm and svg.ts#mmLabel apply the identical Math.round), so this
  // still proves the drawing and the cut list can never disagree — it just
  // compares the printed forms rather than the raw 0.1 mm engine values.
  const printed = (n: number) => String(Math.round(n));
  for (const g of plain.parts.glass) {
    const w = printed(g.widthMm);
    const h = printed(g.heightMm);
    expect(
      `schematic pane label ${w} × ${h} is drawn`,
      schematic.includes(`>${w} × ${h}</text>`),
      true,
    );
    expect(
      `work order glass row prints the same ${w} × ${h}`,
      plain.documents.workOrder.includes(`<td class="right">${w}</td>\n      <td class="right">${h}</td>`),
      true,
    );
  }
  // Divider face width comes from the solved transom rect (Z transom, face 67).
  const transomFace = plain.geometry.transoms[0]?.rect.h ?? 0;
  expect("schematic annotates the transom face width", schematic.includes(`>${transomFace}</text>`), true);
  expect("transom face is the catalog's 67", transomFace, 67);
}

// Job 154 — "Work Order - windows - 27-07-2026.pdf" (5 pages, all 705 × 705).
//
// A THIRD-PARTY production document, and the calibration source for a divider
// dropped INSIDE a sash. Every page prints ONE T Sash ring (2 × 633 hor +
// 2 × 633 vert) and ONE handle + ONE 400 mm espagnolette + ONE 16" friction
// stay — so a bar added to an opening sash must NOT split the frame into two
// sashes (two windows, doubled gear) NOR drop the opener. It welds inside the
// one ring as a midrail:
//
//   p1  Transom SPQ-005-30252  67mm  horizontal → 1 bar, 609, `<->`
//   p3  Midrail SPQ-5-30252    78mm  horizontal → 1 bar, 631, `<->`
//   p4  Midrail SPQ-5-30252    78mm  VERTICAL   → 1 bar, 631, `<->`
//   p5  no divider                              → plain sash, one 500×500 pane
//
// Each length is our OWN calibrated catalog reproducing the document: frame
// face 64 ⇒ daylight 577; sash overlap 28 ⇒ ring 633; sash-t face 79 ⇒ ring Int
// 475; midrail Ext = Int + 2 × face ⇒ 609 (67) and 631 (78). Nothing new was
// derived — the document independently confirms three calibrated values and the
// Job 00000264 horn rule, on two profiles and both axes.
//
// NOT asserted (open reconciliation, never silently adopted): the vendor's bead
// lengths (510 for a 475 pane, where our Quotila-calibrated rule gives Int + 40
// = 515) and glass sizes (500 × 500), and its sash steel at 470 where ours is
// the ring Int 475 (a 2.5 mm/end convention difference). Those follow a
// different bead/steel convention from the Quotila jobs the catalog is
// calibrated on; adopting them would silently re-calibrate the casement family.
// =====================================================================
// JOB 169 — "sunnyplast order test", 30-07-2026 (collections/doors/).
//
// A 5-page Work Order + its Cutting List and Glass Order, every page a
// 1000 × 2000 single door in Frame 6 Chamber (SPQ-6-11252) with a Door Sash Z
// leaf. Between them the pages exercise:
//   p1  a 25 mm add-on on the TOP edge    + a horizontal divider in the leaf
//   p2  the same add-on on the BOTTOM edge + a horizontal divider
//   p3  the same add-on on the LEFT edge   + a VERTICAL divider
//   p4  the same add-on on the RIGHT edge  + a horizontal divider
//   p5  no add-on                          + a VERTICAL divider
//
// TWO THINGS THIS DOCUMENT ESTABLISHES:
//
// 1. The ADD-ON RULE (Spec/questions.md Q6, previously ungated). Fitting the
//    25 mm SPQ-2-75252 to an edge shortens the frame by exactly 25 mm on the
//    PERPENDICULAR axis and leaves the parallel axis alone — the frame becomes
//    1000 × 1975 or 975 × 2000 while the unit still measures 1000 × 2000. Four
//    independent confirmations, one per edge. The Cutting List itemises NO row
//    for the add-on profile itself, so neither do we (questions.md Q21).
//
// 2. LENGTH-DEPENDENT REINFORCEMENT. The 78 mm divider carries its 26×26 U
//    steel at Int 1710 (p3, p5) and NONE at Int 685/710 (p1, p2, p4) — the
//    manual's ">1 m" rule for SPQ-5-30252 (HAWDIO p17/PDF 18), now evidenced by
//    a production document (questions.md Q23).
//
// EVERYTHING ELSE REPRODUCES FROM VALUES ALREADY CALIBRATED — this document
// validates the catalog rather than changing it: frame-6ch face 68 (Job 90),
// sash-door-z overlap 28 and face 105 (Job 90), midrail Ext = Int + 2 × face
// (Job 00000264), bead Ext = pane + 40 and glass = pane + 30 (Jobs 85/88/90),
// sash steel = ring Int (Job 90), and Settings.weldAllowanceMm 2.5 (every
// printed size is finished + 5).
//
// It also confirms, from a third party, the Job 154 midrail rule: all five
// pages carry ONE sash ring and ONE handle / lock / cylinder / 3 hinges,
// whichever divider button was pressed.
//
// The document's Gasket 01 / 02 metreage (11.26 m / 6.294 m on p1) was recorded
// here as an open reconciliation against our Jobs-85/88/90 rule. It is not one:
// the engine reproduces both figures exactly, and Jobs 172/173 confirm the rule
// on seven more items. Asserted on p1 below; questions.md Q24 closed 2026-07-30.
//
// The divider POSITIONS are read straight off each drawing: the dimension the
// page prints (375 on p1, 1100 on p4, "500 | 475" on p3, "500 | 500" on p5) is
// the divider's centreline measured from the FRAME edge, and dividing it by the
// frame dimension on that axis gives the fraction the engine takes. That the
// resulting panes, beads and glass then match the printed tables is the check.
function validateJob169(): void {
  console.log("\n==================================================");
  console.log("Job 169: 1000×2000 single door — add-ons on all four edges");
  console.log("==================================================");

  const base = getDesign("door-single-left");
  if (!base) {
    console.log("  (skipped — design door-single-left not seeded)");
    return;
  }
  const sys = getSystem("sunnyplast-70")!;
  if (sys.auxiliaries?.["aux-ext-25"]?.faceWidthMm !== 25) {
    console.log("  (skipped — aux-ext-25 has no 25 mm face; reseed the catalog)");
    return;
  }
  const FRAME = sys.frames["frame-6ch"].code;      // SPQ-6-11252
  const SASH = sys.sashes["sash-door-z"].code;     // SPQ-5-45252
  const DIVIDER = sys.transoms["mullion-78"].code; // SPQ-5-30252
  const SASH_STEEL = sys.reinforcement["reinf-28x44.5-u"].code;
  const DIV_STEEL = sys.reinforcement["reinf-26x26-u"].code;

  const W = 1000, H = 2000;
  const leafCell = (base.topology as { kind: "leaf"; cell: CellSpec }).cell;
  const run = (
    addons?: Record<string, string>,
    midrails?: { transomKey: string; atRatio: number; axis?: "horizontal" | "vertical" }[],
  ) =>
    solve({
      orderNo: "TEST", customer: "Validation", designId: "door-single-left",
      widthMm: W, heightMm: H, systemId: "sunnyplast-70",
      ...(addons ? { addons } : {}),
      ...(midrails
        ? { topologyOverride: { kind: "leaf" as const, cell: { ...leafCell, midrails } } }
        : {}),
    });

  /** Printed (saw) sizes for one profile code, deduped and sorted. */
  const printed = (out: ReturnType<typeof solve>, code: string, orient?: "H" | "V") =>
    [...new Set(
      out.parts.bars
        .filter((b) => b.code === code && (!orient || b.orientation === orient))
        .map((b) => round1(b.weldedExtMm)),
    )].sort((a, b) => a - b);

  const steelLengths = (out: ReturnType<typeof solve>, code: string) =>
    [...new Set(out.parts.reinforcement.filter((b) => b.code === code).map((b) => round1(b.extMm)))]
      .sort((a, b) => a - b);

  const glassRows = (out: ReturnType<typeof solve>) =>
    out.parts.glass
      .map((g) => `${g.widthMm}×${g.heightMm}`)
      .sort()
      .join(" ");

  // The reference fits exactly one of each on every page, whatever the divider.
  const hardwareCount = (out: ReturnType<typeof solve>, code: string) =>
    out.parts.hardware.filter((h) => h.code === code).reduce((n, h) => n + h.qty, 0);

  const assertOnePerPage = (page: string, out: ReturnType<typeof solve>) => {
    expect(`${page}: ONE sash ring (4 bars)`, out.parts.bars.filter((b) => b.code === SASH).length, 4);
    expect(`${page}: one handle`, hardwareCount(out, sys.hardware["hw-door-handle"].code), 1);
    expect(`${page}: one lock`, hardwareCount(out, sys.hardware["hw-door-lock"].code), 1);
    expect(`${page}: one cylinder`, hardwareCount(out, sys.hardware["hw-cylinder-brass"].code), 1);
    expect(`${page}: three hinges`, hardwareCount(out, sys.hardware["hw-flag-hinge-white"].code), 3);
  };

  // ---- p5: no add-on, vertical divider at the centre -------------------
  // Frame 1000 × 2000 ⇒ daylight 864 × 1864 ⇒ ring 920 × 1920 ⇒ Int 710 × 1710.
  // Drawing: "500 | 500" along the sill — the divider centreline at mid-frame.
  const p5 = run(undefined, [{ transomKey: "mullion-78", atRatio: 500 / 1000, axis: "vertical" }]);
  expect("p5: frame Hor printed 1005", printed(p5, FRAME, "H").join(), "1005");
  expect("p5: frame Vert printed 2005", printed(p5, FRAME, "V").join(), "2005");
  expect("p5: sash Hor printed 925", printed(p5, SASH, "H").join(), "925");
  expect("p5: sash Vert printed 1925", printed(p5, SASH, "V").join(), "1925");
  expect("p5: sash steel 710 / 1710", steelLengths(p5, SASH_STEEL).join(), "710,1710");
  const p5div = p5.parts.bars.find((b) => b.code === DIVIDER);
  expect("p5: vertical divider printed 1871", round1(p5div?.weldedExtMm ?? 0), 1871);
  expect("p5: divider Int 1710 = the ring Int", round1(p5div?.intMm ?? 0), 1710);
  expect("p5: horn-cut end prep", p5div?.endPrep, "< - >");
  expect("p5: printed as a VERT bar", p5div?.orientation, "V");
  expect("p5: the >1 m divider IS reinforced (26×26 U 1710)",
    steelLengths(p5, DIV_STEEL).join(), "1710");
  expect("p5: glass 346 × 1740, twice", glassRows(p5), "346×1740 346×1740");
  assertOnePerPage("p5", p5);
  const p5Preview = solve({
    orderNo: "TEST", customer: "Validation", designId: "door-single-left",
    widthMm: W, heightMm: H, systemId: "sunnyplast-70",
    topologyOverride: {
      kind: "leaf",
      cell: {
        ...leafCell,
        midrails: [{ transomKey: "mullion-78", atRatio: 500 / 1000, axis: "vertical" }],
      },
    },
    svgStyle: "realistic",
    views: ["internal"],
  });
  expect("p5 realistic: external renders the door hardware layer",
    p5Preview.geometry.svg.includes('id="door-hardware"'), true);
  expect("p5 realistic: open-in external hides the hinges",
    (p5Preview.geometry.svg.match(/class="door-hinge"/g) ?? []).length, 0);
  expect("p5 realistic: open-in internal shows three hinges and mirrors them",
    (p5Preview.geometry.svgViews?.internal ?? "").includes('id="door-hardware"') &&
      (p5Preview.geometry.svgViews?.internal ?? "").includes("matrix(-1 0 0 1 1000 0)") &&
      ((p5Preview.geometry.svgViews?.internal ?? "").match(/class="door-hinge"/g) ?? []).length === 3,
    true);
  expect("p5 realistic: preview style does not change the work order",
    p5Preview.documents.workOrder, p5.documents.workOrder);

  // ---- p1: add-on TOP — the frame loses 25 mm of HEIGHT ----------------
  // Frame 1000 × 1975 ⇒ daylight 864 × 1839 ⇒ ring 920 × 1895 ⇒ Int 710 × 1685.
  // Drawing: "375" top light over "1600" (375 + 1600 = 1975, the FRAME height).
  const p1 = run({ top: "aux-ext-25" }, [{ transomKey: "mullion-78", atRatio: 375 / 1975 }]);
  expect("p1: unit height is unchanged", p1.geometry.outer.h, 2000);
  expect("p1: the FRAME is 1975 high", round1(p1.geometry.frameRect?.h ?? 0), 1975);
  expect("p1: frame Hor printed 1005 (width untouched)", printed(p1, FRAME, "H").join(), "1005");
  expect("p1: frame Vert printed 1980 (2005 − 25)", printed(p1, FRAME, "V").join(), "1980");
  expect("p1: sash Hor printed 925", printed(p1, SASH, "H").join(), "925");
  expect("p1: sash Vert printed 1900", printed(p1, SASH, "V").join(), "1900");
  expect("p1: sash steel 710 / 1685", steelLengths(p1, SASH_STEEL).join(), "710,1685");
  const p1div = p1.parts.bars.find((b) => b.code === DIVIDER);
  expect("p1: horizontal divider printed 871", round1(p1div?.weldedExtMm ?? 0), 871);
  expect("p1: divider Int 710", round1(p1div?.intMm ?? 0), 710);
  expect("p1: printed as a HOR bar", p1div?.orientation, "H");
  expect("p1: the SHORT divider is NOT reinforced", steelLengths(p1, DIV_STEEL).length, 0);
  expect("p1: glass 740 × 221 and 740 × 1446", glassRows(p1), "740×1446 740×221");
  expect("p1: no cut row for the add-on profile",
    p1.parts.bars.filter((b) => b.code === "SPQ-2-75252").length, 0);
  // Our Jobs-85/88/90 gasket rule reproduces this page EXACTLY, which is what
  // closed questions.md Q24 — the recorded "conflict" came from comparing the
  // document against a solve that omitted the page's midrail.
  expect("p1: Gasket 01 = 11.260 m (the printed figure)",
    round1(p1.parts.gaskets.find((g) => g.code === "GKT-01")?.lengthMm ?? -1), 11260);
  expect("p1: Gasket 02 = 6.294 m (the printed figure)",
    round1(p1.parts.gaskets.find((g) => g.code === "GKT-02")?.lengthMm ?? -1), 6294);
  assertOnePerPage("p1", p1);

  // ---- p2: add-on BOTTOM — same frame, divider lower --------------------
  const p2 = run({ bottom: "aux-ext-25" }, [{ transomKey: "mullion-78", atRatio: 1000 / 1975 }]);
  expect("p2: bottom add-on gives the SAME frame as top",
    `${printed(p2, FRAME, "H").join()}|${printed(p2, FRAME, "V").join()}`, "1005|1980");
  expect("p2: sash printed 925 / 1900",
    `${printed(p2, SASH, "H").join()}|${printed(p2, SASH, "V").join()}`, "925|1900");
  expect("p2: glass 740 × 846 and 740 × 821", glassRows(p2), "740×821 740×846");
  assertOnePerPage("p2", p2);

  // ---- p3: add-on LEFT — the frame loses 25 mm of WIDTH -----------------
  // Frame 975 × 2000 ⇒ daylight 839 × 1864 ⇒ ring 895 × 1920 ⇒ Int 685 × 1710.
  // Drawing: "500 | 475" along the sill (500 + 475 = 975, the FRAME width).
  const p3 = run({ left: "aux-ext-25" }, [{ transomKey: "mullion-78", atRatio: 500 / 975, axis: "vertical" }]);
  expect("p3: unit width is unchanged", p3.geometry.outer.w, 1000);
  expect("p3: the FRAME is 975 wide", round1(p3.geometry.frameRect?.w ?? 0), 975);
  expect("p3: the frame is offset 25 mm from the left", round1(p3.geometry.frameRect?.x ?? -1), 25);
  expect("p3: frame Hor printed 980 (1005 − 25)", printed(p3, FRAME, "H").join(), "980");
  expect("p3: frame Vert printed 2005 (height untouched)", printed(p3, FRAME, "V").join(), "2005");
  expect("p3: sash Hor printed 900", printed(p3, SASH, "H").join(), "900");
  expect("p3: sash Vert printed 1925", printed(p3, SASH, "V").join(), "1925");
  expect("p3: sash steel 685 / 1710", steelLengths(p3, SASH_STEEL).join(), "685,1710");
  const p3div = p3.parts.bars.find((b) => b.code === DIVIDER);
  expect("p3: vertical divider printed 1871", round1(p3div?.weldedExtMm ?? 0), 1871);
  expect("p3: the >1 m divider IS reinforced (26×26 U 1710)",
    steelLengths(p3, DIV_STEEL).join(), "1710");
  expect("p3: glass 346 × 1740 and 321 × 1740", glassRows(p3), "321×1740 346×1740");
  assertOnePerPage("p3", p3);

  // ---- p4: add-on RIGHT — the SAME frame as left ------------------------
  // Drawing: "1100" over "900" (1100 + 900 = 2000, the FRAME height).
  const p4 = run({ right: "aux-ext-25" }, [{ transomKey: "mullion-78", atRatio: 1100 / 2000 }]);
  expect("p4: right add-on gives the SAME frame as left",
    `${printed(p4, FRAME, "H").join()}|${printed(p4, FRAME, "V").join()}`, "980|2005");
  expect("p4: the frame starts at x = 0", round1(p4.geometry.frameRect?.x ?? -1), 0);
  const p4div = p4.parts.bars.find((b) => b.code === DIVIDER);
  expect("p4: horizontal divider printed 846 (685 + 2×78 + 5)", round1(p4div?.weldedExtMm ?? 0), 846);
  expect("p4: divider Int 685", round1(p4div?.intMm ?? 0), 685);
  expect("p4: the SHORT divider is NOT reinforced", steelLengths(p4, DIV_STEEL).length, 0);
  expect("p4: glass 715 × 946 and 715 × 746", glassRows(p4), "715×746 715×946");
  const beads4 = [...new Set(
    p4.parts.bars.filter((b) => b.code === sys.beads["bead-28"].code).map((b) => round1(b.extMm)),
  )].sort((a, b) => a - b);
  expect("p4: beads 725 / 756 / 956", beads4.join(), "725,756,956");
  assertOnePerPage("p4", p4);

  // ---- the add-on is geometry only, on every edge -----------------------
  for (const side of ["top", "bottom", "left", "right"] as const) {
    const out = run({ [side]: "aux-ext-25" });
    expect(`add-on ${side}: still no cut row for SPQ-2-75252`,
      [...out.parts.bars, ...out.parts.reinforcement].filter((b) => b.code === "SPQ-2-75252").length, 0);
  }

  // ---- the schematic measures the FRAME, not the unit -------------------
  // An add-on must never be read as extra frame sightline: the annotated face
  // is the gap between the FRAME rect and the daylight, so it stays 68 (and the
  // door leaf 105) whether or not one is fitted.
  const faces = (out: ReturnType<typeof solve>) =>
    [...(out.geometry.svgViews?.schematic ?? "").matchAll(/>(\d+)</g)].map((m) => m[1]).join();
  const schemPlain = solve({
    orderNo: "TEST", customer: "Validation", designId: "door-single-left",
    widthMm: W, heightMm: H, systemId: "sunnyplast-70", views: ["schematic"],
  });
  const schemAddon = solve({
    orderNo: "TEST", customer: "Validation", designId: "door-single-left",
    widthMm: W, heightMm: H, systemId: "sunnyplast-70", views: ["schematic"],
    addons: { top: "aux-ext-25" },
  });
  expect("the schematic prints face widths at all", faces(schemPlain).length > 0, true);
  expect("the annotated frame face is unchanged by an add-on",
    faces(schemAddon), faces(schemPlain));

  // ---- and it is genuinely additive ------------------------------------
  const plain = run();
  expect("no add-on ⇒ no frameRect on the geometry", plain.geometry.frameRect, undefined);
  expect("no add-on ⇒ the frame fills the unit",
    `${printed(plain, FRAME, "H").join()}|${printed(plain, FRAME, "V").join()}`, "1005|2005");
}

// =====================================================================
// JOBS 172 + 173 — the CILL, the frame-level divider, and the packer count.
// Reference documents in `docs/correct/` (2026-07-30):
//   Work Order / Cutting List / Glass Order — "some doors testing", job 173
//   Work Order — "check door", job 172
//
// Seven 1000 × 2000 single-door items, every one with a 150 mm cill
// (GL-1-00150) and a 25 mm add-on on one edge, with the divider in a different
// place on each:
//
//   173 p1  add-on right   left hung    horizontal midrail IN the sash
//   173 p2  add-on bottom  right hung   vertical   midrail IN the sash
//   173 p3  add-on top     right hung   horizontal midrail IN the sash
//   173 p4  add-on left    left hung    transom in the FRAME + a midrail
//   173 p6  add-on top     left hung    vertical   midrail IN the sash
//   172 p1  add-on left    right hung   horizontal midrail IN the sash
//
// (173 p5 is the continuation page of p4, not a seventh item.)
//
// FOUR THINGS THIS PACKAGE ESTABLISHES — everything else reproduces from values
// already calibrated, so like Job 169 it mostly validates the catalog:
//
// 1. The CILL IS CUT TO THE UNIT WIDTH + 100 (50 mm of overhang each side).
//    All seven items print 1100 under a 1000 mm unit, unchanged by which edge
//    carries the add-on — so it overhangs the UNIT, not the reduced frame.
//
// 2. The CILL CARRIES A 35 × 15 STEEL at its own length (1100), printed both in
//    the cill row's Reinforcing column and as its own `Hor Cill` section row.
//    Previously the part existed but was mapped to nothing.
//
// 3. A FRAME-LEVEL TRANSOM BREAKS THE JAMBS whatever its joint type (p4:
//    405 + 1575 with `[Y - /` / `\ - Y]`), and is cut to the frame's full outer
//    span rather than the cell-to-cell horn rule (984 over a 975 mm frame).
//    Both are owner decisions where this package and Quotila disagree — see
//    Spec/questions.md Q25 and the re-baselined JOB_88 above.
//
// 4. GLAZING BRIDGE PACKERS = 5 per pane + 6 (16 for a 2-pane unit, 21 for the
//    3-pane p4). The base was a placeholder 3 with no source.
//
// The DOOR SASH is printed as "Door Sash T" (SPQ-5-47252) throughout, cut
// identically to our Z leaf — which is what promoted `profile.door-sash-profile`
// from an informational option to a real substitution. Asserted below on p1.
//
// Divider POSITIONS are read off each page the same way Job 169's are: the pane
// heights the beads and glass imply, converted to a centreline fraction of the
// frame. That the whole printed table then falls out is the check.
function validateJob173(): void {
  console.log("\n==================================================");
  console.log("Jobs 172/173: 1000×2000 single doors — cill, frame divider, packers");
  console.log("==================================================");

  const base = getDesign("door-single-left");
  const sys = getSystem("sunnyplast-70")!;
  if (!base || !sys.cills?.["cill-150-white"]) {
    console.log("  (skipped — door design or 150mm cill not seeded)");
    return;
  }
  const CILL = sys.cills["cill-150-white"].code;          // GL-1-00150
  const CILL_STEEL = sys.reinforcement["reinf-35x15"].code; // SPQ-2-83997
  if (sys.reinforcementMap[CILL] !== "reinf-35x15") {
    console.log("  (skipped — cills are not mapped to a reinforcement; reseed the catalog)");
    return;
  }
  const FRAME = sys.frames["frame-6ch"].code;
  const SASH = sys.sashes["sash-door-z"].code;
  const DIVIDER = sys.transoms["mullion-78"].code;
  const BEAD = sys.beads["bead-28"].code;
  const SASH_STEEL = sys.reinforcement["reinf-28x44.5-u"].code;
  const DIV_STEEL = sys.reinforcement["reinf-26x26-u"].code;

  const W = 1000, H = 2000;
  type Midrail = { transomKey: string; atRatio: number; axis?: "horizontal" | "vertical" };
  const leaf = (content: string, midrails?: Midrail[]) => ({
    kind: "leaf" as const,
    cell: {
      content: content as CellSpec["content"],
      sashKey: "sash-door-z",
      beadKey: "bead-28",
      ...(midrails ? { midrails } : {}),
    },
  });
  const run = (hand: "left" | "right", addons: Record<string, string>, topology: CellNode) =>
    solve({
      orderNo: "TEST", customer: "Validation",
      designId: `door-single-${hand}`,
      widthMm: W, heightMm: H, systemId: "sunnyplast-70",
      cillKey: "cill-150-white",
      addons,
      topologyOverride: topology,
    });

  /** Printed (saw) sizes for one profile code, deduped and sorted. */
  const printed = (out: ReturnType<typeof solve>, code: string, orient?: "H" | "V") =>
    [...new Set(
      out.parts.bars
        .filter((b) => b.code === code && (!orient || b.orientation === orient))
        .map((b) => round1(b.weldedExtMm)),
    )].sort((a, b) => a - b).join("/");
  const steel = (out: ReturnType<typeof solve>, code: string) =>
    [...new Set(out.parts.reinforcement.filter((b) => b.code === code).map((b) => round1(b.extMm)))]
      .sort((a, b) => a - b).join("/");
  const beads = (out: ReturnType<typeof solve>) =>
    [...new Set(out.parts.bars.filter((b) => b.code === BEAD).map((b) => round1(b.extMm)))]
      .sort((a, b) => a - b).join("/");
  const glassRows = (out: ReturnType<typeof solve>) =>
    out.parts.glass.map((g) => `${g.widthMm}×${g.heightMm}`).sort().join(" ");
  const gasket = (out: ReturnType<typeof solve>, code: string) =>
    round1(out.parts.gaskets.find((g) => g.code === code)?.lengthMm ?? -1);
  const hw = (out: ReturnType<typeof solve>, key: string) =>
    out.parts.hardware
      .filter((h) => h.code === sys.hardware[key].code)
      .reduce((n, h) => n + h.qty, 0);

  /** Every item prints the same cill row and the same door-set. */
  const assertCillAndSet = (page: string, out: ReturnType<typeof solve>, hand: "left" | "right") => {
    expect(`${page}: cill printed 1100 (unit width + 100)`, printed(out, CILL), "1100");
    const cillBar = out.parts.bars.find((b) => b.code === CILL);
    expect(`${page}: cill is square-cut`, cillBar?.endPrep, "[ - ]");
    expect(`${page}: cill row names its 35 × 15 steel`, cillBar?.reinforcementCode, CILL_STEEL);
    expect(`${page}: cill steel is 1100, the cill's own length`, steel(out, CILL_STEEL), "1100");
    expect(`${page}: ONE sash ring (4 bars)`, out.parts.bars.filter((b) => b.code === SASH).length, 4);
    expect(`${page}: one handle`, hw(out, "hw-door-handle"), 1);
    expect(`${page}: one lock`, hw(out, "hw-door-lock"), 1);
    expect(`${page}: one cylinder`, hw(out, "hw-cylinder-brass"), 1);
    expect(`${page}: three hinges`, hw(out, "hw-flag-hinge-white"), 3);
    expect(`${page}: one run-up block`, hw(out, "hw-runup-block"), 1);
    // The reference fits the keep set to the hinge side: "Door left hung" ⇒
    // L/H Keep Set (p1, p4, p6), "Door right hung" ⇒ R/H (p2, p3, 172).
    expect(`${page}: ${hand === "left" ? "L/H" : "R/H"} keep set`,
      `${hw(out, "hw-keep-lh")}${hw(out, "hw-keep-rh")}`, hand === "left" ? "10" : "01");
  };

  // ---- 173 p1: add-on RIGHT, left hung, horizontal midrail --------------
  // Cill −30 and add-on −25 ⇒ frame 975 × 1970 ⇒ daylight 839 × 1834 ⇒ ring
  // 895 × 1890 ⇒ Int 685 × 1680. Beads 1456/226 ⇒ panes 1416/186 (+78 = 1680),
  // so the midrail centreline sits 370 below the frame head.
  const p1 = run("left", { right: "aux-ext-25" }, leaf("door-left", [
    { transomKey: "mullion-78", atRatio: 370 / 1970 },
  ]));
  // The customer's height is preserved on the input and printed on the header;
  // it is the MANUFACTURING height (2000 − 30) that the geometry is built to.
  expect("p1: the customer height is unchanged", p1.input.heightMm, H);
  expect("p1: the cill takes 30 mm off the manufacturing height", p1.geometry.outer.h, 1970);
  expect("p1: …and the add-on takes 25 mm more off the width",
    round1(p1.geometry.frameRect?.w ?? 0), 975);
  expect("p1: frame Hor printed 980 (1005 − 25 add-on)", printed(p1, FRAME, "H"), "980");
  expect("p1: frame Vert printed 1975 (2005 − 30 cill)", printed(p1, FRAME, "V"), "1975");
  expect("p1: frame jambs are CONTINUOUS (no frame-level divider)",
    p1.parts.bars.filter((b) => b.code === FRAME && b.orientation === "V").length, 2);
  expect("p1: sash printed 900 / 1895", `${printed(p1, SASH, "H")}|${printed(p1, SASH, "V")}`, "900|1895");
  expect("p1: sash steel 685 / 1680", steel(p1, SASH_STEEL), "685/1680");
  const p1div = p1.parts.bars.find((b) => b.code === DIVIDER);
  expect("p1: midrail printed 846 (685 + 2×78 + 5)", round1(p1div?.weldedExtMm ?? 0), 846);
  expect("p1: midrail Int 685 = the ring Int", round1(p1div?.intMm ?? 0), 685);
  expect("p1: the SHORT midrail is NOT reinforced", steel(p1, DIV_STEEL), "");
  expect("p1: beads 226 / 725 / 1456", beads(p1), "226/725/1456");
  expect("p1: glass 715 × 216 and 715 × 1446", glassRows(p1), "715×1446 715×216");
  expect("p1: Gasket 01 = 11.140 m", gasket(p1, "GKT-01"), 11140);
  expect("p1: Gasket 02 = 6.184 m", gasket(p1, "GKT-02"), 6184);
  expect("p1: 16 glazing bridge packers (2 panes)", hw(p1, "hw-glazing-bridge-pack"), 16);
  expect("p1: no cut row for the add-on profile",
    p1.parts.bars.filter((b) => b.code === "SPQ-2-75252").length, 0);
  assertCillAndSet("p1", p1, "left");

  // The reference cuts the leaf as "Door Sash T" (SPQ-5-47252). It is the SAME
  // cut as our Z leaf on every printed row — which is what makes the sash a
  // legitimate 1:1 substitution slot rather than a re-calibration.
  const p1t = run("left", { right: "aux-ext-25" }, {
    kind: "leaf",
    cell: { content: "door-left" as CellSpec["content"], sashKey: "sash-door-t", beadKey: "bead-28",
            midrails: [{ transomKey: "mullion-78", atRatio: 370 / 1970 }] },
  });
  const T_SASH = sys.sashes["sash-door-t"].code;   // SPQ-5-47252
  expect("p1: the T leaf is named Door Sash T",
    p1t.parts.bars.find((b) => b.code === T_SASH)?.name, "Door Sash T");
  expect("p1: the T leaf cuts IDENTICALLY to the Z leaf",
    `${printed(p1t, T_SASH, "H")}|${printed(p1t, T_SASH, "V")}`, "900|1895");
  expect("p1: …and takes the same 28 × 44.5 steel", steel(p1t, SASH_STEEL), "685/1680");
  expect("p1: …and moves no other dimension", glassRows(p1t), glassRows(p1));

  // ---- 173 p2: add-on BOTTOM, right hung, VERTICAL midrail ---------------
  // Frame 1000 × 1945 ⇒ daylight 864 × 1809 ⇒ ring 920 × 1865 ⇒ Int 710 × 1655.
  // Beads 356 ⇒ panes 316 + 316 (+78 = 710): the midrail is centred on the frame.
  const p2 = run("right", { bottom: "aux-ext-25" }, leaf("door-right", [
    { transomKey: "mullion-78", atRatio: 500 / 1000, axis: "vertical" },
  ]));
  expect("p2: frame printed 1005 / 1950 (cill + bottom add-on)",
    `${printed(p2, FRAME, "H")}|${printed(p2, FRAME, "V")}`, "1005|1950");
  expect("p2: sash printed 925 / 1870", `${printed(p2, SASH, "H")}|${printed(p2, SASH, "V")}`, "925|1870");
  expect("p2: sash steel 710 / 1655", steel(p2, SASH_STEEL), "710/1655");
  const p2div = p2.parts.bars.find((b) => b.code === DIVIDER);
  expect("p2: vertical midrail printed 1816 (1655 + 2×78 + 5)", round1(p2div?.weldedExtMm ?? 0), 1816);
  expect("p2: printed as a VERT bar", p2div?.orientation, "V");
  expect("p2: the >1 m midrail IS reinforced (26 × 26 U 1655)", steel(p2, DIV_STEEL), "1655");
  expect("p2: beads 356 / 1695", beads(p2), "356/1695");
  expect("p2: glass 346 × 1685, twice", glassRows(p2), "346×1685 346×1685");
  expect("p2: Gasket 01 / 02 = 11.140 / 8.124 m",
    `${gasket(p2, "GKT-01")}|${gasket(p2, "GKT-02")}`, "11140|8124");
  expect("p2: 16 glazing bridge packers", hw(p2, "hw-glazing-bridge-pack"), 16);
  assertCillAndSet("p2", p2, "right");

  // ---- 173 p3: add-on TOP, right hung, horizontal midrail -----------------
  // Same frame as p2 but offset 25 mm down. Beads 956/701 ⇒ panes 916/661
  // (+78 = 1655) ⇒ the midrail centreline 1100 below the FRAME head.
  const p3 = run("right", { top: "aux-ext-25" }, leaf("door-right", [
    { transomKey: "mullion-78", atRatio: 1100 / 1945 },
  ]));
  expect("p3: top add-on gives the SAME frame as bottom",
    `${printed(p3, FRAME, "H")}|${printed(p3, FRAME, "V")}`, "1005|1950");
  expect("p3: the frame is offset 25 mm from the top", round1(p3.geometry.frameRect?.y ?? -1), 25);
  expect("p3: sash printed 925 / 1870", `${printed(p3, SASH, "H")}|${printed(p3, SASH, "V")}`, "925|1870");
  const p3div = p3.parts.bars.find((b) => b.code === DIVIDER);
  expect("p3: midrail printed 871 (710 + 2×78 + 5)", round1(p3div?.weldedExtMm ?? 0), 871);
  expect("p3: beads 701 / 750 / 956", beads(p3), "701/750/956");
  expect("p3: glass 740 × 946 and 740 × 691", glassRows(p3), "740×691 740×946");
  expect("p3: Gasket 01 / 02 = 11.140 / 6.234 m",
    `${gasket(p3, "GKT-01")}|${gasket(p3, "GKT-02")}`, "11140|6234");
  assertCillAndSet("p3", p3, "right");

  // ---- 173 p4: add-on LEFT, a transom in the FRAME + a midrail ------------
  // THE page this whole exercise turns on. Frame 975 × 1970 ⇒ daylight
  // 839 × 1834. The top light is 293 high and the leaf daylight 1463, so the
  // 78 mm transom is centred 400 below the frame head — and the jambs break
  // there into 400 + 1570 (printed 405 + 1575).
  const p4 = run("left", { left: "aux-ext-25" }, {
    kind: "hsplit",
    splitAtRatio: 400 / 1970,
    transomKey: "mullion-78",
    top: { kind: "leaf", cell: { content: "fixed" as CellSpec["content"], beadKey: "bead-28" } },
    bottom: leaf("door-left", [{ transomKey: "mullion-78", atRatio: 1271 / 1970 }]),
  });
  expect("p4: frame Hor printed 980", printed(p4, FRAME, "H"), "980");
  expect("p4: the jambs are BROKEN into 405 + 1575, twice",
    printed(p4, FRAME, "V"), "405/1575");
  expect("p4: four jamb pieces, not two",
    p4.parts.bars.filter((b) => b.code === FRAME && b.orientation === "V").length, 4);
  const p4top = p4.parts.bars.find((b) => b.position === "Frame left top");
  const p4bot = p4.parts.bars.find((b) => b.position === "Frame left bottom");
  expect("p4: the upper jamb piece is mitred then Y-notched", p4top?.endPrep, "\\ - Y]");
  expect("p4: the lower jamb piece is Y-notched then mitred", p4bot?.endPrep, "[Y - /");
  expect("p4: a Y-notch is a WELDED end — both pieces gain 5 mm",
    `${round1(p4top?.weldedExtMm ?? 0)}/${round1(p4bot?.weldedExtMm ?? 0)}`, "405/1575");
  expect("p4: the two pieces sum to the frame height", round1((p4top?.extMm ?? 0) + (p4bot?.extMm ?? 0)), 1970);
  const p4frameDiv = p4.parts.bars.find((b) => b.position === "Transom (root)");
  expect("p4: the FRAME transom is printed 984 (975 frame span + 2 × 4.5)",
    round1(p4frameDiv?.weldedExtMm ?? 0), 984);
  expect("p4: …cut to the frame's full outer span, not Int + 2 × face",
    round1(p4frameDiv?.extMm ?? 0), 975);
  expect("p4: …with Int still the daylight it spans", round1(p4frameDiv?.intMm ?? 0), 839);
  const p4mid = p4.parts.bars.find((b) => b.position === "Transom (root.bottom)");
  expect("p4: the midrail inside the leaf is unaffected — 846",
    round1(p4mid?.weldedExtMm ?? 0), 846);
  expect("p4: sash printed 900 / 1524", `${printed(p4, SASH, "H")}|${printed(p4, SASH, "V")}`, "900|1524");
  expect("p4: sash steel 685 / 1309", steel(p4, SASH_STEEL), "685/1309");
  expect("p4: beads 333 / 555 / 725 / 756 / 879", beads(p4), "333/555/725/756/879");
  expect("p4: glass 869 × 323, 715 × 545 and 715 × 746",
    glassRows(p4), "715×545 715×746 869×323");
  expect("p4: Gasket 01 / 02 = 9.656 / 7.826 m",
    `${gasket(p4, "GKT-01")}|${gasket(p4, "GKT-02")}`, "9656|7826");
  expect("p4: 21 glazing bridge packers (3 panes)", hw(p4, "hw-glazing-bridge-pack"), 21);
  expect("p4: still ONE sash ring, ONE handle — the frame split did not clone the leaf",
    `${p4.parts.bars.filter((b) => b.code === SASH).length}/${hw(p4, "hw-door-handle")}`, "4/1");
  assertCillAndSet("p4", p4, "left");

  // ---- 173 p6: add-on TOP, left hung, VERTICAL midrail --------------------
  // Geometrically p2's twin on the other hand — the check is that the keep set
  // follows the leaf and nothing else moves.
  const p6 = run("left", { top: "aux-ext-25" }, leaf("door-left", [
    { transomKey: "mullion-78", atRatio: 500 / 1000, axis: "vertical" },
  ]));
  expect("p6: frame printed 1005 / 1950",
    `${printed(p6, FRAME, "H")}|${printed(p6, FRAME, "V")}`, "1005|1950");
  expect("p6: vertical midrail printed 1816 + its 1655 steel",
    `${printed(p6, DIVIDER)}|${steel(p6, DIV_STEEL)}`, "1816|1655");
  expect("p6: glass 346 × 1685, twice", glassRows(p6), "346×1685 346×1685");
  assertCillAndSet("p6", p6, "left");

  // ---- 172 p1: add-on LEFT, right hung, horizontal midrail ----------------
  // Frame 975 × 1970 like 173 p1, midrail lower: beads 856/826 ⇒ panes 816/786
  // (+78 = 1680) ⇒ centreline 1000 below the frame head.
  const j172 = run("right", { left: "aux-ext-25" }, leaf("door-right", [
    { transomKey: "mullion-78", atRatio: 1000 / 1970 },
  ]));
  expect("172: frame printed 980 / 1975",
    `${printed(j172, FRAME, "H")}|${printed(j172, FRAME, "V")}`, "980|1975");
  expect("172: sash printed 900 / 1895",
    `${printed(j172, SASH, "H")}|${printed(j172, SASH, "V")}`, "900|1895");
  expect("172: sash steel 685 / 1680", steel(j172, SASH_STEEL), "685/1680");
  expect("172: midrail printed 846", printed(j172, DIVIDER), "846");
  expect("172: beads 725 / 826 / 856", beads(j172), "725/826/856");
  expect("172: glass 715 × 846 and 715 × 816", glassRows(j172), "715×816 715×846");
  expect("172: Gasket 01 / 02 = 11.140 / 6.184 m",
    `${gasket(j172, "GKT-01")}|${gasket(j172, "GKT-02")}`, "11140|6184");
  assertCillAndSet("172", j172, "right");

  // ---- the cill stays additive ------------------------------------------
  // No cill ⇒ no 30 mm deduction, no cill bar and no cill steel, which is what
  // keeps every pre-cill job (85/88/90, French, sliding, 169) byte-identical.
  const noCill = solve({
    orderNo: "TEST", customer: "Validation", designId: "door-single-left",
    widthMm: W, heightMm: H, systemId: "sunnyplast-70",
  });
  expect("no cill ⇒ the frame keeps the full height", printed(noCill, FRAME, "V"), "2005");
  expect("no cill ⇒ no cill bar", noCill.parts.bars.filter((b) => b.code === CILL).length, 0);
  expect("no cill ⇒ no cill steel", steel(noCill, CILL_STEEL), "");
}

// =====================================================================
// PER-EDGE FRAME PROFILES + PER-DIVIDER JOINT METHOD (doors phase 2).
//
// The reference offers `Frame (Standard) (Top|Bottom|Left|Right)` as four
// independent dropdowns — Job 169 prints all four in Main Options — and a
// `Joint (Structural T/Z)` of Welded or Mechanical per divider.
//
// On this system the two frames genuinely differ (frame-5ch face 64, frame-6ch
// face 68), so a mixed selection changes the cut. Each bar's Int loses the face
// of the profile at each of its two ends, which are the PERPENDICULAR edges.
//
// "Mechanical" is offered because the reference offers it, but NO production
// document gives its deduction, so the bar is cut as welded and the resolver
// warns (Spec/questions.md Q22). Asserted here: the cut really is unchanged.
function validatePerEdgeFrames(): void {
  console.log("\n==================================================");
  console.log("Per-edge frame profiles + joint method (doors phase 2)");
  console.log("==================================================");

  const base = getDesign("win-th");
  if (!base) {
    console.log("  (skipped — design win-th not seeded)");
    return;
  }
  const sys = getSystem("sunnyplast-70")!;
  const F5 = sys.frames["frame-5ch"];   // face 64
  const F6 = sys.frames["frame-6ch"];   // face 68
  expect("the two frames differ, so a mix is meaningful", F5.faceWidth !== F6.faceWidth, true);

  const W = 1200, H = 1200;
  const run = (frameKeys?: Record<string, string>) =>
    solve({
      orderNo: "TEST", customer: "Validation", designId: "win-th",
      widthMm: W, heightMm: H, systemId: "sunnyplast-70",
      ...(frameKeys ? { frameKeys } : {}),
    });

  // ---- byte-identity: all four edges the same == naming none ----------
  const plain = run();
  const allFive = run({ top: "frame-5ch", bottom: "frame-5ch", left: "frame-5ch", right: "frame-5ch" });
  expect("naming the design's own frame on all four edges changes nothing",
    JSON.stringify(allFive.parts), JSON.stringify(plain.parts));
  expect("…and neither does the geometry",
    JSON.stringify(allFive.geometry.cells), JSON.stringify(plain.geometry.cells));

  // ---- a single edge moves ONLY its own side -------------------------
  // frame-6ch on the LEFT: the daylight starts 4 mm further in, so the head and
  // sill lose 4 mm of Int; the jambs (whose ends are top/bottom) are untouched.
  const mixed = run({ left: "frame-6ch" });
  const bar = (out: ReturnType<typeof solve>, pos: string) =>
    out.parts.bars.find((b) => b.position === pos);
  expect("the head keeps its full Ext", bar(mixed, "Frame top")?.extMm, bar(plain, "Frame top")?.extMm);
  expect("the head Int loses exactly the 4 mm face difference",
    round1((bar(plain, "Frame top")!.intMm) - (bar(mixed, "Frame top")!.intMm)), 4);
  expect("the jambs are untouched (their ends are the head and sill)",
    bar(mixed, "Frame left")?.intMm, bar(plain, "Frame left")?.intMm);
  expect("the LEFT jamb is now the 6-chamber profile", bar(mixed, "Frame left")?.code, F6.code);
  expect("the RIGHT jamb is still the design's own", bar(mixed, "Frame right")?.code, F5.code);
  expect("the daylight moves in by 4 mm on the left only",
    round1(mixed.geometry.cells[0].daylight!.x - plain.geometry.cells[0].daylight!.x), 4);
  expect("and the daylight narrows by the same 4 mm",
    round1(plain.geometry.cells[0].daylight!.w - mixed.geometry.cells[0].daylight!.w), 4);

  // ---- an unknown frame is a loud error, never a silent fallback ------
  let threw = false;
  try {
    run({ left: "no-such-frame" });
  } catch {
    threw = true;
  }
  expect("an unknown per-edge frame throws", threw, true);

  // ---- joint method: recorded, printed, NOT re-cut --------------------
  const root = base.topology;
  if (root.kind !== "hsplit") {
    console.log("  (joint-method checks skipped — win-th is not a split design)");
    return;
  }
  const welded = solve({
    orderNo: "TEST", customer: "Validation", designId: "win-th",
    widthMm: W, heightMm: H, systemId: "sunnyplast-70",
    topologyOverride: { ...root, jointMethod: "welded" as const },
  });
  const mechanical = solve({
    orderNo: "TEST", customer: "Validation", designId: "win-th",
    widthMm: W, heightMm: H, systemId: "sunnyplast-70",
    topologyOverride: { ...root, jointMethod: "mechanical" as const },
  });
  expect("welded is the default — naming it changes nothing",
    JSON.stringify(welded.parts), JSON.stringify(plain.parts));
  expect("mechanical does NOT invent a different cut (questions.md Q22)",
    JSON.stringify(mechanical.parts), JSON.stringify(plain.parts));
  expect("but it IS recorded on the solved divider",
    mechanical.geometry.transoms[0]?.jointMethod, "mechanical");
  expect("and welded records nothing (absent ⇒ welded ⇒ byte-identical)",
    welded.geometry.transoms[0]?.jointMethod, undefined);
}

function validateJob154(): void {
  console.log("\n==================================================");
  console.log("Job 154: 705×705 casement — a midrail inside the sash");
  console.log("==================================================");

  const base = getDesign("win-th");
  if (!base) {
    console.log("  (skipped — design win-th not seeded)");
    return;
  }
  const W = 705, H = 705;
  const run = (midrails?: { transomKey: string; atRatio: number; axis?: "horizontal" | "vertical" }[]) =>
    solve({
      orderNo: "TEST", customer: "Validation", designId: "win-th",
      widthMm: W, heightMm: H, systemId: "sunnyplast-70",
      ...(midrails
        ? { topologyOverride: { kind: "leaf" as const, cell: { ...(base.topology as { kind: "leaf"; cell: CellSpec }).cell, midrails } } }
        : {}),
    });

  // ---- p5: the plain sash the other pages build on --------------------
  const plain = run();
  const sashCode = getSystem("sunnyplast-70")!.sashes["sash-t"].code;
  const ring = plain.parts.bars.filter((b) => b.code === sashCode);
  expect("p5: one welded sash ring — 4 bars", ring.length, 4);
  expect("p5: ring Ext 633 (daylight 577 + 2×28 overlap)",
    ring.every((b) => approxEq(b.extMm, 633)), true);
  expect("p5: ring Int 475 (633 − 2×79 sash face)",
    ring.every((b) => approxEq(b.intMm, 475)), true);
  expect("p5: frame 4 × 705",
    plain.parts.bars.filter((b) => b.code === "SPQ-5-10252" && approxEq(b.extMm, 705)).length, 4);
  expect("p5: one glazed pane", plain.parts.glass.length, 1);

  // ---- p1: 67 mm bar across the sash ⇒ 609 ----------------------------
  const p1 = run([{ transomKey: "midrail-67", atRatio: 0.5 }]);
  const bar67 = p1.parts.bars.find((b) => b.code === "SPQ-005-30252");
  expect("p1: the 67mm midrail is cut", Boolean(bar67), true);
  expect("p1: Ext 609 = 475 + 2×67", bar67?.extMm, 609);
  expect("p1: Int 475 = the sash ring Int", bar67?.intMm, 475);
  expect("p1: horn-cut end prep", bar67?.endPrep, "< - >");
  expect("p1: printed as a HOR bar", bar67?.orientation, "H");
  expect("p1: the sash ring is untouched",
    JSON.stringify(p1.parts.bars.filter((b) => b.code === sashCode)), JSON.stringify(ring));
  expect("p1: the glazing splits into two panes", p1.parts.glass.length, 2);

  // ---- p3/p4: 78 mm bar, both axes ⇒ 631 each -------------------------
  const p3 = run([{ transomKey: "mullion-78", atRatio: 0.5 }]);
  const bar78h = p3.parts.bars.find((b) => b.code === "SPQ-5-30252");
  expect("p3: Ext 631 = 475 + 2×78", bar78h?.extMm, 631);
  expect("p3: printed as a HOR bar", bar78h?.orientation, "H");

  const p4 = run([{ transomKey: "mullion-78", atRatio: 0.5, axis: "vertical" }]);
  const bar78v = p4.parts.bars.find((b) => b.code === "SPQ-5-30252");
  expect("p4: the SAME 631 on the vertical axis", bar78v?.extMm, 631);
  expect("p4: printed as a VERT bar", bar78v?.orientation, "V");
  expect("p4: horn-cut end prep", bar78v?.endPrep, "< - >");
  expect("p4: two panes side by side", p4.parts.glass.length, 2);
  // p3's panes are 510 w × 236 h; p4's are the transpose. Our own numbers
  // differ from the vendor's bead convention, but the TRANSPOSE must hold.
  const [w3, h3] = [p3.parts.glass[0].widthMm, p3.parts.glass[0].heightMm];
  const [w4, h4] = [p4.parts.glass[0].widthMm, p4.parts.glass[0].heightMm];
  expect("p3 vs p4: the pane is the exact transpose", `${w3}x${h3}`, `${h4}x${w4}`);

  // ---- the whole point: ONE opener, on every page ---------------------
  for (const [label, out] of [["p1", p1], ["p3", p3], ["p4", p4]] as const) {
    const hw = (code: string) => out.parts.hardware.find((h) => h.code === code)?.qty ?? 0;
    expect(`${label}: exactly ONE handle`, hw("HDL-INLINE"), 1);
    expect(`${label}: exactly ONE espagnolette`,
      out.parts.hardware.filter((h) => h.code.startsWith("ESPAG-")).reduce((s, h) => s + h.qty, 0), 1);
    expect(`${label}: exactly ONE friction stay`,
      out.parts.hardware.filter((h) => h.code.startsWith("FH-")).reduce((s, h) => s + h.qty, 0), 1);
    expect(`${label}: the opening chevron is still drawn`,
      (out.geometry.svg.match(/opening|polyline/g) ?? []).length > 0, true);
  }
  // One chevron, not one per pane — the leaf draws it, the panes do not.
  expect("p1: ONE opening symbol for the whole sash",
    (p1.geometry.svg.match(/<polyline/g) ?? []).length,
    (plain.geometry.svg.match(/<polyline/g) ?? []).length);
}

// The Work Order's advisory band (fabrication limits a job knowingly exceeds).
// Same additive discipline as DocBranding / DocBasket: supplying it prints a
// cited note, omitting it must leave the document byte-for-byte as it was.
function validateAdvisories(): void {
  console.log("\n==================================================");
  console.log("Work-order advisory band (additive)");
  console.log("==================================================");

  const input = {
    orderNo: "TEST", customer: "Validation",
    designId: "win-th-over-fixed-z", widthMm: 1200, heightMm: 1200,
    systemId: "sunnyplast-70",
  } as const;
  const out = solve({ ...input });
  const system = getSystem("sunnyplast-70")!;
  const design = getDesign("win-th-over-fixed-z")!;

  // Omitting the param must change nothing: the call with the argument absent
  // and the call with it explicitly undefined produce the same bytes, and
  // solve()'s own work order (which never passes advisories) carries no band.
  const plain = renderWorkOrder(input, system.name, design.name, out.parts);
  expect("advisory band: absent argument == explicit undefined",
    renderWorkOrder(input, system.name, design.name, out.parts, undefined, undefined, "normal", undefined, undefined, undefined),
    plain);
  expect("advisory band: solve()'s work order carries no band",
    out.documents.workOrder.includes("Check before fabrication"), false);

  const withNote = renderWorkOrder(input, system.name, design.name, out.parts, undefined, undefined,
    "normal", undefined, undefined,
    [{ item: "4050 × 1040 mm", message: "Overall width exceeds the 3000 mm maximum outer-frame width", source: "HAWDIO p70 (PDF 72)" }]);
  expect("advisory band prints the message",
    withNote.includes("Overall width exceeds the 3000 mm maximum outer-frame width"), true);
  expect("advisory band prints its citation", withNote.includes("HAWDIO p70 (PDF 72)"), true);
  expect("advisory band names the item", withNote.includes("4050 × 1040 mm"), true);
  expect("advisory band counts the breaches", withNote.includes("1 printed limit exceeded"), true);

  // An EMPTY list is the same as none — the caller passes `undefined` when
  // there is nothing to say, but a [] must not print an empty band either.
  expect("empty advisory list ⇒ byte-identical",
    renderWorkOrder(input, system.name, design.name, out.parts, undefined, undefined, "normal", undefined, undefined, []),
    plain);
}

// Load the catalog from PostgreSQL before solving, then run all jobs.
(async () => {
  await loadCatalog();

  [
    JOB_85, JOB_88, JOB_90,
    JOB_44_ANDREI, JOB_48_ANDREI,
    JOB_PATIO_F1, JOB_PATIO_F2, JOB_PATIO_F3, JOB_PATIO_F4,
    JOB_SL_OX, JOB_SL_OXO, JOB_SL_OXXO,
    JOB_264_T, JOB_264_MIDRAIL, JOB_264_UNEQUAL,
  ].forEach(validate);
  validateSlidingSpans();
  validateSlidingNames();
  validateSlidingPanelEnvelope();
  validateSlidingWeld();
  validateFrenchDoor();
  validateCustomMode();
  validateWeldMath();
  validateColourAndJoints();
  validateViews();
  validateJob154();
  validateJob169();
  validateJob173();
  validatePerEdgeFrames();
  validateAdvisories();
  validateExtractor(expect);
  validatePricing(expect);
  validateSvg(expect);
  validateLimits(expect);
  validateEdTable(expect);
  validateGlyphs(expect);
  validateGlyphs(expect);
  validateRules(expect);
  validateOptionSystem(expect);
  validateDesigner(expect);
  validateBasket(expect);
  validateSupplierPrices(expect);

  console.log("\n==================================================");
  console.log(`RESULTS:  ${passCount} passed,  ${failCount} failed`);
  console.log("==================================================");
  process.exit(failCount === 0 ? 0 : 1);
})();
