// =====================================================================
// Client-safe API helper — for Client Components. Talks to the same-origin
// BFF proxy (/api/...), which injects the bearer from the httpOnly cookie
// server-side. MUST NOT import server-only modules (e.g. next/headers) so it
// can be bundled into the browser. Server Components use lib/server-api.ts.
// =====================================================================

import type { AuthUser, OrderSummary, QuoteResult } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
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
    throw new ApiError(res.status, message);
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
export function login(email: string, password: string): Promise<{ user: AuthUser }> {
  return apiSend<{ user: AuthUser }>("/api/auth/login", "POST", { email, password });
}

/** Log out: clears the httpOnly cookie. */
export function logout(): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>("/api/auth/logout", "POST");
}

// ---------- Quote (U3) -----------------------------------------------

export interface QuoteRequest {
  systemId: string;
  designId: string;
  widthMm: number;
  heightMm: number;
  glassKey?: string;
  colourKey?: string;
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
  item: { productId: string; designId: string; widthMm: number; heightMm: number; qty?: number },
): Promise<unknown> {
  return apiSend(`/api/orders/${orderId}/items`, "POST", item);
}

export function deleteOrderItem(orderId: string, itemId: string): Promise<unknown> {
  return apiSend(`/api/orders/${orderId}/items/${itemId}`, "DELETE");
}

export function confirmOrder(orderId: string): Promise<unknown> {
  return apiSend(`/api/orders/${orderId}/confirm`, "POST");
}

// ---------- Admin: settings + catalog (U5) ---------------------------

export function updateSettings(body: Record<string, unknown>): Promise<{ ok: boolean }> {
  return apiSend("/api/settings", "PUT", body);
}

export function uploadLogo(file: File): Promise<{ ok: boolean; logoUrl: string }> {
  return apiSendRaw("/api/settings/logo", "POST", file, file.type || "image/png");
}

type PricePatch = { cost?: number; price?: number; weight?: number };

export function updateProfilePart(
  systemId: string,
  kind: string,
  partKey: string,
  body: PricePatch,
): Promise<{ ok: boolean; updated: number }> {
  return apiSend(`/api/catalog/${systemId}/parts/${kind}/${partKey}`, "PUT", body);
}

export function updateSubPart(
  systemId: string,
  table: "glass" | "gaskets" | "hardware",
  partKey: string,
  body: PricePatch,
): Promise<{ ok: boolean; updated: number }> {
  return apiSend(`/api/catalog/${systemId}/${table}/${partKey}`, "PUT", body);
}

export function addGlass(systemId: string, body: Record<string, unknown>): Promise<{ ok: boolean }> {
  return apiSend(`/api/catalog/${systemId}/glass`, "POST", body);
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
