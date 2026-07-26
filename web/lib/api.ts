// =====================================================================
// Client-safe API helper — for Client Components. Talks to the same-origin
// BFF proxy (/api/...), which injects the bearer from the httpOnly cookie
// server-side. MUST NOT import server-only modules (e.g. next/headers) so it
// can be bundled into the browser. Server Components use lib/server-api.ts.
// =====================================================================

import type {
  ApprovalRequest,
  ApprovalsInbox,
  LineItemDraft,
  LoginUser,
  OrderSummary,
  QuoteResult,
  ResolvedLineItem,
  RoleSummary,
  UserDetail,
  UserRow,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /**
     * The parsed error body, when the API sent one. Some failures are
     * structured rather than a sentence — confirm returns 422 with the
     * per-item issues that blocked it — and the UI needs those to point at the
     * line that has to be fixed.
     */
    public payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = (data && (data.error as string)) || res.statusText || "Request failed";
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

/** GET a JSON resource through the BFF proxy. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include", cache: "no-store" });
  return parse<T>(res);
}

/** Send a JSON body (POST/PUT/PATCH/DELETE) through the BFF proxy. */
export async function apiSend<T>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    cache: "no-store",
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parse<T>(res);
}

/** Send a raw (non-JSON) body — e.g. an image upload or CSV text. */
export async function apiSendRaw<T>(
  path: string,
  method: "POST" | "PUT",
  body: BodyInit,
  contentType: string,
): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    cache: "no-store",
    headers: { "content-type": contentType },
    body,
  });
  return parse<T>(res);
}

/** Log in: sets the httpOnly cookie server-side, returns the user. */
export function login(email: string, password: string): Promise<{ user: LoginUser }> {
  return apiSend<{ user: LoginUser }>("/api/auth/login", "POST", { email, password });
}

/** Log out: clears the httpOnly cookie. */
export function logout(): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>("/api/auth/logout", "POST");
}

/**
 * Change the current user's password. The BFF route re-sets the httpOnly cookie
 * with the fresh token the API returns (the tokenVersion bump would otherwise
 * 401 the caller's own session on the next request).
 */
export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ user: LoginUser }> {
  return apiSend<{ user: LoginUser }>("/api/auth/change-password", "POST", {
    currentPassword,
    newPassword,
  });
}

// ---------- RBAC: users (Phase 4) ------------------------------------

export function createUser(body: {
  email: string;
  name: string;
  password: string;
  roleId: string;
  phone?: string | null;
  jobTitle?: string | null;
  department?: string | null;
}): Promise<UserRow> {
  return apiSend<UserRow>("/api/users", "POST", body);
}

export function updateUser(
  id: string,
  body: {
    name?: string;
    email?: string;
    roleId?: string;
    phone?: string | null;
    jobTitle?: string | null;
    department?: string | null;
  },
): Promise<UserRow> {
  return apiSend<UserRow>(`/api/users/${id}`, "PATCH", body);
}

export function activateUser(id: string): Promise<UserRow> {
  return apiSend<UserRow>(`/api/users/${id}/activate`, "POST");
}
export function deactivateUser(id: string): Promise<UserRow> {
  return apiSend<UserRow>(`/api/users/${id}/deactivate`, "POST");
}
export function resetUserPassword(id: string, tempPassword: string): Promise<{ ok: boolean }> {
  return apiSend(`/api/users/${id}/reset-password`, "POST", { tempPassword });
}
export function getUser(id: string): Promise<UserDetail> {
  return apiGet<UserDetail>(`/api/users/${id}`);
}

export type DeleteUserResponse =
  | { ok: true }
  | { status: "pending_approval"; request: ApprovalRequest };

export function deleteUser(id: string): Promise<DeleteUserResponse> {
  return apiSend(`/api/users/${id}`, "DELETE");
}

export function listApprovals(): Promise<ApprovalsInbox> {
  return apiGet<ApprovalsInbox>("/api/approvals");
}

