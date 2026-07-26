// =====================================================================
// Dashboard.
//
// Everything on this page is REAL. It used to draw a hardcoded 12-bar chart
// and a three-service "system health" list that were decoration; a dashboard
// that invents numbers is worse than one that shows none, because you cannot
// tell which panels to trust. The chart is now monthly confirmed-order value
// from the orders API, the health panel reports things actually observed
// (engine reachable, catalog loaded, documents generated), and every money
// figure is the BASKET total — the same number the order page and the Price
// Summary show.
// =====================================================================

import Link from "next/link";
import { getCurrentUser, serverApiGet } from "@/lib/server-api";
import type { OrderSummary, Paginated, ProductSummary, SystemSummary } from "@/lib/types";
import { dateShort, money } from "@/lib/format";
import {
  Badge,
  ButtonLink,
  Card,
  MetricCard,
  PageHeader,
  SectionHeader,
  tableClass,
  tdClass,
  thClass,
} from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { StatusBadge } from "./orders/page";

export const dynamic = "force-dynamic";

/** How many months of history the chart shows. */
const MONTHS = 6;

const orderTotal = (o: OrderSummary): number => o.basketTotal ?? o.totalPrice ?? 0;
const itemCount = (o: OrderSummary): number =>
  (o._count?.items ?? 0) + (o._count?.designerItems ?? 0);

/** Confirmed-order value per calendar month, oldest first. */
function monthlyValue(orders: OrderSummary[]): { label: string; value: number; count: number }[] {
  const now = new Date();
  const buckets: { label: string; key: string; value: number; count: number }[] = [];
  for (let i = MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      label: d.toLocaleDateString("en-GB", { month: "short" }),
      key: `${d.getFullYear()}-${d.getMonth()}`,
      value: 0,
      count: 0,
    });
  }
  for (const o of orders) {
    if (o.status !== "confirmed") continue;
    const d = new Date(o.createdAt);
    const bucket = buckets.find((b) => b.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (!bucket) continue;
    bucket.value += orderTotal(o);
    bucket.count += 1;
  }
  return buckets.map(({ label, value, count }) => ({ label, value, count }));
}

