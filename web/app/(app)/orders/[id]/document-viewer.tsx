"use client";

import { useEffect, useId, useState } from "react";
import { Icon } from "@/components/icons";
import { buttonClasses, cn } from "@/components/ui";

export function DocumentViewer({
  label,
  viewHref,
  pdfHref,
}: {
  label: string;
  viewHref: string;
  pdfHref: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const downloadHref = `${pdfHref}?download=1`;
  const fileName = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "document"}.pdf`;

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
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-[#0f172a] px-3 text-sm font-semibold text-white transition hover:bg-[#172033] focus:ring-4 focus:ring-slate-300"
        >
          View document
        </button>
        <a
          href={downloadHref}
          download={fileName}
          aria-label={`Download ${label} PDF`}
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
                  src={viewHref}
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
