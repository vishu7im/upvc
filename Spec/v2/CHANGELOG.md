# CHANGELOG — FabricatorOS V2

> Living document. One dated entry per completed unit of work. Newest first.
> Application-code changes note the verification that was run.

---

## 2026-08-10 (k) — V2-M9 Products ready for owner approval

**Type:** V2 presentation code + authenticated browser evidence · **M9-owned V1/backend
changes: none** · **owner catalog changes accepted as content-pinned baselines**

### Gate movement

- The owner identified the concurrent catalog changes as intentional, instructed that they be
  preserved, and authorised the next step. M8 is therefore accepted and M9 Products was executed.
- D-023 records the accepted `src/` + `prisma/` content digest, its one V1 admin-editor companion
  digest and the new **1,575/0** validation baseline. Every other frozen V1 path remains pinned to
  commit `1a9c18a`.
- M9 implementation, contracts and live evidence are complete. M10 has not started.

### Delivered

- Replaced the Products scaffold with the real paginated `GET /api/products` catalog. Product
  cards expose one destination, retain optional order context, and show only server-backed name,
  design count, system and type data.
- Replaced the product-detail scaffold with the real paginated design gallery. Each page loads the
  existing full-design resource for its SVG preview; a failed preview is isolated to its own tile.
- Made Standard or Custom a single page-level task choice. Each configurable design card has
  exactly one matching action into the existing V2 configure workspace, preserving product,
  design, page and order context.
- Kept non-configurable reference designs in a separate section with no action. D-024 records this
  presentation choice while the API-reuse gaps for catalog search/filtering remain parked.
- Added responsive, token-backed product/gallery styles and preserved product/page/order context
  across the V1/V2 switcher.
- Added a Products contract to `npm run check:v2` covering guards, pagination, query context,
  per-tile preview degradation, task modes, permission gates and the absence of dead controls.

### Browser evidence

- The authenticated, non-mutating harness under `products/` exercised **11 live states** with zero
  failures: product list and Standard, Custom and reference-only galleries at both target
  viewports, plus both configurable destinations.
- Eight owner-review screenshots cover the list and all three gallery treatments at 1280×900 and
  834×1112. Metrics confirm one product destination per card, one action per configurable layout,
  zero actions on reference designs, 16 px body text, 48 px minimum controls and no page overflow.
- Both Standard and Custom gallery actions reached `/v2/configure` with the selected mode and live
  product/design context intact.

### Verification

- Root and web TypeScript: clean. Web lint: zero warnings. Production build: clean and includes the
  Products list/detail routes. Unauthenticated production access returns `307` to `/login`.
- `npm run validate`: **1,575 passed, 0 failed**.
- `npm run check:v2`: the D-019/D-023 snapshots and every V2 contract pass.
- M9 changed no V1/backend file; the owner's content-pinned work was not modified or reverted.

### Open

- **Owner approval of V2-M9.** V2-M10 Account + team remains blocked and has not started.

## 2026-08-10 (j) — V2-M8 Quote / configure implemented; final repository gate pending

**Type:** V2 presentation code + authenticated interaction evidence · **M8-owned V1/backend
changes: none** · **current workspace has concurrent backend edits**

### Gate movement

- The owner approved V2-M7 and authorised only V2-M8 with “continue from now where we at”.
- M8 implementation, contracts and live evidence are complete. M9 has not started.
- During the final standing check, a separate user-owned backend change set appeared after an
  earlier green boundary run. It is preserved, not reverted: 11 tracked backend files and one new
  migration differ from the freeze; validation now reports 1,575/0 instead of the recorded 1,568/0.
  M8 therefore remains at its owner-review/final-gate handoff.

### Delivered

- Replaced the configure scaffold with one `quotes.view`-guarded `/v2/configure` route. Standard
  and Custom are disclosure modes over one client draft; mode switches retain draft state.
- Added family-first, descriptor-scoped quotable layout selection, including compatibility for V1
  deep links and order/item edit/replace contexts. A bare Quote route is no longer a dead end.
- Added the single `LineItemDraft` reducer and guarded resolve loop: 350 ms draft debounce, sequence
  discard, last-good preview retention and first-load toast suppression.
- Built descriptor-driven Standard controls without catalog option keys. The existing 2D/3D
  canvases are wrapped unchanged; compatible drafts can request the existing joint overlay.
  Engineering price and BOM are displayed only from server resolve responses.
- Preserved the existing Standard item contract: frame, cill, colour, split and quantity persistence;
  glass affects the live quote but is explicitly disclosed as non-persistent.
