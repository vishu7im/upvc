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

  // display:"action" ⇒ a TopologyEdit template; its choices (if any) qualify the
  // edit with a catalog section. Everything else that offers a list must
  // actually offer one.
  // The SERVED options (each with its choices attached) — `options` above is
  // narrowed to the bare definition type.
  const served = groups.flatMap((g) => g.options);
  const actions = served.filter((o) => o.display === "action");
  expect("action options exist (instant actions)", actions.length > 0, true);
  expect("every action option carries a template", actions.every((o) => o.action !== undefined), true);
  expect("every choice on an action option names a catalog part",
    actions.flatMap((o) => o.choices).every((c) => Boolean(c.partKey)), true);
  // The insert-time divider picker (owner 2026-08-05). Its default MUST match
  // the adapter's fallback, or an untouched picker would silently re-cut.
  const addTransom = actions.find((o) => o.key === "structure.add-transom");
  expect("add-transom offers the stocked sections",
    addTransom?.choices.map((c) => c.partKey).join(",") ?? "(missing)",
    "transom-t-67,transom-z-67,mullion-78");
  expect("add-transom defaults to the adapter's fallback",
    addTransom?.choices.find((c) => c.isDefault)?.partKey ?? "(none)", "transom-t-67");
  expect("add-mullion defaults to the adapter's fallback",
    actions.find((o) => o.key === "structure.add-mullion")?.choices.find((c) => c.isDefault)?.partKey
      ?? "(none)", "mullion-78");
  expect("add-midrail defaults to the adapter's fallback",
    actions.find((o) => o.key === "structure.add-midrail")?.choices.find((c) => c.isDefault)?.partKey
      ?? "(none)", "midrail-67");
  // mullion-75 has no deduction source, no reinforcement mapping and no price —
  // it must not be selectable anywhere (golden rule).
  expect("mullion-75 is offered by no option",
    choices.filter((c) => c.partKey === "mullion-75").map((c) => c.key).join(",") || "(none)",
    "(none)");
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
  const uncalibrated = ["hardware.locking", "hardware.hinge", "hardware.ventilator", "general.drainage", "glazing.method"];
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

  // The four add-on options are a different shape of honesty: they DO fabricate
  // (Job 169 calibrates the frame inset) but they are priced "none", because the
  // reference Cutting List itemises no row for the add-on profile itself and its
  // own bar length is unevidenced (questions.md Q21).
  for (const side of ["top", "bottom", "left", "right"]) {
    const key = `profile.addon-${side}`;
    const o = options.find((x) => x.key === key);
    expect(`${key} exists`, Boolean(o), true);
    expect(`${key} is priced "none"`, o?.pricingMode, "none");
    expect(`${key} explains itself`, (o?.presentation?.helpText ?? "").length > 0, true);
    const mine = choices.filter((c) => c.optionKey === key);
    expect(`${key} defaults to no add-on`, mine.find((c) => c.isDefault)?.engineEffect?.kind, "none");
    const fitted = mine.filter((c) => !c.isDefault);
    expect(`${key} offers at least one add-on`, fitted.length > 0, true);
    expect(
      `${key} choices target their own side`,
      fitted.every((c) => c.engineEffect?.kind === "addon" && c.engineEffect.params?.side === side),
      true,
    );
  }
  // Every CellNode family must offer them — the reference shows the same four
  // rows on windows and on doors ("they will be common for all other profile"),
  // and Job 169's inset rule is about a FRAME, not about what opens.
  //
  // sliding-patio is deliberately absent: the inset would flow into `frame.w`
  // and therefore into the calibrated panel-width formula, with no patio
  // document to check it against (see catalog/options/sliding.ts).
  for (const side of ["top", "bottom", "left", "right"]) {
    const o = options.find((x) => x.key === `profile.addon-${side}`);
    expect(
      `add-on ${side} is shared by the three CellNode families`,
      [...(o?.familyKeys ?? [])].sort().join(","),
      "casement-window,entrance-door,french-door",
    );
  }

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

  // ---- 8. The same gates, over EVERY registered family ---------------
  validateEveryFamily(expect, catalogKeys);
}

/**
 * The family-agnostic half of this suite, run over `listFamilies()`.
 *
 * Sections 1–7 above are the casement family's own acceptance criteria and
 * name its options. THIS section names none: it asserts only what must be true
 * of any family the seed registers, so registering a fifth one inherits the
 * checks instead of needing new ones. The one that earns its keep most often is
 * "no list option is served empty" — a choice generator whose catalog filter
 * matches nothing (a renamed partKey prefix, a financialCategory that moved)
 * produces a dropdown with no entries and no error anywhere else.
 */
