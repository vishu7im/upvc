// =====================================================================
// designer/select.ts — effective-value computation for scoped selections.
//
//   Spec/00-architecture/option-schema.md §7 (resolution semantics):
//
//   1. Effective value = the most specific applicable selection:
//      scoped-to-this-component > "all-of-type" > item-level > isDefault > unset
//   2. Unset + required (and visible) ⇒ error Issue "missing-selection"
//   3. Hidden-by-visibility options are skipped entirely (no issue even if
//      required)
//   4. Conflicts are impossible by construction of rule 1 (one winner per
//      (option, component)); the resolver asserts the engine-slot variant.
//
// PURE: operates on the option system + draft selections + component list.
// No I/O, no engine import. Unit-tested via resolve.test.ts#validateDesigner.
// =====================================================================

import { RuleError, evalRule } from "./rules.ts";
import type {
  OptionChoice,
  OptionDef,
  OptionSystem,
  RuleContext,
  SelectionValue,
} from "./option-types.ts";
import type { ComponentRef, DraftSelection, LineItemIssue } from "./line-item-types.ts";

export type OptionWithChoices = OptionDef & { choices: OptionChoice[] };

/** One resolved answer: an option's effective value for one component (or the item). */
export interface EffectiveSelection {
  option: OptionWithChoices;
  /** Set for component-level options; absent for item-level answers. */
  component?: ComponentRef;
  /** Where the value came from (precedence rung). */
  source: "component" | "all-of-type" | "item" | "default" | "unset";
  choice?: OptionChoice;
  value?: string | number | boolean;
}

export interface SelectionResolution {
  effective: EffectiveSelection[];
  issues: LineItemIssue[];
  /** Item-level answers (incl. defaults) — the `selection.*` rule operands. */
  selectionCtx: Record<string, SelectionValue>;
}

interface ResolveSelectionsArgs {
  optionSystem: OptionSystem;
  selections: DraftSelection[];
  components: ComponentRef[];
  /** item.* operand values for visibility rules. */
  item: RuleContext["item"];
}

/** Flatten an OptionSystem to its options. */
export function allOptions(optionSystem: OptionSystem): OptionWithChoices[] {
  return optionSystem.groups.flatMap((g) => g.options);
}

function componentCtx(c: ComponentRef): NonNullable<RuleContext["component"]> {
  return {
    type: c.type,
    ...(c.kind ? { kind: c.kind } : {}),
    widthMm: c.rect.w,
    heightMm: c.rect.h,
    areaM2: (c.rect.w * c.rect.h) / 1e6,
  };
}

export function resolveSelections(args: ResolveSelectionsArgs): SelectionResolution {
  const { optionSystem, selections, components, item } = args;
  const options = allOptions(optionSystem);
  const byKey = new Map(options.map((o) => [o.key, o]));
  const issues: LineItemIssue[] = [];
  const effective: EffectiveSelection[] = [];

  // ---- draft sanity: every selection must reference a known option ----
  for (const s of selections) {
    const option = byKey.get(s.optionKey);
    if (!option) {
      issues.push({
        severity: "error",
        kind: "unknown-option",
        optionKey: s.optionKey,
        message: `Unknown option "${s.optionKey}"`,
      });
      continue;
    }
    if (s.choiceKey && !option.choices.some((c) => c.key === s.choiceKey)) {
      issues.push({
        severity: "error",
        kind: "unknown-choice",
        optionKey: s.optionKey,
        message: `Unknown choice "${s.choiceKey}" for option "${s.optionKey}"`,
      });
    }
    if (s.scope && !s.scope.endsWith(":*") && !components.some((c) => c.componentId === s.scope)) {
      issues.push({
        severity: "error",
        kind: "unknown-component",
        optionKey: s.optionKey,
        scope: s.scope,
        message: `Selection for "${s.optionKey}" targets unknown component "${s.scope}"`,
      });
    }
  }

  // ---- item-level answer map for `selection.<optionKey>` rule operands ----
  // (item-level winners incl. defaults; component-scoped answers are not
  // addressable from the flat map — rules needing them are a later phase.)
  const selectionCtx: Record<string, SelectionValue> = {};
  for (const option of options) {
    const picked = pickForItem(option, selections);
    if (picked) selectionCtx[option.key] = picked.choice?.key ?? picked.value;
  }

  const baseCtx: RuleContext = { item, selection: selectionCtx };

  // ---- per-option resolution ------------------------------------------
  for (const option of options) {
    if (option.display === "action") continue; // actions never hold a value

    if (option.scope.level === "item") {
      if (!visible(option, baseCtx, issues)) continue;
      const picked = pickForItem(option, selections) ?? { source: "unset" as const };
      finishOne(option, undefined, picked, baseCtx, effective, issues);
    } else {
      const types = new Set(option.scope.componentTypes ?? []);
      for (const component of components) {
        if (!types.has(component.type)) continue;
        const ctx: RuleContext = { ...baseCtx, component: componentCtx(component) };
        if (!visible(option, ctx, issues)) continue;
        const picked = pickForComponent(option, selections, component) ?? { source: "unset" as const };
        finishOne(option, component, picked, ctx, effective, issues);
      }
    }
  }

  return { effective, issues, selectionCtx };
}