- Rebuilt Custom parity around the same workspace: component selection, one apply-scope control,
  progressive groups, tri-state/help grammar, four views, structural actions, history/Undo, issues
  and one-click fixes.
- Added existing create/add/update/transactional-replace order paths. **Review customer price**
  intentionally persists first, then renders only the fresh server basket in the workspace.
- Moved Orders Add/Edit contexts from the temporary V1 configurator fallback into V2 configure.
  Read-only users retain a functional local what-if workspace while all persistence remains gated.

### Contract and browser evidence

- `npm run check:v2` now carries a Quote/configure contract for task-first entry, exactly one
  reducer, resolve-loop safeguards, Standard persistence, Custom parity and in-workspace basket use.
  The boundary checker also rejects catalog option-key literals from configure source.
- The authenticated, non-mutating harness under `configure/` captured 14 states at 1280×900 and
  834×1112: family/layout entry, Standard workspace/joints, Custom workspace/product/part/action,
  structural history, issue drawer and four-view activation.
- A live three-leaf unit resolved server pricing/BOM, exposed four structural actions for a selected
  fixed-glass part, recorded Undo after applying one locally, and activated External, Internal,
  Schematic and 3D. `configure-metrics.json` reports no route, overflow, text-size, workspace,
  resolver or view-count failure.

### Verification

- Root and web TypeScript: clean. Web lint: zero warnings. Production build: clean and includes
  `/v2/configure`. Unauthenticated production access returns `307` to `/login`.
- The configure contract and all other V2 contracts pass. The aggregate `check:v2` command reports
  only the concurrently modified backend freeze/status entries.
- Current engine validation passes **1,575/0**. This is not accepted as the M8 baseline because the
  phase contract records **1,568/0** and prohibits backend drift.
- Frozen V1 paths remain unchanged. The current backend freeze diff is non-empty due to the
  concurrent work above, so the standing repository gate remains open.

### Open

- Reconcile or explicitly re-baseline the concurrent backend work, rerun `npm run check:v2`, then
  obtain owner approval of V2-M8. Do not begin V2-M9 before that instruction.

## 2026-08-08 (i) — V2-M7 Orders ready for owner approval

**Type:** V2 presentation code + live authenticated evidence · **V1/backend changed: none**

### Gate movement

- The owner approved Phase 6 and authorised the first separately gated Phase 7 module with “next
  please”. Only V2-M7 Orders was executed; Quote/configure and later modules have not started.
- V2-M7 implementation and evidence are complete. The milestone remains unapproved until the owner
  accepts it.

### Delivered

- Replaced the five Orders scaffolds with a scoped/paginated list, Overview, one neutral Items list,
  Customer price, and Documents. All routes are server-guarded by `orders.read`; write controls use
  the existing create/delete permissions and backend scope remains authoritative.
- Enabled D-011's real header **Search orders** only for a caller with `orders.read`. Header and list
  queries use the existing server `q`; list status and pagination remain plain GET state.
- Reused `DataTable` so every order row has one keyboard destination. The list retains order,
  customer, status, combined item count, returned total, and created date.
- Unified legacy and Designer rows without exposing their persistence origin. Per-line prices come
  only from `basket.lines`; draft add/edit/replace keeps its order/item context in the existing
  production configurator until M8 replaces that V1 fallback. Both existing remove endpoints remain.
- Split the old stacked detail into four order tabs. Overview owns customer/reference editing,
  delete, confirmation and reversible reopen. Confirmation renders structured 422 item issues and
  selects Documents; reopen explains that seven documents/cached PDFs are removed and selects Items.
- Moved the commercial fields and the single full basket ledger to Customer price. Saving displays
  only the fresh `basket` returned by the existing endpoint; confirmed values are frozen/read-only.
- Grouped all seven document types exactly as D-012 approved: Office (2), Production (4), Dispatch
  (1). Every stored HTML/PDF remains reachable, `?download=1` is retained, and welded variants are
  listed first where the API supplies them. API-target `ButtonLink`s disable Next prefetch so merely
  opening Documents does not issue hidden document or PDF requests.
- Added Orders model/contract checks to `npm run check:v2` and a repeatable authenticated browser
  harness under `orders/`.

### Existing-contract traceability

