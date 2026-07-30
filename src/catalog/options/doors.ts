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
  ComponentType,
  OptionChoice,
  OptionDef,
  OptionSystemSeed,
} from "../../designer/option-types.ts";
import type { ProfileSystem, SashKind } from "../../types.ts";
import { DOOR_SASH_KINDS } from "../families/entrance-door.ts";
import {
  CYLINDER_STYLE_FILTERS,
  DOOR_HINGE_STYLE_FILTERS,
  DOOR_LOCK_STYLE_FILTERS,
  DOOR_STYLE_FILTERS,
  FINISH_FILTERS,
  filterKeysFor,
  usedFilters,
} from "./hardware-filters.ts";
import { hardwareImage } from "./windows.ts";

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
 *
 * The four per-EDGE frame rows, the divider profile and the joint method ARE
 * shared: a doorset's outer frame and its transom/mullion are the same parts a
 * window's are (Job 169 prints `SPQ-6-11252` on all four edges of a doorset and
 * `SPQ-5-30252` as its divider), and the choices are generated from the same
 * catalog list.
 */
const SHARED_OPTION_KEYS = [
  "profile.colour-outside",
  "profile.colour-inside",
  "profile.cill",
  "profile.bead",
  "profile.frame-top",
  "profile.frame-bottom",
  "profile.frame-left",
  "profile.frame-right",
  "profile.divider",
  "profile.joint-method",
  "profile.addon-top",
  "profile.addon-bottom",
  "profile.addon-left",
  "profile.addon-right",
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

    // Each slot gets the chips its own catalog rows can actually earn — the
    // style axis the reference splits into a second dropdown lives here as a
    // chip instead (see DOOR_HINGE_STYLE_FILTERS for why).
    const families =
      h.slot === "handle"
        ? [FINISH_FILTERS, DOOR_STYLE_FILTERS]
        : h.slot === "hinge"
          ? [FINISH_FILTERS, DOOR_HINGE_STYLE_FILTERS]
          : h.slot === "lock"
            ? [FINISH_FILTERS, DOOR_LOCK_STYLE_FILTERS]
            : h.slot === "cylinder"
              ? [FINISH_FILTERS, CYLINDER_STYLE_FILTERS]
              : [FINISH_FILTERS];
    const slotChoices: OptionChoice[] = partKeys.map((key, i) => ({
      key: `door-hw-${h.slot}-${key}`,
      optionKey: h.key,
      label: sys.hardware[key].name,
      order: (i + 1) * 10,
      isDefault: key === h.defaultPartKey, // the calibrated pick
      filterKeys: filterKeysFor(sys.hardware[key].name, families),
      // Every hardware picker shows what the part looks like — the owner's
      // report ("its show with ui what its look for example handels but in our
      // app its just text field"). See hardwareImage / src/catalog/glyphs.ts.
      image: hardwareImage(key),
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
        // Every hardware slot is now an image picker: each choice carries a
        // picture, so the grid is the honest presentation for all of them.
        display: "select-image",
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
      ["standard", "No Threshold"],
      ["low", "PRAG-S-70 Low Threshold"],
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

  // Threshold labels follow the reference's own wording (PRAG-S-70), so the
  // paperwork reads the same as the job sheets the shop already has.

  // ---- The reference's remaining rows -------------------------------
  //
  // Every one of these appears in the reference door product
  // (collections/doors/lineitems.json, 41 rows) and NONE of them has a catalog
  // part or a calibrated cut rule. They are recorded, printed, and honest about
  // fabricating nothing (questions.md Q7). Opening direction additionally feeds
  // presentation-only hinge visibility; it still changes no cut, BOM or price.
  const gated: {
    key: string;
    group: string;
    name: string;
    order: number;
    display: OptionDef["display"];
    level: "item" | "component";
    componentTypes?: ComponentType[];
    help: string;
    values: [string, string][];
    defaultKey?: string;
  }[] = [
    {
      key: "hardware.hinge-position",
      group: "hardware",
      name: "Hinge Position (Door)",
      order: 45,
      display: "segmented",
      level: "component",
      componentTypes: ["sash"],
      help:
        "Recorded on the work order. The engine fits the calibrated three hinges per leaf " +
        "(Job 90); no production document gives the spacing or the count for four or five, so " +
        "choosing one changes the paperwork, not the hardware tally.",
      values: [
        ["3", "3 Hinges"],
        ["4", "4 Hinges"],
        ["5", "5 Hinges"],
      ],
      defaultKey: "3",
    },
    {
      key: "hardware.restrictor",
      group: "hardware",
      name: "Restrictor (Door)",
      order: 46,
      display: "select",
      level: "component",
      componentTypes: ["sash"],
      help:
        "Recorded on the work order. The catalog holds no restrictor part, so there is nothing " +
        "to fit or price until one is added.",
      values: [
        ["none", "No Door Restrictor"],
        ["fitted", "Door Restrictor"],
      ],
      defaultKey: "none",
    },
    {
      key: "hardware.ventilator-frame",
      group: "hardware",
      name: "Ventilator (Frame)",
      order: 47,
      display: "select",
      level: "item",
      help:
        "Recorded on the work order. The manual's trickle-vent data is reference-only in " +
        "src/engine/limits.ts (TRICKLE_VENT has no consumer) and no vent part exists — " +
        "questions.md Q16.",
      values: [
        ["none", "No Ventilator"],
        ["2500", "2500EA Trickle Vent"],
        ["4000", "4000EA Trickle Vent"],
        ["5000", "5000EA Trickle Vent"],
      ],
      defaultKey: "none",
    },
    {
      key: "hardware.ventilator-sash",
      group: "hardware",
      name: "Ventilator (Sash)",
      order: 48,
      display: "select",
      level: "component",
      componentTypes: ["sash"],
      help:
        "Recorded on the work order. Same gate as the frame ventilator — no vent part exists " +
        "and no cut rule deducts for one (questions.md Q16).",
      values: [
        ["none", "No Ventilator"],
        ["2500", "2500EA Trickle Vent"],
        ["4000", "4000EA Trickle Vent"],
        ["5000", "5000EA Trickle Vent"],
      ],
      defaultKey: "none",
    },
    {
      key: "glazing.decoration",
      group: "glazing",
      name: "Glass Decoration",
      order: 40,
      display: "select",
      level: "component",
      componentTypes: ["glass", "sash"],
      help:
        "Recorded on the work order. Astragal, Georgian and leaded work all add bar or lead " +
        "to the pane; the catalog holds no such part and no document gives the layout, so " +
        "nothing is fabricated or priced.",
      values: [
        ["none", "No Decoration"],
        ["astragal", "Astragal"],
        ["georgian", "Georgian Bar"],
        ["leaded", "Leaded"],
      ],
      defaultKey: "none",
    },
    {
      key: "glazing.gas-fill",
      group: "glazing",
      name: "Glass Gas Fill",
      order: 50,
      display: "segmented",
      level: "item",
      help:
        "Recorded on the glass order. Our glass rows are priced per m² as a made-up unit; the " +
        "supplier lists no separate gas line, so the choice carries no price of its own.",
      values: [
        ["argon", "Argon"],
        ["air", "Air"],
      ],
      defaultKey: "argon",
    },
    {
      key: "general.opening-direction",
      group: "general",
      name: "Opening Direction",
      order: 20,
      display: "segmented",
      level: "item",
      help:
        "Recorded on the work order and the drawing. Every calibrated door job we hold opens " +
        "inward; an outward-opening doorset uses different weathering and no reference job " +
        "gives its deduction, so the cut is unchanged either way.",
      values: [
        ["in", "Open In"],
        ["out", "Open Out"],
      ],
      defaultKey: "in",
    },
  ];

  for (const g of gated) {
    options.push(
      opt({
        key: g.key,
        groupKey: g.group,
        name: g.name,
        order: g.order,
        display: g.display,
        required: false,
        scope:
          g.level === "item"
            ? { level: "item" }
            : {
                level: "component",
                componentTypes: g.componentTypes ?? ["sash"],
                applyScopes: ["all-of-type", "this"],
              },
        pricingMode: "none",
        presentation: { helpText: g.help },
      }),
    );
    for (const [i, [k, label]] of g.values.entries()) {
      choices.push({
        key: `${g.key.replace(/\./g, "-")}-${k}`,
        optionKey: g.key,
        label,
        order: (i + 1) * 10,
        isDefault: k === g.defaultKey,
        engineEffect:
          g.key === "general.opening-direction" && (k === "in" || k === "out")
            ? { kind: "preview", params: { doorOpeningDirection: k } }
            : { kind: "none" },
      });
    }
  }

  // Groups are shared verbatim — a second family reuses the same six.
  return { groups: [], options, choices };
}
