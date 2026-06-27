// =====================================================================
// types.ts — the contracts that bind the whole engine together.
// Keep this file boring and stable; if a shape changes here, every
// module that touches it must change too.
// =====================================================================

// ---------- Catalog: a profile system and its parts -----------------

export interface ProfileSection {
  /** Stable part code that appears on docs (e.g. "SPQ-5-10252"). */
  code: string;
  /** Human-readable name printed on docs (e.g. "Frame 5 Chamber"). */
  name: string;
  /**
   * Mitered face width in mm — the deduction that turns Ext length into Int.
   *    Int = Ext - 2 * faceWidth
   * For Sunny Plast: Frame-5ch=64, Sash-T=79, Door-Z=105, Transom-67=67, Bead=20.
   */
  faceWidth: number;
  /**
   * Welding shrinkage allowance in mm consumed at EACH welded end of a bar cut
   * from this profile. The engine adds `weldAllowanceMm × weldedEndCount` to the
   * finished Ext length to get the "welded" (saw-cut) length, so the welded
   * assembly shrinks back to the input W×H. 0 ⇒ no compensation (e.g. beads,
   * steel reinforcement). Configurable per part via the admin catalog.
   * Sunny Plast default: frame/sash/transom = 2.5 mm/end (5 mm/bar).
   */
  weldAllowanceMm: number;
  /** Cost £/per-unit, price £/per-unit. Fill from your supplier price list. */
  cost: number;
  price: number;
  /** "m" for linear profiles, "pc" for hardware, "m2" for glass, etc. */
  per: "m" | "pc" | "m2" | "set";
  /** Weight per unit (kg/m for linear, kg/pc for parts). */
  weight: number;
  /** Financial category from your spec (e.g. "Frame – (Standard)"). */
  financialCategory: string;
}

/** Glass profile data. */
export interface GlassSection {
  code: string;
  name: string;
  /** How much glass extends behind the bead, per side (mm). */
  rebatePerSide: number;
  cost: number;
  price: number;
  per: "m2";
  weight: number;
  financialCategory: string;
}

/** Bead profile data (mitered like frame/sash). */
export interface BeadSection extends ProfileSection {
  /** Bead stick-out from the rebate (e.g. 28mm). */
  stickOut: number;
}

/** Sash profile (includes its overlap-into-frame rule). */
export interface SashSection extends ProfileSection {
  /** How far the sash extends INTO the frame rebate, per side (mm). */
  overlap: number;
  /** Sash rebate depth for glass (mm per side). */
  glassRebate: number;
}

/** Frame profile (includes its glass rebate for fixed glazing). */
export interface FrameSection extends ProfileSection {
  glassRebate: number;
}

/** Transom/mullion: T-type (jamb stays continuous) or Z-type (jamb breaks). */
export interface TransomSection extends ProfileSection {
  jointType: "T" | "Z";
}

export interface Reinforcement extends ProfileSection {
  /** If the bar must lose some length at each end (most Sunny Plast: 0). */
  endClearance: number;
}

export interface Gasket {
  code: string;
  name: string;
  cost: number;
  price: number;
  per: "m";
  weight: number;
  financialCategory: string;
}

export interface HardwareItem {
  code: string;
  name: string;
  cost: number;
  price: number;
  per: "pc";
  weight: number;
  financialCategory: string;
  /** Optional: for length-dependent items (espagnolettes, friction hinges). */
  lengthMm?: number;
}

/**
 * A selectable colour/finish (M5). Applies a percentage uplift to the
 * VISIBLE profile lines (frame/sash/transom/bead) at pricing time. The base
 * colour carries 0% uplift, so a default-colour quote is byte-identical to
 * pre-M5. Real foiled-colour uplifts are entered via the admin catalog API.
 */
export interface ColourOption {
  key: string;
  code: string;
  name: string;
  /** % added to profile cost (0 = base colour). */
  costUpliftPct: number;
  /** % added to profile price (0 = base colour). */
  priceUpliftPct: number;
  /** Marks the base/no-uplift colour for the system. */
  isBase: boolean;
}

/** The full per-system catalog. */
export interface ProfileSystem {
  systemId: string;
  name: string;
  currency: string;             // "GBP"
  stockBarLengthMm: number;     // 6000
  sawKerfMm: number;            // saw blade width per cut (5mm typical)

