// =====================================================================
// api/users.ts — user management (PLAN §6.1). Mounted at /api/users behind
// requireAuth; each route additionally guarded by requirePermission("users", …).
//
// All escalation / visibility / self-action / last-SA invariants are delegated
// to src/api/rbac/service.ts — this router only shapes requests/responses and
// dual-writes the legacy `role` string (dropped in Phase 6). passwordHash is
// NEVER selected into a response.
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
  validate,
} from "./http.ts";
import { requireAuth } from "./middleware/auth.ts";
import { requirePermission } from "./middleware/authorize.ts";
import {
  assertGrantable,
  assertManageableUser,
  assertNotLastSuperAdmin,
  bumpTokenVersion,
  writeAuditLog,
} from "./rbac/service.ts";
import { paginated, parsePagination } from "./pagination.ts";

export const usersRouter = Router();

// Public projection (never includes passwordHash). role is the RBAC role, not
// the legacy string.
const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
  roleRef: { select: { id: true, slug: true, name: true } },
} as const;

type UserRow = {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  roleRef: { id: string; slug: string; name: string } | null;
};

function shapeUser(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
    role: u.roleRef,
    createdAt: u.createdAt,
  };
}

/**
 * Shared user-create path (PLAN §6.1). Enforces anti-escalation, rejects a
 * duplicate email, and returns the public shape. `roleId` is the single source
 * of role truth (the legacy `role` string was dropped in Phase 6).
 */
export async function createUserRecord(
  actor: AuthContext,
  input: {
    email: string;
    name: string;
    password: string;
    roleId: string;
    mustChangePassword: boolean;
  },
) {
  // May the actor hand out this role at all? (404 for an unknown/hidden role.)
  await assertGrantable(actor, { roleId: input.roleId });

  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw new HttpError(409, "Email already registered");

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await bcrypt.hash(input.password, 10),
      roleId: input.roleId,
      mustChangePassword: input.mustChangePassword,
    },
    select: USER_SELECT,
  });
  await writeAuditLog({
    actorId: actor.user.id,
    action: "user.create",
    targetType: "user",
    targetId: user.id,
    detail: { email: input.email, roleId: input.roleId },
  });
  return shapeUser(user);
}

// ---- GET /api/users -------------------------------------------------

usersRouter.get(
  "/",
  requireAuth,
  requirePermission("users", "read"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const p = parsePagination(req.query);

    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const roleId = typeof req.query.roleId === "string" ? req.query.roleId : undefined;
    const activeRaw = typeof req.query.active === "string" ? req.query.active : undefined;

    const where: Record<string, unknown> = {};
    // Non-SA never sees PLATFORM-role (Super Admin) users — 404/absence, not 403.
    if (!auth.isSuperAdmin) where.NOT = { roleRef: { is: { scope: "PLATFORM" } } };
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }
    if (roleId) where.roleId = roleId;
    if (activeRaw === "true") where.isActive = true;
    else if (activeRaw === "false") where.isActive = false;

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { createdAt: "desc" },
        skip: p.skip,
        take: p.take,
      }),
      prisma.user.count({ where }),
    ]);

    res.json(paginated(rows.map(shapeUser), total, p));
  }),
);

// ---- POST /api/users (create / invite v1) ---------------------------

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  roleId: z.string().uuid(),
});

usersRouter.post(
  "/",
  requireAuth,
  requirePermission("users", "create"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = validate(createSchema, req.body);
    // Invite v1: an admin-set password that MUST be rotated on first login.
    const user = await createUserRecord(req.auth!, {
      ...body,
      mustChangePassword: true,
    });
    res.status(201).json(user);
  }),
);

// ---- GET /api/users/:id ---------------------------------------------

usersRouter.get(
  "/:id",
  requireAuth,
  requirePermission("users", "read"),
  asyncHandler(async (req: AuthedRequest, res) => {
    await assertManageableUser(req.auth!, req.params.id); // 404 for hidden PLATFORM
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: USER_SELECT,
    });
    if (!user) throw new HttpError(404, "User not found");
    res.json(shapeUser(user));
  }),
);

// ---- PATCH /api/users/:id -------------------------------------------

const patchSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email(),
    roleId: z.string().uuid(),
  })
  .partial();

