-- AlterTable
ALTER TABLE "order" ADD COLUMN     "totalPrice" DECIMAL(12,4);

-- AlterTable
ALTER TABLE "profile_system" ADD COLUMN     "defaultColourKey" TEXT;

-- CreateTable
CREATE TABLE "colour_option" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "costUpliftPct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "priceUpliftPct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "isBase" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "colour_option_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "colour_option_systemId_key_key" ON "colour_option"("systemId", "key");

-- AddForeignKey
ALTER TABLE "colour_option" ADD CONSTRAINT "colour_option_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "profile_system"("id") ON DELETE CASCADE ON UPDATE CASCADE;
