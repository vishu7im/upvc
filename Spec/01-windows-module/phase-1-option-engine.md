# Phase 1 — Option Engine (Backend Foundation)

## Goal

Persist, seed, load, and serve the JSON option system + product-family descriptors, so every later
phase has real data to render and resolve. **No UI, no resolver yet** (resolver = phase 2).

## Context-in-a-box (enough to execute cold)

This repo is a fabrication ERP: pure engine (`src/engine/*`) fed by an in-memory catalog that
`src/catalog/loader.ts#loadCatalog()` loads from Postgres (Prisma) at startup; synchronous
accessors are re-exported by `src/catalog/index.ts` (`getSystem`, `getDesign`, `listSystems`,
`listDesigns`). Seeding: `prisma/seed.ts` upserts from hardcoded TS sources in `src/catalog/*`
(idempotent, NO interactive `$transaction` — must survive PgBouncer). Express API in `src/api/`,
assembled by `src/api/server.ts`; admin routes follow the `src/api/catalog.ts` pattern
(requireAuth + requireAdmin, zod validation, `loadCatalog()` after every write). Verify with
`npx tsc --noEmit` and `npm run validate` (expected baseline: ~484 passed, 3 known pre-existing
weld-drift failures — not caused by you).

We are adding a schema-driven "Designer". This phase implements the data layer defined in:
- `../00-architecture/product-family-plugin.md` — `ProductFamilyDescriptor` schema (§2)
- `../00-architecture/option-schema.md` — OptionGroup / OptionDef / OptionChoice (§3–5), rule DSL (§6)
- `../00-architecture/data-model.md` — exact Prisma tables (§1), seed/loader requirements (§4)

## Deliverables

1. **Migration** `add_designer_option_system`: tables `product_family`, `option_group`,
   `option_def`, `option_choice` exactly as in `data-model.md` §1. Plain SQL, applied with
   `prisma migrate deploy` (pooler constraint).
2. **Types** `src/designer/option-types.ts`: TS interfaces for descriptor, group, def, choice,
   rule DSL nodes, `TopologyEdit`. These are the platform contracts — exported, documented,
   no `any`.
3. **Seed sources** (new, the source of truth):
   - `src/catalog/families/casement-window.ts` — the windows-family descriptor. Dimensions
     (width/height required with system-sensible min/max; distanceFromFloor informational),
     splitModes `["byDimensions","equalSplit","equalGlass"]`, componentTypes + conversions,
     topology capabilities (guillotineSplits, midrails), optionGroupKeys, viewModes
     `["external","internal","schematic","3d"]`, engine `{adapter:"cellnode", quotable:true}`.
   - `src/catalog/options/windows.ts` — groups `profile-ancillary`, `hardware`, `glazing`,
     `structure`, `general`, `placement` and their options/choices per the worked inventory in
     `option-schema.md` §8. Where choices mirror catalog entities (colours, glass, cills,
     hardware, beads), **generate choices from the loaded catalog at seed time** (map partKey →
     choice) rather than duplicating labels — one source of truth. Static choices (sash types,
     split-structure actions, drainage, glazing method, location suggestions) are literal data.
4. **Seed wiring**: `prisma/seed.ts#applyFamilyDescriptors()` + `applyOptionSystem()` —
   idempotent upserts by key; never overwrite owner-owned fields (`presentation`, `order`,
   `defaultCollapsed`) on existing rows; validate every `choice.partKey` against the catalog and
   fail loudly on dangling keys.
5. **Loader**: extend `src/catalog/loader.ts` to load families + option system into the snapshot;
   new accessors `getFamily(key)`, `listFamilies()`, `getOptionSystem(familyKey)` (returns groups
   with nested defs/choices, pre-filtered by `familyKeys`) exported via `src/catalog/index.ts`.
   Decimal→number conversion NOT needed here (no money in these tables — prices stay on catalog
   parts).
