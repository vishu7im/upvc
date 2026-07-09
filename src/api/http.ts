// =====================================================================
// api/http.ts — shared HTTP helpers: typed request, async wrapper,
// error type + central error handler, and a zod validation helper.
// =====================================================================

import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import type { DataScope, RoleScope } from "../rbac/registry.ts";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

// ---- RBAC authorization context (Phase 2) ---------------------------
// Resolved once per request by the upgraded `requireAuth` and consumed by
// `requirePermission` / `hasPermission` / `scopeFilter` (src/api/middleware/
// authorize.ts) and by `GET /api/auth/me`.

/** One module's effective grant: the actions held + the row-level data scope. */
export interface PermissionEntry {
  actions: Set<string>;
  scope: DataScope;
}

/** moduleSlug → { actions, scope } — the materialized grid of the caller's role. */
export type PermissionMap = Map<string, PermissionEntry>;

/** The caller's role, as read from the DB on each request. */
export interface RoleInfo {
  id: string;
  slug: string;
  name: string;
  scope: RoleScope;
  /** bumped on grid change → busts the version-keyed permission cache. */
  version: number;
  isSystem: boolean;
}

/** Everything a guard/handler needs to make an authorization decision. */
export interface AuthContext {
  user: AuthUser & { isActive: boolean; mustChangePassword: boolean };
  /** null only for a user with no role assigned (nullable FK through Phase 6). */
  role: RoleInfo | null;
  /** Structural bypass — true iff the role's scope is PLATFORM (Super Admin). */
  isSuperAdmin: boolean;
  permissions: PermissionMap;
}

/**
 * Express Request augmented with auth state.
 *  - `user`: the legacy identity shape (kept for existing handlers).
 *  - `auth`: the full RBAC context (set by the upgraded requireAuth).
 */
export type AuthedRequest = Request & { user?: AuthUser; auth?: AuthContext };

/** Throwable HTTP error with a status code. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Wrap an async handler so thrown/rejected errors reach the error handler. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/** Validate `data` against a zod schema; throw HttpError(400) on failure. */
export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msg = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new HttpError(400, msg);
  }
  return result.data;
}

/** Central Express error handler. Mount last. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Internal error";
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
}
