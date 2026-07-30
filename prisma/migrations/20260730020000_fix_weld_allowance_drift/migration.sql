-- Correct the weld-allowance drift recorded in memory/validate-weld-drift.md.
--
-- `weldAllowanceMm` is owner-editable, so the catalog seed deliberately never
-- overwrites it (see the M4 seed/pooler fix in CLAUDE.md). At some point these
-- rows drifted away from their calibrated source and stayed there, which is why
-- `npm run validate` has carried 3 failing weld assertions for months:
--
--   • `setting.weldAllowanceMm` = 0 where src/catalog/settings.ts says **2.5**,
--     so every profile that inherits the global got NO weld compensation at all
--     (a 78 mm divider printed its finished 1866 instead of the sawn 1871);
--   • frame-5ch / frame-6ch / sash-t / sash-door-z carry **3** where
--     src/catalog/system-sunnyplast.ts sets 0 = "inherit the global 2.5", so
--     they were cut 1 mm long per bar.
--
-- THREE production documents agree on 2.5 mm per welded end:
--   • Quotila Jobs 85/88/90 — the original calibration (frame printed 1205 for
--     a finished 1200, i.e. +5 total);
--   • Job 154 (collections/, 2026-07-27);
--   • Job 169 (collections/doors/, 2026-07-30) — every printed size on all five
--     pages is the finished size + 5 (frame 1005/2005, sash 925/1925, the
--     divider 871/846/1871).
--
-- Only the rows that CONTRADICT the catalog source are touched. The French and
-- sliding profiles genuinely carry 3 — their own calibration documents print
-- finished + 3/end (Job 00000264 for frame-french / sash-door-z-fr /
-- sash-door-t-fr / midrail-67, whose 67 mm bar prints 748 = 742 + 2x3; Jobs
-- 44/48 for frame-sliding / sash-sliding) — so they are left alone.
--
-- Plain SQL (not `migrate dev`) so it applies through a transaction-mode pooler
-- with `prisma migrate deploy`.

UPDATE "setting"
   SET "weldAllowanceMm" = 2.5
 WHERE "id" = 1
   AND "weldAllowanceMm" = 0;

UPDATE "profile_part"
   SET "weldAllowanceMm" = 0          -- 0 = inherit the global 2.5
 WHERE "partKey" IN ('frame-5ch', 'frame-6ch', 'sash-t', 'sash-door-z')
   AND "weldAllowanceMm" <> 0;
