-- Supplier price-list provenance (M5.5). Additive: three new tables only.

-- CreateTable
CREATE TABLE "supplier" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_document" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "docKey" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "priceBasis" TEXT,
    "notes" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_item" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "supplierCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "colourTier" TEXT,
    "variant" TEXT,
    "packQty" INTEGER,
    "stockLengthM" DECIMAL(10,4),
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "source" TEXT NOT NULL,
    "mappedTable" TEXT,
    "mappedKind" TEXT,
    "mappedPartKey" TEXT,
    "applyNote" TEXT,

    CONSTRAINT "price_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_key_key" ON "supplier"("key");

-- CreateIndex
CREATE UNIQUE INDEX "price_document_docKey_key" ON "price_document"("docKey");

-- CreateIndex
CREATE INDEX "price_item_documentId_idx" ON "price_item"("documentId");

-- AddForeignKey
ALTER TABLE "price_document" ADD CONSTRAINT "price_document_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_item" ADD CONSTRAINT "price_item_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "price_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
