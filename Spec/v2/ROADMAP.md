# ROADMAP

> Phase 0 deliverable. **Each phase must be approved before the next begins.** No phase starts early.
> Phases 0–2 are documentation only. Phase 3 adds only isolated tokens, Phase 4 starts components,
> and Phase 5 starts routing code.

## Status board

| Phase | Name | Output | State |
|---|---|---|---|
| **0** | Repository Discovery | 25 documents | ✅ **Complete — approved 2026-08-07** |
| 1 | UX Audit | Evidence-ranked pain points | ✅ **Complete — approved 2026-08-07** |
| 2 | Information Architecture | Nav, workflow, hierarchy | ✅ **Complete — approved 2026-08-07** |
| 3 | Design System | Tokens, type, colour, density | ✅ **Complete — approved 2026-08-07** |
| 4 | Component Library | The V2 kit | ✅ **Complete — approved 2026-08-07** |
| 5 | Application Shell | Layout, routing, version switcher | ✅ **Complete — approved 2026-08-07** |
| 6 | Dashboard / Home | First real screen | ✅ **Complete — approved 2026-08-08** |
| 7+ | Feature migration | One module at a time | 🟨 **V2-M9 implemented; owner review pending** |

---

## Phase 0 — Repository Discovery ✅

**Goal:** understand everything. Change nothing.

Done: 96 backend files (61,468 LOC) and 89 frontend files (13,861 LOC) mapped; 75 endpoints
enumerated; 35 Prisma models and 25 migrations catalogued; 18 screens measured; the RBAC data model
understood; all existing `Spec/` and `docs/` planning read; 25 documents authored in `Spec/v2/`.

**Exit criteria** — all met:

- [x] Every route, endpoint, model and screen inventoried
- [x] Every V1 asset classified reuse / wrap / rebuild / frozen (`00-foundation/REUSE_ANALYSIS.md`)
- [x] Architecture verified, V2 target proposed, coexistence model defined
- [x] Observations recorded **as facts with evidence**, judgement deferred to Phase 1
- [x] Zero application code changed

**Approved 2026-08-07**, including **D-002 Option A** — V2 as a route group inside `web/`.

---

## Phase 1 — UX Audit ✅

**Goal:** turn Phase 0's ~40 observations into a ranked, evidenced improvement report.

Scope:

1. **Walk the running app** — validate the click counts in `00-foundation/USER_FLOWS.md` (they are currently
   derived from code, not measured). This is the first task and it corrects the record.
2. Rank every observation by **frequency × severity × who it hurts**.
3. Cognitive-load pass per screen: controls visible at rest, decisions demanded, terms unexplained.
4. Read the 7 mockups in `web/DESIGN/` — prior art on the owner's own taste, including a
   production-control screen that was designed and never built.
5. Confirm or **strike** each principle in `00-foundation/DESIGN_PRINCIPLES.md` against the evidence.

**Exit criteria:**

- [x] Click/screen counts measured on the running app, `00-foundation/USER_FLOWS.md` corrected
- [x] Every observation ranked, with the user type it hurts and how often
- [x] Top 10 pain points named, each with the evidence that justifies its rank
- [x] Each principle confirmed or struck
- [x] Still zero code changed

**Approved 2026-08-07.**

---

## Phase 2 — Information Architecture

**Approved 2026-08-07.** Selected: permission-derived
Work/Manage navigation, two task entries into one configure workspace, order-only search, unified
line items, in-workspace customer pricing, grouped documents and preserved V1 URLs.

**Goal:** decide the structure. Still no pixels, still no code.

Scope: navigation model · workflow shape (task-shaped entry, **P3**) · screen hierarchy ·
dashboard content · to-be flows for F1–F8 with click counts against the V1 baseline.

**Decided in Phase 2** (D-008…D-017, owner approved 2026-08-07):

- **Q-A:** two task entries, one configure workspace (`D-009`).
- **Task entry:** choose Standard/Custom intent, then an API-supplied family, then a scoped starting
  layout; the 516-design gallery is no longer mandatory (`D-008`).
- **B-1:** no Designer RBAC module; Custom is governed by `quotes` (`D-010`).
- **O-27:** group all seven documents as Office, Production and Dispatch (`D-012`).
- **O-26:** Customer price lives in the configure workspace after intentional draft-on-review;
  only the server basket is displayed (`D-013`).
- **O-1/G-5:** header search is explicitly **Search orders**, backed by `?q=` (`D-011`).
- **V1 URLs:** keep canonical V1 paths and add `/v1/*` aliases; no preference redirect (`D-015`).

**Exit criteria:**

- [x] Navigation model, with the proof it still renders from `user.nav`
- [x] To-be flows for F1–F8, click counts beside the V1 baseline
- [x] **A functional-parity map**: every V1 capability → where it lives in V2. This is what makes
      "nothing removed" checkable rather than asserted
- [x] `00-foundation/ROUTE_MAPPING.md` finalised
- [x] Every question above answered, or explicitly deferred with a reason
- [x] Still zero code changed

---

## Phase 3 — Design System

**Accepted 2026-08-07.** The owner authorised Phase 4 with “next please”.

**Goal:** author `00-foundation/UI_GUIDELINES.md`.

Scope: U-1 … U-15 in that document — type scale, spacing, control sizing, colour, radius,
elevation, content width, the state grammar, density, icons, dark mode, motion, token isolation,
print safety.

