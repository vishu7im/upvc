import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { Header, Sidebar } from "../components/v2";
import { DashboardHome } from "../app/(v2)/v2/dashboard-view";
import type { DashboardData } from "../lib/v2/dashboard-data";
import {
  dashboardAudience,
  dashboardMonths,
  dashboardPrimaryAction,
} from "../lib/v2/dashboard-model";
import { buildV2Navigation } from "../lib/v2/navigation";
import type { AuthUser, OrderSummary, PermissionsMap } from "../lib/types";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(webRoot, "../Spec/v2/dashboard");
const now = new Date("2026-08-07T12:00:00.000Z");

const workNav = [
  { slug: "dashboard", name: "Dashboard", path: "/", icon: null, sortOrder: 0 },
  { slug: "products", name: "Products", path: "/products", icon: null, sortOrder: 20 },
  { slug: "quotes", name: "Quotes", path: "/quote", icon: null, sortOrder: 30 },
  { slug: "orders", name: "Orders", path: "/orders", icon: null, sortOrder: 40 },
];

const manageNav = [
  { slug: "catalog", name: "Catalog", path: "/admin/catalog", icon: null, sortOrder: 60 },
  { slug: "users", name: "Users", path: "/admin/users", icon: null, sortOrder: 80 },
];

function fixtureUser({
  name,
  orderScope,
  approvals,
  includeManage,
}: {
  name: string;
  orderScope: "OWN" | "ALL";
  approvals: number;
  includeManage: boolean;
}): AuthUser {
  const permissions: PermissionsMap = {
    dashboard: { actions: ["view", "read"], scope: "ALL" },
    products: { actions: ["view", "read"], scope: "ALL" },
    quotes: { actions: ["view", "read", "create"], scope: orderScope },
    orders: { actions: ["view", "read", "create"], scope: orderScope },
  };
  if (includeManage) {
    permissions.catalog = { actions: ["view", "read", "update"], scope: "ALL" };
    permissions.users = { actions: ["view", "read", "create"], scope: "ALL" };
  }
  return {
    id: name.toLocaleLowerCase().replace(/\s+/g, "-"),
    email: `${name.toLocaleLowerCase().replace(/\s+/g, ".")}@example.test`,
    name,
    isActive: true,
    mustChangePassword: false,
    role: null,
    isSuperAdmin: false,
    incomingApprovals: approvals,
    permissions,
    nav: includeManage ? [...workNav, ...manageNav] : workNav,
  };
}

function fixtureOrder(
  id: string,
  status: OrderSummary["status"],
  customerName: string,
  total: number,
  createdAt: string,
): OrderSummary {
  return {
    id,
    orderNo: `ORD-${id.padStart(4, "0")}`,
    customerName,
    reference: null,
    status,
    totalPrice: total,
    basketTotal: total,
    createdAt,
  };
}

function dashboardData(orders: OrderSummary[], draftCount: number, confirmedCount: number): DashboardData {
  const months = dashboardMonths(orders, now);
  return {
    draftCount,
    confirmedCount,
    confirmedValue: months.reduce((sum, month) => sum + month.value, 0),
    months,
    recentOrders: [...orders].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 5),
  };
}

const organisationUser = fixtureUser({
  name: "Alex Morgan",
  orderScope: "ALL",
  approvals: 2,
  includeManage: true,
});
const personalUser = fixtureUser({
  name: "Taylor Reed",
  orderScope: "OWN",
  approvals: 0,
  includeManage: false,
});

const organisationOrders = [
  fixtureOrder("1042", "draft", "Northstar Homes", 1840, "2026-08-06T10:00:00.000Z"),
  fixtureOrder("1041", "confirmed", "Greenway Build", 4260, "2026-08-04T10:00:00.000Z"),
  fixtureOrder("1038", "confirmed", "Aster Projects", 3180, "2026-07-16T10:00:00.000Z"),
  fixtureOrder("1027", "confirmed", "Stone & Beam", 2410, "2026-05-12T10:00:00.000Z"),
  fixtureOrder("1015", "confirmed", "Riverside Works", 1975, "2026-03-21T10:00:00.000Z"),
];
const personalOrders = [
  fixtureOrder("2042", "draft", "Willow House", 920, "2026-08-05T10:00:00.000Z"),
  fixtureOrder("2039", "confirmed", "Elm Court", 1540, "2026-07-10T10:00:00.000Z"),
  fixtureOrder("2024", "confirmed", "Orchard View", 1280, "2026-04-18T10:00:00.000Z"),
];

function shell(user: AuthUser, content: React.ReactNode): React.ReactNode {
  return (
    <div className="v2-root" data-v2>
      <div className="v2-app-shell">
        <Sidebar
          activeHref="/v2"
          brand={{ name: "FabricatorOS", descriptor: "uPVC fabrication" }}
          sections={buildV2Navigation(user.nav)}
          versionLink={{ label: "Switch to V1", href: "/ui-version/v1?returnTo=%2Fv1" }}
        />
        <div className="v2-shell-main">
          <Header
            breadcrumbs={[{ label: "Home" }]}
            menuControl={{ label: "Open navigation", onSelect: () => undefined }}
            notifications={{ count: user.incomingApprovals, href: "/v2/account", label: "Account approvals" }}
            profile={{
              context: dashboardAudience(user) === "organisation" ? "Organisation orders" : "Own orders",
              href: "/v2/account",
              label: "Open account",
              name: user.name,
            }}
          />
          <div className="v2-shell-content">{content}</div>
        </div>
      </div>
    </div>
  );
}

function document(markup: string, title: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <link rel="stylesheet" href="../../../web/app/v2.css">
  </head>
  <body data-v2>${markup}</body>
</html>
`;
}

function readyDocument(user: AuthUser, data: DashboardData, title: string): string {
  return document(renderToStaticMarkup(shell(user, (
    <DashboardHome
      audience={dashboardAudience(user)}
      content={{ status: "ready", data }}
      incomingApprovals={user.incomingApprovals}
      primaryAction={dashboardPrimaryAction(user)}
      userName={user.name}
    />
  ))), title);
}

mkdirSync(outputRoot, { recursive: true });
writeFileSync(
  resolve(outputRoot, "organisation-scope.html"),
  readyDocument(
    organisationUser,
    dashboardData(organisationOrders, 4, 12),
    "V2 Home — organisation scope",
  ),
);
writeFileSync(
  resolve(outputRoot, "personal-scope.html"),
  readyDocument(
    personalUser,
    dashboardData(personalOrders, 1, 2),
    "V2 Home — personal scope",
  ),
);
writeFileSync(
  resolve(outputRoot, "empty.html"),
  document(renderToStaticMarkup(shell(personalUser, (
    <DashboardHome
      audience={dashboardAudience(personalUser)}
      content={{ status: "ready", data: dashboardData([], 0, 0) }}
      incomingApprovals={0}
      primaryAction={dashboardPrimaryAction(personalUser)}
      userName={personalUser.name}
    />
  ))), "V2 Home — empty state"),
);

console.log(`Rendered V2 dashboard evidence to ${outputRoot}`);