  frames: Record<string, FrameSection>;
  sashes: Record<string, SashSection>;
  transoms: Record<string, TransomSection>;
  beads: Record<string, BeadSection>;
  reinforcement: Record<string, Reinforcement>;
  gaskets: Record<string, Gasket>;
  glass: Record<string, GlassSection>;
  hardware: Record<string, HardwareItem>;

  /**
   * Selectable colours/finishes (M5). Empty ⇒ no colour concept (no uplift).
   * `defaultColourKey` is the colour applied for pricing today (per-quote
   * selection is deferred to the configurator UI in Phase 2).
   */
  colours: Record<string, ColourOption>;
  defaultColourKey?: string;

  /**
   * Which reinforcement code goes inside which profile.
   * Map keys are profile codes; values are reinforcement keys.
   * If a profile code is missing, that profile gets no reinforcement.
   */
  reinforcementMap: Record<string, string>;
}

/**
 * Render-ready company branding stamped onto document headers (M4).
 * The logo is an embedded data-URI so documents/PDFs are self-contained
 * (the catalog loader resolves the stored object key → data-URI). All optional:
 * absent branding renders the plain header, exactly as before M4.
 */
export interface DocBranding {
  companyName?: string;
  address?: string;
  accentColor?: string;   // CSS colour for header accents (e.g. "#1f6feb")
  logoDataUri?: string;   // e.g. "data:image/png;base64,…"
}

/**
 * A design preview embedded in a document header: the solved-geometry SVG
 * rendered at the *modified* (chosen W×H) dimensions, plus a caption. Pure data
 * (the SVG is already produced by `renderSvg`); documents stay pure. Order-level
 * docs carry one image per line item; a single quote carries exactly one.
 */
export interface DocImage {
  svg: string;        // SVG markup at the modified dimensions (from renderSvg)
  caption: string;    // e.g. "Casement 2×1 — 1200 × 1500 mm"
}

/** Project-level financial & display settings (Phase 1: GBP, 20% tax, 75% markup, 10% wastage). */
export interface Settings {
  currency: string;       // "GBP"
  taxApply: boolean;      // true
  taxPct: number;         // 20
  markupPct: number;      // 75
  wastagePct: number;     // 10  (applied to profile/bead material on quote, not on cut list)
  labour: {
    perSash: number;      // £ per opening sash
    perDoor: number;      // £ per door panel
    base: number;         // £ flat per order
  };
  /** Global company branding for document headers (M4). Undefined ⇒ plain header. */
  branding?: DocBranding;
}

// ---------- Topology: how a window decomposes into cells ------------

export type SashKind =
  | "fixed"
  | "casement-side-left"
  | "casement-side-right"
  | "casement-top"
  | "tilt-turn"
  | "door-right"
  | "door-left";

/** A cell is a rectangle of the window split tree. */
export interface CellSpec {
  /** "fixed", "sash:...", "door:..." */
  content: SashKind;
  /** Which profile keys to use for this cell's sash (if any). */
  sashKey?: string;
  /** Which bead/glass to use here (defaults to system default). */
  beadKey?: string;
  glassKey?: string;
}

/** Recursive cell tree node — describes a design's split structure. */
export type CellNode =
  | { kind: "leaf"; cell: CellSpec }
  | {
      kind: "hsplit";
      /** y position in millimetres FROM TOP, on a 1000-tall canonical canvas. Scaled at solve time. */
      splitAtRatio: number;
      transomKey: string;        // which transom profile to use
      top: CellNode;
      bottom: CellNode;
    }
  | {
      kind: "vsplit";
      splitAtRatio: number;
      mullionKey: string;
      left: CellNode;
      right: CellNode;
    };

/** A design = a frame profile choice + a cell-tree topology + metadata. */
export interface Design {
  designId: string;          // your stable id; can map to a Quotila SVG id later
  name: string;              // e.g. "Casement: top sash + fixed below"
  productType: "window" | "door";
  frameKey: string;          // default frame profile to use
  topology: CellNode;
  /** Drawing-only SVG you may have for this design (optional). */
  svgPreview?: string;
}

// ---------- Solved geometry: rectangles ready for SVG & cutting -----

