// =====================================================================
// api/auth.ts — login / me / change-password.
// =====================================================================

import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db/client.ts";
import {
  asyncHandler,
  type AuthContext,
  type AuthedRequest,
  HttpError,
  type PermissionMap,
  validate,
} from "./http.ts";
import { requireAuth, signToken } from "./middleware/auth.ts";
import { hasPermission } from "./middleware/authorize.ts";
import { emailKey, rateLimit } from "./middleware/rateLimit.ts";

export const authRouter = Router();

// Credential-stuffing guard on the auth surface (PLAN §6.3 / §8): 10 attempts
// per 15 min. Login keys by IP+email; change-password keys by IP.
const WINDOW_MS = 15 * 60 * 1000;
const loginLimiter = rateLimit({ windowMs: WINDOW_MS, max: 10, keyFn: emailKey });
const changePasswordLimiter = rateLimit({ windowMs: WINDOW_MS, max: 10 });

const loginSchema = z.object({
  email: z.string().min(1), // lookup key; format not enforced on login
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = validate(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    // Identical failure for bad password AND deactivated account — no account-
    // state leak (PLAN §8). bcrypt.compare still runs for an existing user.
    if (!user || !(await bcrypt.compare(password, user.passwordHash)) || !user.isActive) {
      throw new HttpError(401, "Invalid email or password");
    }
    const pub = { id: user.id, email: user.email, name: user.name };
    const token = signToken({ ...pub, roleId: user.roleId, tokenVersion: user.tokenVersion });
    res.json({ token, user: { ...pub, mustChangePassword: user.mustChangePassword } });
  }),
);

// User creation lives at POST /api/users (PLAN §6.1). The legacy admin-only
// POST /api/auth/register delegate was removed in Phase 5 — the users router is
// now the single create path (real roleId + anti-escalation).

// ---- /me (extended RBAC shape — PLAN §6.4) --------------------------

/** PermissionMap (Sets) → JSON-friendly Record (arrays). */
function serializePermissions(
  perms: PermissionMap,
): Record<string, { actions: string[]; scope: string }> {
  const out: Record<string, { actions: string[]; scope: string }> = {};
  for (const [slug, entry] of perms) {
    out[slug] = { actions: [...entry.actions], scope: entry.scope };
  }
  return out;
}

/**
 * The sidebar is DATA (PLAN §6.4): active modules with a navPath, filtered by
 * the caller's `view` permission (Super Admin ⇒ all), ordered by sortOrder.
 */
async function buildNav(auth: AuthContext) {
  const modules = await prisma.module.findMany({
    where: { isActive: true, NOT: { navPath: null } },
    orderBy: { sortOrder: "asc" },
    select: { slug: true, name: true, navPath: true, navIcon: true, sortOrder: true },
  });
  return modules
    .filter((m) => hasPermission(auth, m.slug, "view"))
    .map((m) => ({
      slug: m.slug,
      name: m.name,
      path: m.navPath,
      icon: m.navIcon,
      sortOrder: m.sortOrder,
    }));
}

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const nav = await buildNav(auth);
    res.json({
      user: {
        id: auth.user.id,
        email: auth.user.email,
        name: auth.user.name,
        isActive: auth.user.isActive,
        mustChangePassword: auth.user.mustChangePassword,
      },
      role: auth.role
        ? {
            id: auth.role.id,
            slug: auth.role.slug,
            name: auth.role.name,
            scope: auth.role.scope,
            isSystem: auth.role.isSystem,
          }
        : null,
      isSuperAdmin: auth.isSuperAdmin,
      permissions: serializePermissions(auth.permissions),
      nav,
    });
  }),
);

// ---- change-password (forced-change flow — PLAN §5.5 / §6.3) --------

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// Exempt from the mustChangePassword gate (see requireAuth). Bumps tokenVersion
// to kill any other live sessions, then returns a FRESH token so the caller
// isn't logged out by their own change (the BFF re-sets the cookie).
authRouter.post(
  "/change-password",
  changePasswordLimiter,
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { currentPassword, newPassword } = validate(changePasswordSchema, req.body);
    const auth = req.auth!;
    const user = await prisma.user.findUnique({ where: { id: auth.user.id } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new HttpError(400, "Current password is incorrect");
    }
    const tokenVersion = user.tokenVersion + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 10),
        mustChangePassword: false,
        tokenVersion,
      },
    });
    const pub = { id: user.id, email: user.email, name: user.name };
    const token = signToken({ ...pub, roleId: user.roleId, tokenVersion });
    res.json({ token, user: { ...pub, mustChangePassword: false } });
  }),
);
