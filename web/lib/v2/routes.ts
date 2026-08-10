export type UiVersion = "v1" | "v2";

export const UI_VERSION_COOKIE = "ui-version";

type SearchSource = Pick<URLSearchParams, "get">;

function queryFor(source: SearchSource, keys: ReadonlyArray<string>, seed?: Record<string, string>) {
  const query = new URLSearchParams(seed);
  for (const key of keys) {
    const value = source.get(key);
    if (value) query.set(key, value);
  }
  return query;
}

function withQuery(pathname: string, query: URLSearchParams): string {
  const value = query.toString();
  return value ? `${pathname}?${value}` : pathname;
}

function canonicalV1Path(pathname: string): string {
  if (pathname === "/v1") return "/";
  return pathname.startsWith("/v1/") ? pathname.slice(3) : pathname;
}

export function versionSwitchTarget(
  target: UiVersion,
  pathname: string,
  search: SearchSource,
): string {
  if (target === "v2") {
    const v1Path = canonicalV1Path(pathname);

    if (v1Path === "/") return "/v2";
    if (v1Path === "/products") {
      return withQuery("/v2/products", queryFor(search, ["page", "orderId"]));
    }
    if (/^\/products\/[^/]+$/.test(v1Path)) {
      return withQuery(`/v2${v1Path}`, queryFor(search, ["page", "orderId"]));
    }
    if (v1Path === "/quote") {
      return withQuery(
        "/v2/configure",
        queryFor(search, ["designId", "systemId", "productId", "orderId"], { mode: "standard" }),
      );
    }
    if (v1Path === "/designer") {
      return withQuery(
        "/v2/configure",
        queryFor(search, ["family", "design", "system", "orderId", "itemId", "fromItem"], { mode: "custom" }),
      );
    }
    if (v1Path === "/orders") {
      return withQuery("/v2/orders", queryFor(search, ["page", "q", "status"]));
    }
    if (/^\/orders\/[^/]+$/.test(v1Path)) return `/v2${v1Path}`;
    if (v1Path === "/account") return "/v2/account";
    if (v1Path === "/admin") return "/v2";
    if (v1Path === "/admin/settings") return "/v2/manage/settings/company";
    if (v1Path === "/admin/catalog") {
      return withQuery("/v2/manage/catalog-pricing", queryFor(search, ["systemId"]));
    }
    if (v1Path === "/admin/discounts") return "/v2/manage/discounts";
    if (v1Path === "/admin/users") return "/v2/manage/team";
    if (/^\/admin\/users\/[^/]+$/.test(v1Path)) {
      return v1Path.replace("/admin/users/", "/v2/manage/team/");
    }
    if (v1Path === "/admin/roles") return "/v2/manage/roles";
    if (/^\/admin\/roles\/[^/]+$/.test(v1Path)) return `/v2/manage${v1Path.slice(6)}`;
    return "/v2";
  }

  if (pathname === "/v2") return "/v1";
  if (pathname === "/v2/products") {
    return withQuery("/products", queryFor(search, ["page", "orderId"]));
  }
  if (/^\/v2\/products\/[^/]+$/.test(pathname)) {
    return withQuery(pathname.slice(3), queryFor(search, ["page", "orderId"]));
  }
  if (pathname === "/v2/configure") {
    const custom = search.get("mode") === "custom";
    if (custom) {
      return withQuery(
        "/designer",
        queryFor(search, ["family", "design", "system", "orderId", "itemId", "fromItem"]),
      );
    }
    const query = queryFor(search, ["productId", "orderId"]);
    const designId = search.get("designId") ?? search.get("design");
    const systemId = search.get("systemId") ?? search.get("system");
    if (designId) query.set("designId", designId);
    if (systemId) query.set("systemId", systemId);
    return withQuery("/quote", query);
  }
  if (pathname === "/v2/orders") {
    return withQuery("/orders", queryFor(search, ["page", "q", "status"]));
  }
  const orderMatch = pathname.match(/^\/v2\/orders\/([^/]+)(?:\/(?:items|customer-price|documents))?$/);
  if (orderMatch) return `/orders/${orderMatch[1]}`;
  if (pathname === "/v2/account") return "/account";
  if (pathname === "/v2/manage/settings/company" || pathname === "/v2/manage/settings/financial") {
    return "/admin/settings";
  }
  if (pathname === "/v2/manage/catalog-pricing") {
    return withQuery("/admin/catalog", queryFor(search, ["systemId"]));
  }
  if (pathname === "/v2/manage/discounts") return "/admin/discounts";
  if (pathname === "/v2/manage/team") return "/admin/users";
  if (/^\/v2\/manage\/team\/[^/]+$/.test(pathname)) {
    return pathname.replace("/v2/manage/team/", "/admin/users/");
  }
  if (pathname === "/v2/manage/roles") return "/admin/roles";
  if (/^\/v2\/manage\/roles\/[^/]+$/.test(pathname)) {
    return pathname.replace("/v2/manage/roles/", "/admin/roles/");
  }
  return "/v1";
}

export function versionPreferenceHref(version: UiVersion, returnTo: string): string {
  return `/ui-version/${version}?returnTo=${encodeURIComponent(returnTo)}`;
}

export function isVersionReturnTarget(version: UiVersion, value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return false;

  const pathname = new URL(value, "https://fabricator.invalid").pathname;
  if (version === "v2") return pathname === "/v2" || pathname.startsWith("/v2/");

  return [
    /^\/v1$/,
    /^\/products(?:\/[^/]+)?$/,
    /^\/quote$/,
    /^\/designer$/,
    /^\/orders(?:\/[^/]+)?$/,
    /^\/account$/,
    /^\/admin$/,
    /^\/admin\/(?:settings|catalog|discounts|users|roles)$/,
    /^\/admin\/(?:users|roles)\/[^/]+$/,
  ].some((pattern) => pattern.test(pathname));
}