export interface Rect { x: number; y: number; w: number; h: number; }

export interface SolvedCell {
  pathId: string;
  outer: Rect;          // cell bounding box in window coords
  daylight: Rect;       // glazing visible area
  content: SashKind;
  sashKey?: string;
  beadKey: string;
  glassKey: string;
  /** Sash outer rect (only if sash) */
  sashOuter?: Rect;
  /** Sash inner rect = where glass+bead live (only if sash) */
  sashInner?: Rect;
  /** Where the actual glass pane sits */
  glassRect: Rect;
  /** Bead Int dimensions (what's printed on docs). */
  beadIntW: number;
  beadIntH: number;
}

export interface SolvedTransom {
  /** Rect describing the transom strip in window coords. */
  rect: Rect;
  /** "Span" cells to either side of this transom that the transom physically connects to. */
  parentPathId: string;
  transomKey: string;
  /** Cut Ext length (mm). */
  extLengthMm: number;
  /** Visible Int length. */
  intLengthMm: number;
  jointType: "T" | "Z";
}

export interface SolvedMullion {
  rect: Rect;
  parentPathId: string;
  mullionKey: string;
  extLengthMm: number;
  intLengthMm: number;
  jointType: "T" | "Z";
}

/** Fully solved geometry produced by the topology solver. */
export interface SolvedGeometry {
  outer: Rect;
  /** Daylight rect inside the frame face. */
  rootDaylight: Rect;
  cells: SolvedCell[];
  transoms: SolvedTransom[];
  mullions: SolvedMullion[];
  /** Whether the outer frame jambs are broken by a root-level Z-transom (Job 85). */
  jambsBrokenAtY?: number;
  /**
   * Count of zero-profile "meeting-stile" dividers (French doors): two sashes
   * abut directly with no mullion. Drives passive-leaf shootbolt hardware.
   * Undefined/0 for every calibrated job (85/88/90).
   */
  meetingStiles?: number;
}

// ---------- Parts: what gets cut & purchased -----------------------

export interface BarPiece {
  /** Profile or reinforcement code this piece comes from. */
  code: string;
  /** Description for docs. */
  name: string;
  /** Where this bar goes — "Frame top", "Sash L head", etc. */
  position: string;
  /** Horizontal or vertical bar — drives V/H column on docs. */
  orientation: "H" | "V";
  /** Cut length (raw bar length needed) — the FINISHED size, pre-weld-allowance. */
  extMm: number;
  /**
   * Saw-cut length WITH welding shrinkage compensation, i.e.
   *   weldedExtMm = extMm + weldAllowanceMm × weldedEndCount
   * Cut to THIS on a welded line so the finished assembly equals the input W×H.
   * Equals `extMm` whenever the profile's weld allowance is 0, so the default
   * ("normal") output is byte-identical.
   */
  weldedExtMm: number;
  /** How many of this piece's ends are welded (drives the compensation + doc note). */
  weldedEndCount: number;
  /** Visible (internal) length — Ext minus miter losses. */
  intMm: number;
  /** End-prep notation matching Quotila docs: e.g. "\\ - /", "< - >", "[ - ]", "\\ - Y]" */
  endPrep: string;
  /** Optional reinforcement: its own piece records its own length. */
  reinforcementCode?: string;
  reinforcementLengthMm?: number;
}

export interface GlassPiece {
  /** Glass type code. */
  code: string;
  name: string;
  /** Location label e.g. "01 (Frame-01)". */
  label: string;
  widthMm: number;
  heightMm: number;
  areaM2: number;
}

export interface HardwarePiece {
  code: string;
  name: string;
  qty: number;
  /** Optional explanation of why this qty (for debugging). */
  why?: string;
}

export interface GasketPiece {
  code: string;
  name: string;
  lengthMm: number;
}

export interface SolvedParts {
  /** Frame, sash, transom, mullion, bead, reinforcement, etc. — anything cut from a bar. */
  bars: BarPiece[];
  /** Reinforcement pieces (also bars but listed separately for the BOM). */
  reinforcement: BarPiece[];
  glass: GlassPiece[];
  gaskets: GasketPiece[];
  hardware: HardwarePiece[];
}

