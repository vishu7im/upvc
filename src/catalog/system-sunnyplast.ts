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

  // ---------- COLOURS / FINISHES (M5) ------------------------------
  // Only the base "white" ships in the seed (0% uplift ⇒ default quotes are
  // byte-identical to pre-M5). Real foiled-colour uplift percentages are
  // entered by the owner via the admin catalog API — never guessed here
  // (golden rule). `defaultColourKey` is the colour priced today; per-quote
  // colour selection arrives with the configurator UI (Phase 2).
  defaultColourKey: "white",
  colours: {
    white: {
      key: "white",
      code: "COL-WHITE",
      name: "White",
      costUpliftPct: 0,
      priceUpliftPct: 0,
      isBase: true,
    },
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
  },

  // ---------- BEADS -------------------------------------------------
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
    // Frame (5ch/6ch) and the lighter T-transom (67) are NOT reinforced in these examples.
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

    // French door — UNCALIBRATED placeholder (M3): passive-leaf meeting-stile
    // shootbolt. Pending a validated French job. French designs gated false.
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
