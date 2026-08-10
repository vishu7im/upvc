# Phase 7 — Feature Migration

**Status:** V2-M7 Orders and V2-M8 Quote / configure owner-approved 2026-08-10. V2-M9 Catalog /
products implementation, contracts and authenticated evidence are complete and awaiting owner
approval. V2-M10 and later modules have not started.

## Goal

Migrate V1's remaining functionality into V2, **one module at a time**, each shipped and approved
before the next begins. Every module reuses existing endpoints and existing business logic; none
adds a feature; none removes one.

## Context-in-a-box

Read first: phase 2's **functional-parity map** (the contract this phase closes against),
`00-foundation/SCREEN_INVENTORY.md` (the module's V1 screen, measured, with its observations),
`00-foundation/REUSE_ANALYSIS.md` §6 (**the behaviours that must survive the rebuild**),
`00-foundation/API_REUSE.md` (the endpoints), `00-foundation/ROUTE_MAPPING.md`.

**Rebuild means re-composing existing calls, not re-deriving behaviour.** Each V1 page is the
specification for its V2 replacement: it already knows which endpoints to call, in what order, with
what error handling. Read it before writing the replacement.

## Module order

Each is its own milestone, its own approval. Phase 2 may re-order this.

| # | Module | Milestone | Why here |
|---|---|---|---|
| 1 | **Orders** — list, detail, documents | V2-M7 | Highest daily traffic; V1's list is already the best-built screen, so the delta is detail + documents |
| 2 | **Quote / configure** | V2-M8 | Biggest UX win, biggest risk. Needs **Q-A** settled and the canvas **wrapped, not rewritten** |
| 3 | **Catalog / products** | V2-M9 | Browsing + the task-shaped entry point |
| 4 | **Account + team** — account, users, roles, approvals | V2-M10 | Self-contained |
| 5 | **Settings** — financial, branding, discounts | V2-M11 | Low traffic, high risk of getting wrong |
| 6 | **Catalog pricing editor** | V2-M12 | Densest screen, admin-only, least urgent |

## The per-module contract

**Every module, no exceptions.** This is the checklist that closes a milestone.

- [ ] **Functional parity** — every capability in that module's `00-foundation/SCREEN_INVENTORY.md` entry is
      reachable in V2, ticked on phase 2's parity map
- [ ] **Carried-over behaviours** present (see the module table below, sourced from
      `00-foundation/REUSE_ANALYSIS.md` §6)
- [ ] **Click count beats the measured V1 baseline** for the flows this module owns
- [ ] **Zero dead controls** (P2)
- [ ] Every route **permission-guarded server-side** with `requirePagePermission` (closes X-9)
- [ ] Built from the phase-4 kit — no inline styling, no bypassed tokens
- [ ] **Backend lines changed: 0**
- [ ] Standing stack green (below)
- [ ] `CHECKLIST.md`, `MILESTONES.md`, `CHANGELOG.md` updated
- [ ] **Owner approves the module** before the next starts

## Per-module notes

### 1 · Orders (V2-M7)

Endpoints: `GET /api/orders?page&limit&q&status` · `GET/PUT/DELETE /api/orders/:id` · items ·
line-items · `PUT …/commercials` · `POST …/confirm` · `POST …/reopen` · `GET …/documents[/:type[/pdf]]`.

| Must carry over | Must fix |
|---|---|
| Server-side search + status filter as plain GET links, no client JS | **O-24** two line-item tables → one list *(the backend is ready: `GET /api/orders/:id` carries `studioFamilyKey` per legacy item, and `GET …/items/:itemId/draft` converts one)* |
| **One** keyboard-reachable link per row | **O-25** money in three places → one ledger |
| Confirm's **422 payload** naming which item blocked it and why | **O-27** seven equal document cards → grouped per phase 2 (all 7 still reachable) |
| `?download=1` on a PDF path sets `Content-Disposition` | **O-28** confirmed must read as **reversible** (reopen exists) |
| Basket totals read from `basket` — never recomputed (P10) | **O-26** per phase 2's decision on where the commercial layer lives |

#### V2-M7 delivery evidence

- [x] Replaced all five Orders scaffolds: scoped list, Overview, one Items list, Customer price and
      grouped Documents.
- [x] Added real order-only header search when `orders.read` is present; list search/status/page are
      plain GET parameters passed to the existing endpoint.
- [x] Reused the kit `DataTable`, preserving exactly one keyboard destination per order row.
- [x] Kept both persisted item kinds in one neutral list. At M7 delivery, add/edit/replace used the
      context-preserving production configurator; M8 now routes those contexts into V2. Both item
      delete endpoints remain reachable for drafts.
- [x] Read list totals, detail total, per-line prices and the Customer-price ledger only from the
      returned basket fields. The browser performs no price arithmetic.
- [x] Preserved all commercial inputs and renders the fresh basket returned by `PUT …/commercials`.
- [x] Confirmation renders `ApiError.payload.items` from 422 responses and selects Documents after
      success. Reopen explicitly explains deletion/regeneration of seven documents and cached PDFs,
      then selects Items.
- [x] All seven document types remain reachable, grouped exactly as Phase 2 approved: Office (2),
      Production (4), Dispatch (1). HTML, PDF `?download=1`, Normal and supplied Welded variants remain.
- [x] Every route uses `requirePagePermission("orders", "read")`; writes are additionally hidden
      through `can(...)` for create/delete grants and backend scope remains authoritative.
- [x] Phase 2's fourteen Orders parity rows are ticked. Zero backend and frozen-V1 lines changed.
- [x] F5 now measures **1 navigation + 2 task actions, 2 screens**: scoped/recent order → Confirm →
      grouped Cutting list. This reaches the Phase 2 target from V1's 2 + 2.
- [x] M7's current F6 bridge is **3 navigation + 3 task actions** versus V1's 4 + 3, with Reopen
      auto-selecting Items. M8 owns the final in-workspace edit reduction to the 1 + 3 target.
- [x] Live evidence covers 19 authenticated route/viewport/drawer states at 1280 and 834 px with
      no measurement failures (`orders/screens/orders-metrics.json`).
- [x] Orders contract checks, TypeScript, lint, production build, 1,568/0 engine validation and
      V1/backend freeze checks pass.
- [x] **Owner approves V2-M7 before V2-M8 begins.** (2026-08-10)

### 2 · Quote / configure (V2-M8) — the highest-risk module

⚠️ **Gated on Q-A** (one configurator or two — phase 2 decides).

| Must carry over — non-negotiable | Source |
|---|---|
| **350 ms debounce + sequence counter discarding superseded responses** | `configurator.tsx`, `workspace.tsx` |
| **A failed resolve never wipes the last-good preview** | both |
| First-load toast suppression (`settledOnceRef`) | `configurator.tsx` |
| One `useReducer` over `LineItemDraft` as the **only writer** | `workspace.tsx` |
| Colour and cill persist on an order item; **glass does not** (O-16 — disclose it properly) | `configurator.tsx` |
| **No option key anywhere under `web/`** | the platform invariant |

**`window-designer.tsx` (1,160 LOC) and `window-3d.tsx` (505 LOC) are WRAPPED, NEVER REWRITTEN**
(D-007). New capabilities arrive as **optional props that are no-ops when omitted** — the pattern
already used for `components`, `selectedComponentId`, `onSelectComponent`, `mirrored`. `/quote` in
V1 passes none of them and must keep behaving identically.

The Designer's inspector grammar (progressive disclosure, "N more" per group, one apply-scope
control, tri-state, help behind ⓘ) is **already the best UX in the app** (O-21). Generalise it
(phase 4 decision C-2); do not discard it.

