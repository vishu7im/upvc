// =====================================================================
// catalog/options/french.ts — the French-door option system.
//
// SEED SOURCE. Third family, same two rules as windows.ts / doors.ts:
//
// 1. ONE SOURCE OF TRUTH — every choice that mirrors a catalog entity is
//    GENERATED from the live `ProfileSystem`; label and partKey both come from
//    the catalog, never retyped.
// 2. GOLDEN RULE — an option whose fabrication effect is not calibrated ships
//    `pricingMode:"none"` + `engineEffect:{kind:"none"}` and says why.
//
// 3. SHARE, DON'T DUPLICATE — family-agnostic options are ADOPTED (their
//    `familyKeys` gain "french-door") rather than copied. The pool handed in
//    holds the windows AND doors seeds, because a French doorset legitimately
//    shares rows with both.
//
// WHAT IS DELIBERATELY *NOT* ADOPTED, and why. `OptionChoice` carries no
// `familyKeys` — `loader.ts#getOptionSystem` filters OPTIONS by family and then
// attaches ALL of their choices — so adopting a shared key hands this family
// every one of that key's choices. Four of them would mis-cut a French door:
//
//   • `profile.frame-chamber` — its choices are frame-5ch (64) and frame-6ch
//     (68), and it carries an `isDefault`, which the resolver's frame branch
//     applies even when unanswered. Every French design is calibrated on
//     `frame-french` (face 48, Job 00000264); adopting this key would silently
//     re-cut all 12 of them. French has no frame option: there is exactly one
//     calibrated French frame, so there is nothing to choose.
//   • `profile.divider` — choices are the casement sections
//     (transom-t-67/z-67, mullion-78/75) and the option is scoped by component
//     TYPE, so the French stulp (a mullion) would be replaceable by a welded
//     casement mullion. The stulp's square-cut `jointType:"S"` is the whole
//     calibration; a swap would print a horned bar of the wrong length.
//   • `profile.joint-method` — same scope, same reachable stulp.
//   • `structure.component-type` — `cellnode.ts#applyEdit` falls back to
//     `DEFAULT_SASH_KEY = "sash-t"` (casement, face 79, 2.5 mm weld) when the
//     target cell carries no `sashKey`, so converting a French sidelight to a
//     sash would build a CASEMENT leaf inside a French doorset. Recorded as an
//     owner question; until the adapter takes a family-supplied default sash,
//     this family exposes no conversion (`componentConversions: []`).
//
// Nor are the door hardware slots beyond the handle adopted: `hardware.ts`
// gives a French MASTER leaf exactly one substitution slot (`handle`) and adds
// the lock, cylinder and hinges UNSLOTTED — they are flagged approximate in the
// catalog because Job 00000264's cut tables do not itemise the operating gear.
// An option that writes a `hardwareOverrides` slot the engine does not read
// would look like a choice and do nothing.
// =====================================================================

import type {
  OptionChoice,
  OptionDef,
  OptionSystemSeed,
} from "../../designer/option-types.ts";
import type { ProfileSystem, SashKind } from "../../types.ts";
import { FRENCH_SASH_KINDS } from "../families/french-door.ts";

const FAMILY = "french-door";

/**
 * The option keys a French doorset shares verbatim.
 *
 * From the windows seed: the finishes, the ancillary profiles that are not
 * frame or divider, the glazing rows, the structural actions and the paperwork
 * fields. From the doors seed: the doorset rows that are equally true of a
 * pair — threshold, opening direction, decoration and gas fill — plus
 * `hardware.door-handle`, whose choices are the catalog's door handles and
 * whose slot the engine really does read on a French master leaf.
 *
 * `structure.add-midrail` is shared and CALIBRATED here: Job 00000264's
 * midrail leaf is the reference that put `CellSpec.midrails` in the engine.
 */
const SHARED_OPTION_KEYS = [
  // windows seed
  "profile.colour-outside",
  "profile.colour-inside",
  "profile.cill",
  "profile.bead",
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
  "structure.add-midrail",
  "structure.remove-divider",
  "general.drainage",
  "placement.location",
  // doors seed
  "hardware.door-handle",
  "hardware.threshold",
  "glazing.decoration",
  "glazing.gas-fill",
  "general.opening-direction",
] as const;

/** What each French cell content is called in the picker. */
const FRENCH_LEAF_LABELS: Record<string, string> = {
  fixed: "Fixed light (no leaf)",
  "french-door-master": "Master leaf (handle side)",
  "french-door-slave": "Slave leaf (shootbolt)",
};

function opt(def: Omit<OptionDef, "familyKeys">): OptionDef {
  return { ...def, familyKeys: [FAMILY] };
}

/**
 * Extend a shared option's `familyKeys` with this family, in place of a copy.
 * Returns the SAME option objects, so there is exactly one definition of each
 * shared option and one set of its choices.
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
    // option from the French configurator.
    throw new Error(
      `french-door adopts option(s) no seed defines: ${[...wanted].join(", ")}`,
    );
  }
  return adopted;
}

/**
 * Build the French option system. `shared` is the already-merged
 * family-agnostic pool (windows + doors) whose options this family joins.
 */
