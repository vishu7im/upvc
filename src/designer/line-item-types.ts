// =====================================================================
// designer/line-item-types.ts — the Designer line-item contracts.
//
//   Spec/00-architecture/line-item-schema.md  §2 (LineItemDraft)
//                                             §3 (ResolvedLineItem)
//   Spec/00-architecture/product-family-plugin.md §3 (EngineAdapter)
//
// PURE DATA declarations, like option-types.ts: no I/O, no Prisma. The
// `draft` column on `designer_line_item` holds a LineItemDraft verbatim;
// `resolved` holds a ResolvedLineItem.
// =====================================================================

import type {
  CellNode,
  Design,
  Pricing,
  ProfileSystem,
  QuoteInput,
  QuoteOutput,
  QuoteView,
  Rect,
  Settings,
  SolvedGeometry,
} from "../types.ts";
import type {
  ApplyScope,
  ComponentType,
  OptionSystem,
  ProductFamilyDescriptor,
  SplitMode,
  TopologyEdit,
} from "./option-types.ts";

// ---------------------------------------------------------------------
// LineItemDraft (user intent — line-item-schema.md §2)
// ---------------------------------------------------------------------

/** The only schema version the resolver understands. Readers fail loud on others. */
export const LINE_ITEM_SCHEMA_VERSION = 1;

/**
 * One scoped option answer. Uniqueness key = (optionKey, scope); setting the
 * same pair again replaces. `scope` is absent (item level), a componentId
 * ("cell:root.top/glass"), or "<type>:*" (an "all of type" apply — kept
 * unexpanded so components added later inherit it).
 */
export interface DraftSelection {
  optionKey: string;
  /** Choice options store the chosen choice key… */
  choiceKey?: string;
  /** …text/number options store the raw value instead. */
  value?: string | number | boolean;
  scope?: string;
  /** Which apply-scope the user used (recorded for the UI; no resolve effect). */
  appliedVia?: ApplyScope;
}

/** A topology edit as persisted on a draft: the edit + a local undo id. */
export interface DraftTopologyEdit {
  /** Local id so the UI can undo/remove a specific edit. */
  id: string;
  edit: TopologyEdit;
}

export interface LineItemDraft {
  schemaVersion: number;
  familyKey: string;
  systemId: string;
  /** Starting topology from the design gallery (never null for cellnode families). */
  designId: string;
  quantity: number;
  /** Free text, printed on documents. */
  location?: string;
  /** Keys from the family descriptor's dimension list (widthMm, heightMm, …). */
  dimensions: Record<string, number>;
  splitMode?: SplitMode;
  /** EXISTING engine format, reused verbatim (QuoteInput.splitRatios). */
  splitRatios?: Record<string, number>;
  topologyEdits?: DraftTopologyEdit[];
  selections?: DraftSelection[];
}

// ---------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------

export type IssueSeverity = "warning" | "error";

export type IssueKind =
  | "schema-version"
  | "unknown-family"
  | "unknown-system"
  | "unknown-design"
  | "unknown-option"
  | "unknown-choice"
  | "unknown-component"
  | "missing-dimension"
  | "dimension-out-of-range"
  | "missing-selection"
  | "invalid-value"
  | "conflicting-selection"
  | "topology-edit-failed"
  | "not-implemented"
  | "constraint"
  | "size-limit"
  | "solve-failed";

export interface LineItemIssue {
  severity: IssueSeverity;
  kind: IssueKind;
  message: string;
  /** Option the issue is about (missing-selection, unknown-choice, …). */
  optionKey?: string;
  /** Component scope of the issue, when it concerns one component. */
  scope?: string;
  /** Dimension key (dimension-out-of-range / missing-dimension). */
  dimensionKey?: string;
  /** Constraint id (kind "constraint"). */
  constraintId?: string;
  /** Topology edit id (kind "topology-edit-failed"). */
  editId?: string;
  /** Citation for fabrication rules (golden rule). */
  source?: string;
}

// ---------------------------------------------------------------------
// ResolvedLineItem (computed cache — line-item-schema.md §3)
// ---------------------------------------------------------------------

export interface ResolvedSummary {
  sizeLabel: string;
  colourLabel?: string;
  locationLabel?: string;
  leafCount: number;
  glassSizes: { componentId: string; wMm: number; hMm: number }[];
}

