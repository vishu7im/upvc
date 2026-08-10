# ROUTE MAPPING — V1 → V2

> **Finalised by Phase 2 on 2026-08-07.** This is the route contract for Phases 5–7. It contains
> no unresolved route branch. The Phase 2 decisions are recorded as D-008…D-017 in
> `../DECISIONS.md` and remain subject to the Phase 2 owner-approval gate.

## Coexistence and URL ownership

Under D-002 and D-015:

| URL | Serves |
|---|---|
| `/` | Version chooser: Visit V1 / Visit V2, with remembered preference |
| Existing V1 paths (`/orders/*`, `/products/*`, `/admin/*`, `/quote`, `/designer`, `/account`) | V1 directly and unchanged |
| `/v1/*` | Alias to the equivalent V1 route; `/v1` is the V1 dashboard because `/` is the chooser |
| `/v2/*` | V2 |
| `/api/*` | Shared BFF seam, unchanged |

There is **no redirect based on preference** during the coexistence period. Except for `/` (the
owner-mandated chooser), a legacy bookmark keeps opening V1. Preference affects only the root
chooser and explicit version-switch actions. Redirects may be reconsidered only at M13 if the owner
makes V2 the default; V1 stays available regardless.

**Phase 5 implementation note (D-021):** the public `/` contract is served by an internal rewrite
to `web/app/version-chooser/page.tsx`, because the frozen V1 dashboard source still occupies the
root filesystem route. `/v1` reuses that frozen page/layout and `/v1/*` internally aliases the
canonical V1 route. Browser-visible URLs follow the table above.

## Final route table

| # | V1 route | V1 purpose | V2 equivalent | Phase | Version-switch rule |
|---:|---|---|---|---:|---|
| 1 | `/login` | Sign in | `/login` shared | 5 | No switch; session is shared |
| 2 | `/change-password` | Forced password change | `/change-password` shared | 5 | No switch until complete |
| 3 | `/` | Dashboard | `/v2` Home | 6 | V1 Home ↔ V2 Home |
| 4 | `/products` | Product lines | `/v2/products` | 7 | Preserve `page` and active `orderId` context when present |
| 5 | `/products/[id]` | Design gallery | `/v2/products/[id]` | 7 | Preserve product ID, `page` and active `orderId` context |
| 6 | `/quote` | Simple configurator | `/v2/configure?mode=standard` | 7 | Preserve supported `designId`, `systemId`, `productId`, `orderId` context |
| 7 | `/designer` | Studio | `/v2/configure?mode=custom` | 7 | Preserve `family`, `design`, `system`, `orderId`, `itemId`, `fromItem` context |
| 8 | `/orders` | Order list | `/v2/orders` | 7 | Preserve `page`, `q`, `status` |
| 9 | `/orders/[id]` | Order detail | `/v2/orders/[id]` Overview | 7 | Preserve order ID |
| — | Order stacked items | Legacy + Designer item tables | `/v2/orders/[id]/items` unified list | 7 | V2 child → V1 order detail |
| — | Order pricing/extras | Commercial inputs + basket | `/v2/orders/[id]/customer-price` | 7 | V2 child → V1 order detail |
| — | Order documents | Seven outputs | `/v2/orders/[id]/documents` | 7 | V2 child → V1 order detail |
| 10 | `/account` | Profile + approvals | `/v2/account` | 7 | Preserve Account |
| 11 | `/admin` | Duplicate admin hub | `/v2` Home with the permission-derived Manage rail | 7 | V1 Admin → V2 Home; no duplicate V2 hub |
| 12 | `/admin/settings` | Financial + branding | `/v2/manage/settings/company` (default) and `/v2/manage/settings/financial` | 7 | V1 → Company; either V2 child → V1 settings |
| 13 | `/admin/catalog` | Catalog pricing editor | `/v2/manage/catalog-pricing` | 7 | Preserve `systemId` if supplied |
| 14 | `/admin/discounts` | Discount codes | `/v2/manage/discounts` | 7 | Preserve destination |
| 15 | `/admin/users` | Users | `/v2/manage/team` | 7 | Preserve destination |
| 16 | `/admin/users/[id]` | User detail | `/v2/manage/team/[id]` | 7 | Preserve user ID |
| 17 | `/admin/roles` | Roles | `/v2/manage/roles` | 7 | Preserve destination |
| 18 | `/admin/roles/[id]` | Permission grid | `/v2/manage/roles/[id]` | 7 | Preserve role ID |

`mode=standard` and `mode=custom` are presentation states of one V2 workspace, not separate
configurators. Existing V1 query parameters remain the compatibility contract. The V2-only `mode`
parameter does not alter an engine request or fabricate a new backend contract.

## Navigation transformation

`GET /api/auth/me` remains the sole menu-membership source. The V2 shell transforms only rows that
the server returned:

| Incoming path | V2 destination | Label/group |
|---|---|---|
| `/` | `/v2` | Home / Work |
| `/products` | `/v2/products` | Products / Work |
| `/quote` | `/v2/configure?mode=standard` | Quote / Work |
| `/orders` | `/v2/orders` | Orders / Work |
| `/admin/discounts` | `/v2/manage/discounts` | Discounts / Manage |
| `/admin/catalog` | `/v2/manage/catalog-pricing` | Catalog pricing / Manage |
| `/admin/settings` | `/v2/manage/settings/company` | Settings / Manage |
| `/admin/users` | `/v2/manage/team` | Team / Manage |
| `/admin/roles` | `/v2/manage/roles` | Roles & access / Manage |

Unknown future rows use their server label/icon and working V1 path with a visible V1 marker. This
fallback prevents the route adapter from becoming a second permission registry. A row absent from
`user.nav` is never created in the V2 rail.

## Resolved structural decisions

### Q-A — two entries, one workspace

`/quote` maps to Standard disclosure and `/designer` maps to Custom disclosure in the same V2
workspace. Both use family/design data and `POST /api/line-items/resolve`. The Standard view keeps
the simple capability; Custom discloses component editing, four views, structural actions and undo.
V1 retains both original screens.

### B-1 — no Designer RBAC module

Custom design is governed by the existing `quotes` permission and appears within the transformed
Quote destination. This closes the discoverability problem without changing `src/rbac/registry.ts`,
syncing permission data, or creating a second permission concept for the same quoting workspace.

### G-4 — Customers remains permission-only

`customers` has `navPath:null`, so `/api/auth/me` does not emit it. V2 renders no link and creates no
Customers route. A page would require a separately approved endpoint and product capability.

### O-29 — no V2 Admin hub

The V1 hub's five destinations remain directly reachable as incoming Manage rows. The duplicate
hub itself has no V2 route; version-switching from `/admin` lands on V2 Home with Manage visible.

## Rules for implementation

1. Never shadow or redirect a V1 path in a way that changes V1 behaviour.
2. Every V2 route is guarded server-side by the permission represented by its incoming nav row.
   Configure Standard and Custom both use `quotes`; order child routes use `orders`; Manage child
   routes use their respective module.
3. Deep links preserve the identifiers and existing query parameters listed above. When no
   equivalent exists, version switching lands on that version's Home—never a 404.
4. Query-param contracts `orderId`, `family`, `design`, `designId`, `system`, `systemId`,
   `productId`, `itemId`, `fromItem`, `page`, `q` and `status` retain their existing meanings.
5. A future server nav row unknown to the V2 mapping opens its working V1 path and is visibly
   marked V1; it is not discarded.
