// =====================================================================
// price-lists/types.ts — shapes for the transcribed supplier price lists.
//
// GOLDEN RULE: every price in the doc-*.ts files is transcribed VERBATIM from
// a real Sunny Plast PDF in docs/price_list/ with a per-line `source` citation.
// Nothing here is guessed. These files are the reviewable source of truth; the
// import script (src/tools/import-prices.ts) reads them, writes the provenance
// tables, and applies the mapped numbers onto the catalog cost/price columns.
// The engine never imports this module.
// =====================================================================

export type PriceUnit = "m" | "m2" | "pc" | "lm" | "length" | "sheet";
/** Colour finish tier as the supplier lists it. */
export type ColourTier = "white" | "1p" | "2p";
/** Doc B customer volume tier (cills). */
export type CillVariant = "lorry" | "company" | "normal";

/** One transcribed price row. */
export interface PriceEntry {
  /** VERBATIM code from the PDF ("" when a row carries no code, e.g. Doc B/C). */
  supplierCode: string;
  /** Verbatim description. */
  description: string;
  unit: PriceUnit;
  /** Colour finish tier, when the row is a colour tier of a profile/cill/panel. */
  colourTier?: ColourTier;
  /** Doc B volume tier. */
  variant?: CillVariant;
  /** Pieces per pack where the row prices a pack (e.g. GLIS 04 Bump Stop = 2). */
  packQty?: number;
  /** Stock length (m) where the PDF states it (6 / 4.2). Enables per-6m→per-m. */
  stockLengthM?: number;
  /** Nett GBP per `unit`. */
  unitPrice: number;
  /** Per-line citation, e.g. "Doc A row 'Window Frame 70mm 5ch', White column". */
  source: string;
}

/** One transcribed price document (one PDF). */
export interface PriceDoc {
  /** Stable key, e.g. "sp-profiles-anglia-2025-04-25". */
  docKey: string;
  supplierKey: string;   // "sunny-plast"
  supplierName: string;  // "Sunny Plast"
  sourceFile: string;    // exact PDF filename in docs/price_list/
  effectiveDate: string; // ISO date "2025-04-25"
  currency: string;      // "GBP"
  priceBasis: string;    // human note on how the numbers are quoted
  notes?: string;
  entries: PriceEntry[];
}

/** A reference to a specific PriceEntry inside a doc (used by the mapping). */
export interface EntryRef {
  docKey: string;
  /** Match by supplier code (profiles/sliding). */
  supplierCode?: string;
  /** Match code-less rows (Doc B cills, Doc C panels) by their fields. */
  match?: { description?: string; colourTier?: ColourTier; variant?: CillVariant };
}

/**
 * A price reference that resolves to a single per-unit number. An array SUMS the
 * resolved values (used only for GLIS 10 lock + GLIS 11 keep → one lock&keep set).
 */
export type PriceRef = EntryRef | EntryRef[];

export type MapTable = "profile_part" | "glass" | "cill" | "hardware" | "auxiliary";

/**
 * Maps ONE catalog row (by table + partKey) to its supplier price(s). Applying
 * is always by partKey — never by fuzzy code match — so duplicate catalog codes
 * (frame-6ch/frame-french, transom-z-67/midrail-67, sash-door-z/sash-door-z-fr)
 * each get their own mapping and are all priced.
 */
export interface PriceMapping {
  target: { table: MapTable; kind?: string; partKey: string };
  /**
   * Base / White (or the single) price. cost = price = this nett value (owner
   * decision: cost = price = supplier net). Profiles also set the tier columns
   * from tier1p/tier2p below.
   */
  base?: PriceRef;
  tier1p?: PriceRef;
  tier2p?: PriceRef;
  /** Cills split cost/price across two docs (Doc A £/m cost, Doc B Normal price). */
  cost?: PriceRef;
  price?: PriceRef;
  /** Mandatory human note: exact match, alias, derivation, tier wiring. */
  note: string;
  /** Optional classifier for the mismatch report. */
  flag?: "alias" | "pack" | "derived" | "synthesized";
}