#### V2-M8 delivery evidence

- [x] Replaced the configure scaffold with one `quotes.view`-guarded `/v2/configure` route. Standard
      and Custom are disclosure modes over the same client draft and switching mode does not remount it.
- [x] The empty entry is task-first: Standard/Custom intent → API family → only that descriptor's
      quotable starting layouts. Existing V1 deep-link and order/item query context is preserved.
- [x] One `useReducer` owns `LineItemDraft`. The resolve loop waits 350 ms after draft changes,
      increments a sequence, discards superseded results, retains the last-good preview and suppresses
      first-load success/update toasts.
- [x] Standard finds its option controls from descriptor engine effects rather than product keys,
      wraps the existing 2D/3D canvases, requests the existing joint overlay only when compatible,
      and displays only server resolver price/BOM values.
- [x] Standard persistence uses the existing legacy item endpoint. Frame, cill, colours, splits and
      quantity persist; glass remains live-quote-only and the workspace discloses that existing limit.
- [x] Custom retains component selection, one apply-scope control, progressive groups, tri-state/help
      grammar, External/Internal/Schematic/3D, structural actions with section/position, history/Undo,
      issue classification and one-click fixes.
- [x] Create order, add item, update Designer item and transactional legacy replacement all use the
      existing APIs. **Review customer price** intentionally saves first, then renders only the fresh
      server `basket` in the same workspace.