| V2 surface | Existing source; no new contract |
|---|---|
| Orders list/search/status/page | `GET /api/orders?page&limit&q&status` |
| Overview + unified item projections + returned totals | `GET /api/orders/:id` |
| Customer/reference edit; order delete | `PUT /api/orders/:id`; `DELETE /api/orders/:id` |
| Both item mutation families | Existing `/items` and `/line-items` routes |
| Commercial inputs and single ledger | `PUT /api/orders/:id/commercials` → fresh `BasketTotals` |
| Confirm issues; reversible correction | `POST /api/orders/:id/confirm`; `POST …/reopen` |
| Document inventory, HTML and PDF | Existing `/documents[/:type[/pdf]]` routes through the BFF |

### Click and browser evidence

- F5 reaches the approved **1 navigation + 2 task actions, 2-screen** target: direct scoped/recent
  order → Confirm → grouped Cutting list. V1 measured 2 + 2.
- M7's current F6 bridge is **3 navigation + 3 actions**, improving V1's 4 + 3; reopen automatically
  selects Items. M8 owns the remaining workspace integration needed for the final 1 + 3 target.
- The built app passed authenticated HTTP smoke checks on all five Orders routes. The read-only
  browser harness captured 19 list/draft/confirmed/drawer states at 1280×900 and 834×1112.
  `orders-metrics.json` reports no route, page-overflow, 16 px text, header-search, primary-action,
  keyboard-row, four-tab, unified-list, seven-document, grouping, or reopen-copy failure.

### Verification

- Web TypeScript and zero-warning lint: clean.
- `npm run validate`: **1,568 passed, 0 failed**.
- Production build: clean; route table contains all five dynamic V2 Orders routes.
- `npm run check:v2`: V1/backend freeze, shell/dashboard contracts and new Orders contracts pass.
- Frozen V1 paths and `src/`/`prisma/` remain byte-identical to `1a9c18a`.

### Open

- **Owner approval of V2-M7.** V2-M8 Quote/configure remains blocked and has not started.

---

## 2026-08-07 (h) — Phase 6 dashboard approved

**Type:** V2 presentation code + deterministic role/viewport evidence · **V1/backend changed: none**

### Gate movement

- Phase 5 was accepted when the owner authorised Phase 6 with “start next phase now”.
- Phase 6 implementation and evidence were completed on 2026-08-07.
- The owner approved Phase 6 and authorised V2-M7 Orders on 2026-08-08 with “next please”.

### Delivered

- Replaced the V2 Home scaffold with the first real screen. `requirePagePermission` still guards
  the route; `can(...)`, `scopeOf(...)` and server-supplied `user.nav` choose the primary task and
  organisation/personal/permission-limited presentation without testing a role name.
- Added exact scoped draft and confirmed counts, last-six-UTC-calendar-month confirmed value, a
  semantic six-row trend and the five newest scoped orders. Confirmed rows are fetched at
  `limit=100` through the final page before aggregation; display money reads only
  `basketTotal ?? totalPrice`.
- Added incoming deletion-approval context, complete-load error handling, permission-limited copy,
  and a fresh-install state that renders no zero-value KPIs or chart.
- Kept infrastructure health and catalog-readiness figures off the shared Home. The screen has one
  primary task action; Account and Orders links use the secondary treatment.
- Added deterministic dashboard contract tests to `npm run check:v2` and application-component
  evidence under `dashboard/` for organisation scope, personal scope and fresh-install states.

### Figure traceability

| Screen figure | Definition | Source |
|---|---|---|
| Primary action | First permitted: quote create → order create → order read → first non-Home nav row | `GET /api/auth/me` → `permissions`, `nav` |
| Organisation / personal wording | ALL versus OWN order data scope | `GET /api/auth/me` → `permissions.orders.scope` |
| Draft orders | Exact scoped `status=draft` total | `GET /api/orders?status=draft&page=1&limit=1` → `pagination.total` |
| Confirmed orders | Exact scoped `status=confirmed` total | `GET /api/orders?status=confirmed&page=1&limit=1` → `pagination.total` |
| Confirmed value · 6 months | Sum of returned `basketTotal ?? totalPrice` inside six UTC calendar buckets | Every page of `GET /api/orders?status=confirmed&page=N&limit=100` |
| Monthly values and order counts | Returned confirmed rows grouped by `createdAt` UTC month | Same fully paged confirmed-order response |
| Recent order/customer/status/total/date | Five newest returned scoped rows; total is the returned basket/legacy total | `GET /api/orders?page=1&limit=5` |
| Pending deletion approvals | Exact incoming pending count | `GET /api/auth/me` → `incomingApprovals` |
| Fresh-install state | Exact draft total + confirmed total equals zero | The two count requests above |

