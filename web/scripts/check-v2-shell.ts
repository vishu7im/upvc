import assert from "node:assert/strict";
import { activeNavigationPath, buildV2Navigation } from "../lib/v2/navigation";
import {
  isVersionReturnTarget,
  versionPreferenceHref,
  versionSwitchTarget,
} from "../lib/v2/routes";
import type { NavItem } from "../lib/types";

const customerNav: NavItem[] = [
  { slug: "one", name: "Dashboard", path: "/", icon: null, sortOrder: 0 },
  { slug: "two", name: "Products", path: "/products", icon: null, sortOrder: 20 },
  { slug: "three", name: "Quotes", path: "/quote", icon: null, sortOrder: 30 },
  { slug: "four", name: "Orders", path: "/orders", icon: null, sortOrder: 40 },
];

const customerSections = buildV2Navigation(customerNav);
assert.equal(customerSections.length, 1);
assert.equal(customerSections[0]?.id, "work");
assert.deepEqual(customerSections[0]?.items.map((item) => item.id), ["one", "two", "three", "four"]);

const changedGrantSections = buildV2Navigation(customerNav.slice(0, 2));
assert.deepEqual(changedGrantSections[0]?.items.map((item) => item.id), ["one", "two"]);
assert.equal(changedGrantSections.some((section) => section.id === "manage"), false);

const unknown = buildV2Navigation([
  { slug: "future", name: "Future module", path: "/future", icon: null, sortOrder: 100 },
]);
assert.deepEqual(unknown[0]?.items[0], {
  id: "future",
  label: "Future module",
  href: "/future",
  marker: "V1",
});
assert.equal(
  activeNavigationPath("/v2/manage/settings/financial"),
  "/v2/manage/settings/company",
);

assert.equal(
  versionSwitchTarget("v2", "/orders", new URLSearchParams("status=draft&q=Acme&page=2")),
  "/v2/orders?page=2&q=Acme&status=draft",
);
assert.equal(
  versionSwitchTarget("v2", "/designer", new URLSearchParams("family=door&orderId=o1")),
  "/v2/configure?mode=custom&family=door&orderId=o1",
);
assert.equal(
  versionSwitchTarget("v2", "/products/p1", new URLSearchParams("page=2&orderId=o1")),
  "/v2/products/p1?page=2&orderId=o1",
);
assert.equal(
  versionSwitchTarget("v1", "/v2/products/p1", new URLSearchParams("page=3&orderId=o2&mode=custom")),
  "/products/p1?page=3&orderId=o2",
);
assert.equal(
  versionSwitchTarget("v1", "/v2/orders/o1/documents", new URLSearchParams()),
  "/orders/o1",
);
assert.equal(
  versionSwitchTarget("v1", "/v2/manage/roles/r1", new URLSearchParams()),
  "/admin/roles/r1",
);
assert.equal(versionSwitchTarget("v1", "/v2/not-mapped", new URLSearchParams()), "/v1");
assert.equal(
  versionPreferenceHref("v2", "/v2/orders?page=2"),
  "/ui-version/v2?returnTo=%2Fv2%2Forders%3Fpage%3D2",
);
assert.equal(isVersionReturnTarget("v2", "/v2/orders/o1"), true);
assert.equal(isVersionReturnTarget("v1", "/admin/users/u1"), true);
assert.equal(isVersionReturnTarget("v2", "//example.com/steal"), false);
assert.equal(isVersionReturnTarget("v1", "/v2/orders"), false);

console.log("V2 shell contract checks passed (data-driven navigation, route preservation, safe preference targets).");
