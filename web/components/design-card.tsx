// =====================================================================
// DesignCard (U2/U3) — one gallery tile: inline SVG preview + quotable badge,
// and (U3) a "Configure" deep-link into the quote configurator for quotable
// designs. The SVG is first-party catalog data (seeded by our extractor /
// collection), so it's injected via dangerouslySetInnerHTML and scaled.
// =====================================================================

import Link from "next/link";
import { Badge, cn } from "@/components/ui";
import { Icon } from "@/components/icons";
import { normalizeSvgForPreview } from "@/lib/svg-preview";

export interface DesignCardProps {
  designId: string;
  name: string;
  quotable: boolean;
  quantityOfSquares: number;
  svg: string | null;
  /** Deep-link context for the configurator. */
  systemId: string;
  productId: string;
  /** When set, the configurator appends the item to this draft order. */
  orderId?: string;
  /**
   * Set when this product's family is registered with the Designer (D1/D3);
   * adds the "Design in studio" action alongside the legacy "Configure".
   */
  designerFamilyKey?: string;
}

export default function DesignCard({
  designId,
  name,
  quotable,
  quantityOfSquares,
  svg,
  systemId,
  productId,
  orderId,
  designerFamilyKey,
}: DesignCardProps) {
  const params = new URLSearchParams({ systemId, designId, productId, name });
  if (orderId) params.set("orderId", orderId);
  const configureHref = `/quote?${params.toString()}`;

  const studioParams = new URLSearchParams({ family: designerFamilyKey ?? "", design: designId, system: systemId, name });
  if (orderId) studioParams.set("orderId", orderId);
  const studioHref = `/designer?${studioParams.toString()}`;
  const previewSvg = svg ? normalizeSvgForPreview(svg) : null;

  return (
    <div className="group flex h-full min-h-[390px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#4442e3]/50 hover:shadow-[0_18px_38px_rgba(15,23,42,0.08)]">
      <div className="industrial-grid flex h-64 items-center justify-center border-b border-slate-200 p-4">
        {previewSvg ? (
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white/[0.82] shadow-inner">
            <div className="absolute inset-x-4 top-4 h-px bg-slate-200" />
            <div className="absolute bottom-4 inset-x-4 h-px bg-slate-200" />
            <div className="absolute inset-y-4 left-4 w-px bg-slate-200" />
            <div className="absolute inset-y-4 right-4 w-px bg-slate-200" />
            <div className="absolute left-1/2 top-4 bottom-4 w-px -translate-x-1/2 bg-slate-100" />
            <div className="absolute top-1/2 left-4 right-4 h-px -translate-y-1/2 bg-slate-100" />
            <div
              className="design-preview-svg relative z-10 flex h-[78%] w-[78%] items-center justify-center"
              // First-party catalog SVG (not user input).
              dangerouslySetInnerHTML={{ __html: previewSvg }}
            />
            {/* <span className="absolute right-3 top-3 rounded bg-slate-900/80 px-2 py-1 text-[10px] font-semibold uppercase text-white">
              Normalized
            </span> */}
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-white/[0.70] text-slate-400">
            <Icon name="products" className="h-8 w-8" />
            <span className="text-xs font-semibold uppercase">No preview</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="line-clamp-2 min-h-12 text-base font-bold leading-6 text-slate-950" title={name}>
            {name}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase text-slate-500">
            {quantityOfSquares} {quantityOfSquares === 1 ? "leaf" : "leaves"}
          </p>
        </div>
        <Badge tone={quotable ? "green" : "slate"} className="shrink-0">
          {quotable ? "Quotable" : "Preview"}
        </Badge>
      </div>
      {quotable ? (
        <div className="mx-4 mb-4 flex flex-col gap-2">
          <Link
            href={configureHref}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#0f172a] px-3 text-sm font-semibold text-white transition hover:bg-[#172033]",
            )}
          >
            <Icon name="quote" className="h-4 w-4" />
            {orderId ? "Configure and add" : "Configure"}
          </Link>
          {designerFamilyKey && (
            <Link
              href={studioHref}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-[#4442e3]/50 hover:text-[#4442e3]"
            >
              <Icon name="spark" className="h-4 w-4" />
              Design in studio
            </Link>
          )}
        </div>
      ) : (
        <div className="mx-4 mb-4 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-400">
          <Icon name="products" className="h-4 w-4" />
          Preview only
        </div>
      )}
    </div>
  );
}
