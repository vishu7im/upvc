"use client";

// =====================================================================
// Inspector · structural pieces — the parts list, the instant actions that
// apply to the current selection, and the edit history.
//
// These used to be a third tab. They are now sections INSIDE the Product tab
// (options.tsx), shown only when they have something to say: the parts list at
// item scope, the actions when a part is selected, the history only once an
// edit exists. Nothing was removed — this is the same machinery, surfaced when
// it is relevant instead of always.
//
// They remain the a11y contract: EVERY canvas interaction has an equivalent
// here (select a part, run an action, undo one), so the designer is fully
// operable without a pointer.
//
// Nothing is family-specific. The list is the resolver's `components[]`; the
// actions are whatever `display: "action"` options the option system declares
// for the selected component's type, executed by appending the option's own
// `action` template with the selection's componentId filled in. Seeding a new
// action option makes a new button appear here with no change to this file.
// =====================================================================

import { useState } from "react";
import { cn, fieldClass, labelClass } from "@/components/ui";
import { Icon } from "@/components/icons";
import type {
  ComponentRef,
  DraftTopologyEdit,
  LineItemIssue,
  OptionDef,
  TopologyEditTemplate,
} from "@/lib/types";
import { defaultChoiceKey, describeEdit } from "@/lib/designer-draft";

/** Sub-components ("cell:root.top/glass") indent under their parent. */
function isSubComponent(componentId: string): boolean {
  return componentId.includes("/");
}

// ---------------------------------------------------------------------
// Parts list
// ---------------------------------------------------------------------

