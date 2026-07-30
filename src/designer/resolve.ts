// =====================================================================
// designer/resolve.ts — the stateless resolve pipeline (Task 1 phase 2).
//
//   Spec/00-architecture/line-item-schema.md §4:
//
//   LineItemDraft
//     → validate dimensions against descriptor            (Issues)
//     → adapter.applyEdit × topologyEdits                 (working topology)
//     → resolve selections (option-schema §7)             (values + Issues)
//     → map engineEffects → QuoteInput                    (glass/colour/cill/…)
//     → solve(quoteInput)                                 (UNCHANGED entrypoint)
//     → evaluate family constraints on solved geometry    (Issues)
//     → assemble ResolvedLineItem
//
// PURITY. Everything here is synchronous and I/O-free. The catalog arrives as
// a `CatalogSnapshot`; the ONE caveat is that `solve()` reads the loader's
// in-memory cache directly, so the snapshot handed in MUST mirror the loaded
// catalog (the API's snapshot IS the loader cache; tests may wrap it but must
// keep systemId/designId resolvable). Issues never throw out of this module —
// an invalid-but-well-formed draft returns a ResolvedLineItem carrying error
// issues (malformed JSON is the API layer's 400, not ours).
//
// GOLDEN RULE. Nothing here invents fabrication behaviour: topology edits map
// onto existing engine concepts (adapter), engine effects map onto existing
// QuoteInput slots, constraints/limits carry their HAWDIO citations from the
// descriptor and src/engine/limits.ts.
// =====================================================================

import { solve } from "../engine/solve.ts";
import { solveTopology } from "../engine/topology.ts";
import { planCuts } from "../engine/cutting.ts";
import { computePricing } from "../engine/pricing.ts";
import { checkSizeLimits } from "../engine/limits.ts";
import type {
  CellNode,
  Design,
  DocOption,
  ProfileSystem,
  QuoteOutput,
  QuoteView,
  SashKind,
  SolvedGeometry,
} from "../types.ts";
import type {
  ComponentType,
  FamilyConstraint,
  OptionSystem,
  ProductFamilyDescriptor,
  RuleContext,
  SelectionValue,
  TopologyEdit,
} from "./option-types.ts";
import { RuleError, evalRule } from "./rules.ts";
import type {
  CatalogSnapshot,
  ComponentRef,
  EngineEffectOutputs,
  LineItemDraft,
  LineItemIssue,
  ResolvedLineItem,
  ResolvedSummary,
} from "./line-item-types.ts";
import { LINE_ITEM_SCHEMA_VERSION, isBlockingIssue } from "./line-item-types.ts";
import { getAdapter } from "./adapters/index.ts";
import {
  AdapterError,
  equalSplitRatios,
  pinAllCells,
  pinCellField,
  toQuoteInput,
} from "./adapters/cellnode.ts";
import { resolveSelections, type EffectiveSelection } from "./select.ts";

export interface ResolveResult {
  resolved: ResolvedLineItem;
  /** Full engine output for aggregation/documents; absent when the solve failed. */
  output?: QuoteOutput;
}

/**
 * Per-REQUEST options — how the caller wants the answer rendered, never what
 * the item IS. They are deliberately not part of `LineItemDraft`: a saved draft
 * must not carry the view the designer happened to be looking at.
 */
