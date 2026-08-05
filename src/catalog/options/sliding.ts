// =====================================================================
// catalog/options/sliding.ts — the sliding-patio option system.
//
// SEED SOURCE. Fourth family, same rules as windows.ts / doors.ts / french.ts:
// choices are GENERATED from the live catalog, an uncalibrated effect ships
// `pricingMode:"none"`, and family-agnostic options are ADOPTED rather than
// copied.
//
// THIS IS THE SMALLEST OPTION SET OF THE FOUR, and every omission is a
// decision rather than an oversight:
//
//   • NO frame option — `frame-sliding` (SPQ-GL-10252, face 48) is the only
//     patio frame the catalog holds, and the shared `profile.frame-chamber`
//     row's choices are the casement 5ch/6ch pair WITH an `isDefault` the
//     resolver applies even when unanswered. Adopting it would re-cut every
//     patio quote to a casement frame.
//   • NO cill — a cill costs 30 mm of manufacturing HEIGHT (`solve.ts`), and
//     `panelExtH = frame.h − 86` reads that height directly, so fitting one
//     would move every panel, bead, steel and pane. No patio document we hold
//     carries a cill, so there is nothing to verify that against
//     (Spec/questions.md).
//   • NO add-ons — the per-edge frame extension is calibrated on Job 169, a
//     DOOR. Its inset would flow into `frame.w`, and therefore into the
//     calibrated panel-width formula, with no patio document to check.
//   • NO hardware slots — the patio set is computed per panel by the engine and
//     three of its rows are flagged approximate (the Andrei documents itemise
//     no hardware). A substitution slot over an uncalibrated tally prices a
//     guess.
//   • NO structural actions and NO component-scoped options — the studio is
//     scoped to sizes, panel widths and options (owner decision), and the row
//     carries ONE glass/bead specification for every panel, so a per-panel
//     answer is not expressible (see adapters/sliding.ts).
//
// Which is why the two catalog options below are declared HERE at item level
// rather than adopted: the shared `glazing.glass-type` and `profile.bead` rows
// are component-scoped and their choices are the casement/French parts.
// =====================================================================

import type {
  OptionChoice,
  OptionDef,
  OptionSystemSeed,
} from "../../designer/option-types.ts";
import type { ProfileSystem } from "../../types.ts";

const FAMILY = "sliding-patio";

/**
 * Family-agnostic options a patio row shares verbatim. All four are ITEM-level
 * and none of them touches the cut: two finishes (whose uplift the engine
 * already applies to the visible profile lines), the glazing-method record and
 * the drainage record, plus the location that prints on the work order.
 */
const SHARED_OPTION_KEYS = [
  "profile.colour-outside",
  "profile.colour-inside",
  "glazing.method",
  "general.drainage",
  "placement.location",
] as const;

function opt(def: Omit<OptionDef, "familyKeys">): OptionDef {
  return { ...def, familyKeys: [FAMILY] };
}

/**
 * Extend a shared option's `familyKeys` with this family, in place of a copy.
 * Returns the SAME option objects, so there is one definition and one set of
 * choices per shared option.
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
    // option from the patio configurator.
    throw new Error(
      `sliding-patio adopts option(s) no seed defines: ${[...wanted].join(", ")}`,
    );
  }
  return adopted;
}

/**
 * Build the sliding option system. `shared` is the already-merged
 * family-agnostic pool whose options this family joins.
 */
export function buildSlidingOptionSystem(
  sys: ProfileSystem,
  shared: OptionSystemSeed,
): OptionSystemSeed {
  const options: OptionDef[] = [...adoptShared(shared)];
  const choices: OptionChoice[] = [];

  // ---- glazing ------------------------------------------------------

  // Glass for the WHOLE row — an item-level twin of the shared
  // `glazing.glass-type`, which is component-scoped and therefore unanswerable
  // here (`buildSlidingPanels` glazes every panel from the node's single
  // `glassKey`). The `glass-key` effect at item level lands in
  // `QuoteInput.glassKey` → `solve.ts#fillDefaultGlass`, which fills exactly
  // that node slot. Choices are the catalog's glass rows, so a new unit or
  // panel appears here by seeding a catalog row and nothing else.
  options.push(
    opt({
      key: "glazing.sliding-glass",
      groupKey: "glazing",
      name: "Glass / panel",
      order: 10,
      display: "select",
      required: false,
      scope: { level: "item" },
      filters: [
        { key: "glazed-unit", label: "Glazed unit" },
        { key: "flat-panel", label: "Flat panel" },
      ],
      pricingMode: "catalog",
      presentation: {
        helpText:
          "One specification for every panel — a patio row carries a single glass key " +
          "(Jobs 44/48 print one glass size per panel width, all the same make-up). " +
          "Per-panel glazing needs a per-panel key in the engine (Spec/questions.md).",
      },
    }),
  );
  for (const [i, [key, g]] of Object.entries(sys.glass).entries()) {
    choices.push({
      key: `sliding-glass-${key}`,
      optionKey: "glazing.sliding-glass",
      label: g.name,
      order: (i + 1) * 10,
      isDefault: false, // unset ⇒ the design's own glazing (byte-identical)
      filterKeys: [g.financialCategory === "Panels" ? "flat-panel" : "glazed-unit"],
      partKey: key,
      engineEffect: { kind: "glass-key" },
    });
  }

  // ---- profile-ancillary --------------------------------------------

  // Bead for the whole row. Generated from the catalog's SLIDING beads only:
  // the 7 patio designs pin `bead-sl-24` (SPQ-1-51252, "Bagheta ptr.24mm",
  // Jobs 44/48) and the casement/French beads are cut for 28 mm and 32 mm
  // glazing, so offering them here would fit the wrong bead to a 24 mm unit.
  // Today that is a one-row list; it grows by seeding a catalog part.
  options.push(
    opt({
      key: "profile.sliding-bead",
      groupKey: "profile-ancillary",
      name: "Bead",
      order: 50,
      display: "select",
      required: false,
      scope: { level: "item" },
      pricingMode: "catalog",
      presentation: {
        helpText:
          "Unset ⇒ the bead the design was calibrated with (SPQ-1-51252). The bead length rule " +
          "is unchanged either way — Int = the panel's glazing opening, Ext = Int + 40.",
      },
    }),
  );
  {
    const slidingBeadKeys = Object.keys(sys.beads)
      .filter((k) => k.startsWith("bead-sl-"))
      .sort();
    for (const [i, key] of slidingBeadKeys.entries()) {
      choices.push({
        key: `sliding-bead-${key}`,
        optionKey: "profile.sliding-bead",
        label: sys.beads[key].name,
        order: (i + 1) * 10,
        isDefault: false, // unset ⇒ the design's pinned bead (byte-identical)
        partKey: key,
        engineEffect: { kind: "profile-substitution", params: { slot: "bead" } },
      });
    }
  }

  // Groups are shared verbatim — a fourth family reuses four of the same six.
  return { groups: [], options, choices };
}
