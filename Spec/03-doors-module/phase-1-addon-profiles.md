# Phase 1 — Add-on profiles (windows **and** doors) + length-dependent reinforcement

## Goal

Give the engine one new concept — **the frame need not fill the outer rectangle** — so an add-on
(frame extension) profile can be fitted to any of the four edges, and make reinforcement respect the
manual's minimum-bar-length rule. Both are calibrated by Job 169; neither is a guess.

## Context-in-a-box

The reference configurator exposes `Add-on (Top) / (Bottom) / (Left) / (Right)` in **Profile &
Ancillary Options** for *both* windows and doors (`collections/windows/profile/Screenshot 2026-07-25
212138.png` and `collections/doors/WhatsApp Image 2026-07-30 at 4.01.39 PM (2).jpeg`), with one real
choice today: `SPQ-2-75252 25mm`.

`src/catalog/system-sunnyplast.ts` already carries the parts as inert auxiliaries — `aux-ext-25`
(`SPQ-2-75252`, "25mm Frame Extension") and `aux-coupling-frame` (`SPQ-2-72252`) — added in
`../02-manual-migration/phase-2-catalog-additions.md` with the note that no calibrated cut rule
existed. `../questions.md` **Q6** gated them on exactly that.

**Job 169 supplies the rule.** All 5 pages are 1000 × 2000 with `frame-6ch` (face 68) and a
`sash-door-z` leaf (face 105, overlap 28). Printed frame sizes (welded, +5 = 2 × 2.5 mm/end):

| Page | Add-on | Frame Hor | Frame Vert | Sash Hor | Sash Vert |
|---|---|---|---|---|---|
| 1 | Top | 1005 | **1980** | 925 | **1900** |
| 2 | Bottom | 1005 | **1980** | 925 | **1900** |
| 3 | Left | **980** | 2005 | **900** | 1925 |
| 4 | Right | **980** | 2005 | **900** | 1925 |
| 5 | none | 1005 | 2005 | 925 | 1925 |

So the frame becomes 1000 × 1975 (top/bottom) or 975 × 2000 (left/right), and everything downstream
— daylight, sash ring, beads, glass, steel — follows from the smaller frame with no other change.
The effect is **side-independent for the cut list** (p1 == p2, p3 == p4); only the drawing needs to
know which edge. The overall unit stays 1000 × 2000, and the drawing annotates the frame as 1975 /
975.

Split ratios are **frame-relative**: page 1 prints 375 + 1600 = 1975, the frame height, not 2000.

**The Cutting List prints no row for the add-on profile itself.** Owner decision: we print none
either. Its own cut length is unevidenced and stays unguessed (new question appended to
`../questions.md`).

**Reinforcement.** `reinforcementMap["SPQ-5-30252"] = "reinf-26x26-u"` is binary today. Job 169
prints that steel for the divider on pages 3 and 5 (Int 1710) and **omits it** on pages 1, 2 and 4
(Int 710 / 685). That is the ">1 m" rule already recorded under "Master PDF findings" in
`CLAUDE.md` (`SPQ-05-20252` reinforced only >1.5 m; `SPQ-5-30252` / `SPQ-005-30252` only >1 m),
now evidenced by a production document.

## Deliverables

1. **`SolvedGeometry.frameRect?: Rect`** (`src/types.ts`) — the rectangle the frame occupies.
   Absent ⇒ `outer`, so every existing consumer is byte-identical.
2. **`QuoteInput.addons?: { top?, bottom?, left?, right?: string }`** — auxiliary partKeys, threaded
   through `solve()` exactly like `cillKey` / `showJoints`.
3. **`solveTopology`** takes the add-on inset, sets `frameRect`, derives `rootDaylight` from it, and
   walks with the *frame's* width/height so split ratios stay frame-relative.
4. **`emitFrameBars`** is fed the frame rect's dimensions (it already takes `W, H` — no new
   arithmetic). **No add-on bar is emitted.**
5. **`renderSvg`** draws the frame ring from `frameRect` and an add-on band between `outer` and
   `frameRect`, in both the flat and realistic paths.
6. **Four per-edge options** `profile.addon-top|bottom|left|right` replacing the single gated
   `profile.addon`, with `engineEffect.kind: "addon"` carrying the side; adopted by doors through
   the existing `adoptShared()`.
7. **`Reinforcement.minBarLengthMm?: number`** + the emit-loop skip, with the map entries for
   `SPQ-5-30252` / `SPQ-005-30252` / `SPQ-05-20252` carrying their thresholds and page cites.

## Implementation checklist

- [x] `src/types.ts`: `frameRect`, `QuoteInput.addons`, `Reinforcement.minBarLengthMm`.
- [x] `src/engine/topology.ts`: add-on inset → `frameRect` → `rootDaylight`; walk on frame dims.
- [x] `src/engine/bars.ts`: frame bars from the frame rect; reinforcement length threshold.
- [x] `src/engine/svg.ts`: add-on band; frame ring from `frameRect`.
- [x] `src/engine/solve.ts`: thread `addons`.
- [x] `src/catalog/system-sunnyplast.ts`: reinforcement thresholds with cites.
- [x] `src/catalog/options/windows.ts`: four per-edge add-on options + choices from
      `system.auxiliaries`.
- [x] `src/designer/option-types.ts` + `resolve.ts`: the `addon` engine effect → `QuoteInput.addons`.
- [x] Assertions in `src/validation/jobs.ts` (`JOB_169_DOOR`, phase 5) and `src/engine/svg.test.ts`.

## Acceptance criteria

- A quote with no add-ons produces byte-identical geometry, SVG, parts and documents.
- A 1000 × 2000 door with `addon-top` prints frame **1005 / 1980** and sash **925 / 1900**;
  with `addon-left` it prints **980 / 2005** and **900 / 1925**.
- No cut row, BOM line or price is emitted for the add-on profile itself.
- The 78 mm divider carries 26×26 U steel at Int 1710 and none at Int 685/710.
- The add-on option appears on the casement family too, with the same four edges.

## Out of scope

- The add-on's own cut length (unevidenced — see `../questions.md`).
- Coupling profiles (`aux-coupling-frame`) and bay/bow prep — parts exist, no reference job.