export interface ResolveOptions {
  /** Extra elevations to render besides `external` (phase 5). */
  views?: QuoteView[];
  /**
   * How those elevations are DRAWN. "realistic" is the live-configurator
   * presentation style; like `views` it is a request option, never draft data,
   * so the same saved item can be re-rendered flat for paperwork.
   */
  style?: "flat" | "realistic";
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

export function resolveLineItem(
  draft: LineItemDraft,
  snapshot: CatalogSnapshot,
  options?: ResolveOptions,
): ResolveResult {
  const issues: LineItemIssue[] = [];
  const fail = (partial?: Partial<ResolvedLineItem>): ResolveResult => ({
    resolved: assemble(snapshot, issues, undefined, undefined, partial),
  });

  // ---- 0. schema version (fail-loud — data-model.md §5) --------------
  if (draft.schemaVersion !== LINE_ITEM_SCHEMA_VERSION) {
    issues.push({
      severity: "error",
      kind: "schema-version",
      message: `Unknown line-item schemaVersion ${draft.schemaVersion} (this resolver understands ${LINE_ITEM_SCHEMA_VERSION})`,
    });
    return fail();
  }

  // ---- 1. catalog lookups ---------------------------------------------
  const family = snapshot.getFamily(draft.familyKey);
  if (!family) {
    issues.push({ severity: "error", kind: "unknown-family", message: `Unknown product family: ${draft.familyKey}` });
    return fail();
  }
  const system = snapshot.getSystem(draft.systemId);
  if (!system) {
    issues.push({ severity: "error", kind: "unknown-system", message: `Unknown system: ${draft.systemId}` });
    return fail();
  }
  if (!family.systemIds.includes(draft.systemId)) {
    issues.push({
      severity: "warning",
      kind: "unknown-system",
      message: `System "${draft.systemId}" is not registered for family "${family.familyKey}"`,
    });
  }
  const design = snapshot.getDesign(draft.designId);
  if (!design) {
    issues.push({ severity: "error", kind: "unknown-design", message: `Unknown design: ${draft.designId}` });
    return fail();
  }
  if (!family.engine.quotable) {
    issues.push({
      severity: "error",
      kind: "not-implemented",
      message: `Family "${family.familyKey}" is configurable but not quotable`,
    });
  }
  const adapter = getAdapter(family.engine.adapter);
  const optionSystem = snapshot.getOptionSystem(draft.familyKey) ?? { groups: [] };

  // ---- 2. dimensions vs descriptor ------------------------------------
  validateDimensions(draft, family, issues);
  const widthMm = draft.dimensions.widthMm;
  const heightMm = draft.dimensions.heightMm;
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
    return fail(); // cannot solve anything without a usable W×H
  }

  // ---- 3. topology edits (in order; ids re-derived after each) --------
  let working: CellNode = design.topology;
  let topologyEdited = false;
  for (const e of draft.topologyEdits ?? []) {
    try {
      const geometry = solveTopology({ ...design, topology: working }, widthMm, heightMm, system);
      working = adapter.applyEdit(working, e.edit, { widthMm, heightMm, geometry, system });
      topologyEdited = true;
    } catch (err) {
      issues.push({
        severity: "error",
        kind: "topology-edit-failed",
        editId: e.id,
        message: `Edit "${e.id}" (${e.edit.op}) failed: ${(err as Error).message}`,
      });
    }
  }

  // ---- 4. components + selections -------------------------------------
  let preGeometry: SolvedGeometry;
  try {
    preGeometry = solveTopology({ ...design, topology: working }, widthMm, heightMm, system);
  } catch (err) {
    issues.push({ severity: "error", kind: "solve-failed", message: (err as Error).message });
    return fail();
  }
  const item: RuleContext["item"] = {
    family: draft.familyKey,
    system: draft.systemId,
    widthMm,
    heightMm,
  };

  // ---- 5. selections → engine effects → QuoteInput slots ---------------
  //
  // Run at most TWICE. A selection can itself be a structural change (convert
  // a pane to a sash, change a sash kind), and that changes WHICH components
  // exist — a sash owns a `…/glass` pane a plain glass cell does not. An answer
  // scoped to such a component can only resolve against the post-edit list, so
  // when pass 1 applied a structural effect we re-derive the components and
  // resolve once more. It terminates: `applyEngineEffects` skips a topology
  // edit whose component already matches the selection, so pass 2 re-applies
  // nothing structural, and every other effect is idempotent (it writes the
  // same key into a fresh effects object). Only the FINAL pass's issues are
  // reported — a component that exists by the end is not "unknown".
  const effects: EngineEffectOutputs = {};
  let selection = resolveSelections({
    optionSystem,
    selections: draft.selections ?? [],
    components: adapter.listComponents(preGeometry),
    item,
  });
  for (let pass = 0; pass < 2; pass++) {
    const passIssues: LineItemIssue[] = [];
    const applied = applyEngineEffects({
      effective: selection.effective,
      effects,
      working,
      topologyEdited,
      adapter: family.engine.adapter,
      design,
      system,
      widthMm,
      heightMm,
      issues: passIssues,
    });
    working = applied.working;
    topologyEdited = applied.topologyEdited;

    if (pass === 0 && applied.structuralEdit) {
      try {
        const reGeometry = solveTopology({ ...design, topology: working }, widthMm, heightMm, system);
        selection = resolveSelections({
          optionSystem,
          selections: draft.selections ?? [],
          components: adapter.listComponents(reGeometry),
          item,
        });
        continue; // pass 2 reports the issues
      } catch (err) {
        issues.push({ severity: "error", kind: "solve-failed", message: (err as Error).message });
        return fail();
      }
    }
    issues.push(...selection.issues, ...passIssues);
    break;
  }