- [x] Read-only callers get a functional local what-if workspace with persistence controls gated;
      confirmed/saved Standard contexts expose no inert drag handles. Quote and order create grants
      are both required before any item write.
- [x] Orders Add/Edit links now enter V2 configure. F1/F2/F3/F4/F6 meet Phase 2's navigation/action
      targets without introducing another route or backend contract.
- [x] `npm run check:v2` now checks the configure contract and rejects catalog option-key literals
      in the configure source. `window-designer.tsx`, `window-3d.tsx`, frozen V1, `src/` and `prisma/`
      remain unchanged.
- [x] The read-only live harness captured 14 task, layout, Standard, Custom, joint, component,
      structural-history, issue-drawer and four-view states at 1280/834. The three-leaf live unit
      resolved all previews, server price and BOM with no measurement failure.
- [x] Root/web types, zero-warning lint, production build, configure contracts, frozen V1 and the
      unauthenticated `307 → /login` route guard pass.
- [x] The owner identified the concurrent catalog work as intentional. D-023 records the backend
      and one V1 admin-editor companion snapshots plus the 1,575/0 validation baseline; every other
      D-019 V1 path remains frozen.
- [x] **Owner approves V2-M8 before V2-M9 begins.** (2026-08-10)

### 3 · Catalog / products (V2-M9)

Endpoints: `GET /api/products[?page&limit]` · `/api/products/:id[/designs]` · `GET /api/designs/:id`
· `GET /api/families`.

- Carry over: **per-tile SVG degradation** — a failed design fetch shows "no preview" and never
  fails the page.
- Decide, don't drift: **G-1** (the 1+N SVG fetch) and **G-2** (no filtering by family, size or
  opening type). Both are `BACKLOG.md` items; if closing one needs an endpoint, **stop and file**.
- **O-11**: a card carrying two competing actions resolves per phase 2's Q-A decision.
- **O-12**: "Preview only" designs are non-actionable and must not be paginated as if they were.

#### V2-M9 delivery evidence

- [x] Replaced both Products scaffolds with real server-rendered routes: the paginated product-line
      list is guarded by `products.view`; the product gallery is guarded by `products.read`.
- [x] Product cards retain server name, design count, system and catalog type with exactly one
      keyboard destination. Pagination is plain URL state and preserves active `orderId` context.
- [x] The gallery retains the existing 1+N contract deliberately (D-024): one paginated design
      list plus one full-design request per tile. Each full-design failure is caught independently
      and renders “No preview available” without failing the page.
- [x] G-2 remains parked. M9 exposes no dead search, family, size or opening-type filter. The
      task-first family path remains `/v2/configure`; Products is the complete optional browse path.
- [x] One page-level Standard/Custom task choice resolves O-11. Each configurable layout then has
      exactly one matching, plainly labelled destination into the M8 workspace.
