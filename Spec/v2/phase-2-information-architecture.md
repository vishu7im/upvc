# Phase 2 — Information Architecture

**Status:** ✅ **owner approved 2026-08-07** · Phase 3 authorised

## Goal

Decide the **structure** of V2: navigation, workflow, screen hierarchy, dashboard content, and the
to-be flows. Produce the functional-parity map that makes *"nothing was removed"* checkable rather
than asserted. No visual design, no components, no code.

## Context-in-a-box

Read first: `phase-1-findings.md` (the ranked pain points — this phase optimises for *those*, not
for everything), `00-foundation/SCREEN_INVENTORY.md`, `00-foundation/USER_FLOWS.md` (now with
measured baselines), `00-foundation/ROUTE_MAPPING.md` (draft — this phase finalises it),
`00-foundation/API_REUSE.md` (what the backend can actually serve).

**Navigation is DATA, not markup.** `GET /api/auth/me` returns `nav[]` — the caller's permitted
modules with `path`, `name`, `icon`, `sortOrder`, sourced from `src/rbac/registry.ts#MODULES`:

```
dashboard(0) · products(20) · quotes(30) · [customers(35) — navPath: null, NO PAGE] ·
orders(40) · discounts(50) · catalog(60) · settings(70) · users(80) · roles(90)
```

V2 may **group and label** this differently in the UI. It may **not** hardcode a menu (P12) — doing
so decouples the menu from permissions and they will drift.

`/designer` appears in **no** module, so it can never surface in a permission-filtered nav (O-5).
That is `BACKLOG.md` **B-1** and this phase must decide it.

The backend already serves more than V1 uses: orders have **server-side search and status
filtering** (`?q=`, `?status=`); every hardware choice has a **picture**
(`GET /api/catalog/assets/hardware/:partKey`); families are self-describing
(`GET /api/families`). Design *with* these rather than around them.

## Deliverables

1. **Navigation model.** The V2 sidebar/header structure, with the mapping from `user.nav` entries
   to V2 destinations, and the rule for anything `user.nav` contains that V2 groups or renames.
   Include: what a Customer-role user sees versus an admin.
2. **Workflow model.** The **task-shaped entry point** that replaces "browse ~516 designs" (P3,
   X-6). Name the tasks in operators' words. Show how each reaches an existing endpoint.
3. **Screen hierarchy.** Which screens exist, what each owns, what nests inside what, and — for the
   screens phase 0 found overloaded (`/orders/[id]`'s 7 stacked sections, `/admin/catalog`'s 6
   tables) — how they decompose.
4. **Dashboard content model.** Which numbers, for which role, from which endpoint. Every figure
   traceable (O-6, O-7). V1 earned this by deleting a hardcoded chart; do not regress it.
5. **To-be flows F1–F8.** Target click count and screen count **beside the measured V1 baseline**.
6. **Functional-parity map.** ⭐ *The most important artefact of this phase.* A table:
   every V1 capability → its V2 home → the clicks to reach it. Sourced from
   `00-foundation/SCREEN_INVENTORY.md` screen by screen. Every Phase 7+ module closes against it.
7. **Finalised `00-foundation/ROUTE_MAPPING.md`** — V1 route → V2 route, no ⚠️ left unresolved.
8. **Decisions recorded** in `DECISIONS.md` for each question below.

## Decisions this phase must make

