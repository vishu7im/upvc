import assert from "node:assert/strict";
import type { DashboardGet } from "../lib/v2/dashboard-data";
import { loadDashboardData } from "../lib/v2/dashboard-data";
import {
  dashboardAudience,
  dashboardMonths,
  dashboardPrimaryAction,
  orderTotal,
} from "../lib/v2/dashboard-model";
import type { AuthUser, NavItem, OrderSummary, Paginated } from "../lib/types";

async function main() {
const now = new Date("2026-08-07T12:00:00.000Z");

function order(
  id: string,
  createdAt: string,
  totalPrice: number | null,
  basketTotal?: number | null,
  status: OrderSummary["status"] = "confirmed",
): OrderSummary {
  return {
    id,
    orderNo: `ORD-${id}`,
    customerName: `Customer ${id}`,
    reference: null,
    status,
    totalPrice,
    basketTotal,
    createdAt,
  };
}

function page(
  data: OrderSummary[],
  total = data.length,
  pageNumber = 1,
  limit = 100,
  pages = 1,
): Paginated<OrderSummary> {
  return { data, pagination: { total, page: pageNumber, limit, pages } };
}

const augustBasket = order("aug", "2026-08-01T00:00:00.000Z", 100, 125);
const marchFallback = order("mar", "2026-03-01T00:00:00.000Z", 80, null);
const februaryOutsideWindow = order("feb", "2026-02-28T23:59:59.999Z", 999, 999);

assert.equal(orderTotal(augustBasket), 125);
assert.equal(orderTotal(marchFallback), 80);
assert.equal(orderTotal(order("none", "2026-08-01T00:00:00.000Z", null)), 0);

const directMonths = dashboardMonths(
  [augustBasket, marchFallback, februaryOutsideWindow],
  now,
);
assert.deepEqual(directMonths.map((month) => month.key), [
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
]);
assert.equal(directMonths[0]?.value, 80);
assert.equal(directMonths[5]?.value, 125);
assert.equal(directMonths.reduce((sum, month) => sum + month.value, 0), 205);

const requests: string[] = [];
const recent = Array.from({ length: 6 }, (_, index) =>
  order(`recent-${index}`, `2026-08-0${Math.min(index + 1, 9)}T00:00:00.000Z`, index + 1),
);
const responses = new Map<string, Paginated<OrderSummary>>([
  ["/api/orders?status=draft&page=1&limit=1", page([], 7, 1, 1)],
  ["/api/orders?status=confirmed&page=1&limit=1", page([], 203, 1, 1)],
  ["/api/orders?page=1&limit=5", page(recent, 6, 1, 5, 2)],
  ["/api/orders?status=confirmed&page=1&limit=100", page([augustBasket], 203, 1, 100, 3)],
  ["/api/orders?status=confirmed&page=2&limit=100", page([marchFallback], 203, 2, 100, 3)],
  ["/api/orders?status=confirmed&page=3&limit=100", page([februaryOutsideWindow], 203, 3, 100, 3)],
]);

const get: DashboardGet = async <T>(path: string): Promise<T> => {
  requests.push(path);
  const response = responses.get(path);
  assert.ok(response, `Unexpected dashboard request: ${path}`);
  return response as T;
};

const loaded = await loadDashboardData(get, now);
assert.equal(loaded.draftCount, 7);
assert.equal(loaded.confirmedCount, 203);
assert.equal(loaded.confirmedValue, 205);
assert.equal(loaded.recentOrders.length, 5);
assert.deepEqual(requests.slice(-2), [
  "/api/orders?status=confirmed&page=2&limit=100",
  "/api/orders?status=confirmed&page=3&limit=100",
]);

const home: NavItem = {
  slug: "dashboard",
  name: "Dashboard",
  path: "/",
  icon: null,
  sortOrder: 0,
};
const products: NavItem = {
  slug: "products",
  name: "Products",
  path: "/products",
  icon: null,
  sortOrder: 20,
};

function actor(
  permissions: AuthUser["permissions"],
  nav: NavItem[] = [home],
): AuthUser {
  return {
    id: "fixture",
    email: "fixture@example.test",
    name: "Fixture",
    isActive: true,
    mustChangePassword: false,
    role: null,
    isSuperAdmin: false,
    incomingApprovals: 0,
    permissions,
    nav,
  };
}

const quoteCreate = actor({ quotes: { actions: ["create"], scope: "OWN" } });
assert.deepEqual(dashboardPrimaryAction(quoteCreate), {
  label: "New quote",
  href: "/v2/configure?mode=standard",
});

const orderCreate = actor({ orders: { actions: ["read", "create"], scope: "OWN" } });
assert.equal(dashboardPrimaryAction(orderCreate)?.label, "Create an order");

const orderRead = actor({ orders: { actions: ["read"], scope: "OWN" } });
assert.equal(dashboardPrimaryAction(orderRead)?.label, "Review orders");

const navFallback = actor({}, [home, products]);
assert.deepEqual(dashboardPrimaryAction(navFallback), {
  label: "Open Products",
  href: "/v2/products",
});
assert.equal(dashboardPrimaryAction(actor({})), null);

assert.equal(
  dashboardAudience(actor({ orders: { actions: ["read"], scope: "ALL" } })),
  "organisation",
);
assert.equal(dashboardAudience(orderRead), "personal");
assert.equal(dashboardAudience(actor({})), "permission-limited");

console.log(
  "V2 dashboard contract checks passed (permission priority, scope variants, UTC buckets, all-page aggregation, server total fallback).",
);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
