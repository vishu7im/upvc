# Phase 6 — Dashboard / Home

**Status:** approved 2026-08-08. The owner authorised V2-M7 Orders with “next please”.

## Goal

The first real V2 screen: a role-aware home that answers *what am I looking at*, *what should I do
next*, and *can I finish it in a few clicks* — without scrolling.

## Context-in-a-box

Read first: phase 2's **dashboard content model** (which numbers, for which role, from which
endpoint), `00-foundation/UI_GUIDELINES.md`, `00-foundation/COMPONENT_LIBRARY.md`,
`00-foundation/API_REUSE.md`.

**V1's dashboard** (`web/app/(app)/page.tsx`, 321 LOC) is worth studying because it has already been
through one honesty pass: it used to draw a hardcoded 12-bar chart and a fake three-service "system
health" list, and both were **deleted** because a dashboard that invents numbers is worse than one
that shows none. Everything on it today is real:

- 4 metric cards — *Profile systems · Product lines · Confirmed value · Draft workload*
- a 6-month bar chart of confirmed-order value, bucketed client-free in the Server Component from
  `GET /api/orders?page=1&limit=100`
- "Quick actions" (4 tiles) and "Engine status" (3 observed facts)
- a Recent orders table (6 columns)

**Do not regress that honesty.** Every figure V2 shows must be traceable to an endpoint.

**What phase 0 found wrong with it:**

| Ref | Finding |
|---|---|
| **O-6** | The metrics are **engine-facing, not business-facing**. Two of four describe *catalog readiness*, which a factory owner cannot act on. Nothing shows what is due, late, or waiting on someone |
| **O-7** | "Engine status" surfaces **infrastructure to every role** — "Fabrication API — Responding" |
| **O-8** | **Five competing navigation affordances** and no single obvious next step |
| **O-9** | **Three information densities** on one screen: metric cards, a chart, a 6-column table |

**Money comes from one place.** `orderTotal` reads `basketTotal ?? totalPrice` — the same
`BasketTotals.grandTotal` the order page and the Price Summary print. `src/designer/basket.ts` is
the only place order money is derived. **V2 adds and discounts nothing** (P10, D-003).

## Deliverables

1. **`web/app/(v2)/v2/page.tsx`** — the V2 home, built from the phase-4 kit, implementing phase 2's
   content model.
2. **Role awareness.** What an owner sees first is not what a production operator sees first
   (`00-foundation/VISION.md`'s user table). Driven by `can(user, module, action)` and `user.nav` — **never by a
   hardcoded role name** (P12).
3. **One primary action** (P1). Everything else visibly subordinate.
4. **Empty state** for a brand-new installation — no orders, no confirmed value, nothing to chart.
   V1 handles the chart's empty case well ("Nothing to chart yet"); match or beat it.
5. **A traceability table** in `CHANGELOG.md`: every figure on the screen → the endpoint it came
   from. This is how "nothing invented" stays true after the fifth revision.

## Implementation checklist

- [x] Re-read phase 2's dashboard content model; confirm every figure has an endpoint
- [x] Build the screen from phase-4 components only — no inline styling, no bypassed tokens
- [x] Metrics are **business-facing** (O-6). If a needed metric has no endpoint → **stop**, file it
      in `BACKLOG.md`, and ship without it (D-003). Do not compute it client-side
- [x] Remove infrastructure status from the operator's view (O-7). If an admin needs engine health,
      it belongs on an admin surface, not the shared home
- [x] Exactly **one** primary action; count the primary-variant buttons visible without scrolling
- [x] Build the empty state
- [x] Verify role awareness with permission/scope fixtures matching the Admin and Customer defaults
- [x] Check the three questions are answered **above the fold** at 1280 and at 834
- [x] Write the traceability table
- [x] Run the standing verification stack
- [x] Update `CHECKLIST.md`, `MILESTONES.md`, `CHANGELOG.md`

## Acceptance criteria

- [x] **Every number traceable to an endpoint** — nothing invented, nothing decorative
- [x] The three questions (`00-foundation/VISION.md`) are answered without scrolling
- [x] ≤1 primary action visible at rest (P1)
- [x] Empty state renders correctly on a fresh install
- [x] Two permission/scope variants produce appropriately different homes, with no role name in the code
- [x] Zero dead controls (P2)
- [x] Backend lines changed: **0**
- [x] Standing stack green:

```bash
npx tsc --noEmit
npm run validate                                   # 1,568 passed, 0 failed
cd web && npm run build && npm run lint
git diff --stat <freeze> -- 'web/app/(app)' 'web/components/ui.tsx' 'web/app/globals.css'   # empty
git diff --stat <freeze> -- src prisma                                                       # empty
```

- [x] **A factory owner opens it and knows what to do next without asking** — owner accepted the screen
- [x] **Owner approves phase 6** before phase 7 begins

## Out of scope

Any other screen · new metrics that need backend work (→ `BACKLOG.md`) · production/workflow
status (**G-3** — it does not exist in the backend; **do not invent one**) · reporting beyond what
phase 2's content model specifies.

## Gates

⚠️ Any metric requiring a new endpoint is gated. Ship the dashboard without it and file the need.
⚠️ Anything implying order workflow state beyond `draft`/`confirmed` is gated on **G-3**.
