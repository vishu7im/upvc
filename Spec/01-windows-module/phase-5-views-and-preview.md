# Phase 5 — Views & Preview (External / Internal / Schematic)

## Goal

Complete the canvas view modes: External (exists), **Internal** (mirrored, handle-side aware),
**Schematic** (technical drawing annotated with face widths + per-pane glass sizes), plus the
existing 3D tab — all selectable from the view switch built in phase 3.

## Context-in-a-box

The engine renders elevation SVGs via `renderSvg(geometry, opts?)` in `src/engine/svg.ts` — pure,
and already **option-extensible with proven byte-identity discipline**: `opts.joints` adds a joint
overlay layer, colour tint uses `ColourOption.hex`, and omitting opts yields byte-identical output
(asserted by `src/engine/svg.test.ts#validateSvg`, wired into `npm run validate`). Solved geometry
(`QuoteGeometry`) carries every rect needed (frame, cells, sashOuter/Inner, glassRect, beadInt) —
the schematic annotations derive from these rects, **no new engine math**. Sash kinds encode hinge
side (`left-hung`, `top-hung-left`, …). Glass sizes per pane are already computed (they appear in
cutting lists and in `ResolvedLineItem.summary.glassSizes` from phase 2). The Designer canvas is
`web/components/designer/canvas.tsx` (phase 3/4); the resolver returns `geometrySvg` variants
(`line-item-schema.md` §3). Reference for what the views communicate (NOT how they look):
`collections/windows/views/{external,internal,schema}.png` — schematic shows per-junction face
widths (e.g. 49 / 69.5 / 100 / 18.5) and "Glass size = W x H" labels per pane; internal shows the
handle on the hinge-opposite side with opening symbols mirrored.

## Design decisions

- **All three views are engine-rendered SVG variants** via additive `renderSvg` options —
  keeping document embedding possible later (documents already embed `renderSvg` output) and the
  UI dumb. New `opts` fields (each independently optional, each byte-identical when absent):
  - `opts.view: "external" | "internal"` (default external — the current output). Internal:
    horizontal mirror of the layout, opening-symbol direction flipped accordingly, and a simple
    handle glyph on each opening sash's closing side (position derivable from SashKind; keep it a
    stylised marker, not hardware art).
  - `opts.schematic: { faceWidths: boolean, glassSizes: boolean }`: renders the technical style —
    white fills, thin strokes, and annotation labels: per-edge frame face width, per-divider face
    width, sash overlap figures at junctions, and a centered "Glass W × H" label per pane. All
    numbers come from catalog part face-widths + solved rects (values the engine already knows);
    label collision handling = smallest-font-that-fits with overflow to a leader line, keep it
    simple.
  - Photoreal texture (reference uses wood-grain bitmaps) is **out** — our language is clean
    vector; colour tinting via the existing `hex` swatch mechanism already covers finish
    communication (UX doc §4).
- **Resolver/API**: `POST /api/line-items/resolve` accepts `views?: ("external"|"internal"|
  "schematic")[]` and returns only the requested `geometrySvg` variants (default: external) —
  keeps payloads lean; the UI requests the active view + caches per draft-state hash.
- **3D tab**: reuse `web/components/window-3d.tsx` unchanged (it consumes the same geometry).

## Deliverables

