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
  listFamilies,
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
    listFamilies,
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
  //
  // `frameKey: "frame-6ch"` is part of the baseline since 2026-08-04: the
  // `profile.frame-chamber` option now defaults to 6 chamber (owner decision),
  // and unlike the bead/sash slots the resolver's frame branch applies a
  // DEFAULT-sourced answer — deliberately, so the studio cuts what it shows.
  // The casement designs still bake frame-5ch, so the direct solve() this is
  // compared against must be given the same frame. Everything else is unchanged,
  // which is exactly what this test proves.
  {
    const direct = solve({
      orderNo: "DESIGNER",
      customer: "Designer",
      designId: "win-th-over-fixed-z",
      widthMm: 1200,
      heightMm: 1200,
      systemId: SYSTEM,
      frameKey: "frame-6ch",
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
      frameKey: "frame-6ch", // the studio's default frame — see the golden test
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

  // ---- 14. A divider dropped into a SASH is a midrail ------------------
  {
    // Two defects, one assertion block. Cloning the leaf produced TWO sash
    // rings ("2 windows", doubled gear); dropping the opener produced none at
    // all. Job 154 (Work Order - windows - 27-07-2026.pdf) settles it: ONE
    // ring, ONE handle, and the bar welded inside it.
    const handleCode = system.hardware["hw-handle-inline"].code;
    const before = resolveLineItem(draft({ designId: "win-th" }), snap);
    expect("midrail: the starting design is a single opening sash",
      (before.resolved.components ?? []).filter((c) => c.type === "sash").length, 1);

    const split = resolveLineItem(
      draft({
        designId: "win-th",
        topologyEdits: [
          { id: "t1", edit: { op: "split", componentId: "cell:root", axis: "horizontal", position: "equal" } },
        ],
      }),
      snap,
    );
    const comps = split.resolved.components ?? [];
    expect("midrail: no error issues",
      split.resolved.issues.filter((i) => i.severity === "error").length, 0);
    expect("midrail: the sash ring SURVIVES (the opener is not deleted)",
      comps.filter((c) => c.type === "sash").length, 1);
    expect("midrail: the opener keeps its kind",
      comps.find((c) => c.type === "sash")?.kind, "casement-top");
    expect("midrail: the glazing splits into two panes",
      split.output!.geometry.cells.length, 2);
    expect("midrail: exactly ONE handle (not doubled, not dropped)",
      split.output!.parts.hardware.find((h) => h.code === handleCode)?.qty, 1);
    expect("midrail: one horn-cut bar inside the sash",
      split.output!.geometry.transoms.length, 1);
    // The sash ring itself is unchanged — same 4 bars as before the edit.
    const ring = (o: QuoteOutput) =>
      JSON.stringify(o.parts.bars.filter((b) => b.code === system.sashes["sash-t"].code));
    expect("midrail: the sash ring is cut identically to before",
      ring(split.output!), ring(before.output!));

    // Vertical: the same rule on the other axis (Job 154 p4).
    const vert = resolveLineItem(
      draft({
        designId: "win-th",
        topologyEdits: [
          { id: "t1", edit: { op: "split", componentId: "cell:root", axis: "vertical", position: "equal" } },
        ],
      }),
      snap,
    );
    expect("vertical midrail: no error issues",
      vert.resolved.issues.filter((i) => i.severity === "error").length, 0);
    expect("vertical midrail: the sash ring survives",
      (vert.resolved.components ?? []).filter((c) => c.type === "sash").length, 1);
    expect("vertical midrail: prints as a VERT bar", vert.output!.geometry.mullions.length, 1);
    expect("vertical midrail: two panes side by side", vert.output!.geometry.cells.length, 2);
    expect("vertical midrail: still one handle",
      vert.output!.parts.hardware.find((h) => h.code === handleCode)?.qty, 1);

    // A FIXED pane still splits the FRAME — the D9 behaviour, unchanged.
    const fixedSplit = resolveLineItem(
      draft({
        designId: "win-fixed",
        topologyEdits: [
          { id: "t1", edit: { op: "split", componentId: "cell:root", axis: "horizontal", position: "equal" } },
        ],
      }),
      snap,
    );
    const fixedComps = fixedSplit.resolved.components ?? [];
    expect("fixed cell: still a real frame split, two glass cells",
      fixedComps.filter((c) => c.type === "glass").length, 2);
    expect("fixed cell: no sash is invented", fixedComps.filter((c) => c.type === "sash").length, 0);
  }

  // ---- 15. Fabrication limits are ADVISORY, not blocking ---------------
  {
    // The legacy /quote path has never gated on size — it produced the
    // 4050 × 1040 sliding work order in the repo root. The Designer must not be
    // the only surface that refuses to print a buildable job.
    const over = resolveLineItem(
      draft({ designId: "win-th", dimensions: { widthMm: 4050, heightMm: 1040 } }),
      snap,
    );
    expect("advisory: an oversize unit still solves", Boolean(over.output), true);
    expect("advisory: it raises a dimension error",
      over.resolved.issues.some((i) => i.kind === "dimension-out-of-range" && i.severity === "error"),
      true);
    expect("advisory: invalidSpec still true (the inspector still flags it)",
      over.resolved.invalidSpec, true);
    expect("advisory: but it does NOT block confirm", over.resolved.blocking, false);
    expect("advisory: every advisory issue carries a message",
      over.resolved.issues.every((i) => i.message.length > 0), true);

    // A genuinely broken item still blocks.
    const broken = resolveLineItem(draft({ designId: "no-such-design" }), snap);
    expect("advisory: an unknown design still blocks", broken.resolved.blocking, true);
    const badEdit = resolveLineItem(
      draft({
        designId: "win-fixed",
        topologyEdits: [
          { id: "x", edit: { op: "remove-divider", componentId: "divider:root" } },
        ],
      }),
      snap,
    );
    expect("advisory: a failed topology edit still blocks", badEdit.resolved.blocking, true);
    expect("advisory: a clean draft blocks nothing",
      resolveLineItem(draft({ designId: "win-th-over-fixed-z" }), snap).resolved.blocking, false);
  }

  validateSecondFamily(expect, snap);
  validateFrenchFamily(expect, snap);
  validateSlidingFamily(expect, snap);
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

  // ---- Opening direction controls which elevation can see hinges -------
  {
    const openIn = resolveLineItem(
      doorDraft(),
      snap,
      { style: "realistic", views: ["internal"] },
    ).output!;
    expect("open in: presentation direction reaches QuoteInput",
      openIn.input.doorOpeningDirection, "in");
    expect("open in: hinges hidden externally",
      (openIn.geometry.svg.match(/class=\"door-hinge\"/g) ?? []).length, 0);
    expect("open in: three hinges visible internally",
      ((openIn.geometry.svgViews?.internal ?? "").match(/class=\"door-hinge\"/g) ?? []).length, 3);

    const openOut = resolveLineItem(
      doorDraft({
        selections: [
          {
            optionKey: "general.opening-direction",
            choiceKey: "general-opening-direction-out",
          },
        ],
      }),
      snap,
      { style: "realistic", views: ["internal"] },
    ).output!;
    expect("open out: presentation direction reaches QuoteInput",
      openOut.input.doorOpeningDirection, "out");
    expect("open out: three hinges visible externally",
      (openOut.geometry.svg.match(/class=\"door-hinge\"/g) ?? []).length, 3);
    expect("open out: hinges hidden internally",
      ((openOut.geometry.svgViews?.internal ?? "").match(/class=\"door-hinge\"/g) ?? []).length, 0);
    expect("opening direction does not change fabricated parts",
      fabricationOf(openOut), fabricationOf(openIn));
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

  // ---- A bar dropped into a door LEAF is a midrail, not a frame transom
  {
    // Same rule as the casement (Job 154) and the same fabrication the French
    // door was calibrated on (Job 00000264): the leaf keeps its one welded ring
    // and its gear, and the bar welds inside it.
    const { resolved, output } = resolveLineItem(
      doorDraft({
        topologyEdits: [
          { id: "midrail", edit: { op: "split", componentId: "cell:root", axis: "horizontal", position: "equal" } },
        ],
      }),
      snap,
    );
    expect("door midrail: resolved without errors",
      resolved.issues.filter((i) => i.severity === "error").length, 0);
    expect("door midrail: the leaf glazing splits into two panes",
      output!.geometry.cells.length, 2);
    expect("door midrail: the leaf survives — still exactly one door sash",
      (resolved.components ?? []).filter((c) => c.type === "sash").length, 1);
    const doorHandle = getSystem(SYSTEM)!.hardware["hw-door-handle"].code;
    expect("door midrail: still exactly one door handle",
      output!.parts.hardware.find((h) => h.code === doorHandle)?.qty, 1);
    const midrailCode = getSystem(SYSTEM)!.transoms["midrail-67"]?.code;
    expect("door midrail: cut as the seeded midrail profile",
      output!.parts.bars.some((b) => b.code === midrailCode), true);
  }

  // ---- A real FANLIGHT is a frame split, reached via the frame --------
  {
    // A fanlight is a separate light ABOVE the doorset, so it divides the
    // FRAME — which means the root must not be a leaf-sash. Convert the leaf
    // to glass, split the frame, then make the lower cell a door again. The
    // capability is unchanged; only the route through it is explicit.
    const { resolved, output } = resolveLineItem(
      doorDraft({
        topologyEdits: [
          { id: "a", edit: { op: "convert-component", componentId: "cell:root", to: "glass" } },
          { id: "b", edit: { op: "split", componentId: "cell:root", axis: "horizontal", position: "at-ratio", atRatio: 0.25 } },
          { id: "c", edit: { op: "set-sash-kind", componentId: "cell:root.bottom", kind: "door-left" } },
        ],
      }),
      snap,
    );
    expect("fanlight: resolved without errors",
      resolved.issues.filter((i) => i.severity === "error").length, 0);
    expect("fanlight: a frame transom appears", output!.geometry.transoms.length, 1);
    const transomCode = getSystem(SYSTEM)!.transoms["transom-t-67"]?.code;
    expect("fanlight: it is the seeded default frame profile",
      output!.parts.bars.some((b) => b.code === transomCode), true);
    expect("fanlight: a fixed light above, one door leaf below",
      (resolved.components ?? []).filter((c) => c.type === "sash").length, 1);
  }
}

// ---------------------------------------------------------------------
// Third family — french-door (seed data only, cellnode adapter)
// ---------------------------------------------------------------------

/**
 * French is the cheap half of the studio-parity work: an ordinary `CellNode`
 * tree, so it needed no adapter and no `web/` change. What has to be proved is
 * that the seed did not quietly re-cut a calibrated family — and that the
 * STULP survives the two rules that would otherwise have broken it (the
 * generic 1.8 m divider maximum, and the casement `sash-t` conversion
 * fallback).
 */
function validateFrenchFamily(expect: Expect, snap: CatalogSnapshot): void {
  console.log("\n---------- Third family: french-door ----------");

  const FR_FAMILY = "french-door";
  const family = getFamily(FR_FAMILY);
  const optionSystem = getOptionSystem(FR_FAMILY);
  if (!family || !optionSystem) {
    console.log(`  (skipped — family "${FR_FAMILY}" not seeded; run npm run db:seed)`);
    return;
  }
  const system = getSystem(SYSTEM)!;

  const frDraft = (partial: Partial<LineItemDraft> = {}): LineItemDraft => ({
    schemaVersion: 1,
    familyKey: FR_FAMILY,
    systemId: SYSTEM,
    designId: "door-french",
    quantity: 1,
    dimensions: { widthMm: 1700, heightMm: 2100 },
    ...partial,
  });

  // ---- GOLDEN: a defaults-only French door == a direct solve() --------
  //
  // No `frameKey` in the direct solve, unlike the casement golden test: French
  // does NOT adopt `profile.frame-chamber` (its choices are the casement 5ch/
  // 6ch pair and it carries a default the resolver applies), so the design's
  // own `frame-french` face 48 must survive untouched. This assertion IS that
  // guarantee — if the option were ever adopted, this line fails first.
  {
    const direct = solve({
      orderNo: "DESIGNER",
      customer: "Designer",
      designId: "door-french",
      widthMm: 1700,
      heightMm: 2100,
      systemId: SYSTEM,
    });
    const { resolved, output } = resolveLineItem(frDraft(), snap);
    expect("french golden: resolve produced an engine output", Boolean(output), true);
    expect("french golden: no error issues",
      resolved.issues.filter((i) => i.severity === "error").length, 0);
    expect("french golden: fabrication byte-identical to direct solve()",
      fabricationOf(output!), fabricationOf(direct));
    expect("french golden: grand total matches",
      resolved.pricing?.totals.grandTotal, direct.pricing.totals.grandTotal);
    expect("french golden: two leaves", resolved.summary?.leafCount, 2);
  }

  // ---- THE STULP GUARD ------------------------------------------------
  //
  // The reason `french-door.ts` writes its own `dividerConstraints()` instead
  // of reusing the door one: the stulp IS a mullion, and Job 00000264 prints it
  // at 2004 mm on the product's own standard size. The generic rule would have
  // raised a HAWDIO-cited warning on EVERY French door we can build.
  {
    const { resolved, output } = resolveLineItem(frDraft(), snap);
    const mullions = (resolved.components ?? []).filter((c) => c.type === "mullion");
    expect("stulp: exactly one mullion in a pure pair", mullions.length, 1);
    expect("stulp: it is the square-cut S joint", mullions[0]?.kind, "S");
    expect("stulp: it spans past 1.8 m on the standard size",
      mullions[0]!.rect.h > 1800, true);
    expect("stulp: and raises NO mullion-length issue",
      resolved.issues.filter((i) => i.constraintId === "mullion-max-length").length, 0);
    // Job 00000264 prints 2004 = 2100 − 96, with no horn and no weld add.
    const stulp = output!.parts.bars.find((b) => b.code === system.transoms["french-mullion"].code);
    expect("stulp: cut to the full daylight height", stulp?.extMm, 2004);
    expect("stulp: square-cut — Ext == Int, no horns", stulp?.intMm, stulp?.extMm);
    expect("stulp: no welded ends, so no weld allowance", stulp?.weldedEndCount, 0);
  }

  // A real welded mullion beside a sidelight is still checked — the exemption
  // is on the JOINT TYPE, not on the rule.
  {
    const rule = family.constraints.find((c) => c.id === "mullion-max-length");
    expect("stulp: the mullion rule still exists", Boolean(rule), true);
    expect("stulp: it exempts by joint type, not by dropping the check",
      JSON.stringify(rule?.assert).includes('"component.kind"'), true);
  }

  // ---- Master/slave survive a resize ----------------------------------
  {
    const wide = resolveLineItem(frDraft({ dimensions: { widthMm: 2000, heightMm: 2200 } }), snap);
    const kinds = (wide.resolved.components ?? [])
      .filter((c) => c.type === "sash")
      .map((c) => c.kind)
      .sort();
    expect("resize: still a master + slave pair",
      kinds.join(","), "french-door-master,french-door-slave");
    expect("resize: componentIds are position-derived and stable",
      (wide.resolved.components ?? []).some((c) => c.componentId === "cell:root.left"), true);
  }

  // ---- The midrail this family CALIBRATED ------------------------------
  {
    // Job 00000264's own fabrication: the bar welds inside the leaf's ring, so
    // the opener, its handle and its gear survive and the glazing splits.
    const { resolved, output } = resolveLineItem(
      frDraft({
        topologyEdits: [
          { id: "m", edit: { op: "split", componentId: "cell:root.left", axis: "horizontal", position: "equal" } },
        ],
      }),
      snap,
    );
    expect("french midrail: resolved without errors",
      resolved.issues.filter((i) => i.severity === "error").length, 0);
    expect("french midrail: still exactly two leaves",
      (resolved.components ?? []).filter((c) => c.type === "sash").length, 2);
    expect("french midrail: the master's glazing splits into two panes",
      output!.geometry.cells.length, 3);
    const midrailCode = system.transoms["midrail-67"]?.code;
    expect("french midrail: cut as the calibrated midrail profile",
      output!.parts.bars.some((b) => b.code === midrailCode), true);
  }

  // ---- The leaf profile is a genuine 1:1 swap --------------------------
  {
    const base = resolveLineItem(frDraft(), snap).output!;
    const { resolved, output } = resolveLineItem(
      frDraft({
        selections: [
          { optionKey: "profile.french-sash-profile", choiceKey: "french-sash-profile-sash-door-t-fr" },
        ],
      }),
      snap,
    );
    expect("french sash swap: no error issues",
      resolved.issues.filter((i) => i.severity === "error").length, 0);
    const tCode = system.sashes["sash-door-t-fr"].code;
    const zCode = system.sashes["sash-door-z-fr"].code;
    expect("french sash swap: the T leaf is cut", output!.parts.bars.some((b) => b.code === tCode), true);
    expect("french sash swap: the Z leaf is gone", output!.parts.bars.some((b) => b.code === zCode), false);
    // Job 00000264 cuts both leaves identically — face 105, overlap 20, 3 mm
    // weld — so ONLY the code may move. Compare the lengths, not the codes.
    const lengths = (o: typeof base) =>
      JSON.stringify(o.parts.bars.map((b) => [b.extMm, b.intMm, b.orientation]));
    expect("french sash swap: every bar LENGTH is unchanged",
      lengths(output!), lengths(base));
  }

  // ---- What French must NOT be offered --------------------------------
  {
    const frKeys = new Set(optionSystem.groups.flatMap((g) => g.options.map((o) => o.key)));
    expect("french: no frame-chamber option (frame-french is the only calibrated frame)",
      frKeys.has("profile.frame-chamber"), false);
    expect("french: no divider-profile option (it would replace the stulp)",
      frKeys.has("profile.divider"), false);
    expect("french: no component-type conversion (the sash-t fallback)",
      frKeys.has("structure.component-type"), false);
    expect("french: no lock/cylinder/hinge slots (the engine fits them unslotted)",
      frKeys.has("hardware.door-lock") || frKeys.has("hardware.cylinder") || frKeys.has("hardware.door-hinge"),
      false);
    expect("french: the handle IS a real slot", frKeys.has("hardware.door-handle"), true);
    expect("french: shares the catalog glass option", frKeys.has("glazing.glass-type"), true);
    expect("french: declares no conversions", family.componentConversions.length, 0);
  }
}

// ---------------------------------------------------------------------
// Fourth family — sliding-patio (the second ADAPTER)
// ---------------------------------------------------------------------

/**
 * Sliding is the half that needed platform work: a `kind:"sliding"` node the
 * cellnode adapter rejects outright. What must be proved is (a) the row still
 * quotes byte-identically through the resolver, (b) a panel-boundary drag
 * reproduces the widths `validateSlidingSpans` already asserts against the
 * calibrated formula, and (c) every rejected edit becomes an ISSUE — the
 * resolver must never throw, because `POST /api/line-items/resolve` is public.
 */
function validateSlidingFamily(expect: Expect, snap: CatalogSnapshot): void {
  console.log("\n---------- Fourth family: sliding-patio (new adapter) ----------");

  const SL_FAMILY = "sliding-patio";
  const family = getFamily(SL_FAMILY);
  const optionSystem = getOptionSystem(SL_FAMILY);
  if (!family || !optionSystem) {
    console.log(`  (skipped — family "${SL_FAMILY}" not seeded; run npm run db:seed)`);
    return;
  }

  /** The seeded OX design (fixed + slider), default 1500 × 1750. */
  const OX = "0057bd49-577c-4b61-bf5f-f8d69ca760b3";
  if (!snap.getDesign(OX)) {
    console.log("  (skipped — the sliding designs are not seeded)");
    return;
  }

  const slDraft = (partial: Partial<LineItemDraft> = {}): LineItemDraft => ({
    schemaVersion: 1,
    familyKey: SL_FAMILY,
    systemId: SYSTEM,
    designId: OX,
    quantity: 1,
    dimensions: { widthMm: 1500, heightMm: 1750 },
    ...partial,
  });

  // ---- GOLDEN: a defaults-only patio row == a direct solve() ----------
  {
    const direct = solve({
      orderNo: "DESIGNER",
      customer: "Designer",
      designId: OX,
      widthMm: 1500,
      heightMm: 1750,
      systemId: SYSTEM,
    });
    const { resolved, output } = resolveLineItem(slDraft(), snap);
    expect("sliding golden: resolve produced an engine output", Boolean(output), true);
    expect("sliding golden: no error issues",
      resolved.issues.filter((i) => i.severity === "error").length, 0);
    expect("sliding golden: fabrication byte-identical to direct solve()",
      fabricationOf(output!), fabricationOf(direct));
    expect("sliding golden: grand total matches",
      resolved.pricing?.totals.grandTotal, direct.pricing.totals.grandTotal);
    expect("sliding golden: no constraints exist to fire (HAWDIO p70 has no sliding row)",
      family.constraints.length, 0);
  }

  // ---- The adapter's component contract --------------------------------
  {
    const { resolved } = resolveLineItem(slDraft(), snap);
    const comps = resolved.components ?? [];
    const panels = comps.filter((c) => c.componentId.startsWith("cell:"));
    expect("sliding components: one per panel", panels.length, 2);
    expect("sliding components: ids use the platform's cell: prefix",
      panels.map((p) => p.componentId).join(","), "cell:root.p1,cell:root.p2");
    expect("sliding components: a panel is typed as a sash ring",
      panels.every((p) => p.type === "sash"), true);
    expect("sliding components: the kind is the engine's own SashKind",
      panels.map((p) => p.kind).join(","), "sliding-fixed,sliding-slide-left");
    expect("sliding components: the four frame edges are enumerated",
      comps.filter((c) => c.type === "frame-edge").length, 4);
    expect("sliding components: NO per-panel glass sub-component is offered",
      comps.some((c) => c.componentId.endsWith("/glass")), false);
    expect("sliding components: no dividers — a boundary is a fraction, not a part",
      comps.some((c) => c.type === "transom" || c.type === "mullion"), false);
  }

  // ---- A boundary drag reproduces the calibrated widths ----------------
  {
    // The same numbers `jobs.ts#validateSlidingSpans` proves against the
    // formula: equal ⇒ 749 each; b1 = 0.40 ⇒ 598 / 900 summing to 1498.
    const equal = resolveLineItem(slDraft(), snap).output!;
    const sashCode = getSystem(SYSTEM)!.sashes["sash-sliding"].code;
    const equalW = equal.parts.bars
      .filter((b) => b.code === sashCode && b.orientation === "H")
      .map((b) => b.extMm);
    expect("sliding spans: equal panels are 749 wide", equalW[0], 749);

    const dragged = resolveLineItem(
      slDraft({ splitRatios: { "root.b1": 0.4 } }),
      snap,
    );
    expect("sliding spans: a drag resolves without errors",
      dragged.resolved.issues.filter((i) => i.severity === "error").length, 0);
    const draggedW = [
      ...new Set(
        dragged
          .output!.parts.bars.filter((b) => b.code === sashCode && b.orientation === "H")
          .map((b) => b.extMm),
      ),
    ].sort((a, b) => a - b);
    expect("sliding spans: b1=0.40 gives 598 / 900", draggedW.join(","), "598,900");
    expect("sliding spans: the two panels still fill the row", draggedW[0] + draggedW[1], 1498);
  }

  // ---- Every rejected edit is an ISSUE, never a throw -------------------
  {
    const ops: { id: string; edit: any }[] = [
      { id: "split", edit: { op: "split", componentId: "cell:root.p1", axis: "vertical", position: "equal" } },
      { id: "midrail", edit: { op: "add-midrail", componentId: "cell:root.p1", position: "equal" } },
      { id: "remove", edit: { op: "remove-divider", componentId: "divider:root" } },
      { id: "setdiv", edit: { op: "set-divider", componentId: "divider:root", dividerKey: "mullion-78" } },
      { id: "convert", edit: { op: "convert-component", componentId: "cell:root.p1", to: "glass" } },
      { id: "kind", edit: { op: "set-sash-kind", componentId: "cell:root.p1", kind: "sliding-slide-right" } },
    ];
    for (const o of ops) {
      let threw = false;
      let result: ReturnType<typeof resolveLineItem> | undefined;
      try {
        result = resolveLineItem(slDraft({ topologyEdits: [o] }), snap);
      } catch {
        threw = true;
      }
      expect(`sliding reject (${o.id}): resolveLineItem does not throw`, threw, false);
      const failures = (result?.resolved.issues ?? []).filter(
        (i) => i.kind === "topology-edit-failed" && i.editId === o.id,
      );
      expect(`sliding reject (${o.id}): exactly one topology-edit-failed issue`, failures.length, 1);
      expect(`sliding reject (${o.id}): the message says WHY`,
        (failures[0]?.message.length ?? 0) > 80, true);
      // A rejected edit must not corrupt the quote: the row still solves.
      expect(`sliding reject (${o.id}): the row still produces an output`,
        Boolean(result?.output), true);
    }
  }

  // ---- Item-level glass and bead reach the NODE's own slots -------------
  {
    const base = resolveLineItem(slDraft(), snap).output!;
    const system = getSystem(SYSTEM)!;
    const alt = Object.keys(system.glass).find(
      (k) => k !== "glass-4-20-4-lowe" && system.glass[k].financialCategory !== "Panels",
    );
    if (alt) {
      const { resolved, output } = resolveLineItem(
        slDraft({ selections: [{ optionKey: "glazing.sliding-glass", choiceKey: `sliding-glass-${alt}` }] }),
        snap,
      );
      expect("sliding glass: no error issues",
        resolved.issues.filter((i) => i.severity === "error").length, 0);
      expect("sliding glass: every pane takes the chosen unit",
        output!.parts.glass.every((g) => g.code === system.glass[alt].code), true);
      expect("sliding glass: the pane SIZES are unchanged",
        JSON.stringify(output!.parts.glass.map((g) => [g.widthMm, g.heightMm])),
        JSON.stringify(base.parts.glass.map((g) => [g.widthMm, g.heightMm])));
    }
  }

  // ---- What the patio studio must NOT offer ----------------------------
  {
    const slKeys = new Set(optionSystem.groups.flatMap((g) => g.options.map((o) => o.key)));
    expect("sliding: no frame option (frame-sliding is the only patio frame)",
      slKeys.has("profile.frame-chamber"), false);
    expect("sliding: no cill (it would move every panel via the 30 mm deduction)",
      slKeys.has("profile.cill"), false);
    expect("sliding: no add-ons (calibrated on a door, not a patio)",
      slKeys.has("profile.addon-left"), false);
    expect("sliding: no structural actions — every edit is rejected",
      [...slKeys].some((k) => k.startsWith("structure.")), false);
    expect("sliding: no hardware slot over an approximate tally",
      [...slKeys].some((k) => k.startsWith("hardware.")), false);
    expect("sliding: it does own an item-level glass row",
      slKeys.has("glazing.sliding-glass"), true);
    expect("sliding: and its own bead row", slKeys.has("profile.sliding-bead"), true);
    expect("sliding: byDimensions is the only split mode",
      family.splitModes.join(","), "byDimensions");
    expect("sliding: it names the sliding adapter", family.engine.adapter, "sliding");
  }
}