6. **API** `src/api/families.ts`:
   - `GET /api/families` (public, like `/api/systems`) → `[{familyKey, name, status, systemIds}]`
     for active families.
   - `GET /api/families/:key` (public) → full descriptor + option system (groups→options→choices),
     **without** any supplier cost data (same privacy split as the existing public
     `/api/systems/:id/options` vs admin catalog dump).
   - Admin CRUD (PATCH group/def/choice presentation+order fields; full create/delete deferred to
     seed files) following `src/api/catalog.ts` conventions; every write → `loadCatalog()`.
7. **Rule DSL evaluator** `src/designer/rules.ts`: `evalRule(rule, ctx): boolean` per
   `option-schema.md` §6 — pure, fail-loud on unknown operators/paths. (It lands this phase so it
   can be exhaustively unit-tested before the resolver consumes it in phase 2.)
8. **Tests**: `src/designer/rules.test.ts` (every operator, nesting, unknown-op throws) and a
   seed-integrity check wired into `npm run validate` style (assert: windows family loads, every
   option's groupKey resolves, every catalog-derived choice's partKey exists, defaults are unique
   per option).

## Implementation checklist

- [x] Write `src/designer/option-types.ts` (contracts first). → descriptor/group/def/choice, the
      rule DSL nodes, `TopologyEdit` (+ a `TopologyEditTemplate` for the stored `action` payload),
      and the `EngineEffectKind` enum documented as a table of ENGINE TOUCH-POINTS so phase 2 has
      an unambiguous target per kind. No `any`.
- [x] Prisma models + migration SQL; `npx prisma migrate deploy` + `prisma generate`. →
      `20260725010000_add_designer_option_system`, four new tables, applied through the pooler.
- [x] `src/designer/rules.ts` + exhaustive unit tests. → `evalRule` / `resolveOperand` /
      `assertValidRule`; **62 assertions** in `rules.test.ts`.
- [x] Seed sources (`families/casement-window.ts`, `options/windows.ts`).
- [x] `prisma/seed.ts` wiring (idempotent; partKey validation; owner-field preservation). →
      `applyDesignerOptionSystem()`; the structural checks live in the pure, unit-testable
      `src/designer/option-integrity.ts` (see deviation 4).
- [x] Loader + accessors + `src/catalog/index.ts` exports. → `loadDesignerSnapshot()`,
      `getFamily` / `listFamilies` / `getOptionSystem`.
- [x] `src/api/families.ts` + mount in `server.ts`.
- [x] Admin PATCH routes + catalog refresh. → group / option / choice PATCH, each followed by
      `loadDesignerSnapshot()` (the option slice; a full `loadCatalog()` would re-fetch 500
      designs and the logo for an option rename).
- [x] Run: `npm run db:seed` twice (idempotency), `npm run validate`, `npx tsc --noEmit`.

## Acceptance criteria — met (2026-07-25/26)

- **`GET /api/families`** lists `casement-window` (active, `systemIds:["sunnyplast-70"]`).
  **`GET /api/families/casement-window`** returns the descriptor (16 constraints) + **6 groups /
  20 options / 59 choices**. Catalog-derived choices are 1:1 with live catalog entries — asserted
  per entity (colours ×2 sides, glass, cills+1) AND by label identity, so a renamed catalog part
  renames its choice. **The payload contains no cost/price key** — asserted by a recursive scan of
  the whole served object, not by eyeballing.
- **Re-seeding changes nothing and preserves admin edits.** Verified by row-level diff of all four
  tables across two full `npm run db:seed` runs, with owner edits applied in between (group order
  20→99 + `defaultCollapsed`, option order + `presentation`, choice order). The ONLY differences
  after the second run were exactly those five edited fields; all 86 rows were otherwise identical.
  The test edits were then restored to seed values.
- **A dangling `partKey` fails the seed with a clear message** — and this is now a standing
  assertion rather than a one-off: `options.test.ts` §7 corrupts copies of the REAL seed seven ways
  (dangling partKey, two defaults, unknown group, orphan choice, action without a template,
  duplicate key, malformed rule) and asserts each is rejected.
