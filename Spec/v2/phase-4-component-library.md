# Phase 4 — Component Library

**Status:** ✅ **owner-approved 2026-08-07** · Phase 5 authorised

## Goal

Author `00-foundation/COMPONENT_LIBRARY.md` and **build the V2 kit** under
`web/components/v2/**`. First real application code. No routes, no screens.

## Context-in-a-box

Read first: `00-foundation/COMPONENT_LIBRARY.md` (**Part A** = V1's component inventory,
**Part B** = the named components from the brief mapped to what exists, **Part C** = decisions
C-1…C-9), `00-foundation/UI_GUIDELINES.md` (authored in phase 3 — **normative**),
`00-foundation/ARCHITECTURE.md` §2.3 (layering rules), `00-foundation/REUSE_ANALYSIS.md` §3–5.

**Layering rules (D-002 Option A), non-negotiable:**

```
components/v2/**    may import ↓
lib/v2/**           may import ↓
lib/{api,types,permissions,format,server-api}   ← THE SEAM, shared, never edited
```

V2 components **never** import `components/ui.tsx`, `app/(app)/**`, or anything under `src/`.
`components/icons.tsx` and `components/toast.tsx` are shared **only if C-6 says so**.

**What V1 already got right — inherit it, do not rediscover it:**

- `controls/option-row.tsx` (131 LOC) holds the **tri-state grammar in ONE file**, so every control
  type inherits it. That is why the Designer's inspector is the best UX in the app.
- `labelClass` exists because the same micro-label had been re-declared inline in ~12 files with
  three different greys. **Consolidation is not premature abstraction here — it is the fix.**
- The orders table gives **one** keyboard-reachable link per row (the other cells are
  `tabIndex={-1}` + `aria-hidden`), so a screen reader hears one order, not six identical links.
  That behaviour belongs in `DataTable`, not in a page.
- The Designer's `structure.tsx` exists specifically as the **non-pointer equivalent** of every
  canvas interaction. Any component with a pointer-only affordance owes an equivalent.

**Two invariants V2 must keep:**

1. **No option key, module slug or role name appears anywhere under `web/`.** V1 holds this
   (verified by grep at D3, D4, D8 and again 2026-08-05). It is what makes seeding a new option cost
   zero frontend work. **Make it a CI check in this phase.**
2. **The state grammar lives in exactly one file.**

**The lesson from phase 3's Part A:** a scale components *can* bypass *will* be bypassed. Components
must make the guidelines the path of least resistance — no `className` escape hatch that silently
overrides sizing or elevation.

## Deliverables

1. **`00-foundation/COMPONENT_LIBRARY.md`, authored** — replacing the seed. C-1…C-9 decided; every
   component has a real API (props, states, a11y contract, when to use / when not to).
