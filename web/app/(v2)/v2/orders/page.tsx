import Link from "next/link";
import { Button, ButtonLink, Card, Cluster, DataTable, PageFrame, PageHeading, Stack, StatusChip, TextField } from "@/components/v2";
import { requirePagePermission } from "@/lib/authz";
import { dateShort, money } from "@/lib/format";
import { can } from "@/lib/permissions";
import { serverApiGet } from "@/lib/server-api";
import type { OrderSummary, Paginated } from "@/lib/types";
import {
  orderGrandTotal,
  orderItemCount,
  ordersHref,
  orderStatusFilter,
  positivePage,
  type OrderStatusFilter,
} from "@/lib/v2/orders";
import { NewOrderAction } from "./_components/order-actions";

export const dynamic = "force-dynamic";

const STATUS_TABS: ReadonlyArray<{ value: OrderStatusFilter; label: string }> = [
  { value: "", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "confirmed", label: "Confirmed" },
];

const ORDER_COLUMNS = [
  { id: "order", header: "Order", role: "identity" as const, cell: (order: OrderSummary) => order.orderNo },
  { id: "customer", header: "Customer", cell: (order: OrderSummary) => order.customerName },
  {
    id: "status",
    header: "Status",
    role: "status" as const,
    cell: (order: OrderSummary) => <StatusChip label={order.status === "draft" ? "Draft" : "Confirmed"} tone={order.status === "draft" ? "warning" : "success"} />,
  },
  { id: "items", header: "Items", role: "number" as const, cell: (order: OrderSummary) => orderItemCount(order) },
  { id: "total", header: "Total", role: "number" as const, cell: (order: OrderSummary) => money(orderGrandTotal(order)) },
  { id: "created", header: "Created", role: "date" as const, cell: (order: OrderSummary) => dateShort(order.createdAt) },
] as const;

export default async function V2OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const user = await requirePagePermission("orders", "read");
  const parameters = await searchParams;
  const page = positivePage(parameters.page);
  const queryText = (parameters.q ?? "").trim();
  const status = orderStatusFilter(parameters.status);
  const apiQuery = new URLSearchParams({ page: String(page), limit: "20" });
  if (queryText) apiQuery.set("q", queryText);
  if (status) apiQuery.set("status", status);

  let result: Paginated<OrderSummary> | null = null;
  let loadError: string | null = null;
  try {
    result = await serverApiGet<Paginated<OrderSummary>>(`/api/orders?${apiQuery.toString()}`);
  } catch (caught) {
    loadError = caught instanceof Error ? caught.message : "The orders service did not respond.";
  }

  const filtered = Boolean(queryText || status);
  const total = result?.pagination.total ?? 0;

  return (
    <PageFrame width="wide">
      <Stack gap="section">
        <PageHeading
          actions={can(user, "orders", "create") ? <NewOrderAction /> : undefined}
          description={result ? `${total} ${filtered ? "matching" : "total"} ${total === 1 ? "order" : "orders"}.` : "Find and manage scoped orders."}
          eyebrow="Order management"
          title="Orders"
        />

        <Card elevation="flat">
          <div className="v2-order-toolbar">
            <form action="/v2/orders" method="get" role="search">
              {status ? <input name="status" type="hidden" value={status} /> : null}
              <TextField
                defaultValue={queryText}
                label="Search orders"
                name="q"
                placeholder="Order number, customer, or reference"
                type="search"
              />
              <Button icon="search" type="submit" variant="secondary">Search</Button>
            </form>
            <nav aria-label="Filter orders by status" className="v2-order-filter-tabs">
              {STATUS_TABS.map((tab) => (
                <Link
                  aria-current={status === tab.value ? "page" : undefined}
                  data-v2-active={status === tab.value || undefined}
                  href={ordersHref({ query: queryText, status: tab.value })}
                  key={tab.value || "all"}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          </div>
        </Card>

        <DataTable
          caption="Orders"
          columns={ORDER_COLUMNS}
          empty={{
            title: filtered ? "No orders match those filters" : "No orders yet",
            description: filtered
              ? "Try a different search, status, or clear the filters."
              : "Create a draft order, add configured items, then confirm it to generate documents.",
          }}
          getRowHref={(order) => `/v2/orders/${encodeURIComponent(order.id)}`}
          getRowKey={(order) => order.id}
          getRowLabel={(order) => `Open ${order.orderNo} for ${order.customerName}`}
          rows={result?.data ?? []}
          state={loadError ? {
            status: "error",
            title: "Orders could not be loaded",
            description: loadError,
            recovery: { label: "Try again", href: ordersHref({ page, query: queryText, status }) },
          } : { status: "ready" }}
        />

        {result && result.pagination.pages > 1 ? (
          <nav aria-label="Orders pagination" className="v2-order-pager">
            <span>Page {result.pagination.page} of {result.pagination.pages}</span>
            <Cluster>
              {page > 1 ? <ButtonLink href={ordersHref({ page: page - 1, query: queryText, status })} variant="secondary">Previous</ButtonLink> : null}
              {page < result.pagination.pages ? <ButtonLink href={ordersHref({ page: page + 1, query: queryText, status })} variant="secondary">Next</ButtonLink> : null}
            </Cluster>
          </nav>
        ) : null}
      </Stack>
    </PageFrame>
  );
}
