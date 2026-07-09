"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/components/ui";

export type ToastKind = "updating" | "valid" | "invalid";

export interface ToastState {
  id: number;
  kind: ToastKind;
  message?: string;
}

const AUTO_HIDE_MS = 2500;
const EXIT_MS = 200;

const META: Record<
  ToastKind,
  { message: string; box: string; glyph: "spinner" | "check" | "alert"; sticky: boolean }
> = {
  updating: {
    message: "Updating preview…",
    box: "border-amber-300 bg-amber-50 text-amber-900",
    glyph: "spinner",
    sticky: true, // stays until the next toast replaces it
  },
  valid: {
    message: "Configuration updated successfully",
    box: "border-emerald-300 bg-emerald-50 text-emerald-900",
    glyph: "check",
    sticky: false,
  },
  invalid: {
    message: "Invalid configuration",
    box: "border-red-300 bg-red-50 text-red-900",
    glyph: "alert",
    sticky: false,
  },
};

function Glyph({ glyph }: { glyph: "spinner" | "check" | "alert" }) {
  if (glyph === "spinner") {
    return (
      <span
        aria-hidden="true"
        className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
      />
    );
  }
  return <Icon name={glyph === "check" ? "check" : "alert"} className="h-4 w-4 shrink-0" />;
}

/**
 * Top-center, non-blocking toast. Keyed by toast id by the caller so each new
 * toast remounts and replays the enter animation. Auto-hiding kinds animate out
 * (leave class) before calling onExpire; the sticky "updating" kind persists
 * until the parent swaps in the next toast.
 */
export function ToastViewport({
  toast,
  onExpire,
}: {
  toast: ToastState | null;
  onExpire: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2">
      {toast && <ToastCard key={toast.id} toast={toast} onExpire={onExpire} />}
    </div>
  );
}

function ToastCard({ toast, onExpire }: { toast: ToastState; onExpire: (id: number) => void }) {
  const meta = META[toast.kind];
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (meta.sticky) return;
    const hide = setTimeout(() => setLeaving(true), AUTO_HIDE_MS);
    const done = setTimeout(() => onExpire(toast.id), AUTO_HIDE_MS + EXIT_MS);
    return () => {
      clearTimeout(hide);
      clearTimeout(done);
    };
  }, [toast.id, meta.sticky, onExpire]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-[0_12px_32px_rgba(15,23,42,0.18)]",
        meta.box,
        leaving ? "toast-leave" : "toast-enter",
      )}
    >
      <Glyph glyph={meta.glyph} />
      <span>{toast.message ?? meta.message}</span>
    </div>
  );
}
