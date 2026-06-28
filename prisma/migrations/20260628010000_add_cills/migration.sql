-- Cills (window sills) + per-item cill selection.
-- A cill is an external profile fitted below the frame; selecting any cill
-- reduces the manufacturing height by a fixed 30 mm (engine, solve.ts).

-- AlterTable
ALTER TABLE "order_item" ADD COLUMN     "cillKey" TEXT;

-- CreateTable
CREATE TABLE "cill" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "partKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectionMm" INTEGER NOT NULL,
    "cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "price" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "per" TEXT NOT NULL DEFAULT 'm',
    "weight" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "financialCategory" TEXT NOT NULL DEFAULT 'Glazing Accessories',

    CONSTRAINT "cill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cill_systemId_partKey_key" ON "cill"("systemId", "partKey");

-- AddForeignKey
ALTER TABLE "cill" ADD CONSTRAINT "cill_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "profile_system"("id") ON DELETE CASCADE ON UPDATE CASCADE;
