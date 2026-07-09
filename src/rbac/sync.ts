// =====================================================================
// src/rbac/sync.ts — idempotently reconcile the DB with src/rbac/registry.ts.
//
// Used by BOTH prisma/seed.ts and `npm run sync:permissions`
// (src/tools/sync-permissions.ts). Given the registry (the source of truth), it:
//   • upserts the default organization (by slug),
//   • upserts permission actions (by slug),
//   • upserts modules (by slug) — refreshing nav metadata,
//   • upserts roles (by [organizationId, slug]),
//   • INSERTS ONLY MISSING grid rows for each seed role — it NEVER deletes or
//     rewrites an existing RolePermission, so an owner-edited grid is preserved
//     (the same "owner-editable" convention the catalog seed uses for prices).
//
// Because it only adds missing rows, a role.version bump is unnecessary here
// (an unchanged grid stays identical; a genuinely new module's grants are
// additive and any running cache is keyed by version, which the API bumps on
// its own edits). Sequential awaited upserts — NO interactive $transaction —
// so it is safe through a transaction-mode pooler (PgBouncer :5433).
// =====================================================================

import type { PrismaClient } from "@prisma/client";
import { ACTIONS, DEFAULT_ORG, MODULES, ROLES, type RoleDef } from "./registry.ts";

export interface SyncReport {
  orgs: number;
  actions: number;
  modules: number;
  roles: number;
  grantsInserted: number;
}

export async function syncRbac(prisma: PrismaClient): Promise<SyncReport> {
  // 1. Default organization -----------------------------------------------
  const org = await prisma.organization.upsert({
    where: { slug: DEFAULT_ORG.slug },
    update: { name: DEFAULT_ORG.name },
    create: { slug: DEFAULT_ORG.slug, name: DEFAULT_ORG.name },
  });

  // 2. Permission actions --------------------------------------------------
  const actionIdBySlug = new Map<string, string>();
  for (const a of ACTIONS) {
    const row = await prisma.permissionAction.upsert({
      where: { slug: a.slug },
      update: { name: a.name, sortOrder: a.sortOrder },
      create: { slug: a.slug, name: a.name, sortOrder: a.sortOrder },
    });
    actionIdBySlug.set(a.slug, row.id);
  }

  // 3. Modules -------------------------------------------------------------
  const moduleIdBySlug = new Map<string, string>();
  for (const m of MODULES) {
    const row = await prisma.module.upsert({
      where: { slug: m.slug },
      update: {
        name: m.name,
        navPath: m.navPath,
        navIcon: m.navIcon,
        category: m.category,
        sortOrder: m.sortOrder,
      },
      create: {
        slug: m.slug,
        name: m.name,
        navPath: m.navPath,
        navIcon: m.navIcon,
        category: m.category,
        sortOrder: m.sortOrder,
      },
    });
    moduleIdBySlug.set(m.slug, row.id);
  }

  // 4. Roles ---------------------------------------------------------------
  let grantsInserted = 0;
  for (const def of ROLES) {
    const organizationId = def.platform ? null : org.id;
    const role = await prisma.role.upsert({
      // The composite unique [organizationId, slug] cannot be used in `where`
      // when organizationId is null (Prisma requires a non-null compound key),
      // so resolve the row by hand first, then create/update.
      where: { id: (await findRoleId(prisma, organizationId, def.slug)) ?? "__none__" },
      update: {
        name: def.name,
        description: def.description,
        scope: def.scope,
        isSystem: def.isSystem,
      },
      create: {
        organizationId,
        slug: def.slug,
        name: def.name,
        description: def.description,
        scope: def.scope,
        isSystem: def.isSystem,
      },
    });

    grantsInserted += await syncRoleGrants(prisma, role.id, def, moduleIdBySlug, actionIdBySlug);
  }

  return {
    orgs: 1,
    actions: ACTIONS.length,
    modules: MODULES.length,
    roles: ROLES.length,
    grantsInserted,
  };
}

/** Resolve a role id by (organizationId, slug), handling the null-org case. */
async function findRoleId(
  prisma: PrismaClient,
  organizationId: string | null,
  slug: string,
): Promise<string | null> {
  const row = await prisma.role.findFirst({
    where: { organizationId, slug },
    select: { id: true },
  });
  return row?.id ?? null;
}

/** Insert ONLY missing grid rows for a role — never delete or modify existing. */
async function syncRoleGrants(
  prisma: PrismaClient,
  roleId: string,
  def: RoleDef,
  moduleIdBySlug: Map<string, string>,
  actionIdBySlug: Map<string, string>,
): Promise<number> {
  let inserted = 0;
  for (const grant of def.grants) {
    const moduleId = moduleIdBySlug.get(grant.module);
    if (!moduleId) throw new Error(`registry role ${def.slug}: unknown module "${grant.module}"`);
    for (const actionSlug of grant.actions) {
      const actionId = actionIdBySlug.get(actionSlug);
      if (!actionId) throw new Error(`registry role ${def.slug}: unknown action "${actionSlug}"`);
      const existing = await prisma.rolePermission.findUnique({
        where: { roleId_moduleId_actionId: { roleId, moduleId, actionId } },
        select: { id: true },
      });
      if (existing) continue; // owner-editable: leave existing grants untouched
      await prisma.rolePermission.create({
        data: { roleId, moduleId, actionId, scope: grant.scope },
      });
      inserted++;
    }
  }
  return inserted;
}
