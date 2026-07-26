"use client";

// =====================================================================
// The row shell every option control sits in — and the single place the
// inspector's tri-state visual grammar is defined (ux-design-language.md §4):
//
//   default   → muted label, no adornment
//   changed   → emphasised label + accent dot + "reset to default"
//   attention → amber ring (required + unanswered) / red ring (error issue)
//
// Controls never style their own state; they take `tone` and apply
// `controlRingClass(tone)` to their focusable surface, so a new control type
// inherits the grammar for free.
// =====================================================================

import { useState, type ReactNode } from "react";
import { cn } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { OptionDef } from "@/lib/types";

export type OptionTone = "default" | "changed" | "warning" | "error";

/** Border/ring classes a control applies to its own focusable surface. */
export function controlRingClass(tone: OptionTone): string {
  if (tone === "error") return "border-red-400 ring-1 ring-red-200";
  if (tone === "warning") return "border-amber-400 ring-1 ring-amber-200";
  if (tone === "changed") return "border-[#4442e3]/45";
  return "border-slate-300";
}

export function OptionRow({
  option,
  tone,
  onReset,
  issues,
  badge,
  children,
}: {
  option: OptionDef;
  tone: OptionTone;
  /** Present ⇒ the user has answered this option and can undo it. */
  onReset?: () => void;
  issues?: { severity: "warning" | "error"; message: string }[];
  /**
   * Which precedence rung answered this option in the current scope
   * ("Override", "All sashes", "From item") — phase 4's per-component context.
   * Absent at item scope, where there is only one rung to be on.
   */
  badge?: string;
  children: ReactNode;
}) {
  const helpText = option.presentation?.helpText;
  // Help text is on DEMAND. Several options carry a paragraph explaining why
  // they price nothing, and printing all of them at once was most of what made
  // this panel feel dense — three sentences of caveat above every control.
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <div className="px-4 py-2.5">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <label
          htmlFor={`opt-${option.key}`}
          className={cn(
            "flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase leading-5",
            tone === "default" ? "text-slate-500" : "text-slate-900",
          )}
        >
          {tone === "changed" && (
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4442e3]" />
          )}
          <span className="truncate">{option.name}</span>
          {option.required && <span className="text-amber-600">*</span>}
          {option.pricingMode === "none" && (
            <span
              title="Recorded on the specification and documents; no price or BOM line (no calibrated rule yet)."
              className="shrink-0 rounded bg-slate-100 px-1 text-[10px] font-semibold normal-case text-slate-500"
            >
              spec only
            </span>
          )}
        </label>
        <span className="flex shrink-0 items-center gap-1.5">
        {helpText && (
          <button
            type="button"
            onClick={() => setHelpOpen((v) => !v)}
            aria-expanded={helpOpen}
            aria-label={`About ${option.name}`}
            className={cn(
              "rounded-full p-0.5 transition",
              helpOpen ? "text-[#4442e3]" : "text-slate-300 hover:text-slate-500",
            )}
          >
            <Icon name="info" className="h-3.5 w-3.5" />
          </button>
        )}
        {badge && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
            {badge}
          </span>
        )}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="shrink-0 rounded px-1 text-[11px] font-semibold text-slate-400 underline-offset-2 transition hover:text-[#4442e3] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4442e3]/40"
          >
            Reset
          </button>
        )}
        </span>
      </div>
      {children}
      {helpText && helpOpen && (
        <p className="mt-1.5 rounded-md bg-slate-100/70 px-2 py-1.5 text-[11px] leading-4 text-slate-600">
          {helpText}
        </p>
      )}
      {issues?.map((i, n) => (
        <p
          key={n}
          className={cn(
            "mt-1.5 text-[11px] font-medium leading-4",
            i.severity === "error" ? "text-red-700" : "text-amber-700",
          )}
        >
          {i.message}
        </p>
      ))}
    </div>
  );
}
