# Phase 3 — Configurator Shell (`/designer` UI)

## Goal

The Designer workspace UI: canvas + inspector with Measurements and Options tabs, live resolve,
gallery entry point, add-to-order. Item-level editing only — component selection/scoping arrives
in phase 4, extra view modes in phase 5.

## Context-in-a-box

`web/` is a Next.js 16 App Router + React 19 + Tailwind v4 app (own package.json; build with
`cd web && npm run build && npm run lint`). Auth: httpOnly JWT cookie; ALL browser calls go to
same-origin BFF routes (`web/app/api/[...path]/route.ts` proxies to the Express engine at
`EXPRESS_API_BASE`, injecting the bearer) — new engine endpoints need **no** BFF work unless they
require special handling. Server Components fetch via `web/lib/server-api.ts` (cookie bearer);
Client Components via `web/lib/api.ts`. Protected pages live under `web/app/(app)/` (server-side
auth guard in its `layout.tsx`). Existing relevant pieces to REUSE, not rebuild:
`web/components/window-designer.tsx` (SVG preview + drag-to-resize span handles + per-panel
labels), `web/components/window-3d.tsx` (lazy three.js view), `web/components/ui.tsx` (buttons/
inputs/badges), `web/components/design-card.tsx` (gallery card), toast in `web/components/
toast.tsx`. Legacy configurator `web/app/(app)/quote/` must remain untouched.

Backend available after phases 1–2: `GET /api/families/:key` (descriptor + option system),
`POST /api/line-items/resolve` (stateless `LineItemDraft` → `ResolvedLineItem` with issues/
pricing/summary/svg), order line-item CRUD. Contracts: `../00-architecture/line-item-schema.md`;
UX rules (layout, tri-state option styling, responsiveness, a11y, performance): 
`../00-architecture/ux-design-language.md` — **that file is the design authority; do not restyle
ad hoc.**

## Deliverables

1. **Route** `web/app/(app)/designer/page.tsx` — Server Component shell: reads
   `?family&design&orderId&itemId`, fetches descriptor+options and (for `itemId`) the saved draft
   server-side, renders the client workspace with initial data. Unknown family/design → 404.
2. **Workspace** `web/components/designer/workspace.tsx` (client): state = one `LineItemDraft`
   (single reducer; every mutation goes through it — the reducer is the only writer). 350ms
   debounced resolve with stale-response discard; optimistic selection UI per the UX doc §6.
3. **Header bar**: family/design name, size chip, live price (or "Preview only"), Issues(n)
   popover (deep-link stubs — full deep-linking with component focus lands in phase 4), primary
   actions: Add to order / Update item (when `itemId`), Save-state feedback via toast.
4. **Canvas (v1)**: renders `resolvedItem.geometrySvg.external ?? last-good`, zoom-to-fit; reuse
   `window-designer.tsx` drag-handle machinery for span resizing (dragging writes
   `splitRatios` to the draft). Dimension labels live-update. View switch UI renders but only
   External (+ 3D via existing `window-3d.tsx`) enabled; Internal/Schematic disabled with
   "phase 5" tooltip suppressed (just hidden until implemented).
5. **Inspector · Measurements tab** `web/components/designer/measurements.tsx`: overall dims from
   descriptor (inline min/max validation), split-mode segmented control (hide `equalGlass` if the
   resolver reports it unimplemented), generated per-span mm inputs (topology-derived; editing
   converts to ratios), distance-from-floor, location (text + suggestion list from the option
   system).
6. **Inspector · Options tab** `web/components/designer/options.tsx`: schema-driven rendering of
   groups → options → choices for **item-level scope only** this phase:
   - group headers with summary chips (non-default count + headline values), default collapsed
     per schema, Expand/Collapse All;
   - controls by `display` type (`segmented`/`select`/`select-image` grid popover with filter
     chips/`toggle`/`number`/`text`) — build these as reusable primitives in
     `web/components/designer/controls/*`, they are reused by phase 4;
   - tri-state styling (default muted / changed emphasised + reset / attention outlines) exactly
     per UX doc §4;
   - the pinned option search box filtering across groups (name + choice label match).
   Component-scoped options (scope.level === "component") are **not rendered yet** — show a
   per-group hint chip "n per-part options" (phase 4 replaces it).
7. **Gallery entry**: add "Design in studio" secondary action to quotable `DesignCard`s linking
   `/designer?family=casement-window&design=…` (carry `orderId` when present). The existing
   "Configure →" (legacy `/quote`) stays.
8. **Order integration**: Add to order = POST line item then navigate to the order (existing U4
   pattern); no `orderId` = create draft order first (reuse the existing new-order client
   action).
9. **Responsive behaviour** per UX doc §5 (inspector sheet <1024px; mobile edit-via-sheets can be
   minimal but must not be broken).

## Implementation checklist

- [x] Descriptor/options/draft TS types in `web/lib/types.ts` (mirror server contracts; do not
      import root `src/` types — repo convention). Added as one "Designer (Phase 3 / D3)" section
      + `designerItems?` on `OrderDetail`.
- [x] Reducer + resolve hook (debounce, stale-discard, error banner with last-good preview).
      `web/components/designer/workspace.tsx`: one `useReducer` over the `LineItemDraft` is the
      ONLY writer; 350 ms debounce with a sequence counter discarding superseded responses; a
      failed resolve shows a banner over the retained last-good preview.
