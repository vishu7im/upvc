# SCREEN INVENTORY — every V1 screen, measured

> Phase 0 deliverable. Verified against the code on 2026-08-07.
> **This document records facts.** Ranking these observations by severity, and deciding what to do
> about them, is Phase 1 (UX Audit) and Phase 2 (IA). Nothing here is a design decision.

## Summary

**18 routes** (plus `loading.tsx`, `error.tsx`, `not-found.tsx`), 13,861 LOC of frontend.
**9 of the 18 appear in the sidebar.** The sidebar is generated from
`user.nav` (`/api/auth/me`, sourced from `src/rbac/registry.ts#MODULES`).

| # | Route | LOC | In nav? | RBAC module | Page guard | Primary user |
|---|---|---|---|---|---|---|
| 1 | `/login` | 147 | — | public | inverse guard | all |
| 2 | `/change-password` | 130 | — | forced | layout redirect | all |
| 3 | `/` dashboard | 321 | ✅ `dashboard` | dashboard | none | owner, manager |
| 4 | `/products` | 160 | ✅ `products` | products | none | sales, operator |
| 5 | `/products/[id]` | 168 | via #4 | products | none | sales, operator |
| 6 | `/quote` | 700 | ✅ `quotes` | quotes | none | sales, quotation op |
| 7 | `/designer` | 130 + 2,822 components | ❌ **none** | ❌ **none** | none | quotation op |
| 8 | `/orders` | 274 | ✅ `orders` | orders | none | sales, office |
| 9 | `/orders/[id]` | 409 + 573 | via #8 | orders | none | manager, office |
| 10 | `/account` | 124 + page | ❌ (avatar/bell) | — | none | all |
| 11 | `/admin` | 105 | ❌ (children are) | any admin | layout | admin |
| 12 | `/admin/settings` | 174 + page | ✅ `settings` | settings | ✅ | admin |
| 13 | `/admin/catalog` | 644 + page | ✅ `catalog` | catalog | ✅ | admin |
| 14 | `/admin/discounts` | 356 + page | ✅ `discounts` | discounts | ✅ | admin, sales |
| 15 | `/admin/users` | 227 + 63 | ✅ `users` | users | ✅ | admin |
| 16 | `/admin/users/[id]` | 290 + 61 | via #15 | users | ✅ | admin |
| 17 | `/admin/roles` | 156 + page | ✅ `roles` | roles | ✅ | admin |
| 18 | `/admin/roles/[id]` | 207 + 58 | via #17 | roles | ✅ | admin |

Nav module `customers` exists with `navPath: null` — a permission surface with **no page**.

---

## The app shell (`app/(app)/nav.tsx`, 198 LOC)

Collapsible sidebar (72 ↔ 24 rem) + sticky header + `max-w-[1500px]` main.

**Sidebar** — brand block, permission-filtered links, footer with "New quote" CTA and "Sign out".
**Header** — mobile menu, global search input, "Create order", "Quick quote", notification bell
(with `incomingApprovals` count), avatar → `/account`.

Observations (verified):

- **O-1 — the global search input is not wired to anything.** It has `aria-label`, `placeholder`
  ("Search orders, quotes, catalog…") and styling, but **no `value`, no `onChange`, no `onSubmit`
  and no enclosing `<form>`**. It is the most prominent control in the header and it is inert.
  (The `/orders` list has its own working server-side search — so the capability exists, it is just
  not what this box does.)
- **O-2 — "Create order" navigates to `/orders`**, the list. It does not create an order. Creating
  one requires finding "New order" on that page.
- **O-3 — "Quick quote" navigates to `/quote`**, which with no `designId` renders an empty state
  saying "Start from a quotable design → Browse products". The header CTA and the sidebar's primary
  footer CTA ("New quote") both land here.
- **O-4 — four different paths to start work** are offered simultaneously in the shell: sidebar
  "New quote", header "Create order", header "Quick quote", dashboard "Quick actions" grid (4 more).
- **O-5 — `/designer` has no sidebar entry and no RBAC module.** It is auth-guarded by the `(app)`
  layout only. Phase 1 corrected the stronger Phase 0 claim that it had no navigation surface at
  all: the dashboard has a **Designer** quick action, but that shortcut opens `/designer` without
  the required family/design query and therefore lands on an empty state pointing back to Products.
  The only *functional* entry remains "Design in studio" on a quotable `/products/[id]` card.

---

## 3 · `/` Dashboard (321 LOC)

Page header (eyebrow, greeting, description, 2 CTAs, engine badge) → **4 metric cards** → 6-month
bar chart + Quick actions (4 tiles) + Engine status (3 rows) → Recent orders table (6 columns).

Notably honest: everything on this page is real data (a previous pass removed hardcoded decoration
— see `CLAUDE.md`). The chart buckets confirmed-order value by month from `GET /api/orders?limit=100`.

Observations:

- **O-6 — the metrics are engine-facing, not business-facing**: "Profile systems", "Product lines",
  "Confirmed value", "Draft workload". Two of the four describe *catalog readiness*, which a factory
  owner does not act on. Nothing shows what is due, late, or waiting on someone.