function validateEveryFamily(expect: Expect, catalogKeys: Set<string>): void {
  const families = listFamilies();
  expect("every registered family is served", families.length >= 4, true);
  // Named so a family that silently fails to seed is visible in the log, not
  // just absent from a count.
  expect(
    "the four families are the ones the registry declares",
    families.map((f) => f.familyKey).sort().join(","),
    "casement-window,entrance-door,french-door,sliding-patio",
  );

  const listDisplays = ["select", "select-image", "segmented"];

  for (const fam of families) {
    const key = fam.familyKey;
    const optionSystem = getOptionSystem(key);
    expect(`${key}: option system loads`, optionSystem !== undefined, true);
    if (!optionSystem) continue;

    // -- descriptor --------------------------------------------------
    expect(`${key}: names a registered adapter`,
      ["cellnode", "sliding"].includes(fam.engine.adapter), true);
    expect(`${key}: declares at least one split mode`, fam.splitModes.length > 0, true);
    expect(`${key}: width and height are required dimensions`,
      ["widthMm", "heightMm"].every((d) =>
        fam.dimensions.some((x) => x.key === d && x.required)), true);
    expect(`${key}: constraint ids are unique`,
      new Set(fam.constraints.map((c) => c.id)).size, fam.constraints.length);
    expect(`${key}: every constraint cites a source`,
      fam.constraints.filter((c) => !c.source || !c.source.trim()).length, 0);
    let malformedRules = 0;
    for (const c of fam.constraints) {
      try {
        assertValidRule(c.assert, c.id);
      } catch {
        malformedRules++;
      }
    }
    expect(`${key}: every constraint rule is well-formed`, malformedRules, 0);

    // -- served option system ----------------------------------------
    const gs = optionSystem.groups;
    const os = gs.flatMap((g) => g.options);
    const cs = os.flatMap((o) => o.choices);
    const served = new Set(gs.map((g) => g.key));
    expect(`${key}: every served group is one the family declares`,
      gs.every((g) => fam.optionGroupKeys.includes(g.key)), true);
    expect(`${key}: every option resolves to a served group`,
      os.every((o) => served.has(o.groupKey)), true);
    expect(`${key}: every served option is scoped to this family`,
      os.every((o) => o.familyKeys.includes(key)), true);
    expect(`${key}: no option has more than one default`,
      os.every((o) => o.choices.filter((c) => c.isDefault).length <= 1), true);
    expect(`${key}: every action option carries a template`,
      os.filter((o) => o.display === "action").every((o) => o.action !== undefined), true);
    // An action option MAY offer choices — the divider-section picker on
    // `structure.add-*`, where the template gives the op and the choice gives
    // the SECTION. What it may never do is offer a choice that names no catalog
    // part, which would be a dropdown entry that changes nothing.
    expect(`${key}: every choice on an action option names a catalog part`,
      os.filter((o) => o.display === "action")
        .flatMap((o) => o.choices)
        .filter((c) => !c.partKey)
        .map((c) => c.key).join(",") || "(none)",
      "(none)");
    expect(`${key}: no list option is served empty`,
      os.filter((o) => listDisplays.includes(o.display) && o.choices.length === 0)
        .map((o) => o.key).join(",") || "(none)",
      "(none)");
    expect(`${key}: no choice points at a missing catalog part`,
      cs.filter((c) => c.partKey && !catalogKeys.has(c.partKey))
        .map((c) => c.key).join(",") || "(none)",
      "(none)");
    // Golden rule, checked structurally: an option that fabricates nothing must
    // say so, and every one of its choices must declare no engine effect.
    expect(`${key}: a pricingMode:"none" option explains itself`,
      os.filter((o) => o.pricingMode === "none" && !(o.presentation?.helpText ?? "").trim())
        .map((o) => o.key).join(",") || "(none)",
      "(none)");
    // A component-scoped option must address a component TYPE the family can
    // actually produce, or it is a control nobody will ever see.
    const producible = new Set(fam.componentTypes.map((c) => c.type));
    expect(`${key}: every component-scoped option targets a producible type`,
      os.filter((o) => o.scope.level === "component" &&
        !(o.scope.componentTypes ?? []).some((t) => producible.has(t)))
        .map((o) => o.key).join(",") || "(none)",
      "(none)");
    expect(`${key}: served payload contains no cost/price field`,
      findMoneyKey({ family: fam, optionSystem }) ?? "(none)", "(none)");
  }
}
