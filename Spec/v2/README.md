# FabricatorOS V2 — Phase Map

> **Task 4: rebuild the frontend UX.** V1 (`web/app/(app)/*`) is feature-complete and stays
> untouched; V2 is a second UI over the identical backend, engine, database, auth and permissions.
> Normative context in `00-foundation/` (read `00-foundation/VISION.md` + `00-foundation/ARCHITECTURE.md` first; the other
> foundation files are referenced per phase).

---

## ▶ START HERE — telling a new session what to do

Paste this into a fresh session:

```
Read Spec/v2/README.md, then Spec/v2/MILESTONES.md to find the current phase,
then open that phase's file (Spec/v2/phase-N-*.md) and execute it.
```

Or name the phase directly: *"Execute `Spec/v2/phase-1-ux-audit.md`."*

**Current state → `MILESTONES.md`.** As of 2026-08-10: **Phases 1–6, V2-M7 Orders and V2-M8 Quote /
configure are owner-approved. V2-M9 Catalog / products implementation, contracts and authenticated
evidence are complete and awaiting owner approval; later feature modules have not started.**

Each `phase-*.md` is **self-contained**: it carries its own Context-in-a-box, so a cold session
needs only that file plus the `00-foundation/` files it names.

---

## Owner decisions (fixed — do not re-litigate)

- **V1 is never modified.** Not its routes, not its bytes, not its behaviour.
  `web/app/(app)/**`, `web/components/ui.tsx` and `web/app/globals.css` are **frozen** and
  CI-diff-checked.
- **V2 lives as a route group inside `web/`** — `web/app/(v2)/`, sharing the BFF proxy,
  `lib/api.ts`, `lib/types.ts`, `permissions.ts` and the canvas widgets. **Owner approved
  2026-08-07** (`DECISIONS.md` D-002, Option A). Not a separate app.
- **V2 adds no features.** If a capability is absent from V1, it is absent from V2. It also
  **removes none**: things may be deferred, grouped or hidden-until-needed, never deleted (D-005).
- **V2 adds no backend code.** Target **0 lines changed** under `src/` and `prisma/`. A missing
  endpoint or field **stops work** and is filed in `BACKLOG.md` for separate approval (D-003).
- **Users switch V1 ↔ V2 freely**, from `/` and from a switch in both shells. Switching never
  re-authenticates and never 404s.
- **The fabrication canvas is wrapped, never rewritten.** `window-designer.tsx` (1,160 LOC) and
  `window-3d.tsx` (505 LOC) gain **optional props that are no-ops when omitted** — the pattern
  already used for `components`, `selectedComponentId`, `mirrored` (D-007).
- **The golden rule still applies to the UI.** V2 computes no size, price, deduction or limit. It
  displays what the engine returns (D-003, P13).
- **Phases 0–2 are documentation only.** Phase 3 adds only the isolated V2 token sheet; Phase 4 is
  the first component code and Phase 5 is the first routing code.

## Folder map

```
Spec/v2/
├── README.md                    ← you are here (entry point + execution graph)
├── MILESTONES.md                ← WHICH PHASE AM I IN — check this first
├── ROADMAP.md                   phase scope + exit criteria
├── CHECKLIST.md                 live task ticks
├── DECISIONS.md                 ADR log (D-001 … D-024)
├── BACKLOG.md                   parked items + owner questions (B-1…B-5, G-1…G-5)
├── CHANGELOG.md                 dated record of what happened
├── 00-foundation/               ← NORMATIVE. Read the ones your phase names.
│   ├── VISION.md                    why V2 exists, who for, success metrics
│   ├── ARCHITECTURE.md              V1 as-built + V2 target + coexistence + layering rules
│   ├── REUSE_ANALYSIS.md            every V1 asset classified reuse/wrap/rebuild/frozen
│   ├── API_REUSE.md                 all 75 endpoints + V2 usage + gaps
│   ├── SCREEN_INVENTORY.md          all 18 V1 screens measured; observations O-1…O-31, X-1…X-9
│   ├── USER_FLOWS.md                the 8 tasks that matter, as-is (to-be = phase 2)
│   ├── ROUTE_MAPPING.md             V1 route → V2 route (finalised in phase 2)
│   ├── DESIGN_PRINCIPLES.md         P1…P14 (ratified in phase 3)
│   ├── UI_GUIDELINES.md             U-1…U-15 design-system contract
│   └── COMPONENT_LIBRARY.md         C-1…C-9 + public component contracts
├── phase-0-discovery.md         ✅ DONE
├── phase-1-ux-audit.md
├── phase-2-information-architecture.md
├── phase-3-design-system.md
├── phase-4-component-library.md
├── phase-5-application-shell.md
├── phase-6-dashboard.md
└── phase-7-feature-migration.md
```

