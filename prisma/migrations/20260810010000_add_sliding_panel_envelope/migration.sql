-- Sliding patio — the panel envelope becomes a CATALOG value (patio.pdf, 07 Aug 2026).
--
-- The owner's re-issued cutting package "100 SOFT UK" (patio.pdf, four items
-- F1-F4: 2000x2000 OX, 3000x2000 XOO, 4000x2000 4-panel, 3500x2000 OXO) is the
-- same four jobs as the superseded patio_calibration.pdf (31 Jul 2026), and a
-- line-by-line diff of the two shows exactly ONE substantive change: every
-- panel is 3 mm bigger in BOTH axes.
--
--   sash SPQ-GL-20252  1005/1920 -> 1008/1923   (saw sizes, +3)
--   bead SPQ-1-51252    869/1784 ->  872/1787
--   sash steel AU26X26  859/1774 ->  862/1777
--   glass               859x1774 ->  862x1777
--   sash cap SPQ-GL-20253   1912 ->     1915    (= panelExtH - 2, so it tracks)
--   frame, frame steel, every auxiliary row, all quantities   IDENTICAL
--
-- i.e. the engine's `panelExt = f x (W + K) - 6` / `panelExtH = H - 86` becomes
-- `- 3` / `- 83`. K (10/3/92) is unchanged and still reproduces all four items.
--
-- Those two deductions are a fabricator SETTING rather than profile geometry —
-- the same physical profiles printed 6/86 four weeks earlier — so they live in
-- the catalog, on the sliding sash row, where the owner can change them without
-- a code change. NULL on both columns ⇒ the engine's cited default (3/83), so
-- the additive migration is safe on any row that never carried one.
--
-- The UPDATE below backfills the already-seeded catalog, which is what delivers
-- the corrected cut sizes WITHOUT a full reseed.
--
-- Plain SQL (not `migrate dev`) so it applies through a transaction-mode pooler
-- with `prisma migrate deploy`.

ALTER TABLE "profile_part" ADD COLUMN IF NOT EXISTS "panelClearanceMm" DECIMAL(10,4);
ALTER TABLE "profile_part" ADD COLUMN IF NOT EXISTS "panelHeightDeductionMm" DECIMAL(10,4);

UPDATE "profile_part"
   SET "panelClearanceMm" = 3, "panelHeightDeductionMm" = 83
 WHERE "kind" = 'SASH' AND "partKey" = 'sash-sliding';