// ---------------------------------------------------------------------
// Precedence rungs
// ---------------------------------------------------------------------

interface Picked {
  source: EffectiveSelection["source"];
  choice?: OptionChoice;
  value?: string | number | boolean;
}

function fromSelection(option: OptionWithChoices, s: DraftSelection, source: Picked["source"]): Picked | undefined {
  if (s.choiceKey !== undefined) {
    const choice = option.choices.find((c) => c.key === s.choiceKey);
    return choice ? { source, choice } : undefined; // unknown choice already reported
  }
  if (s.value !== undefined) return { source, value: s.value };
  return undefined;
}

function defaultPick(option: OptionWithChoices): Picked | undefined {
  const def = option.choices.find((c) => c.isDefault);
  return def ? { source: "default", choice: def } : undefined;
}

function pickForItem(option: OptionWithChoices, selections: DraftSelection[]): Picked | undefined {
  const s = selections.find((x) => x.optionKey === option.key && !x.scope);
  return (s && fromSelection(option, s, "item")) ?? defaultPick(option);
}

function pickForComponent(
  option: OptionWithChoices,
  selections: DraftSelection[],
  component: ComponentRef,
): Picked | undefined {
  // 1. scoped to THIS component
  const direct = selections.find((x) => x.optionKey === option.key && x.scope === component.componentId);
  const fromDirect = direct && fromSelection(option, direct, "component");
  if (fromDirect) return fromDirect;
  // 2. "all of type"
  const allOf = selections.find((x) => x.optionKey === option.key && x.scope === `${component.type}:*`);
  const fromAll = allOf && fromSelection(option, allOf, "all-of-type");
  if (fromAll) return fromAll;
  // 3. item-level answer applied to every component in scope
  const itemLevel = selections.find((x) => x.optionKey === option.key && !x.scope);
  const fromItem = itemLevel && fromSelection(option, itemLevel, "item");
  if (fromItem) return fromItem;
  // 4. default choice
  return defaultPick(option);
}

// ---------------------------------------------------------------------
// Visibility + validation + required
// ---------------------------------------------------------------------

/** Rule evaluation is fail-loud: a malformed rule becomes an ERROR issue, never a silent false. */
function visible(option: OptionWithChoices, ctx: RuleContext, issues: LineItemIssue[]): boolean {
  if (!option.visibility) return true;
  try {
    return evalRule(option.visibility, ctx);
  } catch (err) {
    if (err instanceof RuleError) {
      issues.push({
        severity: "error",
        kind: "invalid-value",
        optionKey: option.key,
        message: `Visibility rule failed for "${option.key}": ${err.message}`,
      });
      return false;
    }
    throw err;
  }
}

function finishOne(
  option: OptionWithChoices,
  component: ComponentRef | undefined,
  picked: Picked,
  ctx: RuleContext,
  effective: EffectiveSelection[],
  issues: LineItemIssue[],
): void {
  const scope = component?.componentId;

  if (picked.source === "unset" || (picked.choice === undefined && picked.value === undefined)) {
    if (option.required) {
      issues.push({
        severity: "error",
        kind: "missing-selection",
        optionKey: option.key,
        ...(scope ? { scope } : {}),
        message: `${option.name} not selected${component ? ` for ${component.label}` : ""}`,
      });
    }
    effective.push({ option, ...(component ? { component } : {}), source: "unset" });
    return;
  }

  // A selected choice hidden by ITS OWN visibility rule is an invalid answer.
  if (picked.choice?.visibility) {
    try {
      if (!evalRule(picked.choice.visibility, ctx)) {
        issues.push({
          severity: "error",
          kind: "invalid-value",
          optionKey: option.key,
          ...(scope ? { scope } : {}),
          message: `Choice "${picked.choice.key}" is not available here`,
        });
      }
    } catch (err) {
      if (!(err instanceof RuleError)) throw err;
      issues.push({
        severity: "error",
        kind: "invalid-value",
        optionKey: option.key,
        message: `Choice visibility rule failed for "${picked.choice.key}": ${err.message}`,
      });
    }
  }

  // Raw-value validation (text/number options).
  if (picked.value !== undefined && option.validation) {
    const v = option.validation;
    const fail = (msg: string) =>
      issues.push({
        severity: "error",
        kind: "invalid-value",
        optionKey: option.key,
        ...(scope ? { scope } : {}),
        message: `${option.name}: ${msg}`,
      });
    if (typeof picked.value === "string") {
      if (v.maxLength !== undefined && picked.value.length > v.maxLength) {
        fail(`text exceeds ${v.maxLength} characters`);
      }
      if (v.regex) {
        try {
          if (!new RegExp(v.regex).test(picked.value)) fail(`does not match the required format`);
        } catch {
          fail(`option has an invalid validation regex`);
        }
      }
    }
    if (typeof picked.value === "number") {
      if (v.min !== undefined && picked.value < v.min) fail(`must be ≥ ${v.min}`);
      if (v.max !== undefined && picked.value > v.max) fail(`must be ≤ ${v.max}`);
    }
  }

  effective.push({
    option,
    ...(component ? { component } : {}),
    source: picked.source,
    ...(picked.choice ? { choice: picked.choice } : {}),
    ...(picked.value !== undefined ? { value: picked.value } : {}),
  });
}
