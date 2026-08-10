# CHECKLIST — live task board

> Living document. Tick items as they complete. Every completed task also updates `MILESTONES.md`
> and `CHANGELOG.md` (and `DECISIONS.md` if a choice was made).

## Phase 0 — Repository Discovery ✅ COMPLETE

### Explore

- [x] Repository root, folder structure, build/run scripts
- [x] Backend `src/` — 96 files, 61,468 LOC, 12 subsystems
- [x] Frontend `web/` — 89 files, 13,861 LOC
- [x] `prisma/schema.prisma` — 35 models · 25 migrations
- [x] All 19 API routers → 75 endpoints enumerated
- [x] RBAC: `src/rbac/registry.ts`, `src/api/rbac/*`, `docs/rbac/PLAN.md`
- [x] All 18 web routes read
- [x] Design system: `ui.tsx`, `icons.tsx`, `globals.css`, `toast.tsx`
- [x] The seam: BFF proxy, `lib/api.ts`, `lib/server-api.ts`, `lib/types.ts`, `permissions.ts`
- [x] Domain widgets: `window-designer.tsx`, `window-3d.tsx`, `designer/*`
- [x] Existing planning: `Spec/00-…` → `Spec/03-…`, `Spec/questions.md`
- [x] `CLAUDE.md` (152 KB), `ENGINE_ARCHITECTURE.md`, `handoff.md`, `task.md`
- [x] `web/DESIGN/` — 7 mockups noted (incl. an unbuilt production-control screen)
- [x] Git history — 40 commits reviewed
- [x] Deployment: `Dockerfile`, `docker-compose.yml`, `Caddyfile`

### Verify (not assume)

- [x] Header search has no handler and no form — **dead control** (O-1)
- [x] "Create order" navigates to a list; "Quick quote" lands on an empty state (O-2, O-3)
- [x] `/designer` has no sidebar/RBAC module; its dashboard shortcut opens an unusable bare route (O-5)
- [x] Page-level permission guards exist on **7 admin pages only** (X-9)
- [x] API enforces permissions with row-level scoping — the UI gap is not a security gap
- [x] Orders list search + status filter are real and server-side
- [x] `customers` module exists with `navPath: null` and no page

### Document

- [x] README · VISION · ARCHITECTURE · DESIGN_PRINCIPLES (draft) · UI_GUIDELINES (seed)
- [x] COMPONENT_LIBRARY (seed) · USER_FLOWS (as-is) · ROADMAP · MILESTONES · CHECKLIST
- [x] DECISIONS (D-001…D-007) · REUSE_ANALYSIS · API_REUSE · SCREEN_INVENTORY · ROUTE_MAPPING
- [x] BACKLOG · CHANGELOG
- [x] **Zero application code changed** — `git diff --stat` touches only `Spec/v2/`

### Gate

- [x] **Owner approved Phase 0** (2026-08-07) → Phase 1 may begin
- [x] **Owner decided D-002 → Option A** (route group inside `web/`)
- [x] Restructured to the repo's spec convention: `00-foundation/` + 8 `phase-*.md` files

---

## Phase 1 — UX Audit ✅ APPROVED → `phase-1-ux-audit.md`

- [x] Start the API and UI. Local Docker CLI was unavailable; the configured remote database/object
      services were reachable, all 25 migrations were current, and existing seed data was sufficient
- [x] Walk F1–F8 on the running app; **correct the click counts in `00-foundation/USER_FLOWS.md`**
- [x] Screenshot each of the 18 screens at 1280, 1920, **and 834**, plus empty/error/role states
- [x] Per screen: count controls visible at rest, decisions demanded, unexplained terms
- [x] Rank every O-/X-/G- observation by frequency × severity × affected user
- [x] Name the top 10 pain points with evidence
- [x] Review the 7 `web/DESIGN/` mockups; capture their intent
- [x] Confirm or strike each principle in `00-foundation/DESIGN_PRINCIPLES.md`
- [x] Write `phase-1-findings.md`
- [x] Zero application code changed
- [x] **Owner approves Phase 1** (2026-08-07: “p2 now”)

---

