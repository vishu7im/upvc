// =====================================================================
// api/middleware/authorize.ts — the single authorization surface (PLAN §5.2).
//
//   requirePermission(module, action)  Express guard, used AFTER requireAuth
//   hasPermission(auth, module, action) pure predicate (Super Admin ⇒ true)
//   scopeFilter(auth, module)           OWN → { userId } · ALL → {}
//
// Super Admin bypass is structural: isSuperAdmin (role.scope === "PLATFORM")
// short-circuits every check — the platform owner is never gated by a grid.
// =====================================================================

import type { NextFunction, RequestHandler, Response } from "express";
import { type AuthContext, type AuthedRequest, HttpError } from "../http.ts";

/** True iff the caller holds `action` on `module` (Super Admin always true). */
export function hasPermission(
  auth: AuthContext,
  module: string,
  action: string,
): boolean {
  if (auth.isSuperAdmin) return true;
  return auth.permissions.get(module)?.actions.has(action) ?? false;
}

/**
 * Express guard: 403 unless the caller holds `module.action`.
 * Mount AFTER requireAuth (which populates req.auth).
 */
export function requirePermission(module: string, action: string): RequestHandler {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    const auth = req.auth;
    if (!auth) {
      next(new HttpError(401, "Not authenticated"));
      return;
    }
    if (hasPermission(auth, module, action)) {
      next();
      return;
    }
    next(new HttpError(403, `Missing permission: ${module}.${action}`));
  };
}

/**
 * Row-level data scope for a module, as a Prisma `where` fragment.
 *  - Super Admin / scope ALL → {} (no restriction)
 *  - scope OWN (or no grant)  → { userId } (only the caller's rows)
 *
 * Defaults to OWN when the module isn't in the grid — a missing grant must
 * never widen access. (Future tenancy: ORG → { organizationId }.)
 */
export function scopeFilter(
  auth: AuthContext,
  module: string,
): { userId?: string } {
  if (auth.isSuperAdmin) return {};
  const entry = auth.permissions.get(module);
  if (entry?.scope === "ALL") return {};
  return { userId: auth.user.id };
}
