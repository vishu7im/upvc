// =====================================================================
// api/roles.ts — role & permission-grid management (PLAN §6.2). Mounted at
// /api/roles behind requireAuth; guarded per-route by requirePermission("roles", …).
//
// System-role protection, PLATFORM-role hiding (404 not 403) and anti-escalation
// on every grid tuple are delegated to src/api/rbac/service.ts. The grid replace
// is an array-form $transaction (pooler-safe) that bumps Role.version so the
// permission cache rotates and edits take effect on the next request without
// re-login.
// =====================================================================

import { Router } from "express";
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
import { assertGrantable, type GrantTuple, writeAuditLog } from "./rbac/service.ts";
import { invalidateRole } from "./rbac/resolver.ts";
import { DEFAULT_ORG } from "../rbac/registry.ts";
import { paginated, parsePagination } from "./pagination.ts";

export const rolesRouter = Router();

/** name → url-safe slug (lowercase, hyphenated). */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** A non-SA may only ever see/act on ORG-scoped roles (PLATFORM is hidden). */
function visibilityWhere(auth: AuthContext): Record<string, unknown> {
  return auth.isSuperAdmin ? {} : { scope: "ORG" };
}

/** Resolve the grid input (module/action slugs) into RolePermission FK rows. */
async function resolveGridRows(
  tuples: GrantTuple[],
): Promise<{ moduleId: string; actionId: string; scope: GrantTuple["scope"] }[]> {
  const [modules, actions] = await Promise.all([
    prisma.module.findMany({ select: { id: true, slug: true } }),
    prisma.permissionAction.findMany({ select: { id: true, slug: true } }),
  ]);
  const moduleId = new Map(modules.map((m) => [m.slug, m.id]));
  const actionId = new Map(actions.map((a) => [a.slug, a.id]));

  // Dedupe (module, action) — last scope wins on a duplicated cell.
  const seen = new Map<string, { moduleId: string; actionId: string; scope: GrantTuple["scope"] }>();
  for (const t of tuples) {
    const mid = moduleId.get(t.module);
    const aid = actionId.get(t.action);
    if (!mid) throw new HttpError(400, `Unknown module: ${t.module}`);
    if (!aid) throw new HttpError(400, `Unknown action: ${t.action}`);
    seen.set(`${mid}:${aid}`, { moduleId: mid, actionId: aid, scope: t.scope });
  }
  return [...seen.values()];
}

// ---- GET /api/roles -------------------------------------------------

rolesRouter.get(
  "/",
  requireAuth,
  requirePermission("roles", "read"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const p = parsePagination(req.query);
    const where = visibilityWhere(auth);

    const [rows, total] = await Promise.all([
      prisma.role.findMany({
        where,
        orderBy: [{ isSystem: "desc" }, { name: "asc" }],
        skip: p.skip,
        take: p.take,
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          scope: true,
          isSystem: true,
          version: true,
          createdAt: true,
          _count: { select: { users: true } },
        },
      }),
      prisma.role.count({ where }),
    ]);

    const data = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      scope: r.scope,
      isSystem: r.isSystem,
      version: r.version,
      userCount: r._count.users,
      createdAt: r.createdAt,
    }));
    res.json(paginated(data, total, p));
  }),
);

// ---- POST /api/roles ------------------------------------------------

const gridSchema = z.array(
  z.object({
    module: z.string().min(1),
    action: z.string().min(1),
    scope: z.enum(["OWN", "ALL"]).default("ALL"),
  }),
);

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  permissions: gridSchema.default([]),
});

rolesRouter.post(
  "/",
  requireAuth,
  requirePermission("roles", "create"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const body = validate(createSchema, req.body);

    // scope is FORCED to ORG (never accepted from input — §4.3.1); every tuple
    // must be a subset of what the actor holds.
    const tuples: GrantTuple[] = body.permissions.map((g) => ({
      module: g.module,
      action: g.action,
      scope: g.scope,
    }));
    await assertGrantable(auth, tuples);
    const rows = await resolveGridRows(tuples);

    // v1 is single-org: new roles belong to the seeded default org.
    const org = await prisma.organization.findUnique({ where: { slug: DEFAULT_ORG.slug } });
    if (!org) throw new HttpError(500, "Default organization missing");

    const slug = slugify(body.name);
    if (!slug) throw new HttpError(400, "Role name must contain alphanumerics");
    const clash = await prisma.role.findUnique({
      where: { organizationId_slug: { organizationId: org.id, slug } },
    });
    if (clash) throw new HttpError(409, "A role with a similar name already exists");

    const role = await prisma.role.create({
      data: {
        organizationId: org.id,
        slug,
        name: body.name,
        description: body.description ?? null,
        scope: "ORG",
        isSystem: false,
        permissions: { create: rows },
      },
      select: { id: true, slug: true, name: true, description: true, scope: true, isSystem: true, version: true },
    });
    await writeAuditLog({
      actorId: auth.user.id,
      action: "role.create",
      targetType: "role",
      targetId: role.id,
      detail: { slug: role.slug, name: role.name, grants: tuples.length },
    });
    res.status(201).json(role);
  }),
);

// ---- GET /api/roles/:id (full grid) ---------------------------------