**Exit criteria:**

- [x] `00-foundation/UI_GUIDELINES.md` authored, every decision made or explicitly deferred
- [x] Every guideline carries a check a reviewer can apply
- [x] Token isolation specified (`--v2-*` in `app/v2.css`, `globals.css` untouched)
- [x] Sizing satisfies **P6**; the readability gap (14 px body, 11 px labels, 32 px targets) closed
- [x] No component, route, V1, or backend code changed; only the isolated token sheet was added

---

## Phase 4 — Component Library

**Accepted 2026-08-07.** The owner authorised Phase 5 with “start next phase now”.

**Goal:** author `00-foundation/COMPONENT_LIBRARY.md` and build the kit.

Scope: C-1 … C-9. The named set: sidebar, header, cards, `DataTable`, forms, wizard, drawer,
modals (only if proven), badges, timeline (gated on **G-3**), status chips, skeletons, loading,
notifications.

**Exit criteria:**

- [x] `00-foundation/COMPONENT_LIBRARY.md` authored with a real API per component
- [x] Kit built under `web/components/v2/**`, importing only the seam
- [x] Data owners have empty/loading/error; leaf/layout ownership is documented; all are keyboard/focus safe
- [x] Sizing enforced **by construction**, not convention (A.2's bypass lesson)
- [x] CI check: no option key, module slug or role name hardcoded in `web/components/v2/**`
- [x] CI check: `web/app/(app)/**`, `ui.tsx`, `globals.css` unchanged versus the freeze commit
- [x] `npm run validate` still **1,568 passed, 0 failed**

---

## Phase 5 — Application Shell ⚠️ first code touching routes

**Accepted 2026-08-07.** The owner authorised Phase 6 with “start next phase now”.

**D-002 settled (Option A).** V2 mounts at `web/app/(v2)/`; V1 stays frozen at `web/app/(app)/`.

Scope: `/` version chooser · V2 layout, sidebar (from `user.nav`), header · routing under `/v2/*` ·
theme wiring · breadcrumbs · **search — real or absent, never dead (P2)** · notifications · user
profile · the version switcher that preserves the route where an equivalent exists.

**Exit criteria:**

- [x] `/` offers V1 and V2 with a remembered preference
- [x] Every V1 route still reachable and unchanged
- [x] Switch targets never 404; switching touches only `ui-version`, never the auth cookie
- [x] V2 shell renders navigation from `user.nav` alone
- [x] Zero dead controls; header search is absent until M7 rather than inert
- [x] `web/` builds and lints clean; `npm run validate` unchanged
- [x] Owner completes the authenticated switch test and approves Phase 5

---

## Phase 6 — Dashboard / Home

**Accepted 2026-08-08.** The owner authorised V2-M7 Orders with “next please”.

Scope: role-aware home. Business KPIs, not engine metrics (**O-6**); infrastructure status removed
from the operator's view (**O-7**); recent activity; **one** obvious primary action (**P1**).

**Exit criteria:**

- [x] Every number traceable to an endpoint in `00-foundation/API_REUSE.md` — nothing invented (V1 already earned
      this by deleting a hardcoded chart; do not regress it)
- [x] The three questions answered without scrolling at 1280 and 834 px
- [x] Empty state for a brand-new installation
- [x] Permission/scope variants produce different organisation and personal homes without role-name code
- [x] Standing stack green; V1/backend freeze diffs empty
- [x] Owner approves Phase 6

---

## Phase 7+ — Feature migration

One module at a time, each shipped and approved before the next. Proposed order — **Phase 2 may
re-order it**:

| # | Module | Why here |
|---|---|---|
| 7 | **Orders** (list + detail + documents) | Highest daily traffic; V1's list is already the best-built screen, so the delta is detail + documents |
| 8 | **Quote / configure** | The biggest UX win and the biggest risk — needs Q-A settled and the canvas wrapped, not rewritten |
| 9 | **Catalog / products** | Browsing + the task-shaped entry point |
| 10 | **Account + team** (users, roles, approvals) | Self-contained |
| 11 | **Settings** (financial, branding, discounts) | Low traffic, high risk of getting wrong |
| 12 | **Catalog pricing editor** | Densest screen, admin-only, least urgent |

**Per-module exit criteria** (every module, no exceptions):

- [ ] Functional parity: every capability from that module's `00-foundation/SCREEN_INVENTORY.md` entry is reachable
- [ ] The carried-over behaviours in `00-foundation/REUSE_ANALYSIS.md` §6 are present (debounce, stale-response
      discard, 422 payload rendering, `pending_approval` handling, per-tile SVG degradation, …)
- [ ] Click count beats the V1 baseline for the flows it owns
- [ ] Zero dead controls
- [ ] Backend lines changed: **0**
- [ ] `npm run validate` unchanged; D-019/D-023 snapshots unchanged; `web/` builds and lints clean

---

## Standing verification stack

Run at the end of every phase from Phase 4 onward:

```bash
npx tsc --noEmit                      # types
npm run validate                      # MUST stay 1,575 passed, 0 failed (D-023)
cd web && npm run build && npm run lint
npm run check:v2                      # V1/owner snapshots and V2 contracts
```

The boundary check keeps the D-019 V1 freeze and both D-023 owner-approved content snapshots
mechanical rather than aspirational.
