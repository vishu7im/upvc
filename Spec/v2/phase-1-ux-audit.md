# Phase 1 — UX Audit

**Status 2026-08-07:** ✅ evidence complete and owner approved · Phase 2 authorised

## Goal

Turn phase 0's ~45 recorded observations into a **ranked, evidenced improvement report**, and
correct the flow measurements that phase 0 could only estimate. Produce documentation only. Change
no application code.

## Context-in-a-box

Read first: `00-foundation/SCREEN_INVENTORY.md` (all 18 screens, observations O-1…O-31, X-1…X-9,
G-1…G-5), `00-foundation/USER_FLOWS.md` (the 8 tasks, as-is),
`00-foundation/DESIGN_PRINCIPLES.md` (P1…P14, **draft — this phase may strike from it**),
`00-foundation/VISION.md` (who the users are).

**The one thing phase 0 could not do:** it never ran the app. The click counts in `00-foundation/USER_FLOWS.md`
are derived from reading routes, links and handlers. **Correcting them by walking the running app
is this phase's first task**, and the corrected numbers become the baseline every later phase is
measured against.

Running the stack (owner machine):

```bash
npm run db:up                      # postgres:16 :5432, MinIO :9000/:9001
npx prisma migrate deploy          # NOT `migrate dev` behind a pooler on :5433
npm run db:seed                    # ⚠ takes 15+ minutes — never wrap in `timeout`, it
                                   #   truncates silently with exit 0 and skips designer options
npm start                          # engine :3005
cd web && npm run dev              # UI :3000
```

Known traps (from `memory/`): the first query on a cold PgBouncer connection fails — retry; the
`.env` admin password no longer works, so create a throwaway user for live checks.

Screens are permission-filtered, so audit as **at least two roles**: an admin (sees everything) and
a Customer-role user (`CUSTOMER_GRANTS` in `src/rbac/registry.ts`: dashboard + products read-only,
own quotes and orders). The difference between them **is** finding X-9.

## Deliverables

1. **Corrected flow measurements.** Walk F1–F8 on the running app. Record actual navigational
   clicks, screens traversed, form interactions, scroll depth and dead ends. Rewrite the table in
   `00-foundation/USER_FLOWS.md`, replacing the ⚠️ method caveat with the real method.
2. **Screenshot set.** Each of the 18 screens at 1280 and 1920 wide, plus 834 (tablet portrait —
   a real factory device). Store under `Spec/v2/audit/screens/`. Include the empty states and at
   least one error state.
3. **Cognitive-load table.** Per screen: controls visible at rest · decisions demanded before the
   primary action · unexplained trade terms · distinct information densities · competing
   affordances. This is what makes "cluttered" measurable instead of an opinion.
4. **Ranked observation register.** Every O-/X-/G- item scored on
   **frequency × severity × affected user type**, sorted. Publish the scoring rubric so the ranking
   can be argued with.
5. **Top 10 pain points**, each with: what happens, who it hurts, how often, the evidence
   (screenshot + file:line), and the cost (clicks, time, or task abandonment).
6. **Mockup review.** The 7 mockups in `web/DESIGN/*/` (`code.html` + `screen.png`) are prior art on
   the owner's own taste: dashboard, orders, order documents, products, quote configurator,
   administration, and **production control — a screen that was designed and never built**. Capture
   what each intends and where it disagrees with the shipped app.
7. **Principle verdicts.** For each of P1…P14 in `00-foundation/DESIGN_PRINCIPLES.md`: **confirmed**
   (with the evidence) or **struck** (with the reason). A principle that survives without evidence
   is decoration — strike it.
8. **The report** — `Spec/v2/phase-1-findings.md`, written for the owner, not for an engineer.

## Implementation checklist

- [x] Start the stack; create a throwaway admin and a Customer-role user
- [x] Walk **F1** (quote a standard window) via the header CTA path **and** the sidebar path;
      record both — phase 0's hypothesis is that the prominent CTA is the *longer* route (O-3)
- [x] Walk F2 (quote → order), F3 (studio), F4 (commercial extras), F5 (confirm + print a cutting
      list), F6 (correct a confirmed order), F7 (update a supplier price), F8 (add a user + grant)
- [x] Time each flow with one instrumented evaluator; label results as a single run, not a human average
- [x] Record every dead end, backtrack, and unclear next step encountered
- [x] Screenshot all 18 screens × 3 widths; capture empty and error states
- [x] Fill the cognitive-load table
- [x] Verify each phase-0 observation; correct O-5/O-19 and qualify X-9
- [x] Score and rank the register; write the rubric down
- [x] Read all 7 `web/DESIGN/` mockups
- [x] Issue a verdict on P1…P14
- [x] Write `phase-1-findings.md`
- [x] Update `CHECKLIST.md`, `MILESTONES.md`, `CHANGELOG.md`
- [x] **Confirm zero application code changed** (`git status` shows only `Spec/v2/`)

## What to look for that phase 0 could not see

Phase 0 read code. These only appear when the app runs:

- **Latency.** How long until the first paint on `/products/[id]` (it fires `1 + N` requests —
  gap G-1)? Does the 350 ms debounce feel responsive or laggy on a real quote?
- **Scroll depth.** `/orders/[id]` stacks 7 sections. How far is "Confirm" from the top?
- **Reflow.** Does the sticky 280 px configuration card collide with the canvas at 1280?
- **Real content.** ~516 designs, hundreds of catalog rows, 128 hardware entries — density on real
  data, not on the 2 rows a mock returns.
- **Error text.** What does a confirm 422 actually *say* on screen? What does a resolve failure look
  like? Is `pending_approval` distinguishable from a successful delete?
- **The Customer role.** What does a non-admin actually see — and where do they hit an API error
  instead of a redirect (X-9)?
- **Tablet.** Is any of this usable at 834 px with a finger?

## Acceptance criteria

- [x] Every click count in `00-foundation/USER_FLOWS.md` is **measured**, and the ⚠️ caveat removed
- [x] Every ranked item cites reproducible evidence (screenshot + file:line, or a recorded walk)
- [x] The top 10 are ordered by a **written, arguable rubric** — not by taste
- [ ] The owner reads the top 10 and recognises their own daily frustrations
- [x] Every principle P1…P14 has a verdict
- [x] `git status` shows only `Spec/v2/`
- [x] **Owner approves phase 1** before phase 2 begins (2026-08-07: “p2 now”)

## Out of scope

- Proposing solutions. This phase says *what is wrong and how badly*; phase 2 says *what to do*.
  A finding may note "the fix is structural" without designing the structure.
- Any visual design, any tokens, any components.
- Any code, including "quick fixes" to V1 — **especially** those. The dead header search stays dead
  in V1; V2 is where it gets fixed or removed (P2).
- Closing a capability gap (G-1…G-5). Those are `BACKLOG.md` items for the owner.

## Gates

⚠️ Nothing in this phase is gated — it can start as soon as phase 0 is approved. It **produces** the
inputs that gate phase 2 (which needs the ranking to decide what the IA must optimise for).