  // ---- split modes -----------------------------------------------------
  let splitRatios = draft.splitRatios;
  if (draft.splitMode === "equalGlass") {
    // Deferred (questions.md Q4): needs an iterative solve around the engine.
    issues.push({
      severity: "warning",
      kind: "not-implemented",
      message: 'Split mode "equalGlass" is not implemented yet (questions.md Q4) — using the drawn positions',
    });
  } else if (draft.splitMode === "equalSplit") {
    try {
      const frameKey = effects.frameKey ?? design.frameKey;
      const frame = system.frames[frameKey];
      if (!frame) throw new AdapterError(`Unknown frame: ${frameKey}`);
      splitRatios = equalSplitRatios(working, widthMm, heightMm, system, frame.faceWidth);
    } catch (err) {
      issues.push({
        severity: "warning",
        kind: "not-implemented",
        message: `Equal split not applied: ${(err as Error).message}`,
      });
    }
  }

  // ---- 6. solve --------------------------------------------------------
  const quoteInput = toQuoteInput({
    draft,
    design,
    workingTopology: working,
    topologyEdited,
    effects,
    splitRatios,
    ...(options?.views?.length ? { views: options.views } : {}),
    ...(options?.style === "realistic" ? { svgStyle: "realistic" as const } : {}),
  });
  let output: QuoteOutput;
  try {
    output = solve(quoteInput);
  } catch (err) {
    issues.push({ severity: "error", kind: "solve-failed", message: (err as Error).message });
    return fail();
  }

  // ---- 6b. bom-line add-lines (plain catalog hardware part × qty) ------
  if (effects.bomLines?.length) {
    output = appendBomLines(output, effects.bomLines, system, snapshot, issues);
  }

  // ---- 7. constraints + weight limits on solved geometry ---------------
  const solvedGeometry = reconstructGeometry(output, design, system, effects.frameKey);
  const solvedComponents = adapter.listComponents(solvedGeometry);
  evaluateConstraints(family.constraints, solvedComponents, item, selection.selectionCtx, issues);

  // The manual's sash-weight formula (migration phase 4, HAWDIO p70/p71).
  // Only the WEIGHT verdicts merge here — the size verdicts are already
  // expressed as descriptor constraints (generated from the same SIZE_LIMITS
  // transcription), so merging both would double-report every oversize.
  for (const li of checkSizeLimits(solvedGeometry)) {
    if (li.code !== "sash-overweight") continue;
    issues.push({
      severity: li.severity,
      kind: "size-limit",
      constraintId: li.code,
      ...(li.pathId ? { scope: `cell:${li.pathId}` } : {}),
      message: li.message,
      source: li.source,
    });
  }

  // ---- 8. assemble -----------------------------------------------------
  const summary = buildSummary(draft, output, system, selection.effective, optionSystem);
  return { resolved: assemble(snapshot, issues, output, summary, undefined, solvedComponents), output };
}

// ---------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------