| Ref | Question | Notes |
|---|---|---|
| **Q-A** | **One configurator or two?** | `/designer` already handles all 4 quotable families and everything `/quote` does, plus component editing, 4 views, structural actions, undo. `/quote`'s only edge is being simpler. Phase 0 leans **"two entry points, one engine"** — simple vs custom, same workspace, different disclosure. **Decide explicitly**; V1 keeps both regardless |
| **B-1** | **Does the Designer get an RBAC module?** | One entry in `src/rbac/registry.ts#MODULES` + `npm run sync:permissions` ⇒ nav entry + permission surface + role-grid row, automatically. Alternative: fold it under `quotes` (no data change, but no separate permissioning). **Owner decision** |
| **B-2** | **What does global search search?** | (a) orders only — reuses `?q=`, zero backend work; (b) also products/designs — needs an endpoint (**G-5**); (c) removed until funded. **P2 forbids shipping it dead** |
| **O-27** | **Are the 7 documents grouped?** | `work_order`, `cutting_list`, `bom`, `price_summary`, `work_planner`, `dmo`, `planner_list` as 7 equal cards today. Grouping by who needs them is allowed; **all 7 stay reachable** (D-005) |
| **O-26** | **Where does the commercial layer live?** | Fitting/survey/delivery/discount/VAT sit on the order page while the price is built in the configurator — so a salesperson cannot see the customer-facing total while choosing the window |
| **O-24** | **How do the two line-item tables become one list?** | The split is an implementation detail (legacy `OrderItem` vs `DesignerLineItem`) exposed as an organising principle. Note `GET /api/orders/:id` already carries `studioFamilyKey` per legacy item, and `GET …/items/:itemId/draft` converts one — the backend is ready for a unified list |
| **B-4** | **V1 URL strategy: alias or redirect?** | `/orders/abc123` must not 404. Phase 0 recommends **alias now** (V1 keeps its URLs, V2 under `/v2/*`), redirect only if V2 ever becomes default |
| **G-4** | **What happens to `customers`?** | An RBAC module with `navPath: null` and no page. Either it gets a page (**a new feature — out of V2 scope**) or it stays permission-only. **V2 must not render a broken link** |
| **O-29** | **Does the `/admin` hub survive?** | Every tile it offers is already a sidebar link for a permitted user. Dropping a duplicate *hub* is not dropping functionality — but it still appears on the parity map with its new home |

---

## Output

### Executive Summary

V2 should use a **permission-shaped Work / Manage rail** and a **task-shaped Home**. It should not
mirror V1's flat list or replace navigation with a task-only hub. Every rail item still originates
in `GET /api/auth/me → nav[]`; V2 only changes an incoming item's label, destination and group. An
unknown future item falls back to its working V1 path, so the presentation adapter cannot silently
hide a newly permissioned module.

Quoting becomes **two entries into one workspace**: **Start a quote** opens the essential controls,
while **Build a custom unit** opens the same workspace with advanced editing disclosed. Both use the
existing family/design data and `POST /api/line-items/resolve`; the studio is governed by the
existing `quotes` permission rather than a new Designer module. This removes the unexplained choice
between `/quote` and `/designer` without removing either capability.

Order work becomes one hierarchy instead of one long page: Overview, Items, Customer price and
Documents. The Items view combines legacy and Designer records into one list; Customer price is
available in the configuration workspace after an intentional draft-on-review action; Documents
groups all seven outputs by who uses them. The catalog-pricing editor similarly becomes one route
with one active data group at a time rather than six full tables at once.

Every proposal below is served by the existing 75-endpoint surface. **G-1…G-5 remain gaps rather
than hidden dependencies.** In particular, V2 shows no production stage, does not add a Customers
page, and labels header search honestly as order search.

### Phase 1 pain routed to the right phase

| Ranked pain | IA action in Phase 2 | Later-phase responsibility |
|---|---|---|
| Dead/misleading shell controls | One permission-derived primary action; order-only search; no dead CTA | Shell behaviour in Phase 5 |
| No production progress | Explicitly absent; `G-3` remains gated | Separate product decision, not V2 |
| Quoting starts from 516 designs | Task and family first; relevant starting layouts second | Workspace implementation in Phase 7 |
| Small targets / dense pages | Decompose stacked pages and render one catalog group at a time | Sizing and density rules in Phases 3–4 |
| Unexplained trade vocabulary | Plain-word route/section names; reserve contextual help beside terms | Content rules and components in Phases 3–4 |
| Same density for every role | Home and primary action derive from permissions and scoped data | Role-shaped Home in Phase 6 |
| Two competing configurators | Two explicit tasks, one workspace and one interaction language | Wrapped canvas/workspace in Phase 7 |
| Commercial price split from configuration | Customer-price step stays inside the workspace | Quote/order implementation in Phase 7 |
| Gallery and catalog fan-out | Gallery is optional for starting work; catalog renders one group | `G-1` remains; Phase 7 avoids making it the primary path |
| Flat documents and correction model | Group all seven; make Confirmed visibly reversible | Order module in Phase 7 |

