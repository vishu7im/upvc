// =====================================================================
// src/tools/sync-permissions.ts — `npm run sync:permissions`
//
// Reconciles the RBAC module/action/role registry (src/rbac/registry.ts) into
// the database: creates any missing modules, actions, roles and grid rows.
// It NEVER overwrites an existing role permission (owner-editable grids are
// preserved), so it is safe to run repeatedly and after adding a new module to
// the registry — no manual DB edits, no migration needed for a new permission
// surface (PLAN §10 "Phase 1 Addition — Permission Synchronization").
// =====================================================================

import { PrismaClient } from "@prisma/client";
import { syncRbac } from "../rbac/sync.ts";

const prisma = new PrismaClient();

async function main() {
  const report = await syncRbac(prisma);
  console.log("Permission sync complete:");
  console.log(`  organizations : ${report.orgs}`);
  console.log(`  actions        : ${report.actions}`);
  console.log(`  modules        : ${report.modules}`);
  console.log(`  roles          : ${report.roles}`);
  console.log(`  grants inserted: ${report.grantsInserted} (existing grants left untouched)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
