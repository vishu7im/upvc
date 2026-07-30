// =====================================================================
// catalog/options/hardware-filters.ts — filter chips for the hardware pickers.
//
// The handle list went from 1 catalog row to 36 when the owner's real stock
// list was imported (src/tools/extract-hardware.ts), and 36 unfiltered rows in
// a popover is not a picker. The option system already supports filter chips
// (`OptionDef.filters` + `OptionChoice.filterKeys`, as glazing.glass-type uses),
// so this is pure SEED DATA — no `web/` change, and no option key in the UI.
//
// The chips are derived by matching the SUPPLIER'S OWN naming: every casement
// handle in the stock list is "<finish> [<hand>] <style> Handle". A name that
// matches nothing simply gets no filter key — it stays visible under "All"
// rather than being filed under a guessed category. Nothing here affects
// fabrication, pricing or the BOM; it decides only which chips a list offers.
// =====================================================================

import type { OptionChoice, OptionFilter } from "../../designer/option-types.ts";

export interface HardwareFilterDef extends OptionFilter {
  /** Matched against the part name. */
  match: RegExp;
}

/**
 * Finishes, LONGEST-FIRST so "Antique Bronze" is not swallowed by "Bronze".
 * A part carries at most one finish chip (the first match wins).
 */
export const FINISH_FILTERS: HardwareFilterDef[] = [
  { key: "fin-antique-bronze", label: "Antique Bronze", match: /\bantique bronze\b/i },
  { key: "fin-antique-black", label: "Antique Black", match: /\bantique black\b/i },
  { key: "fin-stainless", label: "Stainless Steel", match: /\bstainless steel\b/i },
  { key: "fin-white", label: "White", match: /\bwhite\b/i },
  { key: "fin-black", label: "Black", match: /\bblack\b/i },
  { key: "fin-chrome", label: "Chrome", match: /\bchrome\b/i },
  { key: "fin-gold", label: "Gold", match: /\bgold\b/i },
  { key: "fin-silver", label: "Silver", match: /\bsilver\b/i },
  { key: "fin-bronze", label: "Bronze", match: /\bbronze\b/i },
  { key: "fin-graphite", label: "Graphite", match: /\bgraphite\b/i },
  { key: "fin-brown", label: "Brown", match: /\bbrown\b/i },
  { key: "fin-satin", label: "Satin", match: /\bsatin\b/i },
  { key: "fin-brass", label: "Brass", match: /\bbrass\b/i },
  { key: "fin-nickel", label: "Nickel", match: /\bnickel\b/i },
];

/** Casement handle shapes, as the stock list names them. */
export const CASEMENT_STYLE_FILTERS: HardwareFilterDef[] = [
  { key: "sty-inline", label: "Inline", match: /\binline\b/i },
  { key: "sty-cranked", label: "Cranked", match: /\bcranked\b/i },
  { key: "sty-monkeytail", label: "Monkeytail", match: /\bmonkeytail\b/i },
];

/** Door handle shapes. */
export const DOOR_STYLE_FILTERS: HardwareFilterDef[] = [
  { key: "sty-lever-lever", label: "Lever / Lever", match: /lever\/lever/i },
  { key: "sty-lever-pad", label: "Lever / Pad", match: /lever\/pad/i },
  { key: "sty-bar", label: "Bar handle", match: /\bbar handle\b/i },
  { key: "sty-panic", label: "Panic", match: /\bpanic\b/i },
];

/**
 * Door hinge shapes. The reference splits this axis into TWO dropdowns —
 * "Hinge (Door)" (Flag / High Security) and "Hinge Colour (Door)" (9 finishes)
 * — which our catalog cannot mirror honestly: both dropdowns would write the
 * SAME 1:1 substitution slot, so answering them separately would conflict.
 * One picker with a style chip AND a finish chip says exactly the same thing
 * about the same 17 catalog rows, and cannot contradict itself.
 */
export const DOOR_HINGE_STYLE_FILTERS: HardwareFilterDef[] = [
  { key: "sty-flag", label: "Flag", match: /\bflag\b/i },
  { key: "sty-high-security", label: "High Security", match: /\bhigh security\b/i },
];

/** Door lock types, as the stock list names them. */
export const DOOR_LOCK_STYLE_FILTERS: HardwareFilterDef[] = [
  { key: "lock-high-security", label: "High Security", match: /\bhigh security\b/i },
  { key: "lock-shootbolt", label: "Shootbolt", match: /\bshootbolt\b/i },
  { key: "lock-stable", label: "Stable door", match: /\bstable\b/i },
  { key: "lock-standard", label: "Standard", match: /\bstandard\b/i },
];

/** Cylinder variants. */
export const CYLINDER_STYLE_FILTERS: HardwareFilterDef[] = [
  { key: "cyl-thumbturn", label: "Thumbturn", match: /\bthumb ?turn\b/i },
  { key: "cyl-keyed-alike", label: "Keyed alike", match: /\bkeyed alike\b/i },
];

/**
 * Handedness. A cranked or monkeytail handle is HANDED, and fitting the wrong
 * hand to a side-hung sash is a real fabrication error — so the chip exists to
 * make the hand visible while choosing. (The resolver additionally warns when
 * the hand contradicts the sash's hinge side; it never auto-corrects.)
 */
export const HAND_FILTERS: HardwareFilterDef[] = [
  { key: "hand-lh", label: "Left hand", match: /\bL\/H\b/i },
  { key: "hand-rh", label: "Right hand", match: /\bR\/H\b/i },
];

/** Every chip a part name earns, at most one per family. */
export function filterKeysFor(name: string, families: HardwareFilterDef[][]): string[] {
  const out: string[] = [];
  for (const family of families) {
    const hit = family.find((f) => f.match.test(name));
    if (hit) out.push(hit.key);
  }
  return out;
}

/**
 * The chips to OFFER: only those at least one choice actually carries, so the
 * picker never shows a filter that empties the list.
 */
export function usedFilters(
  choices: Pick<OptionChoice, "filterKeys">[],
  families: HardwareFilterDef[][],
): OptionFilter[] {
  const used = new Set(choices.flatMap((c) => c.filterKeys ?? []));
  return families
    .flat()
    .filter((f) => used.has(f.key))
    .map(({ key, label }) => ({ key, label }));
}
