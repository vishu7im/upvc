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
};
