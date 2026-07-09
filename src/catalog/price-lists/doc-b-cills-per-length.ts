// =====================================================================
// price-lists/doc-b-cills-per-length.ts
//
// Transcribed VERBATIM (golden rule) from:
//   docs/price_list/Cills Prices.pdf
//
// "UK SUNNY PLAST LTD. CILLS Price list" — per 6 m ONE LENGTH, three colour
// blocks (WHITE / 1P Color / 2P Color), each with three customer volume tiers:
// Lorry / Company / Normal. Rows carry NO product code, so mapping matches by
// (description + colourTier + variant). The catalog uses the "Normal" tier as
// the cill SELL price (owner decision), divided by 6 m → per metre by the import.
// =====================================================================

import type { PriceDoc, PriceEntry, ColourTier, CillVariant } from "./types.ts";

// [size, white L/C/N, 1p L/C/N, 2p L/C/N] straight off the three tables.
const ROWS: [number, [number, number, number], [number, number, number], [number, number, number]][] = [
  [95,  [10.5, 12.5, 15], [19, 23, 30], [24, 28, 33]],
  [150, [12.5, 15,   20], [23, 28, 35], [28, 31, 38]],
  [180, [18,   21,   25], [28, 35, 40], [32, 39, 45]],
];

const VARIANTS: CillVariant[] = ["lorry", "company", "normal"];

function build(): PriceEntry[] {
  const out: PriceEntry[] = [];
  const tierBlocks: [ColourTier, 1 | 2 | 3][] = [["white", 1], ["1p", 2], ["2p", 3]];
  for (const [size, white, p1, p2] of ROWS) {
    const byTier: Record<ColourTier, [number, number, number]> = { white, "1p": p1, "2p": p2 };
    for (const [tier] of tierBlocks) {
      VARIANTS.forEach((variant, i) => {
        out.push({
          supplierCode: "",
          description: `${size}mm ${tier === "white" ? "White" : tier === "1p" ? "1P Color" : "2P Color"}`,
          unit: "length",
          colourTier: tier,
          variant,
          stockLengthM: 6,
          unitPrice: byTier[tier][i],
          source: `Doc B '${tier === "white" ? "WHITE" : tier === "1p" ? "1P Color" : "2P Color"} (6m) One Length', Cills ${size}, ${variant[0].toUpperCase() + variant.slice(1)} column`,
        });
      });
    }
  }
  return out;
}

export const DOC_B: PriceDoc = {
  docKey: "sp-cills-per-length",
  supplierKey: "sunny-plast",
  supplierName: "Sunny Plast",
  sourceFile: "Cills Prices.pdf",
  effectiveDate: "2025-01-01", // the PDF states "Price list_2025" with no exact date
  currency: "GBP",
  priceBasis: "£ per 6 m one length; 3 colour tiers × Lorry/Company/Normal customer tiers",
  notes: "No exact effective date printed (labelled 'Price list_2025') — recorded as 2025-01-01. Only the Normal tier is applied to the catalog (cill sell price); Lorry/Company are recorded-only.",
  entries: build(),
};
