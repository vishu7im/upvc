// =====================================================================
// designer/resolve.test.ts — the phase-2 line-item resolver suite.
//
// DB-backed (runs after loadCatalog() inside `npm run validate`, like the
// option-system suite). Asserts the phase-2 acceptance criteria
// (Spec/01-windows-module/phase-2-line-item-core.md):
//
//   • GOLDEN: a defaults-only draft over an existing validation design is
//     byte-identical (pricing totals + cutting list) to a direct solve()
//   • scoped glass changes exactly the targeted pane's glass line
//   • precedence: component-scoped > all-of-type > item-level
//   • split(equal) edit == the same topology authored with that transom
//   • required-unset ⇒ error issue; hidden-required ⇒ no issue
//   • constraint violations carry their HAWDIO source citation
//   • idempotence: resolving the same draft twice is stable
//   • hardwareOverrides substitutes the slot; absent ⇒ byte-identical
// =====================================================================

import {
  DEFAULT_SETTINGS,
  getCatalogVersion,
  getDesign,
  getFamily,
  getOptionSystem,
  getSystem,
} from "../catalog/index.ts";
import { solve } from "../engine/solve.ts";
import { computeHardware } from "../engine/hardware.ts";
import { solveTopology } from "../engine/topology.ts";
import { findSizeLimit } from "../engine/limits.ts";
import type { QuoteOutput } from "../types.ts";
import type { CatalogSnapshot, LineItemDraft } from "./line-item-types.ts";
import { resolveLineItem } from "./resolve.ts";

type Expect = (label: string, actual: any, expected: any) => void;

const FAMILY = "casement-window";
const SYSTEM = "sunnyplast-70";

function snapshot(): CatalogSnapshot {
  return {
    catalogVersion: getCatalogVersion(),
    settings: DEFAULT_SETTINGS,
    getFamily,
    getOptionSystem,
    getSystem,
    getDesign,
  };
}

function draft(partial: Partial<LineItemDraft> & { designId: string }): LineItemDraft {
  return {
    schemaVersion: 1,
    familyKey: FAMILY,
    systemId: SYSTEM,
    quantity: 1,
    dimensions: { widthMm: 1200, heightMm: 1200 },
    ...partial,
  };
}

/** The comparable fabrication surface of an engine output. */
function fabricationOf(out: QuoteOutput) {
  return JSON.stringify({
    bars: out.parts.bars,
    reinforcement: out.parts.reinforcement,
    glass: out.parts.glass,
    gaskets: out.parts.gaskets,
    hardware: out.parts.hardware,
    totals: out.pricing.totals,
    lines: out.pricing.lines,
  });
}