- **O-7 — "Engine status" surfaces infrastructure to every role.** "Fabrication API — Responding"
  is an operator-visible statement about a backend process.
- **O-8 — the page has 5 distinct navigation affordances to elsewhere** (2 header CTAs, 4 quick
  actions, "View all", per-row order links) and no single obvious next step.
- **O-9 — one screen, three information densities**: metric cards, a chart, and a 6-column table.

---

## 4/5 · `/products` and `/products/[id]` (160 + 168 LOC)

Card grid of product lines → paginated design gallery (`limit=24`) with **inline SVG previews**,
a "Quotable"/"Preview only" badge and leaf count. `/products/[id]` fetches the page of designs then
`Promise.all`s each design's full record for its SVG; a failed fetch degrades to a "no preview" tile.

Observations:

- **O-10 — the gallery is the only entry point to both configurators.** Every quoting task begins
  by choosing a *design* from a catalog of ~516, of which 371+ are quotable — before the user has
  said what they are trying to build.
- **O-11 — a card can carry two competing actions**, "Configure →" (`/quote`) and "Design in
  studio" (`/designer`), with nothing explaining the difference.
- **O-12 — "Preview only" cards are non-actionable** but are paginated alongside actionable ones.
- **O-13 — pagination is link-based with no filtering by size, family, or opening type.** Finding a
  specific design means paging.

---

## 6 · `/quote` — legacy configurator (700 LOC, `configurator.tsx` 648)

Two-column: a sticky 280 px "Configuration" card and a preview + results column.

**Controls: 8 configuration inputs** (Profile system, Width, Height, Chamber, Glass, Colour-inside,
Colour-outside, Cill) · **3 canvas controls** (2D/3D switch, Joints checkbox, Gallery link) ·
**2 order inputs** (Qty, Customer) + one action.
**Panels: 5** (Configuration, Preview, Quote summary, BOM preview, Add-to-order).

Behaviour worth preserving: 350 ms debounce, drag-to-resize spans on the canvas, live SVG + price,
a status chip with a single source of truth, and a toast that is suppressed on first load.

Observations:

- **O-14 — vocabulary is fabricator-internal**: "Chamber", "Cill", "Joints", "BOM preview",
  "Material / Labour / Markup / Tax", "Design default". None is explained on screen.
- **O-15 — the design's identifier is shown as a badge** (`props.designId`) next to the name.
- **O-16 — glass and colour are quote-time only**; the saved order item persists colour and cill but
  **glass reverts to the design default**, disclosed in one line of 14 px grey text inside the
  Add-to-order card.
- **O-17 — "Add to order" doubles as "Create order"** depending on whether `orderId` is in the URL,
  changing both its label and the fields above it.
- **O-18 — pricing is shown as four engineering components** before any customer-facing total
  context (fitting, survey, delivery, discount and VAT live on a different screen entirely).

---

## 7 · `/designer` — the studio (130 LOC route + 2,822 LOC of components)

The schema-driven configurator: four product families (casement-window, entrance-door, french-door,
sliding-patio), one `LineItemDraft` in a `useReducer` as the only writer, a 350 ms debounced
`POST /api/line-items/resolve`, always-on component selection, four elevation views
(External | Internal | Schematic | 3D), instant structural actions, an undoable edit history, and
issues with one-click fixes.

**This is the most capable screen in the product.**

Observations:

- **O-19 — its only direct shell-level shortcut is non-functional for starting work, and it has no
  sidebar entry or RBAC module** (see corrected O-5). A user can see "Designer" on the dashboard,
  but must backtrack through Products before a usable studio opens.
- **O-20 — it cannot be entered without first choosing a family and a design** via query params;
  visiting `/designer` directly renders an empty state pointing back at `/products`.
- **O-21 — its inspector is already the product's best UX** (progressive disclosure, "N more" per
  group, one apply-scope control, tri-state grammar, help behind ⓘ) and **none of that grammar is
  used anywhere else in the app.** V1 contains two unrelated interaction languages.

---

## 8 · `/orders` (274 LOC)

Paginated table: Order, Customer, Status, Items, Total, Created, Actions. **Working server-side
search** (`?q=`) and status tabs (All / Drafts / Confirmed). Whole-cell click targets with exactly
one keyboard-reachable link per row — a genuinely well-executed accessibility detail.

Observations:

- **O-22 — "Items" merges two different kinds** (legacy `items` + `designerItems`) into one number.
- **O-23 — status is binary** (draft/confirmed). There is no production state, so a factory cannot
  see what is cut, glazed, or dispatched. *(Capability gap — V2 must not invent one; noted for
  `../BACKLOG.md`.)*

---

## 9 · `/orders/[id]` (409 LOC + `pricing-panel` 315 + `order-actions` 276 + `document-viewer` 182)

The densest screen in the app. On a draft it stacks, vertically:

1. Page header — order no., customer, reference, status, actions
2. **3 summary cards**
3. **"Line items"** table (legacy items)
4. **"Designer line items"** table (a *second* table of the same conceptual thing)
5. **"Pricing & extras"** card — fitting type, fitting price, survey price, delivery charge,
   discount code, tax override (**5 number inputs + a segmented control + a code field**)
