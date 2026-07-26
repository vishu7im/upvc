# Phase 2 — Line-Item Core (Resolver + Storage + API)

## Goal

The stateless resolve pipeline (draft → issues + price + geometry) and persisted designer line
items on orders, including confirm integration. After this phase the whole designer works
headlessly over HTTP; phases 3–5 only add UI.

## Context-in-a-box

Baseline repo facts: pure engine entrypoint `solve(input: QuoteInput)` in `src/engine/solve.ts`
(synchronous; catalog must be loaded first via `loadCatalog()` — see `src/api/server.ts`
bootstrap). `QuoteInput` already supports: `systemId, designId, widthMm, heightMm, glassKey,
colourKey, colourKeyOutside, cillKey, splitRatios (keys "root", "root.b{i}", cell paths),
showJoints, mode:"custom"+overrides`. Topologies are `CellNode` trees on designs;
`applySplitRatios` in `solve.ts` handles ratio application; midrails exist via `CellSpec.midrails`;
sash kinds are `SashKind` strings. Orders: `src/api/orders.ts` (draft items → confirm → 7 documents
via `aggregate.ts`; confirmed orders immutable). Validation: `npm run validate`
(~484 passed + 3 known weld-drift failures baseline). Phase 1 delivered: option system + family
descriptors in DB/loader (`getFamily`, `getOptionSystem`), rule evaluator `src/designer/rules.ts`,
types in `src/designer/option-types.ts`.

Contracts to implement (read them, they are exact):
- `../00-architecture/line-item-schema.md` — `LineItemDraft`, `ResolvedLineItem`, pipeline (§4), API (§5)
- `../00-architecture/product-family-plugin.md` — `EngineAdapter` interface + componentId scheme (§3)
- `../00-architecture/option-schema.md` — resolution semantics (§7), `engineEffect` kinds
- `../00-architecture/data-model.md` — `designer_line_item` table, coexistence rules (§3)

## Design notes (decisions already made)

- **Resolver is pure**: `src/designer/resolve.ts#resolveLineItem(draft, catalogSnapshot) →
  ResolvedLineItem`-minus-svg. It never imports services or Prisma. The API layer supplies the
  catalog snapshot and persists results.
- **`cellnode` adapter first** (`src/designer/adapters/cellnode.ts`): covers casement windows now,
  doors/french later. `sliding` adapter deferred to phase 7 or when the sliding family is
  registered. Adapter responsibilities: topology-edit application (immutable tree transforms),
  componentId derivation (`cell:<path>`, `cell:<path>/sash`, `cell:<path>/glass`, `edge:<side>`,
  `divider:<path>`), `toQuoteInput`.
- **Topology edits map to existing engine concepts** — `split` inserts an hsplit/vsplit CellNode
  (equal ratio or `at-ratio`), `add-midrail` writes `CellSpec.midrails`, `convert-component`
  changes leaf content (glass ⇄ sash(kind) ⇄ panel), `remove-divider` collapses a split. **No new
  engine math.** Panels: a leaf whose content is a panel maps to the existing glass-slot with a
  panel glassKey (panels are glass rows in the catalog per M5.5) — if a gap emerges, record it in
  `Spec/questions.md` rather than inventing fabrication behaviour.
- **`engineEffect` kinds implemented this phase**: `glass-key` (item-level → `QuoteInput.glassKey`;
  component-scoped → per-cell glass pinning on the working topology), `colour-key`
  (internal/external → `colourKey`/`colourKeyOutside`), `cill-key`, `hardware-substitution`
  (slot-keyed replacement map passed to hardware computation — additive engine param, see below),
  `bom-line` (priced add-lines appended to pricing input), `none`. `profile-substitution` and
  `topology-edit` kinds may be stubbed with a clear not-implemented error listing them in issues.
- **The one engine touch** (additive, byte-identical when absent): `QuoteInput.hardwareOverrides?:
  Record<slot, partKey>` threaded to `computeHardware` so scoped hardware choices (handle/locking/
  hinge per sash) actually change BOM lines. When absent, output is byte-identical — existing
  assertions stay green. Follow the proven pattern of `glassKey`/`colourKey` (clone-on-override in
  `solve.ts`, no mutation).
- **Constraints after solve**: evaluate descriptor `constraints[]` against solved geometry
  (component dims available from `listComponents`); emit warning/error issues with `source` cites.
- **Weight limits use the manual's sash-weight formula** ONLY if Task 2 phase-4 has landed;
  otherwise omit weight constraints (do not guess glass weights).

## Deliverables

1. Migration `add_designer_line_items` (`designer_line_item` per `data-model.md`).
2. `src/designer/adapters/cellnode.ts` (+ `adapters/index.ts` registry keyed by descriptor
   `engine.adapter`).
3. `src/designer/resolve.ts` (pipeline §4: dimensions → edits → selections → engineEffects →
   `solve()` → constraints → assemble). Selection precedence exactly per `option-schema.md` §7.