## Phases & dependency graph

```
phase-0-discovery              ✅ inventory the repo; no code
        │
phase-1-ux-audit               ✅ walk the running app; rank the pain; no code
        │
phase-2-information-architecture   ✅ nav, workflow, hierarchy, parity map
        │
phase-3-design-system          ✅ isolated, enforceable visual system
        │
phase-4-component-library      ✅ component kit approved
        │
phase-5-application-shell      ✅ shell and coexistence approved
        │
phase-6-dashboard              ✅ role-aware Home approved
        │
phase-7-feature-migration      🟨 Orders + quote/configure approved → catalog implemented, awaiting approval → account+team → settings → pricing
```

**Strictly sequential.** Unlike Task 1, nothing here parallelises: each phase's output is the next
phase's input. Phase 7's six modules ship one at a time, each approved before the next.

## Per-phase one-liners & key deliverables

| Phase | Delivers | Primary new locations |
|---|---|---|
| 0 | Repo inventory, reuse classification, 17 planning docs | `Spec/v2/**` |
| 1 | Measured flows, ranked pain points, top-10 report | `phase-1-findings.md`, `audit/`, `00-foundation/USER_FLOWS.md` (corrected) |
| 2 | Navigation model, task-shaped entry, **functional-parity map**, Q-A decided | `00-foundation/ROUTE_MAPPING.md` (final), `phase-2-…md` §Output |
| 3 | `00-foundation/UI_GUIDELINES.md` authored; U-1…U-15 decided | `00-foundation/UI_GUIDELINES.md`, `web/app/v2.css` |
| 4 | `00-foundation/COMPONENT_LIBRARY.md` authored; the kit built | `00-foundation/COMPONENT_LIBRARY.md`, `web/components/v2/**` |
| 5 | Version chooser, V2 shell, routing, switcher | `web/proxy.ts`, `web/app/version-chooser/`, `web/app/(v2)/**` |
| 6 | Role-aware home | `web/app/(v2)/v2/page.tsx`, `web/lib/v2/dashboard-*.ts`, `dashboard/` |
| 7 | Six feature modules, one at a time | `web/app/(v2)/**` |

## How to execute a phase (any phase)

1. Read the phase file top to bottom; also read the `00-foundation/` files it names — those are
   **normative**, and the phase files do not restate them.
2. Honour the phase's **Context-in-a-box**. It lists the repo facts you need; verify them briefly
   against the code (these specs were written 2026-08-07; drift is possible).
3. Follow the implementation checklist **in order**.
4. **Gate check**: steps marked ⚠️ are gated on an owner decision in `DECISIONS.md` or an item in
   `BACKLOG.md`. Skip gated steps; never improvise past a gate.
5. Verify against the phase's acceptance criteria **plus the standing stack** below.
6. Update: `CHECKLIST.md` (tick), `MILESTONES.md` (state), `CHANGELOG.md` (one dated entry),
   `DECISIONS.md` (any choice a future reader would re-litigate), and the phase file's own
   checklist. Update `ROADMAP.md` only if scope actually changed.
7. **Stop and request approval.** Never begin the next phase unprompted.

## Standing verification stack

Phases 0–2 change no application code. Phase 3 permits only `web/app/v2.css` and runs the full
regression stack as an acceptance gate. From phase 4 onward, all lines apply:

```bash
npx tsc --noEmit
npm run validate                                   # MUST stay 1,575 passed, 0 failed (D-023)
cd web && npm run build && npm run lint
npm run check:v2                                   # V1/owner snapshots + V2 contracts
```

`check:v2` keeps V1 on the immutable D-019 commit except for D-023's one content-pinned owner
admin-editor companion, and separately pins the owner-approved backend content. That preserves
mechanical boundaries even while the owner change set is not yet a commit.

## Non-negotiable project rules (inherited from the codebase, restated once)

- **Engine purity**: `src/engine/*` and `src/designer/*` stay pure — no I/O. The catalog loader is
  the only data seam.
- **Golden rule**: never guess a fabrication formula, deduction, code or price. V2 never computes
  one at all.
- **Additive & byte-identical by default**: every extension to a shared file is a no-op when its
  new input is absent.
- **Nav and permissions are DATA** (`/api/auth/me` ← `src/rbac/registry.ts`). V2 never hardcodes a
  menu or a role name.
- **No option key appears anywhere under `web/`** — an invariant V1 holds and V2 must keep.