1. `src/engine/svg.ts`: `view:"internal"` + `schematic` options, additive; extend
   `src/engine/svg.test.ts#validateSvg` with: (a) no-opts byte-identity still holds, (b) internal
   view mirrors opening symbols (assert marker coordinates), (c) schematic contains the expected
   face-width and glass-size label values for a known validation job (assert exact numbers from
   the calibrated catalog — e.g. Job 85's faces), (d) schematic of a French/sliding design renders
   without crashing (families with stulp/panels).
2. `src/designer/resolve.ts`: `views` request param → variants in `geometrySvg`.
3. Canvas: view switch fully enabled (External | Internal | Schematic | 3D); per-view SVG fetch +
   cache; selection/hover/drag interactions work on ALL 2D views (component rects are
   view-transformed — internal mirror must transform hit-test rects too; the adapter's
   `components[]` rects are external-view coords, so the canvas applies the same mirror
   transform).
4. Dimension edit affordances (the phase-3 span drag + labels) available in External and
   Schematic; Schematic is the natural "measure mode" — emphasise dimension labels there.
5. Print/copy affordance: "Download SVG/PNG" of the current view (client-side serialization; no
   backend).

## Implementation checklist

- [x] Engine svg options + tests. `RenderSvgOpts` gained `view:"external"|"internal"` and
      `schematic:{faceWidths?,glassSizes?}` (both default-true when the object is given).
      Internal = ONE horizontal mirror about the window centreline (`matrix(-1 0 0 1 w 0)`) plus a
      stylised handle glyph; schematic = white fills + thin strokes + a `<g id="schematic">`
      annotation layer. Every annotated number is read off a rect the engine already solved —
      frame face = `outer`→`rootDaylight`, divider face = the transom/mullion rect, sash face =
      `sashOuter`→`sashInner`, glass = `glassRect` rounded exactly as `bars.ts#emitGlass` rounds it.
- [x] `npm run validate` — **775 passed** (738 + 37 new), same 3 pre-existing weld-drift failures.
      26 new pure assertions in `svg.test.ts` + 11 DB-backed ones in `jobs.ts#validateViews`.
- [x] Resolver `views` param + response filtering. `resolveLineItem(draft, snapshot, {views})`
      (a REQUEST option, never draft data) → `QuoteInput.views` → `QuoteOutput.geometry.svgViews`
      → `ResolvedLineItem.geometrySvg.{internal,schematic}`. `POST /api/line-items/resolve` reads
      `views` from the body or `?views=`; the draft schema strips it, so nothing view-related is
      ever persisted on a line item.
- [x] Canvas view switch (External | Internal | Schematic | 3D), mirrored hit-testing, per-view
      caching, download action (SVG + PNG, client-side, `web/lib/svg-download.ts`).
- [x] Live visual check (below) — casement over Z-transom in all four views, plus French pair and
      sliding OX rendered through the engine in internal + schematic.
- [x] `cd web && npm run build && npm run lint` clean (22 routes); root `npx tsc --noEmit` clean.

### Verification performed (live engine + Postgres + a real browser, 2026-07-26)

- **Additive, proven at the engine:** a quote without `views` carries no `svgViews` at all; a quote
  WITH them has a byte-identical external SVG, identical `parts`, identical documents and an
  identical grand total (asserted in `validateViews`).
- **Schematic numbers == catalog + cutting list.** 1200×1200 casement/Z-transom: frame face `64`,
  transom face `67`, sash ring `79`, panes `1007 × 237.5` and `1102 × 732.5` — the pane labels are
  the SAME strings as `parts.glass`, asserted row by row. French pair (1700×2100): frame `48`,
  stulp `48`, midrail `67`, sash `105` — every one a calibrated catalog face width. Sliding OX
  (1900×2100): frame `48`, sash `85`, panes `809 × 1874` matching the Andrei-job cutting rows.
- **Handedness.** `win-sh-left` (hinge left externally): the handle glyph lands at x≈75 inside the
  mirrored sash span 36–864, i.e. on the LEFT internally — the physically correct mirror (see the
  deviation note below). Sliding panels get NO handle, by design.
- **In the browser** (headless Chromium, 1600×1000, real login → `/designer`): all four views
  render; component selection returns the identical breadcrumb in External, Internal and Schematic
  (upper pane → "casement-top ▸ Glass in casement-top", lower → "Fixed glass (bottom)"), proving
  the mirrored hit-test; dimension labels + drag handles appear in External and Schematic and are
  suppressed in Internal; SVG/PNG buttons appear in every 2D view and are hidden in 3D; the 3D tab
  still mounts its WebGL canvas.

### Deviations / notes for later phases

- **Internal mirrors the handle too.** The acceptance criterion above says a left-hung sash shows
  its handle "on the right edge internally". That cannot be true of a mirror: if the hinge flips
  sides, so does the handle. The engine draws ONE mirror of the whole elevation, so a sash hinged
  left as seen from outside reads hinge-right / handle-left from inside, which is what the room
  actually looks like. Asserted in both test suites at that (mirrored) position.
- **Handles only where the hinge edge is recorded.** Casement, door, tilt&turn and French leaves
  get a glyph; sliding panels do not — the catalog gives each sliding panel a handle but records no
  stile for it, and inventing one would be a guess (golden rule). Same reason the glyph is a lever
  + rose bounded by the stile rect, not hardware art.
- **The schematic ignores the colour tint.** Its subject is the numbers; white fills + thin strokes
  are what make them legible. Colour communication stays the External/3D views' job.
- **Label collisions are handled by shrink-then-drop**, not leader lines: a label scales down to
  fit its own rect and is omitted below 55% of the base size. A 20 mm divider therefore carries no
  face label, while the real 67/78 mm ones do. Leader lines are a refinement, not a correctness gap.
- **Internal is not an editing view.** Dimension lines and divider drag handles are suppressed while
  mirrored: a dragged position would have to be un-mirrored on its way back to `splitRatios` (and
  index-reversed for sliding boundaries), which is a trap waiting to happen. Deliverable 4 puts
  measuring in External + Schematic, and Schematic is the natural measure mode.
- **Incidental fix: the designer canvas had no height.** Since phase 3 the canvas card centred its
  children, so `h-full` on the canvas wrapper resolved against an indefinite (min-height-only)
  flex container → 0, and the stage's `overflow-hidden` clipped the entire drawing. `self-stretch`
  (and dropping `h-full`) on `designer/canvas.tsx`'s root fixes it; the stage now measures
  838×798 instead of 838×0. Nothing else in `web/` was touched, and `/quote` was never affected —
  it wraps the same `WindowDesigner` in its own sized frame.

## Acceptance criteria

- Default engine output remains byte-identical with no opts (existing + new assertions prove it).
- Schematic view of a calibrated design shows face-width numbers matching the catalog values and
  glass sizes matching the cutting list exactly (same numbers, same rounding).
- Internal view mirrors handedness correctly (left-hung sash shows handle on the right edge
  internally, opening triangle apex flipped) — verified against the reference convention
  (`views/internal.png`) and asserted for one design in the svg test.
- Component selection works identically in all 2D views.
- Documents remain unchanged this phase (embedding schematic views into documents is a possible
  later enhancement — note it in `Spec/questions.md` Q12 if desired, don't do it here).

## Out of scope

Photoreal rendering, document embedding changes, 3D enhancements.
