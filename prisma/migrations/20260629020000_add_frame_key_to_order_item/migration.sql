-- Persist the per-quote chamber choice on each order item so confirmed
-- documents re-solve with the same frame profile the configurator previewed.
-- null ⇒ the design's baked frameKey (default geometry).
ALTER TABLE "order_item" ADD COLUMN "frameKey" TEXT;