- [x] Controls primitives + Options tab (schema-driven; zero option-specific hardcoding).
      `controls/index.tsx` (segmented / select / select-image grid popover with filter chips /
      toggle / number / text+datalist) + `controls/option-row.tsx` (the tri-state grammar).
      Verified: `grep -rE "profile\.|hardware\.|glazing\.|structure\.|general\.|placement\."
      web/components/designer web/lib/designer-draft.ts` → no matches.
- [x] Measurements tab (span inputs ⇄ ratios round-trip). Spans are generated from the SOLVED
      geometry (one row per divider) and commit `centreline ÷ solved frame dimension`, the exact
      fraction the canvas drag handles write — proven live: `splitRatios {root:0.5}` on a
      1400×1300 unit returns a transom centre of 650.0.
- [x] Canvas v1 + drag spans; header + issues popover; gallery entry; order integration.
- [x] a11y pass per UX doc §7 (tablist view switch + inspector tabs, radiogroup segmented
      controls, `role="switch"` toggle, listbox image grid with Escape→trigger focus return,
      `aria-live` issues list, focus-visible rings throughout, every span editable numerically).
- [x] `npm run build` + `npm run lint` clean (22 routes incl. `/designer`); **live** verification
      against the real engine + Postgres (see below) rather than the mock harness.

### Verification performed (live engine, 2026-07-26)

- `npm run validate` → **725 passed, 3 pre-existing weld-drift failures** (unchanged baseline);
  `npx tsc --noEmit` clean.
- Resolve contract: `geometry` arrives with the `svg` stripped; equal-split recomputes to 650.0
  and equalises glass (582.5 / 582.5); `equalGlass` returns its not-implemented warning (and the
  UI therefore hides that mode); an oversize unit returns the HAWDIO-p70-cited constraint pair
  (warning at the printed max, error past the 10% rule) and `invalidSpec: true`.
- Full round trip: draft → `POST /api/orders/:id/line-items` → `GET /api/orders/:id` returns the
  draft byte-for-byte → `/designer?orderId&itemId` restores 1400/1300, qty 2, the anthracite
  choice and "Kitchen" → confirm → 10 document rows whose work order prints
  `1400 × 1300 … ×2 — Kitchen`.
- Gallery: the casement product renders 48 "Design in studio" links; a non-casement product
  renders 0 (the family is matched from `designSource.productIds`, never hardcoded).
- Test order, the temporary test user and the temp scripts were deleted afterwards; both servers
  stopped.

### Deviations / notes for later phases

- **One additive server field.** `ResolvedLineItem.geometry` now carries the engine's solved rects
  (the `/api/quote` geometry MINUS its `svg`, which `geometrySvg.external` already holds). The
  canvas cannot place drag handles on dividers — nor, in phase 4, hit-test a component — from an
  SVG string alone. Purely additive; the 725 assertions are unchanged.
- **"All of type" options are answerable at item level.** Phase 3 was specified as item-level
  only, but four options (glass type, handle, locking, hinge) declare `applyScopes[0] ===
  "all-of-type"` — the option system's own statement that they are normally answered once for
  every component of their type. They render as item-wide controls writing an UNSCOPED selection,
  which the server's precedence ladder already applies to every component in scope, and which a
  phase-4 per-component answer overrides. Without this the acceptance criterion "pick glass"
  would have been unreachable. Options whose default apply-scope is `"this"` (add-on, sash type,
  ventilator) and every `display:"action"` stay deferred, counted in the per-group hint chip.
- **The location field is hoisted structurally, not by key.** `isLocationOption()` matches an
  item-level `text` option carrying a suggestion list, so it renders in Measurements (per UX doc
  §2) and is skipped in Options — with no option key in the UI. `draft.location` (which the
  documents print) is written at SAVE time from `resolved.summary.locationLabel`, so the option
  system stays the single source of the answer.
- **Colour swatches are found by engine effect**, not by option key: a choice whose
  `engineEffect.kind === "colour-key"` with `params.side` is that side's finish. The hex is
  catalog data (`ColourOption.hex`); the UI computes no colour.
- **Internal / Schematic views are hidden, not disabled** (phase 5), as the spec directs. The
  view switch ships External + 3D.
- **`notFound()` renders the 404 page with a 200 status** on this route — a Next 16 streaming
  characteristic shared by the existing `/products/[id]` and `/orders/[id]` routes, not something
  introduced here.
- **Order detail gained a Designer line items table** (edit → studio, remove, per-item totals and
  issue count) so a saved item can be reopened. The full commercial basket stays phase 6.

## Acceptance criteria

- Configure a real windows design end-to-end at `/designer`: change size, drag a span, pick
  colour/glass/cill/bead, see price + preview update live; add to a draft order; reopen via
  `itemId` and see the exact same state restored.
- Rendering is provably schema-driven: adding a new option row in the DB seed (no web/ change)
  makes it appear correctly grouped/ordered/styled.
- Search finds an option buried in a collapsed group and expands to it.
- Legacy `/quote` page and flows untouched (`git diff web/app/\(app\)/quote` empty).
- Build + lint clean; no console errors in the happy path.

## Out of scope

Component selection/scoping, instant actions (phase 4); internal/schematic views (phase 5);
basket commercial fields (phase 6).