export function validateDesigner(expect: Expect): void {
  console.log("\n==================================================");
  console.log("Designer line-item resolver (windows phase 2)");
  console.log("==================================================");

  const family = getFamily(FAMILY);
  if (!family || !getOptionSystem(FAMILY)) {
    // Fresh DB without the phase-1 seed — SKIP like the option-system suite.
    console.log(`  (skipped — family "${FAMILY}" not seeded; run npm run db:seed)`);
    return;
  }
  const snap = snapshot();
  const system = getSystem(SYSTEM)!;

  // ---- 1. GOLDEN: defaults-only draft == direct solve -----------------
  {
    const direct = solve({
      orderNo: "DESIGNER",
      customer: "Designer",
      designId: "win-th-over-fixed-z",
      widthMm: 1200,
      heightMm: 1200,
      systemId: SYSTEM,
    });
    const { resolved, output } = resolveLineItem(draft({ designId: "win-th-over-fixed-z" }), snap);
    expect("golden: resolve produced an engine output", Boolean(output), true);
    expect("golden: no error issues on a defaults-only draft",
      resolved.issues.filter((i) => i.severity === "error").length, 0);
    expect("golden: invalidSpec false", resolved.invalidSpec, false);
    expect("golden: fabrication byte-identical to direct solve()",
      fabricationOf(output!), fabricationOf(direct));
    expect("golden: grand total matches", resolved.pricing?.totals.grandTotal, direct.pricing.totals.grandTotal);
    expect("golden: summary leaf count", resolved.summary?.leafCount, 2);
    expect("golden: catalogVersion stamped", resolved.catalogVersion, snap.catalogVersion);
  }

  // ---- 2. Scoped glass changes exactly one pane -----------------------
  {
    const base = resolveLineItem(draft({ designId: "win-th-over-fixed-z" }), snap).output!;
    const { resolved, output } = resolveLineItem(
      draft({
        designId: "win-th-over-fixed-z",
        selections: [
          {
            optionKey: "glazing.glass-type",
            choiceKey: "glass-glass-4-20-4-tuff-lowe",
            scope: "cell:root.bottom",
          },
        ],
      }),
      snap,
    );
    expect("scoped glass: no error issues",
      resolved.issues.filter((i) => i.severity === "error").length, 0);
    const tuff = system.glass["glass-4-20-4-tuff-lowe"];
    const baseBottom = base.parts.glass.find((g) => g.label.includes("02"));
    const bottom = output!.parts.glass.find((g) => g.label.includes("02"));
    const top = output!.parts.glass.find((g) => g.label.includes("01"));
    const baseTop = base.parts.glass.find((g) => g.label.includes("01"));
    expect("scoped glass: targeted pane switched to the chosen row", bottom?.code, tuff.code);
    expect("scoped glass: targeted pane size unchanged",
      `${bottom?.widthMm}x${bottom?.heightMm}`, `${baseBottom?.widthMm}x${baseBottom?.heightMm}`);
    expect("scoped glass: the other pane is untouched", top?.code, baseTop?.code);
  }

  // ---- 3. Precedence: component > all-of-type > item ------------------
  {
    const { output, resolved } = resolveLineItem(
      draft({
        designId: "win-th-over-fixed-z",
        selections: [
          // item-level answer (lowest rung of the explicit three)
          { optionKey: "glazing.glass-type", choiceKey: "glass-glass-4-20-4-lowe" },
          // all-of-type beats item-level → wins on the top (sash) pane
          { optionKey: "glazing.glass-type", choiceKey: "glass-glass-4-20-4-tuff-lowe", scope: "glass:*" },
          // component-scoped beats all-of-type → wins on the bottom pane
          // (panel-28-white is a catalog glass ROW — panels are glass, Q5)
          { optionKey: "glazing.glass-type", choiceKey: "glass-panel-28-white", scope: "cell:root.bottom" },
        ],
      }),
      snap,
    );
    expect("precedence: no error issues",
      resolved.issues.filter((i) => i.severity === "error").length, 0);
    const top = output!.parts.glass.find((g) => g.label.includes("01"));
    const bottom = output!.parts.glass.find((g) => g.label.includes("02"));
    expect("precedence: all-of-type beats item-level (top pane)",
      top?.code, system.glass["glass-4-20-4-tuff-lowe"].code);
    expect("precedence: component-scoped beats all-of-type (bottom pane)",
      bottom?.code, system.glass["panel-28-white"]?.code ?? "(panel-28-white missing)");
  }

  // ---- 4. split(equal) edit == authored transom design ----------------
  {
    // Designer path: start from the single fixed light, add an equal
    // horizontal split with the same transom the authored design uses.
    const edited = resolveLineItem(
      draft({
        designId: "win-fixed",
        topologyEdits: [
          {
            id: "e1",
            edit: { op: "split", componentId: "cell:root", axis: "horizontal", position: "equal" },
          },
        ],
      }),
      snap,
    );
    // Authored path: fixed-over-fixed with its transom dragged to the same
    // equal position (splitRatios 0.5 — the existing engine mechanism).
    const authored = solve({
      orderNo: "DESIGNER",
      customer: "Designer",
      designId: "win-fixed-over-fixed",
      widthMm: 1200,
      heightMm: 1200,
      systemId: SYSTEM,
      splitRatios: { root: 0.5 },
    });
    expect("split(equal): no error issues",
      edited.resolved.issues.filter((i) => i.severity === "error").length, 0);
    expect("split(equal): fabrication == authored design at ratio 0.5",
      fabricationOf(edited.output!), fabricationOf(authored));
    const [top, bottom] = edited.output!.geometry.cells;
    expect("split(equal): equal daylight spans",
      Math.abs(top.outer.h - bottom.outer.h) < 0.01, true);
  }

  // ---- 5. equalSplit mode equalises an unequal authored split ---------
  {
    const { resolved } = resolveLineItem(
      draft({ designId: "win-fixed-over-fixed", splitMode: "equalSplit" }),
      snap,
    );
    const sizes = resolved.summary?.glassSizes ?? [];
    expect("equalSplit: two panes", sizes.length, 2);
    expect("equalSplit: pane heights equalised (authored ratio is 1/3)",
      sizes.length === 2 && Math.abs(sizes[0].hMm - sizes[1].hMm) <= 0.1, true);
  }

  // ---- 6. required-unset ⇒ error; hidden-required ⇒ no issue ----------
  {
    const requiredOption = (visibility?: object) => ({
      key: "test.required-probe",
      groupKey: "general",
      name: "Required probe",
      order: 999,
      display: "select" as const,
      required: true,
      scope: { level: "item" as const },
      pricingMode: "none" as const,
      familyKeys: [FAMILY],
      ...(visibility ? { visibility } : {}),
      choices: [],
    });
    const wrap = (vis?: object): CatalogSnapshot => ({
      ...snap,
      getOptionSystem: (key) => {
        const real = getOptionSystem(key);
        if (!real) return real;
        return {
          groups: real.groups.map((g) =>
            g.key === "general" ? { ...g, options: [...g.options, requiredOption(vis) as any] } : g,
          ),
        };
      },
    });
    const unset = resolveLineItem(draft({ designId: "win-fixed" }), wrap());
    expect("required-unset: error issue emitted",
      unset.resolved.issues.some((i) => i.kind === "missing-selection" && i.severity === "error" && i.optionKey === "test.required-probe"),
      true);
    expect("required-unset: invalidSpec true", unset.resolved.invalidSpec, true);

    const hidden = resolveLineItem(
      draft({ designId: "win-fixed" }),
      wrap({ eq: ["item.family", "some-other-family"] }),
    );
    expect("hidden-required: no issue for an invisible option",
      hidden.resolved.issues.some((i) => i.optionKey === "test.required-probe"), false);
  }

  // ---- 7. Constraint violation carries its source ---------------------
  {
    const limit = findSizeLimit("casement-top")!;
    const frame = system.frames["frame-5ch"];
    const sash = system.sashes["sash-t"];
    // Window width that pushes the sash 40 mm past the printed max — within
    // the 10% rule ⇒ the WARNING constraint fires, not the hard error.
    const widthMm = limit.maxWidthMm + 40 + 2 * frame.faceWidth - 2 * sash.overlap;
    const { resolved } = resolveLineItem(
      draft({ designId: "win-th", dimensions: { widthMm, heightMm: 700 } }),
      snap,
    );
    const hit = resolved.issues.find((i) => i.kind === "constraint" && i.constraintId === "casement-top-max-width");
    expect("constraint: printed-max warning fired", Boolean(hit), true);
    expect("constraint: severity is warning (within the 10% rule)", hit?.severity, "warning");
    expect("constraint: carries a HAWDIO source citation", hit?.source?.includes("HAWDIO"), true);
    expect("constraint: the hard +10% error did NOT fire",
      resolved.issues.some((i) => i.constraintId === "casement-top-max-width-hard"), false);
  }

  // ---- 8. Idempotence -------------------------------------------------
  {
    const d = draft({
      designId: "win-th-over-fixed-z",
      selections: [{ optionKey: "glazing.glass-type", choiceKey: "glass-glass-4-20-4-tuff-lowe", scope: "glass:*" }],
      topologyEdits: [],
    });
    const strip = (r: object) => JSON.stringify({ ...(r as any), resolvedAt: null });
    const a = resolveLineItem(d, snap);
    const b = resolveLineItem(d, snap);
    expect("idempotence: same draft resolves identically", strip(a.resolved), strip(b.resolved));
  }

  // ---- 9. hardwareOverrides (the additive engine param) ---------------
  {
    const design = getDesign("win-th")!;
    const geometry = solveTopology(design, 900, 900, system);
    const before = computeHardware(geometry, system);
    const after = computeHardware(geometry, system, { handle: "hw-door-handle" });
    const handleBefore = before.find((h) => h.code === system.hardware["hw-handle-inline"].code);
    const handleAfter = after.find((h) => h.code === system.hardware["hw-door-handle"].code);
    expect("hardwareOverrides: default fits the calibrated inline handle", handleBefore?.qty, 1);
    expect("hardwareOverrides: slot substitution swaps the handle part", handleAfter?.qty, 1);
    expect("hardwareOverrides: substituted part replaces (not adds)",
      after.some((h) => h.code === system.hardware["hw-handle-inline"].code), false);
    expect("hardwareOverrides: absent ⇒ byte-identical hardware",
      JSON.stringify(computeHardware(geometry, system)), JSON.stringify(before));
  }

  // ---- 10. Malformed vs invalid: unknown keys become issues -----------
  {
    const { resolved } = resolveLineItem(
      draft({
        designId: "win-fixed",
        selections: [
          { optionKey: "no.such-option", choiceKey: "x" },
          { optionKey: "glazing.glass-type", choiceKey: "no-such-choice" },
        ],
      }),
      snap,
    );
    expect("unknown option ⇒ error issue",
      resolved.issues.some((i) => i.kind === "unknown-option"), true);
    expect("unknown choice ⇒ error issue",
      resolved.issues.some((i) => i.kind === "unknown-choice"), true);
    expect("unknown keys still yield a priced resolve (invalid ≠ crash)",
      Boolean(resolved.pricing), true);
  }

  // ---- 11. components[] — the phase-4 addressability contract ----------
  {
    const small = resolveLineItem(draft({ designId: "win-th-over-fixed-z" }), snap).resolved;
    const large = resolveLineItem(
      draft({ designId: "win-th-over-fixed-z", dimensions: { widthMm: 1400, heightMm: 1300 } }),
      snap,
    ).resolved;
    const ids = (r: typeof small) => (r.components ?? []).map((c) => c.componentId).sort().join("|");

    expect("components: exposed on a solved resolve", (small.components?.length ?? 0) > 0, true);
    // Ids are POSITION-derived, so resizing the unit must not renumber them —
    // this is what lets a selection (and a scoped selection) survive a resize.
    expect("components: ids stable across a size change", ids(small), ids(large));
    expect("components: rects DO follow the size change",
      small.components?.find((c) => c.componentId === "cell:root.top")?.rect.w !==
        large.components?.find((c) => c.componentId === "cell:root.top")?.rect.w,
      true);
    expect("components: the sash cell is typed sash",
      small.components?.find((c) => c.componentId === "cell:root.top")?.type, "sash");
    expect("components: a sash exposes its glass sub-component",
      small.components?.some((c) => c.componentId === "cell:root.top/glass"), true);
    expect("components: the divider is addressable",
      small.components?.some((c) => c.componentId === "divider:root" && c.type === "transom"), true);
    expect("components: all four frame edges are addressable",
      (small.components ?? []).filter((c) => c.type === "frame-edge").length, 4);
    expect("components: absent when the solve never ran",
      resolveLineItem(draft({ designId: "no-such-design" }), snap).resolved.components, undefined);
  }

  // ---- 12. Edit-history determinism: removing an edit == never made it --
  {
    // Two INDEPENDENT edits (different subtrees), so dropping the first leaves
    // the second addressable — the case the Structure tab's history exposes.
    const editA = { id: "a", edit: { op: "set-sash-kind", componentId: "cell:root.top", kind: "casement-side-left" } };
    const editB = { id: "b", edit: { op: "split", componentId: "cell:root.bottom", axis: "vertical", position: "equal" } };
    const history = [editA, editB];
    const both = resolveLineItem(
      draft({ designId: "win-th-over-fixed-z", topologyEdits: history as any }),
      snap,
    );
    // What the Structure tab's "remove" does: drop the edit and replay the rest.
    const afterRemoval = resolveLineItem(
      draft({ designId: "win-th-over-fixed-z", topologyEdits: history.filter((e) => e.id !== "a") as any }),
      snap,
    );
    // What the item would have been had that edit never been made.
    const neverMade = resolveLineItem(
      draft({ designId: "win-th-over-fixed-z", topologyEdits: [editB] as any }),
      snap,
    );
    // (A 1200-wide side-hung sash legitimately trips the HAWDIO p70 size
    // constraint, so assert on the EDITS applying, not on a clean issue list.)
    expect("edit history: both edits applied cleanly",
      both.resolved.issues.filter((i) => i.kind === "topology-edit-failed").length, 0);
    expect("edit history: removing an edit == never having made it",
      fabricationOf(afterRemoval.output!), fabricationOf(neverMade.output!));
    expect("edit history: the removed edit really did change something",
      fabricationOf(both.output!) !== fabricationOf(afterRemoval.output!), true);
    expect("edit history: the surviving edit still split the bottom cell",
      afterRemoval.output!.geometry.cells.length, 3);
  }

  // ---- 13. Orphaned scoped selection ⇒ an issue, never a silent drop ---
  {
    // The designer prunes selections whose component disappeared; if one slips
    // through (an old saved draft, a hand-written body) the resolver must SAY so
    // rather than apply it somewhere else.
    const { resolved } = resolveLineItem(
      draft({
        designId: "win-fixed",
        selections: [
          { optionKey: "glazing.glass-type", choiceKey: "glass-glass-4-20-4-tuff-lowe", scope: "cell:root.top" },
        ],
      }),
      snap,
    );
    expect("orphaned scope: reported as unknown-component",
      resolved.issues.some((i) => i.kind === "unknown-component" && i.scope === "cell:root.top"), true);
  }

  validateSecondFamily(expect, snap);
}

