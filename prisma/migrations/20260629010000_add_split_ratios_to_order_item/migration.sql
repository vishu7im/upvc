-- Persist span-drag overrides on each order item so confirmed documents
-- re-solve with the same custom geometry the configurator previewed.
ALTER TABLE "order_item" ADD COLUMN "splitRatios" JSONB;
