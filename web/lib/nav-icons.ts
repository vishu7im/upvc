// =====================================================================
// Nav-icon key → local Icon component name (PLAN §7.1). Module.navIcon stores a
// stable string KEY (data); this map resolves it to a drawn icon. A brand-new
// icon is a one-line addition here; label/path/order/visibility stay pure data.
// =====================================================================

import type { IconName } from "@/components/icons";

const MAP: Record<string, IconName> = {
  dashboard: "dashboard",
  products: "products",
  quote: "quote",
  customers: "user",
  orders: "orders",
  discounts: "tag",
  catalog: "catalog",
  settings: "settings",
  users: "user",
  roles: "admin",
  admin: "admin",
};

export function navIcon(key: string | null | undefined): IconName {
  return (key && MAP[key]) || "box";
}
