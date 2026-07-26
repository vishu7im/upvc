"use client";

// =====================================================================
// Option control primitives + the dispatcher that picks one from an option's
// `display` field. NOTHING here knows any option key: a control is chosen by
// schema, labelled by schema, and its choices come from the option system —
// which is what makes "add a row to the seed, it appears in the UI" true
// (phase-3 acceptance criterion).
//
// Reused verbatim by phase 4 for component-scoped answers: the props carry a
// scope-agnostic answer + callbacks, so the caller decides whether an answer is
// written item-level or to a componentId.
// =====================================================================

import { useEffect, useRef, useState } from "react";
import { cn, fieldClass, selectClass } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { OptionChoice, OptionDef } from "@/lib/types";
import type { EffectiveAnswer } from "@/lib/designer-draft";
import { OptionRow, controlRingClass, type OptionTone } from "./option-row";

export { OptionRow, controlRingClass };
export type { OptionTone };

export interface OptionControlProps {
  option: OptionDef;
  answer: EffectiveAnswer;
  tone: OptionTone;
  onChoice: (choiceKey: string) => void;
  onValue: (value: string | number) => void;
  /**
   * Narrowed choice list. Phase 4 uses it where the SELECTION makes a choice
   * illegal — e.g. the family descriptor's `componentConversions` decide which
   * component types the selected component may convert to. Omitted ⇒ every
   * choice the option declares.
   */
  choices?: OptionChoice[];
}

/** The choices this control should offer (see OptionControlProps.choices). */
function choicesOf(props: OptionControlProps): OptionChoice[] {
  return props.choices ?? props.option.choices;
}

/** ≤4 choices render as a segmented control regardless of the declared display. */
const SEGMENTED_MAX = 4;

export function OptionControl(props: OptionControlProps) {
  const { option } = props;
  switch (option.display) {
    case "segmented":
      return <SegmentedChoices {...props} />;
    case "select-image":
      return <ImageChoices {...props} />;
    case "toggle":
      return <ToggleChoices {...props} />;
    case "number":
      return <NumberValue {...props} />;
    case "text":
      return <TextValue {...props} />;
    case "select":
    default:
      return choicesOf(props).length <= SEGMENTED_MAX ? (
        <SegmentedChoices {...props} />
      ) : (
        <SelectChoices {...props} />
      );
  }
}

// ---------------------------------------------------------------------
// Choice controls
// ---------------------------------------------------------------------

function Swatch({ choice, className }: { choice: OptionChoice; className?: string }) {
  if (!choice.swatchHex) return null;
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-3.5 w-3.5 shrink-0 rounded border border-black/15", className)}
      style={{ background: choice.swatchHex }}
    />
  );
}