### Candidate navigation models

| Candidate | Shape | Result against the ranked top 10 | Decision |
|---|---|---|---|
| **A · Repaired V1 mirror** | One flat `user.nav` list; fix labels and dead controls | Resolves the dead controls and labels the configurators, but leaves catalog-first work, uniform density, stacked orders and six-table pricing largely intact | Rejected |
| **B · Work / Manage rail + task Home** | `user.nav` remains the membership source; incoming entries are grouped into Work or Manage; Home provides one permission-derived next task | Directly resolves six, structurally reduces density/vocabulary/fan-out, and explicitly defers the unservable production-state gap | **Selected** |
| **C · Task-only hub + contextual menus** | Home owns almost every start; persistent navigation is minimal | Strong on first-task simplicity, but makes low-frequency parity capabilities harder to rediscover and weakens the visible relationship between `user.nav` and the permission surface | Rejected |

Candidate B best balances P3 with D-005: daily work begins from the task, while every permitted
module remains predictably reachable.

### Navigation model

#### Demonstrated `user.nav` transformation

The current response contains `slug`, `name`, `path`, `icon`, and `sortOrder`; it does **not**
contain `category`. Therefore V2 does not pretend grouping arrived from the API. The shell applies a
presentation adapter to the server-filtered rows:

```text
GET /api/auth/me
  → user.nav.filter(path != null).sort(sortOrder)
  → for each incoming row only:
      known V1 path → V2 destination + optional clearer label + Work/Manage group
      unknown path  → original V1 destination + server label/icon + “V1” marker
  → render the resulting rows
```

This is **not a hardcoded menu**: removing a permission removes its incoming row and therefore its
V2 link; adding a future module adds a fallback link automatically. The adapter never creates a
module row. Account, notifications, sign-out and the version switch are authenticated shell actions,
not permission modules, so they remain in the identity menu/header.

| Incoming `user.nav.slug` | V2 label | V2 destination | Group |
|---|---|---|---|
| `dashboard` | Home | `/v2` | Work |
| `products` | Products | `/v2/products` | Work |
| `quotes` | Quote | `/v2/configure?mode=standard` | Work |
| `orders` | Orders | `/v2/orders` | Work |
| `discounts` | Discounts | `/v2/manage/discounts` | Manage |
| `catalog` | Catalog pricing | `/v2/manage/catalog-pricing` | Manage |
| `settings` | Settings | `/v2/manage/settings/company` | Manage |
| `users` | Team | `/v2/manage/team` | Manage |
| `roles` | Roles & access | `/v2/manage/roles` | Manage |

`customers` is absent because `buildNav()` excludes `navPath: null`. Custom design is a mode within
the incoming `quotes` capability, not a synthetic navigation row.

#### Role-shaped examples (permission data, never role-name branches)

| Effective grants/nav | Rail | Home primary action | Secondary work |
|---|---|---|---|
| Current Customer grants | Home · Products · Quote · Orders | Start a quote (`quotes.create`) | Build a custom unit; open own recent orders |
| Current Admin grants | All Work and Manage entries | Start a quote (`quotes.create`) | Order work plus all permitted management destinations |
| Any custom role | Exactly the transformed rows in its `user.nav` | First applicable action in priority: quote create → order create → order read → first non-Home nav row; otherwise no CTA | Only actions whose permission checks pass |

The labels “Customer” and “Admin” above describe current seed examples only. Rendering and action
priority never compare `role.slug` or `role.name`.

### Workflow model — start from the job, not the catalog

Home exposes one primary **Start a quote** action when `quotes.create` is granted. The Quote
destination asks for the user's intent before showing layouts. Family names and availability come
from the API; V2 does not hardcode the four current family keys.

