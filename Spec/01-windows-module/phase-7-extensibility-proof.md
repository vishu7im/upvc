# Phase 7 — Extensibility Proof (Second Family as Pure Data)

## Goal

Prove the plugin contract by registering **`entrance-door`** (single doors — an already-calibrated
engine family) as a second Designer family using ONLY seed data — and audit that zero designer-UI
changes were needed. This phase is the acceptance test of the whole architecture; its output
includes a written audit and fixes to the *platform* (never per-family special cases) where the
contract leaks.

## Context-in-a-box

Phases 1–6 delivered the schema-driven Designer for `casement-window`. The engine already
calibrates single doors (sash kinds `door-*`, door hardware sets, door labour pricing) and 16
quotable door designs exist in the gallery — so no engine or calibration work belongs in this
phase. Contracts: `../00-architecture/product-family-plugin.md` (the cost table in §4 is the
acceptance bar), `../00-architecture/option-schema.md`, phase-1 seed structure
(`src/catalog/families/*.ts`, `src/catalog/options/*.ts`).

## Deliverables

1. **Descriptor** `src/catalog/families/entrance-door.ts`: dimensions (door-appropriate min/max,
   `defaultFrom:"design"`), splitModes (`byDimensions`, `equalSplit`), componentTypes (frame
   edges, transom — fanlight over door is legal, sash kinds = door kinds, glass, panel, cill,
   addon), conversions (glass ⇄ panel; glass → sash gated to door kinds), topology
   (guillotineSplits true — fanlights/sidelights; midrails true — door midrail exists in engine;
   slidingPanels false), viewModes all four, engine `{adapter:"cellnode", quotable:true}`,
   constraints: door size limits **only if** Task 2 phase-4 landed the manual's limits table
   (else omit — golden rule, no guessed limits).
2. **Options** `src/catalog/options/doors.ts`: reuse shared groups (`profile-ancillary` colours/
   cill/bead, `glazing`, `placement` are family-agnostic — extend their `familyKeys` instead of
   duplicating) + door-specific options: door sash profile (T/Z per catalog), door hardware
   (lock, cylinder, door handle, hinges, shootbolt — from existing catalog hardware), threshold
   (documents-only until calibrated), door sash kind choices.
3. **Gallery entry**: door product designs get "Design in studio" (phase 3's entry point reads
   family from the design's product — ensure the design→family mapping is data: add
   `familyKey` resolution to the descriptor's `designSource.productIds`, not UI switches).
4. **Audit report** `Spec/01-windows-module/phase-7-audit.md` (written during execution):
   - table of every file touched, classified `seed-data | platform-fix | VIOLATION`;
   - any `VIOLATION` (per-family branch in web/, hardcoded family key outside seeds/tests) must
     be refactored into descriptor/schema capability before the phase closes;
   - list of contract gaps found + how the schema was extended (these schema extensions are the
     valuable output — e.g. if door hardware needs a "one per leaf" quantity rule the option
     schema lacks, extend `option-schema.md` + types, don't hack).
5. **Tests**: extend `validateDesigner` (phase 2) with a door golden test: default-config door
   draft == direct `solve()` on the same design (byte-identical totals); a fanlight-over-door
   split edit produces the expected transom in the cut list.

## Implementation checklist

- [x] Descriptor + options seeds. `src/catalog/families/entrance-door.ts` +
      `src/catalog/options/doors.ts`; `npm run db:seed` → **2 families, 27 option defs,
      73 choices**, partKey-validated as before.
- [x] Shared-group `familyKeys` extension verified. `doors.ts#adoptShared()` extends 13
      family-agnostic options' `familyKeys` in place; `mergeOptionSystems()` (new registry)
      collapses duplicates and **throws** if two families define the same key differently, so
      copying is impossible rather than merely discouraged. Groups are shared verbatim.
- [x] Walkthrough (live engine, 2026-07-26): `GET /api/families` lists both families;
      `GET /api/families/entrance-door` serves 20 options including the SHARED cill/glass and the
      door-only handle, and excluding the casement sash-type; a door draft resolves clean and
      prices (net £245.09); it persists as an order line item, joins a basket beside a legacy
      casement item, and confirms into the 7 documents.
- [x] Audit report written: `phase-7-audit.md`. Three contract gaps found, all closed as platform
      capability (family registry, `adoptShared`, three new 1:1 hardware slots).
- [x] `npm run validate` → **862 passed, 3 failed** (same pre-existing weld-drift trio); web
      build/lint clean, **zero `web/` changes** in this phase.

### Acceptance, checked

- `git diff --stat` for this phase touches only `src/catalog/**` (seed data + the new registry),
  `src/engine/hardware.ts` (three substitution slot names), `prisma/seed.ts` (imports the registry),
  `src/designer/resolve.test.ts` and `Spec/`. **No file under `web/` changed.**
- The door family is fully usable in the Designer and coexists with windows in one order/basket
  (verified end to end).
- Every audit row is `seed-data`, `platform-fix` (justified in the report) or `tests`.

### Deviations / notes

- **Door size limits are on the leaf.** The manual prints a residential-door maximum SASH
  (1002 × 2156, HAWDIO p70) and no outer-frame maximum for a doorset, so the descriptor generates
  leaf constraints from that row and declares its overall bounds as ergonomic UI guard rails,
  explicitly not manual figures (the casement minima already set that precedent). Reusing the
  "FIXED - (OUTER FRAME SIZE)" 2000 mm height would have warned on every ordinary 2100 mm door.
- **Door sash profile (T/Z) and threshold ship informational** (`pricingMode:"none"`): the engine
  exposes profile substitution for the frame and bead only, and no threshold part exists — golden
  rule, same treatment as the casement locking/hinge options.
- **Keep sets stay unslotted** on purpose: the engine picks R/H or L/H from the leaf's hinge side,
  and a free choice would let a quote fit a wrong-handed keep.
- **French doors were not registered.** 15 quotable French designs exist and the engine calibrates
  them; registering them is another descriptor + option file by this same recipe.

## Acceptance criteria

- `git diff --stat` for this phase shows changes ONLY in: seed/catalog data files, `Spec/`,
  tests, and (if gaps were found) `src/designer/` + `00-architecture/` schema docs — **zero
  changes under `web/`**. If web/ changed, the phase is not done: refactor until it isn't.
- Door family is fully usable in the Designer (walkthrough passes) and coexists with windows in
  one order/basket.
- Audit report exists and every row is `seed-data` or justified `platform-fix`.

## Out of scope

Sliding/French/Tilt&Turn family registration (follow-ups repeating this recipe; French needs no
new adapter, sliding needs the `sliding` adapter first), door partition products (await catalog
data), any new fabrication calibration.
