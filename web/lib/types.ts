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

/** The authenticated user (login / GET /api/auth/me). */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
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
  imageSvg: string | null;
}

/** GET /api/systems/:id/options — selectable glass + colours (U3). */
export interface SystemOptions {
  glass: { key: string; name: string }[];
  colours: { key: string; name: string; priceUpliftPct: number }[];
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
export interface QuoteResult {
  systemName: string;
  designName: string;
  geometry: { svg: string };
  pricing: { currency: string; lines: QuoteLine[]; totals: QuoteTotals };
}

/** GET /api/orders — list row. */
export interface OrderSummary {
  id: string;
  orderNo: string;
  customerName: string;
  reference: string | null;
  status: "draft" | "confirmed";
  totalPrice: number | null;
  createdAt: string;
  _count?: { items: number; documents: number };
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
  design?: { name: string };
  product?: { name: string };
}
export interface OrderDetail extends OrderSummary {
  items: OrderItem[];
  documents: { type: string; createdAt: string }[];
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
  [extra: string]: unknown;
}
export interface CatalogColour {
  key: string;
  code: string;
  name: string;
  costUpliftPct: number;
  priceUpliftPct: number;
  isBase: boolean;
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
  defaultColourKey?: string;
}
