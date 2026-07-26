-- Designer platform, phase 2: persisted designer line items.
-- Spec/00-architecture/data-model.md §1 (DesignerLineItem).
--
-- Purely additive: ONE new table, no change to any existing table, so the
-- engine, the legacy /quote flow and every validation assertion are untouched.
-- Plain SQL (no shadow DB) so it applies with `prisma migrate deploy` behind a
-- transaction-mode pooler — the repo's standing constraint.
--
-- "draft" is the AUTHORITATIVE LineItemDraft JSON (line-item-schema.md §2);
-- "resolved" is a nullable ResolvedLineItem cache with "catalogVersion" as its
-- staleness marker. No money columns: pricing lives inside the cached resolve
-- and is always re-derivable from the draft + catalog.

-- CreateTable
CREATE TABLE "designer_line_item" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "draft" JSONB NOT NULL,
    "resolved" JSONB,
    "catalogVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "designer_line_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "designer_line_item_orderId_position_key" ON "designer_line_item"("orderId", "position");

-- AddForeignKey
ALTER TABLE "designer_line_item" ADD CONSTRAINT "designer_line_item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