rolesRouter.get(
  "/:id",
  requireAuth,
  requirePermission("roles", "read"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const role = await prisma.role.findFirst({
      where: { id: req.params.id, ...visibilityWhere(auth) }, // PLATFORM → 404 for non-SA
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        scope: true,
        isSystem: true,
        version: true,
        createdAt: true,
        _count: { select: { users: true } },
        permissions: {
          select: {
            scope: true,
            module: { select: { slug: true } },
            action: { select: { slug: true } },
          },
        },
      },
    });
    if (!role) throw new HttpError(404, "Role not found");

    res.json({
      id: role.id,
      slug: role.slug,
      name: role.name,
      description: role.description,
      scope: role.scope,
      isSystem: role.isSystem,
      version: role.version,
      userCount: role._count.users,
      createdAt: role.createdAt,
      permissions: role.permissions.map((pm) => ({
        module: pm.module.slug,
        action: pm.action.slug,
        scope: pm.scope,
      })),
    });
  }),
);

/** Load an actor-visible role or 404 (shared by PATCH/PUT/DELETE). */
async function loadVisibleRole(auth: AuthContext, id: string) {
  const role = await prisma.role.findFirst({
    where: { id, ...visibilityWhere(auth) },
    select: { id: true, isSystem: true, scope: true },
  });
  if (!role) throw new HttpError(404, "Role not found");
  return role;
}

// ---- PATCH /api/roles/:id (name/description) ------------------------

const patchSchema = z
  .object({ name: z.string().min(1).max(80), description: z.string().max(500).nullable() })
  .partial();

rolesRouter.patch(
  "/:id",
  requireAuth,
  requirePermission("roles", "update"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const body = validate(patchSchema, req.body);
    if (Object.keys(body).length === 0) throw new HttpError(400, "No fields to update");

    const role = await loadVisibleRole(auth, req.params.id);
    // Renaming a system role is Super-Admin-only (§4.3.2).
    if (role.isSystem && !auth.isSuperAdmin) {
      throw new HttpError(403, "System roles cannot be renamed");
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name; // slug/scope stay immutable
    if (body.description !== undefined) data.description = body.description;

    const updated = await prisma.role.update({
      where: { id: role.id },
      data,
      select: { id: true, slug: true, name: true, description: true, scope: true, isSystem: true, version: true },
    });
    await writeAuditLog({
      actorId: auth.user.id,
      action: "role.update",
      targetType: "role",
      targetId: role.id,
      detail: { fields: Object.keys(body) },
    });
    res.json(updated);
  }),
);

// ---- PUT /api/roles/:id/permissions (full-grid replace) -------------

rolesRouter.put(
  "/:id/permissions",
  requireAuth,
  requirePermission("roles", "update"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const body = validate(z.object({ permissions: gridSchema }), req.body);

    const role = await loadVisibleRole(auth, req.params.id);
    // Super Admin permissions are structural (no editable grid).
    if (role.scope === "PLATFORM") {
      throw new HttpError(400, "Super Admin permissions are structural and cannot be edited");
    }
    // Editing a SYSTEM role's grid is Super-Admin-only (§4.3.2).
    if (role.isSystem && !auth.isSuperAdmin) {
      throw new HttpError(403, "System role permissions can only be edited by a Super Admin");
    }

    const tuples: GrantTuple[] = body.permissions.map((g) => ({
      module: g.module,
      action: g.action,
      scope: g.scope,
    }));
    await assertGrantable(auth, tuples); // subset anti-escalation on every cell
    const rows = await resolveGridRows(tuples);

    // Delete + insert + version-bump atomically (array form is pooler-safe).
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({
        data: rows.map((r) => ({ ...r, roleId: role.id })),
      }),
      prisma.role.update({ where: { id: role.id }, data: { version: { increment: 1 } } }),
    ]);
    invalidateRole(role.id); // local bust; the version bump handles other processes

    await writeAuditLog({
      actorId: auth.user.id,
      action: "role.permissions.update",
      targetType: "role",
      targetId: role.id,
      detail: { count: rows.length },
    });
    res.json({ ok: true, count: rows.length });
  }),
);

// ---- DELETE /api/roles/:id ------------------------------------------

rolesRouter.delete(
  "/:id",
  requireAuth,
  requirePermission("roles", "delete"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const role = await prisma.role.findFirst({
      where: { id: req.params.id, ...visibilityWhere(auth) },
      select: { id: true, isSystem: true, _count: { select: { users: true } } },
    });
    if (!role) throw new HttpError(404, "Role not found");
    if (role.isSystem) throw new HttpError(403, "System roles cannot be deleted");
    if (role._count.users > 0) {
      // Structured body per PLAN §6.2 so the UI can offer "reassign users first".
      res.status(409).json({ error: "role_in_use", userCount: role._count.users });
      return;
    }
    // Cascade removes the role's RolePermission rows (onDelete: Cascade).
    await prisma.role.delete({ where: { id: role.id } });
    await writeAuditLog({
      actorId: auth.user.id,
      action: "role.delete",
      targetType: "role",
      targetId: role.id,
    });
    res.json({ ok: true });
  }),
);
