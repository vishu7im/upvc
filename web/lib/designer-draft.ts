// =====================================================================
// Pure draft helpers for the Designer workspace (D3 + D4).
//
// The workspace keeps ONE LineItemDraft in a reducer; these functions are the
// only place that knows how a draft is shaped, so the reducer, the option
// controls and the structure tab agree on what "the current answer" means. No
// React, no fetch — everything here is a pure transform, which keeps the
// reducer trivially testable and the controls dumb.
//
// The precedence implemented here MIRRORS the server's resolver
// (src/designer/select.ts, option-schema.md §7):
//
//   scoped-to-this-component > "<type>:*" all-of-type > item-level >
//   isDefault > unset
//
// The UI computes it only to render honestly (which rung answered, what a
// reset falls back to); the server remains the authority.
// =====================================================================

import type {
  ApplyScope,
  ComponentRef,
  DesignerComponentType,
  DraftSelection,
  DraftTopologyEdit,
  FamilyDescriptor,
  LineItemDraft,
  LineItemIssue,
  OptionDef,
  OptionChoice,
  OptionGroupWithOptions,
  TopologyEdit,
} from "./types";

export const LINE_ITEM_SCHEMA_VERSION = 1;

/**
 * Issue kinds that record a fabrication JUDGEMENT rather than a broken item:
 * printed maxima the job knowingly goes past. They never stop a confirm — they
 * print on the work order instead. Mirrors `ADVISORY_ISSUE_KINDS` in
 * `src/designer/line-item-types.ts`, which stays the authority; this copy only
 * lets the inspector label an issue honestly before the server sees it.
 */
const ADVISORY_ISSUE_KINDS = new Set([
  "constraint",
  "size-limit",
  "dimension-out-of-range",
]);

/** Does this issue stop the order being confirmed? */
export function isAdvisoryIssue(issue: { kind: string }): boolean {
  return ADVISORY_ISSUE_KINDS.has(issue.kind);
}

// ---------------------------------------------------------------------
// Selections
// ---------------------------------------------------------------------

/** Uniqueness key of a selection = (optionKey, scope) — line-item-schema.md §2. */
function sameSlot(a: DraftSelection, optionKey: string, scope?: string): boolean {
  return a.optionKey === optionKey && (a.scope ?? undefined) === (scope ?? undefined);
}

export function selectionFor(
  draft: LineItemDraft,
  optionKey: string,
  scope?: string,
): DraftSelection | undefined {
  return draft.selections?.find((s) => sameSlot(s, optionKey, scope));
}

/** Replace (or append) one scoped answer; returns a NEW draft. */
export function setSelection(draft: LineItemDraft, next: DraftSelection): LineItemDraft {
  const rest = (draft.selections ?? []).filter((s) => !sameSlot(s, next.optionKey, next.scope));
  return { ...draft, selections: [...rest, next] };
}

/** Drop one scoped answer (⇒ the option falls back down the precedence ladder). */
export function clearSelection(
  draft: LineItemDraft,
  optionKey: string,
  scope?: string,
): LineItemDraft {
  const selections = (draft.selections ?? []).filter((s) => !sameSlot(s, optionKey, scope));
  return { ...draft, selections };
}

export function defaultChoice(option: OptionDef): OptionChoice | undefined {
  return option.choices.find((c) => c.isDefault);
}

/** Which precedence rung produced the current answer (server rung names). */
export type AnswerSource = "component" | "all-of-type" | "item" | "default" | "unset";

export interface EffectiveAnswer {
  source: AnswerSource;
  choice?: OptionChoice;
  value?: string | number | boolean;
  /** The selection scope that won — undefined for item-level and defaults. */
  scope?: string;
}

/** The user picked this, at some rung (as opposed to inheriting a seed default). */
export function isAnswered(answer: EffectiveAnswer): boolean {
  return answer.source === "component" || answer.source === "all-of-type" || answer.source === "item";
}

function fromSelection(
  option: OptionDef,
  sel: DraftSelection,
  source: AnswerSource,
): EffectiveAnswer | undefined {
  if (sel.choiceKey !== undefined) {
    const choice = option.choices.find((c) => c.key === sel.choiceKey);
    return choice ? { source, choice, scope: sel.scope } : undefined;
  }
  if (sel.value !== undefined) return { source, value: sel.value, scope: sel.scope };
  return undefined;
}

/**
 * What this option currently answers — for the item, or for one component when
 * `component` is given (then the full ladder above applies).
 */
