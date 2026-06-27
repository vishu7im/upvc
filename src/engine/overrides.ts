// =====================================================================
// engine/overrides.ts — Custom extraction mode.
//
// Default mode reads every bend/weld allowance straight from the catalog
// (the `ProfileSystem`). Custom mode lets a single quote tweak those
// per-profile values without touching the catalog: we deep-clone the
// system and merge the overrides in, then hand the *effective* system to
// the (unchanged, pure) engine stages.
//
// An empty / undefined overrides object reproduces Default mode exactly,
// so the calibrated validation jobs are unaffected.
// =====================================================================

import type { EngineOverrides, ProfileSystem } from "../types.ts";

/**
 * Return a new ProfileSystem with `overrides` applied. The original is never
 * mutated. Unknown profile keys are ignored (a quote can only override
 * profiles that exist in the system).
 */
export function applyOverrides(
  system: ProfileSystem,
  overrides?: EngineOverrides,
): ProfileSystem {
  if (!overrides) return system;

  // Deep clone so the cached catalog object is never mutated.
  const eff: ProfileSystem = structuredClone(system);

  if (overrides.sawKerfMm !== undefined) {
    eff.sawKerfMm = overrides.sawKerfMm;
  }

  mergeInto(eff.frames, overrides.frames);
  mergeInto(eff.sashes, overrides.sashes);
  mergeInto(eff.transoms, overrides.transoms);
  mergeInto(eff.beads, overrides.beads);
  mergeInto(eff.reinforcement, overrides.reinforcement);

  return eff;
}

/**
 * Merge a `Record<key, Partial<section>>` of overrides into the target
 * record of profile sections. Only existing keys/fields are touched.
 */
function mergeInto<T extends Record<string, any>>(
  target: Record<string, T>,
  patch?: Record<string, Partial<T>>,
): void {
  if (!patch) return;
  for (const [key, fields] of Object.entries(patch)) {
    const section = target[key];
    if (!section || !fields) continue;
    for (const [field, value] of Object.entries(fields)) {
      if (value !== undefined) {
        (section as Record<string, unknown>)[field] = value;
      }
    }
  }
}
