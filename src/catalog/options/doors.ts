// =====================================================================
// catalog/options/doors.ts — the entrance-door option system (phase 7).
//
// SEED SOURCE. This file is the second half of the extensibility proof: a whole
// new configurable product family, expressed as data.
//
// TWO RULES, THE SAME TWO AS windows.ts
//
// 1. ONE SOURCE OF TRUTH. Choices that mirror a catalog entity (colours, cills,
//    beads, glass, door hardware) are GENERATED from the live `ProfileSystem` —
//    label and partKey both come from the catalog, never retyped.
//
// 2. GOLDEN RULE. An option whose fabrication effect is not calibrated ships
//    `pricingMode:"none"` + `engineEffect:{kind:"none"}` + a helpText saying so.
//
// AND ONE MORE, SPECIFIC TO A SECOND FAMILY:
//
// 3. SHARE, DON'T DUPLICATE. Options that are family-agnostic (colour, cill,
//    bead, glass, glazing method, drainage, location, the structural actions)
//    are ADOPTED from the shared seed by adding "entrance-door" to their
//    `familyKeys` — see `adoptShared()`. Re-declaring them here would fork the
//    definition, and the two copies would drift. Only genuinely door-specific
//    options are defined below.
// =====================================================================

import type {
  OptionChoice,
  OptionDef,
  OptionSystemSeed,
} from "../../designer/option-types.ts";
import type { ProfileSystem, SashKind } from "../../types.ts";
import { DOOR_SASH_KINDS } from "../families/entrance-door.ts";
import {
  DOOR_STYLE_FILTERS,
  FINISH_FILTERS,
  filterKeysFor,
  usedFilters,
} from "./hardware-filters.ts";

const FAMILY = "entrance-door";

/**
 * The option keys an entrance door shares verbatim with a casement window.
 * Everything here is about the OPENING, the FINISH or the PAPERWORK — none of
 * it is specific to what opens.
 *
 * `profile.frame-chamber`, `profile.sash-type`, `hardware.handle`,
 * `hardware.locking` and `hardware.hinge` are deliberately NOT shared: their
 * choices are casement parts and casement sash kinds. Doors declare their own
 * below, against the door catalog.
 */
const SHARED_OPTION_KEYS = [
  "profile.colour-outside",
  "profile.colour-inside",
  "profile.cill",
  "profile.bead",
  "profile.addon",
  "glazing.glass-type",
  "glazing.method",
  "structure.add-transom",
  "structure.add-transom-at",
  "structure.add-mullion",
  "structure.add-mullion-at",
  "structure.remove-divider",
  "structure.component-type",
  "general.drainage",
  "placement.location",
] as const;

/** The door leaf kinds offered as a per-component choice. */
const DOOR_LEAF_LABELS: Record<string, string> = {
  fixed: "Fixed light (no leaf)",
  "door-left": "Door leaf — hinged left",
  "door-right": "Door leaf — hinged right",
};

function opt(def: Omit<OptionDef, "familyKeys">): OptionDef {
  return { ...def, familyKeys: [FAMILY] };
}

/**
 * Extend a shared option's `familyKeys` with this family, in place of a copy.
 * Returns the SAME option objects (mutated familyKeys), so there is exactly one
 * definition of each shared option and one set of its choices.
 */
export function adoptShared(shared: OptionSystemSeed): OptionDef[] {
  const wanted = new Set<string>(SHARED_OPTION_KEYS);
  const adopted: OptionDef[] = [];
  for (const o of shared.options) {
    if (!wanted.has(o.key)) continue;
    if (!o.familyKeys.includes(FAMILY)) o.familyKeys = [...o.familyKeys, FAMILY];
    adopted.push(o);
    wanted.delete(o.key);
  }
  if (wanted.size > 0) {
    // Fail loud: a shared key that no longer exists would silently drop a whole
    // option from the door configurator.
    throw new Error(
      `entrance-door adopts option(s) no seed defines: ${[...wanted].join(", ")}`,
    );
  }
  return adopted;
}

/**
 * Build the door option system. `shared` is the already-built family-agnostic
 * seed (today: the windows seed) whose options this family joins.
 */
