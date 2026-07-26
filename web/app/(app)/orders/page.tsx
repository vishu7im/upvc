// =====================================================================
// Orders list (U4, extended in D6). Server Component: paginated orders with
// status, item count and the BASKET grand total (extras + discount + VAT) —
// the same number the order page and the Price Summary show.
//
// Search and the status filter are server-side (`?q=` / `?status=`), so they
// span the whole table rather than the rows that happen to be on this page.
// Both are plain GET links/forms — no client JS, like the pager.
// =====================================================================

import Link from "next/link";
import { getCurrentUser, serverApiGet } from "@/lib/server-api";
import type { OrderSummary, Paginated } from "@/lib/types";
import { can } from "@/lib/permissions";
import { money, dateShort } from "@/lib/format";
import Pager from "@/components/pager";
import NewOrderButton from "./new-order-button";
import DeleteOrderButton from "./delete-order-button";
import { Alert, Badge, EmptyState, PageHeader, tableClass, tableWrapClass, tdClass, thClass } from "@/components/ui";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

function toPage(v: string | undefined): number {
  const n = parseInt(v ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "confirmed", label: "Confirmed" },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const page = toPage(sp.page);
  const q = (sp.q ?? "").trim();
  const status = sp.status === "draft" || sp.status === "confirmed" ? sp.status : "";

  const query = new URLSearchParams({ page: String(page), limit: "20" });
  if (q) query.set("q", q);
  if (status) query.set("status", status);

  let result: Paginated<OrderSummary> | null = null;
  let error: string | null = null;
  let canDeleteOrders = false;
  try {
    const [orders, user] = await Promise.all([
      serverApiGet<Paginated<OrderSummary>>(`/api/orders?${query.toString()}`),
      getCurrentUser(),
    ]);
    result = orders;
    canDeleteOrders = can(user, "orders", "delete");
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  /** Preserve the other filters when one of them changes. */
  const hrefWith = (patch: Record<string, string>) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const s = next.toString();
    return s ? `/orders?${s}` : "/orders";
  };

  const filtered = Boolean(q || status);

  return (
    <div>
      <PageHeader
        eyebrow="Order management"
        title="Orders"
        description="Track draft and confirmed orders, inspect line items, and access generated production document packs."
        actions={<NewOrderButton />}
        meta={result ? <Badge tone="purple">{result.pagination.total} {filtered ? "matching" : "total"} orders</Badge> : undefined}
      />

      {error ? (
        <Alert title="Engine API not reachable">({error})</Alert>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-center lg:justify-between">
            <form action="/orders" method="get" className="relative min-w-64 flex-1">
              {status && <input type="hidden" name="status" value={status} />}
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                defaultValue={q}
                aria-label="Search orders"
                placeholder="Search order no., customer or reference…"
                className="h-10 w-full rounded-md border border-slate-300 bg-white pl-10 pr-24 text-sm focus:border-[#4442e3] focus:ring-4 focus:ring-[#4442e3]/10"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 h-7 -translate-y-1/2 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-700"
              >
                Search
              </button>
            </form>
            <div
              role="tablist"
              aria-label="Filter by status"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1"
            >
              {STATUS_TABS.map((tab) => {
                const active = status === tab.key;
                return (
                  <Link
                    key={tab.key || "all"}
                    href={hrefWith({ status: tab.key })}
                    role="tab"
                    aria-selected={active}
                    className={
                      "inline-flex h-8 items-center rounded px-3 text-sm font-semibold transition " +
                      (active
                        ? "bg-white text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                        : "text-slate-600 hover:text-slate-900")
                    }
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {result!.data.length === 0 ? (
            filtered ? (
              <EmptyState
                icon="search"
                title="No orders match those filters"
                description="Try a different search term, or clear the filters to see every order."
                action={
                  <Link
                    href="/orders"
                    className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                  >
                    Clear filters
                  </Link>
                }
              />
            ) : (
              <EmptyState
                icon="orders"
                title="No orders yet"
                description="Create a draft order, add configured products, then confirm it to generate documents."
                action={<NewOrderButton />}
              />
            )
          ) : (
            <>
              <div className={tableWrapClass}>
                <div className="overflow-x-auto">
                  <table className={tableClass}>
                    <thead>
                      <tr>
                        <th className={thClass}>Order</th>
                        <th className={thClass}>Customer</th>
                        <th className={thClass}>Status</th>
                        <th className={thClass + " text-right"}>Items</th>
                        <th className={thClass + " text-right"}>Total</th>
                        <th className={thClass}>Created</th>
                        {canDeleteOrders && <th className={thClass + " text-right"}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {result!.data.map((o) => {
                        const items = (o._count?.items ?? 0) + (o._count?.designerItems ?? 0);
                        const total = o.basketTotal ?? o.totalPrice;
                        return (
                          <tr key={o.id} className="transition hover:bg-slate-50">
                            <td className={tdClass}>
                              <Link href={`/orders/${o.id}`} className="font-semibold text-[#4442e3] hover:underline">
                                {o.orderNo}
                              </Link>
                            </td>
                            <td className={tdClass}>
                              <div className="font-semibold text-slate-900">{o.customerName}</div>
                              {o.reference && <div className="text-xs text-slate-500">{o.reference}</div>}
                            </td>
                            <td className={tdClass}>
                              <StatusBadge status={o.status} />
                            </td>
                            <td className={tdClass + " text-right font-semibold"}>
                              {o._count ? items : "--"}
                            </td>
                            <td className={tdClass + " text-right font-semibold"}>{money(total)}</td>
                            <td className={tdClass + " text-slate-500"}>{dateShort(o.createdAt)}</td>
                            {canDeleteOrders && (
                              <td className={tdClass + " text-right"}>
                                <DeleteOrderButton
                                  orderId={o.id}
                                  orderNo={o.orderNo}
                                  status={o.status}
                                  compact
                                />
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pager
                page={result!.pagination.page}
                pages={result!.pagination.pages}
                basePath={hrefWith({})}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const confirmed = status === "confirmed";
  return <Badge tone={confirmed ? "green" : "amber"}>{confirmed ? "Confirmed" : "Draft"}</Badge>;
}