function validateDimensions(
  draft: LineItemDraft,
  family: ProductFamilyDescriptor,
  issues: LineItemIssue[],
): void {
  for (const dim of family.dimensions) {
    const value = draft.dimensions?.[dim.key];
    if (value === undefined || value === null) {
      if (dim.required) {
        issues.push({
          severity: "error",
          kind: "missing-dimension",
          dimensionKey: dim.key,
          message: `${dim.label} is required`,
        });
      }
      continue;
    }
    if (!Number.isFinite(value)) {
      issues.push({
        severity: "error",
        kind: "dimension-out-of-range",
        dimensionKey: dim.key,
        message: `${dim.label} must be a number`,
      });
      continue;
    }
    if (value < dim.min || value > dim.max) {
      issues.push({
        severity: "error",
        kind: "dimension-out-of-range",
        dimensionKey: dim.key,
        message: `${dim.label} ${value} mm is outside the allowed ${dim.min}–${dim.max} mm`,
      });
    }
  }
}

// ---------------------------------------------------------------------
// Engine effects
// ---------------------------------------------------------------------

function applyEngineEffects(args: {
  effective: EffectiveSelection[];
  effects: EngineEffectOutputs;
  working: CellNode;
  topologyEdited: boolean;
  adapter: string;
  design: Design;
  system: ProfileSystem;
  widthMm: number;
  heightMm: number;
  issues: LineItemIssue[];
}): { working: CellNode; topologyEdited: boolean; structuralEdit: boolean } {
  const { effective, effects, design, system, widthMm, heightMm, issues } = args;
  let { working, topologyEdited } = args;
  /** A selection actually restructured the tree (see the two-pass note above). */
  let structuralEdit = false;
  const adapterImpl = getAdapter(args.adapter);

  for (const ev of effective) {
    const effect = ev.choice?.engineEffect;
    if (!effect || effect.kind === "none") continue;
    const partKey = ev.choice?.partKey;
    const scopeIssue = ev.component ? { scope: ev.component.componentId } : {};

    switch (effect.kind) {
      case "colour-key": {
        if (!partKey) break;
        if (effect.params?.side === "outside") effects.colourKeyOutside = partKey;
        else effects.colourKey = partKey;
        break;
      }

      case "glass-key": {
        if (!partKey) break;
        if (!ev.component) {
          effects.glassKey = partKey;
        } else {
          // Component-scoped glass: pin the cell's own glassKey in the
          // working topology (the same slot fillDefaultGlass fills).
          try {
            working = pinCellField(working, ev.component.path, { glassKey: partKey });
            topologyEdited = true;
          } catch (err) {
            issues.push({
              severity: "error",
              kind: "unknown-component",
              optionKey: ev.option.key,
              ...scopeIssue,
              message: `Cannot pin glass on ${ev.component.componentId}: ${(err as Error).message}`,
            });
          }
        }
        break;
      }

      case "cill-key": {
        if (partKey) effects.cillKey = partKey;
        break;
      }

      // Add-on (frame extension) on one frame edge — pushes the frame in by
      // that profile's face, leaving the unit size unchanged (Job 169). The
      // side rides on the choice's own params, so a new edge is pure seed data.
      case "addon": {
        if (!partKey) break;
        const side = effect.params?.side;
        if (side !== "top" && side !== "bottom" && side !== "left" && side !== "right") {
          issues.push({
            severity: "error",
            kind: "invalid-value",
            optionKey: ev.option.key,
            message: `Add-on effect needs params.side (top/bottom/left/right), got "${String(side)}"`,
          });
          break;
        }
        const aux = system.auxiliaries?.[partKey];
        if (!aux || aux.faceWidthMm === undefined) {
          issues.push({
            severity: "error",
            kind: "invalid-value",
            optionKey: ev.option.key,
            message:
              `Add-on ${partKey} has no calibrated face width, so it cannot be fitted to a frame edge`,
          });
          break;
        }
        (effects.addons ??= {})[side] = partKey;
        break;
      }

      case "profile-substitution": {
        if (!partKey) break;
        const slot = effect.params?.slot;
        if (slot === "frame") {
          // `side` present ⇒ this answer sets ONE edge (the reference's four
          // Frame (Standard) rows); absent ⇒ the whole frame, as before.
          const side = effect.params?.side;
          if (side === "top" || side === "bottom" || side === "left" || side === "right") {
            (effects.frameKeys ??= {})[side] = partKey;
          } else {
            effects.frameKey = partKey;
          }
        } else if (slot === "bead") {
          // A DEFAULT bead answer is the design's baked state — pinning it
          // would rewrite the topology for nothing; only explicit answers pin.
          if (ev.source === "default") break;
          working = pinAllCells(working, { beadKey: partKey });
          topologyEdited = true;
        } else {
          issues.push({
            severity: "warning",
            kind: "not-implemented",
            optionKey: ev.option.key,
            message: `profile-substitution slot "${slot}" is not implemented`,
          });
        }
        break;
      }

      case "hardware-substitution": {
        if (!partKey) break;
        const slot = String(effect.params?.slot ?? "");
        if (!slot) break;
        const overrides = (effects.hardwareOverrides ??= {});
        if (overrides[slot] && overrides[slot] !== partKey) {
          // The engine's substitution map is per-slot, not per-component
          // (hardware.ts): differing per-sash picks cannot be honoured yet.
          issues.push({
            severity: "warning",
            kind: "conflicting-selection",
            optionKey: ev.option.key,
            ...scopeIssue,
            message: `Different ${ev.option.name} choices per sash are not supported yet — using "${overrides[slot]}" everywhere`,
          });
          break;
        }
        overrides[slot] = partKey;
        // Handedness. Cranked and monkeytail handles are HANDED — the supplier
        // names them "L/H" / "R/H" — and fitting the wrong hand to a side-hung
        // sash is a real fabrication error (the same reason D7 never exposed
        // keep sets). Warn only: the hinge side may yet change, and the choice
        // is the fabricator's. Top-hung and fixed cells have no hand, so they
        // are skipped entirely rather than guessed at.
        const handIssue = handMismatch(ev.component?.kind, ev.choice?.label ?? "");
        if (handIssue) {
          issues.push({
            severity: "warning",
            kind: "conflicting-selection",
            optionKey: ev.option.key,
            ...scopeIssue,
            message: handIssue,
          });
        }
        break;
      }

      case "topology-edit": {
        if (!ev.component) break;
        const edit = topologyEditFromParams(
          // A profile choice carries its part on the CHOICE (one source of truth
          // for catalog data), so fold it into the edit payload here.
          partKey ? { ...(effect.params ?? {}), dividerKey: partKey } : (effect.params ?? {}),
          ev.component,
        );
        if (!edit) {
          issues.push({
            severity: "error",
            kind: "invalid-value",
            optionKey: ev.option.key,
            ...scopeIssue,
            message: `Choice "${ev.choice?.key}" carries an unsupported topology-edit payload`,
          });
          break;
        }
        // Skip no-ops (the selection matches the component's current state) so
        // an untouched draft never carries a topologyOverride.
        if (edit.op === "set-sash-kind" && ev.component.kind === edit.kind) break;
        // "Mechanical" is offered because the reference offers it, but no
        // production document gives its deduction — the engine cuts it as
        // welded and says so on the work order (Spec/questions.md Q22).
        if (edit.op === "set-divider" && edit.jointMethod === "mechanical") {
          issues.push({
            severity: "warning",
            kind: "not-implemented",
            optionKey: ev.option.key,
            ...scopeIssue,
            message:
              `${ev.component.label}: a mechanical joint has no calibrated deduction, so this ` +
              "divider is cut as welded (questions.md Q22).",
          });
        }
        if (
          edit.op === "convert-component" &&
          ((edit.to === "sash" && ev.component.type === "sash") ||
            ((edit.to === "glass" || edit.to === "panel") && ev.component.type === "glass"))
        ) {
          break;
        }
        try {
          const geometry = solveTopology({ ...design, topology: working }, widthMm, heightMm, system);
          working = adapterImpl.applyEdit(working, edit, { widthMm, heightMm, geometry, system });
          topologyEdited = true;
          structuralEdit = true;
        } catch (err) {
          issues.push({
            severity: "error",
            kind: "topology-edit-failed",
            optionKey: ev.option.key,
            ...scopeIssue,
            message: `${ev.option.name}: ${(err as Error).message}`,
          });
        }
        break;
      }

      case "bom-line": {
        if (!partKey) break;
        const qty = Number(effect.params?.qty ?? 1);
        (effects.bomLines ??= []).push({ partKey, qty: Number.isFinite(qty) && qty > 0 ? qty : 1 });
        break;
      }
    }
  }

  return { working, topologyEdited, structuralEdit };
}