## Phase 2 — Information Architecture ✅ APPROVED → `phase-2-information-architecture.md`

- [x] Navigation model (rendering from `user.nav`)
- [x] **Q-A decided**: two task entries, one configure workspace
- [x] Task-shaped entry point defined (**P3**, **X-6**)
- [x] Screen hierarchy + dashboard content model
- [x] To-be flows F1–F8 with click counts beside the V1 baseline
- [x] **Functional-parity map** — every V1 capability → its V2 home
- [x] Documents grouped by who needs them (**O-27**) — all 7 still reachable
- [x] Commercial layer's home decided (**O-26**)
- [x] Header search: order-only and honestly labelled (**O-1**, **G-5**)
- [x] `/designer` RBAC module decided (**B-1**): no new module; use `quotes`
- [x] V1 URL strategy decided: alias, no preference redirect
- [x] `00-foundation/ROUTE_MAPPING.md` finalised
- [x] Zero code changed
- [x] **Owner approves Phase 2** (2026-08-07: “start new phase now”)

---

## Phase 3 — Design System ✅ → `phase-3-design-system.md`

- [x] U-1 type scale · U-2 spacing · U-3 control sizing (≥44 px) · U-4 colour · U-5 radius
- [x] U-6 elevation (+ how bypass is prevented) · U-7 content width · U-8 state grammar
- [x] U-9 table/list/card rules · U-10 density modes · U-11 icons · U-12 dark mode deferred
- [x] U-13 motion (+ `prefers-reduced-motion`) · U-14 token isolation · U-15 print safety
- [x] WCAG AA contrast verified: 22/22 declared pairs pass
- [x] Every guideline has an applicable check
- [x] `00-foundation/UI_GUIDELINES.md` authored (replaces the 🔴 seed)
- [x] Specimen rendered and measured at 1280 and 834 px; 16 px text and 44–48 px sizing retained
- [x] `npm run validate` = 1,568 / 0; web build + lint clean; frozen paths unchanged
- [x] **Owner approves Phase 3** (2026-08-07: “next please”)

---

## Phase 4 — Component Library ✅ APPROVED → `phase-4-component-library.md`

- [x] C-1…C-9 decided; `00-foundation/COMPONENT_LIBRARY.md` authored (replaces the seed)
- [x] Layout · Sidebar · Header · Cards · DataTable · Forms · Drawer · Status chips · Skeletons ·
      Loading · Notifications; Wizard/Modal not proven; Timeline remains gated on G-3
- [x] Data-owning components: empty + loading + error; all keyboard-operable, focus-visible, never colour-only
- [x] Sizing enforced by construction
- [x] CI: no option key / module slug / role name in `components/v2/**`
- [x] CI: V1 freeze check
- [x] `npm run validate` = 1,568 / 0
- [x] **Owner approves Phase 4** (2026-08-07: “start next phase now”)

---

## Phase 5 — Application Shell ✅ APPROVED *(first routing code)* → `phase-5-application-shell.md`

- [x] Freeze commit recorded; V1 freeze CI check wired and green before Phase 5
- [x] `web/app/v2.css` + `--v2-*` tokens, scoped
- [x] `/` version chooser with remembered preference (`ui-version` cookie, non-httpOnly)
- [x] V2 layout: sidebar (from `user.nav`), header, breadcrumbs, notifications, profile
- [x] Search absent until M7 Orders has a real result screen — **never dead** (D-022)
- [x] Version switcher preserves route where equivalent exists; never 404s; auth cookie untouched
- [x] Every V1 route still reachable and unchanged (18-route runtime matrix + freeze check)
- [x] Standing verification stack passes
- [x] **Owner performs the authenticated V1 ↔ V2 deep-link switch and approves Phase 5**
      (2026-08-07: “start next phase now”)

---

## Phase 6 — Home / Dashboard ✅ APPROVED → `phase-6-dashboard.md`

