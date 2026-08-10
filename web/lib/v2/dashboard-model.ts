import { can, scopeOf } from "@/lib/permissions";
import type { AuthUser, OrderSummary } from "@/lib/types";
import { buildV2Navigation } from "./navigation";

export const DASHBOARD_MONTH_COUNT = 6;

export interface DashboardMonth {
  key: string;
  label: string;
  value: number;
  count: number;
}

export interface DashboardPrimaryAction {
  label: string;
  href: string;
}

export type DashboardAudience = "organisation" | "personal" | "permission-limited";

/** Display the server's basket total, falling back to its legacy order total. */
export function orderTotal(order: OrderSummary): number {
  return order.basketTotal ?? order.totalPrice ?? 0;
}

/** Six UTC calendar-month buckets, oldest first. No price is derived here. */
export function dashboardMonths(
  orders: ReadonlyArray<OrderSummary>,
  now: Date = new Date(),
): DashboardMonth[] {
  const buckets: DashboardMonth[] = [];

  for (let offset = DASHBOARD_MONTH_COUNT - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    buckets.push({
      key: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }),
      value: 0,
      count: 0,
    });
  }

  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const order of orders) {
    if (order.status !== "confirmed") continue;
    const createdAt = new Date(order.createdAt);
    if (Number.isNaN(createdAt.valueOf())) continue;
    const key = `${createdAt.getUTCFullYear()}-${String(createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = byKey.get(key);
    if (!bucket) continue;
    bucket.value += orderTotal(order);
    bucket.count += 1;
  }

  return buckets;
}

/** Permission priority agreed in the Phase 2 dashboard content model. */
export function dashboardPrimaryAction(user: AuthUser): DashboardPrimaryAction | null {
  if (can(user, "quotes", "create")) {
    return { label: "New quote", href: "/v2/configure?mode=standard" };
  }
  if (can(user, "orders", "create")) {
    return { label: "Create an order", href: "/v2/orders" };
  }
  if (can(user, "orders", "read")) {
    return { label: "Review orders", href: "/v2/orders" };
  }

  const firstDestination = buildV2Navigation(user.nav)
    .flatMap((section) => section.items)
    .find((item) => item.href !== "/v2");

  return firstDestination
    ? { label: `Open ${firstDestination.label}`, href: firstDestination.href }
    : null;
}

export function dashboardAudience(user: AuthUser): DashboardAudience {
  if (!can(user, "orders", "read")) return "permission-limited";
  return scopeOf(user, "orders") === "ALL" ? "organisation" : "personal";
}