export function buildFrenchOptionSystem(
  sys: ProfileSystem,
  shared: OptionSystemSeed,
): OptionSystemSeed {
  const options: OptionDef[] = [...adoptShared(shared)];
  const choices: OptionChoice[] = [];

  // ---- profile-ancillary -------------------------------------------

  // Leaf role — the per-cell content, a topology edit exactly like the casement
  // sash-type and door leaf-type options, but over the French kinds.
  //
  // Scoped to `sash` ONLY (not `glass`, which the other two families include).
  // A French leaf carries its own `sashKey` (sash-door-t-fr / -z-fr), so
  // `set-sash-kind` keeps the French profile; a fixed sidelight carries none,
  // and the adapter's `DEFAULT_SASH_KEY` fallback would hand it the CASEMENT
  // sash. Restricting the reachable targets to cells that already have a French
  // sash is what makes this safe without an adapter change.
  //
  // Which leaf is master is a TOPOLOGY answer, not a separate option: the
  // engine reads the pair off the cell contents (`hardware.ts` fits the master
  // gear on `french-door-master`, the shootbolt on `french-door-slave`).
  options.push(
    opt({
      key: "profile.french-leaf",
      groupKey: "profile-ancillary",
      name: "Leaf role",
      order: 72,
      display: "segmented",
      required: false,
      scope: {
        level: "component",
        componentTypes: ["sash"],
        applyScopes: ["this"],
      },
      pricingMode: "catalog",
      presentation: {
        helpText:
          "Master is the handle side (left by convention) and slave takes the shootbolt; the " +
          "hinge side is positional — each leaf hinges on its outer jamb. The operating gear " +
          "itself is not itemised in Job 00000264's cut tables, so the master reuses the " +
          "single-door set and the slave the shootbolt (flagged approximate in the catalog).",
      },
    }),
  );
  for (const [i, kind] of FRENCH_SASH_KINDS.entries()) {
    choices.push({
      key: `french-leaf-${kind}`,
      optionKey: "profile.french-leaf",
      label: FRENCH_LEAF_LABELS[kind] ?? kind,
      order: (i + 1) * 10,
      isDefault: false, // unset ⇒ the design's own cell content (byte-identical)
      engineEffect: {
        kind: "topology-edit",
        params: { op: "set-sash-kind", sashKind: kind as SashKind },
      },
    });
  }

  // French sash profile — a REAL 1:1 substitution.
  //
  // Job 00000264 cuts BOTH French leaves identically: face 105, overlap 20,
  // glass rebate 15, 3 mm weld per end — `sash-door-t-fr` (SPQ-5-47252) and
  // `sash-door-z-fr` (SPQ-5-45252) differ only in the part and its price. That
  // is the same test the frame and bead slots pass, and the same evidence that
  // promoted the single-door `profile.door-sash-profile` from informational to
  // priced (Jobs 172/173).
  //
  // Choices are GENERATED from the catalog's French sashes, so a new French
  // leaf profile appears here by seeding a catalog part and nothing else.
  options.push(
    opt({
      key: "profile.french-sash-profile",
      groupKey: "profile-ancillary",
      name: "Leaf profile",
      order: 82,
      display: "select",
      required: false,
      scope: { level: "item" },
      pricingMode: "catalog",
      presentation: {
        helpText:
          "Unset ⇒ the leaf the chosen design was calibrated with. Both French leaves cut " +
          "identically (Job 00000264), so this swaps the profile and its price without moving " +
          "a single dimension. It is applied only to cells that already have a leaf.",
      },
    }),
  );
  {
    // The `-fr` suffix is what separates the Job 00000264 leaves (3 mm weld,
    // 20 mm overlap) from the single-door leaves (2.5 mm, 28 mm). Offering a
    // single-door sash here would change the cut, so it is filtered out.
    const frenchSashKeys = Object.keys(sys.sashes)
      .filter((k) => k.startsWith("sash-door-") && k.endsWith("-fr"))
      .sort();
    for (const [i, key] of frenchSashKeys.entries()) {
      choices.push({
        key: `french-sash-profile-${key}`,
        optionKey: "profile.french-sash-profile",
        label: sys.sashes[key].name,
        order: (i + 1) * 10,
        isDefault: false, // unset ⇒ the design's baked sash (byte-identical)
        partKey: key,
        engineEffect: { kind: "profile-substitution", params: { slot: "sash" } },
      });
    }
  }

  // The stulp (French mullion) is deliberately NOT a choice. `SPQ-1-46252` is
  // the only French mullion the catalog holds, it is the ONLY divider whose
  // square-cut `jointType:"S"` the engine emits, and its 2004 mm length on a
  // 2100 doorset is what Job 00000264 prints. There is nothing to select and no
  // second part to select it from — see the header for why the shared
  // `profile.divider` row is not adopted either.

  // Groups are shared verbatim — a third family reuses the same six.
  return { groups: [], options, choices };
}