| Operator task | Disclosure | Existing endpoint path |
|---|---|---|
| **Start a quote** | Essential dimensions and item options; advanced groups collapsed | `GET /api/families` → `GET /api/families/:key` → its `designSource.productIds` → `GET /api/products/:id/designs` → `GET /api/designs/:id` → `POST /api/line-items/resolve` |
| **Build a custom unit** | Same workspace with component selection, structural actions, four views and undo disclosed | Same family/design reads + `POST /api/line-items/resolve` |
| **Add a unit to this order** | Same standard/custom choice with order context retained | `GET /api/orders/:id`, then `POST /api/orders/:id/line-items` |
| **Edit this unit** | Opens the same workspace at the saved draft and disclosure level | `GET /api/orders/:id/items/:itemId/draft` for a legacy row, or order `designerItems[]`; then `POST …/line-items?replaces=` or `PUT …/line-items/:itemId` |
| **Review the customer price** | Intentional draft creation/save, then fitting, survey, delivery, discount and VAT in the same workspace | `POST /api/orders` if needed → `POST …/line-items` → `PUT /api/orders/:id/commercials`; display returned `basket` only |

Starting-layout choice remains because the engine requires a real design; it occurs **after** the
family/task is known and is scoped using the selected family's `designSource.productIds`. This
avoids inventing G-2 filtering and avoids making the full 516-design gallery mandatory. “Browse all
products” remains a separate parity path.

The workspace may not calculate a provisional commercial total. Before the intentional
draft-on-review action it shows only the resolver's engineering price. After the server has stored
the item and commercials, it shows the returned order `basket` as the customer total.

### Screen hierarchy

```text
V2 shell
├── Home
├── Products
│   └── Product → starting-layout gallery
├── Configure workspace
│   ├── Standard disclosure
│   ├── Custom disclosure
│   └── Customer price / order context
├── Orders
│   └── Order
│       ├── Overview
│       ├── Items (one conceptual list)
│       ├── Customer price
│       └── Documents (confirmed orders)
├── Account / approvals
└── Manage
    ├── Discounts
    ├── Catalog pricing
    │   ├── Import CSV
    │   └── Profiles · Glass · Gaskets · Hardware · Cills · Colours
    ├── Settings
    │   ├── Company & branding
    │   └── Financial defaults
    ├── Team → person
    └── Roles & access → role grid
```

#### Order decomposition (`O-24…O-28`)

- **Overview** owns customer/reference, commercial state, server basket summary, delete, confirm or
  reopen. Confirmed is labelled reversible and explains that reopening removes/regenerates outputs.
- **Items** renders `items[]` and `designerItems[]` as one conceptual list with a shared item name,
  quantity and server line total. The implementation origin is retained only as hidden edit-routing
  metadata. Add/edit/remove capabilities all stay present.
- **Customer price** owns fitting, survey, delivery, discount, tax override and the one server basket
  ledger. It is also embedded in the configure workspace so sales can finish a quote without a
  screen change.
- **Documents** owns all seven outputs. After a successful confirm it becomes the selected order
  view and highlights the common production choices without hiding any document.

Document groups:

| Group | Documents | Plain-word cue |
|---|---|---|
| Office | `price_summary`, `work_order` | Customer price; full job instruction |
| Production | `cutting_list`, `bom`, `work_planner`, `planner_list` | Saw list; materials; station plan; consolidated planning list |
| Dispatch | `dmo` | Despatch / material output |

Each document keeps HTML preview, PDF download and Normal/Welded variants where the API supplies
them. Grouping changes hierarchy, not availability.

#### Catalog-pricing decomposition (`O-30`)

The route loads the existing full catalog once, keeps the system selector in context, and renders
only one active group. CSV import is a first-class sibling of Profiles/Glass/Gaskets/Hardware/Cills/
Colours, not a control buried among 1,127 others. Hardware images remain within Hardware row detail.
No server filter, pagination or new write contract is assumed.

### Dashboard content model

Home is shaped by permissions and server data scope. The server already applies OWN/ALL order
scope, so the same definitions produce organisation figures for an Admin and personal figures for
the current Customer role.

