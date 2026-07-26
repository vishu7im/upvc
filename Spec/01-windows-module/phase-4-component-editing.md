# Phase 4 — Component Editing (Selection, Scoping, Instant Actions)

## Goal

The Designer's differentiating feature set: click a component on the canvas to scope the inspector
to it, set per-component options with apply-scopes, run instant structural actions (add transom/
mullion/midrail, remove divider), and convert component types (glass ⇄ sash ⇄ panel).

## Context-in-a-box

Phase 3 delivered `/designer` (`web/components/designer/workspace.tsx` + reducer-owned
`LineItemDraft`, schema-driven Options tab with reusable controls, canvas with drag spans).
Phase 2 delivered the pure resolver (`src/designer/resolve.ts`), the `cellnode` adapter
(`src/designer/adapters/cellnode.ts`) whose `listComponents(geometry)` returns
`{componentId, type, label, rect, path}` with **stable topology-derived ids** (`cell:0.1/glass`,
`edge:top`, `divider:0.h`), topology edits (`split`, `add-midrail`, `convert-component`,
`remove-divider`), and selection precedence (component > all-of-type > item > default).
Contracts: `../00-architecture/line-item-schema.md` (draft shape: `topologyEdits[]`,
`selections[].scope/appliedVia`), `../00-architecture/option-schema.md` (§5 action options, §7
semantics), `../00-architecture/ux-design-language.md` §2 (selection model, Structure tab, scope
pill), `../00-architecture/product-family-plugin.md` (componentConversions, topology capabilities).
Reference behaviour being modernised: the BM-Touch "Edit Individual Components" mode
(`collections/windows/` screenshots) — we replace its modal mode with always-on selection.

## Deliverables

1. **Resolver addition** — `ResolvedLineItem.components`: expose the adapter's `listComponents`
   output (id, type, label, rect in SVG coords, kind) so the UI can hit-test and label without
   re-deriving topology. (Additive field; server change in `src/designer/resolve.ts` only.)
2. **Canvas selection** (`web/components/designer/canvas.tsx`):
   - hover: outline + name tooltip from `components[]` rects;
   - click: select (single selection) → accent fill at ~20% opacity per UX doc (never opaque);
   - click empty / Esc: back to item scope; selection breadcrumb (Item ▸ Sash 2 ▸ Glass);
   - selection survives re-resolve via componentId (ids are stable by design — if an edit removes
     the selected component, fall back to its parent, then item).
3. **Scope pill + scoped Options tab**: the pill shows current scope ("Whole item" / "Sash 2").
   With a component selected, the Options tab shows: (a) component-scoped options whose
   `componentTypes` include the selection's type, (b) item-level options collapsed under a "Whole
   item" divider for context. Apply-scope toggle ("This sash / All sashes") per option
   `applyScopes`; writes `scope: componentId` or `scope: "<type>:*"` + `appliedVia` accordingly.
   Per-component overrides render an "override" badge + reset (removes the scoped selection,
   falling back per precedence).
4. **Structure tab** (`web/components/designer/structure.tsx`):
   - component tree list (mirrors canvas selection — the a11y-mandated non-pointer path);
   - instant-action buttons: the `display:"action"` options applicable to the current selection
     (e.g. glass pane → Add transom / Add mullion / Add midrail; divider → Remove). `position:
     "at-ratio"` actions prompt inline for mm/ratio; "equal" applies immediately. Each executes by
     appending a `TopologyEdit` to the draft and re-resolving;
   - edit history list: every topology edit with human label + remove button (removing re-applies
     the remaining edits — the reducer owns ordering; downstream-invalidated edits are dropped
     with a toast, matching adapter behaviour).
5. **Component Type conversion**: segmented control (Glass / Sash / Panel per descriptor
   `componentConversions`); converting to sash also asks kind (5 casement kinds) — emits
   `convert-component` edit. Converting away from sash warns inline that sash-scoped selections
   for that component will be dropped (reducer prunes orphaned scoped selections on every edit —
   implement as a single `pruneSelections(draft, components)` helper, unit-tested).
6. **Issue deep links completed** (stubbed in phase 3): clicking an issue selects/flashes the
   named component and expands+focuses the named option.

## Implementation checklist

- [x] `components[]` in resolve response (+ server test: ids stable across a size change).
      `ResolvedLineItem.components` carries the adapter's `listComponents()` of the SOLVED
      geometry (id, type, kind, label, mm rect, path). Asserted in `resolve.test.ts` §11:
      identical id set at 1200×1200 and 1400×1300 while the rects do move, the sash typed
      `sash` with its `…/glass` child, `divider:root`, all four frame edges, and absent
      when the solve never ran.
- [x] Canvas hover/click/breadcrumb/Esc; selection-stability fallback.
      `window-designer.tsx` gained OPTIONAL `components`/`selectedComponentId`/`onSelectComponent`
      props (omitted ⇒ the pre-D4 behaviour, so `/quote` is untouched); `designer/canvas.tsx`
      adds the breadcrumb and the Escape handler. Hit-areas are sorted biggest-first so the
      smallest component under the cursor wins the click; selection fill is 20% accent, never
      opaque. A selected component that an edit removes falls back to its parent then to item
      scope, computed during render.
