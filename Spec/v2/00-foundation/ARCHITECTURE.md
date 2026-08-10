# ARCHITECTURE — V1 as built, V2 as proposed

> Phase 0 deliverable. Every statement about V1 was verified against the code on 2026-08-07.
> **D-002** (where V2 lives) is **decided: Option A**, owner-approved 2026-08-07.

---

## Part 1 — V1 as built (verified)

### 1.1 Two processes, one API

```
┌──────────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                                 │
│    only ever calls same-origin /api/*  (no CORS, no token in JS)         │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────────────┐
│  web/   Next.js 16 · App Router · React 19 · Tailwind v4 · three.js      │
│         13,861 LOC · 18 routes · port 3000                               │
│                                                                          │
│  app/api/[...path]/route.ts   ← BFF proxy: reads httpOnly `token` cookie,│
│                                  injects `Authorization: Bearer`,         │
│                                  streams status/body/content-type verbatim│
│  app/api/auth/{login,logout,change-password}  ← explicit, own cookie work │
│                                                                          │
│  lib/server-api.ts  Server Components → Express directly (cookie bearer)  │
│  lib/api.ts         Client Components → the BFF proxy                     │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │  EXPRESS_API_BASE (default :3005)
┌──────────────────────────────▼───────────────────────────────────────────┐
│  src/   Express 4 · TypeScript ESM via tsx · 61,468 LOC · port 3005      │
│                                                                          │
│  api/       19 routers, 75 endpoints, JWT + RBAC middleware              │
│  engine/    PURE fabrication maths — no I/O, ever                        │
│  designer/  PURE resolve pipeline + adapters + basket                    │
│  catalog/   the ONLY data seam: loader.ts → in-memory cache              │
│  services/  the ONLY I/O outside the API: storage.ts (S3), pdf.ts (Chrome)│
│  rbac/      registry.ts = modules/actions/roles as pure data             │
└───────┬─────────────────────────────────┬────────────────────────────────┘
        │                                 │
┌───────▼──────────┐            ┌─────────▼──────────┐
│ PostgreSQL       │            │ MinIO / S3         │
│ Prisma · 35 models│           │ PDFs + logo + hw   │
│ 25 migrations     │           │ images             │
└──────────────────┘            └────────────────────┘
```

### 1.2 The architectural rule that governs everything

**The engine is pure; the catalog is the only data seam.**

`src/engine/*` receives a `ProfileSystem` + `Design` and returns results. It never reads files, env
or the DB. The catalog is loaded once at boot by `src/catalog/loader.ts#loadCatalog()` into memory
and served through synchronous accessors. `solve()` stays synchronous.

`src/designer/*` inherits the same rule: the catalog reaches the resolver as a `CatalogSnapshot`.

**V2 changes none of this and has no reason to.** V2 is a consumer of `/api/*`.

### 1.3 Backend inventory

| Area | Files | Notable |
|---|---|---|
| `api/` | 19 routers + 3 middleware + 2 rbac | 75 endpoints — see `API_REUSE.md` |
| `engine/` | solve, topology, bars, cutting, hardware, pricing, svg, svg-hardware, documents, aggregate, limits, overrides | `svg.ts` 1,167 LOC · `documents.ts` 776 |
| `designer/` | resolve, select, rules, option-integrity, basket, legacy-import, adapters ×5 | `resolve.ts` 946 LOC |
| `catalog/` | loader, system-sunnyplast, designs, 4 families, 5 option sets, 6 price-lists, glyphs, ed-table | `derived-topologies.generated.ts` 32,391 LOC (generated, never hand-edited) |
| `services/` | storage.ts, pdf.ts | the only object-storage and Puppeteer code |
| `rbac/` | registry.ts, sync.ts | 10 modules × 5 actions × 3 system roles, as data |
| `validation/` | jobs.ts (1,932 LOC), prices.test, rbac.api | recorded baseline **1,568 assertions, 0 failed** |

### 1.4 Data model — 35 Prisma models

- **Catalog**: `ProfileSystem`, `ProfilePart`, `Glass`, `Gasket`, `Hardware`, `ColourOption`,
  `Cill`, `ReinforcementMapEntry`, `Design`, `Product`
- **Supplier pricing**: `Supplier`, `PriceDocument`, `PriceItem`
- **Designer**: `ProductFamily`, `OptionGroup`, `OptionDef`, `OptionChoice`, `DesignerLineItem`
- **Commerce**: `Customer`, `Order`, `OrderItem`, `DiscountCode`, `Document`
- **Identity/RBAC**: `Organization`, `Module`, `PermissionAction`, `Role`, `RolePermission`,
  `User`, `AuditLog`, `AccountDeletionRequest`
- **Config**: `Setting` (single row: financials + branding)

**V2 requires no schema change.** Any proposal to add one goes to `../BACKLOG.md` first.

### 1.5 Authentication and authorization (as built)

