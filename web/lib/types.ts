// =====================================================================
// Shared response shapes for the web tier. Kept intentionally minimal —
// each sub-milestone (U1–U6) adds the shapes it needs. We do NOT import from
// the root ../src/types.ts (its explicit-.ts ESM imports don't suit Next's
// bundler); these mirror only the fields the UI consumes.
// =====================================================================

/** GET /api/systems — one profile system (public). */
export interface SystemSummary {
  systemId: string;
  name: string;
  currency: string;
  stockBarLengthMm: number;
}

/** One data-driven sidebar entry (from GET /api/auth/me `nav`). */
export interface NavItem {
  slug: string;
  name: string;
  path: string | null;
  icon: string | null;
  sortOrder: number;
}

/** The caller's role, as surfaced by /api/auth/me. */
export interface RoleInfo {
  id: string;
  slug: string;
  name: string;
  scope: "PLATFORM" | "ORG";
  isSystem: boolean;
}

/** moduleSlug → granted actions + data scope (materialized grid). */
export type PermissionsMap = Record<string, { actions: string[]; scope: string }>;

/**
 * The authenticated user — the FLATTENED GET /api/auth/me (§6.4) shape produced
 * by getCurrentUser(): identity fields hoisted alongside role/permissions/nav
 * so callers read `user.name` / `user.role.name` / `user.permissions` directly.
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  mustChangePassword: boolean;
  role: RoleInfo | null;
  isSuperAdmin: boolean;
  incomingApprovals: number;
  permissions: PermissionsMap;
  nav: NavItem[];
}

/** Raw GET /api/auth/me envelope, before getCurrentUser() flattens it. */
export interface MeResponse {
  user: { id: string; email: string; name: string; isActive: boolean; mustChangePassword: boolean };
  role: RoleInfo | null;
  isSuperAdmin: boolean;
  incomingApprovals: number;
  permissions: PermissionsMap;
  nav: NavItem[];
}

/** POST /api/auth/login → user summary (identity + forced-change flag). */
export interface LoginUser {
  id: string;
  email: string;
  name: string;
  mustChangePassword: boolean;
}

