// =====================================================================
// Server-side API helper — for Server Components and Route Handlers. Talks
// straight to the Express engine API (the trusted server tier), attaching the
// JWT read from the httpOnly cookie. Imports next/headers, so this module is
// server-only; Client Components must use lib/api.ts (the BFF proxy) instead.
// =====================================================================

import "server-only";
import { cookies } from "next/headers";
import { ApiError } from "./api";
import type { AuthUser, MeResponse } from "./types";

const EXPRESS_API_BASE = process.env.EXPRESS_API_BASE ?? "http://localhost:3005";
const TOKEN_COOKIE = "token";

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = (data && (data.error as string)) || res.statusText || "Request failed";
    throw new ApiError(res.status, message);
  }
  return data as T;
}

/**
 * GET a JSON resource directly from the engine API, server-side. The path is
 * the full API path (e.g. "/api/systems"). The bearer is added from the cookie
 * when present (omitted for public endpoints / logged-out requests).
 */
export async function serverApiGet<T>(path: string): Promise<T> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  const res = await fetch(`${EXPRESS_API_BASE}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
  });
  return parse<T>(res);
}

/**
 * Resolve the logged-in user from GET /api/auth/me, or null if not
 * authenticated (no/expired cookie → 401) or the engine is unreachable.
 * Used by the protected layout and the login page to decide redirects.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const me = await serverApiGet<MeResponse>("/api/auth/me");
    // Flatten identity alongside role/permissions/nav so callers read
    // `user.name` / `user.role.name` / `user.permissions` directly.
    return {
      ...me.user,
      role: me.role,
      isSuperAdmin: me.isSuperAdmin,
      permissions: me.permissions,
      nav: me.nav,
    };
  } catch {
    return null;
  }
}
