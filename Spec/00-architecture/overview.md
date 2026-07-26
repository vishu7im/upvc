# Architecture Overview — Product Designer Platform

> Read-first document for ANY phase in `Spec/01-windows-module/` or `Spec/02-manual-migration/`.
> It defines the target architecture, the module boundaries, and the vocabulary every other spec
> file uses. It is self-contained: you do not need the rest of the repo docs to understand it.

## 1. Where we are today (baseline you build on, not from scratch)

The repo is a working B2B fabrication ERP:

- **Pure engine** (`src/engine/*`): `solve({systemId, designId, widthMm, heightMm, …}) → QuoteOutput`
  (geometry, cut bars, BOM, cutting plan, pricing, SVG, HTML documents). Pure functions; all data
  comes from an in-memory catalog loaded from Postgres at startup (`src/catalog/loader.ts`). The
  **one architectural rule of this repo: the engine is pure; the catalog is the only data seam.**
- **Catalog** (Prisma/Postgres): profile systems, parts, glass, gaskets, hardware, colours (with
  supplier price tiers), 500+ designs with `CellNode` topology JSON, settings/branding.
- **API** (`src/api/*`, Express :3005): quote, orders (draft → confirm → 7 documents + PDF), auth
  (JWT), admin catalog CRUD.
- **Web** (`web/`, Next.js :3000): BFF proxy (httpOnly JWT cookie), product/design gallery,
  `/quote` configurator (W×H, glass, colour in/out, cill, drag-to-resize splits, joints overlay,
  3D massing), orders UI, admin console.
- Calibrated families: Casement, Single Door, French Door, Sliding Patio. Tilt&Turn modelled but
  gated `quotable:false`.
- **Golden rule**: never guess a fabrication value; every deduction cites a manual page or a
  validated reference job. `npm run validate` is the safety net (baseline ~484 passed + 3 known
  pre-existing weld-drift failures — not a regression signal).

## 2. What we are building (Task 1 in one paragraph)

A **Designer module**: a new, modern line-item configurator at a new route (`web/app/(app)/designer`)
that lives **alongside** the existing `/quote` page (owner decision — do not modify or remove
`/quote` or its API contract). It is driven by three new JSON-first constructs:

1. **Product Family Descriptor** — declares what a family (casement window, door, sliding, …) IS:
   its dimension fields, component types, option groups, topology capabilities, and view modes.
   See `product-family-plugin.md`.
2. **Option System** — JSON-defined option groups/options/choices with component scoping, filters,
   visibility rules, instant actions, and validation. See `option-schema.md`.
3. **Line Item** — a persisted JSON document capturing everything the user configured (dimensions,
   selections, topology edits) plus computed results (issues, price, glass sizes). See
   `line-item-schema.md`.

Adding a future product family must require: one descriptor JSON + option definitions JSON + (only
if the engine lacks the geometry) an engine adapter — and **zero designer-UI code changes**.

## 3. Module boundaries (target)

```
┌────────────────────────────────────────────────────────────────────────┐
│ web/ (Next.js)                                                         │
│  /designer            ← NEW schema-driven UI (renders from descriptor) │
│  /quote               ← untouched legacy configurator                  │
│  /orders /admin       ← extended (basket layer, option admin)          │
└───────────────▲────────────────────────────────────────────────────────┘
                │ BFF proxy (existing seam, unchanged pattern)
┌───────────────┴────────────────────────────────────────────────────────┐
│ src/api/ (Express)                                                     │
│  families.ts   ← NEW  GET /api/families, /api/families/:key            │
│  lineitems.ts  ← NEW  POST /api/line-items/resolve  (stateless solve)  │
│  orders.ts     ← extended: line-item persistence + basket totals       │
│  catalog.ts    ← extended: option-definition admin CRUD                │
└───────────────▲────────────────────────────────────────────────────────┘
                │ synchronous in-memory catalog accessors (existing seam)
┌───────────────┴────────────────────────────────────────────────────────┐
│ src/catalog/  loader.ts ← also loads family descriptors + option defs  │
│ src/designer/ ← NEW: resolver pipeline (pure, engine-adjacent)         │
│    resolve(descriptor, optionDefs, lineItem) → QuoteInput → solve()    │
│    validate(lineItem) → Issue[]                                        │
│ src/engine/   ← pure, UNCHANGED core; small additive extensions only   │
└────────────────────────────────────────────────────────────────────────┘
```

