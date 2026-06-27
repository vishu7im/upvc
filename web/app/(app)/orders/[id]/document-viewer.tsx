"use client";

import { useEffect, useId, useState } from "react";
import { Icon } from "@/components/icons";
import { buttonClasses, cn } from "@/components/ui";

export function DocumentViewer({
  label,
  viewHref,
  pdfHref,
  variants = ["normal"],
}: {
  label: string;
  /** Base document HTML href (no ?variant). */
  viewHref: string;
  /** Base document PDF href (no ?variant). */
  pdfHref: string;
  /** Stored variants for this doc type, e.g. ["normal","welded"] or ["normal"]. */
  variants?: string[];
}) {
  const hasWelded = variants.includes("welded");
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<"normal" | "welded">(() => (hasWelded ? "welded" : "normal"));
  const titleId = useId();

  const activeVariant = hasWelded ? variant : "normal";
  const welded = activeVariant === "welded";
  const fullViewHref = `${viewHref}?variant=${activeVariant}`;
  const downloadHref = `${pdfHref}?variant=${activeVariant}&download=1`;
  const suffix = welded ? "-welded" : "";
  const fileName = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "document"}${suffix}.pdf`;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      {hasWelded && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase text-amber-900">Cut length mode</p>
            <span className="rounded bg-amber-600 px-2 py-1 text-[10px] font-bold uppercase text-white">
              Welded default
            </span>
          </div>
          <div role="radiogroup" aria-label={`${label} cut length mode`} className="grid grid-cols-2 gap-2">
            <VariantButton
              selected={!welded}
              label="Normal"
              detail="Finished"
              onClick={() => setVariant("normal")}
            />
            <VariantButton
              selected={welded}
              label="Welded"
              detail="Saw cut"
              onClick={() => setVariant("welded")}
              tone="amber"
            />
          </div>
        </div>
      )}

      <div className={cn("flex gap-2", hasWelded ? "mt-2" : "mt-5")}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-[#0f172a] px-3 text-sm font-semibold text-white transition hover:bg-[#172033] focus:ring-4 focus:ring-slate-300"
        >
          View {hasWelded ? activeVariant : "document"}
        </button>
        <a
          href={downloadHref}
          download={fileName}
          aria-label={`Download ${label}${hasWelded ? ` (${activeVariant})` : ""} PDF`}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 focus:ring-4 focus:ring-slate-200"
        >
          <Icon name="download" className="h-4 w-4" />
        </a>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-[80] bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="mx-auto flex h-full max-h-[calc(100vh-1.5rem)] w-full max-w-[920px] flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)] sm:max-h-[calc(100vh-3rem)]">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
              <h2 id={titleId} className="min-w-0 truncate text-base font-semibold text-slate-950">
                {label}
                {hasWelded && (
                  <span className={cn("ml-2 text-sm font-medium", welded ? "text-amber-700" : "text-slate-500")}>
                    ({welded ? "Welded" : "Normal"})
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                <a href={downloadHref} download={fileName} className={cn(buttonClasses("secondary"), "px-3")} aria-label={`Download ${label} PDF`}>
                  <Icon name="download" className="h-4 w-4" />
                  PDF
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close document preview"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 focus:ring-4 focus:ring-slate-200"
                >
                  <Icon name="x" className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-slate-200 p-4">
              <div className="flex min-w-max justify-center">
                <iframe
                  title={label}
                  src={fullViewHref}
                  className="shrink-0 border-0 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.22)]"
                  style={{ width: 794, height: "min(1123px, calc(100vh - 11rem))" }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function VariantButton({
  selected,
  label,
  detail,
  tone = "slate",
  onClick,
}: {
  selected: boolean;
  label: string;
  detail: string;
  tone?: "slate" | "amber";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-14 flex-col items-start justify-center rounded-md border px-3 py-2 text-left transition focus:ring-4",
        selected
          ? tone === "amber"
            ? "border-amber-500 bg-white text-amber-900 shadow-sm focus:ring-amber-200"
            : "border-slate-500 bg-white text-slate-950 shadow-sm focus:ring-slate-200"
          : "border-transparent bg-white/55 text-slate-600 hover:bg-white hover:text-slate-950 focus:ring-slate-200",
      )}
    >
      <span className="flex w-full items-center justify-between gap-2 text-sm font-bold">
        {label}
        {selected && <Icon name="check" className="h-4 w-4" />}
      </span>
      <span className="mt-0.5 text-xs font-semibold opacity-75">{detail}</span>
    </button>
  );
}