// ---------- Cutting optimization -----------------------------------

export interface CutBar {
  /** Profile code being cut from this bar. */
  code: string;
  /** Total stock bar length used. */
  stockMm: number;
  /** Pieces placed on this bar in order. */
  cuts: { position: string; lengthMm: number }[];
  /** Remaining drop length (mm). */
  remainderMm: number;
  /** Used length (sum of cuts + kerfs). */
  usedMm: number;
}

export interface CuttingPlan {
  /** Group of bars per profile code. */
  byCode: Record<string, { name: string; bars: CutBar[]; totalLengthMm: number; utilizationPct: number }>;
}

// ---------- Pricing ------------------------------------------------

export interface LineItem {
  code: string;
  description: string;
  category: string;
  qty: number;
  unit: "m" | "pc" | "m2" | "set";
  unitCost: number;
  unitPrice: number;
  totalCost: number;
  totalPrice: number;
}

export interface Pricing {
  currency: string;
  lines: LineItem[];
  totals: {
    materialCost: number;
    materialPrice: number;     // includes wastage (10% on profiles/beads only)
    labour: number;
    factoryCost: number;       // materialCost + labour
    markup: number;            // 75% on factoryCost (per your spec)
    netPrice: number;          // factoryCost + markup
    tax: number;               // 20% of netPrice
    grandTotal: number;
  };
}

// ---------- The full quote (engine output) -------------------------

/**
 * Custom-mode overrides: per-quote adjustments to the per-profile bend/weld
 * allowances that normally come from the catalog. Keyed by profile record key
 * (e.g. "frame-5ch", "sash-t"). Anything omitted falls back to the catalog
 * value, so an empty/undefined object reproduces Default mode exactly.
 */
export interface EngineOverrides {
  /** Saw blade width per cut (affects cutting plan only). */
  sawKerfMm?: number;
  frames?: Record<string, Partial<Pick<FrameSection, "faceWidth" | "glassRebate" | "weldAllowanceMm">>>;
  sashes?: Record<
    string,
    Partial<Pick<SashSection, "faceWidth" | "overlap" | "glassRebate" | "weldAllowanceMm">>
  >;
  transoms?: Record<string, Partial<Pick<TransomSection, "faceWidth" | "weldAllowanceMm">>>;
  beads?: Record<string, Partial<Pick<BeadSection, "faceWidth" | "weldAllowanceMm">>>;
  reinforcement?: Record<string, Partial<Pick<Reinforcement, "endClearance" | "weldAllowanceMm">>>;
}

export interface QuoteInput {
  orderNo: string;
  customer: string;
  reference?: string;
  designId: string;
  widthMm: number;
  heightMm: number;
  systemId: string;
  settings?: Partial<Settings>;
  /**
   * Extraction mode. "default" (or omitted) uses catalog allowances.
   * "custom" applies `overrides` on top of the catalog.
   */
  mode?: "default" | "custom";
  /** Per-profile allowance overrides (used when mode === "custom"). */
  overrides?: EngineOverrides;
  /**
   * Per-quote glass selection (U3). Glass `partKey` to glaze every cell that
   * doesn't pin its own glass. Omitted ⇒ the design's baked default, so a quote
   * without it is byte-identical to pre-U3.
   */
  glassKey?: string;
  /**
   * Per-quote colour/finish selection (U3). Colour `key` whose % uplift applies
   * to the visible profiles at pricing time. Omitted ⇒ system `defaultColourKey`
   * (base White = 0%), so a quote without it is byte-identical to pre-U3.
   */
  colourKey?: string;
}

export interface QuoteOutput {
  input: QuoteInput;
  systemName: string;
  designName: string;

  /** Solved geometry — everything you need to draw the preview. */
  geometry: {
    outer: Rect;
    cells: SolvedCell[];
    transoms: SolvedTransom[];
    mullions: SolvedMullion[];
    /** Generated SVG markup (mm coordinate system). */
    svg: string;
  };

  parts: SolvedParts;
  cuttingPlan: CuttingPlan;
  pricing: Pricing;

  /** Ready-to-render HTML for each document. PDF is one Puppeteer call away. */
  documents: {
    workOrder: string;
    cuttingList: string;
    bom: string;
    priceSummary: string;
  };
}
