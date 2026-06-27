-- CreateEnum
CREATE TYPE "PartKind" AS ENUM ('FRAME', 'SASH', 'TRANSOM', 'BEAD', 'REINFORCEMENT');

-- CreateTable
CREATE TABLE "profile_system" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "stockBarLengthMm" INTEGER NOT NULL,
    "sawKerfMm" INTEGER NOT NULL,

    CONSTRAINT "profile_system_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_part" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "partKey" TEXT NOT NULL,
    "kind" "PartKind" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faceWidth" DECIMAL(10,4) NOT NULL,
    "cost" DECIMAL(12,4) NOT NULL,
    "price" DECIMAL(12,4) NOT NULL,
    "per" TEXT NOT NULL,
    "weight" DECIMAL(12,4) NOT NULL,
    "financialCategory" TEXT NOT NULL,
    "glassRebate" DECIMAL(10,4),
    "overlap" DECIMAL(10,4),
    "stickOut" DECIMAL(10,4),
    "jointType" TEXT,
    "endClearance" DECIMAL(10,4),

    CONSTRAINT "profile_part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "glass" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "partKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rebatePerSide" DECIMAL(10,4) NOT NULL,
    "cost" DECIMAL(12,4) NOT NULL,
    "price" DECIMAL(12,4) NOT NULL,
    "per" TEXT NOT NULL,
    "weight" DECIMAL(12,4) NOT NULL,
    "financialCategory" TEXT NOT NULL,

    CONSTRAINT "glass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gasket" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "partKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost" DECIMAL(12,4) NOT NULL,
    "price" DECIMAL(12,4) NOT NULL,
    "per" TEXT NOT NULL,
    "weight" DECIMAL(12,4) NOT NULL,
    "financialCategory" TEXT NOT NULL,

    CONSTRAINT "gasket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hardware" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "partKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost" DECIMAL(12,4) NOT NULL,
    "price" DECIMAL(12,4) NOT NULL,
    "per" TEXT NOT NULL,
    "weight" DECIMAL(12,4) NOT NULL,
    "financialCategory" TEXT NOT NULL,
    "lengthMm" DECIMAL(10,4),

    CONSTRAINT "hardware_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reinforcement_map" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "profileCode" TEXT NOT NULL,
    "reinforcementKey" TEXT NOT NULL,

    CONSTRAINT "reinforcement_map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design" (
    "designId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "frameKey" TEXT NOT NULL,
    "topology" JSONB NOT NULL,
    "svgPreview" TEXT,

    CONSTRAINT "design_pkey" PRIMARY KEY ("designId")
);

-- CreateTable
CREATE TABLE "setting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL,
    "taxApply" BOOLEAN NOT NULL,
    "taxPct" DECIMAL(6,3) NOT NULL,
    "markupPct" DECIMAL(6,3) NOT NULL,
    "wastagePct" DECIMAL(6,3) NOT NULL,
    "labourPerSash" DECIMAL(12,4) NOT NULL,
    "labourPerDoor" DECIMAL(12,4) NOT NULL,
    "labourBase" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profile_part_systemId_kind_partKey_key" ON "profile_part"("systemId", "kind", "partKey");

-- CreateIndex
CREATE UNIQUE INDEX "glass_systemId_partKey_key" ON "glass"("systemId", "partKey");

-- CreateIndex
CREATE UNIQUE INDEX "gasket_systemId_partKey_key" ON "gasket"("systemId", "partKey");

-- CreateIndex
CREATE UNIQUE INDEX "hardware_systemId_partKey_key" ON "hardware"("systemId", "partKey");

-- CreateIndex
CREATE UNIQUE INDEX "reinforcement_map_systemId_profileCode_key" ON "reinforcement_map"("systemId", "profileCode");

-- AddForeignKey
ALTER TABLE "profile_part" ADD CONSTRAINT "profile_part_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "profile_system"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "glass" ADD CONSTRAINT "glass_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "profile_system"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gasket" ADD CONSTRAINT "gasket_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "profile_system"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware" ADD CONSTRAINT "hardware_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "profile_system"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reinforcement_map" ADD CONSTRAINT "reinforcement_map_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "profile_system"("id") ON DELETE CASCADE ON UPDATE CASCADE;
