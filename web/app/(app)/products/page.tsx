// =====================================================================
// Products list (U2). Server Component: paginated product lines from
// GET /api/products (bearer attached server-side). Each card links to the
// per-product design gallery at /products/[id].
// =====================================================================

import Link from "next/link";
import { serverApiGet } from "@/lib/server-api";
import type { Paginated, ProductSummary } from "@/lib/types";
import Pager from "@/components/pager";
import { Alert, Badge, Card, EmptyState, PageHeader, tableWrapClass } from "@/components/ui";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

function toPage(v: string | string[] | undefined): number {
  const n = parseInt(Array.isArray(v) ? v[0] : (v ?? "1"), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; orderId?: string }>;
}) {
  const sp = await searchParams;
  const page = toPage(sp.page);
  const orderId = sp.orderId;
  const suffix = orderId ? `?orderId=${orderId}` : "";

  let result: Paginated<ProductSummary> | null = null;
  let error: string | null = null;
  try {
    result = await serverApiGet<Paginated<ProductSummary>>(`/api/products?page=${page}&limit=24`);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Products"
        description={
          orderId
            ? "Pick a product, then choose a quotable design to add it to the active draft order."
            : "Browse profile product lines and open the design gallery for live quoting."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                aria-label="Search products"
                placeholder="Search current page..."
                className="h-10 w-64 rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm focus:border-[#4442e3] focus:ring-4 focus:ring-[#4442e3]/10"
              />
            </div>
            <button className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
              <Icon name="filter" className="h-4 w-4" />
              Filters
            </button>
          </div>
        }
        meta={
          result ? (
            <Badge tone="purple">{result.pagination.total} product lines</Badge>
          ) : orderId ? (
            <Badge tone="green">Adding to order</Badge>
          ) : undefined
        }
      />

      {error ? (
        <Alert title="Engine API not reachable">Start it on :3005. ({error})</Alert>
      ) : result!.data.length === 0 ? (
        <EmptyState icon="products" title="No products found" description="Product lines will appear here after the catalog is loaded." />
      ) : (
        <>
          <Card className="mb-6 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 p-3">
              {["All products", "Windows", "Doors", "Sliding systems"].map((tab, index) => (
                <span
                  key={tab}
                  className={
                    index === 0
                      ? "rounded-md bg-[#4442e3] px-4 py-2 text-sm font-semibold text-white"
                      : "rounded-md px-4 py-2 text-sm font-semibold text-slate-600"
                  }
                >
                  {tab}
                </span>
              ))}
              <span className="ml-auto hidden text-xs font-semibold uppercase text-slate-400 sm:inline">
                Page {result!.pagination.page} of {result!.pagination.pages}
              </span>
            </div>
          </Card>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {result!.data.map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.id}${suffix}`}
                className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#4442e3]/50 hover:shadow-[0_18px_38px_rgba(15,23,42,0.08)]"
              >
                <div className="industrial-grid relative h-40 border-b border-slate-200 p-5">
                  <ProductPreview />
                  <Badge tone={p.designCount > 0 ? "green" : "slate"} className="absolute left-4 top-4">
                    {p.designCount} {p.designCount === 1 ? "design" : "designs"}
                  </Badge>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl font-bold text-slate-950">{p.name}</h2>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition group-hover:border-[#4442e3] group-hover:text-[#4442e3]">
                      <Icon name="chevronRight" className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 text-sm">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">Type</p>
                      <p className="mt-1 font-semibold text-slate-800">{p.typeId}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">System</p>
                      <p className="mt-1 font-semibold text-slate-800">{p.systemId}</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className={tableWrapClass + " mt-6 p-4 text-sm text-slate-500"}>
            Showing page {result!.pagination.page} of {result!.pagination.pages} from {result!.pagination.total} product lines.
          </div>
          <Pager
            page={result!.pagination.page}
            pages={result!.pagination.pages}
            basePath="/products"
            query={{ orderId }}
          />
        </>
      )}
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg viewBox="0 0 180 110" className="h-28 w-44 text-slate-500" fill="none" aria-hidden="true">
        <rect x="34" y="14" width="112" height="82" rx="3" fill="white" stroke="currentColor" strokeWidth="4" />
        <rect x="45" y="25" width="45" height="60" fill="#eaf5ff" stroke="#b7c8da" strokeWidth="2" />
        <rect x="90" y="25" width="45" height="60" fill="#f7fbff" stroke="#b7c8da" strokeWidth="2" />
        <path d="M90 25v60" stroke="currentColor" strokeWidth="3" />
        <path d="M100 55h10" stroke="#4442e3" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}