- JWT issued by `POST /api/auth/login`; the Next BFF stores it in an **httpOnly `token` cookie** —
  the token never reaches client JavaScript.
- `GET /api/auth/me` returns `{ user, role, isSuperAdmin, incomingApprovals, permissions, nav }`.
- **`nav` is data**: the sidebar is rendered from the caller's permitted modules, ordered by
  `sortOrder`, from `src/rbac/registry.ts`. Adding a module is a data change, not a UI change.
- `can(user, module, action)` (`web/lib/permissions.ts`) is the one isomorphic UI predicate; it
  mirrors the server's `hasPermission`. Super Admin bypasses structurally (`Role.scope==="PLATFORM"`).
- **Enforcement is server-side at the API**, with row-level data scoping (`scopeFilter`, OWN/ALL).
- Page-level guards (`requirePagePermission`) exist on **admin routes only** (7 pages). Other pages
  rely on API enforcement — correct for security, but it means a user lacking `orders:read` reaches
  `/orders` and meets an error instead of being routed somewhere useful. That is a **UX** finding
  for Phase 1, not a security finding.

**V2 reuses all of this unchanged**, including the data-driven nav — which is exactly what lets V2
present a different navigation without inventing a parallel permission model.

### 1.6 Frontend inventory (`web/`)

| Layer | Files |
|---|---|
| **Seam** (reuse verbatim) | `app/api/[...path]/route.ts`, `app/api/auth/*`, `lib/server-api.ts`, `lib/api.ts` (410 LOC), `lib/types.ts` (700 LOC), `lib/permissions.ts`, `lib/authz.ts`, `lib/permissions-provider.tsx`, `lib/format.ts` |
| **Domain widgets** (reuse, wrap) | `window-designer.tsx` (1,160), `window-3d.tsx` (505), `lib/svg-preview.ts`, `lib/svg-download.ts`, `lib/designer-draft.ts` (520) |
| **Design system** (V2 replaces) | `ui.tsx` (260 — 12 primitives), `icons.tsx` (259), `toast.tsx`, `globals.css` |
| **Screens** (V2 rebuilds) | 18 routes under `app/(app)/`, `app/login`, `app/change-password` |
| **Designer UI** (V2 re-shells) | `components/designer/*` — workspace 914, options 625, structure 310, measurements 304, canvas 150, controls 523 |

Full classification in `REUSE_ANALYSIS.md`.

### 1.7 Deployment

`Dockerfile` + `docker-compose.yml` + `Caddyfile`. Postgres :5432 (or PgBouncer :5433 — use
`prisma migrate deploy`, not `migrate dev`), MinIO :9000/:9001, engine :3005, web :3000.

---

## Part 2 — V2 target architecture

### 2.1 The shape

V2 is a **third presentation layer on the same seam**. It is not a service, not an API, not a
database consumer.

```
                    ┌─────────────────────────────────────┐
                    │   Express API :3005  (UNCHANGED)    │
                    │   engine · designer · rbac · docs   │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │  BFF proxy + lib/api + lib/types    │
                    │  + permissions  (SHARED, UNCHANGED) │
                    └───────┬──────────────────┬──────────┘
                            │                  │
                 ┌──────────▼───────┐  ┌───────▼────────────┐
                 │  V1 UI           │  │  V2 UI             │
                 │  app/(app)/*     │  │  app/(v2)/*        │
                 │  FROZEN          │  │  new shell + kit   │
                 └──────────────────┘  └────────────────────┘
                            └────── / ─────────┘
                          landing: "Visit V1" | "Visit V2"
```

### 2.2 D-002 (DECIDED) — where V2 lives

**Accepted: Option A — a route group inside the existing `web/` app.** Owner-approved 2026-08-07.

```
web/app/
  version-chooser/      ← chooser implementation; `web/proxy.ts` keeps its public URL at `/`
  v1/                   ← V1 dashboard alias, reusing the frozen page/layout
  (app)/…               ← V1, FROZEN, keeps canonical paths; reused by /v1 aliases
  (v2)/…                ← V2, new shell, new kit
  api/…                 ← the seam, SHARED and unchanged
```

| | **A — route group in `web/`** ✅ **ACCEPTED** | **B — separate `web-v2/` app** (rejected) |
|---|---|---|
| Reuse of BFF, `lib/api.ts`, `lib/types.ts` (700 LOC), `permissions.ts` | Direct import, zero cost | Duplicate, or extract a shared package first |
| Reuse of `window-designer.tsx` / `window-3d.tsx` (1,665 LOC of hard-won canvas code) | Direct import | Duplicate or extract |
| Auth cookie shared | Same origin, automatic | Needs Caddy path routing to stay same-origin |
| Switching V1↔V2 | A link | A link, plus reverse-proxy config |
| Build / deploy | One build, one container | Two builds, two containers, two deploys |
| Style isolation | **The real risk** — must scope V2 tokens | Free |
| Risk of accidentally editing V1 | Real — mitigated by freeze + CI diff check | Structurally impossible |

