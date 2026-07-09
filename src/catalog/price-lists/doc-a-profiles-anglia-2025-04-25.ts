// =====================================================================
// price-lists/doc-a-profiles-anglia-2025-04-25.ts
//
// Transcribed VERBATIM (golden rule) from:
//   docs/price_list/01 Price offer Sunny Plast  PVC Profiles_ANGLIA_25.04.2025_engross_1 (1) (1).pdf
//
// "SUNNY PLAST Price list_2025" — wholesale (engross) nett prices, GBP, 6 m
// lengths, three colour tiers per profile:
//   White  →  code suffix -252  (colourTier "white")
//   1P Colour 1P White  →  suffix -398  (colourTier "1p")
//   2P Colour  →  suffix -267  (colourTier "2p")
// unitPrice is the "Nett Price £/metre or Unit" column (per metre).
// Cills at the bottom price per metre too.
// =====================================================================

import type { PriceDoc } from "./types.ts";

export const DOC_A: PriceDoc = {
  docKey: "sp-profiles-anglia-2025-04-25",
  supplierKey: "sunny-plast",
  supplierName: "Sunny Plast",
  sourceFile: "01 Price offer Sunny Plast  PVC Profiles_ANGLIA_25.04.2025_engross_1 (1) (1).pdf",
  effectiveDate: "2025-04-25",
  currency: "GBP",
  priceBasis: "engross/wholesale nett £/m, 6 m lengths, 3 colour tiers (White / 1P Colour 1P White / 2P Colour)",
  entries: [
    // ---- Window Frame 70mm 5 Chambers ----
    { supplierCode: "SPQ-5-10252", description: "Window Frame 70mm 5 Chambers", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 2.50, source: "Doc A 'WINDOW FRAME 70 MM 5 Chambers', White" },
    { supplierCode: "SPQ-5-10398", description: "Window Frame 70mm 5 Chambers", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 3.50, source: "Doc A 'WINDOW FRAME 70 MM 5 Chambers', 1P Colour 1P White" },
    { supplierCode: "SPQ-5-10267", description: "Window Frame 70mm 5 Chambers", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 4.20, source: "Doc A 'WINDOW FRAME 70 MM 5 Chambers', 2P Colour" },

    // ---- Door & Window Frame 70mm 6 Chambers ----
    { supplierCode: "SPQ-6-11252", description: "Door & Window Frame 70mm 6 Chambers", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 2.90, source: "Doc A 'DOOR & WINDOW FRAME 70 MM 6 Chambers', White" },
    { supplierCode: "SPQ-6-11398", description: "Door & Window Frame 70mm 6 Chambers", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 3.70, source: "Doc A 'DOOR & WINDOW FRAME 70 MM 6 Chambers', 1P Colour 1P White" },
    { supplierCode: "SPQ-6-11267", description: "Door & Window Frame 70mm 6 Chambers", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 4.60, source: "Doc A 'DOOR & WINDOW FRAME 70 MM 6 Chambers', 2P Colour" },

    // ---- T Sash 70mm internally glazed ----
    { supplierCode: "SPQ-05-30252", description: "T Sash 70mm internally glazed", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 2.80, source: "Doc A 'T SASH 70 MM internally glazed', White" },
    { supplierCode: "SPQ-05-30398", description: "T Sash 70mm internally glazed", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 3.80, source: "Doc A 'T SASH 70 MM internally glazed', 1P Colour 1P White" },
    { supplierCode: "SPQ-05-30267", description: "T Sash 70mm internally glazed", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 4.80, source: "Doc A 'T SASH 70 MM internally glazed', 2P Colour" },

    // ---- Tilt and Turn Sash 70mm (family gated non-quotable; recorded) ----
    { supplierCode: "SPQ-6-20252", description: "Tilt and Turn Sash 70mm", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 2.80, source: "Doc A 'TILT AND TURN SASH 70 MM', White" },
    { supplierCode: "SPQ-6-20398", description: "Tilt and Turn Sash 70mm", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 3.80, source: "Doc A 'TILT AND TURN SASH 70 MM', 1P Colour 1P White" },
    { supplierCode: "SPQ-6-20267", description: "Tilt and Turn Sash 70mm", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 4.80, source: "Doc A 'TILT AND TURN SASH 70 MM', 2P Colour" },

    // ---- Casement "Z" Sash 70mm ----
    { supplierCode: "SPQ-05-20252", description: "Casement Z Sash 70mm", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 2.80, source: "Doc A 'CHASEMENT \"Z\" SASH 70 MM', White" },
    { supplierCode: "SPQ-05-20398", description: "Casement Z Sash 70mm", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 3.80, source: "Doc A 'CHASEMENT \"Z\" SASH 70 MM', 1P Colour 1P White" },
    { supplierCode: "SPQ-05-20267", description: "Casement Z Sash 70mm", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 4.80, source: "Doc A 'CHASEMENT \"Z\" SASH 70 MM', 2P Colour" },

    // ---- Casement "T" Sash 70mm ----
    { supplierCode: "SPQ-005-30252", description: "Casement T Sash 70mm", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 2.80, source: "Doc A 'CHASEMENT \"T\" SASH 70 MM', White" },
    { supplierCode: "SPQ-005-30398", description: "Casement T Sash 70mm", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 3.80, source: "Doc A 'CHASEMENT \"T\" SASH 70 MM', 1P Colour 1P White" },
    { supplierCode: "SPQ-005-30267", description: "Casement T Sash 70mm", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 4.80, source: "Doc A 'CHASEMENT \"T\" SASH 70 MM', 2P Colour" },

    // ---- "T" Transom / Mullion 70mm ----
    { supplierCode: "SPQ-5-30252", description: "T Transom / Mullion 70mm", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 3.00, source: "Doc A '\"T\" TRANSOM / MULLION 70 MM', White" },
    { supplierCode: "SPQ-5-30398", description: "T Transom / Mullion 70mm", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 4.20, source: "Doc A '\"T\" TRANSOM / MULLION 70 MM', 1P Colour 1P White" },
    { supplierCode: "SPQ-5-30267", description: "T Transom / Mullion 70mm", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 5.00, source: "Doc A '\"T\" TRANSOM / MULLION 70 MM', 2P Colour" },

    // ---- French Mullion 70mm ----
    { supplierCode: "SPQ-1-46252", description: "French Mullion 70mm", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 2.80, source: "Doc A 'FRENCH MULLION 70 MM', White" },
    { supplierCode: "SPQ-1-46398", description: "French Mullion 70mm", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 3.80, source: "Doc A 'FRENCH MULLION 70 MM', 1P Colour 1P White" },
    { supplierCode: "SPQ-1-46267", description: "French Mullion 70mm", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 4.80, source: "Doc A 'FRENCH MULLION 70 MM', 2P Colour" },

    // ---- "T" Door Sash outward opening 70mm ----
    { supplierCode: "SPQ-5-47252", description: "T Door Sash outward opening 70mm", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 4.40, source: "Doc A '\"T\" DOOR SASH OUTWARD OPENING 70 MM', White" },
    { supplierCode: "SPQ-5-47398", description: "T Door Sash outward opening 70mm", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 5.50, source: "Doc A '\"T\" DOOR SASH OUTWARD OPENING 70 MM', 1P Colour 1P White" },
    { supplierCode: "SPQ-5-47267", description: "T Door Sash outward opening 70mm", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 6.70, source: "Doc A '\"T\" DOOR SASH OUTWARD OPENING 70 MM', 2P Colour" },

    // ---- "Z" Door Sash inward opening 70mm (NB middle code printed -45253, not -45398) ----
    { supplierCode: "SPQ-5-45252", description: "Z Door Sash inward opening 70mm", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 4.40, source: "Doc A '\"Z\" DOOR SASH INWARD OPENING 70 MM', White" },
    { supplierCode: "SPQ-5-45253", description: "Z Door Sash inward opening 70mm", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 5.50, source: "Doc A '\"Z\" DOOR SASH INWARD OPENING 70 MM', middle column (code printed -45253, not -45398)" },
    { supplierCode: "SPQ-5-45267", description: "Z Door Sash inward opening 70mm", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 6.70, source: "Doc A '\"Z\" DOOR SASH INWARD OPENING 70 MM', 2P Colour" },

    // ---- Bead 28mm - Glass Holder (no 1P row in Doc A) ----
    { supplierCode: "SPQ-1-51252", description: "Bead 28mm - Glass Holder", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 0.60, source: "Doc A 'BEAD 28 mm -GLASS HOLDER', White" },
    { supplierCode: "SPQ-1-51267", description: "Bead 28mm - Glass Holder", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 1.50, source: "Doc A 'BEAD 28 mm -GLASS HOLDER', 2P Colour (no 1P row printed)" },

    // ---- Bead 32mm - Glass Holder (no 1P row in Doc A) ----
    { supplierCode: "SPQ-1-52252", description: "Bead 32mm - Glass Holder", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 0.60, source: "Doc A 'BEAD 32 mm - GLASS HOLDER', White" },
    { supplierCode: "SPQ-1-52267", description: "Bead 32mm - Glass Holder", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 1.50, source: "Doc A 'BEAD 32 mm - GLASS HOLDER', 2P Colour (no 1P row printed)" },

    // ---- Bay / bow / coupling profiles — NOT in the catalog (roadmap M6). Recorded only. ----
    { supplierCode: "SPQ-2-61252", description: "Bay Pole Profile", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 3.00, source: "Doc A 'BAY POLE PROFILE', White — UNMAPPED (no bay products until M6)" },
    { supplierCode: "SPQ-2-61398", description: "Bay Pole Profile", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 4.00, source: "Doc A 'BAY POLE PROFILE', 1P — UNMAPPED" },
    { supplierCode: "SPQ-2-61267", description: "Bay Pole Profile", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 5.00, source: "Doc A 'BAY POLE PROFILE', 2P — UNMAPPED" },
    { supplierCode: "SPQ-2-63252", description: "Square Corner Profile", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 4.50, source: "Doc A 'SQUARE CORNER PROFILE', White — UNMAPPED" },
    { supplierCode: "SPQ-2-63398", description: "Square Corner Profile", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 5.50, source: "Doc A 'SQUARE CORNER PROFILE', 1P — UNMAPPED" },
    { supplierCode: "SPQ-2-63267", description: "Square Corner Profile", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 6.50, source: "Doc A 'SQUARE CORNER PROFILE', 2P — UNMAPPED" },
    { supplierCode: "SPQ-2-72252", description: "Coupling Frame Connection", unit: "m", colourTier: "white", stockLengthM: 4.2, unitPrice: 0.50, source: "Doc A 'COUPLING FRAME CONNECTION' 4.2 m, White only — UNMAPPED" },
    { supplierCode: "SPQ-2-75252", description: "25mm Frame Extension Profile", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 2.50, source: "Doc A '25 MM FRAME EXTENSION PROFILE', White — UNMAPPED" },
    { supplierCode: "SPQ-2-75398", description: "25mm Frame Extension Profile", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 3.00, source: "Doc A '25 MM FRAME EXTENSION PROFILE', 1P — UNMAPPED" },
    { supplierCode: "SPQ-2-75267", description: "25mm Frame Extension Profile", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 4.00, source: "Doc A '25 MM FRAME EXTENSION PROFILE', 2P — UNMAPPED" },
    { supplierCode: "SPQ-2-76252", description: "Coupling Profile 70", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 2.20, source: "Doc A 'COUPLING PROFILE 70', White — UNMAPPED" },
    { supplierCode: "SPQ-2-76398", description: "Coupling Profile 70", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 2.74, source: "Doc A 'COUPLING PROFILE 70', 1P — UNMAPPED" },
    { supplierCode: "SPQ-2-76267", description: "Coupling Profile 70", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 4.00, source: "Doc A 'COUPLING PROFILE 70', 2P — UNMAPPED" },
    { supplierCode: "SPQ-2-74252", description: "Corner Post Pipe Profile 70mm", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 2.00, source: "Doc A 'CORNER POST PIPE PROFILE 70 MM', White — UNMAPPED" },
    { supplierCode: "SPQ-2-74398", description: "Corner Post Pipe Profile 70mm", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 2.50, source: "Doc A 'CORNER POST PIPE PROFILE 70 MM', 1P — UNMAPPED" },
    { supplierCode: "SPQ-2-74267", description: "Corner Post Pipe Profile 70mm", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 3.00, source: "Doc A 'CORNER POST PIPE PROFILE 70 MM', 2P — UNMAPPED" },

    // ---- Window Cills (per metre). White=GL-1, 1P=GL-2, 2P=GL-3. ----
    { supplierCode: "GL-1-00095", description: "Window Cill 95mm", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 1.80, source: "Doc A 'WINDOW CILLS 95 MM', White" },
    { supplierCode: "GL-2-00095", description: "Window Cill 95mm", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 3.50, source: "Doc A 'WINDOW CILLS 95 MM', 1P Colour" },
    { supplierCode: "GL-3-00095", description: "Window Cill 95mm", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 4.00, source: "Doc A 'WINDOW CILLS 95 MM', 2P Colour" },
    { supplierCode: "GL-1-00150", description: "Window Cill 150mm", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 2.45, source: "Doc A 'WINDOW CILLS 150 MM', White" },
    { supplierCode: "GL-2-00150", description: "Window Cill 150mm", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 4.50, source: "Doc A 'WINDOW CILLS 150 MM', 1P Colour" },
    { supplierCode: "GL-3-00150", description: "Window Cill 150mm", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 5.20, source: "Doc A 'WINDOW CILLS 150 MM', 2P Colour" },
    { supplierCode: "GL-1-00180", description: "Window Cill 180mm", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 3.40, source: "Doc A 'WINDOW CILLS 180 MM', White" },
    { supplierCode: "GL-2-00180", description: "Window Cill 180mm", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 6.50, source: "Doc A 'WINDOW CILLS 180 MM', 1P Colour" },
    { supplierCode: "GL-3-00180", description: "Window Cill 180mm", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 7.50, source: "Doc A 'WINDOW CILLS 180 MM', 2P Colour" },
  ],
};