| Content | Visibility | Definition | Source |
|---|---|---|---|
| Primary next action | Permission priority | Quote create → order create → order read → first permitted non-Home nav destination; if none, show an honest permission-limited state with no dead CTA | `permissions` + `nav` from `GET /api/auth/me` |
| Draft orders | `orders.read` | Exact scoped count of `status=draft` | `GET /api/orders?status=draft&page=1&limit=1` → `pagination.total` |
| Confirmed orders | `orders.read` | Exact scoped count of `status=confirmed` | `GET /api/orders?status=confirmed&page=1&limit=1` → `pagination.total` |
| Confirmed value, last 6 UTC calendar months | `orders.read` | Sum `basketTotal ?? totalPrice` from every scoped confirmed row in the UTC window; the endpoint is paged to completion and no client price formula is used | `GET /api/orders?status=confirmed&page=N&limit=100` |
| Recent orders | `orders.read` | Five newest scoped orders, with status, customer and server basket total | `GET /api/orders?page=1&limit=5` |
| Deletion approvals | `incomingApprovals > 0` | Exact pending request count and link to Account | `GET /api/auth/me` → `incomingApprovals`; details from `GET /api/approvals` |
| Empty installation state | No scoped orders | No invented zero-value chart; show the permitted primary task | the two exact order counts above |

Profile-system and product-line counts move to Products/Catalog context, where they describe
readiness rather than business performance. “Fabrication API responding” is absent from operator
Home; successful data loading is normal UI state, not a KPI. The six-month chart remains for parity,
but it is explicitly based on all paged confirmed orders rather than an unlabeled first 100.

### To-be flows F1–F8

Clicks remain split into navigation + task actions; family/layout choice and field entry are form
interactions. A flow “beats” V1 when navigational burden or screen visits fall and total click count
does not rise. F7's validated row commit occurs on Enter/blur, so it is a form interaction rather
than a separate Save-button click; dirty, saving, saved and error states remain required.

| Flow | V1 measured | V2 target | V2 screens | Existing endpoints | Improvement |
|---|---:|---:|---:|---|---|
| F1 Quote a standard window | **5 + 0**, 5 screens | **1 + 1** | 2 | families, product designs, design, line-items/resolve, orders, order line-items | No empty-quote/backtrack; 3 fewer clicks, 3 fewer screens |
| F2 Turn quote into order | **1 + 0**, 1 screen | **0 + 1** | 1 | POST orders + POST order line-item in workspace | No navigation away; same one commit |
| F3 Configure a non-standard unit | **3 + 0**, 3 screens | **1 + 0** | 2 | same family/design reads + line-items/resolve | Direct custom entry; 2 fewer clicks, 1 fewer screen |
| F4 Add commercial extras + discount | **2 + 1**, 1 task screen | **0 + 1** | 1 | PUT order commercials | Customer price is in context; 2 fewer navigation clicks |
| F5 Confirm and view cutting list | **2 + 2**, 2 screens | **1 + 2** | 2 | GET order, POST confirm, GET documents/type | Direct scoped order search/recent link; Documents selected after confirm |
| F6 Correct a confirmed order | **4 + 3**, 3 screens | **1 + 3** | 2 | reopen, item draft/update/replace, confirm | One order workspace; 3 fewer navigation clicks, 1 fewer screen |
| F7 Update a supplier price | **1 + 1**, 1 screen | **1 + 0** | 1 | GET catalog + existing row PUT | One active group; validated Enter/blur commit removes Save click |
| F8 Add user and grant access | **1 + 2**, 1 screen | **1 + 1** | 1 | GET users/roles + POST user | Create-permitted Team page opens with invite row available |

No timing target is claimed from a single audit run. Phase 7 measures the implemented flows again.

### Functional-parity map

“Reach” is navigation clicks from signed-in V2 Home by the stable rail path; task interactions after
arrival are not counted. `0` means the capability is already on Home. Public/forced-auth routes are
marked direct. A grouped capability remains parity-complete only if every named child stays present.