export function approveDeletion(id: string): Promise<{ ok: boolean; status: "executed" }> {
  return apiSend(`/api/approvals/${id}/approve`, "POST");
}

export function rejectDeletion(id: string): Promise<{ ok: boolean; status: "rejected" }> {
  return apiSend(`/api/approvals/${id}/reject`, "POST");
}

export function cancelDeletion(id: string): Promise<{ ok: boolean; status: "cancelled" }> {
  return apiSend(`/api/approvals/${id}/cancel`, "POST");
}

// ---------- RBAC: roles (Phase 4) ------------------------------------

export function createRole(body: {
  name: string;
  description?: string;
  permissions: { module: string; action: string; scope?: "OWN" | "ALL" }[];
}): Promise<{ id: string }> {
  return apiSend<{ id: string }>("/api/roles", "POST", body);
}

export function updateRole(
  id: string,
  body: { name?: string; description?: string | null },
): Promise<RoleSummary> {
  return apiSend(`/api/roles/${id}`, "PATCH", body);
}

export function updateRolePermissions(
  id: string,
  permissions: { module: string; action: string; scope?: "OWN" | "ALL" }[],
): Promise<{ ok: boolean; count: number }> {
  return apiSend(`/api/roles/${id}/permissions`, "PUT", { permissions });
}

export function deleteRole(id: string): Promise<{ ok: boolean }> {
  return apiSend(`/api/roles/${id}`, "DELETE");
}

// ---------- Quote (U3) -----------------------------------------------

export interface QuoteRequest {
  systemId: string;
  designId: string;
  widthMm: number;
  heightMm: number;
  /** Selected chamber (frame partKey, e.g. "frame-6ch"); omitted ⇒ design default. */
  frameKey?: string;
  glassKey?: string;
  /** Inside / primary colour key. */
  colourKey?: string;
  /** Outside colour key for a dual-colour finish; omitted ⇒ same as inside. */
  colourKeyOutside?: string;
  /** Selected cill key (omitted ⇒ no cill, no 30mm deduction). */
  cillKey?: string;
  /** Internal split overrides keyed by split-node pathId; full-window fraction 0..1. */
  splitRatios?: Record<string, number>;
  /** Draw the inner-joint overlay (45° mitres + T/Z markers) on the preview SVG. */
  showJoints?: boolean;
  /**
   * How the preview is drawn. "realistic" is the live configurator's
   * presentation style; the SVG embedded in the DOCUMENTS stays flat either
   * way, so paperwork is unaffected.
   */
  svgStyle?: "flat" | "realistic";
}

/** Run the engine for a live preview (public endpoint; no order persisted). */
export function quote(req: QuoteRequest): Promise<QuoteResult> {
  return apiSend<QuoteResult>("/api/quote", "POST", req);
}

// ---------- Orders (U4) ----------------------------------------------

export function createOrder(body: {
  customerName: string;
  reference?: string;
}): Promise<OrderSummary> {
  return apiSend<OrderSummary>("/api/orders", "POST", body);
}

export function addOrderItem(
  orderId: string,
  item: { productId: string; designId: string; widthMm: number; heightMm: number; qty?: number; frameKey?: string; cillKey?: string; splitRatios?: Record<string, number>; colourKeyInside?: string; colourKeyOutside?: string },
): Promise<unknown> {
  return apiSend(`/api/orders/${orderId}/items`, "POST", item);
}

export function deleteOrderItem(orderId: string, itemId: string): Promise<unknown> {
  return apiSend(`/api/orders/${orderId}/items/${itemId}`, "DELETE");
}

export function deleteOrder(orderId: string): Promise<void> {
  return apiSend<void>(`/api/orders/${orderId}`, "DELETE");
}

export function confirmOrder(orderId: string): Promise<unknown> {
  return apiSend(`/api/orders/${orderId}/confirm`, "POST");
}

// ---------- Designer line items (D2 API, D3 UI) ----------------------

