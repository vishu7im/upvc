-- CreateEnum
CREATE TYPE "RoleScope" AS ENUM ('PLATFORM', 'ORG');

-- CreateEnum
CREATE TYPE "PermissionDataScope" AS ENUM ('OWN', 'ALL');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "roleId" TEXT,
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "navPath" TEXT,
    "navIcon" TEXT,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_action" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "permission_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "RoleScope" NOT NULL DEFAULT 'ORG',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "scope" "PermissionDataScope" NOT NULL DEFAULT 'ALL',

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "module_slug_key" ON "module"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "permission_action_slug_key" ON "permission_action"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "role_organizationId_slug_key" ON "role"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "role_permission_roleId_idx" ON "role_permission"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "role_permission_roleId_moduleId_actionId_key" ON "role_permission"("roleId", "moduleId", "actionId");

-- CreateIndex
CREATE INDEX "audit_log_targetType_targetId_idx" ON "audit_log"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_log_actorId_createdAt_idx" ON "audit_log"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "user_roleId_idx" ON "user"("roleId");

-- AddForeignKey
ALTER TABLE "role" ADD CONSTRAINT "role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "permission_action"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- =====================================================================
-- DATA BACKFILL (PLAN §3.3) — plain SQL, runs in this migration's single
-- transaction (pooler-safe under `prisma migrate deploy`). All inserts mirror
-- src/rbac/registry.ts; prisma/seed.ts + `npm run sync:permissions` re-upsert
-- the same rows idempotently, so fresh and migrated installs converge.
-- gen_random_uuid() is built into PostgreSQL 13+.
-- =====================================================================

-- 1. Default organization -------------------------------------------------
INSERT INTO "organization" ("id", "name", "slug", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'Default Organization', 'default', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 2. Permission actions ---------------------------------------------------
INSERT INTO "permission_action" ("id", "slug", "name", "sortOrder") VALUES
  (gen_random_uuid(), 'view',   'View',   0),
  (gen_random_uuid(), 'read',   'Read',   10),
  (gen_random_uuid(), 'create', 'Create', 20),
  (gen_random_uuid(), 'update', 'Update', 30),
  (gen_random_uuid(), 'delete', 'Delete', 40);

-- 3. Modules --------------------------------------------------------------
INSERT INTO "module" ("id", "slug", "name", "navPath", "navIcon", "category", "sortOrder", "isActive") VALUES
  (gen_random_uuid(), 'dashboard', 'Dashboard', '/',               'dashboard', 'General',        0,  true),
  (gen_random_uuid(), 'products',  'Products',  '/products',       'products',  'Inventory',      20, true),
  (gen_random_uuid(), 'quotes',    'Quotes',    '/quote',          'quote',     'Sales',          30, true),
  (gen_random_uuid(), 'customers', 'Customers', NULL,              'customers', 'Sales',          35, true),
  (gen_random_uuid(), 'orders',    'Orders',    '/orders',         'orders',    'Sales',          40, true),
  (gen_random_uuid(), 'catalog',   'Catalog',   '/admin/catalog',  'catalog',   'Administration', 60, true),
  (gen_random_uuid(), 'settings',  'Settings',  '/admin/settings', 'settings',  'Administration', 70, true),
  (gen_random_uuid(), 'users',     'Users',     '/admin/users',    'users',     'Administration', 80, true),
  (gen_random_uuid(), 'roles',     'Roles',     '/admin/roles',    'roles',     'Administration', 90, true);

-- 4. Roles ----------------------------------------------------------------
-- super-admin: PLATFORM scope, no organization (structural bypass, no grid rows).
INSERT INTO "role" ("id", "organizationId", "slug", "name", "description", "scope", "isSystem", "version", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), NULL, 'super-admin', 'Super Admin',
        'Platform owner. Full, unconditional access (structural bypass).',
        'PLATFORM', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- admin + customer: ORG scope, default organization.
INSERT INTO "role" ("id", "organizationId", "slug", "name", "description", "scope", "isSystem", "version", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o.id, 'admin', 'Admin',
       'Company administrator. Full access to every module in the organization.',
       'ORG', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organization" o WHERE o.slug = 'default';

INSERT INTO "role" ("id", "organizationId", "slug", "name", "description", "scope", "isSystem", "version", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o.id, 'customer', 'Customer',
       'Self-service user: browse products, create and view own quotes and orders.',
       'ORG', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organization" o WHERE o.slug = 'default';

-- 5. Role permission grids ------------------------------------------------
-- admin: every module × every action, scope ALL.
INSERT INTO "role_permission" ("id", "roleId", "moduleId", "actionId", "scope")
SELECT gen_random_uuid(), r.id, m.id, a.id, 'ALL'::"PermissionDataScope"
FROM "role" r
CROSS JOIN "module" m
CROSS JOIN "permission_action" a
WHERE r.slug = 'admin' AND r."organizationId" = (SELECT id FROM "organization" WHERE slug = 'default');

-- customer: read-only dashboard/products (ALL); own quotes & orders (OWN).
INSERT INTO "role_permission" ("id", "roleId", "moduleId", "actionId", "scope")
SELECT gen_random_uuid(), r.id, m.id, a.id, g.scope::"PermissionDataScope"
FROM (VALUES
  ('dashboard', 'view',   'ALL'),
  ('dashboard', 'read',   'ALL'),
  ('products',  'view',   'ALL'),
  ('products',  'read',   'ALL'),
  ('quotes',    'view',   'OWN'),
  ('quotes',    'read',   'OWN'),
  ('quotes',    'create', 'OWN'),
  ('orders',    'view',   'OWN'),
  ('orders',    'read',   'OWN'),
  ('orders',    'create', 'OWN')
) AS g(module_slug, action_slug, scope)
JOIN "module" m ON m.slug = g.module_slug
JOIN "permission_action" a ON a.slug = g.action_slug
CROSS JOIN "role" r
WHERE r.slug = 'customer' AND r."organizationId" = (SELECT id FROM "organization" WHERE slug = 'default');

-- 6. Backfill existing users ---------------------------------------------
-- FLAGGED ASSUMPTION (PLAN §3.3): today's "admin" users are the platform owner
-- ⇒ Super Admin. Everyone else ⇒ Customer. Flip in the users UI post-migration
-- if any should be an org Admin instead. Every user gets an org + role so
-- roleId can become required in Phase 6.
UPDATE "user"
SET "roleId" = (SELECT id FROM "role" WHERE slug = 'super-admin' AND "organizationId" IS NULL),
    "organizationId" = (SELECT id FROM "organization" WHERE slug = 'default')
WHERE role = 'admin';

UPDATE "user"
SET "roleId" = (SELECT id FROM "role" WHERE slug = 'customer' AND "organizationId" = (SELECT id FROM "organization" WHERE slug = 'default')),
    "organizationId" = (SELECT id FROM "organization" WHERE slug = 'default')
WHERE role <> 'admin';