- [x] Configurable layouts and preview-only catalog references render in separate sections. The
      reference section and catalog pagination are labelled as catalog records, and every reference
      card has zero actions (O-12).
- [x] Phase 2's four Products/configuration-source parity rows are ticked. M9 owns no separate
      F1–F8 flow; the task-first quote flows remain M8's measured improvement while full browsing
      retains the approved Products → Product reach.
- [x] The Products contract is part of `npm run check:v2`, covering pagination/context helpers,
      separation, task-mode links, per-tile catch semantics, permission guards and V2-only imports.
- [x] The authenticated, non-mutating harness captured eleven runtime states and eight screenshots
      at 1280/834: five product lines, a 24-layout Standard page, the same Custom page, a 24-layout
      reference-only page, and both live configure destinations. No route, overflow, type-size,
      target-size, card-destination or unsupported-filter check failed.
- [x] Root/web TypeScript, zero-warning lint, production build, 1,575/0 engine validation and the
      D-019/D-023 snapshot checks pass. Unauthenticated `/v2/products` returns `307` to login.
- [ ] **Owner approves V2-M9 before V2-M10 begins.**

### 4 · Account + team (V2-M10)

Endpoints: `/api/users` · `/api/roles` · `/api/meta/permissions` · `/api/approvals`.

- **`DELETE /api/users/:id` has two legitimate outcomes**: `{ok:true}` or
  `{status:"pending_approval", request}`. A single "deleted" toast would lie (P9).
- **O-31**: the permission grid (modules × 5 actions × OWN/ALL) is correct and powerful, and the
  hardest thing in the app for a non-technical owner. Simplify the *presentation*; **the grid's
  capability stays** (D-005).
- `/account` is reachable in V1 only via the avatar and bell — give it a real home.

### 5 · Settings (V2-M11)

Endpoints: `GET/PUT /api/settings` · `POST /api/settings/logo` (raw `image/*`) ·
`/api/discounts[/:code]`.

- Financial settings and company branding share one form in V1 — two unrelated concerns.
- Discounts are **commercial** data filed under "admin"; phase 2 decides where they live.
- Settings changes affect pricing immediately. Say so.

### 6 · Catalog pricing editor (V2-M12) — the densest screen

Endpoints: `GET /api/catalog/:systemId` · the `PUT`/`POST` writes · `POST …/import` (raw `text/csv`)
· `POST …/hardware/:partKey/image`.

- Carry over: **dirty-tracking before save**.
- **The CSV import is the fast path** (`code,cost,price`, returns `{updated, unmatched[]}`) and V1
  buries it among many controls. Surface it properly.
- **Every hardware part already has a picture** — `GET /api/catalog/assets/hardware/:partKey` serves
  an uploaded photo or a generated glyph. Use it; V1's dropdowns are text.
- Every catalog write calls `loadCatalog()` server-side, so pricing refreshes immediately. **Do not
  cache catalog prices client-side.**
- This screen legitimately needs density — phase 3's **U-10** decision applies here.

## Standing verification stack — run per module

```bash
npx tsc --noEmit
npm run validate                                   # MUST stay 1,575 passed, 0 failed (D-023)
cd web && npm run build && npm run lint
npm run check:v2                                   # D-019/D-023 snapshots + contracts
```

## Out of scope

Any new feature · any backend change · closing G-1…G-5 · touching V1 · rewriting the canvas ·
changing any document's printed output (`src/engine/documents.ts` is calibrated and byte-asserted —
`validation/jobs.ts` asserts a glass row's exact bytes, indentation included).

## Exit — V2-M13, parity sign-off

After all six modules:

- [ ] Every row of the functional-parity map ticked
- [ ] All 8 flows (F1–F8) measured in V2 against their V1 baselines
- [ ] `00-foundation/VISION.md`'s success metrics reported with real numbers
- [ ] Owner decides whether V2 becomes the default landing — **V1 stays available regardless**