export function buildDoorsOptionSystem(
  sys: ProfileSystem,
  shared: OptionSystemSeed,
): OptionSystemSeed {
  const options: OptionDef[] = [...adoptShared(shared)];
  const choices: OptionChoice[] = [];

  // ---- profile-ancillary -------------------------------------------

  // Door leaf type — the per-cell opening kind, a topology edit exactly like
  // the casement sash-type option, but over the DOOR sash kinds.
  options.push(
    opt({
      key: "profile.door-leaf",
      groupKey: "profile-ancillary",
      name: "Leaf type",
      order: 70,
      display: "segmented",
      required: false,
      scope: {
        level: "component",
        componentTypes: ["sash", "glass"],
        applyScopes: ["this", "all-of-type"],
      },
      pricingMode: "catalog",
      presentation: {
        helpText:
          "Which cell is the opening leaf. Sidelights and fanlights stay fixed; " +
          "the hinge side decides which keep set the engine fits.",
      },
    }),
  );
  for (const [i, kind] of DOOR_SASH_KINDS.entries()) {
    choices.push({
      key: `door-leaf-${kind}`,
      optionKey: "profile.door-leaf",
      label: DOOR_LEAF_LABELS[kind] ?? kind,
      order: (i + 1) * 10,
      isDefault: false, // unset ⇒ the design's own cell content (byte-identical)
      engineEffect: { kind: "topology-edit", params: { op: "set-sash-kind", sashKind: kind as SashKind } },
    });
  }

  // Door sash profile (T vs Z). The catalog HAS both (sash-door-t-fr /
  // sash-door-z, calibrated on Job 00000264 and the Quotila door jobs), but the
  // engine exposes profile substitution for the FRAME and the BEAD only — there
  // is no per-item door-sash slot, and inventing one would change a calibrated
  // cut without a reference job. So this records the intent and prints it.
  options.push(
    opt({
      key: "profile.door-sash-profile",
      groupKey: "profile-ancillary",
      name: "Door sash profile",
      order: 80,
      display: "select",
      required: false,
      scope: { level: "item" },
      pricingMode: "none",
      presentation: {
        helpText:
          "The design's calibrated door sash is used. Swapping the sash profile per order needs an " +
          "engine substitution slot (the engine has one for the frame and the bead only) plus a " +
          "reference job for the swapped cut — neither exists yet.",
      },
    }),
  );
  choices.push({
    key: "door-sash-profile-as-designed",
    optionKey: "profile.door-sash-profile",
    label: "As designed (calibrated)",
    order: 10,
    isDefault: true,
    engineEffect: { kind: "none" },
  });

  // ---- hardware -----------------------------------------------------

  // Every door-set item below is FIXED QUANTITY per leaf (1 handle, 1 lock,
  // 1 cylinder, 3 hinges), so each is a genuine 1:1 substitution slot: choosing
  // a different part swaps the part and changes no geometry. That is why these
  // price from the catalog while the casement locking/hinge options cannot —
  // those are SIZE-selected by the engine (questions.md Q19).
  const hardwareOptions: {
    key: string;
    name: string;
    order: number;
    slot: string;
    category: string;
    defaultPartKey: string;
    help: string;
  }[] = [
    {
      key: "hardware.door-handle",
      name: "Door handle",
      order: 10,
      slot: "handle",
      category: "Door Handle",
      defaultPartKey: "hw-door-handle",
      help: "One handle set per leaf.",
    },
    {
      key: "hardware.door-lock",
      name: "Lock",
      order: 20,
      slot: "lock",
      category: "Door Lock",
      defaultPartKey: "hw-door-lock",
      help: "One multipoint lock per leaf. The keep set follows the hinge side automatically.",
    },
    {
      key: "hardware.cylinder",
      name: "Cylinder",
      order: 30,
      slot: "cylinder",
      category: "Cylinders",
      defaultPartKey: "hw-cylinder-brass",
      help: "One cylinder per leaf.",
    },
    {
      key: "hardware.door-hinge",
      name: "Hinges",
      order: 40,
      slot: "hinge",
      category: "Door Hinge",
      defaultPartKey: "hw-flag-hinge-white",
      help: "Three hinges per leaf (calibrated on the Quotila single-door jobs).",
    },
  ];

  /**
   * Catalog rows that share a slot's financialCategory but must NOT be offered
   * as a choice for it:
   *   • keep sets — the engine picks R/H or L/H from the leaf's hinge side, so
   *     a free choice could fit the wrong-handed keep (the D7 rule);
   *   • the French-door accessories, which are "Door Lock" rows but are welded
   *     fittings, not a lock you select;
   *   • the sliding-patio cylinder, a different part at a different price
   *     (GLIS-12) that belongs to the sliding family, not a doorset.
   */
  const NOT_SELECTABLE = (key: string): boolean =>
    key.startsWith("hw-keep-") ||
    key.endsWith("-keep-set") ||
    key === "hw-inverter-cap" ||
    key === "hw-cavity-lock-block" ||
    key === "hw-shootbolt" ||
    key === "hw-patio-cylinder";

  for (const h of hardwareOptions) {
    const partKeys = Object.keys(sys.hardware)
      .filter((k) => sys.hardware[k].financialCategory === h.category && !NOT_SELECTABLE(k))
      // Supplier order in, alphabetical out: the stock list now supplies 50+
      // door handles, and a browsable picker beats the export's order.
      .sort((a, b) => sys.hardware[a].name.localeCompare(sys.hardware[b].name));
    if (partKeys.length === 0) continue; // nothing in the catalog ⇒ no option

    const families =
      h.slot === "handle" ? [FINISH_FILTERS, DOOR_STYLE_FILTERS] : [FINISH_FILTERS];
    const slotChoices: OptionChoice[] = partKeys.map((key, i) => ({
      key: `door-hw-${h.slot}-${key}`,
      optionKey: h.key,
      label: sys.hardware[key].name,
      order: (i + 1) * 10,
      isDefault: key === h.defaultPartKey, // the calibrated pick
      filterKeys: filterKeysFor(sys.hardware[key].name, families),
      partKey: key,
      engineEffect: { kind: "hardware-substitution", params: { slot: h.slot } },
    }));

    const slotFilters = usedFilters(slotChoices, families);
    options.push(
      opt({
        key: h.key,
        groupKey: "hardware",
        name: h.name,
        order: h.order,
        display: h.key === "hardware.door-handle" ? "select-image" : "select",
        required: false,
        scope: {
          level: "component",
          componentTypes: ["sash"],
          applyScopes: ["all-of-type", "this"],
        },
        // Omitted rather than [] when no chip applies (door locks are unfinished
        // hardware), so the picker renders no empty filter row.
        ...(slotFilters.length ? { filters: slotFilters } : {}),
        pricingMode: "catalog",
        presentation: { helpText: h.help },
      }),
    );
    choices.push(...slotChoices);
  }

  // Threshold. The manual draws door thresholds but the catalog holds no
  // threshold part and no cut rule cites one, so there is nothing to fabricate
  // or price — the choice is recorded on the paperwork only.
  options.push(
    opt({
      key: "hardware.threshold",
      groupKey: "hardware",
      name: "Threshold",
      order: 50,
      display: "select",
      required: false,
      scope: { level: "item" },
      pricingMode: "none",
      presentation: {
        helpText:
          "Recorded on the work order. No threshold part exists in the catalog and no cut rule " +
          "deducts for one — raised with the supplier (Spec/02-manual-migration/supplier-queries.md).",
      },
    }),
  );
  for (const [i, [k, label]] of (
    [
      ["standard", "Standard cill/threshold"],
      ["low", "Low threshold (level access)"],
    ] as const
  ).entries()) {
    choices.push({
      key: `threshold-${k}`,
      optionKey: "hardware.threshold",
      label,
      order: (i + 1) * 10,
      isDefault: k === "standard",
      engineEffect: { kind: "none" },
    });
  }

  // Groups are shared verbatim — a second family reuses the same six.
  return { groups: [], options, choices };
}