export function effectiveAnswer(
  draft: LineItemDraft,
  option: OptionDef,
  component?: ComponentRef,
): EffectiveAnswer {
  const sels = draft.selections ?? [];
  if (component) {
    const direct = sels.find((s) => s.optionKey === option.key && s.scope === component.componentId);
    const fromDirect = direct && fromSelection(option, direct, "component");
    if (fromDirect) return fromDirect;
    const allOf = sels.find((s) => s.optionKey === option.key && s.scope === `${component.type}:*`);
    const fromAll = allOf && fromSelection(option, allOf, "all-of-type");
    if (fromAll) return fromAll;
  }
  const itemLevel = sels.find((s) => s.optionKey === option.key && !s.scope);
  const fromItem = itemLevel && fromSelection(option, itemLevel, "item");
  if (fromItem) return fromItem;

  const def = defaultChoice(option);
  if (def) return { source: "default", choice: def };
  return { source: "unset" };
}

/** Human-readable current value — used by collapsed-group summary chips. */
export function answerLabel(answer: EffectiveAnswer): string | undefined {
  if (answer.choice) return answer.choice.label;
  if (answer.value !== undefined && answer.value !== "") return String(answer.value);
  return undefined;
}

// ---------------------------------------------------------------------
// Apply scopes (phase 4)
// ---------------------------------------------------------------------

/** The apply-scopes an option offers; the FIRST is its declared default. */
export function applyScopesFor(option: OptionDef): ApplyScope[] {
  const declared = option.scope.applyScopes;
  return declared && declared.length ? declared : ["this"];
}

/** The selection scope one apply-scope writes for a given component. */
export function scopeKeyFor(component: ComponentRef, apply: ApplyScope): string {
  return apply === "all-of-type" ? `${component.type}:*` : component.componentId;
}

/**
 * Which apply-scope the current answer came through, so the toggle can show it
 * without a second source of truth. An inherited answer shows the option's
 * declared default.
 */
export function activeApplyScope(answer: EffectiveAnswer, option: OptionDef): ApplyScope {
  if (answer.source === "component") return "this";
  if (answer.source === "all-of-type") return "all-of-type";
  return applyScopesFor(option)[0];
}

// ---------------------------------------------------------------------
// Which options are answerable where
// ---------------------------------------------------------------------

/**
 * ITEM-scope answerability (no component selected). Two kinds qualify:
 *
 *  - `scope.level === "item"` — one answer per line item, by definition.
 *  - `scope.level === "component"` whose DECLARED DEFAULT apply-scope is
 *    "all-of-type" (`applyScopes[0]`). The option system says such an option is
 *    normally answered once for every component of its type (glass type, handle),
 *    so an item-wide control is the option's own intent. It writes an UNSCOPED
 *    selection, which the server applies to every component in scope (select.ts
 *    rung 3) — and a component-scoped answer overrides it.
 *
 * Everything else is genuinely per-part: it appears once a component is
 * selected on the canvas (or in the Structure tree).
 */
export function isItemAnswerable(option: OptionDef): boolean {
  if (option.display === "action") return false;
  if (option.scope.level === "item") return true;
  return option.scope.applyScopes?.[0] === "all-of-type";
}

/** True when an item-answerable option covers every component of a type. */
export function appliesToAllOfType(option: OptionDef): boolean {
  return option.scope.level === "component";
}

/** Does this option hold a value for the given component? (not an action) */
export function optionAppliesTo(option: OptionDef, component: ComponentRef): boolean {
  if (option.display === "action") return false;
  if (option.scope.level !== "component") return false;
  return (option.scope.componentTypes ?? []).includes(component.type);
}

/** The instant actions (display "action") this component accepts. */
export function actionOptionsFor(
  groups: OptionGroupWithOptions[],
  component: ComponentRef | null,
): OptionDef[] {
  if (!component) return [];
  return groups
    .flatMap((g) => g.options)
    .filter(
      (o) =>
        o.display === "action" &&
        o.scope.level === "component" &&
        (o.scope.componentTypes ?? []).includes(component.type),
    )
    .sort((a, b) => a.order - b.order);
}

/**
 * The free-text "where does this unit go" field, hoisted out of the Options tab
 * into Measurements (ux-design-language.md §2). Identified STRUCTURALLY — an
 * item-level text option carrying a suggestion list — so no option key is
 * hardcoded in the UI and a second family gets the same treatment for free.
 */
export function isLocationOption(option: OptionDef): boolean {
  return (
    option.display === "text" &&
    option.scope.level === "item" &&
    (option.presentation?.suggestions?.length ?? 0) > 0
  );
}

