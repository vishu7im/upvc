-- Per-profile colour-tier prices (M5.5). Additive: four nullable columns on
-- profile_part. NULL ⇒ no tier price ⇒ pricing falls back to base × %-uplift,
-- so existing (White) quotes stay byte-identical.

-- AlterTable
ALTER TABLE "profile_part" ADD COLUMN "cost1p" DECIMAL(12,4),
ADD COLUMN "price1p" DECIMAL(12,4),
ADD COLUMN "cost2p" DECIMAL(12,4),
ADD COLUMN "price2p" DECIMAL(12,4);
