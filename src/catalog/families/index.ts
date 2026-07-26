// =====================================================================
// catalog/families/index.ts — the family REGISTRY.
//
// Phase 7 (extensibility proof) turned "the seed knows about casement windows"
// into "the seed knows about the registry": `prisma/seed.ts` imports FAMILIES
// and `buildOptionSystem()` from here and names no family at all. Registering
// a third family is therefore two seed files plus one line in each list below.
// =====================================================================

import type { ProductFamilyDescriptor } from "../../designer/option-types.ts";
import type { OptionSystemSeed } from "../../designer/option-types.ts";
import type { ProfileSystem } from "../../types.ts";
import { CASEMENT_WINDOW_FAMILY } from "./casement-window.ts";
import { ENTRANCE_DOOR_FAMILY } from "./entrance-door.ts";
import { buildWindowsOptionSystem } from "../options/windows.ts";
import { buildDoorsOptionSystem } from "../options/doors.ts";

/** Every family descriptor the seed applies. */
export const FAMILIES: ProductFamilyDescriptor[] = [
  CASEMENT_WINDOW_FAMILY,
  ENTRANCE_DOOR_FAMILY,
];

export { CASEMENT_WINDOW_FAMILY, ENTRANCE_DOOR_FAMILY };

/**
 * The whole option system, across every registered family.
 *
 * Shared options appear ONCE with a `familyKeys` list naming every family that
 * uses them (`doors.ts#adoptShared` extends the list rather than copying the
 * definition), which is what `option_def.key` being a primary key requires and
 * what stops two families' copies of "Cill" from drifting apart.
 */
export function buildOptionSystem(sys: ProfileSystem): OptionSystemSeed {
  const windows = buildWindowsOptionSystem(sys);
  const doors = buildDoorsOptionSystem(sys, windows);
  return mergeOptionSystems([windows, doors]);
}

/**
 * Merge per-family seeds into one. Options and choices are keyed globally, so a
 * duplicate key must be the SAME row: identical definitions are collapsed (with
 * their familyKeys unioned) and a genuine conflict throws rather than letting
 * one family's definition silently win.
 */
export function mergeOptionSystems(seeds: OptionSystemSeed[]): OptionSystemSeed {
  const groups = new Map<string, OptionSystemSeed["groups"][number]>();
  const options = new Map<string, OptionSystemSeed["options"][number]>();
  const choices = new Map<string, OptionSystemSeed["choices"][number]>();

  for (const seed of seeds) {
    for (const g of seed.groups) {
      const existing = groups.get(g.key);
      if (existing && JSON.stringify(existing) !== JSON.stringify(g)) {
        throw new Error(`Option group "${g.key}" is defined twice with different content`);
      }
      groups.set(g.key, g);
    }
    for (const o of seed.options) {
      const existing = options.get(o.key);
      if (existing) {
        if (existing !== o && !sameOption(existing, o)) {
          throw new Error(
            `Option "${o.key}" is defined twice with different content — share it via familyKeys instead of copying it`,
          );
        }
        // Union the family lists: the same option, offered to both families.
        const merged = new Set([...existing.familyKeys, ...o.familyKeys]);
        existing.familyKeys = [...merged];
        continue;
      }
      options.set(o.key, o);
    }
    for (const c of seed.choices) {
      const existing = choices.get(c.key);
      if (existing && JSON.stringify(existing) !== JSON.stringify(c)) {
        throw new Error(`Option choice "${c.key}" is defined twice with different content`);
      }
      choices.set(c.key, c);
    }
  }

  return {
    groups: [...groups.values()],
    options: [...options.values()],
    choices: [...choices.values()],
  };
}

/** Structural equality ignoring `familyKeys`, which is exactly what merges. */
function sameOption(
  a: OptionSystemSeed["options"][number],
  b: OptionSystemSeed["options"][number],
): boolean {
  const strip = (o: OptionSystemSeed["options"][number]) => {
    const { familyKeys: _ignored, ...rest } = o;
    return JSON.stringify(rest);
  };
  return strip(a) === strip(b);
}
