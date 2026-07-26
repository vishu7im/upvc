-- Surface texture of a finish, for the realistic PREVIEW only ("woodgrain").
-- Supplier fact, never inferred from the swatch hex; NULL ⇒ rendered smooth.
-- Consumed by src/engine/svg.ts's opt-in realistic style; it feeds no cut,
-- no BOM line, no price, and no document, so existing quotes are unaffected.
ALTER TABLE "colour_option" ADD COLUMN IF NOT EXISTS "texture" TEXT;
