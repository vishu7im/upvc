import assert from "node:assert/strict";

const base = process.env.V2_BASE_URL ?? "http://127.0.0.1:3100";

async function get(path) {
  return fetch(new URL(path, base), { redirect: "manual" });
}

const chooser = await get("/");
assert.equal(chooser.status, 200);
const chooserHtml = await chooser.text();
assert.match(chooserHtml, /Choose your workspace/);
assert.match(chooserHtml, /Visit V1/);
assert.match(chooserHtml, /Visit V2/);

const preference = await get("/ui-version/v2?returnTo=%2Fv2%2Forders%3Fpage%3D2");
assert.equal(preference.status, 307);
assert.equal(new URL(preference.headers.get("location")).pathname, "/v2/orders");
const preferenceCookie = preference.headers.get("set-cookie") ?? "";
assert.match(preferenceCookie, /ui-version=v2/);
assert.doesNotMatch(preferenceCookie, /HttpOnly/i);

const unsafePreference = await get("/ui-version/v2?returnTo=%2F%2Fevil.example%2Fsteal");
assert.equal(unsafePreference.status, 307);
assert.equal(new URL(unsafePreference.headers.get("location")).pathname, "/");

const v1ProtectedRoutes = [
  "/v1",
  "/products",
  "/products/example",
  "/quote",
  "/designer",
  "/orders",
  "/orders/example",
  "/account",
  "/admin",
  "/admin/settings",
  "/admin/catalog",
  "/admin/discounts",
  "/admin/users",
  "/admin/users/example",
  "/admin/roles",
  "/admin/roles/example",
];

for (const path of v1ProtectedRoutes) {
  const response = await get(path);
  assert.equal(response.status, 307, `V1 route did not resolve through its auth guard: ${path}`);
  assert.equal(response.headers.get("location"), "/login", `V1 auth redirect changed: ${path}`);
}

const v1AliasRoutes = v1ProtectedRoutes
  .filter((path) => path !== "/v1")
  .map((path) => `/v1${path}`);
for (const path of v1AliasRoutes) {
  const response = await get(path);
  assert.equal(response.status, 307, `V1 alias did not resolve: ${path}`);
  assert.equal(response.headers.get("location"), "/login", `V1 alias auth redirect changed: ${path}`);
}

const v2Routes = [
  "/v2",
  "/v2/products",
  "/v2/products/example",
  "/v2/configure?mode=standard",
  "/v2/configure?mode=custom",
  "/v2/orders",
  "/v2/orders/example",
  "/v2/orders/example/items",
  "/v2/orders/example/customer-price",
  "/v2/orders/example/documents",
  "/v2/account",
  "/v2/manage/settings/company",
  "/v2/manage/settings/financial",
  "/v2/manage/catalog-pricing",
  "/v2/manage/discounts",
  "/v2/manage/team",
  "/v2/manage/team/example",
  "/v2/manage/roles",
  "/v2/manage/roles/example",
];

for (const path of v2Routes) {
  const response = await get(path);
  assert.equal(response.status, 307, `V2 route did not resolve through its auth guard: ${path}`);
  assert.equal(response.headers.get("location"), "/login", `V2 auth redirect changed: ${path}`);
}

const login = await get("/login");
assert.equal(login.status, 200);
const changePassword = await get("/change-password");
assert.equal(changePassword.status, 307);
assert.equal(changePassword.headers.get("location"), "/login");

console.log(
  `V2 runtime checks passed (${v1ProtectedRoutes.length + 2} V1 routes, ${v1AliasRoutes.length} aliases, ${v2Routes.length} V2 routes).`,
);
