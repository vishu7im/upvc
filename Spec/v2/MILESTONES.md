# MILESTONES

> Phase 0 deliverable. One milestone per phase, each with acceptance criteria that can be **checked**,
> not argued about. Update the state column as work completes.
>
> States: ⬜ not started · 🟨 in progress · ✅ done · ⏸ blocked

| ID | Milestone | Phase | State | Blocked on |
|---|---|---|---|---|
| **V2-M0** | Repository Discovery | 0 | ✅ | — |
| **V2-M1** | UX Audit report | 1 | ✅ | — |
| **V2-M2** | Information Architecture | 2 | ✅ | — |
| **V2-M3** | Design System | 3 | ✅ | — |
| **V2-M4** | Component Library | 4 | ✅ | — |
| **V2-M5** | Application Shell | 5 | ✅ | — |
| **V2-M6** | Home / Dashboard | 6 | ✅ | — |
| **V2-M7** | Orders module | 7 | ✅ | — |
| **V2-M8** | Quote / configure module | 7 | ✅ | — |
| **V2-M9** | Catalog / products module | 7 | 🟨 **IMPLEMENTED; OWNER REVIEW** | Owner approval |
| **V2-M10** | Account + team module | 7 | ⬜ | M9 |
| **V2-M11** | Settings module | 7 | ⬜ | M10 |
| **V2-M12** | Catalog pricing editor | 7 | ⬜ | M11 |
| **V2-M13** | Parity sign-off + cutover decision | 8 | ⬜ | M12 |

---

## V2-M0 — Repository Discovery ✅

**Delivered 2026-08-07.**

- [x] Backend mapped: 96 files, 61,468 LOC, 12 subsystems
- [x] Frontend mapped: 89 files, 13,861 LOC, 18 routes
- [x] 75 endpoints enumerated across 19 routers (`00-foundation/API_REUSE.md`)
- [x] 35 Prisma models, 25 migrations catalogued
- [x] 18 screens measured with per-screen observations (`00-foundation/SCREEN_INVENTORY.md`)
- [x] RBAC model understood: 10 modules × 5 actions × 3 roles, nav as data
- [x] Existing planning read: `Spec/00-…`–`03-…`, `docs/rbac/PLAN.md`, `CLAUDE.md`
- [x] Every asset classified (`00-foundation/REUSE_ANALYSIS.md`): ~65,000 of ~75,000 LOC reused untouched
- [x] 25 documents authored in `Spec/v2/`
- [x] **Zero application code changed** — verifiable: `git diff --stat` touches only `Spec/v2/`

**Accepted 2026-08-07**, including **D-002 Option A** (V2 as a route group inside `web/`).

**Restructured 2026-08-07** to match the repository's established spec convention: 10 reference
documents moved into `00-foundation/`, 8 executable `phase-*.md` files added, `README.md` rewritten
as the phase map with a START HERE block.

---

## V2-M1 — UX Audit report

- [x] All 8 flows walked on the **running app**; `00-foundation/USER_FLOWS.md` click counts corrected from
      code-derived estimates to measurements
- [x] Every Phase 0 observation ranked by frequency × severity × affected user type
- [x] Top 10 pain points, each with its evidence
- [x] Cognitive-load measurement per screen (controls at rest, decisions demanded, terms unexplained)
- [x] `web/DESIGN/` mockups reviewed and their intent captured
- [x] Each `00-foundation/DESIGN_PRINCIPLES.md` principle confirmed or struck against evidence
- [x] Zero application code changed

**Accepted 2026-08-07.** The owner authorised Phase 2 with “p2 now”.

**Acceptance:** the owner recognises their own daily frustrations in the top 10, and can point at
the evidence for each.

## V2-M2 — Information Architecture

- [x] Navigation model, rendering from `user.nav`
- [x] Workflow model with a task-shaped entry point (**P3**)
- [x] Screen hierarchy + dashboard content model
- [x] To-be flows F1–F8 with click counts beside the V1 baseline
- [x] **Functional-parity map**: every V1 capability → its V2 home
- [x] `00-foundation/ROUTE_MAPPING.md` finalised; **Q-A** decided
- [x] All Phase 2 questions in `ROADMAP.md` answered or explicitly deferred
- [x] Zero code changed

