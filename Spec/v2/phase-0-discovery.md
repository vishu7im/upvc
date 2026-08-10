# Phase 0 — Repository Discovery ✅ COMPLETE (2026-08-07)

## Goal

Understand the entire repository before proposing anything. Produce documentation only. Change no
application code.

## Context-in-a-box

FabricatorOS is a uPVC/aluminium fabrication ERP: a pure calibrated fabrication engine
(`src/engine/*`), a schema-driven configurator platform (`src/designer/*`), a Postgres catalog
(`src/catalog/loader.ts` is the only data seam), an Express API (`src/api/*`) and a Next.js
frontend (`web/`). V1 is feature-complete and in production. **The problem is UX, not
functionality.**

## Deliverables — all delivered

1. **Backend inventory** — 96 files, 61,468 LOC across engine, designer, catalog, api, services,
   rbac, tools, validation, db.
2. **Frontend inventory** — 89 files, 13,861 LOC; Next 16 / React 19 / Tailwind v4 / three.js.
3. **API inventory** — **75 endpoints across 19 routers** → `00-foundation/API_REUSE.md`.
4. **Data model** — 35 Prisma models, 25 migrations.
5. **Screen inventory** — all 18 routes measured, with per-screen observations →
   `00-foundation/SCREEN_INVENTORY.md`.
6. **Reuse classification** — every asset marked reuse / wrap / rebuild / frozen →
   `00-foundation/REUSE_ANALYSIS.md`.
7. **Architecture** — V1 as-built verified, V2 target proposed, coexistence + layering rules →
   `00-foundation/ARCHITECTURE.md`.
8. **17 planning documents** in `Spec/v2/`.

## Implementation checklist — all ticked

- [x] Root structure, build/run scripts, deployment (`Dockerfile`, `docker-compose.yml`, `Caddyfile`)
- [x] `src/**` — all 12 subsystems
- [x] `web/**` — all routes, components, lib, `DESIGN/` mockups
- [x] `prisma/schema.prisma` + 25 migrations
- [x] All 19 routers → 75 endpoints
- [x] RBAC: `src/rbac/registry.ts`, `src/api/rbac/*`, `docs/rbac/PLAN.md`
- [x] Existing planning: `Spec/00-architecture` … `Spec/03-doors-module`, `Spec/questions.md`
- [x] `CLAUDE.md` (152 KB), `ENGINE_ARCHITECTURE.md`, `handoff.md`, `task.md`
- [x] Git history — 40 commits
- [x] **Verified, not assumed**: the dead header search, the two dead CTAs, `/designer`'s missing
      nav entry and missing RBAC module, page guards on admin routes only, orders' real
      server-side search, the page-less `customers` module
- [x] 17 documents authored
- [x] **Zero application code changed**

## Findings (facts; ranking is phase 1's job — D-004)

Full set in `00-foundation/SCREEN_INVENTORY.md` as O-1…O-31, X-1…X-9, G-1…G-5. The headline six:

| # | Finding |
|---|---|
| **O-5 / O-19** | The Designer studio — the most capable screen in the product — has **no sidebar entry and no RBAC module**. Phase 1 found a dashboard shortcut, but it opens an unusable bare route; the functional entry is a secondary gallery-card link |
| **O-1 / O-2 / O-3** | Three dead or misleading controls in the highest-traffic chrome: the header search has **no handler and no form**; "Create order" navigates to a list; "Quick quote" lands on an empty state that sends the user elsewhere. **The prominent CTA is the longer path** |
| **X-1** | Two configurators (`/quote`, `/designer`) with overlapping jobs, linked from the same card, nothing explaining which to use |
| **X-2** | Two unrelated interaction languages — the Designer's progressive-disclosure/tri-state grammar exists in **1 screen out of 18** |
| **X-6** | Every flow starts by browsing ~516 designs rather than by naming the task |
| **X-8** | Density calibrated for experts: 14 px body, 11 px uppercase micro-labels, 32–40 px targets, `max-w-[1500px]` — against a 35–65-year-old user |

**~65,000 of ~75,000 LOC are reusable untouched.** V2 is a presentation layer.

## Acceptance criteria — met

- [x] Every route, endpoint, model and screen inventoried
- [x] Every V1 asset classified
- [x] Architecture verified and V2 target proposed
- [x] Observations recorded as facts with evidence; judgement deferred to phase 1
- [x] `git status` touches only `Spec/v2/`
- [x] Owner approved 2026-08-07, including **D-002 Option A** (V2 as a route group in `web/`)

## Out of scope

Ranking the findings (phase 1) · designing anything (phases 2–4) · any code (phase 5+) ·
measuring click counts on the running app (phase 1 — the counts in
`00-foundation/USER_FLOWS.md` are **code-derived estimates** and are flagged as such).

## Baselines recorded

| Baseline | Value |
|---|---|
| `npm run validate` | **1,568 passed, 0 failed** *(from `CLAUDE.md`; not re-run — no DB exercised in phase 0)* |
| Backend / frontend LOC | 61,468 / 13,861 |
| API endpoints | 75 across 19 routers |
| Prisma models / migrations | 35 / 25 |
| V1 routes (in sidebar) | 18 (9) |
