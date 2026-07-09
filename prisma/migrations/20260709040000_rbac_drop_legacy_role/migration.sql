-- Phase 6 (RBAC hardening): drop the legacy free-form `User.role` string and
-- make `roleId` the single, REQUIRED source of role truth.
--
-- Safety backfill first: any user still missing a roleId is assigned the org
-- Customer role so the SET NOT NULL below cannot fail. This is defensive — the
-- Phase-1 migration (20260709030000_rbac_foundation) already backfilled every
-- existing user, so on this DB it affects 0 rows.
UPDATE "user"
SET "roleId" = (
  SELECT "id" FROM "role"
  WHERE "slug" = 'customer' AND "organizationId" IS NOT NULL
  LIMIT 1
)
WHERE "roleId" IS NULL;

-- DropForeignKey (the referential action tightens from SetNull → Restrict now
-- that the relation is required; deleting an in-use role is already blocked by
-- the roles API with a 409 role_in_use).
ALTER TABLE "user" DROP CONSTRAINT "user_roleId_fkey";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "role",
ALTER COLUMN "roleId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
