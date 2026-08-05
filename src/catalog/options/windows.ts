// =====================================================================
// catalog/options/windows.ts — the casement-window option system.
//
// SEED SOURCE (repo convention). prisma/seed.ts copies this into
// option_group / option_def / option_choice; the loader serves it back and
// `GET /api/families/:key` hands it to the designer, which renders it
// generically. Schema: Spec/00-architecture/option-schema.md §3–5, worked
// inventory §8.
//
// TWO RULES SHAPE EVERY CHOICE BELOW
//
// 1. ONE SOURCE OF TRUTH FOR CATALOG DATA. Choices that mirror a catalog entity
//    (colours, glass, cills, beads, frames, hardware) are GENERATED from the
//    live `ProfileSystem` — label and partKey both come from the catalog, never
//    retyped here. Add a colour to the catalog and it appears as a choice.
//
// 2. GOLDEN RULE. An option whose fabrication effect is NOT calibrated ships
//    with `pricingMode: "none"`, `engineEffect: {kind:"none"}` and a helpText
//    saying so (option-schema.md §8, questions.md Q7). It appears, persists and
//    prints on the work order — it simply does not fabricate or price until a
//    calibrated rule exists. Nothing here invents a deduction, a part code or a
//    price.
// =====================================================================

import type {
  OptionChoice,
  OptionDef,
  OptionGroup,
  OptionSystemSeed,
} from "../../designer/option-types.ts";
import type { ProfileSystem, SashKind } from "../../types.ts";
import {
  CASEMENT_STYLE_FILTERS,
  FINISH_FILTERS,
  HAND_FILTERS,
  filterKeysFor,
  usedFilters,
} from "./hardware-filters.ts";

const FAMILY = "casement-window";

// ---------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------

export const WINDOW_OPTION_GROUPS: OptionGroup[] = [
  {
    key: "profile-ancillary",
    name: "Profile & Ancillary",
    order: 10,
    icon: "profile",
    defaultCollapsed: false,
    scope: "mixed",
  },
  { key: "hardware", name: "Hardware", order: 20, icon: "handle", defaultCollapsed: true, scope: "component" },
  { key: "glazing", name: "Glazing", order: 30, icon: "glass", defaultCollapsed: true, scope: "mixed" },
  { key: "structure", name: "Structure", order: 40, icon: "structure", defaultCollapsed: true, scope: "component" },
  { key: "general", name: "General", order: 50, icon: "settings", defaultCollapsed: true, scope: "item" },
  { key: "placement", name: "Placement", order: 60, icon: "location", defaultCollapsed: true, scope: "item" },
];

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

/** Casement units never use the sliding or French-specific profiles. */
const CASEMENT_FRAME_KEYS = ["frame-5ch", "frame-6ch"] as const;
/** Owner decision 2026-08-04: the studio starts on 6 chamber for windows AND doors. */
const DEFAULT_FRAME_KEY = "frame-6ch";
const CASEMENT_BEAD_KEYS = ["bead-28", "bead-32"] as const;
/**
 * Divider sections a casement/door unit can use (not the French stulp) — the two
 * the owner stocks: 67 mm (SPQ-05-20252 "T" / SPQ-005-30252 "Z") and 78 mm
 * (SPQ-5-30252).
 *
 * `mullion-75` (SPQ-050-30252) is deliberately NOT offered. It exists in the
 * catalog as inert manual data only: the deduction pages cover SPQ-5-30252 /
 * SPQ-005-30252 alone, it carries no `reinforcementMap` entry and it is absent
 * from the M5.5 price lists (system-sunnyplast.ts:298-317). Offering it would
 * let the studio cut an uncalibrated bar and price it silently at £0 — the
 * golden rule forbids exactly that. Re-add it here the day a deduction source
 * or a priced supplier line arrives (questions.md Q33).
 */
const CASEMENT_DIVIDER_KEYS = ["transom-t-67", "transom-z-67", "mullion-78"] as const;

