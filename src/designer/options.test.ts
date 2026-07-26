// =====================================================================
// designer/options.test.ts — seeded option-system integrity.
//
// DB-backed (runs after loadCatalog() inside `npm run validate`, like the
// extractor and supplier-price suites). It asserts the phase-1 acceptance
// criteria against the LIVE snapshot the API will serve:
//
//   • the casement-window family loads with its descriptor intact
//   • every option resolves to a group, every choice to an option
//   • catalog-derived choices correspond 1:1 to live catalog entries
//   • at most one default per option
//   • every fabrication constraint carries a source citation (golden rule)
//   • the served payload contains NO cost/price field (the public/admin split)
// =====================================================================

import { getFamily, getOptionSystem, getSystem, listFamilies } from "../catalog/index.ts";
import { buildWindowsOptionSystem } from "../catalog/options/windows.ts";
import { assertOptionSystemIntegrity } from "./option-integrity.ts";
import { assertValidRule } from "./rules.ts";
import type { OptionChoice, OptionDef, OptionSystemSeed } from "./option-types.ts";

type Expect = (label: string, actual: any, expected: any) => void;

const FAMILY = "casement-window";
const SYSTEM = "sunnyplast-70";

/** Recursively hunt for a money-ish key anywhere in the served payload. */
function findMoneyKey(value: unknown, path = "$"): string | undefined {
  if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) {
      const hit = findMoneyKey(v, `${path}[${i}]`);
      if (hit) return hit;
    }
    return undefined;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/^(cost|price)/i.test(k)) return `${path}.${k}`;
      const hit = findMoneyKey(v, `${path}.${k}`);
      if (hit) return hit;
    }
  }
  return undefined;
}

