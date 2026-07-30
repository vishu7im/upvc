# Phase 2 — A frame profile per edge, a joint method per divider

## Goal

Stop assuming the outer frame is one profile on all four sides, and let a divider record how it
joins. Both are things the reference offers and our engine cannot express.

## Context-in-a-box

The reference prints `Frame (Standard) (Top) / (Bottom) / (Left) / (Right)` as four independent
dropdowns — see `collections/doors/WhatsApp Image 2026-07-30 at 4.01.39 PM (1).jpeg`, and the same
four rows in the Main Options block on every page of the Job 169 Work Order. Its choices on this
system are `SPQ-5-10252 64mm 5 Chamber` and `SPQ-6-11252 68mm 6 Chamber` — our `frame-5ch` and
`frame-6ch`, which differ in face width (64 vs 68), so a mixed selection genuinely changes the cut.

It also prints `Joint (Structural T/Z) (Transom)` with `Welded (Standard)` / `Mechanical
(Standard)`. That is the assembly method, orthogonal to the T/Z/S `jointType` our
`TransomSection` already carries (which selects the *profile*).

Today `Design.frameKey` is one string; `solveTopology` insets `rootDaylight` by
`frame.faceWidth` on all four sides, and `emitFrameBars` computes `W − 2 × fw` / `H − 2 × fw`.
Phase 1 has already moved both onto `frameRect`, so this phase only has to make the inset
per-edge.

**No reference job mixes frame profiles, and none shows a mechanical joint.** So: per-edge frames
are pure arithmetic already proven on each profile individually (byte-identical when all four
match, which is every design that exists), while `mechanical` gets the honest treatment — it is
selectable, it records and prints, it cuts as welded, and it raises a `warning` issue that the D9
advisory band puts on the work order.

## Deliverables

1. **`Design.frameKeys?: { top?, bottom?, left?, right?: string }`** overriding `frameKey`
   per edge, plus `QuoteInput.frameKeys` for a per-quote override (clone-on-override, like
   `glassKey`).
2. **`solveTopology`**: `rootDaylight` insets by each edge's own `faceWidth`; a cell touching the
   frame reads that edge's `glassRebate`.
3. **`emitFrameBars`**: each of the four bars carries its own profile; `Frame top` Int becomes
   `W − left.face − right.face`, `Frame left` Int becomes `H − top.face − bottom.face`. The
   reinforcement loop already keys off each bar's own code, so mixed profiles reinforce correctly
   with no change.
4. **`CellNode` splits gain `jointMethod?: "welded" | "mechanical"`** (absent ⇒ welded ⇒
   byte-identical). `mechanical` cuts as welded and produces a resolver warning citing that no
   deduction is calibrated.
5. **Seed options**: `profile.frame-top|bottom|left|right` (choices generated from
   `system.frames`, filtered to the family's own frames), `profile.divider-profile` and
   `profile.joint-method` scoped to `transom` / `mullion` components.

## Implementation checklist

- [x] `src/types.ts`: `Design.frameKeys`, `QuoteInput.frameKeys`, `jointMethod`.
- [x] `src/engine/topology.ts`: per-edge inset + per-edge glass rebate.
- [x] `src/engine/bars.ts`: per-edge frame bars.
- [x] `src/engine/solve.ts`: clone-on-override for `frameKeys`.
- [x] `src/catalog/options/windows.ts` + `doors.ts`: the six new options, shared where sensible.
- [x] `src/designer/resolve.ts`: `frame-key` effect gains a `side` param; `joint-method` warning.
- [x] Assertions: equal-on-all-four == today (byte-identity), a 64/68 mix moves daylight by 4 mm on
      that side only, `mechanical` warns and does not change a cut.

## Acceptance criteria

- Every existing design and validation job is byte-identical (all four edges share one profile).
- Selecting `frame-5ch` on the left of a `frame-6ch` unit widens the daylight by exactly 4 mm and
  shortens the head and sill by 4 mm, with nothing else moving.
- Choosing `Mechanical` prints on the work order, raises a warning, and does not silently invent a
  different cut.

## Out of scope

- A mechanical-joint deduction (no reference job).
- Per-edge cills, thresholds or beads.