/**
 * "L/H handle on a right-hung sash" and the mirror case, or undefined when
 * there is nothing to say. The hand is read from the SUPPLIER'S OWN naming
 * convention in the part label; a label carrying neither marker is unhanded
 * and never warned about.
 */
function handMismatch(componentKind: string | undefined, label: string): string | undefined {
  const wantsLeft = componentKind === "casement-side-left" || componentKind === "door-left";
  const wantsRight = componentKind === "casement-side-right" || componentKind === "door-right";
  if (!wantsLeft && !wantsRight) return undefined; // top-hung / fixed ⇒ no hand
  const isLeft = /\bL\/H\b/i.test(label);
  const isRight = /\bR\/H\b/i.test(label);
  if (!isLeft && !isRight) return undefined; // unhanded part
  if (wantsLeft && isRight) return `"${label}" is right-handed, but this leaf is hinged left`;
  if (wantsRight && isLeft) return `"${label}" is left-handed, but this leaf is hinged right`;
  return undefined;
}

/** Build the concrete TopologyEdit a selection's engineEffect params describe. */
function topologyEditFromParams(
  params: Readonly<Record<string, string | number | boolean>>,
  component: ComponentRef,
): TopologyEdit | undefined {
  const cellId = `cell:${component.path}`; // selections may target …/glass — edits act on the cell
  if (params.op === "set-sash-kind" && typeof params.sashKind === "string") {
    return { op: "set-sash-kind", componentId: cellId, kind: params.sashKind as SashKind };
  }
  if (params.op === "convert-component" && typeof params.to === "string") {
    return {
      op: "convert-component",
      componentId: cellId,
      to: params.to as ComponentType,
      ...(typeof params.kind === "string" ? { kind: params.kind as SashKind } : {}),
    };
  }
  // Per-divider profile / joint method. `dividerKey` rides on the choice's own
  // partKey, so the actual profile is resolved by the caller and passed in.
  if (params.op === "set-divider") {
    return {
      op: "set-divider",
      componentId: `divider:${component.path}`,
      ...(typeof params.dividerKey === "string" ? { dividerKey: params.dividerKey } : {}),
      ...(params.jointMethod === "welded" || params.jointMethod === "mechanical"
        ? { jointMethod: params.jointMethod }
        : {}),
    };
  }
  return undefined;
}