/**
 * Stateless resolve — the designer's live preview. Public on the engine (like
 * /api/quote): an invalid-but-well-formed draft comes back 200 with error
 * issues inside, so only a malformed body throws.
 */
export function resolveLineItem(
  draft: LineItemDraft,
  /**
   * Extra elevations to render (phase 5). A REQUEST option, not draft data:
   * the engine's draft schema drops it, so the view being looked at is never
   * persisted on the item.
   */
  views?: ("internal" | "schematic")[],
  /**
   * How those elevations are DRAWN. Same request-only discipline as `views`:
   * "realistic" is the live configurator's presentation style, and the engine
   * strips it from the draft so documents always render flat.
   */
  style?: "flat" | "realistic",
): Promise<ResolvedLineItem> {
  const body = {
    ...draft,
    ...(views?.length ? { views } : {}),
    ...(style ? { style } : {}),
  };
  return apiSend<ResolvedLineItem>("/api/line-items/resolve", "POST", body);
}

export function addDesignerLineItem(
  orderId: string,
  draft: LineItemDraft,
): Promise<{ id: string; position: number; resolved: ResolvedLineItem }> {
  return apiSend(`/api/orders/${orderId}/line-items`, "POST", draft);
}

export function updateDesignerLineItem(
  orderId: string,
  itemId: string,
  draft: LineItemDraft,
): Promise<{ id: string; position: number; resolved: ResolvedLineItem }> {
  return apiSend(`/api/orders/${orderId}/line-items/${itemId}`, "PUT", draft);
}

export function deleteDesignerLineItem(orderId: string, itemId: string): Promise<void> {
  return apiSend<void>(`/api/orders/${orderId}/line-items/${itemId}`, "DELETE");
}

// ---------- Admin: settings + catalog (U5) ---------------------------

export function updateSettings(body: Record<string, unknown>): Promise<{ ok: boolean }> {
  return apiSend("/api/settings", "PUT", body);
}

export function uploadLogo(file: File): Promise<{ ok: boolean; logoUrl: string }> {
  return apiSendRaw("/api/settings/logo", "POST", file, file.type || "image/png");
}

type PricePatch = { cost?: number; price?: number; weight?: number };
/** Profile parts also accept a welding-shrinkage allowance (mm per welded end). */
type PartPatch = PricePatch & { weldAllowanceMm?: number };

export function updateProfilePart(
  systemId: string,
  kind: string,
  partKey: string,
  body: PartPatch,
): Promise<{ ok: boolean; updated: number }> {
  return apiSend(`/api/catalog/${systemId}/parts/${kind}/${partKey}`, "PUT", body);
}

export function updateSubPart(
  systemId: string,
  table: "glass" | "gaskets" | "hardware" | "cills",
  partKey: string,
  body: PricePatch,
): Promise<{ ok: boolean; updated: number }> {
  return apiSend(`/api/catalog/${systemId}/${table}/${partKey}`, "PUT", body);
}

export function addGlass(systemId: string, body: Record<string, unknown>): Promise<{ ok: boolean }> {
  return apiSend(`/api/catalog/${systemId}/glass`, "POST", body);
}

export function addCill(systemId: string, body: Record<string, unknown>): Promise<{ ok: boolean }> {
  return apiSend(`/api/catalog/${systemId}/cills`, "POST", body);
}

export function addColour(systemId: string, body: Record<string, unknown>): Promise<{ ok: boolean }> {
  return apiSend(`/api/catalog/${systemId}/colours`, "POST", body);
}

export function updateColour(
  systemId: string,
  key: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  return apiSend(`/api/catalog/${systemId}/colours/${key}`, "PUT", body);
}

export function importCatalogCsv(
  systemId: string,
  csv: string,
): Promise<{ ok: boolean; updated: number; unmatched: string[] }> {
  return apiSendRaw(`/api/catalog/${systemId}/import`, "POST", csv, "text/csv");
}