#### Shell, authentication and Home

| V1 home | V1 capability | V2 home | Reach |
|---|---|---|---:|
| `/login` | Sign in and establish the shared session | `/login` shared | direct |
| `/change-password` | Forced password change and refreshed session | `/change-password` shared | direct |
| Shell | Permission-filtered sidebar, active state, collapse/mobile menu | V2 shell transformed from `user.nav` | 0 |
| Shell | Notifications count and Account entry | V2 header / identity menu | 0–1 |
| Shell | Sign out | V2 identity menu | 1 |
| Shell | Search | Header **Search orders**; absent without `orders.read` | 0 |
| Shell | New quote / Quick quote | One Start a quote primary action | 0 |
| Shell | Create order | Start quote or Orders → New draft, labelled by the actual outcome | 0–1 |
| `/` | Greeting and company identity | Home | 0 |
| `/` | Profile systems / product lines readiness counts | Products overview / Catalog pricing context | 1 |
| `/` | Confirmed value and six-month chart | Home business snapshot, scoped and fully paged | 0 |
| `/` | Draft workload | Home exact Draft orders count | 0 |
| `/` | Quick actions | One primary plus permission-filtered secondary tasks | 0 |
| `/` | Engine-status indication | Manage → Catalog pricing advanced readiness state; not operator Home | 1 |
| `/` | Recent orders and per-row links | Home recent orders | 0 |

#### Products and configuration

| V1 home | V1 capability | V2 home | Reach | Closure |
|---|---|---|---:|---|
| `/products` | Paginated product-line browsing and design counts | Products | 1 | ✅ M9 |
| `/products/[id]` | Paginated layouts, SVG previews, quotable/preview-only state | Products → Product | 2 | ✅ M9 |
| `/products/[id]` | Configure from a quotable layout | Product → Configure standard | 3 | ✅ M8 destination + M9 source |
| `/products/[id]` | Design in studio from a quotable layout | Product → Configure custom | 3 | ✅ M8 destination + M9 source |
| `/quote` | System, dimensions, chamber, glass, inside/outside colour and cill | Configure → Standard disclosure | 1 | ✅ M8 |
| `/quote` | 350 ms live resolve, stale-response protection, last-good preview and status | Configure workspace | 1 | ✅ M8 |
| `/quote` | 2D/3D view, joints overlay and drag-to-resize | Configure workspace preview | 1 | ✅ M8 |
| `/quote` | Engineering-price summary and BOM preview | Configure → Item price/details | 1 | ✅ M8 |
| `/quote` | Quantity/customer and Create order / Add to order | Configure → Customer price/order context | 1 | ✅ M8 |
| `/designer` | All active families and schema-driven option groups | Configure → Custom disclosure | 1 | ✅ M8 |
| `/designer` | Component selection, apply scope and tri-state option grammar | Configure → Custom inspector | 1 | ✅ M8 |
| `/designer` | External/Internal/Schematic/3D views | Configure → Custom preview | 1 | ✅ M8 |
| `/designer` | Split/midrail/convert/remove structural actions and undo | Configure → Custom inspector/history | 1 | ✅ M8 |
| `/designer` | Resolve issues and one-click fixes | Configure → Issues | 1 | ✅ M8 |

#### Orders