- [x] Role-aware home from `can(...)`, `user.nav` and order scope; no role-name branch
- [x] Business KPIs (**O-6**), no infrastructure status for operators (**O-7**)
- [x] Exact draft/confirmed counts and all-page six-UTC-month aggregation
- [x] Every number traceable to an endpoint in `CHANGELOG.md`
- [x] Exactly one primary action (**P1**)
- [x] Empty, permission-limited and error states
- [x] Organisation/personal scope plus fresh-install captures at 1280 and 834 px
- [x] Standing verification stack passes: types, 1,568/0, build, lint, freeze checks
- [x] **Owner approves Phase 6** (2026-08-08: “next please”)

---

## Phase 7+ — Feature migration 🟨 V2-M9 IMPLEMENTED; OWNER REVIEW PENDING → `phase-7-feature-migration.md`

### V2-M7 Orders

- [x] Five guarded routes: list, Overview, unified Items, Customer price, grouped Documents
- [x] Fourteen Orders parity rows closed; all carried-over behaviours present
- [x] F5 target reached; F6 navigation improved and its remaining workspace reduction assigned to M8
- [x] Zero dead controls; contextual production-configurator fallback preserves add/edit/replace
- [x] Header Search orders enabled only with a real scoped result screen and `orders.read`
- [x] 19 live 1280/834 evidence states have no overflow, primary-action or structure failures
- [x] Backend lines changed: 0; V1 frozen paths unchanged
- [x] Types, Orders contracts, 1,568/0 validation, build and lint pass
- [x] **Owner approves V2-M7** (2026-08-10)

### V2-M8 Quote / configure ✅ APPROVED

- [x] One `/v2/configure` workspace with Standard and Custom disclosure
- [x] Task-first family then scoped starting-layout entry; no bare-route dead end
- [x] One `LineItemDraft` reducer, 350 ms debounce, sequence discard and last-good preview
- [x] Standard parity: essential options, 2D/3D, joints, engineering price/BOM and legacy save semantics
- [x] Custom parity: component selection, apply scope, four views, structural actions, undo and issue fixes
- [x] Create/add/edit/replace order context plus in-workspace server customer-price basket
- [x] Permission guard, zero dead controls, no option keys and frozen V1 check
- [x] Fourteen live task/workspace/interaction evidence states at 1280/834; types, lint, build and contracts pass
- [x] Owner identified concurrent catalog changes as intentional; D-023 pins the backend and its
      one V1 admin-editor companion plus the 1,575/0 validation baseline
- [x] **Owner approves V2-M8** (2026-08-10: “backend changes are mine ignore them and forward to next step”)

### V2-M9 Catalog / products 🟨 IMPLEMENTED — OWNER REVIEW PENDING

- [x] Real paginated product-line list with server design counts and exactly one destination per card
- [x] Real paginated product gallery with the existing 1+N full-design/SVG reads
- [x] A failed SVG read degrades only its own tile and retains the rest of the page
- [x] Standard/Custom is selected once at page level; each configurable layout has one matching action
- [x] Reference-only layouts are separated and have zero actions
- [x] G-1 and G-2 remain parked; no unsupported search/filter control or backend endpoint was added
- [x] `orderId`, product and page context survive browsing and V1↔V2 switching
- [x] Both routes are server-guarded; quote actions are permission-gated
- [x] Eleven live runtime states and eight desktop/tablet captures have zero measurement failures
- [x] Types, Products contracts, 1,575/0 validation, build, lint and D-019/D-023 snapshots pass
- [ ] **Owner approves V2-M9**

### Remaining modules

Per module (M7 Orders → M8 Quote → M9 Catalog → M10 Account+team → M11 Settings → M12 Pricing):

- [ ] Functional parity vs `00-foundation/SCREEN_INVENTORY.md`
- [ ] Carried-over behaviours present (`00-foundation/REUSE_ANALYSIS.md` §6)
- [ ] Click count beats the V1 baseline
- [ ] Zero dead controls
- [ ] Server-side permission guard on every route
- [ ] Backend lines changed: **0**
- [ ] `npm run validate` unchanged · V1 byte-identical · build + lint clean
- [ ] **Owner approves the module**

---

## Standing gates — every phase from 4 onward

```bash
npx tsc --noEmit
npm run validate                                   # 1,575 passed, 0 failed (D-023)
cd web && npm run build && npm run lint
npm run check:v2                                   # D-019/D-023 snapshots + contracts
```