4. `src/designer/select.ts` — effective-value computation (unit-tested separately).
5. Engine: `hardwareOverrides` additive param (`src/types.ts`, `src/engine/solve.ts`,
   `src/engine/hardware.ts`).
6. API `src/api/lineitems.ts`:
   - `POST /api/line-items/resolve` (public, stateless; zod-validate draft; 400 on malformed,
     resolved-with-issues on invalid-but-well-formed).
   - `POST/PUT/DELETE /api/orders/:id/line-items[/:itemId]` (auth'd; draft orders only; persist
     draft + cached resolved + catalogVersion; position management).
   - Extend `GET /api/orders/:id` to include designer items (draft+summary, not full resolved).
7. Confirm integration in `src/api/orders.ts`: re-resolve each designer item; any error-severity
   issue ⇒ 422 `{issues}`; else feed the resolved engine outputs into the existing
   `aggregate.ts` → 7-documents flow alongside legacy items; snapshot per `line-item-schema.md` §6.
8. Tests wired into `npm run validate` (new `src/designer/resolve.test.ts#validateDesigner`):
   - Golden test: a draft mirroring an existing validation design (same design, W×H, defaults
     only) produces **byte-identical pricing totals and cut lists** to a direct `solve()` call.
   - Scoped glass on one pane changes exactly that pane's glass line.
   - Precedence: component-scoped beats all-of-type beats item-level.
   - `split(equal)` edit equals the design authored with that transom (reuse an existing design
     pair if available; else assert span math).
   - Required-unset ⇒ error issue; hidden-required ⇒ no issue.
   - Constraint violation emits issue with `source`.
   - Idempotence: resolve(resolve-input) stable.

## Implementation checklist

- [x] Migration + `prisma generate`. — `20260726010000_add_designer_line_items` (plain SQL,
      `migrate deploy`-compatible; one additive table, no existing table touched).
- [x] Adapter (componentIds, applyEdit, toQuoteInput, listComponents) + unit tests.
      `src/designer/adapters/cellnode.ts` + `adapters/index.ts` registry. Also carries
      `equalSplitRatios()` (the `equalSplit` split mode) and `pinCellField`/`pinAllCells`
      for component-scoped glass/bead.
- [x] `select.ts` precedence + tests. Precedence, visibility (fail-loud via `rules.ts`),
      required-unset issues and text/number validation.
- [x] `resolve.ts` pipeline + issues assembly. Pure; catalog arrives as a `CatalogSnapshot`.
      Contracts split into `src/designer/line-item-types.ts`.
- [x] `hardwareOverrides` engine param (additive) — plus `topologyOverride`, the seam through
      which topology edits reach `solve()` (same clone-on-override pattern). `npm run validate`
      stayed at baseline (the 3 failures are the pre-existing weld drift).
- [x] `lineitems.ts` routes + `server.ts` mount; confirm-flow extension (re-resolve → 422 on any
      error issue → otherwise into the existing `aggregate.ts` 7-document flow alongside legacy items).
- [x] `validateDesigner` suite into the validate runner. Baseline 691 → **725 passed**.
- [x] `npx tsc --noEmit` clean; `npm run validate` 725/3-known; manual curl pass over the whole
      happy path (resolve → persist → GET → confirm → documents), the 422 path, and a legacy
      quote + legacy order confirm to prove coexistence. Test orders and the temporary test user
      were deleted afterwards.

### Deviations / notes for later phases

- **`equalGlass` returns a warning Issue** and falls back to the drawn positions, exactly as the
  spec allows (questions.md Q4).
- **`hardware-substitution` is per-SLOT, not per-component.** `computeHardware` tallies by slot,
  so differing per-sash handle picks emit a `conflicting-selection` warning and the first pick
  wins. Per-sash hardware needs a per-cell hardware map in the engine — a phase-4 decision.
- **`bom-line` accepts catalog HARDWARE parts only** (a plain part × qty). Glass/gasket/profile
  rows carry per-m²/per-metre semantics that would need a length or area rule, which no
  calibrated source gives — so they are rejected with an issue rather than guessed.
- **Only the WEIGHT verdicts** from `checkSizeLimits()` merge into the issue list; the size
  verdicts already arrive as descriptor constraints generated from the same `SIZE_LIMITS`
  transcription, and merging both would double-report every oversize.
- **Designer-inserted dividers default to `transom-t-67` / `mullion-78`** — the same defaults the
  M3 extractor applies to every collection design, so no new fabrication assumption is introduced.

## Acceptance criteria

- Headless flow works end-to-end by curl: resolve a draft → persist to a draft order → confirm →
  7 documents include the designer item with correct aggregated pricing.
- The golden byte-identity test passes (designer defaults == direct solve).
- Baseline validation unchanged; new `validateDesigner` assertions green.
- Confirm with an error-issue item returns 422 listing the issues; order stays draft.
- Legacy `/api/quote` + legacy order items behave exactly as before.

## Out of scope

All UI. Sliding adapter. `equalGlass` split mode implementation (resolver accepts the mode but may
emit a not-implemented warning issue — UI phase 3 hides it until implemented; see
`Spec/questions.md` Q4).