// ---------------------------------------------------------------------
// bom-line post-processing (pure engine functions, no engine change)
// ---------------------------------------------------------------------

function appendBomLines(
  output: QuoteOutput,
  lines: { partKey: string; qty: number }[],
  system: ProfileSystem,
  snapshot: CatalogSnapshot,
  issues: LineItemIssue[],
): QuoteOutput {
  const extras = [];
  for (const l of lines) {
    const hw = system.hardware[l.partKey];
    if (!hw) {
      // bom-line supports catalog HARDWARE parts (a plain part × qty). Other
      // tables have per-metre/per-m² semantics that need a length/area rule.
      issues.push({
        severity: "error",
        kind: "invalid-value",
        message: `bom-line part "${l.partKey}" is not a catalog hardware part`,
      });
      continue;
    }
    extras.push({ code: hw.code, name: hw.name, qty: l.qty, why: "designer bom-line" });
  }
  if (!extras.length) return output;

  const parts = { ...output.parts, hardware: [...output.parts.hardware, ...extras] };
  const geometry: SolvedGeometry = {
    outer: output.geometry.outer,
    rootDaylight: output.geometry.outer, // labour counting reads only `cells`
    cells: output.geometry.cells,
    transoms: output.geometry.transoms,
    mullions: output.geometry.mullions,
  };
  const cuttingPlan = planCuts(parts, system);
  const pricing = computePricing(parts, cuttingPlan, geometry, system, snapshot.settings);
  return { ...output, parts, cuttingPlan, pricing };
}