**The resolver (`src/designer/`) is the new heart.** It is pure (same discipline as the engine):
`(FamilyDescriptor, OptionDef[], LineItemDraft) → { quoteInput, issues }`. It translates
schema-driven selections into the engine's existing `QuoteInput` (glassKey, colourKey/Outside,
cillKey, splitRatios, overrides, …) plus topology edits. The engine's `solve()` stays the single
computation entrypoint. Nothing in `src/designer/` or `src/engine/` does I/O.

## 4. Design tenets (bake into every phase)

1. **JSON-first**: option groups, options, choices, visibility rules, instant actions, family
   descriptors, and line items are data. UI renders them generically; adding options is seeding
   data, not writing components.
2. **Engine purity is inviolable**: no I/O in `src/engine/*` or `src/designer/*`. New data reaches
   them as plain objects through the catalog loader.
3. **Additive, byte-identical by default**: every engine extension must be a no-op when its new
   input is absent, so the existing validation assertions stay green (this repo's proven pattern —
   colourKey, joints overlay, splitRatios all work this way).
4. **Component scoping over flags**: "glass X in pane 2" is a scoped selection
   (`{optionKey, choiceKey, scope: componentId}`), not a new ad-hoc field. Whole-item selections
   are simply unscoped.
5. **Instant actions are topology ops**: "Add transom", "Convert pane to sash" mutate the line
   item's topology-edit list; the engine already models split/midrail/leaf-kind machinery.
6. **Golden rule everywhere**: no fabrication value may enter the catalog or specs without a manual
   page cite or validated job. Options with unknown prices carry price 0 — never guessed.
7. **Don't break the legacy surface**: `/quote`, `/api/quote`, existing order flows keep working
   unchanged until the owner retires them.

## 5. Vocabulary (used consistently across all spec files)

| Term | Meaning |
|---|---|
| **Family** | A product family (casement-window, entrance-door, sliding-patio…), declared by a descriptor JSON. |
| **Descriptor** | The `ProductFamilyDescriptor` JSON for a family. |
| **Component** | An addressable part of a configured item: frame edge, transom, mullion, sash, glass pane, panel, cill, add-on. Identified by a stable `componentId` derived from topology position. |
| **Option / Choice** | An option is a question ("Handle"); a choice is an answer ("White Inline Handle"). |
| **Scope** | The component(s) a selection applies to; absent = whole item. |
| **Instant action** | A choice that mutates structure instead of setting a value (add transom, convert component). |
| **Line item** | One configured product instance inside an order, stored as JSON. |
| **Resolver** | Pure function turning descriptor + selections into engine input + issues. |
| **Issue** | A validation problem (`invalidDimensions`, `invalidSpec`, rule violation) attached to a line item, shown in UI and blocking confirm. |
| **Basket** | Order-level commercial layer: fitting/survey/delivery/discount/tax totals. |

## 6. Reference material (what informed this design)

- `collections/windows/` — competitor reference (Quotila, a white-label BM-Touch portal):
  13 screenshots (views/, profile/, hardware/, glass/, gernal/, and 5 root screenshots) +
  `jobitem.json` (a real 41-option-group line item) + `basketsummary.json` (order rollup).
  We adopt its *concepts* (component-scoped options, instant actions, schematic view, split
  modes, summary chips) — **not** its UI. Our design language is defined in
  `ux-design-language.md`.
- `collections/docs/HAWDIO 21-7-2026.pdf` — current fabrication manual revision (see
  `Spec/02-manual-migration/findings.md`).

## 7. Execution order & dependencies

```
00-architecture (this folder: read, no code)
  └─► 01-windows-module/phase-1-option-engine      (backend foundation)
        └─► phase-2-line-item-core                 (resolver + API)
              ├─► phase-3-configurator-shell       (UI shell)
              │     ├─► phase-4-component-editing  (needs shell + resolver)
              │     └─► phase-5-views-and-preview  (needs shell)
              └─► phase-6-basket-and-orders        (needs line items; UI parts need shell)
                    └─► phase-7-extensibility-proof (needs all of the above)

02-manual-migration is INDEPENDENT of 01 (touches catalog/engine calibration, not the designer):
  phase-1-breaking-fixes ─► phase-2-catalog-additions ─► phase-3-tilt-turn-calibration
                                                       ─► phase-4-limits-and-validation
  (supplier-queries.md gates parts of phases 2–4; phase-1 is NOT gated — execute first)
```

After ANY change in `02-manual-migration` phases: run `npm run validate` and compare against the
baseline (~484 passed, 3 known weld-drift failures). New assertions must be added for every changed
formula before the change is made (test-first, per repo convention).
