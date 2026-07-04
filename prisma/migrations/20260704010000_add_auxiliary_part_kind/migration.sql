-- Sliding-patio auxiliary profiles (slide track / cover caps) — Jobs 44/48.
-- New discriminator value for the unified profile_part table; aux parts use
-- only the base columns (all specialised columns stay NULL).
ALTER TYPE "PartKind" ADD VALUE 'AUXILIARY';