- **`npm run validate`: 691 passed, 3 failed** — the 3 are the documented pre-existing DB
  weld-drift failures (memory/validate-weld-drift.md), unchanged. Up from the 571-passed phase-4
  baseline: **+120 new assertions, all green**. No engine file was touched, so no geometry or
  pricing assertion could move.
- **Rule evaluator**: every operator covered (`all/any/not/eq/neq/lt/lte/gt/gte/in/selected/exists`),
  plus operand-path resolution, deep nesting, and 17 fail-loud cases. An unknown operator throws.
- `npx tsc --noEmit` clean. Live-verified against the running API: both GETs, 404 on an unknown
  family, 401 unauthenticated PATCH, 400 on an empty patch body, 404 on an unknown key, and a
  successful PATCH visible in the very next GET (snapshot refresh without a restart).

## Deviations from this file (deliberate, with reasons)

1. **`profile.frame-profile` is item-level `profile.frame-chamber`, not per `frame-edge`.** §8's
   inventory scopes it to the frame edges, but the engine has no per-edge frame slot — the
   per-item override is `frameKey` (an `order_item` column), and no manual page or reference job
   gives a per-side frame rule. Scoping it to `frame-edge` would render a control that cannot be
   honoured. Re-scope when a calibrated per-side rule exists.
2. **`hardware.locking` and `hardware.hinge` ship one informational choice each.** §8 says
   "catalog hardware", but the espagnolette and friction stay are **size-selected by the engine**
   (`pickEspag` / `pickFrictionHinge`, calibrated on Jobs 85/88/90). Listing the individual parts
   as free choices would let a quote put a 600 mm espag on a 1000 mm sash — breaking a calibrated
   rule from the UI. They are seeded `pricingMode:"none"` with a helpText saying the length is
   engine-selected. Real alternatives need a calibrated SELECTION rule, not just a part list
   (questions.md **Q19**).
3. **`isDefault` is not admin-patchable.** It is a seed-owned field, so an admin flip would revert
   on the next deploy, and some defaults exist to keep quotes byte-identical (bead-28 is the
   engine's default bead). A control that silently undoes itself is worse than no control;
   changing a default is a one-line seed edit.
4. **Integrity checks live in `src/designer/option-integrity.ts`, not inline in `prisma/seed.ts`.**
   A rule that only runs inside the seed is a rule nobody can test — extracting it (pure, no I/O)
   made the seven fail-loud cases above assertable, and lets a future admin import reuse it.
5. **RBAC reuses the `catalog` module's `read`/`update` permissions** rather than adding a
   `designer` module. Option data is catalog data edited from the same admin console, and this
   avoids an RBAC migration + a role-grid change for zero access-control benefit.
6. **`order` columns are mapped to `sort_order`** (`order` is a reserved SQL word; the plain-SQL
   migrations stay readable). The Prisma field and every API/TS shape still say `order`.

## Follow-ups raised (not silently absorbed)

- **questions.md Q19** — should size-selected hardware (espag/stay) ever be user-overridable, and
  on what calibrated rule?
- **questions.md Q20** — `glazing.method: unglazed` currently still prices its glass. Omitting the
  glass lines is a phase-2 resolver capability; flagged in the option's helpText meanwhile.
- `profile.bead` declares `engineEffect: profile-substitution {slot:"bead"}`, which the engine does
  not yet expose per item. Phase 2's resolver implements it the way U3 implemented `glassKey`
  (clone the cell tree, fill the key where the cell doesn't pin its own).

## Explicitly out of scope

Resolver, line items, any UI, any engine change. Do not touch `src/engine/*`.
**Honoured:** `src/engine/*` is untouched by this phase — `limits.ts` is only *read* (imported by
the family seed source so the size constraints are generated from the one HAWDIO p70 transcription
rather than retyped, exactly as migration phase 4 anticipated).