No workflow state beyond `draft`/`confirmed`, price formula, catalog KPI or infrastructure value is
presented.

### Role and viewport evidence

- The render harness uses the production dashboard component with permission/scope fixtures that
  match the default Admin (ALL + Manage nav) and Customer (OWN + Work nav) grants; it does not put
  either role name in application code.
- Six browser captures cover those two scopes and the fresh-install state at 1280×900 and
  834×1112. `dashboard-metrics.json` reports zero failures: 16 px body text, no page overflow,
  title/description/action above the fold, exactly one primary action, three KPI cards plus six
  trend rows in ready states, and neither in the empty state.

### Verification

- Root and web `npx tsc --noEmit`: clean.
- `npm run validate`: **1,568 passed, 0 failed** (the configured database closed the first catalog
  connection; the unchanged command passed on retry).
- `cd web && npm run build && npm run lint`: clean; `/v2` remains dynamic in the production route table.
- `npm run check:v2`: 16 component sources, V1/backend freeze, shell contracts and dashboard
  permission/paging/UTC/total contracts pass.
- Frozen V1 paths and `src/`/`prisma/` remain byte-identical to `1a9c18a`.

### Open

- V2-M7 Orders implementation and its separate owner gate. Later feature modules have not started.

---

## 2026-08-07 (g) — Phase 5 application shell approved

**Type:** routing + shell code + runtime evidence · **V1/backend changed: none**

### Gate movement

- The owner approved Phase 4/D-020 and authorised Phase 5 with “start next phase now”.
- The owner accepted Phase 5 and authorised Phase 6 with “start next phase now”.

### Delivered

- Added the public `/` chooser with two honest destinations and a visible remembered preference in
  the plain, non-httpOnly `ui-version` cookie.
- Added the authenticated V2 layout with the same login/change-password/render guard as V1,
  `PermissionsProvider`, isolated `data-v2` root, responsive Sidebar/Header composition,
  breadcrumbs, approval notifications, profile, real sign-out, and error/loading boundaries.
- Transformed only rows supplied by `user.nav` into Work/Manage sections. Unknown future rows retain
  their server label/path and show a V1 marker; absent rows are never invented.
- Added safe two-way route mapping and a version endpoint that validates return targets and touches
  only `ui-version`. Deep query/identifier contexts are retained where the Phase 2 table defines
  them; unmapped routes land on the target Home.
- Added every mapped V2 scaffold with server-side guards. Account is auth-guarded rather than tied
  to a fabricated permission module, matching Phase 2's identity-action decision.
- Added `/v1` Home reuse and `/v1/*` aliases without modifying a frozen V1 route file. D-021 records
  the proxy/re-export composition required because the frozen dashboard already owns the root page.
- Kept header search absent under D-022. M7 Orders must provide real scoped results before D-011's
  Search orders control appears.

### Browser and route evidence

- Live chooser captures at 1280/834 px retain public `/`, have no horizontal overflow, use 16 px
  text, 48 px actions and a 3 px focus outline, and visibly mark the remembered V2 choice.
- Repeatable runtime matrix: **18 V1 routes**, **15 `/v1/*` aliases**, and **19 V2 route forms** all
  resolve through the expected auth boundary; no mapped route 404s.
- Navigation contract test proves removing supplied grant-shaped nav rows removes rail entries with
  no code change. Route tests cover deep-link/query preservation, fallback Home, and open-redirect
  rejection.

### Verification

- `npx tsc --noEmit` and web TypeScript: clean.
- `npm run validate`: **1,568 passed, 0 failed**.
- `cd web && npm run build && npm run lint`: clean; production route table includes chooser, V1
  alias, preference endpoint, Proxy, and all mapped V2 routes.
- `npm run check:v2`: 16 component sources, all mapped route guards, shell composition, route
  aliases, V1/backend freeze, and shell contracts pass.
- Contrast remains 22/22. Frozen V1 and `src/`/`prisma/` diffs are empty.

### Open

- Phase 6 dashboard implementation and owner gate.

---

## 2026-08-07 (f) — Phase 4 component library approved

**Type:** component code + contract + CI/evidence · **V1/backend changed: none**

### Gate movement

- The owner authorised Phase 4 with “next please”; Phase 3 and D-018 are accepted.
- The owner approved Phase 4/D-020 and authorised Phase 5 with “start next phase now”.

### Delivered

- Replaced the `00-foundation/COMPONENT_LIBRARY.md` seed with the C-1…C-9 contract, including
  real public APIs, state ownership, accessibility/non-use guidance, composition rules and
  enforcement evidence.