- [x] Scope pill; scoped option filtering; apply-scope toggle; override badges + reset.
      The Options tab renders the selected component's options, each with the apply-scope
      toggle the OPTION declares (`scope.applyScopes`), writing `cell:…` or `<type>:*`. Badges
      name the winning rung (Override / All sashes / From item); Reset removes that rung's
      selection and the value falls back down the ladder. Remaining item-level options stay
      below a "Whole item" divider for context.
- [x] Structure tab: tree, actions (incl. at-ratio inline input), history with remove.
- [x] Conversion control + `pruneSelections`. Conversion is the SEEDED `structure.component-type`
      option (schema-driven), with its choices filtered to the descriptor's
      `componentConversions` by reading each choice's own `engineEffect.params.to` — no option
      key in `web/`. `pruneSelections(draft, components)` drops selections whose concrete
      componentId is gone (never `<type>:*` or item-level answers); the server-side safety net
      is asserted in `resolve.test.ts` §13 (an orphaned scope is an `unknown-component` ERROR,
      never silently applied elsewhere).
- [x] Issue deep links: an issue with a `scope` selects that component first, then routes to
      Measurements / Structure / the named option.
- [x] Live verification against the real engine + Postgres (below) rather than mock fixtures.
- [x] `cd web && npm run build && npm run lint` clean (22 routes); root `npm run validate`
      **738 passed** (725 + 13 new), same 3 pre-existing weld-drift failures.

### Verification performed (live engine, 2026-07-26)

The reference walkthrough, end to end over HTTP and then in the UI:

- `win-fixed` 1400×1300 resolves with 5 components (4 frame edges + `cell:root`).
- **Add mullion at equal split** (the `structure.add-mullion` action template, targeted at
  `cell:root`) → `cell:root.left` / `cell:root.right` at 627 mm each + `divider:root`.
- **Convert the left pane to a sash** (`structure.component-type` scoped to `cell:root.left`)
  → that component becomes `sash` (`casement-top`) and gains `cell:root.left/glass`.
- **Per-pane obscure glass** scoped to `cell:root.left/glass` → resolves with **no issues**;
  the priced lines carry the sash profile SPQ-05-30252 (3.777 m), one handle / espagnolette /
  friction hinge, and exactly **two** glass rows — `G-4-20-4-TLE` for the overridden pane,
  `G-4-20-4-LE` for the other. Confirmed order → 10 documents; the BOM prints both rows.
- **All-of-type**: the same answer scoped `glass:*` collapses to ONE glass row (1.508 m²).
- **Reopen**: `GET /api/orders/:id` returns the draft byte-for-byte (edits + both scoped
  selections), and `/designer?orderId&itemId` restores it into the client payload.
- Test orders, the temporary test user and the temp scripts were deleted afterwards; both
  servers stopped.

### Deviations / notes for later phases

- **The resolver now runs selections + effects at most TWICE.** A selection can itself be a
  structural change (convert to sash, change sash kind), and that changes which components
  exist — a sash owns a `…/glass` pane a plain glass cell does not. Resolving once meant an
  answer scoped to that pane could never resolve (reported `unknown-component` forever), which
  made the walkthrough's final step unreachable. When pass 1 applies a structural effect the
  components are re-derived and selections resolved once more; only the final pass's issues are
  reported. It terminates because the resolver already skips a topology edit whose component
  already matches, and every other effect is idempotent into a fresh effects object. The 738
  assertions (incl. the golden byte-identity test) hold.
- **Component-type conversion stays a SELECTION, not a topology edit.** The option system
  already declares it with a `topology-edit` engineEffect, so making the UI append an edit
  instead would give one answer two mechanisms. The consequence is the two-pass resolve above.
- **A failed edit is flagged, not auto-dropped.** The spec suggested dropping
  downstream-invalidated edits with a toast; the history list instead shows the edit in red with
  the resolver's message and a remove button. Silently deleting a user's structural work is
  worse than showing it as broken — and the resolver already ignores a failed edit, so the item
  still resolves.
- **Canvas hit-areas are pointer-only (no tab stops).** Twenty focusable rects would flood the
  tab order; the Structure tree is the keyboard/AT path and mirrors every canvas interaction,
  which is the a11y contract this phase set itself.
- **Actions ship as the seed declares them** — all four casement actions are `position:"equal"`,
  so they apply immediately; the inline "% of unit" prompt is implemented and appears for any
  action seeded `position:"at-ratio"`. A divider inserted at equal position is then draggable
  on the canvas like any other.
- **The issue deep-link selects the component but does not flash it.** Selection is already a
  strong visual state (accent fill + breadcrumb + tree highlight); a separate flash animation
  was not worth the extra state.

## Acceptance criteria

- The live walkthrough above works end-to-end and re-opens correctly from a saved line item.
- Scoped selection precedence visibly correct: item-level glass + one scoped pane override shows
  override badge only on that pane, and the BOM shows exactly one differing glass line.
- Removing a mid-history structural edit yields the same result as never having made it
  (determinism: reducer replays remaining edits; resolver output equality asserted in a test).
- No canvas interaction lacks a Structure-tab equivalent (a11y).
- All new UI renders purely from schema/resolve data — no component-type- or option-specific
  hardcoding in `web/` (grep check as in phase 3).

## Out of scope

Internal/schematic views (phase 5); sliding-family panel semantics (phase 7+); `equalGlass` mode.