/** The divider a horizontal split gets when the picker is left alone. */
const DEFAULT_TRANSOM_KEY = "transom-t-67";
/** The divider a vertical split gets when the picker is left alone. */
const DEFAULT_MULLION_KEY = "mullion-78";
/** The bar a midrail gets when the picker is left alone (French-calibrated). */
const DEFAULT_MIDRAIL_KEY = "midrail-67";
/**
 * Sections a midrail can be cut from. Job 154 (705 × 705, 5 pages) prints the
 * `Ext = Int + 2 × face` midrail rule on the 67 mm SPQ-005-30252 (609) and on
 * the 78 mm SPQ-5-30252 (631), on both axes — so both are calibrated. This
 * mirrors `adapters/cellnode.ts`, which already defaults a vertical midrail to
 * the 78 and a horizontal one to the 67.
 */
const MIDRAIL_KEYS = ["midrail-67", "mullion-78"] as const;

/** The four frame edges an add-on (frame extension) can be fitted to (Job 169). */
const ADDON_SIDES = ["top", "bottom", "left", "right"] as const;

/** The sash kinds a casement cell can hold (Tilt&Turn is a separate family). */
const CASEMENT_SASH_KINDS: { kind: SashKind; label: string }[] = [
  { kind: "fixed", label: "Fixed (no sash)" },
  { kind: "casement-top", label: "Top hung" },
  { kind: "casement-side-left", label: "Side hung — left" },
  { kind: "casement-side-right", label: "Side hung — right" },
];

/**
 * UK location suggestions (questions.md Q3, recommendation (a)): a seeded
 * choice list, not a fabrication value. Free text is always allowed; the admin
 * option CRUD makes the list editable.
 */
const LOCATION_SUGGESTIONS = [
  "Kitchen", "Living Room", "Dining Room", "Hallway", "Landing", "Bathroom",
  "En-suite", "Cloakroom", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Utility",
  "Garage", "Conservatory", "Porch", "Loft",
];

/**
 * The picture a hardware choice shows. `catalog-asset` resolves through
 * `GET /api/catalog/assets/hardware/:partKey`, which serves an admin-uploaded
 * product photo when one exists and the deterministic glyph from
 * `src/catalog/glyphs.ts` otherwise — so every row has a picture immediately
 * and a real photo can replace any one of them with no reseed.
 */
export function hardwareImage(partKey: string): OptionChoice["image"] {
  return { kind: "catalog-asset", ref: `hardware/${partKey}` };
}

/** Only one choice per option may be the default (asserted by the seed). */
function opt(def: OptionDef): OptionDef {
  return { ...def, familyKeys: [FAMILY] };
}

// ---------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------

/**
 * Build the whole windows option system against a live catalog. Pure: it reads
 * the passed `ProfileSystem` and returns plain data — no I/O, no DB.
 */
