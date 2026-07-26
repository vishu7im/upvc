// =====================================================================
// catalog/settings.ts — your default financial & display settings.
// Override per-quote via QuoteInput.settings.
// =====================================================================

import type { Settings } from "../types.ts";

export const DEFAULT_SETTINGS: Settings = {
  currency: "GBP",
  taxApply: true,
  taxPct: 20,
  markupPct: 75,
  wastagePct: 10,
  // Tune these to your shop's actual labour costs.
  labour: {
    perSash: 25,    // £ per opening sash
    perDoor: 60,    // £ per door panel
    base: 30,       // £ flat per order (setup, glazing, packaging)
  },
  // Global welding-shrinkage default (mm per welded end); per-profile overrides it when > 0.
  // PROVENANCE: calibrated from the Quotila reference jobs (85/88/90) — the
  // sliding/French families override to 3 per profile (Jobs 44/48, 00000264).
  // No edition of the fabrication manual states a weld allowance (verified
  // against HAWDIO 21-7-2026.pdf, 2026-07-25 — migration findings X6); the
  // calibrated jobs are the only source.
  weldAllowanceMm: 2.5,
};
