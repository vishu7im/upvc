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
   * from this profile. The engine adds `effective × weldedEndCount` to the
   * finished Ext length to get the "welded" (saw-cut) length, so the welded
   * assembly shrinks back to the input W×H.
   *   effective = weldAllowanceMm > 0 ? weldAllowanceMm : Settings.weldAllowanceMm
   * i.e. **0 means "inherit the global default"** (Settings.weldAllowanceMm); a
   * positive value overrides it for this profile. Beads/steel never weld (0
   * welded ends), so the global never leaks onto them. Edited per part in the
   * admin catalog; the global is edited in admin settings.
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
  /**
   * Per-profile colour-tier prices (supplier price lists, M5.5). The supplier
   * lists visible profiles in three absolute £-per-unit tiers: White (the
   * `cost`/`price` above), "1P Colour 1P White" (foil one side), and "2P Colour"
   * (foil both sides). When present, `computePricing` uses the 1P/2P price for a
   * 1P/2P colour selection VERBATIM (no %-uplift stacking); each field may be
   * absent (e.g. beads have no 1P row) ⇒ that tier falls back to base × the
   * colour's %-uplift. Absent entirely ⇒ pre-M5.5 behaviour, byte-identical for
   * White. Only colour-bearing parts (frame/sash/transom/bead) carry these.
   */
  tierPrices?: { cost1p?: number; price1p?: number; cost2p?: number; price2p?: number };
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

/**
 * Transom/mullion: T-type (jamb stays continuous), Z-type (jamb breaks), or
 * S-type (STULP / French mullion — a SQUARE-CUT bar with no welded horns:
 * Ext == Int == the daylight span it sits in; calibrated Job 00000264).
 */
export interface TransomSection extends ProfileSection {
  jointType: "T" | "Z" | "S";
}

export interface Reinforcement extends ProfileSection {
  /**
   * Per-end length adjustment: steel length = bar Int − 2 × endClearance.
   * 0 = flush with Int (most Sunny Plast). Positive = the steel stops short of
   * each end; NEGATIVE = the steel runs PAST the Int span into the mitre zone
   * (sliding patio, Jobs 44/48: −15 ⇒ length = bar Int + 30 on every bar).
   */
  endClearance: number;
}

/**
 * Auxiliary (non-structural) profile cut for a job alongside the PVC/steel
 * bars — slide tracks, frame/sash cover caps, channel caps. Square-cut, never
 * welded, no Int/face concept; lengths are derived by family-specific engine
 * rules (see emitSlidingAuxBars in bars.ts, calibrated Jobs 44/48). Priced per
 * metre like any profile once the owner enters supplier prices.
 */
export interface AuxiliaryProfile {
  code: string;
  name: string;
  cost: number;
  price: number;
  per: "m";
  weight: number;
  financialCategory: string;
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
  /**
   * Optional display swatch (CSS hex, e.g. "#353b3f"). Cosmetic only — used to
   * tint the preview SVG / 3D view and the UI swatch. Absent ⇒ the historical
   * grey profile fill (so base/unsetted colours render byte-identically).
   */
  hex?: string;
  /**
   * Which per-profile tier price (`ProfileSection.tierPrices`) this colour picks
   * (M5.5). "1p" = foil one side, "2p" = foil both sides; absent ⇒ derive from
   * isBase (base ⇒ no tier; any non-base single colour ⇒ 2P, both sides coloured).
   * `solve.ts` sets this explicitly on the synthesized dual-colour option so an
   * inside/outside pair resolves the right tier. When a part has no tier price for
   * the resolved tier, pricing falls back to base × the %-uplift.
   */
  tier?: "1p" | "2p";
  /**
   * Surface texture of the finish, for the realistic preview only. Catalog data
   * (supplier fact) — NEVER inferred from `hex`, since nothing about a colour
   * value says whether the foil is grained. Absent ⇒ rendered smooth, and no
   * document or price is affected either way.
   */
  texture?: "woodgrain";
}

/**
 * A selectable cill (window sill) — an external profile fitted BELOW the outer
 * frame. Selecting any cill reduces the manufacturing height by a fixed 30 mm
 * (independent of size); the customer-entered height is unchanged for display.
 * `projectionMm` (95/150/180) is the nominal cill size and doubles as the SVG
 * draw height. Priced per metre of product width (a costed BOM/cut line).
 */
