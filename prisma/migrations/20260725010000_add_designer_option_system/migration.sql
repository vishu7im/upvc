-- Designer platform, phase 1: product families + the JSON-driven option system.
-- Spec/00-architecture/data-model.md §1.
--
-- Purely additive: four NEW tables, no change to any existing table, so the
-- engine, the legacy /quote flow and every validation assertion are untouched.
-- Plain SQL (no shadow DB) so it applies with `prisma migrate deploy` behind a
-- transaction-mode pooler — the repo's standing constraint.
--
-- No money columns here: a choice points at a catalog part via "partKey" and
-- the price is read from that part (golden rule — never an inline price).

-- CreateTable
CREATE TABLE "product_family" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "descriptor" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_family_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "option_group" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "icon" TEXT,
    "defaultCollapsed" BOOLEAN NOT NULL DEFAULT true,
    "scope" TEXT NOT NULL DEFAULT 'mixed',

    CONSTRAINT "option_group_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "option_def" (
    "key" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "display" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "scope" JSONB NOT NULL,
    "filters" JSONB,
    "visibility" JSONB,
    "validation" JSONB,
    "presentation" JSONB,
    "pricingMode" TEXT NOT NULL DEFAULT 'catalog',
    "action" JSONB,
    "familyKeys" TEXT[],

    CONSTRAINT "option_def_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "option_choice" (
    "key" TEXT NOT NULL,
    "optionKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "filterKeys" TEXT[],
    "image" JSONB,
    "swatchHex" TEXT,
    "partKey" TEXT,
    "engineEffect" JSONB,
    "visibility" JSONB,

    CONSTRAINT "option_choice_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "option_def" ADD CONSTRAINT "option_def_groupKey_fkey" FOREIGN KEY ("groupKey") REFERENCES "option_group"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_choice" ADD CONSTRAINT "option_choice_optionKey_fkey" FOREIGN KEY ("optionKey") REFERENCES "option_def"("key") ON DELETE CASCADE ON UPDATE CASCADE;
