"use client";

// =====================================================================
// Inspector · Measurements tab — overall dimensions (validated inline against
// the family descriptor), the split-mode control, generated per-span inputs,
// and the location field.
//
// Nothing here is family-specific: the dimension fields come from
// `descriptor.dimensions`, the split modes from `descriptor.splitModes`, and
// the spans from the SOLVED geometry (one row per divider the engine emitted).
// Editing a span writes the same `splitRatios` fraction the canvas drag handles
// write — centreline ÷ solved frame dimension (window-designer.tsx's
// convention, which is the engine's) — so the two stay in exact round-trip.
// =====================================================================

import { useState } from "react";
import { cn, fieldClass, labelClass } from "@/components/ui";
import type {
  FamilyDescriptor,
  LineItemDraft,
  LineItemIssue,
  OptionDef,
  QuoteGeometry,
  SplitMode,
} from "@/lib/types";
import { effectiveAnswer, isAnswered } from "@/lib/designer-draft";
import { OptionControl, OptionRow, controlRingClass } from "./controls";

// Short enough to sit on one line in a three-way segmented control.
const SPLIT_MODE_LABEL: Record<SplitMode, string> = {
  byDimensions: "Manual",
  equalSplit: "Equal split",
  equalGlass: "Equal glass",
};

export interface Span {
  /** Split-node pathId — the key in QuoteInput.splitRatios. */
  pathId: string;
  orientation: "horizontal" | "vertical";
  /** Divider centreline in mm from the frame's top (h) or left (v) edge. */
  centerMm: number;
  label: string;
}

/** One editable row per divider the engine solved, in drawing order. */
export function buildSpans(geometry: Omit<QuoteGeometry, "svg"> | undefined): Span[] {
  if (!geometry) return [];
  const spans: Span[] = [];
  const transoms = [...(geometry.transoms ?? [])].sort((a, b) => a.rect.y - b.rect.y);
  const mullions = [...(geometry.mullions ?? [])].sort((a, b) => a.rect.x - b.rect.x);
  transoms.forEach((t, i) =>
    spans.push({
      pathId: t.parentPathId,
      orientation: "horizontal",
      centerMm: Math.round(t.rect.y + t.rect.h / 2),
      label: `Horizontal split ${i + 1}`,
    }),
  );
  mullions.forEach((m, i) =>
    spans.push({
      pathId: m.parentPathId,
      orientation: "vertical",
      centerMm: Math.round(m.rect.x + m.rect.w / 2),
      label: `Vertical split ${i + 1}`,
    }),
  );
  return spans;
}

export interface MeasurementsTabProps {
  descriptor: FamilyDescriptor;
  draft: LineItemDraft;
  issues: LineItemIssue[];
  geometry: Omit<QuoteGeometry, "svg"> | undefined;
  /** Split modes the resolver reported as not implemented — hidden, not offered. */
  unsupportedSplitModes: string[];
  locationOption?: OptionDef;
  onDimension: (key: string, value: number) => void;
  onSplitMode: (mode: SplitMode) => void;
  onSplitRatio: (pathId: string, ratio: number) => void;
  onLocation: (option: OptionDef, value: string) => void;
  onResetLocation: (option: OptionDef) => void;
}