export interface ResolvedLineItem {
  resolvedAt: string;
  /** Provenance of the prices used (loadCatalog timestamp). */
  catalogVersion: string;
  issues: LineItemIssue[];
  /** true ⇒ blocks confirm (NOT preview) — mirrors the reference flags. */
  invalidDimensions: boolean;
  invalidSpec: boolean;
  /** Engine Pricing verbatim; absent when the solve itself failed. */
  pricing?: Pricing;
  summary?: ResolvedSummary;
  /**
   * The rendered elevations. `external` is always present on a successful
   * solve; `internal` / `schematic` appear only when the caller asked for them
   * (`ResolveOptions.views`), so a payload stays lean by default (phase 5).
   */
  geometrySvg?: { external?: string; internal?: string; schematic?: string };
  /**
   * Solved rects — the `/api/quote` geometry MINUS its `svg` (that markup is
   * already in `geometrySvg.external`; carrying it twice would double the size
   * of every persisted resolve). Additive in phase 3: the designer canvas needs
   * mm coordinates to place drag handles on dividers, and phase 4 needs them to
   * hit-test component selection. Absent when the solve failed.
   */
  geometry?: Omit<QuoteOutput["geometry"], "svg">;
  /**
   * The adapter's addressable components (stable ids + mm hit-test rects) for
   * the SOLVED geometry. Additive in phase 4: the canvas hit-tests and the
   * Structure tab labels from this, and the scoped Options tab needs each
   * component's `type`/`kind` to know which options apply — all of which would
   * otherwise mean re-deriving topology in the browser. Absent when the solve
   * failed.
   */
  components?: ComponentRef[];
}

// ---------------------------------------------------------------------
// Engine adapter contract (product-family-plugin.md §3)
// ---------------------------------------------------------------------

/** An addressable component with a stable position-derived id (never a uuid). */
export interface ComponentRef {
  componentId: string;
  type: ComponentType;
  /** e.g. "Sash 2 (top hung)" — canvas/issue labels. */
  label: string;
  /** Hit-test rect in window mm coordinates. */
  rect: Rect;
  /** The engine pathId this component derives from ("root.top", …). */
  path: string;
  /** Sash kind / divider joint — whatever refines `type` for rules. */
  kind?: string;
}

/** What `applyEdit` needs beyond the tree: current solved geometry for "equal" positions. */
export interface AdapterEditContext {
  widthMm: number;
  heightMm: number;
  geometry: SolvedGeometry;
  system: ProfileSystem;
}

export interface EngineAdapter {
  /** Apply one topology edit immutably; returns a NEW tree. Throws on an illegal edit. */
  applyEdit(topology: CellNode, edit: TopologyEdit, ctx: AdapterEditContext): CellNode;
  /** Enumerate addressable components with stable ids + hit-test rects. */
  listComponents(geometry: SolvedGeometry): ComponentRef[];
  /** Build the engine QuoteInput for a draft + working topology + effect outputs. */
  toQuoteInput(args: {
    draft: LineItemDraft;
    design: Design;
    workingTopology: CellNode;
    topologyEdited: boolean;
    effects: EngineEffectOutputs;
    /** Extra elevations to render (phase 5); omitted ⇒ external only. */
    views?: QuoteView[];
  }): QuoteInput;
}

/** What mapping the effective selections through their engineEffects produced. */
export interface EngineEffectOutputs {
  glassKey?: string;
  colourKey?: string;
  colourKeyOutside?: string;
  cillKey?: string;
  frameKey?: string;
  hardwareOverrides?: Record<string, string>;
  /** Plain priced add-lines (catalog hardware part × qty), appended post-solve. */
  bomLines?: { partKey: string; qty: number }[];
}

// ---------------------------------------------------------------------
// Catalog snapshot (what the resolver reads instead of doing I/O)
// ---------------------------------------------------------------------

/**
 * The resolver is PURE: the API layer hands it this snapshot (backed by the
 * loader's in-memory cache); tests hand it a synthetic one. `catalogVersion`
 * stamps provenance onto every resolve.
 */
export interface CatalogSnapshot {
  catalogVersion: string;
  settings: Settings;
  getFamily(familyKey: string): ProductFamilyDescriptor | undefined;
  getOptionSystem(familyKey: string): OptionSystem | undefined;
  getSystem(systemId: string): ProfileSystem | undefined;
  getDesign(designId: string): Design | undefined;
}
