// =====================================================================
// catalog/system-sunnyplast.ts
//
// THE SUNNY PLAST 70mm SYSTEM CATALOG
//
// Every number in here is calibrated from the real Quotila outputs in
// Jobs 85, 88 and 90. The deductions are what make the engine produce
// the SAME cut sizes the shop floor is used to seeing.
//
// Cost / Price values are left as 0 until you fill them in from your
// supplier price list. The engine still runs end-to-end with zeros;
// pricing totals will be £0 until populated. Replace as the catalog
// matures — no engine code needs to change.
// =====================================================================

import type { ProfileSystem } from "../types.ts";

export const SUNNYPLAST_70: ProfileSystem = {
  systemId: "sunnyplast-70",
  name: "Sunny Plast 70mm",
  currency: "GBP",
  stockBarLengthMm: 6000,
  sawKerfMm: 5,

  // ---------- COLOURS / FINISHES (M5 + U7) -------------------------
  // Base "white" stays the default at 0% uplift ⇒ default quotes are
  // byte-identical. The rest are a standard foiled palette: they ship with a
  // display `hex` (cosmetic — tints the preview SVG + 3D view + UI swatch) but
  // **0% uplift** because real foiled-colour upcharges are owner/supplier
  // specific and must NOT be guessed (golden rule). The owner sets each colour's
  // cost/price uplift % via the admin catalog editor. `defaultColourKey` is the
  // colour priced today; per-quote inside/outside selection lives in the
  // configurator (U3/U7). Hex values are approximate RAL equivalents for preview.
  defaultColourKey: "white",
  colours: {
    white:      { key: "white",      code: "COL-WHITE", name: "White",          costUpliftPct: 0, priceUpliftPct: 0, isBase: true,  hex: "#f5f5f5" },
    cream:      { key: "cream",      code: "COL-9001",  name: "Cream",          costUpliftPct: 0, priceUpliftPct: 0, isBase: false, hex: "#e8e0cf" },
    black:      { key: "black",      code: "COL-9005",  name: "Black",          costUpliftPct: 0, priceUpliftPct: 0, isBase: false, hex: "#1a1a1a" },
    anthracite: { key: "anthracite", code: "COL-7016",  name: "Anthracite Grey",costUpliftPct: 0, priceUpliftPct: 0, isBase: false, hex: "#353b3f" },
    grey:       { key: "grey",       code: "COL-7035",  name: "Light Grey",     costUpliftPct: 0, priceUpliftPct: 0, isBase: false, hex: "#c4c9c4" },
    red:        { key: "red",        code: "COL-3011",  name: "Red",            costUpliftPct: 0, priceUpliftPct: 0, isBase: false, hex: "#7c2128" },
    brown:      { key: "brown",      code: "COL-8017",  name: "Brown",          costUpliftPct: 0, priceUpliftPct: 0, isBase: false, hex: "#45322e" },
    "golden-oak": { key: "golden-oak", code: "COL-OAK", name: "Golden Oak",     costUpliftPct: 0, priceUpliftPct: 0, isBase: false, hex: "#8a5a2b" },
    green:      { key: "green",      code: "COL-6005",  name: "Fir Green",      costUpliftPct: 0, priceUpliftPct: 0, isBase: false, hex: "#2f4538" },
    blue:       { key: "blue",       code: "COL-5010",  name: "Steel Blue",     costUpliftPct: 0, priceUpliftPct: 0, isBase: false, hex: "#1f3a5f" },
  },

  // ---------- CILLS (window sills) ---------------------------------
  // External profiles fitted below the frame. Selecting any cill reduces the
  // manufacturing height by a fixed 30 mm (engine, solve.ts). Three nominal
  // sizes × three finishes (White / Foiled-on-White / Foiled), codes from
  // collections/part-list/stockitems.json. Cost/price/weight ship at 0 (golden
  // rule); the owner fills them via the admin catalog CRUD / CSV import.
  cills: {
    "cill-95-white":         { key: "cill-95-white",         code: "GL-1-00095",         name: "95mm Cill — White",            projectionMm: 95,  cost: 0, price: 0, per: "m", weight: 0, financialCategory: "Glazing Accessories" },
    "cill-95-foiled-white":  { key: "cill-95-foiled-white",  code: "GL-2-00095-1P-FCA",  name: "95mm Cill — Foiled on White",  projectionMm: 95,  cost: 0, price: 0, per: "m", weight: 0, financialCategory: "Glazing Accessories" },
    "cill-95-foiled":        { key: "cill-95-foiled",        code: "GL-2-00095-2P-FCA",  name: "95mm Cill — Foiled",           projectionMm: 95,  cost: 0, price: 0, per: "m", weight: 0, financialCategory: "Glazing Accessories" },
    "cill-150-white":        { key: "cill-150-white",        code: "GL-1-00150",         name: "150mm Cill — White",           projectionMm: 150, cost: 0, price: 0, per: "m", weight: 0, financialCategory: "Glazing Accessories" },
    "cill-150-foiled-white": { key: "cill-150-foiled-white", code: "GL-2-00150-1P-FCA",  name: "150mm Cill — Foiled on White", projectionMm: 150, cost: 0, price: 0, per: "m", weight: 0, financialCategory: "Glazing Accessories" },
    "cill-150-foiled":       { key: "cill-150-foiled",       code: "GL-2-00150-2P-FCA",  name: "150mm Cill — Foiled",          projectionMm: 150, cost: 0, price: 0, per: "m", weight: 0, financialCategory: "Glazing Accessories" },
    "cill-180-white":        { key: "cill-180-white",        code: "GL-1-00180",         name: "180mm Cill — White",           projectionMm: 180, cost: 0, price: 0, per: "m", weight: 0, financialCategory: "Glazing Accessories" },
    "cill-180-foiled-white": { key: "cill-180-foiled-white", code: "GL-2-00180-1P-FCA",  name: "180mm Cill — Foiled on White", projectionMm: 180, cost: 0, price: 0, per: "m", weight: 0, financialCategory: "Glazing Accessories" },
    "cill-180-foiled":       { key: "cill-180-foiled",       code: "GL-2-00180-2P-FCA",  name: "180mm Cill — Foiled",          projectionMm: 180, cost: 0, price: 0, per: "m", weight: 0, financialCategory: "Glazing Accessories" },
  },

  // ---------- FRAMES -----------------------------------------------
  // 5-Chamber 64mm is the casement/window frame.
  // 6-Chamber 68mm is used on heavier configurations (Job 90 — door).
  frames: {
    "frame-5ch": {
      code: "SPQ-5-10252",
      name: "Frame 5 Chamber",
      faceWidth: 64,
      glassRebate: 15,          // fixed-glazing rebate per side (Job 85 bottom)
      weldAllowanceMm: 0,       // 0 = inherit global Settings.weldAllowanceMm (default 2.5)
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Frame – (Standard)",
    },
    "frame-6ch": {
      code: "SPQ-6-11252",
      name: "Frame 6 Chamber",
      faceWidth: 68,
      glassRebate: 15,
      weldAllowanceMm: 0,       // 0 = inherit global Settings.weldAllowanceMm (default 2.5)
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Frame – (Standard)",
    },
    // Sliding patio outer frame. Face 48 derived from Job 104 (yogi test):
    //   1500 Ext − 1404 Int = 96 = 2×48 (verified across the 1500/2000/2600 jobs).
    // Code is a PLACEHOLDER pending the authentic Sunnyplast sliding-frame code
    // (cf. the existing SPQ-T-SASH placeholder); reconcile before going live.
    "frame-sliding": {
      code: "SPQ-SL-FRAME",
      name: "Sliding Frame",
      faceWidth: 48,
      glassRebate: 15,
      weldAllowanceMm: 0,       // 0 = inherit global Settings.weldAllowanceMm (default 2.5)
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Frame – (Standard)",
    },
    // French door outer frame — calibrated from Job 00000264 (docs/french-door/,
    // Windowmaker production docs, 1700×2100, profile "70mm/KASA 70-48+R1").
    // Face 48 ("KASA 70-48" names it; same 48 the sliding frame derived):
    //   French mullion length 2004 = 2100 − 2×48 = daylight H exactly, and the
    //   sash gasket 22576 = Σ(sash perim + daylight perim) only fits face 48.
    // SAME physical profile code as frame-6ch (SPQ-6-11252, printed on the doc)
    // but Job 90 (Quotila, single door) calibrated that entry at face 68 — the
    // two doc sources disagree, so the French family gets its OWN entry (cut
    // lists for the door pair are identical under either face; the face only
    // moves the drawn daylight + any uncalibrated fixed-sidelight glass).
    // Weld 3 mm/end: printed frame 1706 = 1700 + 2×3 (all 5 docs).
    "frame-french": {
      code: "SPQ-6-11252",
      name: "Frame 6 Chamber",
      faceWidth: 48,
      glassRebate: 15,
      weldAllowanceMm: 3,       // Job 00000264: saw sizes print finished + 3/end
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Frame – (Standard)",
    },
  },

  // ---------- SASHES ------------------------------------------------
  sashes: {
    "sash-t": {
      code: "SPQ-T-SASH",
      name: "T Sash",
      faceWidth: 79,
      overlap: 28,              // sash extends 28mm into frame/transom rebate per side
      glassRebate: 18.5,        // sash glazing rebate per side (Job 85/88 top sashes)
      weldAllowanceMm: 0,       // 0 = inherit global Settings.weldAllowanceMm (default 2.5)
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Sash – (Standard)",
    },
    "sash-door-z": {
      code: "SPQ-DOOR-Z",
      name: "Door Sash Z",
      faceWidth: 105,
      overlap: 28,
      glassRebate: 15,          // door glazing rebate per side (Job 90 door)
      weldAllowanceMm: 0,       // 0 = inherit global Settings.weldAllowanceMm (default 2.5)
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Sash – (Standard)",
    },
    // Sliding patio sash/pane (used for BOTH fixed and sliding panels — they are
    // cut identically; only hardware differs). Face 85 derived from Job 104:
    //   745.5 Ext − 575.5 Int = 170 = 2×85. Glass rebate 15 (glass = beadInt + 30,
    //   matches 606/522/524 × 1531 within the engine's ≤0.6mm tolerance). The
    //   sliding solver computes the panel envelope directly, so `overlap` is unused
    //   here (set 0). Code is a PLACEHOLDER (cf. SPQ-T-SASH).
    // French door leaves — calibrated from Job 00000264 (docs/french-door/).
    // BOTH the Z sash (85mm KAPI 70-85, SPQ-5-45252) and the T sash (105mm
    // SPQ-5-47252) cut with engine face 105: printed sash 824/2050 → finished
    // 818/2044 (−2×3 weld) → bead Int 608/1834 = sash − 2×105 on every doc.
    // Overlap 20: sash H 2044 = daylight 2004 + 2×20 (with frame-french face 48).
    // Glass rebate 15: glass 638×1864 = bead Int + 30 (all docs). Weld 3 mm/end.
    "sash-door-z-fr": {
      code: "SPQ-5-45252",
      name: "Z Door Sash",
      faceWidth: 105,
      overlap: 20,
      glassRebate: 15,
      weldAllowanceMm: 3,       // Job 00000264: printed 824 = 818 + 2×3
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Sash – (Standard)",
    },
    "sash-door-t-fr": {
      code: "SPQ-5-47252",
      name: "T Door Sash",
      faceWidth: 105,
      overlap: 20,
      glassRebate: 15,
      weldAllowanceMm: 3,       // Job 00000264 doc 0 (105mm/SPQ-5-47+R1)
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Sash – (Standard)",
    },
    "sash-sliding": {
      code: "SPQ-SL-SASH",
      name: "Sliding Sash",
      faceWidth: 85,
      overlap: 0,               // unused by the sliding solver (panel envelope is explicit)
      glassRebate: 15,
      weldAllowanceMm: 0,       // 0 = inherit global Settings.weldAllowanceMm (default 2.5)
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Sash – (Standard)",
    },
  },

  // ---------- TRANSOMS / MULLIONS ----------------------------------
  // The "type" determines how the jamb is cut:
  //   T  → jamb stays continuous (Job 88)
  //   Z  → jamb is broken at the transom centerline (Job 85)
  transoms: {
    "transom-t-67": {
      code: "SPQ-05-20252",
      name: "T Transom 67mm",
      faceWidth: 67,
      jointType: "T",
      weldAllowanceMm: 0,       // 0 = inherit global Settings.weldAllowanceMm (default 2.5)
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Structural T/Z – (Standard)",
    },
    "transom-z-67": {
      code: "SPQ-005-30252",
      name: "Chasement Z Sash",
      faceWidth: 67,
      jointType: "Z",
      weldAllowanceMm: 0,       // 0 = inherit global Settings.weldAllowanceMm (default 2.5)
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Structural T/Z – (Standard)",
    },
    "mullion-78": {
      code: "SPQ-5-30252",
      name: "T Transom/Mullion 78mm",
      faceWidth: 78,
      jointType: "T",
      weldAllowanceMm: 0,       // 0 = inherit global Settings.weldAllowanceMm (default 2.5)
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Structural T/Z – (Standard)",
    },
    // French mullion (STULP 70) — calibrated Job 00000264. jointType "S" =
    // square-cut, NO welded horns: Ext == Int == the daylight height it spans
    // (printed 2004 [ ] = 2100 − 2×48 on every doc; no weld addition). Face 48
    // for cell layout: leaf daylight (1604 − 48)/2 = 778 → sash 818 = 778 + 2×20.
    // Mounted on the slave leaf; carries the French Mullion Gasket (SP_GSKFM,
    // length = mullion length — bars.ts).
    "french-mullion": {
      code: "SPQ-1-46252",
      name: "French Mullion 70mm",
      faceWidth: 48,
      jointType: "S",
      weldAllowanceMm: 0,       // square-cut: 0 welded ends, never welded
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Structural T/Z – (Standard)",
    },
    // French leaf midrail ("67mm/T/M small+R1") — the SAME physical profile as
    // transom-z-67 (SPQ-005-30252) but used INSIDE a door-leaf sash via
    // CellSpec.midrails (T-joint into the sash uprights, never breaks a jamb).
    // Job 00000264 docs 1/4: printed 748 <> = Int 608 (sash Int) + 2×67 + 2×3 weld.
    "midrail-67": {
      code: "SPQ-005-30252",
      name: "T Transom Mullion SM",
      faceWidth: 67,
      jointType: "T",
      weldAllowanceMm: 3,       // Job 00000264: printed 748 = 742 + 2×3
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Structural T/Z – (Standard)",
    },
  },

  // ---------- BEADS -------------------------------------------------
  // NB: bead-28 must stay the FIRST entry — cells without an explicit beadKey
  // default to the first bead (topology.ts), and the calibrated casement /
  // door / sliding jobs all assert BEAD-28.
  beads: {
    "bead-28": {
      code: "BEAD-28",
      name: "28mm Bead",
      faceWidth: 20,            // bead face contribution per side (Ext-Int = 40 = 2x20)
      stickOut: 28,
      weldAllowanceMm: 0,       // beads are square-cut & snapped in, never welded
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Beads",
    },
    // French door bead ("BEAD 32 mm", authentic code) — calibrated Job 00000264:
    // printed bead 648 = bead Int 608 + 2×20 (same Ext−Int=40 rule as bead-28).
    // French leaves pin beadKey: "bead-32" explicitly.
    "bead-32": {
      code: "SPQ-1-52253",
      name: "BEAD 32 mm",
      faceWidth: 20,
      stickOut: 32,
      weldAllowanceMm: 0,       // square-cut, never welded (printed sizes have no weld add)
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Beads",
    },
  },

  // ---------- REINFORCEMENT ----------------------------------------
  // Reinforcement length rule for this system: length = bar Int (no end clearance).
  reinforcement: {
    "reinf-28x24": {
      code: "REINF-28x24",
      name: "28 x 24 Steel Reinforcement",
      faceWidth: 0,
      endClearance: 0,
      weldAllowanceMm: 0,       // internal steel insert, not welded
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Reinf - (steel)",
    },
    "reinf-13x29": {
      code: "REINF-13x29",
      name: "13 x 29 Steel Reinforcement",
      faceWidth: 0,
      endClearance: 0,
      weldAllowanceMm: 0,       // internal steel insert, not welded
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Reinf - (steel)",
    },
    "reinf-26x26-u": {
      code: "REINF-26x26-U",
      name: "26 x 26 U Steel Reinforcement",
      faceWidth: 0,
      endClearance: 0,
      weldAllowanceMm: 0,       // internal steel insert, not welded
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Reinf - (steel)",
    },
    "reinf-28x44.5-u": {
      code: "REINF-28x44.5-U",
      name: "28 x 44.5 U Steel Reinforcement",
      faceWidth: 0,
      endClearance: 0,
      weldAllowanceMm: 0,       // internal steel insert, not welded
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Reinf - (steel)",
    },
    // Sliding patio reinforcement. UNLIKE casement/door (endClearance 0), the
    // sliding profiles lose 10mm of steel (5mm per end) — derived from Job 104:
    //   frame reinf 1394 = frameInt 1404 − 10;  sash reinf 565.5 = sashInt 575.5 − 10
    //   (verified on every bar across the 1500/2000/2600 jobs). endClearance is a
    //   per-reinforcement field, so this does NOT affect casement/door math.
    "reinf-44x12": {
      code: "REINF-44x12",
      name: "44 x 12 Steel Reinforcement",
      faceWidth: 0,
      endClearance: 5,          // 5mm per end ⇒ length = barInt − 10 (sliding frame)
      weldAllowanceMm: 0,       // internal steel insert, not welded
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Reinf - (steel)",
    },
    "reinf-25x27-u": {
      code: "REINF-25x27-U",
      name: "25 x 27 U Steel Reinforcement",
      faceWidth: 0,
      endClearance: 5,          // 5mm per end ⇒ length = barInt − 10 (sliding sash)
      weldAllowanceMm: 0,       // internal steel insert, not welded
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Reinf - (steel)",
    },
  },

  // ---------- WHICH PROFILE GETS WHICH REINFORCEMENT --------------
  // Keys are profile codes (must match the .code field above).
  reinforcementMap: {
    "SPQ-T-SASH":      "reinf-28x24",        // casement sash
    "SPQ-DOOR-Z":      "reinf-28x44.5-u",    // door sash
    "SPQ-005-30252":   "reinf-13x29",        // Z-transom carries top-hung load (Job 85)
    "SPQ-5-30252":     "reinf-26x26-u",      // 78mm mullion when used full-height (Job 90)
    "SPQ-SL-FRAME":    "reinf-44x12",        // sliding frame: every bar reinforced (Job 104)
    "SPQ-SL-SASH":     "reinf-25x27-u",      // sliding sash: every bar reinforced (Job 104)
    // French door sashes — ASSUMED same steel as the single-door sash (the
    // Job 00000264 production docs carry "+R1" (reinforced) on every profile but
    // don't itemise a steel section; not asserted in validation — reconcile
    // against a French CUTTING LIST when one is available).
    "SPQ-5-45252":     "reinf-28x44.5-u",    // French Z door sash (assumed, see above)
    "SPQ-5-47252":     "reinf-28x44.5-u",    // French T door sash (assumed, see above)
    // Frame (5ch/6ch) and the lighter T-transom (67) are NOT reinforced in these examples.
    // The French mullion (SPQ-1-46252, "STULP 70+R1") likely carries steel too —
    // left unmapped pending an itemised French cutting list (golden rule).
  },

  // ---------- GASKETS ----------------------------------------------
  // Gasket 01 quantity = 2 × Σ sash outer perimeter (verified Job 85/88/90)
  // Gasket 02 quantity =     Σ glass perimeter      (verified Job 85/88/90)
  gaskets: {
    "gasket-01": {
      code: "GKT-01",
      name: "Gasket 01",
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Gasket/Woolpile",
    },
    "gasket-02": {
      code: "GKT-02",
      name: "Gasket 02",
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Gasket/Woolpile",
    },
    // French door gaskets — calibrated Job 00000264 (all 5 docs, exact):
    //   gasket-fm   = Σ French-mullion lengths            (printed 2004)
    //   gasket-sash = Σ per leaf: sash outer perimeter + leaf daylight perimeter
    //                 (printed 22576 = 2×(5724 + 5564); invariant across equal /
    //                 unequal leaves and midrails, as the docs show)
    "gasket-fm": {
      code: "SP_GSKFM",
      name: "French Mullion Gasket",
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Gasket/Woolpile",
    },
    "gasket-sash": {
      code: "SP_S001",
      name: "Sash Gasket",
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Gasket/Woolpile",
    },
  },

  // ---------- GLASS ------------------------------------------------
  glass: {
    "glass-4-20-4-lowe": {
      code: "G-4-20-4-LE",
      name: "4-20-4 Clear Low E : Thermal Spacer Bar",
      rebatePerSide: 0,        // engine reads sash/frame rebate directly (this is just for documentation)
      cost: 0, price: 0,
      per: "m2",
      weight: 0,
      financialCategory: "Glazing Accessories",
    },
    "glass-4-20-4-tuff-lowe": {
      code: "G-4-20-4-TLE",
      name: "4-20-4 Clear Tuff Low E : Thermal Spacer Bar",
      rebatePerSide: 0,
      cost: 0, price: 0,
      per: "m2",
      weight: 0,
      financialCategory: "Glazing Accessories",
    },
  },

  // ---------- HARDWARE ---------------------------------------------
  // Reusable items the hardware allocator will pick from. Length-dependent
  // items (espagnolettes, friction hinges) are listed with their length so
  // the allocator can pick the closest size to the sash dimension.
  hardware: {
    // Common
    "hw-mushroom-striker":    { code: "MUSH-STR",    name: "Mushroom Striker",                     cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Locking" },
    "hw-runup-block":         { code: "RUNUP-BLK",   name: "Run Up Block",                         cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Extras" },
    "hw-glazing-bridge-pack": { code: "GLZ-BRDG-PK", name: "Glazing Bridge Packer",                cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Glazing Accessories" },

    // Casement
    "hw-handle-inline":       { code: "HDL-INLINE",  name: "White Inline Handle",                  cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Handles" },
    "hw-espag-600":           { code: "ESPAG-600",   name: "600mm Espagnolette",                   cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Locking", lengthMm: 600 },
    "hw-espag-800":           { code: "ESPAG-800",   name: "800mm Espagnolette",                   cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Locking", lengthMm: 800 },
    "hw-espag-1000":          { code: "ESPAG-1000",  name: "1000mm Espagnolette",                  cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Locking", lengthMm: 1000 },
    "hw-fricthinge-8":        { code: "FH-8",        name: "8\" Friction Hinge",                   cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Friction Stays",    lengthMm: 200 },
    "hw-fricthinge-10":       { code: "FH-10",       name: "10\" Friction Hinge",                  cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Friction Stays",    lengthMm: 250 },
    "hw-fricthinge-12":       { code: "FH-12",       name: "12\" Friction Hinge",                  cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Friction Stays",    lengthMm: 300 },
    "hw-fricthinge-16":       { code: "FH-16",       name: "16\" Friction Hinge",                  cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Friction Stays",    lengthMm: 400 },
    "hw-fricthinge-20":       { code: "FH-20",       name: "20\" Friction Hinge",                  cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Friction Stays",    lengthMm: 500 },
    "hw-fricthinge-24":       { code: "FH-24",       name: "24\" Friction Hinge",                  cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Friction Stays",    lengthMm: 600 },

    // Door
    "hw-door-handle":         { code: "DR-HDL-LL",   name: "White Handle Lever/Lever (Short Backplate)", cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Door Handle" },
    "hw-flag-hinge-white":    { code: "DR-FLAG-W",   name: "Flag Hinge White",                     cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Door Hinge" },
    "hw-door-lock":           { code: "DR-LOCK-STD", name: "Standard Door Lock",                   cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Door Lock" },
    "hw-cylinder-brass":      { code: "DR-CYL-BR",   name: "Brass Cylinder",                       cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Cylinders" },
    "hw-keep-rh":             { code: "DR-KEEP-RH",  name: "R/H Keep Set",                         cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Door Lock" },
    "hw-keep-lh":             { code: "DR-KEEP-LH",  name: "L/H Keep Set",                         cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Door Lock" },

    // Tilt & Turn — UNCALIBRATED placeholders (M3). T&T geometry == casement
    // sash (uses sash-t); these gear items are pending a validated T&T job and
    // PDF hardware-bill reconciliation. T&T designs are gated quotable=false.
    "hw-tt-handle":           { code: "TT-HDL",      name: "Tilt & Turn Handle",                   cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Tilt & Turn Gear" },
    "hw-tt-gear":             { code: "TT-GEAR",     name: "Tilt & Turn Perimeter Gear",           cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Tilt & Turn Gear" },
    "hw-tt-hinge-set":        { code: "TT-HINGE",    name: "Tilt & Turn Hinge Set",                cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Tilt & Turn Gear" },
    "hw-tt-restrictor":       { code: "TT-RESTR",    name: "Tilt & Turn Restrictor",               cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Tilt & Turn Gear" },

    // French door — accessories CALIBRATED from Job 00000264 (authentic codes,
    // exact across all 5 docs): 2 inverter caps per French mullion, 4 cavity
    // locking blocks per leaf, 8 glazing bridges per glass pane.
    "hw-inverter-cap":        { code: "SPQ-2-91252", name: "Inverter Caps",                        cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Door Lock" },
    "hw-cavity-lock-block":   { code: "SP_CBLOCK01", name: "Cavity Locking Block",                 cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Door Lock" },
    "hw-glazing-bridge":      { code: "SP_GBRIDGE",  name: "Glazing Bridge",                       cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Glazing Accessories" },
    // French door operating gear — APPROXIMATE (flagged): the production docs
    // name "Door Handle w Key-A" + "Standard(both side key)" cylinder in the
    // header but don't itemise handles/hinges/locks in the cut table. Master
    // leaf reuses the single-door set (handle/lock/cylinder + 3 flag hinges);
    // slave leaf gets the shootbolt + 3 flag hinges. Tune with an itemised job.
    "hw-shootbolt":           { code: "FR-SHOOT",    name: "Shootbolt (Meeting Stile)",            cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Door Lock" },

    // Sliding patio — calibrated counts from Job 104 (yogi test 1–4). Per SLIDING
    // panel: 1 handle, 1 cylinder (reuses hw-cylinder-brass), 1 lock&keep, 2 rollers,
    // 1 panel stopper, 1 top + 1 bottom brush block. Per FIXED panel: 7 fixed-panel
    // supports. Codes are PLACEHOLDERS pending authentic part numbers.
    "hw-patio-handle-white":  { code: "SL-HDL-W",    name: "White Patio Handle",                   cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Handles" },
    "hw-patio-lock-keep":     { code: "SL-LOCK-KEEP", name: "Patio Lock & Keep Set",               cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Locking" },
    "hw-patio-roller":        { code: "SL-ROLLER",   name: "Ciilock Patio Roller",                 cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Extras" },
    "hw-panel-stopper":       { code: "SL-STOPPER",  name: "Panel Stopper",                        cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Extras" },
    "hw-fixed-panel-support": { code: "SL-FIX-SUP",  name: "Fixed Panel Support",                  cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Extras" },
    "hw-brush-top":           { code: "SL-BRUSH-T",  name: "Top Brush Block",                      cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Extras" },
    "hw-brush-bottom":        { code: "SL-BRUSH-B",  name: "Bottom Brush Block",                   cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Extras" },
    // APPROXIMATE count (like the glazing-bridge-packer rule): Bridge Packer. Job
    // 104 bridge-packer counts (8/14/14/16) are not cleanly geometry-derived, so
    // this uses a simple per-panel estimate — flagged, tune with more jobs.
    "hw-bridge-packer":       { code: "SL-BRDG-PK",  name: "Bridge Packer",                        cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Glazing Accessories" },
  },
};