Option B buys only *style* isolation, and buys it by duplicating ~2,400 lines of seam and canvas
code — which directly contradicts the brief's "never reinvent already working logic". Style
isolation is cheaper to achieve deliberately:

- V2 tokens live in `web/app/v2.css`, imported **only** by the V2 layout.
- Every V2 token is namespaced `--v2-*`; V2 components never read a V1 token.
- V1's `globals.css` is not edited. (It is imported by the root layout; V2's layout adds its own
  sheet on top and scopes it under a `data-v2` root attribute.)
- A CI check asserts `web/app/(app)/**` and `web/components/{ui,icons,toast}.tsx` are unchanged
  versus the freeze commit.

**Accepted 2026-08-07.** The layering rules in §2.3 are therefore mandatory, not stylistic: they are what keeps a later extraction to a separate app mechanical if it is ever wanted.

### 2.3 Layering rules for V2 code

```
app/(v2)/**            routes + page composition            may import ↓
components/v2/**       the V2 component kit (Phase 4)       may import ↓
lib/v2/**              V2-only view models & formatting     may import ↓
lib/{api,types,permissions,format,server-api}   THE SEAM    ← shared, never edited
```

- **V2 never imports from `components/ui.tsx`, `components/icons.tsx` or `app/(app)/**`.** If V2
  needs something V1 has, V2 builds its own or the code is promoted into a shared module in a
  separate, reviewed step.
- **V2 never imports from `src/`.** (V1 doesn't either — `lib/types.ts` deliberately restates the
  shapes because `src/types.ts` uses explicit-`.ts` ESM imports that Next's bundler dislikes.)
- Exception, by design: `window-designer.tsx`, `window-3d.tsx`, `lib/svg-preview.ts`,
  `lib/svg-download.ts`, `lib/designer-draft.ts` are **shared domain widgets**, imported by both.
  They are frozen for V1's sake: V2 may pass new *optional* props (the codebase's established
  additive pattern — `mirrored`, `components`, `selectedComponentId` were all added this way), never
  change existing behaviour.

### 2.4 Data flow — unchanged, by design

| Need | V2 does | Never does |
|---|---|---|
| Read a list | Server Component → `serverApiGet` | Query Prisma |
| Mutate | Client → `lib/api.ts` → BFF → Express | Call the DB |
| Price something | Read `pricing` / `basket` off the response | Add or multiply money |
| Draw a unit | Render `geometry.svg` from the engine | Compute geometry |
| Decide visibility | `can(user, module, action)` | Hardcode a role name |
| Build the nav | `user.nav` from `/api/auth/me` | Hardcode a menu |
| Validate a dimension | Show the engine's `issues` / descriptor bounds | Invent a limit |

**Fabrication numbers are never computed, rounded or reformatted in V2.** The engine already rounds
every printed length to a whole millimetre while keeping 0.1 mm internally (see `CLAUDE.md` — "Field
fixes 2026-08-04"). V2 displays what it is given.

### 2.5 Rendering strategy

Inherit V1's proven pattern, because it is the reason V1's data layer is sound:

- Server Components for reads (`dynamic = "force-dynamic"` — everything is cookie-scoped).
- Client Components only where interaction demands it (configurator, canvas, editors).
- Debounced live resolve at **350 ms** with a sequence counter discarding superseded responses,
  and a failed resolve **never wipes the last-good preview**. This is battle-tested in both
  `/quote` and `/designer`; V2 keeps it.

### 2.6 The version switcher

- `/` becomes a small landing screen: **Visit V1** · **Visit V2**, with a remembered preference and
  a one-line explanation of what V2 is.
- D-021 implements that public URL through `web/proxy.ts` because the frozen V1 dashboard page
  already owns the root filesystem route. The rewrite is invisible in the browser.
- Both shells carry a persistent, unobtrusive switch ("Switch to V1 / V2") that **preserves the
  route where an equivalent exists** (mapping table in `ROUTE_MAPPING.md`) and otherwise lands on
  that shell's home.
- The preference is a plain, non-httpOnly cookie (`ui-version`) — it is a display choice, not a
  credential. The auth cookie is untouched by switching, so a user never re-logs in to switch.
- **V1 keeps working with the switcher removed.** The switcher is additive.

### 2.7 What would make this architecture wrong

Recorded now so it is caught early rather than argued about later:

1. V2 needing an endpoint that does not exist → **stop, log in `../BACKLOG.md`, get approval.** A new
   endpoint is allowed; inventing it silently is not.
2. V2 needing to recompute a price or a size to show it → the API response is the wrong shape;
   fix the response, never the arithmetic.
3. V2 needing to edit `ui.tsx` or `globals.css` → the isolation has leaked; fix the isolation.
4. `npm run validate` moving off its recorded 1,568 → V2 has touched the engine. Revert.
