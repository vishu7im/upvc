// =====================================================================
// Link-based pager (no client JS). Renders Prev / "page N of M" / Next as
// plain <Link>s with ?page=…, so it works in Server Components. Reused by the
// products list and the per-product design gallery.
// =====================================================================

import Link from "next/link";
import { Icon } from "@/components/icons";
import { cn } from "@/components/ui";

export default function Pager({
  page,
  pages,
  basePath,
  query,
}: {
  page: number;
  pages: number;
  basePath: string;
  /** Extra query params to preserve across pages (e.g. orderId). */
  query?: Record<string, string | undefined>;
}) {
  if (pages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < pages;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    sp.set("page", String(p));
    for (const [k, v] of Object.entries(query ?? {})) if (v) sp.set(k, v);
    return `${basePath}?${sp.toString()}`;
  };
  const cls = (enabled: boolean) =>
    cn(
      "inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition",
      enabled
        ? "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
        : "pointer-events-none border-slate-200 bg-slate-50 text-slate-300",
    );

  return (
    <nav className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
      <Link href={href(page - 1)} aria-disabled={!hasPrev} className={cls(hasPrev)}>
        <Icon name="chevronLeft" className="h-4 w-4" />
        Prev
      </Link>
      <span className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-500 ring-1 ring-slate-200">
        Page {page} of {pages}
      </span>
      <Link href={href(page + 1)} aria-disabled={!hasNext} className={cls(hasNext)}>
        Next
        <Icon name="chevronRight" className="h-4 w-4" />
      </Link>
    </nav>
  );
}
