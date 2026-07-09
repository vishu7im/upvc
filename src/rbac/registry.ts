// =====================================================================
// src/rbac/registry.ts — the single source of truth for RBAC seed data.
//
// Modules (incl. their nav metadata), permission actions, the three system
// roles and their default permission grids live here as typed constants.
// Both the Phase-1 migration backfill SQL and prisma/seed.ts derive their
// inserts from this file, so a fresh install (migrate) and a reseed
// (db:seed / sync:permissions) converge on identical data.
//
// "Everything is data" (PLAN §2.1): adding a permission surface is one entry
// here → seeded Module row → it appears automatically in the role-grid editor,
// in /api/auth/me nav/permissions, and in the sidebar. The only code-level
// special case is the Super Admin bypass, keyed off Role.scope === "PLATFORM".
//
// NB: this file is PURE DATA + pure helpers — no I/O, no Prisma import — so it
// is safe to import from the engine-adjacent seed, the sync tool and the API.
// =====================================================================

/** Row-level data scope of a permission grant (mirrors the Prisma enum). */
export type DataScope = "OWN" | "ALL";

/** Role visibility scope (mirrors the Prisma enum). PLATFORM = Super Admin only. */
export type RoleScope = "PLATFORM" | "ORG";

// ---- Default (seed) organization ------------------------------------
// Created NOW so org FKs exist from day one (tenancy routing comes later —
// PLAN §9). Everything non-platform belongs to this org until tenancy lands.
export const DEFAULT_ORG = {
  slug: "default",
  name: "Default Organization",
} as const;

// ---- Modules --------------------------------------------------------
// One row per application module. `navPath: null` ⇒ permission-only module
// (no sidebar entry). `category` groups modules in the role editor (PLAN §3.4).
export interface ModuleDef {
  slug: string;
  name: string;
  navPath: string | null;
  navIcon: string | null;
  category: string | null;
  sortOrder: number;
}

export const MODULES: ModuleDef[] = [
  { slug: "dashboard", name: "Dashboard", navPath: "/", navIcon: "dashboard", category: "General", sortOrder: 0 },
  { slug: "products", name: "Products", navPath: "/products", navIcon: "products", category: "Inventory", sortOrder: 20 },
  { slug: "quotes", name: "Quotes", navPath: "/quote", navIcon: "quote", category: "Sales", sortOrder: 30 },
  // customers has no page yet ⇒ navPath null (permission-only until a page lands).
  { slug: "customers", name: "Customers", navPath: null, navIcon: "customers", category: "Sales", sortOrder: 35 },
  { slug: "orders", name: "Orders", navPath: "/orders", navIcon: "orders", category: "Sales", sortOrder: 40 },
  { slug: "catalog", name: "Catalog", navPath: "/admin/catalog", navIcon: "catalog", category: "Administration", sortOrder: 60 },
  { slug: "settings", name: "Settings", navPath: "/admin/settings", navIcon: "settings", category: "Administration", sortOrder: 70 },
  { slug: "users", name: "Users", navPath: "/admin/users", navIcon: "users", category: "Administration", sortOrder: 80 },
  { slug: "roles", name: "Roles", navPath: "/admin/roles", navIcon: "roles", category: "Administration", sortOrder: 90 },
];

// ---- Permission actions ---------------------------------------------
// Data, not a Prisma enum, so a new action ("export", "approve", …) is an
// INSERT rather than a migration (PLAN §3.2).
export interface ActionDef {
  slug: string;
  name: string;
  sortOrder: number;
}

export const ACTIONS: ActionDef[] = [
  { slug: "view", name: "View", sortOrder: 0 },
  { slug: "read", name: "Read", sortOrder: 10 },
  { slug: "create", name: "Create", sortOrder: 20 },
  { slug: "update", name: "Update", sortOrder: 30 },
  { slug: "delete", name: "Delete", sortOrder: 40 },
];

// ---- Roles + their default permission grids -------------------------
export interface GrantDef {
  /** module slug */
  module: string;
  /** action slugs granted for this module */
  actions: string[];
  /** data scope of every action in this grant */
  scope: DataScope;
}

export interface RoleDef {
  slug: string;
  name: string;
  description: string;
  scope: RoleScope;
  isSystem: boolean;
  /** true ⇒ organizationId is NULL (platform-level role, i.e. Super Admin) */
  platform: boolean;
  /** default grid; empty for Super Admin (bypass is structural, not a grid). */
  grants: GrantDef[];
}

/** Admin holds every action on every module, scope ALL — that is what makes
 *  them the company administrator (incl. users/roles). Derived so a new module
 *  automatically joins the admin grid on the next seed/sync. */
export const ADMIN_GRANTS: GrantDef[] = MODULES.map((m) => ({
  module: m.slug,
  actions: ACTIONS.map((a) => a.slug),
  scope: "ALL",
}));

/** Customer: read-only on dashboard/products; own quotes & orders (PLAN §3.3). */
export const CUSTOMER_GRANTS: GrantDef[] = [
  { module: "dashboard", actions: ["view", "read"], scope: "ALL" },
  { module: "products", actions: ["view", "read"], scope: "ALL" },
  { module: "quotes", actions: ["view", "read", "create"], scope: "OWN" },
  { module: "orders", actions: ["view", "read", "create"], scope: "OWN" },
];

export const ROLES: RoleDef[] = [
  {
    slug: "super-admin",
    name: "Super Admin",
    description: "Platform owner. Full, unconditional access (structural bypass).",
    scope: "PLATFORM",
    isSystem: true,
    platform: true,
    grants: [], // no grid — bypass is keyed off scope === "PLATFORM"
  },
  {
    slug: "admin",
    name: "Admin",
    description: "Company administrator. Full access to every module in the organization.",
    scope: "ORG",
    isSystem: true,
    platform: false,
    grants: ADMIN_GRANTS,
  },
  {
    slug: "customer",
    name: "Customer",
    description: "Self-service user: browse products, create and view own quotes and orders.",
    scope: "ORG",
    isSystem: true,
    platform: false,
    grants: CUSTOMER_GRANTS,
  },
];

// The legacy `User.role` free-form string (and its dual-write helpers) were
// DROPPED in Phase 6 — `roleId` is now the single source of role truth.
