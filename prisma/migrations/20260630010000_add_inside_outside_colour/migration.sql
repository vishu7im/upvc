-- Inside/outside colour finish (additive, backward-compatible).
--
-- 1) Optional display swatch on a colour option (cosmetic only — tints the
--    preview SVG / 3D view; null ⇒ historical grey, byte-identical default).
ALTER TABLE "colour_option" ADD COLUMN "hex" TEXT;

-- 2) Per-quote inside/outside colour selection persisted on each order item so
--    confirmed documents re-solve with the same finish the configurator showed.
--    null ⇒ system default colour (single White ⇒ byte-identical to before).
ALTER TABLE "order_item" ADD COLUMN "colourKeyInside" TEXT;
ALTER TABLE "order_item" ADD COLUMN "colourKeyOutside" TEXT;