export default async function Dashboard() {
  const user = await getCurrentUser();

  const [systemsResult, productsResult, ordersResult] = await Promise.allSettled([
    serverApiGet<SystemSummary[]>("/api/systems"),
    serverApiGet<Paginated<ProductSummary>>("/api/products?page=1&limit=6"),
    // A wider window than the table needs: the chart buckets it by month.
    serverApiGet<Paginated<OrderSummary>>("/api/orders?page=1&limit=100"),
  ]);

  const systems = systemsResult.status === "fulfilled" ? systemsResult.value : null;
  const products = productsResult.status === "fulfilled" ? productsResult.value : null;
  const orders = ordersResult.status === "fulfilled" ? ordersResult.value : null;
  const connected = Boolean(systems);

  const allOrders = orders?.data ?? [];
  const recentOrders = allOrders.slice(0, 5);
  const confirmed = allOrders.filter((o) => o.status === "confirmed");
  const drafts = allOrders.filter((o) => o.status === "draft");
  const revenue = confirmed.reduce((sum, o) => sum + orderTotal(o), 0);
  const draftItems = drafts.reduce((sum, o) => sum + itemCount(o), 0);
  const documents = allOrders.reduce((sum, o) => sum + (o._count?.documents ?? 0), 0);

  const months = monthlyValue(allOrders);
  const peak = Math.max(...months.map((m) => m.value), 0);
  const charted = months.reduce((s, m) => s + m.count, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Manufacturing command center"
        title={`Welcome${user?.name ? `, ${user.name}` : ""}`}
        description={
          connected
            ? `${systems!.length} profile ${systems!.length === 1 ? "system" : "systems"} connected. Track quote activity, order throughput, and catalog readiness from one workspace.`
            : "Engine API is not reachable. Start the backend on :3005 to load live manufacturing data."
        }
        actions={
          <>
            <ButtonLink href="/quote" icon="quote" variant="secondary">
              Quick quote
            </ButtonLink>
            <ButtonLink href="/orders" icon="plus">
              Create order
            </ButtonLink>
          </>
        }
        meta={connected ? <Badge tone="green">Engine online</Badge> : <Badge tone="red">Engine offline</Badge>}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Profile systems"
          value={systems?.length ?? "--"}
          delta={connected ? "Ready" : undefined}
          icon="settings"
          tone="blue"
        />
        <MetricCard label="Product lines" value={products?.pagination.total ?? "--"} icon="products" tone="slate" />
        <MetricCard
          label="Confirmed value"
          value={money(revenue)}
          delta={confirmed.length > 0 ? `${confirmed.length} orders` : undefined}
          icon="chart"
          tone="green"
        />
        <MetricCard
          label="Draft workload"
          value={drafts.length}
          delta={draftItems > 0 ? `${draftItems} items` : undefined}
          icon="orders"
          tone="amber"
        />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <SectionHeader
            title="Confirmed order value"
            description={`Last ${MONTHS} months, incl. extras, discount and VAT`}
            actions={
              <span className="text-xs font-semibold text-slate-500">
                {charted > 0 ? `${charted} confirmed in range` : "No confirmed orders yet"}
              </span>
            }
          />
          {peak === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 px-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Icon name="chart" className="h-6 w-6" />
              </span>
              <p className="text-sm font-semibold text-slate-800">Nothing to chart yet</p>
              <p className="max-w-xs text-sm text-slate-500">
                Confirm an order and its value appears here, bucketed by month.
              </p>
            </div>
          ) : (
            <div className="relative h-72 px-6 pb-7 pt-8">
              <div className="absolute inset-x-6 bottom-9 flex h-48 items-end gap-4">
                {months.map((m) => {
                  const pct = peak > 0 ? Math.round((m.value / peak) * 100) : 0;
                  return (
                    <div key={m.label} className="flex flex-1 flex-col items-center justify-end gap-2">
                      <span className="text-xs font-semibold text-slate-500">
                        {m.value > 0 ? money(m.value) : ""}
                      </span>
                      <div
                        className="w-full rounded-t-md bg-[#4442e3] shadow-[0_8px_20px_rgba(68,66,227,0.2)] transition-all"
                        style={{ height: `${Math.max(pct, m.value > 0 ? 4 : 0)}%` }}
                        title={`${m.label}: ${money(m.value)} across ${m.count} order${m.count === 1 ? "" : "s"}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="absolute inset-x-6 bottom-2 flex gap-4">
                {months.map((m) => (
                  <span key={m.label} className="flex-1 text-center text-xs font-semibold text-slate-400">
                    {m.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <SectionHeader title="Quick actions" description="High-frequency fabrication workflows" />
            <div className="grid grid-cols-2 gap-3 p-4">
              {[
                { href: "/designer", label: "Designer", icon: "spark" },
                { href: "/quote", label: "New quote", icon: "quote" },
                { href: "/orders", label: "Orders", icon: "orders" },
                { href: "/products", label: "Catalog", icon: "products" },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group rounded-lg border border-slate-200 bg-slate-50 p-4 text-center transition hover:border-[#4442e3] hover:bg-white hover:shadow-sm"
                >
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-white text-slate-600 ring-1 ring-slate-200 transition group-hover:bg-[#4442e3] group-hover:text-white">
                    <Icon name={action.icon as IconName} className="h-5 w-5" />
                  </span>
                  <span className="mt-3 block text-sm font-semibold text-slate-800">{action.label}</span>
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Engine status</p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">
                  {connected ? "Engine reachable" : "Backend unavailable"}
                </h2>
              </div>
              <span className={connected ? "mt-1 h-3 w-3 rounded-full bg-emerald-500" : "mt-1 h-3 w-3 rounded-full bg-red-500"} />
            </div>
            {/* Observed facts only — each row is something this page actually
                fetched, not a service we are guessing the state of. */}
            <div className="mt-5 space-y-3 text-sm">
              <StatusRow
                label="Fabrication API"
                ok={connected}
                value={connected ? "Responding" : "Unreachable"}
              />
              <StatusRow
                label="Catalog"
                ok={Boolean(products)}
                value={products ? `${products.pagination.total} product lines` : "Not loaded"}
              />
              <StatusRow
                label="Documents generated"
                ok={documents > 0}
                value={documents > 0 ? `${documents} across recent orders` : "None yet"}
                neutral={documents === 0}
              />
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-6 overflow-hidden">
        <SectionHeader
          title="Recent orders"
          description="Latest draft and confirmed orders from the fabrication engine"
          actions={
            <Link href="/orders" className="text-sm font-semibold text-[#4442e3] hover:underline">
              View all
            </Link>
          }
        />
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Order</th>
                <th className={thClass}>Customer</th>
                <th className={thClass + " text-right"}>Items</th>
                <th className={thClass}>Status</th>
                <th className={thClass + " text-right"}>Total</th>
                <th className={thClass}>Created</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={6}>
                    {connected ? "No orders yet. Create a draft order to start production." : "Orders could not be loaded."}
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="transition hover:bg-slate-50">
                    <td className={tdClass}>
                      <Link href={`/orders/${order.id}`} className="font-semibold text-[#4442e3] hover:underline">
                        {order.orderNo}
                      </Link>
                    </td>
                    <td className={tdClass}>{order.customerName}</td>
                    <td className={tdClass + " text-right"}>{order._count ? itemCount(order) : "--"}</td>
                    <td className={tdClass}>
                      <StatusBadge status={order.status} />
                    </td>
                    <td className={tdClass + " text-right font-semibold"}>{money(orderTotal(order))}</td>
                    <td className={tdClass}>{dateShort(order.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatusRow({
  label,
  ok,
  value,
  neutral = false,
}: {
  label: string;
  ok: boolean;
  value: string;
  neutral?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-medium text-slate-700">{label}</span>
      <span className={neutral ? "text-slate-500" : ok ? "text-emerald-600" : "text-red-600"}>{value}</span>
    </div>
  );
}