| V1 home | V1 capability | V2 home | Reach | Closure |
|---|---|---|---:|---|
| `/orders` | Paginated scoped list | Orders | 1 | ✅ M7 |
| `/orders` | Server search and Draft/Confirmed filter | Orders + header Search orders | 1 / 0 | ✅ M7 |
| `/orders` | Order/customer/status/items/total/created columns and row link | Orders | 1 | ✅ M7 |
| `/orders` | New draft and delete permitted order | Orders | 1 | ✅ M7 |
| `/orders/[id]` | Customer/reference/status header and edit | Order → Overview | 2 | ✅ M7 |
| `/orders/[id]` | Delete draft; confirm; render 422 item issues | Order → Overview | 2 | ✅ M7 |
| `/orders/[id]` | Reopen confirmed order with document-loss explanation | Order → Overview | 2 | ✅ M7 |
| `/orders/[id]` | Both legacy and Designer line items | Order → Items, one list | 3 | ✅ M7 |
| `/orders/[id]` | Add, edit, replace and remove either item kind | Order → Items / Configure | 3 | ✅ M7 + M8 V2 workspace |
| `/orders/[id]` | Per-line server price | Order → Items | 3 | ✅ M7 |
| `/orders/[id]` | Fitting, survey, delivery, discount and tax override | Order → Customer price; also Configure workspace | 3 / 1 | ✅ M7 + M8 in-workspace basket |
| `/orders/[id]` | One server basket ledger and grand total | Order → Overview / Customer price | 2–3 | ✅ M7 |
| `/orders/[id]` | Seven generated documents | Order → Documents, grouped but complete | 3 | ✅ M7 |
| `/orders/[id]` | HTML preview, PDF download, Normal/Welded choice | Order → Documents → document | 3 | ✅ M7 |

#### Account and management

| V1 home | V1 capability | V2 home | Reach |
|---|---|---|---:|
| `/account` | Profile identity | Account | 1 |
| `/account` | Pending deletion requests; approve/reject/cancel | Account → Approvals | 1 |
| `/admin` | Permission-filtered links to five admin destinations | Removed duplicate hub; transformed Manage rail contains the same incoming rows | 0–1 |
| `/admin/settings` | Financial defaults: markup, wastage, VAT and labour | Manage → Settings → Financial defaults | 2 |
| `/admin/settings` | Company branding fields and logo upload | Manage → Settings → Company & branding | 1 |
| `/admin/catalog` | System selection and full priced catalog load | Manage → Catalog pricing | 1 |
| `/admin/catalog` | Profile-part cost/price/weight editing | Catalog pricing → Profiles | 2 |
| `/admin/catalog` | Glass list editing and add glass | Catalog pricing → Glass | 2 |
| `/admin/catalog` | Gasket list editing | Catalog pricing → Gaskets | 2 |
| `/admin/catalog` | Hardware list editing and image upload | Catalog pricing → Hardware | 2 |
| `/admin/catalog` | Cill list editing and add cill | Catalog pricing → Cills | 2 |
| `/admin/catalog` | Colour uplift editing and add colour | Catalog pricing → Colours | 2 |
| `/admin/catalog` | CSV `code,cost,price` import and unmatched report | Catalog pricing → Import CSV | 2 |
| `/admin/discounts` | Discount list and live/scheduled/expired state | Manage → Discounts | 1 |
| `/admin/discounts` | Create, edit and delete code | Manage → Discounts | 1 |
| `/admin/users` | User list and role display | Manage → Team | 1 |
| `/admin/users` | Invite/create user with existing role | Manage → Team | 1 |
| `/admin/users` | Activate, deactivate, reset password and delete | Manage → Team | 1 |
| `/admin/users` | Handle delete success or `pending_approval` | Manage → Team / Account approvals | 1 |
| `/admin/users/[id]` | User detail and role assignment | Team → Person | 2 |
| `/admin/roles` | Role list and create role | Manage → Roles & access | 1 |
| `/admin/roles/[id]` | Role metadata edit/delete | Roles & access → Role | 2 |
| `/admin/roles/[id]` | Modules × actions × OWN/ALL permission grid | Roles & access → Role grid | 2 |

#### Explicit non-pages and gaps

| V1 fact | V2 treatment | Reason |
|---|---|---|
| `customers` permission module has `navPath:null` and no page | Remains permission-only and never renders as a link | A page would be a new feature and G-4 has no endpoint |
| Orders have only Draft/Confirmed | Same two states; no timeline or shop-floor board | G-3 is a capability gap |
| Gallery needs 1+N SVG calls | Preserve per-tile degradation; gallery is no longer required to start | G-1 stays parked |
| No cross-domain search | Search orders only and say so | Uses existing `?q=`; G-5 stays parked |

### Backend-gap check

