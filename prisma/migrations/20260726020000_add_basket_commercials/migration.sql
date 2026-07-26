-- Designer platform, phase 6: the order-level commercial layer (basket).
-- Spec/00-architecture/data-model.md §2 (Order extensions + DiscountCode).
--
-- Additive: every new "order" column is NULLABLE (or carries a default that
-- matches today's behaviour), so existing orders read back exactly as before
-- and `computeBasket()` degrades to "items subtotal == grand total" for them.
-- Plain SQL (no shadow DB) so it applies with `prisma migrate deploy` behind a
-- transaction-mode pooler — the repo's standing constraint.
--
-- Money mirrors the repo convention (Decimal, 2 dp for commercial amounts;
-- the engine's own 4 dp totals stay on "order".totalPrice). "discountAmount"
-- and "basketTotals" are SNAPSHOTS written at confirm: a confirmed order must
-- keep showing the numbers the customer agreed to even after a price list,
-- a VAT rate or a discount code changes.

-- AlterTable
ALTER TABLE "order"
  ADD COLUMN "fittingType"    TEXT DEFAULT 'none',
  ADD COLUMN "fittingPrice"   DECIMAL(12,2),
  ADD COLUMN "surveyPrice"    DECIMAL(12,2),
  ADD COLUMN "deliveryCharge" DECIMAL(12,2),
  ADD COLUMN "discountCode"   TEXT,
  ADD COLUMN "discountAmount" DECIMAL(12,2),
  ADD COLUMN "taxRatePct"     DECIMAL(5,2),
  ADD COLUMN "basketTotals"   JSONB;

-- CreateTable
CREATE TABLE "discount_code" (
    "code"      TEXT NOT NULL,
    "kind"      TEXT NOT NULL,
    "value"     DECIMAL(12,2) NOT NULL,
    "active"    BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validTo"   TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_code_pkey" PRIMARY KEY ("code")
);