**Accepted 2026-08-07.** The owner authorised Phase 3 with “start new phase now”.

**Acceptance:** F1 ("quote a standard window") drops from 5 navigational clicks and 4 screens to a
target the owner agrees is achievable, **with nothing removed**.

## V2-M3 — Design System

- [x] `00-foundation/UI_GUIDELINES.md` authored; U-1…U-15 decided or deferred with reasons
- [x] Every guideline carries an applicable check
- [x] Token isolation specified; `globals.css` untouched
- [x] Sizing meets **P6** (≥16 px body, ≥44 px targets)
- [x] Contrast verified against WCAG AA: 22/22 declared pairs pass
- [x] No component, route, V1, or backend code changed; isolated token sheet + specimen only

**Accepted 2026-08-07.** The owner authorised Phase 4 with “next please”.

**Acceptance:** two people applying the guidelines to the same screen produce the same result.

## V2-M4 — Component Library

- [x] `00-foundation/COMPONENT_LIBRARY.md` authored; C-1…C-9 decided
- [x] Kit built at `web/components/v2/**`, importing only the seam
- [x] Every data-owning component has empty + loading + error states; leaf/layout ownership is documented
- [x] Keyboard-operable, focus-visible, never colour-only
- [x] CI: no option key / module slug / role name hardcoded in `components/v2/**`
- [x] CI: V1 freeze check passes
- [x] `npm run validate` = 1,568 / 0

**Accepted 2026-08-07.** The owner approved D-020 and authorised Phase 5 with “start next phase
now”.

**Acceptance:** a screen can be assembled from the kit with no inline styling and no bypassed token.

## V2-M5 — Application Shell ⚠️ first routing code

- [x] `/` version chooser with remembered preference
- [x] V2 shell: layout, sidebar from `user.nav`, header, breadcrumbs, notifications, profile
- [x] Search **absent** until M7 Orders can return real results — never dead (**P2**, D-022)
- [x] Version switcher preserves the route where an equivalent exists, never 404s
- [x] Every V1 route reachable and unchanged
- [x] Switching code changes only `ui-version`; the httpOnly auth cookie is untouched
- [x] Build + lint clean; validate unchanged; V1 freeze check passes

**Accepted 2026-08-07.** The owner authorised Phase 6 with “start next phase now”.

**Acceptance:** the owner switches V1 ↔ V2 repeatedly, mid-task, without losing their session.

## V2-M6 — Home / Dashboard

- [x] Role-aware through permissions/nav and OWN/ALL scope; business KPIs, not engine metrics (**O-6**)
- [x] Infrastructure status not shown to operators (**O-7**)
- [x] Every number traceable to an endpoint — nothing invented
- [x] One primary action (**P1**)
- [x] Empty state for a new installation
- [x] Organisation-scope and personal-scope variants measured at 1280 and 834 px
- [x] Standing verification stack passes
- [x] Owner approves Phase 6 (2026-08-08: “next please”)

**Accepted 2026-08-08.** The owner authorised V2-M7 Orders with “next please”.

**Acceptance:** a factory owner opens it and knows what to do next without asking.

## V2-M7 … V2-M12 — Feature modules

Each module closes on the **same** checklist:

- [ ] Functional parity against its `00-foundation/SCREEN_INVENTORY.md` entry — every capability reachable
- [ ] Carried-over behaviours present (`00-foundation/REUSE_ANALYSIS.md` §6)
- [ ] Click count beats the V1 baseline for its flows
- [ ] Zero dead controls
- [ ] Permission-guarded server-side (closes **X-9** for its routes)
- [ ] Backend lines changed: **0**
- [ ] `npm run validate` unchanged · V1 byte-identical · build + lint clean

Module-specific notes:

| Milestone | Watch for |
|---|---|
| **M7 Orders** | Two item tables (**O-24**); 7 document cards (**O-27**); reopen must read as reversible (**O-28**); confirm's 422 payload must be rendered |
| **M8 Quote/configure** | **Q-A** must be settled first. `window-designer.tsx` is **wrapped, never rewritten**. Debounce + stale-response discard + last-good-preview retention are non-negotiable |
| **M9 Catalog** | The 1+N SVG fetch (**G-1**) and missing filters (**G-2**) — decide, don't drift |
| **M10 Account+team** | `DELETE /api/users/:id` has two legitimate outcomes |
| **M11 Settings** | Financial and branding are unrelated concerns sharing a form |
| **M12 Pricing editor** | Densest screen in the app. CSV import is the fast path — surface it properly |

