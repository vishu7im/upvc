# Windows Module — Phase Map

> Task 1: build the new schema-driven **Designer** for windows (scaling to all future product
> families) alongside the existing `/quote` configurator. Architecture in `../00-architecture/`
> (read `overview.md` first; the other architecture files are referenced per phase).

## Owner decisions (fixed — do not re-litigate)

- **Build alongside**: new route; `/quote` + its API stay untouched.
- **Full basket scope**: fitting/survey/delivery/discount/tax layer is in scope (phase 6).

## Phases & dependency graph

```
phase-1-option-engine        backend: family descriptors + option system + seeds
        │
phase-2-line-item-core       backend: resolver pipeline + line-item storage/API
        │
phase-3-configurator-shell   UI: /designer workspace (measurements + options + live resolve)
        ├── phase-4-component-editing    UI+resolver: canvas selection, scoped options,
        │                                instant actions, component conversion
        ├── phase-5-views-and-preview    UI+svg: external/internal/schematic views, annotations
        └── phase-6-basket-and-orders    backend+UI: commercial layer, order integration, docs
                        │
phase-7-extensibility-proof  register entrance-door family as pure data; contract audit
```

Phases 4, 5, 6 are parallelisable after phase 3. Phase 7 requires all others.

## Per-phase one-liners & key deliverables

| Phase | Delivers | Primary new code locations |
|---|---|---|
| 1 | `product_family` + option tables, seeds for the windows family, loader accessors, `GET /api/families[/:key]` | `prisma/`, `src/catalog/families/`, `src/catalog/options/`, `src/api/families.ts` |
| 2 | Pure resolver + rule evaluator + adapters, `designer_line_item` table, `POST /api/line-items/resolve`, order line-item CRUD, confirm integration | `src/designer/*`, `src/api/lineitems.ts` |
| 3 | `/designer` workspace: canvas + inspector (Measurements/Options tabs), live resolve, gallery entry point | `web/app/(app)/designer/`, `web/components/designer/*` |
| 4 | Component click-to-select + scope pill, apply-scopes, Structure tab, instant actions, conversions | `web/components/designer/*`, `src/designer/adapters/*` |
| 5 | View modes external/internal/schematic (+ existing 3D), dimension & glass-size annotations | `src/engine/svg.ts` (additive opts), `web/components/designer/canvas.tsx` |
| 6 | Basket totals (fitting/survey/delivery/discount/tax), admin config, order UI + documents | `src/designer/basket.ts`, `src/api/orders.ts`, `web/app/(app)/orders/` |
| 7 | `entrance-door` descriptor + options as data; zero-UI-change audit; contract gaps fixed | `src/catalog/families/entrance-door.ts` (+ audit report) |

## Cross-phase conventions (apply to every phase)

- **Engine purity**: no I/O in `src/engine/*` or `src/designer/*`; data arrives via the catalog
  loader. Engine extensions must be additive + byte-identical when unused, keeping
  `npm run validate` green (baseline ~484 passed + 3 known weld-drift failures).
- **Golden rule**: no guessed fabrication values. Options without calibrated fabrication effect are
  documents-only (flagged in their `presentation.helpText`) and priced from the catalog or £0.
- **Seeds are source of truth**; idempotent upserts, no interactive transactions (pooler-safe).
- **Admin writes call `loadCatalog()`** to refresh the in-memory snapshot.
- **Verification stack per phase**: `npx tsc --noEmit` (root and/or `web/`), `npm run validate`
  (root), `cd web && npm run build && npm run lint`, plus the phase's own acceptance tests. UI
  phases: verify against a mock engine per the repo's established U-milestone pattern, then live.
- Each phase file is self-contained (context-in-a-box) — you can execute it in a fresh session
  with only that file + the `00-architecture/` folder.