Every proposed screen and flow resolves to an endpoint already listed in
`00-foundation/API_REUSE.md`. The decisions deliberately avoid all five gaps:

- no new Designer module (`B-1`) or backend source change;
- no Customers page (`G-4`);
- no production state (`G-3`);
- no design-filter contract (`G-2`), only family-declared product IDs and existing pagination;
- no global search endpoint (`G-5`), only honest order search;
- no gallery aggregation endpoint (`G-1`), and per-tile failure behaviour remains.

Phase 2 therefore requires **zero** changes under `web/`, `src/` or `prisma/`.

### Owner-decision branches (B-1 and G-4)

The owner has not yet signed the Phase 2 choices, so the two explicit gates are preserved both ways:

| Gate | Selected proposal | If the owner chooses the other branch |
|---|---|---|
| **B-1 Designer module** | **No new module:** Custom is a disclosure mode under the existing `quotes` row/permission (`D-010`) | Add `designer` to the RBAC registry as a separately approved data change; map an incoming Designer nav row to `/v2/configure?mode=custom`; explicitly decide Customer and every custom-role grant before sync. The shell still creates no row unless `user.nav` returns it |
| **G-4 Customers page** | **No page:** keep `navPath:null`; it remains permission-only (`D-016`) | Treat Customers as a new product capability outside V2. Approve an endpoint, page scope and route separately; only after the server emits a working nav row may the V2 adapter add a V2 destination. Until then it never renders a broken link |

The route and parity tables use the selected proposals. Owner approval accepts them; a requested
alternate changes D-010/D-016 and the affected mapping before Phase 3 begins.

### Owner approval

**Approved 2026-08-07.** The owner's instruction “start new phase now” accepts D-008…D-017,
including the selected no-new-module/no-Customers-page branches, and authorises Phase 3.

## Implementation checklist

- [x] Re-read `phase-1-findings.md`; list which pain points the IA must solve (some are phase 3/4's)
- [x] Draft 2–3 candidate navigation models; evaluate each against the ranked top 10
- [x] Define the task-shaped entry point; verify every task maps to endpoints in `00-foundation/API_REUSE.md`
- [x] Decide Q-A, B-1, B-2, O-27, O-26, O-24, B-4, G-4, O-29 — record each in `DECISIONS.md`
- [x] Build the functional-parity map, screen by screen, from `00-foundation/SCREEN_INVENTORY.md`
- [x] Write the to-be flows with target counts beside baselines
- [x] Define the dashboard content model, each figure traced to an endpoint
- [x] Finalise `00-foundation/ROUTE_MAPPING.md`
- [x] Re-check: does any decision require a backend change? If yes → **stop**, file in
      `BACKLOG.md`, do not design around it silently (D-003)
- [x] Update `CHECKLIST.md`, `MILESTONES.md`, `CHANGELOG.md`, `DECISIONS.md`
- [x] **Confirm zero application code changed**

## Acceptance criteria

- [x] Navigation renders from `user.nav` — demonstrated, not asserted
- [x] Every to-be flow beats its measured V1 baseline
- [x] **The functional-parity map covers every capability in `00-foundation/SCREEN_INVENTORY.md`** with no
      "TBD" rows. This is the gate: if something has no V2 home, either give it one or record why
      it is deliberately deferred and where it still lives
- [x] Every decision in the table above is made, or explicitly deferred with a reason and an owner
- [x] No proposed screen needs an endpoint that does not exist (or the need is filed in
      `BACKLOG.md` and the screen is marked gated)
- [x] `git status` shows only `Spec/v2/`
- [x] **Owner approves phase 2** before phase 3 begins (2026-08-07: “start new phase now”)

## Out of scope

Visual design, colour, type, spacing, components (phases 3–4) · any code · closing capability gaps
G-1…G-5 · adding a feature. **If the IA feels like it needs a new feature to work, the IA is
wrong** — V1 does everything already; the job is to make it findable.

## Gates

⚠️ **B-1** and **G-4** remain part of the Phase 2 owner gate. Both branches and their consequences
are documented above; no application/data change occurs before the owner accepts one.
