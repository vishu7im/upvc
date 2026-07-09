// =====================================================================
// price-lists/doc-c-panels.ts
//
// Transcribed VERBATIM (golden rule) from:
//   docs/price_list/PANEL PRICES.pdf
//
// Door / infill panels priced per m² (the "Price/square meters in £ excluding
// VAT" column). The PDF prints NO product codes — codes below are SYNTHESIZED
// (PNL-*) to match the glass rows added to the catalog; recorded in the note.
// The per-sheet "Unit price" and "with VAT" columns are recorded-only.
// =====================================================================

import type { PriceDoc } from "./types.ts";

export const DOC_C: PriceDoc = {
  docKey: "sp-panels-2025",
  supplierKey: "sunny-plast",
  supplierName: "Sunny Plast",
  sourceFile: "PANEL PRICES.pdf",
  effectiveDate: "2025-01-01", // labelled "Price list_2025", no exact date printed
  currency: "GBP",
  priceBasis: "£ per m² excluding VAT (Price/square meters column)",
  notes: "PDF prints no product codes; PNL-* codes are synthesized to match the catalog glass 'panel-*' rows. Per-sheet unit prices recorded in the description only.",
  entries: [
    { supplierCode: "PNL-28-W", description: "White PVC Panel 1.3mm Plaques + 3mm HDF, 1500x3000x28mm (sheet £85 ex VAT)", unit: "m2", colourTier: "white", unitPrice: 18.88, source: "Doc C row 1 'WHITE PVC PANEL 1.3 mm Plaques + 3 mm HDF', £/m² ex VAT" },
    { supplierCode: "PNL-28-1P", description: "1P Colour / 1P White PVC Panel 1.3mm Plaques + 3mm HDF, 1300x3000x28mm (sheet £95 ex VAT)", unit: "m2", colourTier: "1p", unitPrice: 24.35, source: "Doc C row 2 '1P COLOR / 1P WHITE PVC PANEL', £/m² ex VAT" },
    { supplierCode: "PNL-28-2P", description: "Colour PVC Panel 1.3mm Plaques + 3mm HDF (2P Colour), 1300x3000x28mm (sheet £120 ex VAT)", unit: "m2", colourTier: "2p", unitPrice: 30.76, source: "Doc C row 3 'COLOR PVC PANEL 1.3 mm Plaques + 3 mm HDF(2P Color)', £/m² ex VAT" },
    { supplierCode: "PNL-HPL-2P", description: "Laminated HPL Door Panel, 2P Standard Colour, 1.5mm Plaques + 3mm HDF, 900x2140x28mm (sheet £70 ex VAT)", unit: "m2", colourTier: "2p", unitPrice: 36.26, source: "Doc C row 4 'LAMINATED HPL DOOR PANEL , 2P STANDARD COLOR', £/m² ex VAT" },
    { supplierCode: "PNL-HPL-1P", description: "Laminated HPL Door Panel, 1P Standard Colour / 1P White, 1.5mm Plaques + 3mm HDF, 900x2140x28mm (sheet £65 ex VAT)", unit: "m2", colourTier: "1p", unitPrice: 33.67, source: "Doc C row 5 'LAMINATED HPL DOOR PANEL , 1P STANDARD COLOR, 1P WHITE', £/m² ex VAT" },
    { supplierCode: "PNL-28-ALU", description: "White PVC Panel 1.3mm Plaques + 1mm Aluminium sheet, 1500x3000x28mm (sheet £165 ex VAT)", unit: "m2", colourTier: "white", unitPrice: 36.67, source: "Doc C row 6 'WHITE PVC PANEL 1.3 mm Plaques + 1 mm Aluminium sheet', £/m² ex VAT" },
  ],
};
