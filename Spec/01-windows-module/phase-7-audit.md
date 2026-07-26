# Phase 7 — Extensibility audit (entrance-door)

> Written during execution, 2026-07-26. The question this file answers: **what
> did it actually cost to add a second product family?**

## Verdict

`entrance-door` is a fully usable Designer family — measurements, options,
component selection, structural edits, all four views, order line items,
confirm, documents — and **not one line of `web/` changed to get it**. The
gallery lights up door products because `products/[id]/page.tsx` already matches
a design's product against the descriptors' own `designSource.productIds`; the
inspector renders door options because it renders whatever
`GET /api/families/:key` returns; the canvas hit-tests door components because
the adapter derives them from solved geometry.

The contract did leak in three places, all of them *platform* gaps rather than
door-specific ones, and all three were fixed as platform capability. They are
listed as `platform-fix` below with the reasoning.

## Files touched

| File | Class | What / why |
|---|---|---|
| `src/catalog/families/entrance-door.ts` | **seed-data** | The descriptor. Dimensions, component types, conversions, topology capabilities, view modes, and constraints GENERATED from `SIZE_LIMITS` (HAWDIO p70) — the same transcription the casement descriptor reads. |
| `src/catalog/options/doors.ts` | **seed-data** | Door option system: leaf type, door sash profile (informational), handle / lock / cylinder / hinges, threshold (informational) — plus `adoptShared()`, which extends 13 family-agnostic options' `familyKeys` instead of copying them. |
| `src/catalog/families/index.ts` | **platform-fix** | NEW registry: `FAMILIES` + `buildOptionSystem()` + `mergeOptionSystems()`. Before this, `prisma/seed.ts` imported `FAMILIES` from `casement-window.ts` and called `buildWindowsOptionSystem()` by name — i.e. the seed knew one family personally. Now it knows the registry. |
| `src/catalog/families/casement-window.ts` | **platform-fix** | Only the `FAMILIES` export moved out (to the registry). The descriptor itself is byte-unchanged. |
| `prisma/seed.ts` | **platform-fix** | Two import lines and one call site: `buildOptionSystem(SUNNYPLAST_70)`. The seed now names no family. |
| `src/engine/hardware.ts` | **platform-fix** | Three new 1:1 substitution slots on the door leaf — `lock`, `cylinder`, `hinge` — beside the existing `handle`. See "Contract gaps" below. Byte-identical when no override is passed. |
| `src/designer/resolve.test.ts` | **tests** | `validateSecondFamily()`: the door golden test, the descriptor-driven assertions, the shared-vs-specific option split, a hardware substitution, and a fanlight split. |
| `Spec/01-windows-module/phase-7-*.md` | **docs** | This audit + the phase checklist. |
| **`web/**`** | — | **No change.** This is the acceptance criterion and it holds. |

`git diff --stat` for this phase therefore contains only seed/catalog data,
`src/catalog` registry code, one engine hardware change, tests and `Spec/`.

## Contract gaps found, and how they were closed

### 1. The seed knew a family by name (platform)

`prisma/seed.ts` imported `FAMILIES` from `casement-window.ts` and called
`buildWindowsOptionSystem()`. Adding a family would have meant editing the seed
for every family forever, and — worse — the *first* family's file owned the list
of *all* families.

**Fixed as capability:** `src/catalog/families/index.ts` is now the registry.
`mergeOptionSystems()` collapses duplicate option keys, unioning their
`familyKeys` and **throwing** if two families define the same key differently —
so "share it" is enforced rather than merely recommended. Registering a third
family is now: two seed files, two lines in the registry.

### 2. Shared options had no sharing mechanism (schema, resolved without a schema change)

`option_def.key` is a primary key, so "Cill" cannot exist twice. The schema
already had the right field (`familyKeys: String[]`) and the loader already
filtered on it — what was missing was a seed-side way to say *this family joins
that option*. `doors.ts#adoptShared()` is that: it mutates the shared option's
`familyKeys` and returns the same objects, so exactly ONE definition of each
shared option exists and drift is impossible by construction. It fails loud if
an adopted key has disappeared.

No change to `option-schema.md` was needed — the contract was already right.

### 3. Only "handle" was a substitutable hardware slot (engine)

Phase 2 wired `QuoteInput.hardwareOverrides` with a deliberate limit: only
genuine 1:1 slots, "handle today", because espagnolettes and friction stays are
SIZE-selected and letting the UI pick one would break a calibrated rule
(questions.md Q19). A door's lock, cylinder and hinges are **not** size-selected
— the engine fits exactly one lock, one cylinder and three hinges per leaf,
unconditionally — so they are 1:1 by the same test the handle passed.

**Fixed as capability:** `hardware.ts` now passes slot names for those three.
The keep set (`hw-keep-rh`/`hw-keep-lh`) deliberately stays unslotted: the
engine picks it from the leaf's hinge side, and a free choice there would let a
quote fit a wrong-handed keep. Both facts are asserted in the phase-7 tests.

## What is deliberately NOT modelled

- **Door size limits are on the LEAF, not the unit.** The manual prints a
  residential-door maximum sash (1002 × 2156, HAWDIO p70) and no outer-frame
  maximum for a doorset. The descriptor therefore generates leaf constraints
  from that row and declares its overall width/height bounds as *ergonomic UI
  guard rails, explicitly not manual figures* — the same treatment the casement
  minima already get. Reusing the "FIXED - (OUTER FRAME SIZE)" 2000 mm row would
  have warned on every ordinary 2100 mm door.
- **Door sash profile (T vs Z) is informational.** Both profiles exist in the
  catalog, but the engine exposes profile substitution for the frame and the
  bead only, and no reference job gives the cut for a swapped door sash. Ships
  `pricingMode:"none"` with a helpText saying exactly that (golden rule).
- **Threshold is informational.** No threshold part exists in the catalog and no
  cut rule deducts for one — it prints on the work order and nothing more.
- **French doors stay their own product.** 15 quotable French designs exist and
  the engine calibrates them (Job 00000264), but registering them is a separate
  descriptor — this phase proves the recipe rather than consuming it.

## Cost, measured

Two new seed files (~430 lines of data + comments), one 100-line registry, one
three-word engine change, and the tests. Everything a user sees — the option
groups, the controls, the scoping, the actions, the views, the basket — came for
free from the platform built in D1–D6.
