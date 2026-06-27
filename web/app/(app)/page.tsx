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

const chartBars = [34, 42, 38, 54, 62, 58, 74, 68, 82, 77, 88, 92];

export default async function Dashboard() {
  const user = await getCurrentUser();

  const [systemsResult, productsResult, ordersResult] = await Promise.allSettled([
    serverApiGet<SystemSummary[]>("/api/systems"),
    serverApiGet<Paginated<ProductSummary>>("/api/products?page=1&limit=6"),
    serverApiGet<Paginated<OrderSummary>>("/api/orders?page=1&limit=5"),
  ]);

  const systems = systemsResult.status === "fulfilled" ? systemsResult.value : null;
  const products = productsResult.status === "fulfilled" ? productsResult.value : null;
  const orders = ordersResult.status === "fulfilled" ? ordersResult.value : null;
  const connected = Boolean(systems);

  const recentOrders = orders?.data ?? [];
  const confirmed = recentOrders.filter((o) => o.status === "confirmed");
  const drafts = recentOrders.filter((o) => o.status === "draft");
  const revenue = confirmed.reduce((sum, order) => sum + (order.totalPrice ?? 0), 0);
  const orderItems = recentOrders.reduce((sum, order) => sum + (order._count?.items ?? 0), 0);

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
        <MetricCard label="Recent revenue" value={money(revenue)} icon="chart" tone="green" />
        <MetricCard label="Draft workload" value={drafts.length} delta={`${orderItems} items`} icon="orders" tone="amber" />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <SectionHeader
            title="Revenue and production flow"
            description="Recent order value and fabrication throughput indicators"
            actions={
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#4442e3]" /> Revenue
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-400" /> Units
                </span>
              </div>
            }
          />
          <div className="chart-grid relative h-80 px-6 pb-7 pt-8">
            <div className="absolute inset-x-6 bottom-7 flex h-56 items-end gap-3">
              {chartBars.map((height, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-2">
                  <div className="relative h-full w-full rounded-t-md bg-[#4442e3]/12">
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-t-md bg-[#4442e3] shadow-[0_8px_20px_rgba(68,66,227,0.2)]"
                      style={{ height: `${height}%` }}
                    />
                    <div
                      className="absolute bottom-0 left-[48%] right-[18%] rounded-t-md bg-blue-400"
                      style={{ height: `${Math.max(18, height - 16)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-400">{index + 1}</span>
                </div>
              ))}
            </div>
            <div className="absolute left-6 top-7 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
              {confirmed.length} confirmed orders in latest batch
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <SectionHeader title="Quick actions" description="High-frequency fabrication workflows" />
            <div className="grid grid-cols-2 gap-3 p-4">
              {[
                { href: "/quote", label: "New quote", icon: "quote" },
                { href: "/products", label: "Catalog", icon: "products" },
                { href: "/orders", label: "Orders", icon: "orders" },
                { href: "/admin", label: "Admin", icon: "admin" },
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
                <p className="text-xs font-semibold uppercase text-slate-500">System health</p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">
                  {connected ? "All services nominal" : "Backend unavailable"}
                </h2>
              </div>
              <span className={connected ? "mt-1 h-3 w-3 rounded-full bg-emerald-500" : "mt-1 h-3 w-3 rounded-full bg-red-500"} />
            </div>
            <div className="mt-5 space-y-3">
              {["Production API", "Pricing catalog", "Document generation"].map((service, index) => (
                <div key={service} className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium text-slate-700">{service}</span>
                  <span className={connected || index > 0 ? "text-emerald-600" : "text-red-600"}>
                    {connected ? "Online" : index === 0 ? "Offline" : "Waiting"}
                  </span>
                </div>
              ))}
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
                <th className={thClass}>Items</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Total</th>
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
                    <td className={tdClass}>{order._count?.items ?? "--"}</td>
                    <td className={tdClass}>
                      <StatusBadge status={order.status} />
                    </td>
                    <td className={tdClass}>{money(order.totalPrice)}</td>
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
