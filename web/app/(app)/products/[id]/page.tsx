// =====================================================================
// Per-product design gallery (U2). Server Component: fetches the product,
// its paginated designs, then each design's full record in parallel for the
// inline SVG (the list endpoint omits imageSvg). Renders a DesignCard grid
// with quotable/preview-only badges.
// =====================================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import { serverApiGet } from "@/lib/server-api";
import type { DesignDetail, DesignListItem, Paginated, ProductSummary } from "@/lib/types";
import { ApiError } from "@/lib/api";
import Pager from "@/components/pager";
import DesignCard from "@/components/design-card";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

const GALLERY_LIMIT = 24;

function toPage(v: string | string[] | undefined): number {
  const n = parseInt(Array.isArray(v) ? v[0] : (v ?? "1"), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export default async function ProductGalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; orderId?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const page = toPage(sp.page);
  const orderId = sp.orderId;

  // Product header — a 404 from the engine maps to Next's not-found.
  let product: ProductSummary;
  try {
    product = await serverApiGet<ProductSummary>(`/api/products/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const designs = await serverApiGet<Paginated<DesignListItem>>(
    `/api/products/${id}/designs?page=${page}&limit=${GALLERY_LIMIT}`,
  );

  // Fetch each design's SVG in parallel (list endpoint omits it). A failed
  // fetch degrades to a "no preview" tile rather than failing the page.
  const svgs = await Promise.all(
    designs.data.map((d) =>
      serverApiGet<DesignDetail>(`/api/designs/${d.designId}`)
        .then((full) => full.imageSvg)
        .catch(() => null),
    ),
  );

  return (
    <div>
      <Link href="/products" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950">
        <Icon name="arrowLeft" className="h-4 w-4" />
        Products
      </Link>
      <PageHeader
        eyebrow="Design gallery"
        title={product.name}
        description="Choose a quotable fabrication design, review its leaf count, and open the live quote configurator."
        actions={
          <ButtonLink href="/products" variant="secondary" icon="products">
            Product catalog
          </ButtonLink>
        }
        meta={
          <>
            <Badge tone="slate">{product.typeId}</Badge>
            <Badge tone="purple">{product.systemId}</Badge>
            <Badge tone="green">{designs.pagination.total} {designs.pagination.total === 1 ? "design" : "designs"}</Badge>
          </>
        }
      />
      {orderId && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Adding to an existing order. Pick a quotable design to configure and add.
        </div>
      )}

      {designs.data.length === 0 ? (
        <EmptyState icon="products" title="No designs in this product" description="Designs will appear here when this product catalog is populated." />
      ) : (
        <>
          <Card className="mb-6 overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 p-4">
              <div className="relative min-w-64 flex-1">
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  aria-label="Search designs"
                  placeholder="Search current design page..."
                  className="h-10 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm focus:border-[#4442e3] focus:ring-4 focus:ring-[#4442e3]/10"
                />
              </div>
              <button className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
                <Icon name="filter" className="h-4 w-4" />
                Quotable
              </button>
            </div>
          </Card>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {designs.data.map((d, i) => (
              <DesignCard
                key={d.designId}
                designId={d.designId}
                name={d.name}
                quotable={d.quotable}
                quantityOfSquares={d.quantityOfSquares}
                svg={svgs[i]}
                systemId={product.systemId}
                productId={product.id}
                orderId={orderId}
              />
            ))}
          </div>
          <Pager
            page={designs.pagination.page}
            pages={designs.pagination.pages}
            basePath={`/products/${id}`}
            query={{ orderId }}
          />
        </>
      )}
    </div>
  );
}