// ---------------------------------------------------------------------
// Phase 7 — the extensibility proof, asserted
// ---------------------------------------------------------------------

/**
 * A SECOND family (entrance-door) must work through exactly the same pipeline
 * as the first, with no code that knows what a door is. These assertions are
 * the acceptance criteria of Spec/01-windows-module/phase-7-extensibility-proof.md.
 */
function validateSecondFamily(expect: Expect, snap: CatalogSnapshot): void {
  console.log("\n---------- Second family: entrance-door (phase 7) ----------");

  const DOOR_FAMILY = "entrance-door";
  const family = getFamily(DOOR_FAMILY);
  const optionSystem = getOptionSystem(DOOR_FAMILY);
  if (!family || !optionSystem) {
    console.log(`  (skipped — family "${DOOR_FAMILY}" not seeded; run npm run db:seed)`);
    return;
  }

  const doorDraft = (partial: Partial<LineItemDraft> = {}): LineItemDraft => ({
    schemaVersion: 1,
    familyKey: DOOR_FAMILY,
    systemId: SYSTEM,
    designId: "door-single-left",
    quantity: 1,
    dimensions: { widthMm: 900, heightMm: 2100 },
    ...partial,
  });

  // ---- GOLDEN: a defaults-only door == a direct solve() ---------------
  {
    const direct = solve({
      orderNo: "DESIGNER",
      customer: "Designer",
      designId: "door-single-left",
      widthMm: 900,
      heightMm: 2100,
      systemId: SYSTEM,
    });
    const { resolved, output } = resolveLineItem(doorDraft(), snap);
    expect("door golden: resolve produced an engine output", Boolean(output), true);
    expect("door golden: no error issues",
      resolved.issues.filter((i) => i.severity === "error").length, 0);
    expect("door golden: fabrication byte-identical to direct solve()",
      fabricationOf(output!), fabricationOf(direct));
    expect("door golden: grand total matches",
      resolved.pricing?.totals.grandTotal, direct.pricing.totals.grandTotal);
    expect("door golden: the door leaf is counted as a leaf", resolved.summary?.leafCount, 1);
  }

  // ---- The descriptor drives the family, not a code branch ------------
  {
    expect("descriptor: door adapter is the shared cellnode one", family.engine.adapter, "cellnode");
    expect("descriptor: door is quotable", family.engine.quotable, true);
    expect("descriptor: door sash kinds come from the descriptor",
      family.componentTypes.find((c) => c.type === "sash")?.kinds?.join(","),
      "fixed,door-left,door-right");
    // The printed residential-door row (HAWDIO p70) generated the constraints —
    // one transcription, two families.
    const printed = findSizeLimit("door-left");
    expect("descriptor: leaf constraints exist for the door kinds",
      family.constraints.some((c) => c.id === "door-left-max-height"), true);
    expect("descriptor: the constraint cites the printed row",
      family.constraints.find((c) => c.id === "door-left-max-height")?.source, printed?.source);
  }

  // ---- Shared options are ONE definition, offered to both families ----
  {
    const doorOptionKeys = new Set(
      optionSystem.groups.flatMap((g) => g.options.map((o) => o.key)),
    );
    const windowOptionKeys = new Set(
      getOptionSystem(FAMILY)!.groups.flatMap((g) => g.options.map((o) => o.key)),
    );
    expect("shared option: the door sees the catalog cill option",
      doorOptionKeys.has("profile.cill"), true);
    expect("shared option: the door sees the glass option",
      doorOptionKeys.has("glazing.glass-type"), true);
    expect("shared option: it is the SAME key the window uses (not a copy)",
      windowOptionKeys.has("profile.cill"), true);
    expect("door-specific: the window never sees the door leaf option",
      windowOptionKeys.has("profile.door-leaf"), false);
    expect("door-specific: the door never sees the casement sash-type option",
      doorOptionKeys.has("profile.sash-type"), false);
    expect("door-specific: the door has its own handle option",
      doorOptionKeys.has("hardware.door-handle"), true);
  }

  // ---- A door-specific option really reaches the engine ---------------
  {
    // Hinges are a fixed-quantity 1:1 slot on a door leaf, so a substitution is
    // a pure part swap — the geometry must be untouched and the BOM must change.
    const base = resolveLineItem(doorDraft(), snap).output!;
    const alternativeHinge = Object.keys(getSystem(SYSTEM)!.hardware).find(
      (k) => k.startsWith("hw-flag-hinge") && k !== "hw-flag-hinge-white",
    );
    if (alternativeHinge) {
      const { output } = resolveLineItem(
        doorDraft({
          selections: [
            { optionKey: "hardware.door-hinge", choiceKey: `door-hw-hinge-${alternativeHinge}` },
          ],
        }),
        snap,
      );
      const swapped = getSystem(SYSTEM)!.hardware[alternativeHinge];
      expect("door hardware: the chosen hinge is fitted",
        output!.parts.hardware.some((h) => h.code === swapped.code), true);
      expect("door hardware: the default hinge is gone",
        output!.parts.hardware.some((h) => h.code === "DR-FLAG-W"), false);
      expect("door hardware: 3 per leaf, as calibrated",
        output!.parts.hardware.find((h) => h.code === swapped.code)?.qty, 3);
      expect("door hardware: a part swap changes no geometry",
        JSON.stringify(output!.parts.bars), JSON.stringify(base.parts.bars));
    } else {
      // One hinge in the catalog ⇒ nothing to swap to. Assert the slot exists
      // rather than silently skipping the capability.
      const withDefault = resolveLineItem(
        doorDraft({
          selections: [
            { optionKey: "hardware.door-hinge", choiceKey: "door-hw-hinge-hw-flag-hinge-white" },
          ],
        }),
        snap,
      );
      expect("door hardware: the hinge slot resolves without issues",
        withDefault.resolved.issues.filter((i) => i.severity === "error").length, 0);
      expect("door hardware: 3 hinges per leaf, as calibrated",
        withDefault.output!.parts.hardware.find((h) => h.code === "DR-FLAG-W")?.qty, 3);
    }
  }

  // ---- A fanlight over the door is a normal guillotine split ----------
  {
    const { resolved, output } = resolveLineItem(
      doorDraft({
        topologyEdits: [
          { id: "fanlight", edit: { op: "split", componentId: "cell:root", axis: "horizontal", position: "equal" } },
        ],
      }),
      snap,
    );
    expect("fanlight: the split resolved without errors",
      resolved.issues.filter((i) => i.severity === "error").length, 0);
    expect("fanlight: the unit now has two cells", output!.geometry.cells.length, 2);
    expect("fanlight: a transom appears in the cut list",
      output!.geometry.transoms.length, 1);
    const transomCode = getSystem(SYSTEM)!.transoms["transom-t-67"]?.code;
    expect("fanlight: the transom is the seeded default profile",
      output!.parts.bars.some((b) => b.code === transomCode), true);
  }
}