export function SegmentedChoices(props: OptionControlProps) {
  const { option, answer, tone, onChoice } = props;
  return (
    <div
      role="radiogroup"
      aria-label={option.name}
      className={cn("flex flex-wrap gap-1 rounded-md border bg-slate-50 p-1", controlRingClass(tone))}
    >
      {choicesOf(props).map((c) => {
        const active = answer.choice?.key === c.key;
        return (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChoice(c.key)}
            className={cn(
              "inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4442e3]/40",
              active
                ? "bg-white text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.12)]"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900",
            )}
          >
            <Swatch choice={c} />
            <span className="truncate">{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SelectChoices(props: OptionControlProps) {
  const { option, answer, tone, onChoice } = props;
  return (
    <div className="relative">
      <select
        id={`opt-${option.key}`}
        value={answer.choice?.key ?? ""}
        onChange={(e) => onChoice(e.target.value)}
        className={cn(selectClass, "h-9 text-sm", controlRingClass(tone))}
      >
        {!answer.choice && <option value="">Not selected</option>}
        {choicesOf(props).map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevronRight"
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-slate-400"
      />
    </div>
  );
}

export function ToggleChoices(props: OptionControlProps) {
  const { option, answer, tone, onChoice } = props;
  // A toggle is a two-choice option: the schema owns both labels, so the switch
  // flips between choices[0] and choices[1] rather than inventing on/off.
  const [off, on] = choicesOf(props);
  if (!on) return <SegmentedChoices {...props} />;
  const isOn = answer.choice?.key === on.key;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={option.name}
      onClick={() => onChoice(isOn ? off.key : on.key)}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-md border bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4442e3]/40",
        controlRingClass(tone),
      )}
    >
      <span className="truncate">{(isOn ? on : off).label}</span>
      <span
        aria-hidden="true"
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition",
          isOn ? "bg-[#4442e3]" : "bg-slate-300",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
            isOn ? "left-4.5" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

/**
 * `select-image` — a grid popover with the option's own filter chips. Used for
 * long visual lists (colours: swatch + label; handles: image + label). Falls
 * back to the label alone when a choice carries neither swatch nor image, so a
 * seed without artwork still renders correctly.
 */
export function ImageChoices(props: OptionControlProps) {
  const { option, answer, tone, onChoice } = props;
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filters = option.filters ?? [];
  const all = choicesOf(props);
  const visible = filter ? all.filter((c) => c.filterKeys?.includes(filter)) : all;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={`opt-${option.key}`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-white px-2.5 text-sm text-slate-900 transition hover:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4442e3]/40",
          controlRingClass(tone),
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {answer.choice && <Swatch choice={answer.choice} className="h-4 w-4" />}
          <span className="truncate">{answer.choice?.label ?? "Not selected"}</span>
        </span>
        <Icon name="chevronRight" className="h-3.5 w-3.5 shrink-0 rotate-90 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 rounded-md border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
          {filters.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              <FilterChip active={filter === null} onClick={() => setFilter(null)} label="All" />
              {filters.map((f) => (
                <FilterChip
                  key={f.key}
                  active={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  label={f.label}
                />
              ))}
            </div>
          )}
          <ul role="listbox" aria-label={option.name} className="grid max-h-64 grid-cols-2 gap-1 overflow-y-auto">
            {visible.length === 0 && (
              <li className="col-span-2 px-2 py-3 text-xs text-slate-500">No choices match this filter.</li>
            )}
            {visible.map((c) => {
              const active = answer.choice?.key === c.key;
              return (
                <li key={c.key} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => {
                      onChoice(c.key);
                      setOpen(false);
                      triggerRef.current?.focus();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4442e3]/40",
                      active ? "bg-[#e7e6ff] text-[#4442e3]" : "text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="h-6 w-6 shrink-0 rounded border border-black/10"
                      style={{ background: c.swatchHex ?? "#e2e8f0" }}
                    />
                    <span className="truncate">{c.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4442e3]/40",
        active ? "bg-[#4442e3] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
      )}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------
// Raw-value controls
// ---------------------------------------------------------------------

export function NumberValue({ option, answer, tone, onValue }: OptionControlProps) {
  return (
    <input
      id={`opt-${option.key}`}
      type="number"
      value={answer.value === undefined ? "" : String(answer.value)}
      min={option.validation?.min}
      max={option.validation?.max}
      onChange={(e) => onValue(e.target.value === "" ? "" : Number(e.target.value))}
      className={cn(fieldClass, "h-9 font-mono text-sm", controlRingClass(tone))}
    />
  );
}

export function TextValue({ option, answer, tone, onValue }: OptionControlProps) {
  const listId = `opt-${option.key}-suggestions`;
  const suggestions = option.presentation?.suggestions ?? [];
  return (
    <>
      <input
        id={`opt-${option.key}`}
        type="text"
        list={suggestions.length ? listId : undefined}
        value={answer.value === undefined ? "" : String(answer.value)}
        maxLength={option.validation?.maxLength}
        onChange={(e) => onValue(e.target.value)}
        className={cn(fieldClass, "h-9 text-sm", controlRingClass(tone))}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </>
  );
}