2. **The kit** at `web/components/v2/**`. From the brief, mapped against what exists:

   | Component | Notes |
   |---|---|
   | **Sidebar** | Renders from `user.nav` — never a hardcoded menu (P12) |
   | **Header** | Search **implemented or absent, never dead** (P2, decision B-2) |
   | **Card** | + a metric/stat variant |
   | **DataTable** ⭐ | V1 has only class constants; every page assembles its own `<table>`. Needs: sorting, empty/loading/error, row action, **one keyboard target per row**, server-side search hookup (orders already has `?q=`/`?status=`) |
   | **Form kit** | Label, hint, error, required, **unit suffix** (V1's mm-suffix pattern is worth keeping) |
   | **Wizard** | Does not exist in V1. Likely the answer to the task-shaped entry point (P3) — build only if phase 2 asked for it |
   | **Drawer** | Does not exist. Detail without losing context |
   | **Modal** | V1 **deliberately avoids** modals in favour of inline/popover confirms. **Keep avoiding**; build only if phase 2 proved a need |
   | **Badge / StatusChip** | Consolidate V1's `Badge` + the ad-hoc `StatusBadge`; fewer tones (P11) |
   | **Timeline** | ⚠️ **Gated on G-3** — no production/workflow status exists in the backend. Do not invent one |
   | **Skeleton / Loading** | Component form of V1's `.skeleton` + route `loading.tsx` |
   | **Toast / Notifications** | Likely reuse `toast.tsx` (C-6) |
   | **EmptyState** | Every list and every screen owes one (`00-foundation/VISION.md`: "excellent empty states") |

3. **`lib/v2/**`** — V2-only view models and formatting. **Nothing that computes a price, a size or
   a permission** (D-003, P13).
4. **A component gallery** — a throwaway route showing every component in every state. How the owner
   approves the kit without reading code.
5. **Two CI checks**, wired and passing:
   - no option key / module slug / role name hardcoded under `web/components/v2/**`
   - the **V1 freeze diff**: `web/app/(app)/**`, `web/components/ui.tsx`, `web/app/globals.css`
     unchanged versus the freeze commit *(record the freeze commit in `DECISIONS.md` here)*

## Decisions this phase must make (C-1…C-9)

| # | Decision |
|---|---|
| **C-1** | Which components ship now versus later |
| **C-2** | Is the Designer's `controls/*` kit **generalised into the V2 kit**? *(Recommended — it already solves the hard problem, and phase 7's configurator module will need it)* |
| **C-3** | `DataTable` API: columns as data? server-side sort/filter? |
| **C-4** | Wizard API — or is a smart form enough? |
| **C-5** | How the state grammar is expressed so it **cannot** be bypassed |
| **C-6** | Are `icons.tsx` and `toast.tsx` shared or forked? |
| **C-7** | How components enforce sizing/elevation rather than merely offering it |
| **C-8** | Confirm the location: `web/components/v2/**`, seam-only imports |
| **C-9** | Composition rules — which components may nest in which *(V1's `/orders/[id]` stacks 7 sections; unconstrained composition is how that happens)* |

## Implementation checklist

- [x] Record the **freeze commit SHA** in `DECISIONS.md`; wire the V1 freeze CI check FIRST —
      before writing any component, so the safety net exists from line one
- [x] Decide C-1…C-9; author `00-foundation/COMPONENT_LIBRARY.md`
- [x] Scaffold `web/components/v2/` + `web/lib/v2/`
- [x] Build primitives: Button, Card, Badge/StatusChip, Field kit, EmptyState, Skeleton, Alert
- [x] Build `DataTable` — carry over the one-keyboard-target-per-row behaviour
- [x] Build Sidebar + Header against supplied nav data; Search renders only with a real action
- [x] Build Drawer; skip Wizard and Modal because phase 2 proved neither need
- [x] Every data-owning component: empty + loading + error; document leaf/layout state ownership
- [x] Every component: keyboard-operable, focus-visible, never colour-only, pointer affordances have
      non-pointer equivalents
- [x] Wire the option-key/module-slug/role-name CI check
- [x] Build the component gallery (static SSR harness; no product route before Phase 5)
- [x] Run the **standing verification stack** (below)
- [x] Update `CHECKLIST.md`, `MILESTONES.md`, `CHANGELOG.md`, `DECISIONS.md`
- [x] Delete the 🔴 marker for `00-foundation/COMPONENT_LIBRARY.md` in `README.md`

## Acceptance criteria

- [x] A screen can be assembled from the kit with **no inline styling and no bypassed token**
- [x] Every component meets phase 3's sizing minimums **by construction**, not by convention
- [x] Both CI checks pass
- [x] Nothing under `web/components/v2/**` imports `components/ui.tsx`, `app/(app)/**` or `src/`
- [x] No component computes a price, a size, a limit or a permission
- [x] Standing stack green:

```bash
npx tsc --noEmit
npm run validate                                   # 1,568 passed, 0 failed
cd web && npm run build && npm run lint
git diff --stat <freeze> -- 'web/app/(app)' 'web/components/ui.tsx' 'web/app/globals.css'   # empty
git diff --stat <freeze> -- src prisma                                                       # empty
```

- [x] **Owner approves phase 4** before phase 5 begins (2026-08-07: “start next phase now”)

## Out of scope

Routes and screens (phase 5+) · the version switcher (phase 5) · rewriting `window-designer.tsx` or
`window-3d.tsx` — **those are wrapped, never rewritten** (D-007), and their wrapper belongs to
phase 7's configurator module, not here.

## Gates

⚠️ **Timeline** is gated on **G-3** (no production status exists in the backend). Build it only if
the owner has funded that capability separately — otherwise skip it and note why.
⚠️ **Wizard** and **Modal** are gated on phase 2 having asked for them.
