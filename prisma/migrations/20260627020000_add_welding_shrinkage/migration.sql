-- Welding shrinkage compensation.
--
-- 1. Per-profile-part weld allowance (mm per welded end). Additive, default 0 so
--    existing rows + engine output stay byte-identical until an admin edits it.
ALTER TABLE "profile_part" ADD COLUMN "weldAllowanceMm" DECIMAL(10,4) NOT NULL DEFAULT 0;

-- 2. Cut-length variant on generated documents ("normal" | "welded").
--    Existing rows become the "normal" variant; the unique key now includes it
--    so a single order can store both a normal and a welded copy of each doc.
ALTER TABLE "document" ADD COLUMN "variant" TEXT NOT NULL DEFAULT 'normal';

DROP INDEX "document_orderId_type_key";
CREATE UNIQUE INDEX "document_orderId_type_variant_key" ON "document"("orderId", "type", "variant");
