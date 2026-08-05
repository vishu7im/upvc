// =====================================================================
// Orders list (U4, extended in D6). Server Component: paginated orders with
// status, item count and the BASKET grand total (extras + discount + VAT) —
// the same number the order page and the Price Summary show.
//
// Search and the status filter are server-side (`?q=` / `?status=`), so they
// span the whole table rather than the rows that happen to be on this page.
// Both are plain GET links/forms — no client JS, like the pager.
// =====================================================================

import type { ReactNode } from "react";
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

/**
 * One table cell whose whole area navigates to the order — the padding moves
 * off the `<td>` and onto the `<a>` so the click target really is the cell, not
 * just the text inside it.
 *
 * `primary` marks the ONE cell per row that stays keyboard-reachable; the rest
 * are `tabIndex={-1}` and `aria-hidden`, so a screen reader or a Tab key sees
 * one link per order rather than six identical ones.
 */
function RowCell({
  href,
  children,
  className = "",
  primary = false,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  primary?: boolean;
}) {
  return (
    <td className="border-b border-slate-100 p-0">
      <Link
        href={href}
        className={`block px-4 py-3 text-sm ${className}`}
        {...(primary ? {} : { tabIndex: -1, "aria-hidden": true })}
      >
        {children}
      </Link>
    </td>
  );
}

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
                          // Owner 2026-08-05: "click on order [to] edit". Every
                          // informational cell is a link to the order, so the
                          // whole row is clickable; only the first is in the tab
                          // order, so keyboard users still get ONE stop per row.
                          // The Actions cell stays a plain cell — a Delete
                          // button inside a link would be a trap.
                          <tr key={o.id} className="transition hover:bg-slate-50">
                            <RowCell href={`/orders/${o.id}`} primary>
                              <span className="font-semibold text-[#4442e3]">{o.orderNo}</span>
                            </RowCell>
                            <RowCell href={`/orders/${o.id}`}>
                              <div className="font-semibold text-slate-900">{o.customerName}</div>
                              {o.reference && <div className="text-xs text-slate-500">{o.reference}</div>}
                            </RowCell>
                            <RowCell href={`/orders/${o.id}`}>
                              <StatusBadge status={o.status} />
                            </RowCell>
                            <RowCell href={`/orders/${o.id}`} className="text-right font-semibold">
                              {o._count ? items : "--"}
                            </RowCell>
                            <RowCell href={`/orders/${o.id}`} className="text-right font-semibold">
                              {money(total)}
                            </RowCell>
                            <RowCell href={`/orders/${o.id}`} className="text-slate-500">
                              {dateShort(o.createdAt)}
                            </RowCell>
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
