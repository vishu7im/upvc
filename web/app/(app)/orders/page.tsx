// =====================================================================
// Orders list (U4). Server Component: paginated orders with status, item
// count, and snapshotted total. "New order" creates a draft.
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

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = toPage((await searchParams).page);

  let result: Paginated<OrderSummary> | null = null;
  let error: string | null = null;
  let canDeleteOrders = false;
  try {
    const [orders, user] = await Promise.all([
      serverApiGet<Paginated<OrderSummary>>(`/api/orders?page=${page}&limit=20`),
      getCurrentUser(),
    ]);
    result = orders;
    canDeleteOrders = can(user, "orders", "delete");
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  return (
    <div>
      <PageHeader
        eyebrow="Order management"
        title="Orders"
        description="Track draft and confirmed orders, inspect line items, and access generated production document packs."
        actions={<NewOrderButton />}
        meta={result ? <Badge tone="purple">{result.pagination.total} total orders</Badge> : undefined}
      />

      {error ? (
        <Alert title="Engine API not reachable">({error})</Alert>
      ) : result!.data.length === 0 ? (
        <EmptyState
          icon="orders"
          title="No orders yet"
          description="Create a draft order, add configured products, then confirm it to generate documents."
          action={<NewOrderButton />}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-64 flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                aria-label="Search orders"
                placeholder="Search current order page..."
                className="h-10 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm focus:border-[#4442e3] focus:ring-4 focus:ring-[#4442e3]/10"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
                <Icon name="filter" className="h-4 w-4" />
                Status
              </button>
              <button className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
                <Icon name="chart" className="h-4 w-4" />
                Sort
              </button>
            </div>
          </div>

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
                {result!.data.map((o) => (
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
                    <td className={tdClass + " text-right font-semibold"}>{o._count?.items ?? "--"}</td>
                    <td className={tdClass + " text-right font-semibold"}>{money(o.totalPrice)}</td>
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
                ))}
              </tbody>
            </table>
            </div>
          </div>
          <Pager page={result!.pagination.page} pages={result!.pagination.pages} basePath="/orders" />
        </>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const confirmed = status === "confirmed";
  return <Badge tone={confirmed ? "green" : "amber"}>{confirmed ? "Confirmed" : "Draft"}</Badge>;
}
