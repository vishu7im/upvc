-- DropIndex
DROP INDEX "product_typeId_key";

-- CreateIndex
CREATE INDEX "product_typeId_idx" ON "product"("typeId");

