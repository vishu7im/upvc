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
import { STOCK_HARDWARE } from "./hardware-stock.generated.ts";

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
  //
  // Cill REINFORCEMENT (now MODELLED — Job 173/172, 2026-07-30): every item
  // fits a 35×15 SPQ-2-83997 ("reinf-35x15" below) at the cill's own length.
  // It reaches the cut list through the `reinforcementMap` entries keyed by
  // cill CODE at the bottom of this file; `bars.ts` emits it beside the cill
  // bar. The manual's Window Cills page (HAWDIO 21-7-2026.pdf printed p12 /
  // PDF 13) instead draws a 41.3×17.4 box steel for all three sizes, but that
  // section is uncoded (Steel Reinforcements page p17) and has no catalog
  // entry — so the documented 35×15 is used, and the 95/180 mapping is an
  // extrapolation from the 150 (owner decision; see the map's comment).
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
    // Sliding patio outer frame — authentic code from Jobs 44/48 (patio-docs/,
    // "Andrei UK", "Rama pentru glisare 48mm"). Face 48 verified on both docs
    // AND the earlier Job 104: frame Ext = W/H, Int = Ext − 96 = 2×48.
    // Weld 3 mm/end: printed saw sizes 2106/1906 = finished 2100/1900 + 2×3
    // (Job 44) and 2316/2216 (Job 48) — same convention as the French docs.
    "frame-sliding": {
      code: "SPQ-GL-10252",
      name: "Sliding Frame 48mm",
      faceWidth: 48,
      glassRebate: 15,
      weldAllowanceMm: 3,       // Jobs 44/48: printed = finished + 3/end
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
      // Same NAME as frame-6ch until 2026-08-04, which made the two entries
      // indistinguishable in the admin catalog. The code is deliberately shared
      // (one physical profile, two calibrated faces — see the comment above);
      // only the display name is disambiguated.
      name: "Frame 6 Chamber — French 48mm",
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
      // Authentic code from the ANGLIA price list (Doc A, "T SASH 70MM
      // internally glazed", SPQ-05-30252) AND the master fabrication PDF — both
      // agree. Replaces the former "SPQ-T-SASH" placeholder. Priced White
      // 2.80 / 1P 3.80 / 2P 4.80 £/m (Doc A) via the price-list import.
      code: "SPQ-05-30252",
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
      // Physically the same "Z Door Sash inward opening 70mm" as the French Z
      // leaf (sash-door-z-fr), so it now carries the authentic code SPQ-5-45252
      // (Doc A) instead of the "SPQ-DOOR-Z" placeholder. Deliberate duplicate
      // code (precedent: frame-6ch/frame-french); identical price tiers (White
      // 4.40 / 1P 5.50 / 2P 6.70 £/m, Doc A) keep the by-code price lookup
      // numerically unambiguous. Its reinforcement now resolves via the
      // SPQ-5-45252 map entry (reinforcementMap below).
      code: "SPQ-5-45252",
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
    // The T door sash on a SINGLE door — calibrated by Jobs 172/173
    // (docs/correct/, 2026-07-30), which cut "Door Sash T" on seven 1000×2000
    // single-door items. It cuts IDENTICALLY to the Z sash above: face 105,
    // overlap 28, glass rebate 15, 2.5 mm/end weld and the same 28 × 44.5 U
    // steel — verified on every printed row (p1 daylight 839 ⇒ sash 895 printed
    // 900; ring Int 685/1680 = the printed steel).
    //
    // Same code as the French T leaf (sash-door-t-fr) but its OWN entry, for the
    // same reason sash-door-z is separate from sash-door-z-fr: the French leaf
    // carries a 3 mm weld from Job 00000264, and this one inherits the global
    // 2.5 mm. Deliberate duplicate code — the M5.5 importer applies by partKey,
    // so both are priced (see price-lists/mapping.ts).
    "sash-door-t": {
      code: "SPQ-5-47252",
      name: "Door Sash T",
      faceWidth: 105,
      overlap: 28,
      glassRebate: 15,
      weldAllowanceMm: 0,       // 0 = inherit global Settings.weldAllowanceMm (default 2.5)
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Sash – (Standard)",
    },
    // Sliding patio sash/pane (used for BOTH fixed and sliding panels — they are
    // cut identically; only hardware differs). Authentic code from Jobs 44/48
    // ("Canat pentru glisare 85mm capac PVC"). Face 85 verified on both docs
    // (and Job 104): sash Int = Ext − 170 (949→779, 2014→1844 on Job 44).
    // Glass rebate 15 (glass = beadInt + 30: 809×1874 / 964×2084 exact). The
    // sliding solver computes the panel envelope directly, so `overlap` is
    // unused here (set 0). Weld 3 mm/end: printed 955/2020 = finished 949/2014
    // + 2×3 (Job 44), 1110/2230 (Job 48).
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
      code: "SPQ-GL-20252",
      name: "Sliding Sash 85mm",
      faceWidth: 85,
      overlap: 0,               // unused by the sliding solver (panel envelope is explicit)
      glassRebate: 15,
      weldAllowanceMm: 3,       // Jobs 44/48: printed = finished + 3/end
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
      // Was "Chasement Z Sash" (a transcription typo for "Casement", and it read
      // as a SASH beside "T Transom 67mm" in the studio's divider picker).
      // Renamed 2026-08-05. The word "Transom" is load-bearing: documents.ts
      // #section() classifies by substring, and this bar must stay in the Frame
      // section — the old name only landed there via a literal "chasement" test.
      name: "Z Transom 67mm",
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
    // "T" Mullion 70mm — NEW in the re-issued manual (HAWDIO 21-7-2026.pdf,
    // Profile Portfolio printed p11 / PDF 12: profile SPQ-050-30252, section
    // 75 wide × 70 deep; wind-loading EI printed p74, bare/unreinforced only).
    // Added by migration phase-2 as a catalog part ONLY: no glass-deduction
    // set exists for it (the deduction pages cover SPQ-5-30252 / SPQ-005-30252
    // only), so NO design references this key and no reinforcementMap entry
    // exists — do not wire it into topology defaults until a deduction source
    // or calibrated job arrives. Not in the M5.5 price lists (flagged for the
    // next price-list revision) ⇒ cost/price 0.
    "mullion-75": {
      code: "SPQ-050-30252",
      name: "T Mullion 70mm",
      faceWidth: 75,            // HAWDIO p11 (PDF 12): section width 75±0.3
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
  // door jobs assert SPQ-1-51252. Sliding pins bead-sl-24; French pins bead-32.
  // The loader orders parts by partKey (asc), so every OTHER bead key must
  // sort AFTER "bead-28" or it silently becomes the default bead.
  beads: {
    "bead-28": {
      // Authentic code SPQ-1-51252 ("Bead 28mm -Glass Holder", Doc A) replaces
      // the "BEAD-28" placeholder. Same physical code as bead-sl-24 (both the
      // 28mm glass-holder bead); duplicate code is safe (identical price tiers,
      // never in one quote — casement uses bead-28, sliding pins bead-sl-24).
      // Priced White 0.60 / 2P 1.50 £/m (Doc A has no 1P bead row ⇒ 1P falls
      // back to the colour %-uplift). partKey "bead-28" MUST stay first — this
      // only changes the code string, not the ordering.
      code: "SPQ-1-51252",
      name: "28mm Bead",
      faceWidth: 20,            // bead face contribution per side (Ext-Int = 40 = 2x20)
      stickOut: 28,
      weldAllowanceMm: 0,       // beads are square-cut & snapped in, never welded
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Beads",
    },
    // Sliding patio bead ("Bagheta ptr.24mm", authentic code) — calibrated
    // Jobs 44/48: length = sash Int + 40 (819/1884 on Job 44, 974/2094 on
    // Job 48), the same Ext−Int=40 face-20 rule as bead-28. The docs mark a
    // 45/45 mitre cut but the length carries NO weld add (beads are snapped
    // in, not welded) — end prep stays the engine's square notation.
    // Sliding designs pin beadKey: "bead-sl-24" (sliding-designs.ts); the
    // default first-bead pick (bead-28) is unchanged for casement/door —
    // NB the key deliberately sorts after "bead-28" (see the note above).
    "bead-sl-24": {
      code: "SPQ-1-51252",
      name: "24mm Glazing Bead",
      faceWidth: 20,
      stickOut: 24,
      weldAllowanceMm: 0,       // square/mitre-cut & snapped in, never welded
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
    // Used ONLY by SPQ-5-30252 (mullion-78 / the 78 mm divider). Length-gated:
    // Job 169 (collections/doors/) prints this steel for the divider at Int
    // 1710 (pages 3 and 5) and NONE at Int 710 / 685 (pages 1, 2 and 4). That
    // matches the manual's rule that SPQ-5-30252 is reinforced only above 1 m
    // (HAWDIO p17/PDF 18). The document brackets the threshold between 710 and
    // 1710 rather than pinning it, so the printed manual figure is what is
    // encoded — see Spec/questions.md Q23.
    //
    // The manual states the same >1 m rule for SPQ-005-30252 and >1.5 m for
    // SPQ-05-20252, but no PRODUCTION document shows either steel omitted, and
    // the calibrated Quotila jobs (85/88/90) are the source of truth for those
    // profiles. They stay ungated until a job evidences it (Q13 precedent:
    // production docs win over the manual).
    "reinf-26x26-u": {
      code: "REINF-26x26-U",
      name: "26 x 26 U Steel Reinforcement",
      faceWidth: 0,
      endClearance: 0,
      minBarLengthMm: 1000,     // HAWDIO p17 (PDF 18); confirmed by Job 169
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
    // NEW steels from the re-issued manual (HAWDIO 21-7-2026.pdf, Steel
    // Reinforcements printed p17 / PDF 18) — added by migration phase-2 as
    // catalog parts ONLY. Deliberately NOT in reinforcementMap: no manual page
    // assigns either to a host profile yet (golden rule — never guess a
    // mapping). Likely roles, for when a calibrated source assigns them:
    //   35×15 (SPQ-2-83997) — the cill-95 ALTERNATIVE reinforcement: the
    //     Window Cills page (printed p12 / PDF 13) shows a 35×15 box fitting
    //     the 95mm cill alongside the standard 41.3×17.4 cill steel.
    //   25×10 (SPQ-2-83998) — the frame-extension steel: the Add Ons page
    //     (printed p13 / PDF 14) shows a 25×10 box fitting the 25mm frame
    //     extension profile SPQ-2-75252.
    "reinf-35x15": {
      code: "SPQ-2-83997",
      name: "35 x 15 Steel Reinforcement",
      faceWidth: 0,
      endClearance: 0,
      weldAllowanceMm: 0,       // internal steel insert, not welded
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Reinf - (steel)",
    },
    "reinf-25x10": {
      code: "SPQ-2-83998",
      name: "25 x 10 Steel Reinforcement",
      faceWidth: 0,
      endClearance: 0,
      weldAllowanceMm: 0,       // internal steel insert, not welded
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Reinf - (steel)",
    },
    // Sliding patio reinforcement — authentic codes from Jobs 44/48 (Andrei UK;
    // SUPERSEDES the Job 104 rule of barInt − 10). UNLIKE casement/door
    // (endClearance 0), the sliding steel runs 15mm PAST the bar Int at each
    // end (into the mitre zone) ⇒ length = barInt + 30, verified on all 8
    // steel rows: frame 1834/2034 = Int 1804/2004 + 30 (Job 44), 2144/2244
    // (Job 48); sash 809/1874 = Int 779/1844 + 30, 964/2084 (Job 48).
    // endClearance is per-reinforcement, so casement/door math is untouched.
    "reinf-44x12": {
      code: "AO44X12",
      name: "44 x 12 Steel Reinforcement",
      faceWidth: 0,
      endClearance: -15,        // −15mm per end ⇒ length = barInt + 30 (sliding frame)
      weldAllowanceMm: 0,       // internal steel insert, not welded
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Reinf - (steel)",
    },
    "reinf-25x27-u": {
      code: "AU26X26",
      name: "26 x 26 U Steel Reinforcement",
      faceWidth: 0,
      endClearance: -15,        // −15mm per end ⇒ length = barInt + 30 (sliding sash)
      weldAllowanceMm: 0,       // internal steel insert, not welded
      cost: 0, price: 0,
      per: "m",
      weight: 0,
      financialCategory: "Reinf - (steel)",
    },
  },

  // ---------- AUXILIARY PROFILES (tracks / cover caps / add-ons) ------
  // The first block are sliding-patio cut items, calibrated Jobs 44/48
  // (Andrei UK) — the length rules live in bars.ts#emitSlidingAuxBars (engine,
  // with per-formula calibration comments); this Record is the priced part
  // data only. All are square-cut, never welded. cost/price 0 pending supplier
  // numbers (golden rule — enter via the admin catalog CRUD / CSV import).
  // NB emitSlidingAuxBars emits by EXPLICIT key — entries it doesn't name
  // (the add-on / bay-pole block below) are never cut into any quote.
  auxiliaries: {
    "aux-track-alu": {
      code: "AD16014",
      // Doc name (Jobs 44/48, Romanian): "Sina glisare aluminiu".
      name: "Aluminium Slide Track",
      cost: 0, price: 0, per: "m", weight: 0,
      financialCategory: "Auxiliary Profiles",
    },
    "aux-cap-frame-alu": {
      code: "AD55142",
      // Doc name (Jobs 44/48, Romanian): "Capac rama mare aluminiu".
      name: "Aluminium Frame Cap (Large)",
      cost: 0, price: 0, per: "m", weight: 0,
      financialCategory: "Auxiliary Profiles",
    },
    "aux-cap-fixed-panel": {
      code: "GLIS16",
      // Doc name (Jobs 44/48, Romanian): "Capac rama canat fix".
      name: "Fixed Panel Cap",
      cost: 0, price: 0, per: "m", weight: 0,
      financialCategory: "Auxiliary Profiles",
    },
    "aux-cap-frame-channel": {
      code: "GLIS17",
      // Doc name (Jobs 44/48, Romanian): "Capac canal rama".
      name: "Frame Channel Cap",
      cost: 0, price: 0, per: "m", weight: 0,
      financialCategory: "Auxiliary Profiles",
    },
    "aux-cap-frame-slide": {
      code: "SPQ-GL-10253",
      // Doc name (Jobs 44/48, Romanian): "Capac rama glisare".
      name: "Frame Slide Cap",
      cost: 0, price: 0, per: "m", weight: 0,
      financialCategory: "Auxiliary Profiles",
    },
    "aux-cap-sash-pvc": {
      code: "SPQ-GL-20253",
      // Doc name (Jobs 44/48, Romanian): "Capac PVC cercevea glisare".
      name: "Sash PVC Cap",
      cost: 0, price: 0, per: "m", weight: 0,
      financialCategory: "Auxiliary Profiles",
    },

    // ---- ADD-ONS & BAY/BOW PREP. Sources: HAWDIO 21-7-2026.pdf "Add Ons" ----
    // printed p13 / PDF 14 and "Bay Poles" printed p14 / PDF 15.
    //
    // `aux-ext-25` is now CALIBRATED and selectable per frame edge. Job 169
    // (collections/doors/, 5 pages, 1000×2000, a 25 mm SPQ-2-75252 on each of
    // the four edges in turn) shows it pushes the frame in by exactly its 25 mm
    // face on the perpendicular axis and leaves the parallel axis alone:
    //   add-on top/bottom ⇒ frame prints 1005 / 1980 (frame 1000 × 1975)
    //   add-on left/right ⇒ frame prints  980 / 2005 (frame  975 × 2000)
    // The unit still measures 1000 × 2000. That resolves Spec/questions.md Q6.
    // The reference Cutting List itemises NO row for the add-on profile itself,
    // so neither do we — its own bar length is unevidenced (questions.md Q21).
    //
    // Everything BELOW aux-ext-25 is still uncalibrated: no cut rule consumes
    // the coupling or bay/bow parts, and none carries a `faceWidthMm`, so none
    // can be selected as an add-on. cost/price 0 (not in the M5.5 lists).
    "aux-ext-25": {
      code: "SPQ-2-75252",
      name: "25mm Frame Extension Profile",   // p13: 70 wide × 25 high; takes 25×10 steel SPQ-2-83998
      faceWidthMm: 25,                        // Job 169: frame loses exactly 25 mm on that axis
      cost: 0, price: 0, per: "m", weight: 0,
      financialCategory: "Auxiliary Profiles",
    },
    "aux-coupling-frame": {
      code: "SPQ-2-72252",
      name: "Coupling Frame Connection",      // p13 (H-section clip joining two frames)
      cost: 0, price: 0, per: "m", weight: 0,
      financialCategory: "Auxiliary Profiles",
    },
    "aux-bay-corner-square": {
      code: "SPQ-2-63252",
      name: "Square Corner Profile",          // p14: 70×60; takes 50×50 steel (SPS-2-82995, p17)
      cost: 0, price: 0, per: "m", weight: 0,
      financialCategory: "Auxiliary Profiles",
    },
    "aux-bay-pole": {
      code: "SPQ-2-61252",
      name: "Bay Pole Profile",               // p14: Ø66 hex-core pole; takes Ø36 steel (SPS-2-82996, p17)
      cost: 0, price: 0, per: "m", weight: 0,
      financialCategory: "Auxiliary Profiles",
    },
    "aux-coupling-70": {
      code: "SPQ-2-76252",
      name: "Coupling Profile 70",            // p14: 93×26.4; takes 43×11 steel (SPS-2-82992, p17)
      cost: 0, price: 0, per: "m", weight: 0,
      financialCategory: "Auxiliary Profiles",
    },
    "aux-bay-corner-post": {
      code: "SPQ-2-74252",
      name: "Corner Post Pipe Profile 70mm",  // p14: 70 wide × 18.9 (curved cover for the pole)
      cost: 0, price: 0, per: "m", weight: 0,
      financialCategory: "Auxiliary Profiles",
    },
  },

  // ---------- WHICH PROFILE GETS WHICH REINFORCEMENT --------------
  // Keys are profile codes (must match the .code field above).
  reinforcementMap: {
    "SPQ-05-30252":    "reinf-28x24",        // casement T sash (was placeholder SPQ-T-SASH)
    // NB: the door Z sash (sash-door-z) now shares code SPQ-5-45252 with the
    // French Z leaf; its reinforcement is covered by the SPQ-5-45252 entry below,
    // so the old "SPQ-DOOR-Z" key is gone.
    "SPQ-005-30252":   "reinf-13x29",        // Z-transom carries top-hung load (Job 85)
    "SPQ-5-30252":     "reinf-26x26-u",      // 78mm mullion when used full-height (Job 90)
    "SPQ-GL-10252":    "reinf-44x12",        // sliding frame: every bar reinforced (Jobs 44/48)
    "SPQ-GL-20252":    "reinf-25x27-u",      // sliding sash: every bar reinforced (Jobs 44/48)
    // French door sashes — ASSUMED same steel as the single-door sash (the
    // Job 00000264 production docs carry "+R1" (reinforced) on every profile but
    // don't itemise a steel section; not asserted in validation — reconcile
    // against a French CUTTING LIST when one is available).
    "SPQ-5-45252":     "reinf-28x44.5-u",    // French Z door sash (assumed, see above)
    "SPQ-5-47252":     "reinf-28x44.5-u",    // French T door sash (assumed, see above)
    // Frame (5ch/6ch) and the lighter T-transom (67) are NOT reinforced in these examples.
    // The French mullion (SPQ-1-46252, "STULP 70+R1") likely carries steel too —
    // left unmapped pending an itemised French cutting list (golden rule).
    //
    // CILLS — Job 173 (all six items) and Job 172 fit a 35 × 15 SPQ-2-83997 at
    // the cill's own length (1100 under a 1000 mm unit), printed both in the
    // cill row's Reinforcing column and as its own `Hor Cill` section row. Only
    // the 150 mm cill appears in those documents; 95 and 180 are EXTRAPOLATED
    // from it by owner decision (2026-07-30) — the manual (HAWDIO p12/PDF 13)
    // shows every cill taking a steel, but draws a 41.3 × 17.4 box that has no
    // code and no catalog entry, so the documented 35 × 15 is used throughout.
    "GL-1-00095":        "reinf-35x15",      // 95mm cill  (extrapolated, see above)
    "GL-2-00095-1P-FCA": "reinf-35x15",
    "GL-2-00095-2P-FCA": "reinf-35x15",
    "GL-1-00150":        "reinf-35x15",      // 150mm cill (Job 173/172, evidenced)
    "GL-2-00150-1P-FCA": "reinf-35x15",
    "GL-2-00150-2P-FCA": "reinf-35x15",
    "GL-1-00180":        "reinf-35x15",      // 180mm cill (extrapolated, see above)
    "GL-2-00180-1P-FCA": "reinf-35x15",
    "GL-2-00180-2P-FCA": "reinf-35x15",
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
    // ---------- INFILL / DOOR PANELS (priced per m²) -----------------
    // Solid panels used in place of glazing on door leaves — selectable via the
    // same per-cell glassKey mechanism (they price per m² exactly like glass).
    // Codes are synthesized (the PANEL PRICES doc prints none); prices come from
    // that doc (Doc C, £/m² ex VAT) via the price-list import — 0 until then.
    "panel-28-white": {
      code: "PNL-28-W",
      name: "White PVC Panel 28mm (1.3mm plaques + 3mm HDF)",
      rebatePerSide: 0,
      cost: 0, price: 0, per: "m2", weight: 0,
      financialCategory: "Panels",
    },
    "panel-28-1p": {
      code: "PNL-28-1P",
      name: "PVC Panel 28mm — 1P Colour / 1P White",
      rebatePerSide: 0,
      cost: 0, price: 0, per: "m2", weight: 0,
      financialCategory: "Panels",
    },
    "panel-28-2p": {
      code: "PNL-28-2P",
      name: "PVC Panel 28mm — 2P Colour",
      rebatePerSide: 0,
      cost: 0, price: 0, per: "m2", weight: 0,
      financialCategory: "Panels",
    },
    "panel-hpl-1p": {
      code: "PNL-HPL-1P",
      name: "Laminated HPL Door Panel — 1P Std Colour / 1P White",
      rebatePerSide: 0,
      cost: 0, price: 0, per: "m2", weight: 0,
      financialCategory: "Panels",
    },
    "panel-hpl-2p": {
      code: "PNL-HPL-2P",
      name: "Laminated HPL Door Panel — 2P Standard Colour",
      rebatePerSide: 0,
      cost: 0, price: 0, per: "m2", weight: 0,
      financialCategory: "Panels",
    },
    "panel-28-alu": {
      code: "PNL-28-ALU",
      name: "White PVC Panel 28mm + 1mm Aluminium Sheet",
      rebatePerSide: 0,
      cost: 0, price: 0, per: "m2", weight: 0,
      financialCategory: "Panels",
    },
  },

  // ---------- HARDWARE ---------------------------------------------
  // Reusable items the hardware allocator will pick from. Length-dependent
  // items (espagnolettes, friction hinges) are listed with their length so
  // the allocator can pick the closest size to the sash dimension.
  //
  // HAND_HARDWARE (below) is spread LAST so a calibrated row always wins over a
  // stock-list row that happens to land on the same key.
  hardware: {
    // ---- The owner's real stock list ------------------------------------
    // Casement handles, door handles, cylinders, door hinges and door locks
    // from collections/part-list/stockitems.json, generated by
    // src/tools/extract-hardware.ts. All £0, no `lengthMm` ⇒ inert: referenced
    // by no design, picked by no cut rule, so every quote is byte-identical.
    // They exist so the Designer's 1:1 substitution slots have something to
    // offer. Spread FIRST — the calibrated rows below take precedence.
    ...STOCK_HARDWARE,

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
    // 90° friction-stay option — HAWDIO 21-7-2026.pdf printed p7 (PDF 8),
    // Casement system spec: "Friction stays: 17mm stack / 90° 13.5mm stack".
    // NEW option in the re-issued manual (migration phase-2). Code synthesized
    // (the manual prints none — panels precedent); NO lengthMm on purpose so
    // pickFrictionHinge (hardware.ts, explicit-key table) can never select it.
    // Spec-recording / documents-only until a calibrated allocation rule +
    // sized variants exist (Spec/questions.md Q7).
    "hw-fricthinge-90":       { code: "FH-90DEG",    name: "90° Friction Hinge (13.5mm stack)", cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Friction Stays" },

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
    // panel: 1 handle, 1 cylinder, 1 lock&keep, 2 rollers, 1 panel stopper, 1 top +
    // 1 bottom brush block. Per FIXED panel: 7 fixed-panel supports. Codes are the
    // authentic Sliding-System price-list GLIS numbers (Doc D), priced via the
    // import: GLIS 01 top brush 2.21, GLIS 02 bottom brush 1.92, GLIS 03 fixed
    // support 0.37, GLIS 04 bump-stop 1.47 (pack of 2), GLIS 09 handle 14.74,
    // GLIS 13 rolls 2.14. Lock+keep = GLIS 10 (14.74) + GLIS 11 (7.37) modelled
    // as one set (import sums them). Cylinder = its own GLIS-12 row below (NOT the
    // door brass cylinder — different price).
    "hw-patio-handle-white":  { code: "GLIS-09",     name: "White Patio Handle",                   cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Handles" },
    "hw-patio-lock-keep":     { code: "GLIS-10",     name: "Patio Lock & Keep Set",               cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Locking" },
    "hw-patio-cylinder":      { code: "GLIS-12",     name: "Patio Cylinder",                       cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Cylinders" },
    "hw-patio-roller":        { code: "GLIS-13",     name: "Ciilock Patio Roller",                 cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Extras" },
    "hw-panel-stopper":       { code: "GLIS-04",     name: "Panel Stopper (Bump Stop)",            cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Extras" },
    "hw-fixed-panel-support": { code: "GLIS-03",     name: "Fixed Panel Support",                  cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Extras" },
    "hw-brush-top":           { code: "GLIS-01",     name: "Top Brush Block",                      cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Extras" },
    "hw-brush-bottom":        { code: "GLIS-02",     name: "Bottom Brush Block",                   cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Casement Extras" },
    // APPROXIMATE count (like the glazing-bridge-packer rule): Bridge Packer. Job
    // 104 bridge-packer counts (8/14/14/16) are not cleanly geometry-derived, so
    // this uses a simple per-panel estimate — flagged, tune with more jobs. No
    // supplier price row (recorded-only) — stays £0.
    "hw-bridge-packer":       { code: "SL-BRDG-PK",  name: "Bridge Packer",                        cost: 0, price: 0, per: "pc", weight: 0, financialCategory: "Glazing Accessories" },
  },
};