- Built 15 component source files under `web/components/v2/**`: layout, actions, an isolated icon
  set, the single control-state grammar, fields, feedback/loading, Cards/Metrics, StatusChip,
  server-driven DataTable, Sidebar, Header, focus-managed Drawer, and Toast.
- Added view-only `web/lib/v2/present.ts`. It formats labels only and computes no price, size,
  limit, permission, or fabrication value.
- Extended the isolated `web/app/v2.css` with token-backed component styles. V1 CSS remains frozen.
- Added an executable static SSR gallery and Drawer document plus repeatable browser captures and
  measurements under `component-library/`. No product route or screen was added.
- Wired `npm run check:v2` before the first component. It verifies the V1/backend freeze, seam
  imports, token scope/namespace, no styling escape, one state source, and no hardcoded catalog/RBAC
  data in the component kit.

### Decisions accepted (D-020)

- Columns/search/sort are supplied to DataTable as data and server URLs; it never filters a client
  copy. Each row has one keyboard destination.
- The Designer's state/field mechanics are generalised now; its API-descriptor renderer remains M8
  work. V2 icons and Toast are forked so no V1 visual component is imported.
- Wizard and Modal are absent because Phase 2 proved neither need. Timeline stays blocked on G-3;
  no production state is invented.

### Browser evidence

- At 1280/834 px: 16 px body/labels, 48 px controls, 56 px default rows and 3 px focus.
- At 834 px the page width is exactly 834 px; the table owns its 928 px scroll width inside a
  792 px local region. Each rendered row has exactly one reachable destination.
- Drawer evidence: dialog/modal naming present, 480 px panel, and a 44 × 48 px close target.
- The first measurement pass caught and drove fixes for page-level table overflow and a shrinking
  Drawer close target; final metrics contain zero failures.

### Verification

- `npx tsc --noEmit` and web TypeScript: clean.
- `npm run validate`: **1,568 passed, 0 failed**.
- `cd web && npm run build && npm run lint`: clean; build route list contains no V2/gallery route.
- `npm run check:v2`: 15 component sources pass; V1/backend match freeze commit `1a9c18a`.
- Phase 3 contrast check remains 22/22; frozen V1 and `src/`/`prisma/` diffs are empty.

### Open

- Phase 5 application-shell implementation and owner gate.

---

## 2026-08-07 (e) — Phase 3 design system ready for owner approval

**Type:** design-system specification + isolated token sheet · **V1/backend changed: none**

### Gate movement

- The owner authorised Phase 3 with “start new phase now”; Phase 2 and D-008…D-017 are accepted.
- Phase 3 evidence is complete. Phase 4 remains blocked on owner approval of D-018.

### Delivered

- Replaced the `00-foundation/UI_GUIDELINES.md` seed with the U-1…U-15 contract. Every decision has
  a reason, named owner and reviewer check; U-12 dark mode is explicitly deferred until after M13.
- Ratified P1–P14 in `00-foundation/DESIGN_PRINCIPLES.md`; Phase 1 struck none. Assigned P6's
  numbers, specified P7's state grammar once and made P11 finite.
- Added isolated `web/app/v2.css`: every custom property is `--v2-*`, every selector is scoped by
  `[data-v2]`, and no V1 token is read.
- Added the static approval specimen, repeatable browser capture/measurement script, desktop/tablet
  PNGs, metrics JSON, contrast checker and contrast report under `design-system/`.

### Decisions proposed (D-018)

- 16 px body/labels, 48 px default controls, 44 px admin minimum, 4 px spacing, one 10 px radius,
  four controlled elevations and 760/1080/1280 px content frames.
- One neutral ramp, one blue accent and exactly success/warning/error semantic hues.
- Default/changed/attention/error state grammar; deterministic table/list/card rule; no global
  density toggle; a new V2 icon set; 120/180/240 ms motion; light-only until the M13 revisit.

### Visual and contrast evidence

- Headless Chrome rendered the specimen at 1280 and 834 px. Both have zero page-level horizontal
  overflow, 16 px body/table text, a 48 px default control, 44 px admin control/rows and a 3 px focus
  ring. At 834 px the six-column table overflows only its labelled local region.
- WCAG check: 22/22 declared pairs pass. Minimum text ratio is 4.63:1; minimum structural ratio is
  3.07:1; minimum focus ratio is 6.04:1.

### Verification