export function PartsList({
  components,
  selectedComponentId,
  onSelectComponent,
  issues,
}: {
  components: ComponentRef[];
  selectedComponentId: string | null;
  onSelectComponent: (componentId: string | null) => void;
  issues: LineItemIssue[];
}) {
  if (components.length === 0) {
    return (
      <p className="px-4 pb-3 text-[11px] leading-4 text-slate-500">
        The preview has not solved yet — parts appear once it does.
      </p>
    );
  }
  return (
    <ul className="pb-2">
      {components.map((component) => {
        const active = component.componentId === selectedComponentId;
        const hasError = issues.some(
          (i) => i.scope === component.componentId && i.severity === "error",
        );
        return (
          <li key={component.componentId}>
            <button
              type="button"
              onClick={() => onSelectComponent(active ? null : component.componentId)}
              aria-pressed={active}
              className={cn(
                "flex w-full items-center gap-2 py-1.5 pr-4 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4442e3]/40",
                isSubComponent(component.componentId) ? "pl-9" : "pl-4",
                active ? "bg-[#eeedff] font-semibold text-[#4442e3]" : "text-slate-700 hover:bg-slate-50",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{component.label}</span>
              {hasError && (
                <span className="shrink-0 rounded bg-red-100 px-1 text-[10px] font-bold uppercase text-red-700">
                  !
                </span>
              )}
              <span className="shrink-0 font-mono text-[10px] text-slate-400">
                {Math.round(component.rect.w)}×{Math.round(component.rect.h)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------
// Instant actions for the current selection
// ---------------------------------------------------------------------

export function ComponentActions({
  actions,
  frameMm,
  onAction,
}: {
  actions: OptionDef[];
  /** The unit's outer size — the denominator `atRatio` is a fraction OF. */
  frameMm: { widthMm: number; heightMm: number };
  onAction: (option: OptionDef, atRatio?: number, choiceKey?: string) => void;
}) {
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((option) => (
        <ActionButton
          key={option.key}
          option={option}
          frameMm={frameMm}
          onRun={(ratio, choiceKey) => onAction(option, ratio, choiceKey)}
        />
      ))}
    </div>
  );
}

/**
 * One instant action. An action that needs a decision — an explicit position, a
 * choice of section, or both — prompts for it inline; a bare action applies
 * straight away (the divider is then draggable on the canvas like any other).
 *
 * The position prompt is in MILLIMETRES, because that is what a fabricator
 * measures — a transom drop of 400 mm, not "33%". `atRatio` is a fraction of the
 * WHOLE unit (CellSpec/splitAtRatio contract), so the conversion is a plain
 * divide by the outer dimension on the split's axis: no new geometry, and it
 * round-trips with the canvas drag handles, which write the same fraction.
 *
 * The SECTION prompt appears whenever the option carries choices — the option
 * system's way of saying "this edit has more than one profile to cut from"
 * (owner 2026-08-05: two stocked transoms, 67 mm and 78 mm). Which option that
 * is, and which sections it offers, is entirely seed data; this file names none.
 */
function ActionButton({
  option,
  frameMm,
  onRun,
}: {
  option: OptionDef;
  frameMm: { widthMm: number; heightMm: number };
  onRun: (atRatio?: number, choiceKey?: string) => void;
}) {
  const template = option.action as TopologyEditTemplate | undefined;
  const needsRatio =
    template !== undefined && "position" in template && template.position === "at-ratio";
  const choices = option.choices ?? [];
  const needsChoice = choices.length > 0;
  // A horizontal split is a DROP from the head; a vertical one is a distance
  // from the left jamb.
  const horizontal =
    template !== undefined && "axis" in template && template.axis === "horizontal";
  const span = horizontal ? frameMm.heightMm : frameMm.widthMm;
  const [mmText, setMmText] = useState(() => String(Math.round(span / 2)));
  const [choiceKey, setChoiceKey] = useState(() => defaultChoiceKey(option) ?? "");
  const [open, setOpen] = useState(false);

  const chip =
    "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-[var(--shadow-xs)] transition hover:border-[#4442e3] hover:text-[#4442e3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4442e3]/40";

  if (!needsRatio && !needsChoice) {
    return (
      <button type="button" onClick={() => onRun()} title={option.presentation?.helpText} className={chip}>
        <Icon name="plus" className="h-3 w-3 shrink-0" />
        <span className="truncate">{option.name}</span>
      </button>
    );
  }

  const apply = () => {
    let ratio: number | undefined;
    if (needsRatio) {
      const mm = Number.parseFloat(mmText);
      if (!Number.isFinite(mm) || mm <= 0 || mm >= span) return;
      ratio = mm / span;
    }
    setOpen(false);
    onRun(ratio, needsChoice ? choiceKey || undefined : undefined);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={option.presentation?.helpText}
        className={chip}
      >
        <Icon name="plus" className="h-3 w-3 shrink-0" />
        <span className="truncate">{option.name}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-[var(--shadow-lg)]">
          {needsChoice && (
            <div className="mb-2">
              <label htmlFor={`act-sec-${option.key}`} className={cn("mb-1 block", labelClass)}>
                Section
              </label>
              <select
                id={`act-sec-${option.key}`}
                value={choiceKey}
                onChange={(e) => setChoiceKey(e.target.value)}
                className={cn(fieldClass, "h-8 w-full px-2 text-sm")}
              >
                {choices.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            {needsRatio && (
              <>
                <label htmlFor={`act-${option.key}`} className={labelClass}>
                  {horizontal ? "Drop" : "From left"}
                </label>
                <input
                  id={`act-${option.key}`}
                  type="number"
                  min={1}
                  max={Math.max(1, Math.round(span) - 1)}
                  step={1}
                  value={mmText}
                  onChange={(e) => setMmText(e.target.value)}
                  className={cn(fieldClass, "h-8 w-20 px-2 font-mono text-sm")}
                />
                <span className="text-[11px] font-semibold text-slate-400">mm</span>
              </>
            )}
            <button
              type="button"
              onClick={apply}
              className="ml-auto rounded-md bg-[#4442e3] px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-[#3634c0]"
            >
              Apply
            </button>
          </div>
          {needsRatio && (
            <p className="mt-1.5 text-[10px] leading-3 text-slate-400">
              Centreline, measured from the {horizontal ? "head" : "left jamb"} of the{" "}
              {Math.round(span)} mm frame.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Edit history
// ---------------------------------------------------------------------

export function EditHistory({
  edits,
  components,
  issues,
  onRemoveEdit,
}: {
  edits: DraftTopologyEdit[];
  components: ComponentRef[];
  issues: LineItemIssue[];
  onRemoveEdit: (editId: string) => void;
}) {
  if (edits.length === 0) return null;
  return (
    <ol className="divide-y divide-slate-100">
      {edits.map((entry, i) => {
        const failure = issues.find((issue) => issue.editId === entry.id);
        // Label the target by its current name when it still exists; an edit
        // that CREATED or replaced it falls back to the stable id.
        const target = components.find((c) => c.componentId === entry.edit.componentId)?.label;
        const label = describeEdit(entry.edit, target);
        return (
          <li key={entry.id} className="flex items-start gap-2 px-4 py-2">
            <span className="mt-0.5 w-4 shrink-0 text-right font-mono text-[10px] text-slate-400">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-xs font-medium", failure ? "text-red-700" : "text-slate-800")}>
                {label}
              </p>
              {failure && <p className="mt-0.5 text-[11px] leading-4 text-red-600">{failure.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => onRemoveEdit(entry.id)}
              aria-label={`Undo: ${label}`}
              className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4442e3]/40"
            >
              <Icon name="x" className="h-3.5 w-3.5" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
