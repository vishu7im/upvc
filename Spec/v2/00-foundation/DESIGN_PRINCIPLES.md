# DESIGN PRINCIPLES

> **Ratified in Phase 3, 2026-08-07.** Phase 1 confirmed P1–P14 against running-app evidence; none
> was struck. The numeric and visual enforcement rules are now fixed in `UI_GUIDELINES.md`.

## The frame

> Apple simplicity · Linear consistency · Stripe polish · Notion spacing · Figma cleanliness
> — **built for a factory operator, not for a startup founder.**

Read that translation carefully, because it inverts several of those references' defaults:

| Reference default | Our translation |
|---|---|
| Dense, keyboard-first (Linear) | **Consistent**, yes. Dense, no. Keyboard *as well as*, never *instead of* |
| Small type, tight tracking (Stripe) | Larger type, plain wording, generous targets |
| Infinite nesting (Notion) | Notion's *spacing*, none of its nesting |
| Expert canvas (Figma) | Figma's *cleanliness*; the canvas is the drawing, and it is already excellent |
| Minimal chrome (Apple) | Yes — and one obvious next step per screen |

---

## The three questions

Every V2 screen must answer these **before the user has to think**. This is the acceptance test for
every screen review in Phase 6 and 7+.

1. **What am I looking at?** — a plain-language title and one line of context. Not an eyebrow, a
   badge, an ID and a status chip.
2. **What should I do next?** — exactly **one** visually primary action. Everything else is
   secondary or quieter.
3. **Can I finish this in a few clicks?** — if the answer is no, the screen is wrong, not the user.

---

## P1 · One primary action per screen

V1's dashboard offers 5 competing navigation affordances and the shell offers 4 different ways to
start work (O-4, O-8). V2 screens have **one** primary button. Secondary actions are visually
subordinate; tertiary actions live behind an explicit "More".

*Falsifiable:* count the `primary`-variant buttons visible without scrolling. Must be ≤ 1.

## P2 · No dead controls, ever

A control that looks interactive **is** interactive. V1's header search is styled as the primary way
to find things and does nothing (O-1); "Create order" creates nothing (O-2); "Quick quote" leads to
an empty state (O-3).

*Falsifiable:* every interactive element in V2 either has a handler/href that performs its stated
promise, or is not rendered. **Zero exceptions.** This is a merge blocker, not a polish item.

## P3 · Start from the task, not from the catalog

Every V1 flow begins "browse ~516 designs" (X-6). Operators think *"a casement window, 1200 × 1200,
white, for Mrs Patel"* — not in design IDs.

V2 entry points are named after what the user is trying to do. The catalog remains, fully, for the
people who genuinely want to browse it.

## P4 · Progressive disclosure — but never removal

Show what is needed now; keep the rest one obvious click away.

V1 already proves this works: the Designer's inspector shows a row at rest when it is answered,
required-and-unset, carrying an issue, or among the first three in seed order — everything else sits
behind "N more". That grammar exists in **one screen out of eighteen** (O-21, X-2). V2 uses it
everywhere.

*Falsifiable:* every capability in `SCREEN_INVENTORY.md` is reachable in V2, and the reachability
checklist is what closes each Phase 7+ milestone.

## P5 · Plain words, with the trade term kept

The app is full of unexplained fabricator vocabulary: Chamber, Cill, Stulp, Transom, Mullion, BOM,
DMO, Planner List, Joints, Weld allowance (X-5).

Rule: **lead with the plain word, keep the trade term visible.** "Window sill (cill)". Not a
tooltip-only glossary — a production operator uses the trade term, and hiding it would patronise
them; a new salesperson does not, and hiding the plain word would block them. Both get served.

*Applies to document names too*: "Cutting list — for the saw" reads better than `cutting_list`, and
still says `cutting_list`.

## P6 · Sized for the hand and the eye

Target users are 35–65, sometimes standing, sometimes on a tablet, sometimes in a workshop.

