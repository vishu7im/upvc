-- Global welding-shrinkage default on the single Setting row (mm per welded end).
-- Per-profile profile_part.weldAllowanceMm overrides it when > 0; 0 = inherit this.
ALTER TABLE "setting" ADD COLUMN "weldAllowanceMm" DECIMAL(10,4) NOT NULL DEFAULT 2.5;