/** Standard paginated list envelope (GET /api/products, …/designs). */
export interface Paginated<T> {
  data: T[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

/** GET /api/products — one product line. */
export interface ProductSummary {
  id: string;
  name: string;
  typeId: string;
  systemId: string;
  designCount: number;
}

/** GET /api/products/:id/designs — one gallery design (no SVG; fetch via /api/designs/:id). */
export interface DesignListItem {
  designId: string;
  name: string;
  productType: string;
  quotable: boolean;
  quantityOfSquares: number;
  externalId: string | null;
}

/** GET /api/designs/:id — full design incl. inline SVG. */
export interface DesignDetail {
  designId: string;
  name: string;
  productType: string;
  productId: string | null;
  frameKey: string | null;
  quotable: boolean;
  quantityOfSquares: number;
  externalId: string | null;
  hasTopology: boolean;
  /** Per-design default manufacturing size (mm); preloads the configurator. */
  defaultWidthMm: number | null;
  defaultHeightMm: number | null;
  imageSvg: string | null;
}

/** GET /api/systems/:id/options?frameKey=… — selectable chambers, glass, colours + cills (U3). */
export interface SystemOptions {
  /** Selectable frame profiles (chambers, e.g. 5ch / 6ch). */
  chambers?: { key: string; name: string }[];
  glass: { key: string; name: string }[];
  colours: { key: string; name: string; priceUpliftPct: number; hex?: string }[];
  cills?: { key: string; name: string; projectionMm: number }[];
  defaultColourKey: string | null;
}

/** Subset of QuoteOutput the configurator consumes (POST /api/quote). */
export interface QuoteLine {
  code: string;
  description: string;
  category: string;
  qty: number;
  unit: string;
  unitCost: number;
  unitPrice: number;
  totalCost: number;
  totalPrice: number;
}
export interface QuoteTotals {
  materialCost: number;
  materialPrice: number;
  labour: number;
  factoryCost: number;
  markup: number;
  netPrice: number;
  tax: number;
  grandTotal: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface SolvedCell {
  pathId: string;
  outer: Rect;
  daylight: Rect;
  content: string;
  sashKey?: string;
  beadKey: string;
  glassKey: string;
  sashOuter?: Rect;
  sashInner?: Rect;
  glassRect: Rect;
  beadIntW: number;
  beadIntH: number;
}
export interface SolvedTransom {
  rect: Rect;
  parentPathId: string;
  transomKey: string;
  extLengthMm: number;
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
export interface QuoteGeometry {
  outer?: Rect;
  cells?: SolvedCell[];
  transoms?: SolvedTransom[];
  mullions?: SolvedMullion[];
  cill?: { rect: Rect; code: string; name: string; projectionMm: number };
  svg: string;
}
export interface QuoteResult {
  systemName: string;
  designName: string;
  geometry: QuoteGeometry;
  pricing: { currency: string; lines: QuoteLine[]; totals: QuoteTotals };
}

// ---------- Basket / commercial layer (D6) ---------------------------

export type FittingType = "none" | "fit" | "fit-and-survey";

export interface BasketLine {
  id: string;
  kind: "legacy" | "designer";
  label: string;
  qty: number;
  unitNetPrice: number;
  lineNetPrice: number;
  errorCount: number;
}

/** `computeBasket()` output — the one place order money is derived. */
export interface BasketTotals {
  currency: string;
  lines: BasketLine[];
  linesSubtotal: number;
  itemsAdjustment: number;
  itemsSubtotal: number;
  discount: number;
  discountCode: string | null;
  discountKind: "percent" | "fixed" | null;
  discountValue: number | null;
  fittingType: FittingType;
  fitting: number;
  survey: number;
  delivery: number;
  extras: number;
  taxableBase: number;
  taxRatePct: number;
  tax: number;
  grandTotal: number;
}

/** GET /api/discounts row. */
export interface DiscountCodeRow {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  active: boolean;
  validFrom: string | null;
  validTo: string | null;
  createdAt: string;
}

/** GET /api/orders — list row. */
export interface OrderSummary {
  id: string;
  orderNo: string;
  customerName: string;
  reference: string | null;
  status: "draft" | "confirmed";
  totalPrice: number | null;
  /** Basket grand total: live for drafts, frozen snapshot for confirmed (D6). */
  basketTotal?: number | null;
  createdAt: string;
  _count?: { items: number; designerItems?: number; documents: number };
}

/** GET /api/orders/:id — full order. */
export interface OrderItem {
  id: string;
  productId: string;
  designId: string;
  systemId: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  mode: string;
  cillKey?: string | null;
  design?: { name: string };
  product?: { name: string };
  /**
   * The designer family this legacy item can be reopened against, or null when
   * it cannot be (no configurable family claims the product, or it was quoted
   * in Custom extraction mode). The server answers it with the pure converter
   * (`src/designer/legacy-import.ts`) so the UI never reimplements the rule.
   */
  studioFamilyKey?: string | null;
}
export interface OrderDetail extends OrderSummary {
  items: OrderItem[];
  /** Designer line items (D2) — coexist with legacy `items` on the same order. */
  designerItems?: DesignerItemRow[];
  documents: { type: string; variant: string; createdAt: string }[];
  /** Commercial layer (D6): live for drafts, frozen snapshot once confirmed. */
  basket?: BasketTotals;
  fittingType?: FittingType | null;
  fittingPrice?: number | null;
  surveyPrice?: number | null;
  deliveryCharge?: number | null;
  discountCode?: string | null;
  taxRatePct?: number | null;
}

// ---------- Admin (U5) -----------------------------------------------

/** GET /api/settings — financial settings + branding. */
export interface SettingsResponse {
  currency: string;
  taxApply: boolean;
  taxPct: number;
  markupPct: number;
  wastagePct: number;
  labourPerSash: number;
  labourPerDoor: number;
  labourBase: number;
  /** Global welding-shrinkage default (mm per welded end). */
  weldAllowanceMm: number;
  branding: {
    companyName: string | null;
    companyAddress: string | null;
    accentColor: string | null;
    hasLogo: boolean;
    logoUrl: string | null;
  };
}

/** A priced catalog row (frames/sashes/.../glass/gaskets/hardware). */
export interface CatalogPart {
  code: string;
  name: string;
  cost: number;
  price: number;
  weight: number;
  /** Welding-shrinkage allowance per welded end (mm). Profile parts only. */
  weldAllowanceMm?: number;
  [extra: string]: unknown;
}
export interface CatalogColour {
  key: string;
  code: string;
  name: string;
  costUpliftPct: number;
  priceUpliftPct: number;
  isBase: boolean;
  /** Display swatch hex (e.g. "#353b3f"); null/absent ⇒ grey preview. */
  hex?: string | null;
  /**
   * Surface texture used by the realistic preview only ("woodgrain"). Supplier
   * fact, never inferred from the hex; absent ⇒ rendered smooth.
   */
  texture?: "woodgrain" | null;
}
export interface CatalogCill {
  key: string;
  code: string;
  name: string;
  projectionMm: number;
  cost: number;
  price: number;
  weight: number;
}
// ---------- RBAC: users, roles, meta (Phase 4) -----------------------

/** GET /api/users — one row (passwordHash never present). */
export interface UserRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  jobTitle: string | null;
  department: string | null;
  lastLoginAt: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  role: { id: string; slug: string; name: string; scope: "PLATFORM" | "ORG" } | null;
  createdAt: string;
}

/** GET /api/users/:id — editable user record. */
export type UserDetail = UserRow;

export interface ApprovalParticipant {
  id: string;
  name: string;
  email: string;
}

export interface ApprovalRequest {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "EXECUTED";
  reason: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedById: string | null;
  targetId: string | null;
  requesterId: string;
  target: ApprovalParticipant | null;
  requester: ApprovalParticipant;
}

export interface ApprovalsInbox {
  incoming: ApprovalRequest[];
  outgoing: ApprovalRequest[];
}

/** GET /api/roles — one row. */
export interface RoleSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  scope: "PLATFORM" | "ORG";
  isSystem: boolean;
  version: number;
  userCount: number;
  createdAt: string;
}

/** One grid cell (module × action + scope). */
export interface GridTuple {
  module: string;
  action: string;
  scope: "OWN" | "ALL";
}

/** GET /api/roles/:id — role incl. its full permission grid. */
export interface RoleDetail extends RoleSummary {
  permissions: GridTuple[];
}

/** GET /api/meta/permissions — modules + actions for the grid editor. */
export interface MetaPermissions {
  modules: { slug: string; name: string; navPath: string | null; category: string | null; sortOrder: number }[];
  actions: { slug: string; name: string }[];
}

// ---------- Designer (Phase 3 / D3) ----------------------------------
//
// Mirrors of the server contracts in src/designer/option-types.ts and
// src/designer/line-item-types.ts — only the fields the UI consumes. Same repo
// convention as the rest of this file: we do NOT import from root ../src.

export type DesignerComponentType =
  | "frame-edge"
  | "transom"
  | "mullion"
  | "sash"
  | "glass"
  | "panel"
  | "cill"
  | "addon";

export type OptionDisplay =
  | "select"
  | "select-image"
  | "segmented"
  | "toggle"
  | "number"
  | "text"
  | "action";

export type ApplyScope = "this" | "all-of-type";
export type SplitMode = "byDimensions" | "equalSplit" | "equalGlass";

export interface FamilyDimension {
  key: string;
  label: string;
  unit: "mm";
  required: boolean;
  min: number;
  max: number;
  defaultFrom?: "design";
  /** true ⇒ recorded on documents, no engine effect. */
  informational?: boolean;
}

/** GET /api/families/:key → `family` (the fields the designer renders from). */
export interface FamilyDescriptor {
  familyKey: string;
  name: string;
  status: "active" | "hidden" | "deprecated";
  systemIds: string[];
  designSource: { mode: string; productIds?: string[] };
  dimensions: FamilyDimension[];
  splitModes: SplitMode[];
  viewModes: string[];
  engine: { adapter: string; quotable: boolean };
  /** Which conversions the Component-type control may offer (phase 4). */
  componentConversions?: { from: DesignerComponentType; to: DesignerComponentType[] }[];
  componentTypes?: { type: DesignerComponentType; sides?: string[]; kinds?: string[] }[];
}

export interface OptionChoice {
  key: string;
  optionKey: string;
  label: string;
  order: number;
  isDefault: boolean;
  filterKeys?: string[];
  image?: { kind: string; ref: string };
  swatchHex?: string;
  partKey?: string;
  /**
   * Which engine slot this choice drives (option-schema.md's closed enum). The
   * UI reads only `kind`/`params` — e.g. to know a choice is the OUTSIDE colour
   * without matching on option keys.
   */
  engineEffect?: { kind: string; params?: Record<string, string | number | boolean> };
}

export interface OptionDef {
  key: string;
  groupKey: string;
  name: string;
  order: number;
  display: OptionDisplay;
  required: boolean;
  scope: {
    level: "item" | "component";
    componentTypes?: DesignerComponentType[];
    applyScopes?: ApplyScope[];
  };
  filters?: { key: string; label: string }[];
  validation?: { min?: number; max?: number; regex?: string; maxLength?: number };
  presentation?: {
    omitFromSummary?: boolean;
    omitFromDocuments?: boolean;
    helpText?: string;
    suggestions?: string[];
  };
  pricingMode: "catalog" | "none";
  /**
   * `display: "action"` only — the TopologyEdit this instant action performs,
   * with `componentId` left out (the designer fills it from the selection).
   */
  action?: TopologyEditTemplate;
  choices: OptionChoice[];
}

/** A structural edit as the draft stores it (mirror of designer/option-types.ts). */
export type TopologyEdit =
  | {
      op: "split";
      componentId: string;
      axis: "horizontal" | "vertical";
      position: "equal" | "at-ratio";
      atRatio?: number;
      dividerKey?: string;
    }
  | {
      op: "add-midrail";
      componentId: string;
      position: "equal" | "at-ratio";
      atRatio?: number;
      transomKey?: string;
    }
  | { op: "convert-component"; componentId: string; to: DesignerComponentType; kind?: string }
  | { op: "set-sash-kind"; componentId: string; kind: string }
  | { op: "remove-divider"; componentId: string };

/** The same edit with its target omitted — what an action option carries. */
export type TopologyEditTemplate =
  | Omit<Extract<TopologyEdit, { op: "split" }>, "componentId">
  | Omit<Extract<TopologyEdit, { op: "add-midrail" }>, "componentId">
  | Omit<Extract<TopologyEdit, { op: "convert-component" }>, "componentId">
  | Omit<Extract<TopologyEdit, { op: "set-sash-kind" }>, "componentId">
  | Omit<Extract<TopologyEdit, { op: "remove-divider" }>, "componentId">;

export interface OptionGroupWithOptions {
  key: string;
  name: string;
  order: number;
  icon?: string;
  defaultCollapsed: boolean;
  scope: "item" | "component" | "mixed";
  options: OptionDef[];
}

/** GET /api/families/:key */
export interface FamilyResponse {
  family: FamilyDescriptor;
  optionSystem: { groups: OptionGroupWithOptions[] };
}

/** GET /api/families */
export interface FamilySummary {
  familyKey: string;
  name: string;
  status: string;
  systemIds: string[];
}

export interface DraftSelection {
  optionKey: string;
  choiceKey?: string;
  value?: string | number | boolean;
  scope?: string;
  appliedVia?: ApplyScope;
}

export interface DraftTopologyEdit {
  id: string;
  edit: TopologyEdit;
}

/**
 * An addressable component of the solved geometry (`ResolvedLineItem.components`).
 * `componentId` is position-derived and stable across re-solves — which is what
 * lets a canvas selection and a component-scoped answer survive a resize.
 */
export interface ComponentRef {
  componentId: string;
  type: DesignerComponentType;
  label: string;
  /** Hit-test rect in window mm coordinates (same space as QuoteGeometry). */
  rect: Rect;
  path: string;
  /** Sash kind / divider joint type — refines `type`. */
  kind?: string;
}

/** The authoritative user intent — POSTed to /api/line-items/resolve verbatim. */
export interface LineItemDraft {
  schemaVersion: number;
  familyKey: string;
  systemId: string;
  designId: string;
  quantity: number;
  location?: string;
  dimensions: Record<string, number>;
  splitMode?: SplitMode;
  splitRatios?: Record<string, number>;
  topologyEdits?: DraftTopologyEdit[];
  selections?: DraftSelection[];
}

export interface LineItemIssue {
  severity: "warning" | "error";
  kind: string;
  message: string;
  optionKey?: string;
  scope?: string;
  dimensionKey?: string;
  constraintId?: string;
  editId?: string;
  source?: string;
}

export interface ResolvedSummary {
  sizeLabel: string;
  colourLabel?: string;
  locationLabel?: string;
  leafCount: number;
  glassSizes: { componentId: string; wMm: number; hMm: number }[];
}

/** POST /api/line-items/resolve → the computed view of a draft. */
export interface ResolvedLineItem {
  resolvedAt: string;
  catalogVersion: string;
  issues: LineItemIssue[];
  invalidDimensions: boolean;
  invalidSpec: boolean;
  /**
   * true ⇒ this item cannot be confirmed. Narrower than `invalidSpec`: going
   * past a printed fabrication maximum is an error the fabricator may proceed
   * with, so it sets `invalidSpec` but not `blocking`.
   */
  blocking: boolean;
  pricing?: { currency: string; lines: QuoteLine[]; totals: QuoteTotals };
  summary?: ResolvedSummary;
  /** `external` always; the others only when the request asked for them (phase 5). */
  geometrySvg?: { external?: string; internal?: string; schematic?: string };
  /** Solved rects (no `svg` — that's geometrySvg.external). */
  geometry?: Omit<QuoteGeometry, "svg">;
  /** Addressable components for canvas hit-testing + scoped options (phase 4). */
  components?: ComponentRef[];
}

/** GET /api/orders/:id → designerItems[] (draft + light resolve projection). */
export interface DesignerItemRow {
  id: string;
  position: number;
  draft: LineItemDraft;
  catalogVersion: string | null;
  summary: ResolvedSummary | null;
  issues: LineItemIssue[];
  invalidSpec: boolean;
  invalidDimensions: boolean;
  totals: QuoteTotals | null;
}

/** GET /api/catalog/:systemId — full priced dump (admin). */
export interface CatalogDump {
  systemId: string;
  name: string;
  currency: string;
  frames: Record<string, CatalogPart>;
  sashes: Record<string, CatalogPart>;
  transoms: Record<string, CatalogPart>;
  beads: Record<string, CatalogPart>;
  reinforcement: Record<string, CatalogPart>;
  gaskets: Record<string, CatalogPart>;
  glass: Record<string, CatalogPart>;
  hardware: Record<string, CatalogPart>;
  colours: Record<string, CatalogColour>;
  cills: Record<string, CatalogCill>;
  defaultColourKey?: string;
}
