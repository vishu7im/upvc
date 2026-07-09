// =====================================================================
// price-lists/doc-d-sliding-2025-07-29.ts
//
// Transcribed VERBATIM (golden rule) from:
//   docs/price_list/Price offer Sunny Plast  Sliding System_2025_rev01_29.07.25 FINAL.pdf
//
// "Price list_SLIDING SYSTEM SUNNY PLAST_2025" (rev01, 29.07.2025). PVC profiles
// in 3 colour tiers (£/1 LM), aluminium accessories (£/1 LM), and per-piece /
// per-LM "Other Accessories" (GLIS 01–14 + GLIS-15). unitPrice is the
// "Nett Price £/ 1 LM or Unit" column. Codes transcribed verbatim (note the
// underscore in SPQ_AD16014 and the space in "GLIS 01").
// =====================================================================

import type { PriceDoc } from "./types.ts";

export const DOC_D: PriceDoc = {
  docKey: "sp-sliding-2025-07-29",
  supplierKey: "sunny-plast",
  supplierName: "Sunny Plast",
  sourceFile: "Price offer Sunny Plast  Sliding System_2025_rev01_29.07.25 FINAL.pdf",
  effectiveDate: "2025-07-29",
  currency: "GBP",
  priceBasis: "nett £/1 LM (profiles, 3 colour tiers) + £/pc or £/LM (accessories)",
  entries: [
    // ---- Sliding Frame ----
    { supplierCode: "SPQ-GL-10252", description: "Sliding Frame", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 3.12, source: "Doc D 'SLIDING FRAME', White" },
    { supplierCode: "SPQ-GL-10398", description: "Sliding Frame", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 3.91, source: "Doc D 'SLIDING FRAME', 1P Colour 1P White" },
    { supplierCode: "SPQ-GL-10267", description: "Sliding Frame", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 4.70, source: "Doc D 'SLIDING FRAME', 2P Colour" },

    // ---- Sliding Frame Cover (no 1P row) ----
    { supplierCode: "SPQ-GL-10253", description: "Sliding Frame Cover", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 1.42, source: "Doc D 'SLIDING FRAME COVER', White" },
    { supplierCode: "SPQ-GL-10268", description: "Sliding Frame Cover", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 2.05, source: "Doc D 'SLIDING FRAME COVER', 2P Colour (no 1P row)" },

    // ---- Sliding Sash ----
    { supplierCode: "SPQ-GL-20252", description: "Sliding Sash", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 3.98, source: "Doc D 'SLIDING SASH', White" },
    { supplierCode: "SPQ-GL-20398", description: "Sliding Sash", unit: "m", colourTier: "1p", stockLengthM: 6, unitPrice: 5.33, source: "Doc D 'SLIDING SASH', 1P Colour 1P White" },
    { supplierCode: "SPQ-GL-20267", description: "Sliding Sash", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 6.68, source: "Doc D 'SLIDING SASH', 2P Colour" },

    // ---- U-PVC Interlock & Sash Cover (4.2m, no 1P row) ----
    { supplierCode: "SPQ-GL-20253", description: "U-PVC Interlock & Sash Cover", unit: "m", colourTier: "white", stockLengthM: 4.2, unitPrice: 1.70, source: "Doc D 'U-PVC INTERLOCK & SASH COVER', White (4.2 m)" },
    { supplierCode: "SPQ-GL-20268", description: "U-PVC Interlock & Sash Cover", unit: "m", colourTier: "2p", stockLengthM: 4.2, unitPrice: 2.90, source: "Doc D 'U-PVC INTERLOCK & SASH COVER', 2P Colour (4.2 m, no 1P row)" },

    // ---- Bead 28mm - Glass Holder (sliding, no 1P row) ----
    { supplierCode: "SPQ-3-51252", description: "Bead 28mm - Glass Holder (sliding)", unit: "m", colourTier: "white", stockLengthM: 6, unitPrice: 0.78, source: "Doc D 'BEAD 28 mm -GLASS HOLDER', White" },
    { supplierCode: "SPQ-3-51267", description: "Bead 28mm - Glass Holder (sliding)", unit: "m", colourTier: "2p", stockLengthM: 6, unitPrice: 1.12, source: "Doc D 'BEAD 28 mm -GLASS HOLDER', 2P Colour (no 1P row)" },

    // ---- Reinforcement (grey steel) ----
    { supplierCode: "SPQ-2-85000", description: "Reinforcement 12x43x12 1.5 for Frame", unit: "m", stockLengthM: 6, unitPrice: 1.10, source: "Doc D 'REINFORCEMENT 12X43X12 1.5 FOR FRAME', Grey" },
    { supplierCode: "SPQ-2-85001", description: "Reinforcement for Sash 27x25x27 1.5", unit: "m", stockLengthM: 6, unitPrice: 1.07, source: "Doc D 'REINFORCEMENT FOR SASH 27X25X27 1,5', Grey" },

    // ---- Aluminium accessories (£/1 LM) ----
    { supplierCode: "SPQ_AD16014", description: "Aluminium Sliding Rail", unit: "m", stockLengthM: 6, unitPrice: 1.70, source: "Doc D 'ALUMINIUM SLIDING RAIL', Aluminium (£10.00/6 m)" },
    { supplierCode: "SPQ-AD55141", description: "Aluminium Interlock & Sash Cover", unit: "m", stockLengthM: 4.2, unitPrice: 11.90, source: "Doc D 'ALUMINIUM INTERLOCK & SASH COVER' (White/Grey/Black all £50.00/4.2 m) — UNMAPPED" },
    { supplierCode: "SPQ-AD55142", description: "Threshold Cover Trim", unit: "m", stockLengthM: 4.2, unitPrice: 6.40, source: "Doc D 'THRESHOLD COVER TRIM' (£27.00/4.2 m)" },
    { supplierCode: "SPQ-AD55143", description: "Low Threshold Cover Trim", unit: "m", stockLengthM: 4.2, unitPrice: 5.20, source: "Doc D 'LOW THRESHOLD COVER TRIM' (£22.00/4.2 m) — UNMAPPED" },
    { supplierCode: "SPQ-AD55145", description: "Aluminium Low Threshold", unit: "m", stockLengthM: 6, unitPrice: 14.20, source: "Doc D 'ALUMINIUM LOW THRESHOLD' (£85.00/6 m) — UNMAPPED" },
    { supplierCode: "SPQ-AD55144", description: "3 & 4 Panel Adapter", unit: "m", stockLengthM: 4.2, unitPrice: 6.40, source: "Doc D '3 & 4 PANEL ADAPTER' (£27.00/4.2 m) — UNMAPPED" },
    { supplierCode: "GLIS-15", description: "Frame Mechanical Joint", unit: "m", stockLengthM: 6, unitPrice: 2.70, source: "Doc D 'FRAME MECHANICAL JOINT', Aluminium (£16.00/6 m) — UNMAPPED" },

    // ---- Other accessories (per pc unless noted) ----
    { supplierCode: "GLIS 01", description: "Top Brush Block", unit: "pc", unitPrice: 2.21, source: "Doc D 'GLIS 01 TOP BRUSH BLOCK' (White/Black)" },
    { supplierCode: "GLIS 02", description: "Bottom Brush Block", unit: "pc", unitPrice: 1.92, source: "Doc D 'GLIS 02 BOTTOM BRUSH BLOCK' (White/Black)" },
    { supplierCode: "GLIS 03", description: "Fixed Panel Support Spacer", unit: "pc", unitPrice: 0.37, source: "Doc D 'GLIS 03 FIXED PANNEL SUPPORT SPACER', Black" },
    { supplierCode: "GLIS 04", description: "Bump Stop (2 pieces)", unit: "pc", packQty: 2, unitPrice: 1.47, source: "Doc D 'GLIS 04 BUMP STOP - 2 PIECES' (White/Black), price per pack of 2" },
    { supplierCode: "GLIS 05", description: "Low Threshold Brush", unit: "pc", unitPrice: 2.95, source: "Doc D 'GLIS 05 LOW THRESHOLD BRUSH', Black — UNMAPPED" },
    { supplierCode: "GLIS 06", description: "Low Threshold End Cap", unit: "pc", unitPrice: 2.95, source: "Doc D 'GLIS 06 LOW THRESHOLD END CAP' (White/Black) — UNMAPPED" },
    { supplierCode: "GLIS 07", description: "Large Dust Suction Brush 12.7x700", unit: "lm", unitPrice: 0.21, source: "Doc D 'GLIS 07 LARGE DUST SUCTION BRUSH 12.7X700', per LM — UNMAPPED" },
    { supplierCode: "GLIS 08", description: "Small Dust Suction Brush 4.8x550", unit: "lm", unitPrice: 0.08, source: "Doc D 'GLIS 08 SMALL DUST SUCTION BRUSH 4.8X550', per LM — UNMAPPED" },
    { supplierCode: "GLIS 09", description: "Patio Handle Set", unit: "pc", unitPrice: 14.74, source: "Doc D 'GLIS 09 PATIO HANDLE SET', Silver" },
    { supplierCode: "GLIS 14", description: "Patio Handle (dummy)", unit: "pc", unitPrice: 14.74, source: "Doc D 'GLIS 14 PATIO HANDLE ( dummy )', Silver — UNMAPPED" },
    { supplierCode: "GLIS 10", description: "Patio Door Lock", unit: "pc", unitPrice: 14.74, source: "Doc D 'GLIS 10 PATIO DOOR LOCK'" },
    { supplierCode: "GLIS 11", description: "Patio Door Keep", unit: "pc", unitPrice: 7.37, source: "Doc D 'GLIS 11 PATIO DOOR KEEP'" },
    { supplierCode: "GLIS 12", description: "Cylinder", unit: "pc", unitPrice: 2.36, source: "Doc D 'GLIS 12 CYLINDER'" },
    { supplierCode: "GLIS 13", description: "Sliding Rolls", unit: "pc", unitPrice: 2.14, source: "Doc D 'GLIS 13 SLIDING ROLLS'" },
  ],
};
