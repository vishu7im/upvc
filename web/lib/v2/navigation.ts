import type { NavItem } from "@/lib/types";

export interface V2NavigationItem {
  id: string;
  label: string;
  href: string;
  marker?: string;
}

export interface V2NavigationSection {
  id: "work" | "manage";
  label: "Work" | "Manage";
  items: V2NavigationItem[];
}

const transformations: Record<
  string,
  { href: string; label: string; section: V2NavigationSection["id"] }
> = {
  "/": { href: "/v2", label: "Home", section: "work" },
  "/products": { href: "/v2/products", label: "Products", section: "work" },
  "/quote": { href: "/v2/configure?mode=standard", label: "Quote", section: "work" },
  "/orders": { href: "/v2/orders", label: "Orders", section: "work" },
  "/admin/discounts": { href: "/v2/manage/discounts", label: "Discounts", section: "manage" },
  "/admin/catalog": { href: "/v2/manage/catalog-pricing", label: "Catalog pricing", section: "manage" },
  "/admin/settings": { href: "/v2/manage/settings/company", label: "Settings", section: "manage" },
  "/admin/users": { href: "/v2/manage/team", label: "Team", section: "manage" },
  "/admin/roles": { href: "/v2/manage/roles", label: "Roles & access", section: "manage" },
};

export function buildV2Navigation(nav: ReadonlyArray<NavItem>): V2NavigationSection[] {
  const sections: Record<V2NavigationSection["id"], V2NavigationItem[]> = {
    work: [],
    manage: [],
  };

  for (const row of nav) {
    if (!row.path) continue;
    const known = transformations[row.path];
    const section = known?.section ?? (row.path.startsWith("/admin/") ? "manage" : "work");
    sections[section].push({
      id: row.slug,
      label: known?.label ?? row.name,
      href: known?.href ?? row.path,
      marker: known ? undefined : "V1",
    });
  }

  return [
    { id: "work", label: "Work", items: sections.work },
    { id: "manage", label: "Manage", items: sections.manage },
  ].filter((section) => section.items.length > 0) as V2NavigationSection[];
}

export function breadcrumbsForV2(pathname: string): Array<{ label: string; href?: string }> {
  if (pathname === "/v2") return [{ label: "Home" }];

  const crumbs: Array<{ label: string; href?: string }> = [{ label: "Home", href: "/v2" }];
  if (pathname.startsWith("/v2/products")) {
    crumbs.push({ label: "Products", href: pathname === "/v2/products" ? undefined : "/v2/products" });
    if (pathname !== "/v2/products") crumbs.push({ label: "Designs" });
    return crumbs;
  }
  if (pathname === "/v2/configure") return [...crumbs, { label: "Configure" }];
  if (pathname.startsWith("/v2/orders")) {
    crumbs.push({ label: "Orders", href: pathname === "/v2/orders" ? undefined : "/v2/orders" });
    const match = pathname.match(/^\/v2\/orders\/[^/]+(?:\/(items|customer-price|documents))?$/);
    if (match) {
      const overviewHref = pathname.replace(/\/(items|customer-price|documents)$/, "");
      crumbs.push({ label: "Order", href: match[1] ? overviewHref : undefined });
      if (match[1]) {
        const labels = { items: "Items", "customer-price": "Customer price", documents: "Documents" };
        crumbs.push({ label: labels[match[1] as keyof typeof labels] });
      }
    }
    return crumbs;
  }
  if (pathname === "/v2/account") return [...crumbs, { label: "Account" }];
  if (pathname.startsWith("/v2/manage/")) {
    crumbs.push({ label: "Manage" });
    if (pathname.includes("/settings/")) crumbs.push({ label: "Settings" });
    if (pathname.includes("catalog-pricing")) crumbs.push({ label: "Catalog pricing" });
    if (pathname.includes("discounts")) crumbs.push({ label: "Discounts" });
    if (pathname.includes("/team")) crumbs.push({ label: pathname === "/v2/manage/team" ? "Team" : "Person" });
    if (pathname.includes("/roles")) crumbs.push({ label: pathname === "/v2/manage/roles" ? "Roles & access" : "Role" });
    if (pathname.endsWith("/company")) crumbs.push({ label: "Company" });
    if (pathname.endsWith("/financial")) crumbs.push({ label: "Financial defaults" });
    return crumbs;
  }
  return crumbs;
}

export function activeNavigationPath(pathname: string): string {
  return pathname === "/v2/manage/settings/financial"
    ? "/v2/manage/settings/company"
    : pathname;
}