export function validateOptionSystem(expect: Expect): void {
  console.log("\n==================================================");
  console.log("Designer option system (windows phase 1)");
  console.log("==================================================");

  const family = getFamily(FAMILY);
  const system = getSystem(SYSTEM);

  if (!family || !system) {
    // A fresh DB that has not been re-seeded since phase 1 landed. SKIP rather
    // than fail, mirroring the gated supplier-price suite.
    console.log(`  (skipped — family "${FAMILY}" not seeded; run npm run db:seed)`);
    return;
  }

  // ---- 1. Family descriptor ----------------------------------------
  expect("family is listed as active", listFamilies().some((f) => f.familyKey === FAMILY && f.status === "active"), true);
  expect("family targets the sunnyplast system", family.systemIds.includes(SYSTEM), true);
  expect("family uses the cellnode adapter", family.engine.adapter, "cellnode");
  expect("family is quotable", family.engine.quotable, true);
  expect("family offers 3 split modes", family.splitModes.length, 3);
  expect("family offers the 4 view modes", family.viewModes.join(","), "external,internal,schematic,3d");
  expect("family declares 6 option groups", family.optionGroupKeys.length, 6);
  expect("width default comes from the design", family.dimensions[0].defaultFrom, "design");
  expect(
    "distance-from-floor is informational (no engine effect)",
    family.dimensions.find((d) => d.key === "distanceFromFloorMm")?.informational,
    true,
  );

  // ---- 2. Constraints are cited + well-formed -----------------------
  expect("family carries constraints", family.constraints.length > 0, true);
  let uncited = 0;
  let malformed = 0;
  for (const c of family.constraints) {
    if (!c.source || c.source.trim().length === 0) uncited++;
    try {
      assertValidRule(c.assert, c.id);
    } catch {
      malformed++;
    }
  }
  expect("every constraint cites a source", uncited, 0);
  expect("every constraint rule is well-formed", malformed, 0);
  // Two constraints sharing an id would produce indistinguishable issues — and
  // one printed size row covers several sash kinds, so this is easy to get wrong.
  expect(
    "constraint ids are unique",
    new Set(family.constraints.map((c) => c.id)).size,
    family.constraints.length,
  );
  // The p70 side-hung maximum is the constraint the plugin spec uses as its
  // worked example; it must be present and carry the page cite, not a bare 715.
  const sideHung = family.constraints.find((c) => c.id === "casement-side-left-max-width");
  expect("side-hung max-width constraint exists", sideHung !== undefined, true);
  expect("…asserts the printed 715 mm", JSON.stringify(sideHung?.assert), JSON.stringify({ lte: ["component.widthMm", 715] }));
  expect("…cites HAWDIO p70", /HAWDIO p70/.test(sideHung?.source ?? ""), true);

  // ---- 3. Option system structure -----------------------------------
  const optionSystem = getOptionSystem(FAMILY);
  expect("option system loads", optionSystem !== undefined, true);
  const groups = optionSystem?.groups ?? [];
  expect("at least 6 groups are served", groups.length >= 6, true);
  // Membership is the family's; ORDER is each group's own owner-owned `order`,
  // so an admin reordering the inspector actually reorders it.
  expect(
    "every served group is one the family declares",
    groups.every((g) => family.optionGroupKeys.includes(g.key)),
    true,
  );
  expect(
    "groups are served in ascending order",
    groups.every((g, i) => i === 0 || groups[i - 1].order <= g.order),
    true,
  );

  const options: OptionDef[] = groups.flatMap((g) => g.options);
  const choices: OptionChoice[] = groups.flatMap((g) => g.options.flatMap((o) => o.choices));
  expect("options are served", options.length > 0, true);
  expect("choices are served", choices.length > 0, true);

  const groupKeys = new Set(groups.map((g) => g.key));
  expect("every option resolves to a served group", options.every((o) => groupKeys.has(o.groupKey)), true);
  expect("every option is scoped to this family", options.every((o) => o.familyKeys.includes(FAMILY)), true);

  // At most one default per option.
  const defaults = new Map<string, number>();
  for (const g of groups) {
    for (const o of g.options) {
      defaults.set(o.key, o.choices.filter((c) => c.isDefault).length);
    }
  }
  expect("no option has more than one default", [...defaults.values()].every((n) => n <= 1), true);

  // display:"action" ⇒ a TopologyEdit template and no choices; everything else
  // that offers a list must actually offer one.
  const actions = options.filter((o) => o.display === "action");
  expect("action options exist (instant actions)", actions.length > 0, true);
  expect("every action option carries a template", actions.every((o) => o.action !== undefined), true);
  const listDisplays = ["select", "select-image", "segmented"];
  const emptyLists = groups
    .flatMap((g) => g.options)
    .filter((o) => listDisplays.includes(o.display) && o.choices.length === 0);
  expect("no list option is served empty", emptyLists.map((o) => o.key).join(",") || "(none)", "(none)");

  // ---- 4. Catalog-derived choices are 1:1 with the catalog ----------
  const catalogColours = Object.keys(system.colours ?? {});
  const catalogGlass = Object.keys(system.glass);
  const catalogCills = Object.keys(system.cills ?? {});

  const choicesOf = (optionKey: string) => choices.filter((c) => c.optionKey === optionKey);
  expect("external colour choices == catalog colours", choicesOf("profile.colour-outside").length, catalogColours.length);
  expect("internal colour choices == catalog colours", choicesOf("profile.colour-inside").length, catalogColours.length);
  expect("glass choices == catalog glass rows", choicesOf("glazing.glass-type").length, catalogGlass.length);
  expect("cill choices == catalog cills + 'No cill'", choicesOf("profile.cill").length, catalogCills.length + 1);

  // Labels must come FROM the catalog, not be retyped in the seed.
  const whiteChoice = choices.find((c) => c.key === "colour-out-white");
  expect("colour label matches the catalog", whiteChoice?.label, system.colours?.white?.name);
  expect("colour choice carries its swatch", whiteChoice?.swatchHex, system.colours?.white?.hex);
  expect("base colour is the default", whiteChoice?.isDefault, true);

  // Every partKey must resolve — a dangling one prices to 0 (data-model §5).
  const catalogKeys = new Set([
    ...Object.keys(system.frames),
    ...Object.keys(system.sashes),
    ...Object.keys(system.transoms),
    ...Object.keys(system.beads),
    ...Object.keys(system.reinforcement),
    ...Object.keys(system.auxiliaries ?? {}),
    ...Object.keys(system.glass),
    ...Object.keys(system.gaskets),
    ...Object.keys(system.hardware),
    ...catalogCills,
    ...catalogColours,
  ]);
  const dangling = choices.filter((c) => c.partKey && !catalogKeys.has(c.partKey));
  expect("no choice points at a missing catalog part", dangling.map((c) => c.partKey).join(",") || "(none)", "(none)");

  // ---- 5. Golden-rule bookkeeping -----------------------------------
  // Uncalibrated options must be honest: pricingMode "none" AND a helpText that
  // says why, so nothing silently pretends to fabricate.
  const uncalibrated = ["profile.addon", "hardware.locking", "hardware.hinge", "hardware.ventilator", "general.drainage", "glazing.method"];
  for (const key of uncalibrated) {
    const o = options.find((x) => x.key === key);
    expect(`${key} is priced "none"`, o?.pricingMode, "none");
    expect(`${key} explains itself`, (o?.presentation?.helpText ?? "").length > 0, true);
  }
  const noneEffects = choices.filter((c) => uncalibrated.includes(c.optionKey));
  expect(
    "uncalibrated choices declare no engine effect",
    noneEffects.every((c) => c.engineEffect?.kind === "none"),
    true,
  );

  // ---- 6. The public payload carries no supplier money --------------
  const moneyKey = findMoneyKey({ family, optionSystem });
  expect("served payload contains no cost/price field", moneyKey ?? "(none)", "(none)");

  // ---- 7. The seed's write-time gate actually fails loudly ----------
  // The acceptance criterion is that a BROKEN seed stops `npm run db:seed`, so
  // assert the gate on deliberately corrupted copies of the real seed — not
  // just that the good one passes.
  const catalogKeySet = new Set(catalogKeys);
  const good = buildWindowsOptionSystem(system);
  const clone = (): OptionSystemSeed => JSON.parse(JSON.stringify(good)) as OptionSystemSeed;
  const rejects = (label: string, mutate: (s: OptionSystemSeed) => void): boolean => {
    const s = clone();
    mutate(s);
    try {
      assertOptionSystemIntegrity(s, catalogKeySet);
      return false;
    } catch {
      return true;
    }
  };

  let goodPasses = true;
  try {
    assertOptionSystemIntegrity(good, catalogKeySet);
  } catch {
    goodPasses = false;
  }
  expect("the real seed passes its own integrity gate", goodPasses, true);
  expect(
    "a dangling partKey is rejected",
    rejects("dangling", (s) => {
      s.choices[0].partKey = "no-such-part";
    }),
    true,
  );
  expect(
    "a second default on one option is rejected",
    rejects("two defaults", (s) => {
      const key = s.choices.find((c) => c.isDefault)!.optionKey;
      for (const c of s.choices) if (c.optionKey === key) c.isDefault = true;
    }),
    true,
  );
  expect(
    "an option in a non-existent group is rejected",
    rejects("bad group", (s) => {
      s.options[0].groupKey = "no-such-group";
    }),
    true,
  );
  expect(
    "a choice on a non-existent option is rejected",
    rejects("orphan choice", (s) => {
      s.choices[0].optionKey = "no-such-option";
    }),
    true,
  );
  expect(
    "an action option with no template is rejected",
    rejects("action without template", (s) => {
      const a = s.options.find((o) => o.display === "action")!;
      delete a.action;
    }),
    true,
  );
  expect(
    "a duplicate choice key is rejected",
    rejects("duplicate key", (s) => {
      s.choices.push({ ...s.choices[0] });
    }),
    true,
  );
  expect(
    "a malformed visibility rule is rejected",
    rejects("bad rule", (s) => {
      s.options[0].visibility = { nope: [] } as never;
    }),
    true,
  );
}