### V2-M7 — Orders

- [x] Functional parity: all fourteen Orders rows in Phase 2's map are ticked
- [x] Server GET search/status/pagination and one keyboard destination per row
- [x] One neutral item list, both mutation families reachable, per-line server basket prices
- [x] Customer/reference edits, delete, confirm 422 issues and reversible reopen explanation
- [x] One server basket ledger plus all commercial inputs
- [x] Seven documents grouped 2 / 4 / 1 with HTML, PDF download and supplied variants
- [x] F5 reaches 1 + 2; M7's F6 bridge improves 4 + 3 to 3 + 3 pending M8's workspace
- [x] Nineteen live desktop/tablet evidence states; zero measurement failures
- [x] Permission guards, zero dead controls, 1,568/0, build, lint, contracts and freeze checks pass
- [x] **Owner approves V2-M7** (2026-08-10: “continue from now where we at”)

**Accepted 2026-08-10.** The owner authorised V2-M8 Quote / configure with “continue from now
where we at”.

### V2-M8 — Quote / configure

- [x] One guarded `/v2/configure` route owns Standard and Custom disclosure without resetting its draft
- [x] Task-first family → scoped quotable-layout entry replaces the bare configurator route
- [x] Exactly one `LineItemDraft` reducer; 350 ms debounce, sequence discard, last-good preview and first-load toast suppression
- [x] Standard retains dimensions/options, 2D/3D, optional joints, server engineering price/BOM and disclosed legacy persistence semantics
- [x] Custom retains component selection, apply scope, four views, structural actions, Undo and issue fixes
- [x] Order create/add/edit/replace context and intentional in-workspace server customer-price basket
- [x] Orders Add/Edit now enter V2 configure; F1–F4 and F6 meet the Phase 2 navigation targets
- [x] Fourteen authenticated task/workspace/interaction states at 1280 and 834 px; no measurement failures
- [x] Configure contracts, root/web types, zero-warning lint, production build and frozen V1 checks pass
- [x] Owner identified the concurrent catalog work as intentional; D-023 records its 1,575/0
      backend snapshot and one content-pinned V1 admin-editor companion
- [x] **Owner approves V2-M8 before V2-M9 begins** (2026-08-10: “backend changes are mine ignore them and forward to next step”)

**Accepted 2026-08-10.** The owner authorised V2-M9 Catalog / products with “backend changes are
mine ignore them and forward to next step”.

### V2-M9 — Catalog / products

- [x] Both mapped routes are real and server-guarded: `products.view` list and `products.read` gallery
- [x] Paginated product lines retain names, design counts, profile system and catalog type
- [x] Paginated per-product layouts fetch full SVG records through the existing 1+N contract;
      each failed detail request degrades only its own tile
- [x] Configurable and reference-only layouts are separate sections; reference cards have zero actions
- [x] One page-level Standard/Custom task choice gives every configurable card exactly one explained action
- [x] No unsupported family, size or opening-type filter is presented; G-1 and G-2 stay parked under D-024
- [x] Product/order/page context survives browsing and V1↔V2 route switching
- [x] Phase 2's four Products/configuration-source parity rows are ticked; M9 owns no separate F1–F8 flow
- [x] Eleven authenticated runtime states and eight 1280/834 captures have no measurement failures;
      both layout actions reach the live shared workspace
- [x] Products contracts, root/web types, zero-warning lint, production build, 1,575/0 validation
      and D-019/D-023 snapshot checks pass
- [ ] **Owner approves V2-M9 before V2-M10 begins**

**Implementation ready for owner review 2026-08-10.** V2-M10 Account + team has not started.

## V2-M13 — Parity sign-off + cutover decision

- [ ] Every row of the functional-parity map ticked
- [ ] All 8 flows measured in V2 vs V1
- [ ] Success metrics from `00-foundation/VISION.md` reported with real numbers
- [ ] Owner decides whether V2 becomes the default landing (V1 **stays available regardless**)

**Acceptance:** a factory operator completes the common tasks with fewer clicks, less scrolling and
more confidence — **and 100% of V1's functionality is still there.**
