import Link from "next/link";
import type { ReactNode } from "react";
import { Card, PageFrame, PageHeading, Stack, StatusChip } from "@/components/v2";
import { dateShort, money } from "@/lib/format";
import type { OrderDetail } from "@/lib/types";
import { orderGrandTotal, orderItemCount } from "@/lib/v2/orders";

export type OrderSection = "overview" | "items" | "customer-price" | "documents";

const ORDER_SECTIONS: ReadonlyArray<{ id: OrderSection; label: string; suffix: string }> = [
  { id: "overview", label: "Overview", suffix: "" },
  { id: "items", label: "Items", suffix: "/items" },
  { id: "customer-price", label: "Customer price", suffix: "/customer-price" },
  { id: "documents", label: "Documents", suffix: "/documents" },
];

export function OrderPageChrome({
  actions,
  children,
  current,
  order,
}: {
  actions?: ReactNode;
  children: ReactNode;
  current: OrderSection;
  order: OrderDetail;
}) {
  const count = orderItemCount(order);
  const total = orderGrandTotal(order);
  const currency = order.basket?.currency ?? "GBP";

  return (
    <PageFrame width="wide">
      <Stack gap="section">
        <PageHeading
          actions={actions}
          description={`${order.customerName} · Created ${dateShort(order.createdAt)}`}
          eyebrow={order.status === "draft" ? "Draft order" : "Confirmed order"}
          title={order.orderNo}
        />

        <Card elevation="flat">
          <dl className="v2-order-facts">
            <div>
              <dt>Status</dt>
              <dd><StatusChip label={order.status === "draft" ? "Draft" : "Confirmed"} tone={order.status === "draft" ? "warning" : "success"} /></dd>
            </div>
            <div>
              <dt>Customer</dt>
              <dd>{order.customerName}</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd>{order.reference || "Not provided"}</dd>
            </div>
            <div>
              <dt>Items</dt>
              <dd>{count}</dd>
            </div>
            <div>
              <dt>Grand total</dt>
              <dd>{money(total, currency)}</dd>
            </div>
          </dl>
        </Card>

        <nav aria-label={`${order.orderNo} sections`} className="v2-order-tabs">
          {ORDER_SECTIONS.map((section) => (
            <Link
              aria-current={section.id === current ? "page" : undefined}
              href={`/v2/orders/${encodeURIComponent(order.id)}${section.suffix}`}
              key={section.id}
            >
              {section.label}
            </Link>
          ))}
        </nav>

        {children}
      </Stack>
    </PageFrame>
  );
}