6. **"Order summary"** — the live basket ledger
7. Confirm bar

On a confirmed order it becomes a **documents grid**: 7 document types × (View HTML | PDF).

Observations:

- **O-24 — two tables of line items on one screen**, distinguished by which configurator created
  them — an implementation detail exposed as an organising principle.
- **O-25 — money appears in at least three places** on one screen: per-row totals, the pricing
  panel inputs, and the summary ledger.
- **O-26 — the commercial layer (fitting/survey/delivery/discount/VAT) is on a different screen
  from where the price is configured** (`/quote`), so a salesperson quoting a customer cannot see
  the customer-facing total while configuring.
- **O-27 — 7 documents are presented as 7 equal cards.** `work_order`, `cutting_list`, `bom`,
  `price_summary`, `work_planner`, `dmo`, `planner_list` — with no indication which one a given
  role actually needs.
- **O-28 — `reopen` breaks the "confirmed is immutable" model** (deliberately, and it cleans up
  correctly), which means the confirmed state must now be communicated as *reversible*.

---

## 10 · `/account` · 11 · `/admin` hub

`/account` — profile card + the peer-consent deletion approvals panel. Reached only via the avatar
or the bell; **not in the sidebar**.
`/admin` — a 5-tile hub (Users, Roles & permissions, Settings & branding, Discount codes, Catalog
pricing), each tile permission-filtered. The tiles duplicate sidebar entries that already exist.

- **O-29 — `/admin` is a navigational duplicate**: every tile it offers is already a sidebar link
  for a user permitted to see it.

---

## 12–18 · Admin screens

| Screen | Shape | Observation |
|---|---|---|
| `/admin/settings` (174) | Financial fields + branding + logo upload | Financial settings (markup, wastage, VAT, labour) sit beside company branding — two unrelated concerns in one form |
| `/admin/catalog` (644) | System selector; per-row cost/price/weight across parts/glass/gaskets/hardware/cills; colour uplift; add glass; add cill; **CSV import**; hardware image upload | **O-30 — the single densest screen in the app.** Hundreds of editable rows across 6 tables, dirty-tracked, on one page |
| `/admin/discounts` (356) | Code CRUD, derived live/scheduled/expired status | Commercially owned, but filed under "admin" |
| `/admin/users` (227) | List + create/activate/deactivate/reset/delete | Delete may return `pending_approval` (peer consent) — a two-state outcome from one button |
| `/admin/users/[id]` (290) | Detail + role assignment | |
| `/admin/roles` (156) | Role list + create | |
| `/admin/roles/[id]` (207 grid) | **Permission grid**: modules × 5 actions × OWN/ALL scope | **O-31 — a matrix editor.** Correct and powerful; the hardest screen in the app for a non-technical owner to reason about |

---

## Cross-cutting observations

| # | Observation | Evidence |
|---|---|---|
| **X-1** | **Two configurators with no explanation of which to use** | `/quote` vs `/designer`, both linked from the same card |
| **X-2** | **Two interaction languages** | Designer's tri-state/progressive-disclosure grammar exists nowhere else |
| **X-3** | **Dead or misleading controls in the highest-traffic chrome** | O-1, O-2, O-3 |
| **X-4** | **The best feature is misleadingly discoverable**: its dashboard shortcut dead-ends; the usable entry is buried on a gallery card | O-5, O-19, O-20 |
| **X-5** | **Fabricator vocabulary is unexplained everywhere** | Chamber, Cill, BOM, DMO, Planner List, Stulp, Transom, Mullion, Joints |
| **X-6** | **No task-shaped entry point** | Every flow starts with "browse a catalog of 516 designs" |
| **X-7** | **Density is uniform regardless of role** | An operator printing a cutting list traverses the same screens as an admin editing supplier prices |
| **X-8** | **`max-w-[1500px]` + ~40 px rows + 11 px uppercase micro-labels** | Tuned for information density, not for 35–65-year-old eyes on a factory floor |
| **X-9** | **Page-level permission guards on admin routes only** | A user without `orders:read` reaches `/orders` and meets an API error rather than a redirect (security is enforced server-side; this is a UX gap) |

## Screens V1 does not have

Recorded as *facts about scope*, not as V2 features — **V2 adds no features** (see `VISION.md`).
Each is logged in `../BACKLOG.md` for the owner to decide separately.

- Customers (RBAC module exists, `navPath: null`, no page)
- Production / shop-floor control (a mockup exists at `web/DESIGN/production_control_fab_erp/` with
  no corresponding route — it was designed, never built)
- Any reporting beyond the dashboard's 6-month bar chart

## Design mockups already in the repo

`web/DESIGN/` holds 7 mockups (`code.html` + `screen.png`): dashboard, orders, order documents,
products, quote configurator, administration, **production control**. Phase 1 and Phase 2 should
read these — they are prior art on the owner's own taste, and the production-control one describes a
screen that does not exist.