export interface CillOption {
  key: string;
  code: string;
  name: string;
  /** Nominal cill size in mm (95/150/180); also the SVG draw height. */
  projectionMm: number;
  cost: number;
  price: number;
  per: "m";
  weight: number;
  financialCategory: string;
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
  /**
   * Auxiliary profiles (tracks/caps) cut alongside the bars. Optional — only
   * families with calibrated aux rules (sliding patio) consume them; absent ⇒
   * no aux rows, byte-identical to pre-aux output.
   */
  auxiliaries?: Record<string, AuxiliaryProfile>;
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
   * Selectable cills (window sills). Empty ⇒ no cill concept. There is no
   * default cill: "None" is the implicit default (omitting `cillKey` ⇒ no 30mm
   * deduction and no cill drawn, byte-identical to a no-cill quote).
   */
  cills: Record<string, CillOption>;

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
 * A design preview embedded in a document header, plus a caption. Order
 * documents prefer the stored catalog `imageSvg` so they match the product
 * gallery/configurator; engine-generated SVG remains a fallback.
 */
export interface DocImage {
  svg: string;        // SVG markup from catalog preview or engine fallback
  caption: string;    // e.g. "Casement 2×1 — 1200 × 1500 mm"
}

/**
 * Cill display info for document headers. When present, the header shows the
 * cill name and the (reduced) manufacturing height alongside the unchanged
 * customer Width × Height. Omitted ⇒ no cill rows (byte-identical header).
 */
export interface DocCill {
  name: string;
  manufacturingHeightMm: number;
}

/**
 * Colour/finish display info for document headers. When present, the header
 * shows the selected inside colour and (if different) the outside colour.
 * Omitted ⇒ no colour row (byte-identical header for default White quotes).
 */
export interface DocColour {
  /** Inside / primary colour name (e.g. "White"). */
  inside: string;
  /** Outside colour name when a dual-colour finish was chosen (absent ⇒ single colour). */
  outside?: string;
}

/**
 * The order-level commercial block for documents (Designer phase 6): extras,
 * discount, tax and the customer-facing grand total. Plain DATA, like
 * `DocBranding` — the engine computes none of it (`src/designer/basket.ts`
 * does) and stays pure. Omitted ⇒ no basket block, byte-identical output.
 */
export interface DocBasket {
  currency: string;
  itemsSubtotal: number;
  /** Order-level pricing adjustment vs. the sum of the lines (0 ⇒ not shown). */
  itemsAdjustment?: number;
  discount: number;
  discountCode?: string | null;
  fitting: number;
  survey: number;
  delivery: number;
  taxRatePct: number;
  tax: number;
  grandTotal: number;
}

/**
 * One advisory note printed on the Work Order: a fabrication limit this job
 * knowingly goes past (an oversize unit, an over-max sash, a >1.8 m divider).
 *
 * The engine computes none of it — the Designer's resolver raises the issue and
 * `src/api/orders.ts` hands the surviving advisories over, exactly as it hands
 * over `DocBranding` / `DocBasket`. Omitted / empty ⇒ no block, byte-identical
 * output. These NEVER block confirm (ADVISORY_ISSUE_KINDS, line-item-types.ts):
 * exceeding a printed maximum is the fabricator's call, and the shop floor
 * needs to be told, not stopped.
 */
export interface DocAdvisory {
  /** Which line item it concerns, e.g. "4050 × 1040 mm". */
  item: string;
  message: string;
  /** The printed source the limit came from (HAWDIO p70 …), when cited. */
  source?: string;
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
  /**
   * Global welding-shrinkage allowance (mm per welded end) used as the DEFAULT
   * for every welded profile. A profile's own `weldAllowanceMm` overrides this
   * when it is > 0; a profile value of 0 means "inherit this global". Non-welded
   * pieces (beads/steel) have 0 welded ends so this never affects them.
   */
  weldAllowanceMm?: number;
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
  | "door-left"
  // French door pair (calibrated from Job 00000264, docs/french-door/*). The
  // MASTER leaf carries the handle/lock; the SLAVE leaf carries the STULP
  // French mullion + shootbolt. Hinge side is positional (each leaf hinges on
  // its outer jamb), so it is not encoded in the kind.
  | "french-door-master"
  | "french-door-slave"
  // Sliding patio panels. A patio panel is always a framed sash (cut identically
  // whether it slides or is fixed); these distinguish behaviour for hardware
  // allocation and the SVG slide-direction arrow only.
  | "sliding-fixed"
  | "sliding-slide-left"
  | "sliding-slide-right";

/** A cell is a rectangle of the window split tree. */
export interface CellSpec {
  /** "fixed", "sash:...", "door:..." */
  content: SashKind;
  /** Which profile keys to use for this cell's sash (if any). */
  sashKey?: string;
  /** Which bead/glass to use here (defaults to system default). */
  beadKey?: string;
  glassKey?: string;
  /**
   * Midrails INSIDE this cell's sash (French doors, Job 00000264; casement
   * Job 154): the sash stays ONE welded ring — one opener, one handle, one set
   * of gear — and each midrail is a horn-cut bar welded between the sash
   * members (Ext = sash Int + 2 × face), splitting the glazing into panes with
   * their own beads/glass.
   *
   * `atRatio` is the midrail centreline as a fraction of the FULL window
   * dimension on its axis (height for horizontal, width for vertical) — the
   * same semantics as `splitAtRatio`.
   *
   * `axis` defaults to "horizontal", which is the Job 00000264 French case, so
   * every pre-existing design is unchanged. The VERTICAL case is calibrated by
   * Job 154 (Work Order - windows - 27-07-2026.pdf p4): the same
   * Ext = Int + 2 × face rule on the other axis — printed 631 for the 78 mm
   * SPQ-5-30252 in a 633 sash (Int 475), exactly as its horizontal twin on p3.
   *
   * Only valid on sash-bearing cells; absent ⇒ unchanged.
   */
  midrails?: { transomKey: string; atRatio: number; axis?: "horizontal" | "vertical" }[];
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
    }
  | {
      // Sliding patio: a single row of `n` equal-width framed panels (no transom,
      // no mullion, no interlock profile — see CLAUDE.md "Sliding Patio"). The
      // solver lays out one SolvedCell per panel; panel width comes from the
      // calibrated bypass/centre-meeting formula (topology.ts), not daylight
      // division. Always a root-level node (sliding rows are never nested).
      kind: "sliding";
      sashKey: string;                 // the sliding sash profile (e.g. "sash-sliding")
      glassKey?: string;
      beadKey?: string;
      /** Panels left→right; length = panel count n. */
      panels: { role: "fixed" | "slide"; slideDir?: "left" | "right" }[];
      /** true only for centre-meeting OXXO (two sliders meet); selects the OXXO width formula. */
      meeting?: boolean;
      /**
       * Per-quote unequal-span override (drag-to-resize): n−1 cumulative daylight
       * fractions 0<b₁<…<b_{n-1}<1. Panel i's share fᵢ = bᵢ − bᵢ₋₁ (b₀=0, bₙ=1).
       * Absent ⇒ equal panels (1/n each) ⇒ byte-identical to the calibrated default.
       * Written by `applySplitRatios` from `splitRatios` keys "root.b{i}".
       */
      boundaries?: number[];
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
  /**
   * Per-design default manufacturing size (mm). Used to pre-load the configurator
   * and to render the gallery preview at a representative size, replacing the old
   * hardcoded 1200×1200. Optional: absent ⇒ caller falls back to a sensible
   * default. Derived from the design's reference work order (e.g. sliding-patio
   * OX = 1500×1750).
   */
  defaultWidthMm?: number;
  defaultHeightMm?: number;
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
  jointType: "T" | "Z" | "S";
}

export interface SolvedMullion {
  rect: Rect;
  parentPathId: string;
  mullionKey: string;
  extLengthMm: number;
  intLengthMm: number;
  jointType: "T" | "Z" | "S";
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
  /**
   * The selected cill, drawn as a bar below the frame (svg.ts) and emitted as a
   * per-metre cut/BOM line (bars.ts). `rect` sits at y = manufacturing height
   * (outer.h). Undefined ⇒ no cill (byte-identical geometry).
   */
  cill?: { rect: Rect; code: string; name: string; projectionMm: number };
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

/**
 * Elevation variants the engine can render in addition to the default external
 * preview (Designer phase 5): the internal (mirrored, handled) elevation and
 * the annotated technical drawing.
 */
export type QuoteView = "internal" | "schematic";

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
   * Per-quote chamber selection. Frame `partKey` (e.g. "frame-5ch" / "frame-6ch")
   * to swap the design's frame profile; the engine derives geometry from the
   * chosen frame's faceWidth. Omitted (or == the design's baked `frameKey`) ⇒ the
   * design default, so a quote without it is byte-identical.
   */
  frameKey?: string;
  /**
   * Per-quote colour/finish selection (U3). Colour `key` whose % uplift applies
   * to the visible profiles at pricing time. Omitted ⇒ system `defaultColourKey`
   * (base White = 0%), so a quote without it is byte-identical to pre-U3.
   */
  colourKey?: string;
  /**
   * Per-quote OUTSIDE colour/finish selection. When supplied and different from
   * `colourKey` (the inside/primary colour), the engine SUMS the two colours'
   * uplifts onto the visible profiles (dual-colour finish). Omitted (or equal to
   * `colourKey`) ⇒ single-colour behaviour, so a quote without it is byte-identical
   * to pre-existing single-colour quotes (and the 157 assertions hold).
   */
  colourKeyOutside?: string;
  /**
   * Per-quote cill selection. Cill `key` whose nominal size picks the physical
   * cill profile; selecting any cill reduces the manufacturing height by a fixed
   * 30 mm (the customer-entered height is unchanged for display). Omitted ⇒ no
   * cill, so a quote without it is byte-identical to a no-cill quote.
   */
  cillKey?: string;
  /**
   * Per-quote internal split overrides (multi-span editing). Keyed by the split
   * node's pathId ("root", "root.top", …); value is a FULL-WINDOW fraction 0..1
   * (hsplit ⇒ y/heightMm, vsplit ⇒ x/widthMm, matching solveTopology's
   * splitAtRatio*windowH / *windowW). Omitted/empty ⇒ the design's baked splits,
   * so a quote without it is byte-identical to pre-existing quotes.
   */
  splitRatios?: Record<string, number>;
  /**
   * Draw the inner-joint overlay (45° mitre corners + T/Z divider markers) on
   * the rendered preview SVG embedded in documents. Purely visual; omitted/false
   * ⇒ no overlay, so a quote without it is byte-identical to pre-existing quotes.
   */
  showJoints?: boolean;
  /**
   * Extra elevation variants to render alongside the default external preview
   * (Designer phase 5). Purely visual, like `showJoints`: they are rendered
   * from the SAME solved geometry with the same colour/joint options and land
   * in `QuoteOutput.geometry.svgViews`. Omitted/empty ⇒ no extra render and no
   * extra field, so a quote without it is byte-identical to pre-existing quotes.
   */
  views?: QuoteView[];
  /**
   * How the PREVIEW is drawn. "realistic" turns on the presentation style
   * (bevelled mitred faces, moulded bead, glazed glass, soft shadow) for
   * `geometry.svg` and `geometry.svgViews` — the live configurators only.
   * The SVG embedded in the DOCUMENTS stays flat regardless, so paperwork is
   * byte-identical with or without this field. Omitted / "flat" ⇒ unchanged.
   */
  svgStyle?: "flat" | "realistic";
  /**
   * Per-quote hardware slot substitutions (Designer phase 2). Keyed by the
   * engine's conceptual hardware SLOT (today: "handle"); the value is the
   * catalog hardware partKey to fit in that slot instead of the calibrated
   * default. Only 1:1 slots are substitutable — size-SELECTED gear (espag,
   * friction stay) is never a slot (questions.md Q19). Unknown keys throw.
   * Omitted ⇒ the calibrated defaults, byte-identical to pre-existing quotes.
   */
  hardwareOverrides?: Record<string, string>;
  /**
   * Per-quote topology override (Designer phase 2). When present, the design is
   * cloned with THIS cell tree instead of its stored topology — the seam through
   * which the designer's topology edits (add transom/mullion/midrail, sash-kind
   * and component conversions, per-cell glass pinning) reach the engine. Same
   * clone-on-override pattern as `glassKey`/`frameKey`; the stored design is
   * never mutated. Omitted ⇒ the design's own topology, byte-identical.
   */
  topologyOverride?: CellNode;
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
    /** The selected cill drawn below the frame (absent ⇒ no cill). */
    cill?: { rect: Rect; code: string; name: string; projectionMm: number };
    /** Generated SVG markup (mm coordinate system). */
    svg: string;
    /**
     * The extra elevation variants asked for via `QuoteInput.views`, in the
     * same mm coordinate system as `svg`. Absent unless requested.
     */
    svgViews?: Partial<Record<QuoteView, string>>;
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