usersRouter.patch(
  "/:id",
  requireAuth,
  requirePermission("users", "update"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const body = validate(patchSchema, req.body);
    if (Object.keys(body).length === 0) throw new HttpError(400, "No fields to update");

    const target = await assertManageableUser(auth, req.params.id);

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;

    if (body.email !== undefined) {
      const clash = await prisma.user.findUnique({ where: { email: body.email } });
      if (clash && clash.id !== target.id) throw new HttpError(409, "Email already registered");
      data.email = body.email;
    }

    let roleChanged = false;
    if (body.roleId !== undefined && body.roleId !== target.roleId) {
      // A user cannot change their OWN role (audit-escape / self-escalation).
      if (target.id === auth.user.id) {
        throw new HttpError(403, "You cannot change your own role");
      }
      await assertGrantable(auth, { roleId: body.roleId }); // 404 hidden / 403 escalation
      // Moving a Super Admin off the platform role must not orphan the platform.
      await assertNotLastSuperAdmin(target.id);
      data.roleId = body.roleId;
      roleChanged = true;
    }

    const user = await prisma.user.update({
      where: { id: target.id },
      data,
      select: USER_SELECT,
    });
    // A role change alters effective permissions → kill live sessions.
    if (roleChanged) await bumpTokenVersion(target.id);

    await writeAuditLog({
      actorId: auth.user.id,
      action: roleChanged ? "user.role_change" : "user.update",
      targetType: "user",
      targetId: target.id,
      detail: {
        fields: Object.keys(body),
        ...(roleChanged ? { fromRoleId: target.roleId, toRoleId: body.roleId } : {}),
      },
    });
    res.json(shapeUser(user));
  }),
);

// ---- activate / deactivate ------------------------------------------

usersRouter.post(
  "/:id/activate",
  requireAuth,
  requirePermission("users", "update"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const target = await assertManageableUser(req.auth!, req.params.id);
    const user = await prisma.user.update({
      where: { id: target.id },
      data: { isActive: true },
      select: USER_SELECT,
    });
    await writeAuditLog({
      actorId: req.auth!.user.id,
      action: "user.activate",
      targetType: "user",
      targetId: target.id,
    });
    res.json(shapeUser(user)); // idempotent
  }),
);

usersRouter.post(
  "/:id/deactivate",
  requireAuth,
  requirePermission("users", "update"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const target = await assertManageableUser(req.auth!, req.params.id, { blockSelf: true });
    await assertNotLastSuperAdmin(target.id);
    const user = await prisma.user.update({
      where: { id: target.id },
      data: { isActive: false },
      select: USER_SELECT,
    });
    await bumpTokenVersion(target.id); // revoke live sessions immediately
    await writeAuditLog({
      actorId: req.auth!.user.id,
      action: "user.deactivate",
      targetType: "user",
      targetId: target.id,
    });
    res.json(shapeUser(user));
  }),
);

// ---- reset-password (admin-set temp + forced change) ----------------

const resetSchema = z.object({ tempPassword: z.string().min(8) });

usersRouter.post(
  "/:id/reset-password",
  requireAuth,
  requirePermission("users", "update"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { tempPassword } = validate(resetSchema, req.body); // never logged
    // Resetting your OWN password via the admin flow bumps tokenVersion (to kill
    // the target's live sessions) and sets mustChangePassword — which would log
    // the actor out of their own session. Own-account password changes go through
    // POST /api/auth/change-password (returns a fresh token). Block self here,
    // consistent with the deactivate/delete/role-change self-guards (PLAN §8).
    if (req.params.id === req.auth!.user.id) {
      throw new HttpError(403, "Use the change-password screen to reset your own password");
    }
    const target = await assertManageableUser(req.auth!, req.params.id);
    await prisma.user.update({
      where: { id: target.id },
      data: {
        passwordHash: await bcrypt.hash(tempPassword, 10),
        mustChangePassword: true,
      },
    });
    await bumpTokenVersion(target.id); // invalidate any live sessions
    await writeAuditLog({
      actorId: req.auth!.user.id,
      action: "user.reset_password", // detail intentionally omits the password
      targetType: "user",
      targetId: target.id,
    });
    res.json({ ok: true });
  }),
);

// ---- DELETE /api/users/:id ------------------------------------------

usersRouter.delete(
  "/:id",
  requireAuth,
  requirePermission("users", "delete"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const target = await assertManageableUser(req.auth!, req.params.id, { blockSelf: true });
    await assertNotLastSuperAdmin(target.id);
    // Users with orders are FK-referenced — deactivate is the recommended path.
    const orderCount = await prisma.order.count({ where: { userId: target.id } });
    if (orderCount > 0) {
      throw new HttpError(409, "User has orders and cannot be deleted; deactivate instead");
    }
    await prisma.user.delete({ where: { id: target.id } });
    await writeAuditLog({
      actorId: req.auth!.user.id,
      action: "user.delete",
      targetType: "user",
      targetId: target.id,
    });
    res.json({ ok: true });
  }),
);