export interface GroupPartition {
  group: OptionGroupWithOptions;
  /** Options rendered in the CURRENT scope, in seed order. */
  answerable: OptionDef[];
  /** Per-part options not answerable in this scope (the hint chip). */
  perComponentCount: number;
}

/**
 * Split a group's options into what the current scope renders and what it
 * defers. With `component`, the scope is that component; without it, the item.
 */
export function partitionGroup(
  group: OptionGroupWithOptions,
  opts: { component?: ComponentRef | null; exclude?: (option: OptionDef) => boolean } = {},
): GroupPartition {
  const { component, exclude = () => false } = opts;
  const answerable: OptionDef[] = [];
  let perComponentCount = 0;
  for (const option of [...group.options].sort((a, b) => a.order - b.order)) {
    if (exclude(option)) continue;
    const shown = component ? optionAppliesTo(option, component) : isItemAnswerable(option);
    if (shown) answerable.push(option);
    else if (option.scope.level === "component" && !component) perComponentCount += 1;
  }
  return { group, answerable, perComponentCount };
}

// ---------------------------------------------------------------------
// Component-scope pruning (phase 4)
// ---------------------------------------------------------------------

/**
 * Drop selections whose component no longer exists. A structural edit can
 * delete the very component an answer was scoped to (convert a sash back to
 * glass, remove a divider, re-split a cell); leaving that answer behind makes
 * the resolver report `unknown-component` errors forever on an item the user
 * cannot see a problem with.
 *
 * The rule is deliberately narrow: prune ONLY selections whose scope is a
 * concrete componentId that is absent from the solved component list. Unscoped
 * answers and `<type>:*` answers are never pruned — they are not attached to a
 * component, and a component added later is meant to inherit them.
 */
export function pruneSelections(draft: LineItemDraft, components: ComponentRef[]): LineItemDraft {
  const selections = draft.selections ?? [];
  if (!selections.length || !components.length) return draft;
  const live = new Set(components.map((c) => c.componentId));
  const kept = selections.filter((s) => !s.scope || s.scope.endsWith(":*") || live.has(s.scope));
  return kept.length === selections.length ? draft : { ...draft, selections: kept };
}

// ---------------------------------------------------------------------
// Topology edits (phase 4)
// ---------------------------------------------------------------------

let editCounter = 0;

/** Local id for an edit so the history list can remove a specific one. */
export function newEditId(): string {
  editCounter += 1;
  return `e${Date.now().toString(36)}${editCounter}`;
}

/** Legal component-type conversions for a component, per the family descriptor. */
export function conversionTargets(
  descriptor: FamilyDescriptor,
  component: ComponentRef,
): DesignerComponentType[] {
  return descriptor.componentConversions?.find((c) => c.from === component.type)?.to ?? [];
}

/** One-line description of an edit for the history list. */
export function describeEdit(edit: TopologyEdit, label?: string): string {
  const target = label ?? edit.componentId;
  switch (edit.op) {
    case "split":
      return `${edit.axis === "horizontal" ? "Add transom" : "Add mullion"} in ${target}${
        edit.position === "at-ratio" ? " (at position)" : ""
      }`;
    case "add-midrail":
      return `Add midrail in ${target}`;
    case "convert-component":
      return `Convert ${target} to ${edit.to}`;
    case "set-sash-kind":
      return `Set ${target} to ${edit.kind}`;
    case "remove-divider":
      return `Remove ${target}`;
  }
}

/** Append an edit to a draft's history (the reducer's only edit writer). */
export function appendEdit(draft: LineItemDraft, edit: TopologyEdit): LineItemDraft {
  const next: DraftTopologyEdit = { id: newEditId(), edit };
  return { ...draft, topologyEdits: [...(draft.topologyEdits ?? []), next] };
}

/** Remove one edit and replay the rest (order preserved — the resolver replays). */
export function removeEdit(draft: LineItemDraft, editId: string): LineItemDraft {
  return { ...draft, topologyEdits: (draft.topologyEdits ?? []).filter((e) => e.id !== editId) };
}

// ---------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------

/** Does an option match the search box (its own name, or any choice label)? */
export function optionMatches(option: OptionDef, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (option.name.toLowerCase().includes(q)) return true;
  return option.choices.some((c) => c.label.toLowerCase().includes(q));
}

// ---------------------------------------------------------------------
// Draft construction
// ---------------------------------------------------------------------

