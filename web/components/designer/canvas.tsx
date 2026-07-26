"use client";

// =====================================================================
// Designer canvas (D4) — the drawing plus its selection affordances.
//
// The drawing itself is the EXISTING `window-designer.tsx` (drag handles,
// editable dimension labels, the real engine SVG): this wrapper only adds the
// phase-4 selection layer around it, by handing it the resolver's
// `components[]` and owning nothing but the escape hatch and the breadcrumb.
// Selection state lives in the workspace reducer's sibling `useState`, so the
// Structure tree and the canvas are always the same selection — neither is a
// copy of the other.
// =====================================================================

import { useEffect } from "react";
import WindowDesigner from "@/components/window-designer";
import { Icon } from "@/components/icons";
import type { ComponentRef, QuoteGeometry } from "@/lib/types";

export interface DesignerCanvasProps {
  geometry: QuoteGeometry;
  widthMm: number;
  heightMm: number;
  glassLabel: string;
  components: ComponentRef[];
  selectedComponentId: string | null;
  onSelectComponent: (componentId: string | null) => void;
  onWidthChange: (widthMm: number) => void;
  onHeightChange: (heightMm: number) => void;
  onSplitRatioChange: (pathId: string, ratio: number) => void;
  /** The drawing is the mirrored internal elevation (D5) — see WindowDesigner. */
  mirrored?: boolean;
}

/**
 * "Whole item ▸ Sash (top) ▸ Glass" — the chain of components the selection
 * sits inside. Derived from the componentId scheme (`cell:<path>/glass` is
 * inside `cell:<path>`), so it needs no extra server field.
 */
export function breadcrumbFor(
  components: ComponentRef[],
  componentId: string | null,
): ComponentRef[] {
  if (!componentId) return [];
  const self = components.find((c) => c.componentId === componentId);
  if (!self) return [];
  const slash = componentId.indexOf("/");
  if (slash === -1) return [self];
  const parent = components.find((c) => c.componentId === componentId.slice(0, slash));
  return parent ? [parent, self] : [self];
}

export default function DesignerCanvas({
  geometry,
  widthMm,
  heightMm,
  glassLabel,
  components,
  selectedComponentId,
  onSelectComponent,
  onWidthChange,
  onHeightChange,
  onSplitRatioChange,
  mirrored = false,
}: DesignerCanvasProps) {
  // Escape always returns to item scope — the reference UI needs a modal
  // "edit components" toggle to leave component editing; selection here is
  // always-on, so Escape is the whole exit.
  useEffect(() => {
    if (!selectedComponentId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSelectComponent(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedComponentId, onSelectComponent]);

  const trail = breadcrumbFor(components, selectedComponentId);

  // `self-stretch` (and NOT `h-full`) is load-bearing here. The canvas card is a
  // centring flex container whose height comes from `min-h-*`, which browsers
  // treat as indefinite: a percentage height inside it falls back to the
  // content height — and every child here is absolutely positioned, so that is
  // 0, and the stage's `overflow-hidden` clipped the whole drawing. Stretching
  // instead gives this element a definite height, which the stage's own
  // `h-full` can then resolve against.
  return (
    <div className="relative w-full min-w-0 self-stretch">
      <div className="pointer-events-none absolute left-3 top-3 z-20 max-w-[min(28rem,70%)]">
        <nav
          aria-label="Selection"
          className="pointer-events-auto inline-flex max-w-full items-center gap-1 rounded-md border border-slate-300 bg-white/90 px-2 py-1 text-xs font-semibold shadow-[0_10px_28px_rgba(15,23,42,0.12)] backdrop-blur"
        >
          <button
            type="button"
            onClick={() => onSelectComponent(null)}
            className={
              trail.length === 0
                ? "rounded px-1.5 py-0.5 text-[#4442e3]"
                : "rounded px-1.5 py-0.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            }
          >
            Whole item
          </button>
          {trail.map((component, i) => (
            <span key={component.componentId} className="flex min-w-0 items-center gap-1">
              <Icon name="chevronRight" className="h-3 w-3 shrink-0 text-slate-400" />
              <button
                type="button"
                onClick={() => onSelectComponent(component.componentId)}
                className={
                  i === trail.length - 1
                    ? "truncate rounded px-1.5 py-0.5 text-[#4442e3]"
                    : "truncate rounded px-1.5 py-0.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                }
              >
                {component.label}
              </button>
            </span>
          ))}
          {trail.length > 0 && (
            <button
              type="button"
              onClick={() => onSelectComponent(null)}
              aria-label="Clear selection (Escape)"
              title="Clear selection (Escape)"
              className="ml-0.5 rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <Icon name="x" className="h-3.5 w-3.5" />
            </button>
          )}
        </nav>
      </div>

      <WindowDesigner
        geometry={geometry}
        widthMm={widthMm}
        heightMm={heightMm}
        glassLabel={glassLabel}
        onWidthChange={onWidthChange}
        onHeightChange={onHeightChange}
        onSplitRatioChange={onSplitRatioChange}
        components={components}
        selectedComponentId={selectedComponentId}
        onSelectComponent={onSelectComponent}
        mirrored={mirrored}
      />
    </div>
  );
}