export default function MeasurementsTab({
  descriptor,
  draft,
  issues,
  geometry,
  unsupportedSplitModes,
  locationOption,
  onDimension,
  onSplitMode,
  onSplitRatio,
  onLocation,
  onResetLocation,
}: MeasurementsTabProps) {
  const spans = buildSpans(geometry);
  const outer = geometry?.outer;
  const splitMode: SplitMode = draft.splitMode ?? "byDimensions";
  const modes = descriptor.splitModes.filter((m) => !unsupportedSplitModes.includes(m));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <section className="border-b border-slate-200">
        <h3 className={cn("px-4 pb-1 pt-3", labelClass)}>Dimensions</h3>
        <div className="divide-y divide-slate-100">
          {descriptor.dimensions.map((dim) => {
            const issue = issues.find((i) => i.dimensionKey === dim.key);
            return (
              <div key={dim.key} className="px-4 py-2.5">
                <label
                  htmlFor={`dim-${dim.key}`}
                  className={cn("mb-1.5 flex items-center justify-between gap-2", labelClass)}
                >
                  <span className="truncate">
                    {dim.label}
                    {dim.required && <span className="ml-1 text-amber-600">*</span>}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] normal-case text-slate-400">
                    {dim.min}–{dim.max}
                  </span>
                </label>
                <div className="relative">
                  <input
                    id={`dim-${dim.key}`}
                    type="number"
                    min={dim.min}
                    max={dim.max}
                    value={draft.dimensions[dim.key] ?? ""}
                    onChange={(e) =>
                      onDimension(dim.key, e.target.value === "" ? NaN : Number(e.target.value))
                    }
                    className={cn(
                      fieldClass,
                      "h-9 pr-10 font-mono text-sm",
                      controlRingClass(issue ? "error" : "default"),
                    )}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">
                    {dim.unit}
                  </span>
                </div>
                {dim.informational && (
                  <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
                    Recorded on the documents; it does not affect fabrication.
                  </p>
                )}
                {issue && <p className="mt-1.5 text-[11px] font-medium text-red-700">{issue.message}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {modes.length > 1 && (
        <section className="border-b border-slate-200 px-4 py-2.5">
          <span className={cn("mb-1.5 block", labelClass)}>Split position</span>
          <div role="radiogroup" aria-label="Split position" className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {modes.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={splitMode === m}
                onClick={() => onSplitMode(m)}
                className={cn(
                  "flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4442e3]/40",
                  splitMode === m
                    ? "bg-white text-slate-950 shadow-[var(--shadow-xs)]"
                    : "text-slate-600 hover:bg-white/70",
                )}
              >
                {SPLIT_MODE_LABEL[m] ?? m}
              </button>
            ))}
          </div>
          {splitMode === "equalSplit" && (
            <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
              Divider positions are recomputed for equal daylight; drag a handle to switch back to
              explicit positions.
            </p>
          )}
        </section>
      )}

      <section className="border-b border-slate-200">
        <h3 className={cn("px-4 pb-1 pt-3", labelClass)}>Spans</h3>
        {spans.length === 0 ? (
          <p className="px-4 pb-3 text-[11px] leading-4 text-slate-500">
            This design has no transom or mullion to position.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {spans.map((span) => (
              <SpanInput
                key={`${span.pathId}-${span.orientation}`}
                span={span}
                disabled={splitMode !== "byDimensions"}
                onCommit={(mm) => {
                  const dim = span.orientation === "horizontal" ? outer?.h : outer?.w;
                  if (!dim || dim <= 0) return;
                  onSplitRatio(span.pathId, Math.min(0.98, Math.max(0.02, mm / dim)));
                }}
              />
            ))}
          </div>
        )}
      </section>

      {locationOption && (
        <section>
          <h3 className={cn("px-4 pb-1 pt-3", labelClass)}>Placement</h3>
          <OptionRow
            option={locationOption}
            tone={isAnswered(effectiveAnswer(draft, locationOption)) ? "changed" : "default"}
            onReset={
              isAnswered(effectiveAnswer(draft, locationOption))
                ? () => onResetLocation(locationOption)
                : undefined
            }
          >
            <OptionControl
              option={locationOption}
              answer={effectiveAnswer(draft, locationOption)}
              tone="default"
              onChoice={() => {}}
              onValue={(v) => onLocation(locationOption, String(v))}
            />
          </OptionRow>
        </section>
      )}
    </div>
  );
}

/**
 * A span input is UNCONTROLLED between commits: the solved centreline is the
 * truth, but re-solving mid-typing would fight the caret. It seeds from the
 * solved value and commits on blur/Enter, which is also how the canvas's
 * click-to-edit dimension labels behave.
 */
function SpanInput({
  span,
  disabled,
  onCommit,
}: {
  span: Span;
  disabled: boolean;
  onCommit: (mm: number) => void;
}) {
  const [text, setText] = useState(String(span.centerMm));
  // Re-seed from the solved value when the engine moves the divider (drag,
  // resize, equal-split). Render-phase reset per the React docs pattern — an
  // effect here would cascade a second render on every resolve.
  const [seeded, setSeeded] = useState(span.centerMm);
  if (seeded !== span.centerMm) {
    setSeeded(span.centerMm);
    setText(String(span.centerMm));
  }

  const commit = () => {
    const mm = Math.round(Number.parseFloat(text));
    if (!Number.isFinite(mm) || mm <= 0) {
      setText(String(span.centerMm));
      return;
    }
    if (mm !== span.centerMm) onCommit(mm);
  };

  return (
    <div className="px-4 py-2.5">
      <label
        htmlFor={`span-${span.pathId}-${span.orientation}`}
        className={cn("mb-1.5 flex items-center justify-between gap-2", labelClass)}
      >
        <span className="truncate">{span.label}</span>
        <span className="shrink-0 font-mono text-[10px] normal-case text-slate-400">
          from {span.orientation === "horizontal" ? "top" : "left"}
        </span>
      </label>
      <div className="relative">
        <input
          id={`span-${span.pathId}-${span.orientation}`}
          type="number"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          className={cn(fieldClass, "h-9 pr-10 font-mono text-sm")}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">
          mm
        </span>
      </div>
    </div>
  );
}