export function newDraft(args: {
  familyKey: string;
  systemId: string;
  designId: string;
  widthMm: number;
  heightMm: number;
}): LineItemDraft {
  return {
    schemaVersion: LINE_ITEM_SCHEMA_VERSION,
    familyKey: args.familyKey,
    systemId: args.systemId,
    designId: args.designId,
    quantity: 1,
    dimensions: { widthMm: args.widthMm, heightMm: args.heightMm },
  };
}

/** Issues that concern one option (any scope) — drives the attention states. */
export function issuesForOption(
  issues: { optionKey?: string; severity: "warning" | "error" }[],
  optionKey: string,
) {
  return issues.filter((i) => i.optionKey === optionKey);
}

// ---------------------------------------------------------------------
// One-click fixes for resolver issues
// ---------------------------------------------------------------------

/**
 * A fix is a reducer action plus the label to offer it under. The shapes are
 * deliberately the workspace reducer's own actions: the reducer stays the
 * ONLY writer of the draft, and a fix is just a dispatch the user did not have
 * to find themselves.
 */
export type IssueFixAction =
  | { type: "dimension"; key: string; value: number }
  | { type: "reset"; optionKey: string; scope?: string }
  | { type: "choice"; option: OptionDef; choiceKey: string; scope?: string }
  | { type: "removeEdit"; editId: string };

export interface IssueFix {
  /** Button text — says what will happen, not "Fix". */
  label: string;
  action: IssueFixAction;
}

/**
 * The fix for an issue, or null when there isn't an honest one.
 *
 * WHAT IS NOT FIXABLE, on purpose:
 *   • `constraint` / `size-limit` — the HAWDIO-cited fabrication rules (printed
 *     maximum sash sizes, weights, 1.8 m divider runs). Resizing a unit until a
 *     printed maximum is satisfied is the fabricator's call, and the printed
 *     figure is not on the client to clamp to. These stay navigate-only.
 *   • `conflicting-selection` — two answers disagree and only the user knows
 *     which one they meant.
 *   • `solve-failed` / `unknown-family|system|design` — nothing in the draft
 *     that a single edit repairs.
 *
 * Everything below repairs the DRAFT with a value that is already declared in
 * the descriptor or the option system — never a fabrication number.
 */
export function fixForIssue(
  issue: LineItemIssue,
  ctx: { draft: LineItemDraft; descriptor: FamilyDescriptor; groups: OptionGroupWithOptions[] },
): IssueFix | null {
  const { draft, descriptor, groups } = ctx;
  const option = issue.optionKey
    ? groups.flatMap((g) => g.options).find((o) => o.key === issue.optionKey)
    : undefined;

  switch (issue.kind) {
    // The allowed range is the descriptor's own declared bound, so snapping to
    // it states a limit the UI already shows beside the field.
    case "missing-dimension":
    case "dimension-out-of-range": {
      const dim = descriptor.dimensions.find((d) => d.key === issue.dimensionKey);
      if (!dim) return null;
      const current = draft.dimensions?.[dim.key];
      const value =
        typeof current === "number" && Number.isFinite(current)
          ? Math.min(dim.max, Math.max(dim.min, current))
          : dim.min;
      if (value === current) return null;
      return { label: `Set ${dim.label.toLowerCase()} to ${value} mm`, action: { type: "dimension", key: dim.key, value } };
    }

    // A structural edit the engine rejected: removing it replays the rest, so
    // undoing is exact rather than an inverse we would have to invent.
    case "topology-edit-failed":
      return issue.editId
        ? { label: "Undo this change", action: { type: "removeEdit", editId: issue.editId } }
        : null;

    // An answer pointing at something that no longer exists (or was never
    // valid). Clearing it falls back down the precedence ladder to the
    // option's own default, which is a value the seed chose.
    case "unknown-component":
    case "unknown-option":
    case "unknown-choice":
    case "invalid-value":
      return issue.optionKey
        ? {
            label: option ? `Reset ${option.name.toLowerCase()}` : "Clear this answer",
            action: { type: "reset", optionKey: issue.optionKey, ...(issue.scope ? { scope: issue.scope } : {}) },
          }
        : null;

    // Required and unanswered: apply the option's OWN default when it declares
    // one. If it doesn't, there is nothing to apply and the user must choose —
    // we never pick a value the seed didn't nominate.
    case "missing-selection": {
      const fallback = option ? defaultChoice(option) : undefined;
      if (!option || !fallback) return null;
      return {
        label: `Use ${fallback.label}`,
        action: {
          type: "choice",
          option,
          choiceKey: fallback.key,
          ...(issue.scope ? { scope: issue.scope } : {}),
        },
      };
    }

    default:
      return null;
  }
}
