// =====================================================================
// api/rbac/service.ts — the RBAC protection choke point (PLAN §4.3 / §5.2 / §8).
//
// Every escalation / system-role / self-action / last-super-admin invariant
// lives HERE so the users and roles routers cannot drift apart. Guards run
// AFTER requirePermission (which already proved the actor may touch the
// module at all); these functions add the row-level "…but not THIS one /
// not more than you hold" rules.
//
//   assertGrantable        — subset anti-escalation (can't hand out what you
//                            don't hold; never a PLATFORM role)
//   assertManageableUser   — PLATFORM targets are 404 (no existence leak);
//                            optional self-block
//   assertNotLastSuperAdmin— platform-lockout guard
//   bumpTokenVersion       — kill a user's live JWTs on the next request
//   bumpRoleVersion        — rotate the permission-cache key after a grid edit
// =====================================================================

import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client.ts";
import { type AuthContext, HttpError } from "../http.ts";
import type { DataScope } from "../../rbac/registry.ts";
import { invalidateRole } from "./resolver.ts";

/** One cell the actor is trying to grant (role create / grid replace). */
export interface GrantTuple {
  module: string;
  action: string;
  scope: DataScope;
}

/** The minimal target-user shape the routers need after a manageability check. */
export interface TargetUser {
  id: string;
  isActive: boolean;
  roleId: string | null;
  roleSlug: string | null;
  roleScope: "PLATFORM" | "ORG" | null;
}

/** Does the actor personally hold this (module, action, scope)? OWN < ALL. */
function actorHolds(actor: AuthContext, t: GrantTuple): boolean {
  if (actor.isSuperAdmin) return true;
  const entry = actor.permissions.get(t.module);
  if (!entry || !entry.actions.has(t.action)) return false;
  // Granting ALL requires the actor to hold ALL; granting OWN is satisfied by
  // either OWN or ALL (a broader scope subsumes the narrower one).
  if (t.scope === "ALL" && entry.scope !== "ALL") return false;
  return true;
}

/** Materialize a role's grid into grant tuples (for the {roleId} subset check). */
async function roleGrantTuples(roleId: string): Promise<GrantTuple[]> {
  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    select: {
      scope: true,
      module: { select: { slug: true } },
      action: { select: { slug: true } },
    },
  });
  return rows.map((r) => ({
    module: r.module.slug,
    action: r.action.slug,
    scope: r.scope,
  }));
}

/**
 * Anti-escalation (PLAN §4.3.3). A non-super-admin may only grant/assign what
 * they themselves hold. Super Admin bypasses (holds everything by construction).
 *
 *  - `GrantTuple[]`  → every tuple must be a subset of the actor's grid.
 *  - `{ roleId }`    → the role must be visible to the actor (never PLATFORM
 *                      for a non-SA — 404, no existence leak) and its ENTIRE
 *                      grid must be a subset of the actor's.
 */
export async function assertGrantable(
  actor: AuthContext,
  grants: GrantTuple[] | { roleId: string },
): Promise<void> {
  let tuples: GrantTuple[];

  if (Array.isArray(grants)) {
    tuples = grants;
  } else {
    const role = await prisma.role.findUnique({
      where: { id: grants.roleId },
      select: { scope: true },
    });
    // Unknown role, or a PLATFORM role an org actor may not even see → 404.
    if (!role || (role.scope === "PLATFORM" && !actor.isSuperAdmin)) {
      throw new HttpError(404, "Role not found");
    }
    if (actor.isSuperAdmin) return; // SA can assign any (non-hidden) role
    tuples = await roleGrantTuples(grants.roleId);
  }

  if (actor.isSuperAdmin) return;

  for (const t of tuples) {
    if (!actorHolds(actor, t)) {
      throw new HttpError(
        403,
        `Cannot grant a permission you do not hold: ${t.module}.${t.action}` +
          (t.scope === "ALL" ? " (scope ALL)" : ""),
      );
    }
  }
}

/**
 * Load a user the actor is allowed to act on (PLAN §4.3.1 / §8). A PLATFORM
 * target is 404 (not 403) for a non-SA so Super Admins don't leak. Optionally
 * block acting on oneself (deactivate / delete / role-change).
 */
export async function assertManageableUser(
  actor: AuthContext,
  targetId: string,
  opts: { blockSelf?: boolean } = {},
): Promise<TargetUser> {
  const u = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      isActive: true,
      roleId: true,
      roleRef: { select: { slug: true, scope: true } },
    },
  });
  if (!u) throw new HttpError(404, "User not found");

  const roleScope = u.roleRef?.scope ?? null;
  if (roleScope === "PLATFORM" && !actor.isSuperAdmin) {
    throw new HttpError(404, "User not found"); // hide platform users
  }
  if (opts.blockSelf && u.id === actor.user.id) {
    throw new HttpError(403, "You cannot perform this action on your own account");
  }

  return {
    id: u.id,
    isActive: u.isActive,
    roleId: u.roleId,
    roleSlug: u.roleRef?.slug ?? null,
    roleScope,
  };
}

/**
 * Platform-lockout guard (PLAN §8). If the target is an ACTIVE Super Admin,
 * refuse the operation when it would leave zero active Super Admins. Applied on
 * deactivate / delete / role-change. (A benign race at this scale — a stricter
 * serializable check is a later option.)
 */
export async function assertNotLastSuperAdmin(targetId: string): Promise<void> {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { isActive: true, roleRef: { select: { scope: true } } },
  });
  if (!target || target.roleRef?.scope !== "PLATFORM") return; // not a SA

  const activeSuperAdmins = await prisma.user.count({
    where: { isActive: true, roleRef: { scope: "PLATFORM" } },
  });
  // If the target is currently active, removing/demoting it drops the count by 1.
  const remaining = target.isActive ? activeSuperAdmins - 1 : activeSuperAdmins;
  if (remaining < 1) {
    throw new HttpError(409, "Cannot remove the last active Super Admin");
  }
}

/** Bump a user's tokenVersion → their live JWTs are rejected on the next request. */
export async function bumpTokenVersion(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}

/** Bump a role's version → rotate the permission-cache key + local bust. */
export async function bumpRoleVersion(roleId: string): Promise<void> {
  await prisma.role.update({
    where: { id: roleId },
    data: { version: { increment: 1 } },
  });
  invalidateRole(roleId);
}

// =====================================================================
// Audit trail (PLAN §8 / Phase 6). Append-only accountability for every RBAC
// mutation. No UI in v1 — the `audit_log` table is queried via SQL.
//
// Best-effort by design: an audit failure NEVER fails the operation it records
// (availability > a missing accountability row), but it is logged to stderr so
// ops can alert. Callers pass the semantic action, the target, and a
// non-sensitive detail blob (NEVER a password / hash).
// =====================================================================

export interface AuditEntry {
  actorId: string | null; // who did it (null for system/seed)
  action: string; // "user.create", "role.permissions.update", …
  targetType: "user" | "role";
  targetId: string | null;
  detail?: unknown; // before/after or grid diff — must be JSON-serialisable & non-sensitive
}

/** Write one append-only audit row. Swallows its own errors (see header). */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        detail:
          entry.detail === undefined
            ? undefined
            : (entry.detail as Prisma.InputJsonValue),
      },
    });
  } catch (err) {
    console.error(`[audit] failed to record ${entry.action}`, err);
  }
}
