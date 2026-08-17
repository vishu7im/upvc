-- Align the sliding-system part names with the owner's own English catalog,
-- `SUNNY PLAST SLIDING SYSTEM.pdf`, matched by supplier CODE.
--
-- WHY THIS IS A MIGRATION AND NOT JUST A SEED EDIT
-- `name` is seed-owned (prisma/seed.ts#upsertPart re-applies it on UPDATE —
-- only cost/price/weight/weldAllowanceMm/tier/panel-envelope are owner-owned),
-- so src/catalog/system-sunnyplast.ts is the durable fix and a reseed re-applies
-- these same strings. But `npm run db:seed` takes 15+ minutes against the
-- pooler, so this migration brings the live DB into line immediately. Seed and
-- migration agree, so neither reverts the other. Same pattern as
-- 20260730020000_fix_weld_allowance_drift.
--
-- WHAT WAS WRONG
-- The 2026-08-04 field fix correctly removed the Romanian names transcribed
-- from Jobs 44/48, but replaced them with invented descriptive English names
-- instead of the supplier's own. A patio work order printed "Aluminium Slide
-- Track" where the catalog says "Aluminium sliding rail", and "Sash PVC Cap"
-- where it says "U-PVC interlock & sash cover". The correct names were already
-- cited in src/catalog/price-lists/mapping.ts from Doc D of the price list.
--
-- Every UPDATE is guarded on the OLD value, so this is idempotent and cannot
-- clobber a name the owner has since edited in Admin > Catalog.
--
-- NOT RENAMED, on purpose:
--   • GLIS16 / GLIS17 — the English catalog lists no GLIS 16/17, so there is
--     nothing to match them against; they keep their descriptive names.
--   • AU26X26 — the catalog's second reinforcement reads "Reinforcement
--     27x25x27" and prints NO product code, while this code and the calibrated
--     section both say 26x26. The two disagree, so the code-accurate name
--     stands until the supplier confirms which row AU26X26 is.
--   • SPQ-GL-10252 / SPQ-GL-20252 — "Sliding Frame 48mm" / "Sliding Sash 85mm"
--     already carry the catalog wording plus the size qualifier.

-- ---------------------------------------------------------------- profiles --
UPDATE "profile_part" SET "name" = 'Aluminium Sliding Rail'
 WHERE "code" = 'AD16014'      AND "name" = 'Aluminium Slide Track';

UPDATE "profile_part" SET "name" = 'Threshold Cover Trim'
 WHERE "code" = 'AD55142'      AND "name" = 'Aluminium Frame Cap (Large)';

UPDATE "profile_part" SET "name" = 'Sliding Frame Cover'
 WHERE "code" = 'SPQ-GL-10253' AND "name" = 'Frame Slide Cap';

UPDATE "profile_part" SET "name" = 'U-PVC Interlock & Sash Cover'
 WHERE "code" = 'SPQ-GL-20253' AND "name" = 'Sash PVC Cap';

-- Beads: one shared code, so each keeps a distinguishing qualifier. Naming both
-- "Bead 28 mm" verbatim would make them indistinguishable in Admin > Catalog —
-- the bug already fixed once for frame-french vs frame-6ch.
UPDATE "profile_part" SET "name" = 'Bead 28mm'
 WHERE "partKey" = 'bead-28'    AND "name" = '28mm Bead';

UPDATE "profile_part" SET "name" = 'Bead 24mm Glazing'
 WHERE "partKey" = 'bead-sl-24' AND "name" = '24mm Glazing Bead';

UPDATE "profile_part" SET "name" = 'Reinforcement 44x12x44x12'
 WHERE "code" = 'AO44X12'      AND "name" = '44 x 12 Steel Reinforcement';

-- ---------------------------------------------------------------- hardware --
UPDATE "hardware" SET "name" = 'Patio Handle Set'
 WHERE "code" = 'GLIS-09' AND "name" = 'White Patio Handle';

-- Keeps "& Keep": the engine models this as ONE set that the price import sums
-- from catalog rows GLIS 10 (Patio door lock) + GLIS 11 (Patio door keep).
UPDATE "hardware" SET "name" = 'Patio Door Lock & Keep Set'
 WHERE "code" = 'GLIS-10' AND "name" = 'Patio Lock & Keep Set';

UPDATE "hardware" SET "name" = 'Sliding Rolls'
 WHERE "code" = 'GLIS-13' AND "name" = 'Ciilock Patio Roller';

UPDATE "hardware" SET "name" = 'Bump Stop'
 WHERE "code" = 'GLIS-04' AND "name" = 'Panel Stopper (Bump Stop)';

UPDATE "hardware" SET "name" = 'Fixed Panel Support Spacer'
 WHERE "code" = 'GLIS-03' AND "name" = 'Fixed Panel Support';

-- ------------------------------------------------- new part: AD55144 -------
-- "3 & 4 Panel adapter" — in the English catalog and in Doc D of the price list
-- (SPQ-AD55144, GBP 27.00 / 4.2 m), and printed by patio.pdf on every 3- and
-- 4-panel item ("Piesa inchidere 3/4 canaturi", position 2V, x1).
--
-- INERT: referenced by no cut rule, so it emits no cut row and no existing
-- quote changes. Its printed lengths fit NO rule across the four samples
-- (1875 on a 3000 mm item AND on a 3500 mm one, 1895 on a 4000 mm one), so a
-- length formula would be invented — Spec/questions.md Q27. cost/price stay 0
-- here; `npm run import:prices` fills them from Doc D.
INSERT INTO "profile_part"
  ("id", "systemId", "partKey", "kind", "code", "name",
   "faceWidth", "weldAllowanceMm", "cost", "price", "per", "weight", "financialCategory")
SELECT gen_random_uuid(), s."id", 'aux-3-4-panel-adapter', 'AUXILIARY', 'AD55144',
       '3 & 4 Panel Adapter', 0, 0, 0, 0, 'm', 0, 'Auxiliary Profiles'
  FROM "profile_system" s
 WHERE s."id" = 'sunnyplast-70'
ON CONFLICT ("systemId", "kind", "partKey") DO NOTHING;
