// =====================================================================
// api/middleware/auth.ts — JWT bearer authentication + RBAC context (Phase 2).
//
// requireAuth now does ONE primary-key DB read per request (PLAN §5.1) so that
// deactivation / role reassignment / password reset take effect on the NEXT
// request instead of living out the token's 12 h life:
//   1. verify JWT signature/expiry           (as before)
//   2. PK read: isActive, tokenVersion, roleId, mustChangePassword, roleRef
//      → 401 if the user is gone, !isActive, or the token's tv is stale
//   3. resolve the permission grid (version-keyed cache)
//   4. req.auth = { user, role, permissions, isSuperAdmin }; req.user kept
//   5. mustChangePassword gate (except GET /me and POST /change-password)
// =====================================================================

import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../../db/client.ts";
import { type AuthContext, type AuthedRequest, type AuthUser, HttpError } from "../http.ts";
import { resolvePermissions } from "../rbac/resolver.ts";

const DEFAULT_SECRET = "dev-secret-change-me";
const JWT_SECRET = process.env.JWT_SECRET ?? DEFAULT_SECRET;

// Fail fast in production if the secret is unset or left at the dev default —
// otherwise every token would be forgeable (PLAN §8, pre-existing risk).
if (process.env.NODE_ENV === "production" && JWT_SECRET === DEFAULT_SECRET) {
  throw new Error(
    "JWT_SECRET must be set to a non-default value when NODE_ENV=production",
  );
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  /** roleId + tokenVersion (Phase 2). Optional so pre-Phase-2 tokens still verify. */
  roleId?: string | null;
  tv?: number;
}

/** Fields needed to mint a token. Extra RBAC claims are optional (old callers). */
export type TokenClaims = AuthUser & {
  roleId?: string | null;
  tokenVersion?: number;
};

/** Sign a token for a user. Embeds identity + roleId/tv (never permissions). */
export function signToken(user: TokenClaims): string {
  const expiresIn = process.env.JWT_EXPIRES_IN ?? "12h";
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId ?? null,
      tv: user.tokenVersion ?? 0,
    },
    JWT_SECRET,
    { expiresIn } as jwt.SignOptions,
  );
}

/** Full path (method-agnostic), independent of where requireAuth is mounted. */
function fullPath(req: AuthedRequest): string {
  return req.baseUrl + req.path;
}

/** Routes exempt from the mustChangePassword gate (PLAN §5.5). */
function isPasswordChangeExempt(req: AuthedRequest): boolean {
  const p = fullPath(req);
  return (
    (req.method === "GET" && p === "/api/auth/me") ||
    (req.method === "POST" && p === "/api/auth/change-password")
  );
}

/** The async core of requireAuth — verify, PK-read, resolve grid, gate. */
async function authenticate(req: AuthedRequest): Promise<void> {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new HttpError(401, "Missing or malformed Authorization header");
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }

  // ONE indexed PK read — freshness (deactivation / role change / reset).
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      tokenVersion: true,
      roleId: true,
      mustChangePassword: true,
      roleRef: {
        select: { id: true, slug: true, name: true, scope: true, version: true, isSystem: true },
      },
    },
  });

  if (!user || !user.isActive) {
    // Same message whether gone or deactivated — no account-state leak.
    throw new HttpError(401, "Invalid or expired token");
  }
  // Pre-Phase-2 tokens carry no `tv` claim → tolerated (DB is authoritative,
  // §5.1 rollout compatibility). A present-but-stale tv kills the session.
  if (payload.tv !== undefined && payload.tv !== user.tokenVersion) {
    throw new HttpError(401, "Invalid or expired token");
  }

  const isSuperAdmin = user.roleRef?.scope === "PLATFORM";
  // Super Admin has no grid rows (structural bypass); an unroled user has none
  // either. resolvePermissions returns an empty map in both cases.
  const permissions =
    user.roleRef && !isSuperAdmin
      ? await resolvePermissions(user.roleRef.id, user.roleRef.version)
      : new Map();

  const auth: AuthContext = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
    },
    role: user.roleRef
      ? {
          id: user.roleRef.id,
          slug: user.roleRef.slug,
          name: user.roleRef.name,
          scope: user.roleRef.scope,
          version: user.roleRef.version,
          isSystem: user.roleRef.isSystem,
        }
      : null,
    isSuperAdmin,
    permissions,
  };

  req.auth = auth;
  req.user = { id: user.id, email: user.email, name: user.name };

  // Forced-change gate: block everything but the escape hatches.
  if (user.mustChangePassword && !isPasswordChangeExempt(req)) {
    throw new HttpError(403, "password_change_required");
  }
}

/** Require a valid Bearer token; attaches req.user + req.auth. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  authenticate(req as AuthedRequest)
    .then(() => next())
    .catch(next);
};
