# Phase 3 — Design System

**Status:** ✅ **owner approved 2026-08-07** · Phase 4 authorised

## Goal

Author `00-foundation/UI_GUIDELINES.md` — the tokens, type scale, spacing,
colour, density, state grammar, motion and accessibility rules that every V2 screen obeys. Produce
one token stylesheet. No components, no screens.

## Context-in-a-box

Read first: `00-foundation/UI_GUIDELINES.md` (its **Part A** is V1's measured token system, its
**Part B** is the decision list U-1…U-15 this phase must answer),
`00-foundation/DESIGN_PRINCIPLES.md` (P1…P14, with phase 1's verdicts applied),
`00-foundation/ARCHITECTURE.md` §2.2–2.3 (isolation and layering rules).

Also read `Spec/00-architecture/ux-design-language.md` — the Designer's existing design language.
**It already contains much of V2's thesis** (progressive disclosure, always-on selection, the
tri-state grammar, issue deep-links, responsive breakpoints). Start from it; do not reinvent it.

**V1's measured system, in one paragraph:** `globals.css` defines a neutral ramp plus 6 semantic
colours and accent `#4442e3`; D8 added ONE elevation scale (`--shadow-xs…lg`). Both are **bypassed
in practice** — the accent is hardcoded as a literal in the nav, dashboard, page headers, badges and
metric cards, and inline `shadow-[0_28px_70px_…]` survives in the nav and canvas frame. There is
**no type scale**: sizes are chosen per component, effective body is **14 px**, and the most
repeated label is **11 px uppercase**. Controls are 40 px with some at 32. Content is
`max-w-[1500px]`. Three radii are used interchangeably. Tailwind `slate-*` coexists with the custom
tokens as a second neutral ramp.

**The lesson to design around:** a scale that components *can* bypass *will* be bypassed. Phase 4
must be able to enforce these choices structurally, so make them enforceable.

**Isolation is mandatory** (D-002 Option A): V2 tokens live in `web/app/v2.css`, every custom
property namespaced `--v2-*`, scoped under a `data-v2` root, imported **only** by the V2 layout.
`web/app/globals.css` is **frozen** and must not be edited — V1 depends on every value in it.

## Deliverables

1. **`00-foundation/UI_GUIDELINES.md`, authored** — replacing the seed. Every decision U-1…U-15
   made, or explicitly deferred with a reason and an owner.
2. **`web/app/v2.css`** — the token sheet. All `--v2-*`, scoped, self-contained. This is the only
   application file this phase touches.
3. **A swatch/specimen page** — a throwaway route or static HTML showing the type scale, colour
   ramp, spacing rhythm, elevation steps, focus ring and the state grammar side by side. It is how
   the owner approves the system without reading CSS.
4. **A contrast report** — every foreground/background pair used, checked to WCAG AA.

## The 15 decisions

| # | Decision | The constraint driving it |
|---|---|---|
| **U-1** | **Type scale** — body size, ratio, minimums; what replaces the 11 px uppercase micro-label | **P6: ≥16 px body.** V1's 14 px body and 11 px labels are the single largest readability gap for a 35–65-year-old user |
| **U-2** | **Spacing scale** — one base unit; card, row and section rhythm | Notion-grade breathing room (`00-foundation/VISION.md`) |
| **U-3** | **Control sizing** — target ≥44 × 44 px; a compact variant only where an admin genuinely needs density | **P6.** V1's minimum is 32 px |
| **U-4** | **Colour** — ONE neutral ramp (V1 has two), ONE accent, exactly THREE semantic colours | **P11**: if everything is coloured, colour means nothing |
| **U-5** | **Radius** — pick one, at most two | V1 uses three interchangeably |
| **U-6** | **Elevation** — keep a 4-step scale; decide **how bypass is prevented** | D8's scale was added and then bypassed |
| **U-7** | **Content width + grid** — narrower than 1500 px; column rules for tables and detail pages | **X-8** |
| **U-8** | **The state grammar** — default / changed / needs-attention / error, specified once | **P7.** V1's `controls/option-row.tsx` is the reference: it holds the tri-state in ONE file and every control inherits it |
| **U-9** | **Table vs list vs card** — when each is used, decided once | **O-24, O-27**: V1 has no rule, so both appear for the same kind of thing |
| **U-10** | **Density modes?** Does the admin pricing editor get a compact mode, or a different interaction entirely? | **O-30**: 6 tables, hundreds of rows, one page |
| **U-11** | **Iconography** — reuse `icons.tsx` (259 LOC) or author a V2 set; how many icons a screen may show | **P11** anti-pattern: "too many icons" |
| **U-12** | **Dark mode?** V1 has none | Recommend **deferring**: a factory floor is bright, and it doubles the surface to verify |
| **U-13** | **Motion** — what moves, what does not, and `prefers-reduced-motion` | V1 puts `transition` on nearly everything |
| **U-14** | **Token isolation** — `--v2-*` in `app/v2.css`, scoped under `data-v2` | **Mandatory** (D-002); `globals.css` frozen |
| **U-15** | **Print safety** — confirm V2 screen CSS cannot leak into document rendering | `src/engine/documents.ts` carries its own `STYLE` + a work-order-only `extraCss` seam, and `validation/jobs.ts` asserts a glass row's **exact bytes, indentation included** |

## Implementation checklist

- [x] Apply phase 1's verdicts to `00-foundation/DESIGN_PRINCIPLES.md` (all P1–P14 confirmed)
- [x] Read `Spec/00-architecture/ux-design-language.md` end to end
- [x] Decide U-1 … U-15; write each with its rationale
- [x] Give **every guideline a check a reviewer can actually apply** — a guideline nobody can fail
      is decoration
- [x] Write `web/app/v2.css`; verify `globals.css` is untouched
- [x] Build the specimen page; include the state grammar and a realistic dense table
- [x] Run the contrast report; all 22 declared pairs pass AA
- [x] Sanity-check the type scale at 834 px (tablet) and on a real 6-column table
- [x] Author `00-foundation/UI_GUIDELINES.md`; delete the 🔴 marker in `README.md` and
      `00-foundation/`
- [x] Update `CHECKLIST.md`, `MILESTONES.md`, `CHANGELOG.md`, `DECISIONS.md`
- [x] Verify: `git diff` touches only `Spec/v2/**` and `web/app/v2.css`

## Acceptance criteria

- [x] Every U-n decided or deferred with a named owner
- [x] Every guideline carries an applicable check
- [x] Sizing satisfies **P6** — ≥16 px body, ≥44 px targets — and the specimen page proves it
- [x] WCAG AA contrast verified for every pair in use
- [x] `web/app/globals.css`, `web/components/ui.tsx`, `web/app/(app)/**` untouched
- [x] `npm run validate` unchanged (**1,568 passed, 0 failed**); `cd web && npm run build && npm run lint` clean
- [x] **Two people applying the guidelines to the same screen produce the same result** — the real
      test of whether this document is done
- [x] **Owner approves phase 3** before phase 4 begins (2026-08-07: “next please”)

## Out of scope

Components (phase 4) · screens (phase 5+) · editing anything V1 owns · restyling the engine's SVG.
The drawing's own palette — flat, realistic, schematic — is the **engine's** business
(`src/engine/svg.ts`); V2 styles the frame around the drawing, never the drawing (P8, P13).

## Gates

⚠️ **U-10** (density modes) depends on phase 2's decision about how `/admin/catalog` decomposes. If
that is unresolved, specify the default density and mark the compact variant as pending.