// ---------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------

/**
 * QuoteOutput.geometry drops `rootDaylight`; rebuild the full SolvedGeometry
 * shape from the effective frame's face width (the same inset solveTopology
 * applies) so listComponents/checkSizeLimits can run on the solved result.
 */
function reconstructGeometry(
  output: QuoteOutput,
  design: Design,
  system: ProfileSystem,
  frameKeyOverride: string | undefined,
): SolvedGeometry {
  const frame = system.frames[frameKeyOverride ?? design.frameKey];
  const face = frame?.faceWidth ?? 0;
  const { outer } = output.geometry;
  return {
    outer,
    rootDaylight: { x: face, y: face, w: outer.w - 2 * face, h: outer.h - 2 * face },
    cells: output.geometry.cells,
    transoms: output.geometry.transoms,
    mullions: output.geometry.mullions,
    ...(output.geometry.cill ? { cill: output.geometry.cill } : {}),
  };
}

function evaluateConstraints(
  constraints: FamilyConstraint[],
  components: ComponentRef[],
  item: RuleContext["item"],
  selectionCtx: Record<string, SelectionValue>,
  issues: LineItemIssue[],
): void {
  for (const c of constraints) {
    const targets: (ComponentRef | undefined)[] = c.when?.componentType
      ? components.filter(
          (comp) =>
            comp.type === c.when!.componentType &&
            (!c.when!.componentKind || comp.kind === c.when!.componentKind),
        )
      : [undefined];

    for (const target of targets) {
      const ctx: RuleContext = {
        item,
        selection: selectionCtx,
        ...(target
          ? {
              component: {
                type: target.type,
                ...(target.kind ? { kind: target.kind } : {}),
                widthMm: target.rect.w,
                heightMm: target.rect.h,
                areaM2: (target.rect.w * target.rect.h) / 1e6,
              },
            }
          : {}),
      };
      try {
        if (!evalRule(c.assert, ctx)) {
          issues.push({
            severity: c.severity,
            kind: "constraint",
            constraintId: c.id,
            ...(target ? { scope: target.componentId } : {}),
            message: c.message,
            source: c.source,
          });
        }
      } catch (err) {
        if (!(err instanceof RuleError)) throw err;
        issues.push({
          severity: "error",
          kind: "constraint",
          constraintId: c.id,
          message: `Constraint "${c.id}" could not be evaluated: ${err.message}`,
          source: c.source,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------

function buildSummary(
  draft: LineItemDraft,
  output: QuoteOutput,
  system: ProfileSystem,
  effective: EffectiveSelection[],
  optionSystem: OptionSystem,
): ResolvedSummary {
  const colourName = (key: string | undefined) => (key ? system.colours?.[key]?.name : undefined);
  const inside = effective.find(
    (e) => e.choice?.engineEffect?.kind === "colour-key" && e.choice.engineEffect.params?.side === "inside",
  );
  const outside = effective.find(
    (e) => e.choice?.engineEffect?.kind === "colour-key" && e.choice.engineEffect.params?.side === "outside",
  );
  const inName = colourName(inside?.choice?.partKey);
  const outName = colourName(outside?.choice?.partKey);
  const colourLabel =
    inName && outName && inName !== outName
      ? `${inName} (in) / ${outName} (out)`
      : (inName ?? outName);

  const location = effective.find((e) => e.option.key === "placement.location")?.value;

  return {
    sizeLabel: `${draft.dimensions.widthMm} x ${draft.dimensions.heightMm}`,
    ...(((): { mainOptions?: DocOption[] } => {
      const rows = mainOptionRows(effective, optionSystem);
      return rows.length ? { mainOptions: rows } : {};
    })()),
    ...(colourLabel ? { colourLabel } : {}),
    ...(typeof location === "string" && location ? { locationLabel: location } : {}),
    leafCount: output.geometry.cells.length,
    glassSizes: output.geometry.cells.map((c) => ({
      componentId: c.sashOuter ? `cell:${c.pathId}/glass` : `cell:${c.pathId}`,
      wMm: round1(c.glassRect.w),
      hMm: round1(c.glassRect.h),
    })),
  };
}

/**
 * The Work Order's "Main Options" rows, from the already-resolved selections.
 *
 * Grouped by option so one option is one label. When the SAME option was
 * answered differently on different components, every distinct value is listed
 * with the components that carry it — printing just the first would tell the
 * shop floor something untrue about the rest of the unit.
 *
 * "unset" answers are skipped (the reference prints only what was chosen), as
 * are options the seed marks `omitFromDocuments`.
 */
function mainOptionRows(effective: EffectiveSelection[], optionSystem: OptionSystem): DocOption[] {
  // Printed in the inspector's own reading order: group order, then option
  // order within the group — the same sequence the reference work order uses.
  const groupOrder = new Map(optionSystem.groups.map((g) => [g.key, g.order]));
  const byOption = new Map<
    string,
    { name: string; group: number; order: number; values: Map<string, string[]> }
  >();
  for (const e of effective) {
    if (e.source === "unset") continue;
    if (e.option.presentation?.omitFromDocuments) continue;
    const text =
      e.choice?.label ?? (e.value === undefined || e.value === "" ? undefined : String(e.value));
    if (!text) continue;
    const entry = byOption.get(e.option.key) ?? {
      name: e.option.name,
      group: groupOrder.get(e.option.groupKey) ?? Number.MAX_SAFE_INTEGER,
      order: e.option.order,
      values: new Map<string, string[]>(),
    };
    const where = entry.values.get(text) ?? [];
    if (e.component) where.push(e.component.label);
    entry.values.set(text, where);
    byOption.set(e.option.key, entry);
  }

  return [...byOption.values()]
    .sort((a, b) => a.group - b.group || a.order - b.order || a.name.localeCompare(b.name))
    .map(({ name, values }) => ({
      label: name,
      value:
        values.size === 1
          ? [...values.keys()][0]
          : [...values.entries()]
              .map(([text, where]) => (where.length ? `${text} (${where.join(", ")})` : text))
              .join("; "),
    }));
}

function assemble(
  snapshot: CatalogSnapshot,
  issues: LineItemIssue[],
  output: QuoteOutput | undefined,
  summary: ResolvedSummary | undefined,
  partial?: Partial<ResolvedLineItem>,
  components?: ComponentRef[],
): ResolvedLineItem {
  const dimensionKinds = new Set(["missing-dimension", "dimension-out-of-range"]);
  const invalidDimensions = issues.some((i) => i.severity === "error" && dimensionKinds.has(i.kind));
  const invalidSpec = issues.some((i) => i.severity === "error");
  return {
    resolvedAt: new Date().toISOString(),
    catalogVersion: snapshot.catalogVersion,
    issues,
    invalidDimensions,
    invalidSpec,
    blocking: issues.some(isBlockingIssue),
    ...(output ? { pricing: output.pricing } : {}),
    ...(summary ? { summary } : {}),
    // Only the variants the request asked for (svgViews is absent otherwise).
    ...(output
      ? { geometrySvg: { external: output.geometry.svg, ...(output.geometry.svgViews ?? {}) } }
      : {}),
    // Solved rects for the designer canvas (drag handles / hit-testing), with
    // the SVG stripped — geometrySvg.external already carries that markup.
    ...(output ? { geometry: geometryRects(output) } : {}),
    // Addressable components of the SOLVED geometry (phase 4 hit-testing).
    ...(components ? { components } : {}),
    ...partial,
  };
}

/** The engine's solved geometry without its `svg` string (see ResolvedLineItem). */
function geometryRects(output: QuoteOutput): Omit<QuoteOutput["geometry"], "svg"> {
  const { svg: _svg, ...rects } = output.geometry;
  return rects;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