- `npm run validate`: **1,568 passed, 0 failed**.
- `cd web && npm run build && npm run lint`: clean.
- Static namespace/scope checks, script syntax checks and contrast check: clean.
- Diffs under `web/app/globals.css`, `web/components/ui.tsx`, `web/app/(app)/**`, `src/` and
  `prisma/` are empty. Phase 3's only application file is new `web/app/v2.css`.

### Open

- **Owner approval of Phase 3 / D-018.** Phase 4 has not started.

---

## 2026-08-07 (d) — Phase 2 information architecture ready for owner approval

**Type:** documentation/decision proposal only · **Application code changed: none**

### Gate movement

- The owner authorised Phase 2 with “p2 now”; Phase 1 is now accepted.
- Phase 2 evidence and IA are complete. Phase 3 remains blocked on owner sign-off.

### Delivered

- Expanded `phase-2-information-architecture.md` with an answer-first IA, Phase 1 pain routing,
  three evaluated navigation candidates, the selected permission-derived Work/Manage model, task
  entry, screen hierarchy, dashboard content model, F1–F8 targets and the screen-by-screen
  functional-parity map.
- Finalised `00-foundation/ROUTE_MAPPING.md`: V1 retains canonical URLs, `/v1/*` aliases V1,
  `/v2/*` owns V2, deep-link mappings are explicit, and no unresolved route branch remains.
- Replaced the to-be stub in `00-foundation/USER_FLOWS.md` with click/screen targets and endpoint
  coverage for all eight measured tasks.

### Decisions proposed (D-008…D-017)

- Work/Manage rail plus permission-shaped Home; the rail transforms only rows returned by
  `GET /api/auth/me`, with an unknown-row fallback to V1.
- Two task entries into one configure workspace; Standard and Custom use the existing `quotes`
  permission, so no Designer module or backend/data change is required.
- Header search is order-only; Customers remains permission-only; the duplicate Admin hub has no
  V2 route; V1 URLs stay canonical.
- Order detail becomes Overview / Items / Customer price / Documents; both item stores become one
  conceptual list; all seven documents are grouped but remain reachable; customer pricing stays in
  the configure workspace and displays only the server basket.

### Endpoint and parity result

- Every proposed task maps to an existing endpoint in `00-foundation/API_REUSE.md`; no screen is
  gated on G-1…G-5.
- The parity register retains authentication, shell, Home, products, both configurators, all order
  actions/documents, Account/approvals, settings, all catalog-pricing actions, discounts, team and
  the full role grid.
- Each F1–F8 target reduces navigation or screens without increasing total click count.

### Verification

- All 18 inventory routes are represented; the parity map contains 66 capability rows; all 8 flow
  rows parse and none increases total click count (F2 holds total clicks while removing navigation).
- D-008…D-017 are present and cover every required Phase 2 question; relative links resolve across
  the Phase 2 and tracker files.
- `git status --short --untracked-files=all` contains only `Spec/v2/**`.
- Diffs under frozen V1 application paths, `src/`, and `prisma/` are empty.
- Phase 2 docs contain no unresolved `TBD`/warning branch; tracking files agree that Phase 2 is
  awaiting owner approval and Phase 3 has not started.

### Open

- **Owner approval of Phase 2**, including proposed decisions D-008…D-017.

---

## 2026-08-07 (c) — Phase 1 UX audit ready for owner approval

**Type:** documentation/evidence only · **Application code changed: none**

### Delivered

- Ran the real API and UI against the configured seeded database (516 designs, 9 orders at audit
  start); Prisma reported all 25 migrations applied. Audited with temporary Admin and Customer-role
  accounts, then removed both accounts.
- Walked F1–F8 read-only and replaced Phase 0 estimates in `00-foundation/USER_FLOWS.md`. F1 measured
  **5 navigation clicks / 5 screen visits** via the promoted header CTA and **4 / 4** through
  Products. State-changing controls were counted but not submitted against shared owner data.
- Captured 18 screens at 1280, 1920, and 834, plus 4 alternate states, 3 Customer-role checks, and
  3 catalog bottom supplements: **64 PNGs** in `audit/screens/`.
- Published `phase-1-findings.md`: answer-first owner summary, top 10 evidence-backed pain points,
  per-screen cognitive-load baseline, ranked 45-item O/X/G register with rubric, 7-mockup review,
  and P1–P14 verdicts.

### Runtime findings

- `/products/[id]` measured **12.0 s** at 1280 while fetching the page plus 24 full design/SVG
  records. `/admin/catalog` measured **25.9 s**, loaded **1,127 controls**, and occupied **20.4
  viewports**.