- Minimum interactive target **44 × 44 px** (V1's controls are 40 px high and some are 32).
- Body text **16 px minimum**. V1 uses 11 px uppercase micro-labels throughout (X-8).
- Never rely on colour alone; never rely on hover alone.
- Content column narrower than V1's `max-w-[1500px]` — a 6-column table stretched to 1500 px is a
  scanning problem, not a density win.

*Falsifiable:* Phase 3 sets the numbers; Phase 4 enforces them in the component kit so no screen can
opt out.

## P7 · One interaction language

V1 has two: the Designer's, and everything else's (X-2). Two languages means every screen is a
fresh learning task.

One control kind per job. One state grammar (default / changed / needs-attention). One selection
model. One way to show an error. Defined once, in `COMPONENT_LIBRARY.md`, and imported — never
re-declared inline (which is how V1 ended up with three greys and two sizes of the same label,
before `labelClass` fixed it).

## P8 · The drawing is the hero

The elevation SVG is the product. It is what the operator recognises and trusts.

Give it room. Nothing decorative behind it (V1 already learned this: the blue dot grid was removed
because it competed with glass reflections). Chrome around it stays quiet. The canvas never
disappears while the user is configuring — no mode traps.

## P9 · Say what happened, and what it means

Feedback is specific, not decorative:

- Confirm's **422** names *which item* blocked it *and why* — V1 does this; V2 must not regress it.
- Deleting a user may return **`pending_approval`** — two outcomes, two messages.
- A resolve failure keeps the last-good preview and shows a retry banner. It never blanks the canvas.
- Reopening a confirmed order is reversible and must read that way (O-28).

## P10 · Money has one source and one shape

Order money comes from `basket` — `src/designer/basket.ts` is the only place it is derived, so the
API, the order page and the Price Summary cannot disagree.

**V2 adds, discounts and taxes nothing.** It shows what the basket returns. Where a total is
composed, show the composition in one ledger, in one place — not V1's three separate money surfaces
on a single screen (O-25).

## P11 · Fewer colours, more meaning

V1's tokens define 6 semantic colours plus a purple accent, and screens mix `slate-*`, `zinc-*`,
`emerald-*`, `amber-*`, `red-*`, `blue-*` and a hardcoded `#4442e3`.

V2: one neutral ramp, one accent, and semantic colour reserved for **state that requires action**
(error, warning, success). If everything is coloured, colour has stopped meaning anything.

## P12 · Permission-shaped, not role-shaped

Navigation and visibility come from `user.nav` and `can(user, module, action)` — data from
`/api/auth/me`, sourced from `src/rbac/registry.ts`.

**V2 never hardcodes a role name or a menu.** A user who lacks a permission should not see the
control at all, and should never reach a page that will only greet them with an API error (X-9).

## P13 · Nothing about fabrication is invented in the frontend

The golden rule, restated for the UI layer: V2 computes no size, no deduction, no price, no limit.
It displays what the engine returns. If a screen needs a number the API does not provide, that is a
`../BACKLOG.md` entry — never a client-side calculation.

## P14 · V1 is never collateral damage

Every V2 change is additive. `web/app/(app)/**`, `components/ui.tsx` and `app/globals.css` are
frozen. Shared files may only be extended, never altered. `npm run validate` stays at its recorded
**1,568 passed, 0 failed**.

---

## Phase 1 evidence verdicts — 2026-08-07

All 14 working principles are **confirmed**; none is struck. The detailed evidence and linked
screenshots are in `../phase-1-findings.md` §P1–P14 verdicts.

| Principle | Verdict | Evidence in V1 |
|---|---|---|
| P1 | **Confirmed** | Shell/dashboard offer competing starts (O-4, O-8) |
| P2 | **Confirmed** | Inert search and misleading order/quote CTAs (O-1…O-3) |
| P3 | **Confirmed** | F1–F3 begin in the 516-design catalog (O-10, X-6) |
| P4 | **Confirmed** | Designer proves progressive disclosure without removing capability (O-21) |
| P5 | **Confirmed** | Unexplained terms span quote, documents, settings, and catalog (X-5) |
| P6 | **Confirmed** | 834 px captures retain 40 px targets, 14 px body, and 11 px labels (X-8) |
| P7 | **Confirmed** | Designer's interaction grammar is isolated from the other 17 screens (X-2) |
| P8 | **Confirmed** | Live quote/Designer drawing is the clearest trusted task feedback |
| P9 | **Confirmed** | Reopen removes seven documents; failure/retry outcomes need explicit meaning (O-28) |
| P10 | **Confirmed** | Engineering price and commercial total are split across screens (O-25, O-26) |
| P11 | **Confirmed** | Decorative and semantic colours compete across badges/cards/documents |
| P12 | **Confirmed** | Customer nav/redirect proves grants work; guard coverage remains inconsistent (X-9) |
| P13 | **Confirmed** | Production mockup asks for state the schema/API do not contain (G-3) |
| P14 | **Confirmed** | Phase 1 changed only `Spec/v2/`; application/backend diffs are empty |

---

## Anti-patterns, named

Straight from the brief, each now with the V1 instance discovery found:

| Avoid | Found in V1 |
|---|---|
| Huge forms | `/admin/settings` (financials + branding); `/orders/[id]` pricing panel (6 controls) |
| Tiny buttons | 32–40 px controls, 11 px labels (X-8) |
| Deep nested menus | *Not* a V1 problem — the sidebar is flat. Keep it that way |
| Too many colours | P11 |
| Too many icons | 4 quick-action tiles + 4 metric icons + per-row icons on one screen |
| Unnecessary modals | *Not* a V1 problem — V1 prefers inline/popover confirms. Keep it |
| Multiple tables on one screen | `/orders/[id]`: Line items **and** Designer line items (O-24) |
| Complex terminology | X-5 |

Two of these V1 already gets right. Say so, and protect them.

---

## Ratification checklist for Phase 3

- [x] Numbers assigned to P6 (target size, type scale, content width, density)
- [x] Colour system defined against P11 (one neutral ramp, one accent, 3 semantic)
- [x] The state grammar of P7 specified once, with visual examples
- [x] Each principle given an applicable check through its falsifiable clause and the corresponding
      `UI_GUIDELINES.md` rule
- [x] Every principle either confirmed or **struck** by Phase 1's evidence — a principle that
      survives without evidence is decoration
