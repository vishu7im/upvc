// =====================================================================
// api/rbac/resolver.ts — resolve a role's permission grid into a
// PermissionMap, cached in-process and keyed by `${roleId}:${version}`
// (PLAN §5.1). One join query per (role, version); cached until the
// role's version bumps (a grid edit), at which point the key rotates and
// the next request re-resolves.
//
// Horizontal-scale-safe by construction: `role.version` is read from the
// DB on EVERY request (by requireAuth) — only the immutable grid join for
// a given version is cached here, never the freshness check itself. A
// process that never saw version N simply misses and resolves it once.
// =====================================================================

import { prisma } from "../../db/client.ts";
import type { PermissionMap } from "../http.ts";

// key `${roleId}:${version}` → materialized grid. Entries for stale versions
// are never read again (the key rotates) and are pruned lazily on invalidate.
const cache = new Map<string, PermissionMap>();

/** Resolve (and cache) the effective permission grid for a role version. */
export async function resolvePermissions(
  roleId: string,
  version: number,
): Promise<PermissionMap> {
  const key = `${roleId}:${version}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    select: {
      scope: true,
      module: { select: { slug: true } },
      action: { select: { slug: true } },
    },
  });

  const map: PermissionMap = new Map();
  for (const r of rows) {
    const slug = r.module.slug;
    let entry = map.get(slug);
    if (!entry) {
      entry = { actions: new Set<string>(), scope: r.scope };
      map.set(slug, entry);
    }
    entry.actions.add(r.action.slug);
    // The grid stores scope per (module, action) but the editor sets it per
    // module (PLAN §7.3), so all actions of a module share one scope. Defend
    // against any mismatch by taking the NARROWER scope (OWN wins) — never
    // widen a customer's data access on a stale/mixed row.
    if (r.scope === "OWN") entry.scope = "OWN";
  }

  cache.set(key, map);
  return map;
}

/** Belt-and-braces local bust: drop every cached version of a role. */
export function invalidateRole(roleId: string): void {
  const prefix = `${roleId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