- No core page had page-level horizontal overflow at 834, but controls remained mostly 40 px/14 px
  and the stacked quote, product gallery, order detail, and catalog journeys became materially longer.
- Customer navigation contained Dashboard, Products, Quotes, and Orders; attempted `/admin` access
  redirected to `/`.

### Corrections and verdicts

- Corrected O-5/O-19/X-4: the dashboard does contain a Designer shortcut, but bare `/designer`
  cannot start without family/design parameters and sends the user back to Products. Designer still
  has no sidebar entry or RBAC module; the gallery card remains its only functional entry.
- X-9 remains source-confirmed but was not reproducible with the seeded roles: Customer legitimately
  has Orders permission, while admin pages correctly redirected it.
- **P1–P14 all confirmed** against evidence; none struck.

### Verification

- Evidence JSON parsed; 54 core screen rows = 18 IDs × 3 widths, plus 4 states and 3 role checks.
- 64 PNGs present; audit scripts pass `node --check`.
- `git status --short --untracked-files=all` contains only `Spec/v2/**` (the V2 spec tree was already
  untracked at phase start); diffs under frozen V1 application paths, `src/`, and `prisma/` are empty.

### Open

- **Owner approval of Phase 1.** Phase 2 remains blocked and has not started.

---

## 2026-08-07 (b) — Phase 0 approved · restructured to the repo's spec convention

**Type:** documentation only · **Application code changed: none**

### Decisions

- **D-002 → Accepted, Option A.** Owner approved V2 as a **route group inside `web/`**
  (`web/app/(v2)/`), sharing the BFF proxy, `lib/api.ts`, `lib/types.ts`, `permissions.ts` and the
  canvas widgets. Not a separate app. Propagated to `00-foundation/ARCHITECTURE.md` §2.2,
  `00-foundation/ROUTE_MAPPING.md`, `ROADMAP.md`, `MILESTONES.md`, `CHECKLIST.md`.
- **Phase 0 approved.** Phase 1 (UX Audit) is unblocked.

### Restructured

Owner feedback: *17 flat files don't tell a new session where to start; the existing specs use
proper phases so the AI checks the milestone and picks the doc.* The folder now mirrors
`Spec/01-windows-module/`:

- **`README.md` rewritten as the Phase Map** — a **▶ START HERE** block with the exact prompt to
  hand a new session, fixed owner decisions, a folder map, a dependency graph, per-phase
  one-liners, "how to execute a phase", and the standing verification stack.
- **10 reference documents moved into `00-foundation/`** — normative context, read per phase, not
  executed: `VISION`, `ARCHITECTURE`, `REUSE_ANALYSIS`, `API_REUSE`, `SCREEN_INVENTORY`,
  `USER_FLOWS`, `ROUTE_MAPPING`, `DESIGN_PRINCIPLES`, `UI_GUIDELINES`, `COMPONENT_LIBRARY`.
- **8 executable phase files added**, each following the house structure
  (*Goal · Context-in-a-box · Deliverables · Implementation checklist · Acceptance criteria ·
  Out of scope · Gates*) so a cold session needs only that file plus the foundation docs it names:

  | File | Phase |
  |---|---|
  | `phase-0-discovery.md` | ✅ done |
  | `phase-1-ux-audit.md` | **next** |
  | `phase-2-information-architecture.md` | |
  | `phase-3-design-system.md` | |
  | `phase-4-component-library.md` | |
  | `phase-5-application-shell.md` | first routing code |
  | `phase-6-dashboard.md` | |
  | `phase-7-feature-migration.md` | 6 modules, one at a time |

- Cross-references repointed (`00-foundation/…` from the root, plain filenames between siblings).

**Total: 25 documents** — 7 tracking + 10 foundation + 8 phase files.

### How a new session starts work

```
Read Spec/v2/README.md, then Spec/v2/MILESTONES.md to find the current phase,
then open that phase's file (Spec/v2/phase-N-*.md) and execute it.
```

### Open

- **Q-A** (one configurator or two) — phase 2
- **B-1** (does the Designer get an RBAC module) — phase 2 → owner

---

## 2026-08-07 (a) — Phase 0: Repository Discovery ✅

**Type:** documentation only · **Application code changed: none**
(`git diff --stat` touches `Spec/v2/` exclusively)

### Explored

- **Backend** `src/` — 96 TypeScript files, 61,468 LOC across 12 subsystems (engine, designer,
  catalog, api, services, rbac, tools, validation, db)