export function buildWindowsOptionSystem(sys: ProfileSystem): OptionSystemSeed {
  const options: OptionDef[] = [];
  const choices: OptionChoice[] = [];

  const colourEntries = Object.values(sys.colours ?? {});

  // ---- profile-ancillary -------------------------------------------

  // Inside / outside colour. Both read the SAME catalog colour list; the
  // engine already accepts them separately (U7: colourKey + colourKeyOutside,
  // whose uplifts are summed into one synthesized ColourOption).
  for (const [suffix, side, name, order] of [
    ["out", "outside", "Colour — external", 10],
    ["in", "inside", "Colour — internal", 20],
  ] as const) {
    const optionKey = `profile.colour-${side}`;
    options.push(
      opt({
        key: optionKey,
        groupKey: "profile-ancillary",
        name,
        order,
        display: "select-image",
        required: false,
        scope: { level: "item" },
        filters: [
          { key: "white", label: "White" },
          { key: "standard-colour", label: "Standard Colour" },
        ],
        pricingMode: "catalog",
        presentation: {
          helpText:
            "Finish applied to the visible profile lines (frame/sash/transom/bead). " +
            "Reinforcement, glass, gaskets and hardware are never uplifted.",
        },
        familyKeys: [FAMILY],
      }),
    );
    for (const [i, c] of colourEntries.entries()) {
      choices.push({
        key: `colour-${suffix}-${c.key}`,
        optionKey,
        label: c.name, // from the catalog — never retyped
        order: (i + 1) * 10,
        isDefault: c.key === (sys.defaultColourKey ?? "white"),
        filterKeys: [c.isBase ? "white" : "standard-colour"],
        ...(c.hex ? { swatchHex: c.hex } : {}),
        partKey: c.key,
        engineEffect: { kind: "colour-key", params: { side } },
      });
    }
  }

  // Frame chamber — ONE answer for the WHOLE unit (the engine's `frameKey`).
  //
  // OWNER DECISION, 2026-08-04: a unit is fabricated from one chamber, never a
  // mix. Until then this seeded four additional `Frame (Standard) (Top|Bottom|
  // Left|Right)` rows mirroring the reference configurator's Job 169 layout,
  // which let a user build a doorset with a 5-chamber head and a 6-chamber sill.
  // Those four rows are GONE. The engine keeps its per-edge capability
  // (`Design.frameKeys` / `QuoteInput.frameKeys`, calibrated on Job 169 — see
  // Spec/03-doors-module/phase-2-per-edge-profiles.md); it simply has no UI
  // writer now. Do not re-add the per-edge rows without an owner decision.
  //
  // Shared with entrance-door (see options/doors.ts) so both studios show one
  // Frame row. NOT shared with any family calibrated on a different frame:
  // OptionChoice carries no familyKeys, so every family on this key sees every
  // choice, and CASEMENT_FRAME_KEYS is the 5ch/6ch pair only.
  options.push(
    opt({
      key: "profile.frame-chamber",
      groupKey: "profile-ancillary",
      name: "Frame chamber",
      order: 30,
      display: "select",
      required: false,
      scope: { level: "item" },
      pricingMode: "catalog",
      presentation: {
        helpText: "One chamber for the whole unit — head, sill and both jambs are cut from it.",
      },
      familyKeys: [FAMILY],
    }),
  );
  for (const [i, key] of CASEMENT_FRAME_KEYS.entries()) {
    const frame = sys.frames[key];
    if (!frame) continue;
    choices.push({
      key: `frame-chamber-${key}`,
      optionKey: "profile.frame-chamber",
      label: frame.name,
      order: (i + 1) * 10,
      // OWNER DECISION, 2026-08-04: 6 chamber is the studio default.
      //
      // This is NOT byte-identical for casement: the seeded casement designs
      // bake frame-5ch (face 64), so a defaults-only studio draft now resolves
      // frameKey = frame-6ch (face 68). That is deliberate — the studio must cut
      // what it shows. Entrance-door designs already bake frame-6ch, so doors
      // are unaffected. `/quote`, the gallery previews and every calibrated
      // validation job call solve() directly and are untouched.
      isDefault: key === DEFAULT_FRAME_KEY,
      partKey: key,
      engineEffect: { kind: "profile-substitution", params: { slot: "frame" } },
    });
  }

  // Divider profile — swap ONE transom/mullion's section (the reference's
  // per-divider `Transom` and `Mullion` rows). Component-scoped, because a unit
  // with a fanlight and a sidelight can legitimately use different sections.
  options.push(
    opt({
      key: "profile.divider",
      groupKey: "profile-ancillary",
      name: "Divider profile",
      order: 36,
      display: "select",
      required: false,
      scope: {
        level: "component",
        componentTypes: ["transom", "mullion"],
        applyScopes: ["this", "all-of-type"],
      },
      pricingMode: "catalog",
      presentation: {
        helpText: "Unset ⇒ the section the design was drawn with.",
      },
      familyKeys: [FAMILY],
    }),
  );
  for (const [i, key] of CASEMENT_DIVIDER_KEYS.entries()) {
    const t = sys.transoms[key];
    if (!t) continue;
    choices.push({
      key: `divider-${key}`,
      optionKey: "profile.divider",
      label: t.name,
      order: (i + 1) * 10,
      isDefault: false,
      partKey: key,
      engineEffect: { kind: "topology-edit", params: { op: "set-divider" } },
    });
  }

  // Joint method — the reference's `Joint (Structural T/Z)` row. Orthogonal to
  // the T/Z/S `jointType`, which the PROFILE carries.
  //
  // GOLDEN RULE: "Welded" is the calibrated cut on every reference job we hold
  // (horns, Ext = Int + 2 × face). "Mechanical" appears in NO production
  // document, so its deduction is unknown — the engine cuts it as welded and
  // the resolver raises a warning that the work order prints, rather than
  // inventing a length or hiding the option (questions.md Q22).
  options.push(
    opt({
      key: "profile.joint-method",
      groupKey: "profile-ancillary",
      name: "Joint (Structural T/Z)",
      order: 37,
      display: "segmented",
      required: false,
      scope: {
        level: "component",
        componentTypes: ["transom", "mullion"],
        applyScopes: ["this", "all-of-type"],
      },
      pricingMode: "none",
      presentation: {
        helpText:
          "Welded is the calibrated joint (horned bar, Ext = Int + 2 × face). Mechanical is " +
          "recorded and printed but has no calibrated deduction, so the bar is still cut as " +
          "welded and the work order says so (questions.md Q22).",
      },
      familyKeys: [FAMILY],
    }),
  );
  for (const [i, m] of ([
    ["welded", "Welded (Standard)"],
    ["mechanical", "Mechanical (Standard)"],
  ] as const).entries()) {
    choices.push({
      key: `joint-method-${m[0]}`,
      optionKey: "profile.joint-method",
      label: m[1],
      order: (i + 1) * 10,
      isDefault: false, // unset ⇒ welded ⇒ byte-identical
      engineEffect: { kind: "topology-edit", params: { op: "set-divider", jointMethod: m[0] } },
    });
  }

  // Cill. "No cill" is the default: selecting a cill costs 30 mm of
  // manufacturing height (engine, solve.ts), so it must be an explicit choice.
  options.push(
    opt({
      key: "profile.cill",
      groupKey: "profile-ancillary",
      name: "Cill",
      order: 40,
      display: "select",
      required: false,
      scope: { level: "item" },
      pricingMode: "catalog",
      presentation: {
        helpText: "Fitting a cill reduces the manufacturing height by 30 mm.",
      },
      familyKeys: [FAMILY],
    }),
  );
  choices.push({
    key: "cill-none",
    optionKey: "profile.cill",
    label: "No cill",
    order: 0,
    isDefault: true,
    engineEffect: { kind: "none" },
  });
  for (const [i, c] of Object.values(sys.cills ?? {}).entries()) {
    choices.push({
      key: `cill-${c.key}`,
      optionKey: "profile.cill",
      label: c.name,
      order: (i + 1) * 10,
      isDefault: false,
      partKey: c.key,
      engineEffect: { kind: "cill-key" },
    });
  }

  // Bead. bead-28 is the engine's default (first bead in the catalog Record);
  // making it the default choice keeps a default quote byte-identical.
  options.push(
    opt({
      key: "profile.bead",
      groupKey: "profile-ancillary",
      name: "Bead",
      order: 50,
      display: "select",
      required: false,
      scope: { level: "item" },
      pricingMode: "catalog",
      familyKeys: [FAMILY],
    }),
  );
  for (const [i, key] of CASEMENT_BEAD_KEYS.entries()) {
    const bead = sys.beads[key];
    if (!bead) continue;
    choices.push({
      key: `bead-choice-${key}`,
      optionKey: "profile.bead",
      label: bead.name,
      order: (i + 1) * 10,
      isDefault: key === "bead-28",
      partKey: key,
      engineEffect: { kind: "profile-substitution", params: { slot: "bead" } },
    });
  }

  // Add-on profiles (frame extenders), one per frame edge — the same four rows
  // the reference shows for windows AND doors.
  //
  // CALIBRATED by Job 169 (collections/doors/, 5 pages, 1000×2000, a 25 mm
  // SPQ-2-75252 on each edge in turn): fitting one pushes the frame in by
  // exactly the profile's face on the perpendicular axis, leaving the unit size
  // unchanged. That resolves questions.md Q6.
  //
  // The choices are GENERATED from the live catalog, like every other profile
  // option: any auxiliary carrying a `faceWidthMm` is fittable, and one that
  // does not (the sliding cut items, the coupling and bay/bow parts) cannot be
  // offered — there is no rule for how far it insets the frame.
  //
  // pricingMode "none": the reference Cutting List itemises NO row for the
  // add-on profile itself, so we emit none either and it cannot be priced per
  // metre. Its own bar length is unevidenced (questions.md Q21).
  const addonParts = Object.entries(sys.auxiliaries ?? {})
    .filter(([, a]) => a.faceWidthMm !== undefined)
    .sort(([, a], [, b]) => a.name.localeCompare(b.name));

  for (const [i, side] of ADDON_SIDES.entries()) {
    const optionKey = `profile.addon-${side}`;
    options.push(
      opt({
        key: optionKey,
        groupKey: "profile-ancillary",
        name: `Add-on (${side[0].toUpperCase()}${side.slice(1)})`,
        order: 60 + i,
        display: "select",
        required: false,
        scope: { level: "item" },
        pricingMode: "none",
        presentation: {
          helpText:
            `A frame extension fitted to the ${side} edge. The unit size is unchanged; the ` +
            `frame is built ${side === "top" || side === "bottom" ? "shorter" : "narrower"} by ` +
            "the add-on's face, and daylight, sash, bead, glass and steel all follow (Job 169). " +
            "The profile itself is not cut-listed — the reference document itemises no row for " +
            "it and its own bar length is unevidenced (questions.md Q21).",
        },
        familyKeys: [FAMILY],
      }),
    );
    choices.push({
      key: `addon-${side}-none`,
      optionKey,
      label: "No Add-on",
      order: 0,
      isDefault: true,
      engineEffect: { kind: "none" },
    });
    for (const [j, [partKey, aux]] of addonParts.entries()) {
      choices.push({
        key: `addon-${side}-${partKey}`,
        optionKey,
        label: `${aux.code} ${aux.faceWidthMm}mm`,
        order: (j + 1) * 10,
        isDefault: false,
        partKey,
        engineEffect: { kind: "addon", params: { side } },
      });
    }
  }

  // Sash type — the per-cell opening kind (a topology edit, not a part swap).
  options.push(
    opt({
      key: "profile.sash-type",
      groupKey: "profile-ancillary",
      name: "Sash type",
      order: 70,
      display: "segmented",
      required: false,
      scope: { level: "component", componentTypes: ["sash", "glass"], applyScopes: ["this", "all-of-type"] },
      pricingMode: "catalog",
      familyKeys: [FAMILY],
    }),
  );
  for (const [i, s] of CASEMENT_SASH_KINDS.entries()) {
    choices.push({
      key: `sash-type-${s.kind}`,
      optionKey: "profile.sash-type",
      label: s.label,
      order: (i + 1) * 10,
      isDefault: false, // unset ⇒ the design's own cell content
      engineEffect: { kind: "topology-edit", params: { op: "set-sash-kind", sashKind: s.kind } },
    });
  }

  // ---- hardware -----------------------------------------------------

  // Handle: a genuine 1:1 substitution slot — the engine adds exactly one
  // handle per opening sash, so swapping the key changes nothing geometric.
  // Choices are the catalog's casement handles (today: one).
  const casementHandleKeys = Object.keys(sys.hardware)
    .filter(
      (k) => sys.hardware[k].financialCategory === "Casement Handles" && k.startsWith("hw-handle-"),
    )
    // The stock list arrives in supplier order; sort by NAME so the picker is
    // browsable and the seeded `order` is stable across regenerations.
    .sort((a, b) => sys.hardware[a].name.localeCompare(sys.hardware[b].name));

  const handleFamilies = [FINISH_FILTERS, CASEMENT_STYLE_FILTERS, HAND_FILTERS];
  const handleChoices: OptionChoice[] = casementHandleKeys.map((key, i) => ({
    key: `handle-${key}`,
    optionKey: "hardware.handle",
    label: sys.hardware[key].name,
    order: (i + 1) * 10,
    isDefault: key === "hw-handle-inline", // the calibrated pick (Jobs 85/88/90)
    filterKeys: filterKeysFor(sys.hardware[key].name, handleFamilies),
    // The picker shows what the part looks like. `catalog-asset` resolves
    // through GET /api/catalog/assets/hardware/:partKey, which serves an
    // admin-uploaded photo when one exists and a generated glyph otherwise
    // (src/catalog/glyphs.ts) — so every row has a picture from day one.
    image: hardwareImage(key),
    partKey: key,
    engineEffect: { kind: "hardware-substitution", params: { slot: "handle" } },
  }));

  options.push(
    opt({
      key: "hardware.handle",
      groupKey: "hardware",
      name: "Handle",
      order: 10,
      display: "select-image",
      required: false,
      scope: { level: "component", componentTypes: ["sash"], applyScopes: ["all-of-type", "this"] },
      // Chips derived from the supplier's own naming — the catalog carries 35+
      // casement handles, which is not a list you scroll.
      filters: usedFilters(handleChoices, handleFamilies),
      pricingMode: "catalog",
      presentation: {
        helpText:
          "One handle per opening sash. Cranked and monkeytail handles are HANDED — pick the hand " +
          "that matches the sash's hinge side (the studio warns if they disagree).",
      },
      familyKeys: [FAMILY],
    }),
  );
  choices.push(...handleChoices);

  // Locking + hinge are SIZE-SELECTED by the engine (espagnolette from the sash
  // span, friction stay from the perpendicular span — calibrated on Jobs
  // 85/88/90, src/engine/hardware.ts). Offering the individual espag/stay parts
  // as free choices would let a quote specify a 600 mm espag on a 1000 mm sash,
  // i.e. break a calibrated rule from the UI. So each ships as a single
  // informational choice until a calibrated SELECTION rule (not just a part
  // list) exists.
  for (const [key, name, order, what] of [
    ["hardware.locking", "Locking", 20, "espagnolette"],
    ["hardware.hinge", "Hinge", 30, "friction stay"],
  ] as const) {
    options.push(
      opt({
        key,
        groupKey: "hardware",
        name,
        order,
        display: "select",
        required: false,
        scope: { level: "component", componentTypes: ["sash"], applyScopes: ["all-of-type", "this"] },
        pricingMode: "none",
        presentation: {
          helpText: `The ${what} length is selected by the engine from the sash size (calibrated, Jobs 85/88/90). Alternatives need a calibrated selection rule, not just a part.`,
        },
        familyKeys: [FAMILY],
      }),
    );
    choices.push({
      key: `${key.split(".")[1]}-standard`,
      optionKey: key,
      label: `Standard — sized from the sash`,
      order: 10,
      isDefault: true,
      engineEffect: { kind: "none" },
    });
  }

  // Ventilator: the manual gives trickle-vent ROUTING positions (p68, captured
  // as TRICKLE_VENT in limits.ts) but prints no vent part code, and the catalog
  // holds no vent item. Nothing to fit ⇒ "None" only.
  options.push(
    opt({
      key: "hardware.ventilator",
      groupKey: "hardware",
      name: "Ventilator",
      order: 40,
      display: "select",
      required: false,
      scope: { level: "component", componentTypes: ["frame-edge", "sash"], applyScopes: ["this", "all-of-type"] },
      pricingMode: "none",
      presentation: {
        helpText:
          "No trickle-vent part exists in the catalog (the manual prints routing positions, p68, but no code). " +
          "Raised with the supplier — see Spec/02-manual-migration/supplier-queries.md.",
      },
      familyKeys: [FAMILY],
    }),
  );
  choices.push({
    key: "ventilator-none",
    optionKey: "hardware.ventilator",
    label: "None",
    order: 0,
    isDefault: true,
    engineEffect: { kind: "none" },
  });

  // ---- glazing ------------------------------------------------------

  options.push(
    opt({
      key: "glazing.glass-type",
      groupKey: "glazing",
      name: "Glass / panel",
      order: 10,
      display: "select",
      required: false,
      scope: { level: "component", componentTypes: ["glass", "panel"], applyScopes: ["all-of-type", "this"] },
      filters: [
        { key: "glazed-unit", label: "Glazed unit" },
        { key: "flat-panel", label: "Flat panel" },
      ],
      pricingMode: "catalog",
      presentation: {
        helpText:
          "Flat panels are catalog glass rows priced per m² (questions.md Q5) — converting glass to a " +
          "panel is a glass-row swap; the bead and gasket rules are unchanged.",
      },
      familyKeys: [FAMILY],
    }),
  );
  for (const [i, [key, g]] of Object.entries(sys.glass).entries()) {
    choices.push({
      key: `glass-${key}`,
      optionKey: "glazing.glass-type",
      label: g.name,
      order: (i + 1) * 10,
      isDefault: false, // unset ⇒ the design's own glassKey (byte-identical)
      filterKeys: [g.financialCategory === "Panels" ? "flat-panel" : "glazed-unit"],
      partKey: key,
      engineEffect: { kind: "glass-key" },
    });
  }

  options.push(
    opt({
      key: "glazing.method",
      groupKey: "glazing",
      name: "Glazing method",
      order: 20,
      display: "segmented",
      required: false,
      scope: { level: "item" },
      pricingMode: "none",
      presentation: {
        helpText:
          "Recorded on the work order. Dropping the glass lines from an unglazed unit's BOM is a " +
          "resolver capability (phase 2) — until then an unglazed unit still prices its glass.",
      },
      familyKeys: [FAMILY],
    }),
  );
  for (const [i, [k, label]] of ([["glazed", "Glazed"], ["unglazed", "Unglazed (frame only)"]] as const).entries()) {
    choices.push({
      key: `glazing-method-${k}`,
      optionKey: "glazing.method",
      label,
      order: (i + 1) * 10,
      isDefault: k === "glazed",
      engineEffect: { kind: "none" },
    });
  }

  // ---- structure (instant actions) ----------------------------------

  // Where the bar lands depends on what you clicked (adapters/cellnode.ts):
  // inside an opening sash it welds in as a MIDRAIL and the opener survives
  // (Job 154); on a fixed pane it divides the FRAME and both new areas stay
  // fixed. The helpText says so rather than the UI, which knows no option keys.
  const SPLIT_HELP =
    "Inside an opening sash this welds a midrail into the sash — the opener, its handle and its " +
    "gear stay exactly as they are. On a fixed pane it adds a bar to the frame and both new areas " +
    "start as fixed glass; click one to make it an opener.";

  options.push(
    opt({
      key: "structure.add-transom",
      groupKey: "structure",
      name: "Add transom",
      order: 10,
      display: "action",
      required: false,
      scope: { level: "component", componentTypes: ["glass", "panel", "sash"] },
      pricingMode: "catalog",
      presentation: { helpText: `${SPLIT_HELP} The new transom lands at the middle of the area.` },
      action: { op: "split", axis: "horizontal", position: "equal" },
      familyKeys: [FAMILY],
    }),
    opt({
      key: "structure.add-transom-at",
      groupKey: "structure",
      name: "Add transom at a drop",
      order: 15,
      display: "action",
      required: false,
      scope: { level: "component", componentTypes: ["glass", "panel", "sash"] },
      pricingMode: "catalog",
      presentation: {
        helpText: `${SPLIT_HELP} Enter the drop — the distance from the head of the frame down to the transom centreline.`,
      },
      action: { op: "split", axis: "horizontal", position: "at-ratio" },
      familyKeys: [FAMILY],
    }),
    opt({
      key: "structure.add-mullion",
      groupKey: "structure",
      name: "Add mullion",
      order: 20,
      display: "action",
      required: false,
      scope: { level: "component", componentTypes: ["glass", "panel", "sash"] },
      pricingMode: "catalog",
      presentation: { helpText: `${SPLIT_HELP} The new mullion lands at the middle of the area.` },
      action: { op: "split", axis: "vertical", position: "equal" },
      familyKeys: [FAMILY],
    }),
    opt({
      key: "structure.add-mullion-at",
      groupKey: "structure",
      name: "Add mullion at a position",
      order: 25,
      display: "action",
      required: false,
      scope: { level: "component", componentTypes: ["glass", "panel", "sash"] },
      pricingMode: "catalog",
      presentation: {
        helpText: `${SPLIT_HELP} Enter the distance from the left jamb to the mullion centreline.`,
      },
      action: { op: "split", axis: "vertical", position: "at-ratio" },
      familyKeys: [FAMILY],
    }),
    opt({
      key: "structure.add-midrail",
      groupKey: "structure",
      name: "Add midrail",
      order: 30,
      display: "action",
      required: false,
      scope: { level: "component", componentTypes: ["sash"] },
      pricingMode: "catalog",
      presentation: {
        helpText: "A midrail is welded INSIDE the sash ring, splitting the glazing (engine: CellSpec.midrails).",
      },
      action: { op: "add-midrail", position: "equal" },
      familyKeys: [FAMILY],
    }),
    opt({
      key: "structure.remove-divider",
      groupKey: "structure",
      name: "Remove divider",
      order: 40,
      display: "action",
      required: false,
      scope: { level: "component", componentTypes: ["transom", "mullion"] },
      pricingMode: "catalog",
      action: { op: "remove-divider" },
      familyKeys: [FAMILY],
    }),
  );

  // Which SECTION the new bar is cut from, chosen at insert time.
  //
  // Owner report 2026-08-05: "we have two types of transom in warehouse … so
  // when we add a transom we have also option to select the transom". Until now
  // every inserted bar took the adapter's hardcoded default and had to be
  // changed afterwards through `profile.divider`.
  //
  // These are CHOICES ON AN ACTION option — the one place the option system lets
  // a choice qualify an edit rather than answer a question. The choice's own
  // `partKey` is folded into the edit's `dividerKey` (split) / `transomKey`
  // (midrail), both of which `TopologyEdit` has always declared and
  // `adapters/cellnode.ts` has always honoured. The `isDefault` below MATCHES the
  // adapter's fallback exactly, so an untouched picker reproduces the previous
  // cut list byte for byte.
  const DIVIDER_ACTIONS: { optionKey: string; keys: readonly string[]; def: string }[] = [
    { optionKey: "structure.add-transom", keys: CASEMENT_DIVIDER_KEYS, def: DEFAULT_TRANSOM_KEY },
    { optionKey: "structure.add-transom-at", keys: CASEMENT_DIVIDER_KEYS, def: DEFAULT_TRANSOM_KEY },
    { optionKey: "structure.add-mullion", keys: CASEMENT_DIVIDER_KEYS, def: DEFAULT_MULLION_KEY },
    { optionKey: "structure.add-mullion-at", keys: CASEMENT_DIVIDER_KEYS, def: DEFAULT_MULLION_KEY },
    // A midrail is cut Ext = Int + 2 × face; Job 154 prints that on BOTH the
    // 67 mm bar (609) and the 78 mm one (631), so both are calibrated here.
    { optionKey: "structure.add-midrail", keys: MIDRAIL_KEYS, def: DEFAULT_MIDRAIL_KEY },
  ];
  for (const { optionKey, keys, def } of DIVIDER_ACTIONS) {
    for (const [i, key] of keys.entries()) {
      const t = sys.transoms[key];
      if (!t) continue;
      choices.push({
        key: `${optionKey}-${key}`,
        optionKey,
        label: t.name,
        order: (i + 1) * 10,
        isDefault: key === def,
        partKey: key,
        // The op comes from the option's own `action` template; the choice only
        // says WHICH SECTION, so it carries no op of its own.
        engineEffect: { kind: "none" },
      });
    }
  }

  // Component type switcher (reference UI: Glass / Sash / Flat panel). The legal
  // conversions come from the family descriptor's componentConversions.
  options.push(
    opt({
      key: "structure.component-type",
      groupKey: "structure",
      name: "Component type",
      order: 50,
      display: "segmented",
      required: false,
      scope: { level: "component", componentTypes: ["glass", "sash", "panel"] },
      pricingMode: "catalog",
      familyKeys: [FAMILY],
    }),
  );
  for (const [i, [to, label]] of ([["glass", "Glass"], ["sash", "Sash"], ["panel", "Flat panel"]] as const).entries()) {
    choices.push({
      key: `component-type-${to}`,
      optionKey: "structure.component-type",
      label,
      order: (i + 1) * 10,
      isDefault: false, // unset ⇒ whatever the design already has
      engineEffect: { kind: "topology-edit", params: { op: "convert-component", to } },
    });
  }

  // ---- general ------------------------------------------------------

  options.push(
    opt({
      key: "general.drainage",
      groupKey: "general",
      name: "Drainage",
      order: 10,
      display: "segmented",
      required: false,
      scope: { level: "item" },
      pricingMode: "none",
      presentation: {
        helpText:
          "Recorded on the work order. The manual gives drainage/pressure slot dimensions (30×4, p55–61) " +
          "but no machining positions per design, so the engine does not model drainage (questions.md Q7).",
      },
      familyKeys: [FAMILY],
    }),
  );
  for (const [i, [k, label]] of (
    [["concealed", "Concealed"], ["face", "Face drained"], ["none", "None"]] as const
  ).entries()) {
    choices.push({
      key: `drainage-${k}`,
      optionKey: "general.drainage",
      label,
      order: (i + 1) * 10,
      isDefault: k === "concealed",
      engineEffect: { kind: "none" },
    });
  }

  // ---- placement ----------------------------------------------------

  options.push(
    opt({
      key: "placement.location",
      groupKey: "placement",
      name: "Location",
      order: 10,
      display: "text",
      required: false,
      scope: { level: "item" },
      validation: { maxLength: 50 },
      pricingMode: "none",
      presentation: {
        helpText: "Where the unit is fitted. Printed on the work order so the fitter can match units to openings.",
        suggestions: LOCATION_SUGGESTIONS,
      },
      familyKeys: [FAMILY],
    }),
  );

  return { groups: WINDOW_OPTION_GROUPS, options, choices };
}