- **Frontend** `web/` — 89 files, 13,861 LOC, Next.js 16 / React 19 / Tailwind v4 / three.js
- **Database** — 35 Prisma models, 25 migrations
- **API** — 19 routers, **75 endpoints** enumerated
- **RBAC** — 10 modules × 5 actions × 3 system roles; navigation served as data from
  `/api/auth/me`
- **Screens** — all 18 routes read and measured
- **Prior planning** — `Spec/00-architecture` … `Spec/03-doors-module`, `Spec/questions.md`
  (Q1–Q35), `docs/rbac/PLAN.md` (61 KB), `CLAUDE.md` (152 KB), `ENGINE_ARCHITECTURE.md`,
  `handoff.md`, `task.md`, and the 7 mockups in `web/DESIGN/`
- **History** — 40 commits reviewed

### Authored — `Spec/v2/`, 17 documents

`README` · `VISION` · `ARCHITECTURE` · `DESIGN_PRINCIPLES` (draft) · `UI_GUIDELINES` (Phase-3 seed)
· `COMPONENT_LIBRARY` (Phase-4 seed) · `USER_FLOWS` (as-is) · `ROADMAP` · `MILESTONES` ·
`CHECKLIST` · `DECISIONS` · `REUSE_ANALYSIS` · `API_REUSE` · `SCREEN_INVENTORY` · `ROUTE_MAPPING` ·
`BACKLOG` · `CHANGELOG`

### Key findings (facts; ranking is Phase 1's job)

- **The most capable screen in the product — the Designer studio — has no sidebar entry and no
  RBAC module.** Phase 1 later found a dashboard shortcut, but it opens an unusable bare route; the
  functional entry remains a secondary gallery-card link (O-5, O-19).
- **Three dead or misleading controls sit in the highest-traffic chrome**: the header search has no
  handler and no form; "Create order" navigates to a list; "Quick quote" lands on an empty state
  that sends the user elsewhere (O-1, O-2, O-3).
- **Two configurators** (`/quote`, `/designer`) with overlapping jobs, linked from the same card,
  with nothing explaining which to use (X-1).
- **Two unrelated interaction languages** — the Designer's progressive-disclosure/tri-state grammar
  exists in 1 screen out of 18 (X-2).
- **Every flow starts by browsing ~516 designs** rather than by naming the task (X-6).
- **Density is calibrated for experts**: 14 px body text, 11 px uppercase micro-labels, 32–40 px
  targets, `max-w-[1500px]` — against a 35–65-year-old target user (X-8).
- **~65,000 of ~75,000 LOC are reusable untouched.** V2 is a presentation layer.

### Decisions recorded

- **D-001** planning lives in `Spec/v2/` (repo already uses capital-S `Spec/`) — Accepted
- **D-002** V2 as a route group inside `web/`, not a separate app — ⚠️ **Proposed**, owner sign-off
  required before Phase 5
- **D-003** V2 adds no backend code; target 0 lines under `src/`/`prisma/` — Accepted
- **D-004** observations are facts; ranking belongs to Phase 1 — Accepted
- **D-005** nothing is removed; deferred/grouped/hidden instead — Accepted
- **D-006** V2 keeps V1's proven interaction mechanics (debounce, stale-response discard,
  last-good-preview retention, 422 payload rendering, …) — Accepted
- **D-007** the fabrication canvas is wrapped, never rewritten — Accepted

### Recorded baselines

| Baseline | Value |
|---|---|
| `npm run validate` | **1,568 passed, 0 failed** *(from `CLAUDE.md`; not re-run during Phase 0 — no DB was exercised)* |
| Backend LOC | 61,468 across 96 files |
| Frontend LOC | 13,861 across 89 files |
| API endpoints | 75 across 19 routers |
| Prisma models / migrations | 35 / 25 |
| V1 routes | 18 (+ loading, error, not-found) |
| V1 routes in the sidebar | 9 |

### Open

- Owner approval of Phase 0
- **D-002** decision (needed before Phase 5, not before Phase 1)

---

## Entry format for future work

```
## YYYY-MM-DD — <Phase N: Name> / <milestone>
**Type:** documentation | code · **Application code changed:** none | <paths>
### What changed
### Decisions recorded
### Verification            ← code entries only
  npx tsc --noEmit                                  ✅
  npm run validate                                  ✅ 1,568 passed, 0 failed
  cd web && npm run build && npm run lint           ✅
  V1 freeze diff (app/(app), ui.tsx, globals.css)   ✅ empty
  backend diff (src, prisma)                        ✅ empty
### Open
```
