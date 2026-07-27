# CLAUDE.md — Hardware Fabrication ERP (uPVC SaaS Engine)

> Working notes for AI/devs on this codebase. Edit freely.

## What this is

A B2B SaaS backend for fabricating aluminium/uPVC hardware (windows, doors, partitions).
Core flow: pick a **design**, enter **width × height**, the engine computes geometry →
cut pieces → BOM → cutting plan → pricing → printable documents (Work Order, Cutting List,
BOM, Price Summary).

The fabrication engine is **already calibrated** against real reference jobs: Quotila 85/88/90
(casement + single door), Jobs 44/48 "Andrei UK" (sliding patio — these superseded the earlier
Job 104 yogi-test calibration) and Job 00000264 (French door).
`npm run validate` currently runs **950 assertions** (947 green + 3 pre-existing DB weld-drift
failures — see memory/validate-weld-drift.md; they are not a regression signal).

## Tech stack (confirmed with the owner)

- **Language/Runtime:** TypeScript on Node.js (ESM, run via `tsx`).
- **Web:** Express 4.
- **DB:** PostgreSQL via **Prisma**.
- Do **not** change the stack without asking the owner.

## Architecture — the one rule that matters

**The engine is pure; the catalog is the only data seam.**

- Engine modules in `src/engine/*` (`topology`, `bars`, `hardware`, `cutting`, `pricing`,
  `svg`, `documents`) are pure functions: they receive a `ProfileSystem` + `Design` object and
  return results. They never read files, env, or the DB. **Don't add I/O to them.**
- The catalog (profile systems, deduction face-widths, sash overlaps, glass rebates,
  reinforcement map, hardware, designs, settings) is loaded from **PostgreSQL** once at startup
  by `src/catalog/loader.ts#loadCatalog()` into an in-memory cache, then served through the
  synchronous accessors re-exported by `src/catalog/index.ts`
  (`getSystem`, `getDesign`, `listSystems`, `listDesigns`, `DEFAULT_SETTINGS`).
- `solve()` (`src/engine/solve.ts`) stays synchronous. Any new entrypoint must
  `await loadCatalog()` during bootstrap **before** calling `solve()`
  (see `src/api/server.ts` and `src/validation/jobs.ts`).

### Data model (Prisma → in-memory)

`prisma/schema.prisma` mirrors `src/types.ts`. Nested `Record<string, …>` maps are stored as
relational tables keyed by their record key (`partKey`):

- `profile_system` → frames/sashes/transoms/beads/reinforcement live in one `profile_part`
  table discriminated by `kind` (specialised columns are nullable).
- `glass`, `gasket`, `hardware`, `reinforcement_map`, `design` (topology as JSONB), `setting`.
- Money/measurements are `Decimal` in the DB; the loader converts them to plain `number` so
  engine math is byte-identical to the old hardcoded catalog.

### Source of truth for the catalog

The hardcoded TypeScript catalog is **retained as the seed source**:
`src/catalog/system-sunnyplast.ts`, `src/catalog/designs.ts`, `src/catalog/settings.ts`.
`prisma/seed.ts` copies it into Postgres (idempotent upserts in one transaction).
When you add/correct catalog data, update the seed (and/or the DB) — never hardcode values in
the engine.

## Golden rule (fabrication accuracy is non-negotiable)

**Never guess a formula, cutting rule, or bend/weld allowance.** Derive them from the master
reference `collections/docs/HAWDWARE_PLANER(MAIN DOCUMENT).pdf`, or from a validated Quotila
job. Every deduction in the catalog has a calibration comment citing its source. If a value is
uncertain, say so and reference the master document.

## Running it

Prereqs: a PostgreSQL reachable via `DATABASE_URL` (copy `.env.example` → `.env`).

```bash
# 1. Start Postgres + MinIO (Docker path, for your machine):
npm run db:up            # docker compose up -d  (postgres:16 on :5432, MinIO on :9000/:9001)

# 2. Apply schema + generate client:
npm run prisma:migrate   # prisma migrate dev
npm run prisma:generate  # (migrate already does this)

# 3. Seed catalog + products + 503 designs + admin user:
npm run db:seed          # prints the seeded admin email/password

# 4. Prove the engine is intact (baseline: ~481 passed, 3 pre-existing weld-drift
#    failures — see memory/validate-weld-drift.md; price assertions SKIP until step 4b):
npm run validate         # geometry + custom-mode + extractor + pricing + svg + supplier-price

# 4b. (M5.5) Import the supplier price lists → catalog cost/price + 1P/2P tiers + provenance:
npm run import:prices    # prints applied / flags / recorded-only / still-unpriced report
npm run validate         # re-run: the gated supplier-price assertions now execute & pass

# 5. Run the API:
npm start                # http://localhost:3005  (or PORT from .env)
```

Behind a transaction-mode pooler (PgBouncer on :5433) use `npx prisma migrate deploy` instead of
`prisma migrate dev` (no shadow DB); the M5.5 migrations ship as plain SQL for exactly this.

No Docker? Any local/remote Postgres works — point `DATABASE_URL` at it and run steps 2–5.
The catalog seed avoids interactive transactions, so `npm run db:seed` works **through a pooler**
(PgBouncer, often on :5433) too. PDF export needs S3-compatible object storage — set the `MINIO_*`
vars in `.env` (local MinIO from `db:up`, or a managed S3/Spaces bucket). If `MINIO_*` is unset the
API still runs; only the PDF routes are disabled.
Default seeded admin (override via `ADMIN_EMAIL`/`ADMIN_PASSWORD`): `admin@local` / `admin123`.

### API endpoints

**Public (driver UI + live preview):**

- `GET  /api/systems` — list profile systems
- `GET  /api/designs` — list the quotable (engine) designs
- `POST /api/quote` — `{ systemId, designId, widthMm, heightMm, mode?, overrides? }` → full `QuoteOutput`.
  `mode:"custom"` + `overrides` (per-profile allowance tweaks) drives the Custom extraction mode.
- `POST /api/quote/document` — `{ which: "workOrder"|"cuttingList"|"bom"|"priceSummary", …quote }` → HTML
- `GET  /api/families` · `GET /api/families/:key` — Designer families + JSON option system (D1)
- `POST /api/line-items/resolve` — **Designer D2**: body = `LineItemDraft` → `ResolvedLineItem`
  (stateless, no persistence; 400 only for a malformed body — an invalid draft resolves with issues).
  **D5:** an optional `views:["internal"|"schematic"]` (body or `?views=`) adds those elevations to
  `geometrySvg`; it is a request option the draft schema strips, so it is never persisted.
  **D8:** an optional `style:"flat"|"realistic"` (body or `?style=`) picks how they are DRAWN —
  also request-only, and never applied to the SVG the documents embed.

**Authenticated (JWT bearer — `Authorization: Bearer <token>`):**

- `POST /api/auth/login` → `{ token, user }`; `GET /api/auth/me`; `POST /api/auth/register` (admin only)
- `GET  /api/products?page&limit` · `GET /api/products/:id` · `GET /api/products/:id/designs?page&limit`
  (paginated gallery; SVG-only designs flagged `quotable:false`)
- `GET  /api/designs/:id` — single design incl. `imageSvg` + `quotable`
- `POST /api/orders` (draft) · `GET /api/orders?page&limit` · `GET /api/orders/:id` ·
  `DELETE /api/orders/:id` (`orders.delete`, scoped OWN/ALL; cascades items/documents)
- `POST /api/orders/:id/items` (rejects non-quotable designs) · `DELETE /api/orders/:id/items/:itemId`
- `POST /api/orders/:id/line-items` · `PUT`/`DELETE …/line-items/:itemId` — **Designer D2** line
  items (draft orders only; drafts MAY persist with error issues — confirm is the gate)
- `PUT  /api/orders/:id/commercials` — **D6** basket: `fittingType`/`fittingPrice`/`surveyPrice`/
  `deliveryCharge`/`discountCode`/`taxRatePct` (draft only). Validates the code (400 with the
  reason if unknown/expired/inactive) and responds with fresh `BasketTotals`.
  `GET /api/orders/:id` carries `basket`; `GET /api/orders?q=&status=` searches/filters and each
  row carries `basketTotal`.
- `GET/POST/PUT/DELETE /api/discounts[/:code]` — **D6** discount codes (`discounts` RBAC module)
- `POST /api/orders/:id/confirm` → generates & persists 7 documents (aggregated across items —
  legacy items and Designer line items together; **422** if any designer item has an error issue);
  freezes the basket onto the order (`basketTotals`, `discountAmount`, `totalPrice`)
- `GET  /api/orders/:id/documents` · `GET /api/orders/:id/documents/:type` (HTML)
- `GET  /api/orders/:id/documents/:type/pdf` — **PDF** (M4); rendered lazily on first hit, then
  cached in object storage (`orders/{id}/{TYPE}.pdf`) and served from cache thereafter
- `GET  /api/settings` · `PUT /api/settings` (admin) — financial settings + company branding
  (companyName / companyAddress / accentColor)
- `POST /api/settings/logo` (admin) — upload the logo as a **raw image body** (`Content-Type: image/*`)
- **Catalog pricing (admin, M5)** — `GET /api/catalog/:systemId` (full priced dump);
  `PUT /api/catalog/:systemId/parts/:kind/:partKey` and `…/glass|gaskets|hardware/:partKey`
  (update `{cost,price,weight}`); `POST …/glass` (add a glass variant);
  `POST …/colours` + `PUT …/colours/:key` (colour/finish + uplift %);
  `POST …/import` (**CSV** `code,cost,price`, matched by part code → `{updated,unmatched}`).
  Every write calls `loadCatalog()` so in-memory pricing refreshes immediately.
- `GET  /api/branding/logo` — **public**; streams the current logo (for browser `<img>` previews)

Documents: `work_order, cutting_list, bom, price_summary, work_planner, dmo, planner_list`.

**Every document embeds a design preview drawn at the *modified* (chosen W×H) dimensions** — the
solved-geometry SVG from `renderSvg()`, passed into the doc renderers as an optional `DocImage[]`
(`{svg, caption}`) param and rendered as a preview band under the header. The engine stays pure (the
SVG is plain data, like `DocBranding`). `solve()`'s 4 docs carry one image (this design at this size);
order-confirm's 7 docs carry **one image per line item** at each item's size. **Omitting the param ⇒
no band, byte-identical to before** (validation doesn't assert doc HTML, so the 147/157 stay green).

## Key files

- `src/types.ts` — the contracts. Keep stable; changing a shape ripples everywhere.
- `src/catalog/loader.ts` — DB → in-memory catalog (the only data seam).
- `src/catalog/index.ts` — public catalog accessors.
- `src/engine/*` — pure fabrication logic (deductions in `bars.ts`/`topology.ts`; Custom mode in
  `overrides.ts`; multi-window merge in `aggregate.ts`; HTML docs in `documents.ts`).
- `src/api/*` — Express routers: `auth.ts`, `products.ts`, `designs.ts`, `orders.ts`, `settings.ts`
  (admin settings + branding/logo), `catalog.ts` (M5 admin pricing CRUD + CSV import), shared
  `http.ts`/`pagination.ts`, `middleware/auth.ts` (JWT). `server.ts` assembles them (+ public
  `GET /api/branding/logo`, `ensureBucket()` at boot, `closeBrowser()` on shutdown).
- `src/services/*` — **all I/O outside the engine** (M4): `storage.ts` (S3/MinIO seam — the only
  object-storage code), `pdf.ts` (Puppeteer shared-browser singleton → `htmlToPdf`). The engine never
  imports these; branding reaches `documents.ts` purely as a `DocBranding` param, and the loader
  resolves the stored logo key → embedded data-URI.
- `prisma/schema.prisma`, `prisma/seed.ts` — persistence + seed. **The catalog seed runs WITHOUT an
  interactive `$transaction`** (plain idempotent upserts) so it survives transaction-mode poolers.
- `src/validation/jobs.ts` — the geometry + pricing safety net (run after ANY engine/catalog change);
  also calls `src/tools/extract-topology.test.ts#validateExtractor`, `src/engine/pricing.test.ts#validatePricing`
  (colour-uplift + M5.5 tier assertions), `src/engine/svg.test.ts#validateSvg`, and
  `src/validation/prices.test.ts#validateSupplierPrices` (M5.5, gated on import),
  `src/engine/limits.test.ts#validateLimits` + `src/catalog/ed-table.test.ts#validateEdTable`
  (manual-migration phase 4), and `src/designer/rules.test.ts#validateRules` +
  `src/designer/options.test.ts#validateOptionSystem` (Designer D1) +
  `src/designer/resolve.test.ts#validateDesigner` (Designer D2, extended in D7 with
  `validateSecondFamily`; both designer DB suites SKIP on a DB that predates the D1 seed) and the
  DB-free `src/designer/basket.test.ts#validateBasket` (D6). Current baseline:
  **947 passed, 3 pre-existing DB weld-drift failures** (see memory/validate-weld-drift.md — not a regression).
- `src/designer/basket.ts` — **the only place order-level money is derived** (D6): items subtotal →
  discount → extras → tax → grand total, pure, with `basket.test.ts` (65 assertions) beside it.
  `src/api/order-basket.ts` is its I/O half (prices an order's items, loads the discount row).
- `src/catalog/families/index.ts` — the family REGISTRY (D7): `FAMILIES` + `buildOptionSystem()` +
  `mergeOptionSystems()`. `prisma/seed.ts` reads this and names no family; a duplicate option key
  with different content THROWS, which is what makes `familyKeys` sharing the only way to share.
- `src/designer/*` — the Designer platform: `option-types.ts` + `line-item-types.ts` (contracts),
  `rules.ts` (JSON rule DSL), `option-integrity.ts` (pure write-time seed validation), and the D2
  resolver — `resolve.ts` (the pipeline), `select.ts` (selection precedence),
  `adapters/cellnode.ts` (+ `adapters/index.ts` registry). **Pure, no I/O** — same rule as the
  engine; the catalog reaches the resolver as a `CatalogSnapshot`. Seed sources are
  `src/catalog/families/*` + `src/catalog/options/*`.
- `web/app/(app)/designer/` + `web/components/designer/*` — the Designer UI: `workspace.tsx`
  (the draft reducer + debounced resolve + the component selection + the D5 view switch/cache),
  `measurements.tsx`, `options.tsx` (scope-aware), `structure.tsx` (D4 tree/actions/history),
  `canvas.tsx` (D4 breadcrumb + selection wiring around the shared `window-designer.tsx`, D5
  `mirrored` pass-through), `controls/*` (display-driven primitives + the tri-state
  `option-row.tsx`), with the draft helpers in `web/lib/designer-draft.ts` and the client-side
  view export in `web/lib/svg-download.ts`. **No option key appears in any of it** — everything
  renders from the option system.
- `src/tools/extract-topology.ts` — M3 SVG→topology extractor (build/seed-time; pure of the engine).
- `src/catalog/derived-topologies.generated.ts` — generated extractor output (DO NOT hand-edit).
- `src/tools/extract-hardware.ts` → `src/catalog/hardware-stock.generated.ts` — D9 stock-list →
  catalog hardware (128 rows, £0, DO NOT hand-edit); `src/catalog/options/hardware-filters.ts`
  derives the pickers' finish/style/hand chips.
- `src/catalog/price-lists/*` — M5.5 verbatim supplier-price transcriptions + `mapping.ts` (see
  "## M5.5"). `src/tools/import-prices.ts` (`npm run import:prices`) applies them + writes provenance.
- `src/validation/prices.test.ts` — gated post-import supplier-price assertions (`validateSupplierPrices`).

## Roadmap (milestones)

- [x] **M1 — Engine on DB.** Catalog persisted in Postgres; engine loads from DB; 132 assertions green.
- [x] **M2 — End-to-end flow + Custom mode.** JWT auth, Orders (multi-item), Products + paginated
      Design gallery (513 designs; 371 quotable after M3), live preview, confirm → 7 persisted documents, plus
      the engine's Custom extraction mode (per-quote allowance overrides). 135 validation assertions
      (132 default + 3 custom) + 24 end-to-end assertions green.
- [x] **M3 — More quotable designs.** Automated SVG→topology extractor
      (`src/tools/extract-topology.ts`) derives `CellNode` topologies **deterministically** from each
      collection design's `imageSvg` (cell-rect transforms + HingePointer apex), validates each through
      the real `solveTopology`/`computeHardware`, and emits `src/catalog/derived-topologies.generated.ts`.
      `prisma/seed.ts#applyDerivedTopologies()` applies it (topology + tier-gated `quotable`) by
      `externalId`. **Quotable designs 10 → 371** (345 casement + 16 single-door, all engine-validated).
      Tilt&Turn (123) is modelled but **gated `quotable:false`** (uncalibrated); French (12) was T2-gated
      at M3 but is **now calibrated & quotable** (see "## French Door"); Sliding (7) was deferred at M3
      but is **now calibrated & quotable** (see "## Sliding Patio").
      147 validation assertions (135 + 12 extractor) + 12 M3 e2e assertions green.
      See "M3 extractor & calibration tiers" below.
- [x] **M4 — PDF export + branding.** The 7 HTML docs render to **PDF via Puppeteer** (headless
      Chromium), generated **lazily on first request** and **cached in S3-compatible object storage
      (MinIO)** under deterministic key `orders/{id}/{TYPE}.pdf` — confirm stays HTML-only/fast and the
      cached PDF never goes stale (confirmed orders are immutable; key-existence IS the cache).
      **Global company branding** (logo + name + address + accent colour) lives on the single `Setting`
      row; the loader resolves the logo's object key into an embedded data-URI so docs/PDFs are
      self-contained. All new I/O is in `src/services/*` — the engine stays pure (branding is a
      `DocBranding` param). **Redis still deferred** (lazy + cache needs no queue). Also fixed: the
      catalog seed's interactive-transaction P2028 against a pooler (now plain upserts). 147 validation
      assertions stay green (no engine-math change). See "M4 — PDF + branding" below.
- [x] **M5 — Pricing data + options.** The catalog still ships cost/price = 0 (no guessed supplier
      numbers — golden rule); instead M5 adds the **mechanism** to fill them: an admin **catalog CRUD
      + CSV price import** (`src/api/catalog.ts`, admin-only, `loadCatalog()` after every write).
      Plus a **colour/finish** catalog entity (`ColourOption`) that applies a **% uplift to visible
      profile lines** (frame/sash/transom/bead — NOT reinforcement/glass/gaskets/hardware) at pricing
      time; base **White = 0%** so default quotes stay byte-identical and the 147 assertions stay green
      (+10 new colour-uplift assertions in `src/engine/pricing.test.ts`). Glass **variants** are added
      via the CRUD (the schema already allows unlimited glass rows). Colour/glass **selection** stays
      design-baked (default colour = system `defaultColourKey`); per-quote selection is deferred to the
      Phase 2 configurator UI. `Order.totalPrice` is now snapshotted at confirm. See "M5 — Pricing".
- [ ] **M6 — More profile systems** (Veka, Rehau, …) and bay/bow products (needs the ED table below).

*Phase 2 — UI frontend (Next.js; the Express API stays the single backend/engine host). Build one
sub-milestone at a time. Full breakdown in "## Phase 2 — UI frontend" below.*

- [x] **U0 — Scaffold + API seam.** New `web/` Next.js app (App Router, TS, Tailwind); typed API
      client + BFF route handlers proxying to `EXPRESS_API_BASE`; JWT in an httpOnly cookie. `src/*`
      untouched. See "Phase 2 — U0" below.
- [x] **U1 — Auth + app shell.** Login page, protected `(app)` layout (server-side auth guard →
      redirect to `/login`), top nav with current user + logout, admin-only nav gated by role
      (route also server-guarded). Section stubs (Products/Quote/Orders/Admin) keep the nav navigable
      until U2–U5. `src/*` untouched. See "Phase 2 — U1" below.
- [x] **U2 — Product & design gallery.** Paginated product list (`/products`) + per-product design
      gallery (`/products/[id]`) with **inline SVG previews** and **quotable/preview-only badges**,
      link-based pagination. Server-Component fetches via the cookie-bearer seam; `src/*` untouched.
      See "Phase 2 — U2" below.
- [x] **U3 — Quote configurator + live preview.** `/quote` (deep-linked from quotable gallery cards):
      system/W×H/glass/colour selectors, **debounced** `POST /api/quote`, live SVG + price breakdown.
      Introduces per-quote **glass/colour selection** — adds optional `glassKey`/`colourKey` to
      `QuoteInput`/`solve()` (clone-on-override, **byte-identical when omitted** so the 157 assertions
      hold) + a read-only `GET /api/systems/:id/options`. See "Phase 2 — U3" below.
- [x] **U4 — Orders.** `/orders` list (status/items/`totalPrice`) + `/orders/[id]` detail: add items
      (via the configurator's "Add to order"), remove, confirm → the 7 documents with **View HTML +
      PDF** links (streamed through the BFF). See "Phase 2 — U4" below.
- [x] **U5 — Admin console.** `/admin` hub → `/admin/settings` (financial + branding + **logo upload**)
      and `/admin/catalog` (per-row cost/price/weight edit across parts/glass/gaskets/hardware, colour
      uplift add/edit, add glass variant, **CSV price import**). Admin-guarded routes. See "Phase 2 — U5".
- [x] **U6 — Polish.** Loading skeleton (`loading.tsx`), error boundary (`error.tsx`), global
      `not-found.tsx`, empty/unreachable states throughout. Deployment is owner-side (needs the engine +
      Postgres). See "Phase 2 — U3/U4/U5" below.
- [x] **U7 — Visualization & dual-colour.** Three additive, byte-identical-by-default features:
      **(1) inner-joint overlay** (45° mitre corners + T/Z divider markers on the elevation SVG),
      **(2) inside/outside colour** (summed uplift, persisted on the order, shown in docs), and
      **(3) a three.js 3D massing view**. Engine stays pure; pricing.ts untouched. See
      "## U7 — Visualization & dual-colour" below.

*Phase 3 — the schema-driven **Designer** (Task 1, `Spec/01-windows-module/`). Built ALONGSIDE
`/quote`, which stays untouched (owner decision). Phases D1–D7 map to that folder's phase files.*

- [x] **D1 — Option engine (backend foundation).** Product families + the JSON option system as
      DATA: 4 new tables (`product_family`, `option_group`, `option_def`, `option_choice`,
      migration `20260725010000_add_designer_option_system`), the platform contracts in
      `src/designer/option-types.ts`, a pure fail-loud rule-DSL evaluator (`rules.ts`), seed
      sources (`src/catalog/families/casement-window.ts` + `src/catalog/options/windows.ts`),
      loader accessors (`getFamily`/`listFamilies`/`getOptionSystem`) and `src/api/families.ts`
      (public GETs + admin PATCH). **No engine change, no UI** — see "## Designer — D1" below.
- [x] **D2 — Line-item core.** The stateless resolve pipeline + persisted line items: migration
      `20260726010000_add_designer_line_items`, the pure resolver (`src/designer/resolve.ts`,
      `select.ts`, `adapters/cellnode.ts`, `line-item-types.ts`), two additive `QuoteInput` fields
      (`hardwareOverrides`, `topologyOverride`), `src/api/lineitems.ts` (public stateless resolve
      + order-scoped CRUD) and confirm integration. The whole designer now works headlessly over
      HTTP; D3–D5 only add UI. **725 assertions** (691 + 34 new). See "## Designer — D2" below.
- [x] **D3 — Configurator shell.** The `/designer` workspace: a Server-Component route that
      resolves descriptor + option system + design (or a saved draft) and hands the client
      `web/components/designer/workspace.tsx` its initial state. One `useReducer` over the
      `LineItemDraft` is the only writer; a 350 ms debounced `POST /api/line-items/resolve` with
      stale-response discard drives the live canvas, price and issues. Inspector = Measurements
      (descriptor dimensions, split-mode control, generated span inputs, location) + Options
      (schema-driven groups → controls, search, tri-state). ONE additive server field
      (`ResolvedLineItem.geometry`, the solved rects minus the SVG). **725 assertions unchanged.**
      See "## Designer — D3" below.
- [x] **D4 — Component editing.** Always-on component selection: click a part on the drawing (or
      the Structure tree) to scope the inspector to it, answer options per-component with the
      apply-scope the option itself declares, run the seeded instant actions (add transom /
      mullion / midrail, remove divider), convert component types, and undo any structural edit
      from a history list. ONE additive server field (`ResolvedLineItem.components`) plus a
      two-pass selection resolve (a conversion changes which components exist). **738 assertions**
      (725 + 13 new). See "## Designer — D4" below.
- [x] **D5 — Views & preview.** The canvas view switch is complete: **External | Internal |
      Schematic | 3D**. Two additive `renderSvg` options (`view:"internal"` — one horizontal
      mirror + a stylised handle glyph; `schematic` — technical style + an annotation layer whose
      every number is read off an already-solved rect), an additive `QuoteInput.views` →
      `QuoteOutput.geometry.svgViews`, a per-REQUEST `views` option on the resolver/API (never
      persisted on a draft), mirrored canvas hit-testing, per-view caching and an SVG/PNG
      download. **775 assertions** (738 + 37 new). See "## Designer — D5" below.
- [x] **D6 — Basket & orders (commercial layer).** Fitting / survey / delivery / discount codes /
      per-order VAT on top of the engine's price, derived in ONE pure function
      (`src/designer/basket.ts`) that the API, the orders UI and the Price Summary all call — so no
      two surfaces can disagree. Migration `20260726020000_add_basket_commercials`,
      `PUT /api/orders/:id/commercials`, `/api/discounts` CRUD (its own RBAC module), an additive
      `DocBasket` document block (omitted ⇒ byte-identical), and the orders UI's pricing card +
      live totals ledger. **862 assertions** (775 + 65 basket + 22 second-family). See
      "## Designer — D6" below.
- [x] **D8 — Presentation pass.** An opt-in **realistic** render style (bevelled mitred profile
      faces, moulded bead, glazed glass, procedural woodgrain, soft shadow) used by the Designer
      canvas and `/quote` only — documents and the seeded gallery keep the flat drawing, byte for
      byte. The inspector drops to **two tabs** with progressive disclosure, and the shared UI kit
      gets one elevation scale / one label treatment. **880 assertions** (862 + 18). See
      "## Designer — D8".
- [x] **D9 — Field-report fixes.** Three defects found using the studio on a real job: a
      transom/mullion split **cloned the opening sash** (two sash rings = "2 windows"), the confirm
      gate **422'd on any printed-limit breach** while the legacy `/quote` path printed the same
      oversize job happily, and the handle dropdown had **one** entry because the catalog held one
      casement handle. Splits now divide the frame into fixed lights, printed maxima are advisory
      (and print on the work order), and the owner's real stock list seeds **128** hardware rows
      with finish/style/hand filter chips. A follow-up correction (Job 154) made a divider dropped
      into a sash a MIDRAIL, so the opener survives. **947 assertions.** See "## Designer — D9".
- [x] **D7 — Extensibility proof (`entrance-door`).** A second product family added as pure seed
      data: `src/catalog/families/entrance-door.ts` + `src/catalog/options/doors.ts`, sharing 13
      family-agnostic options through `familyKeys` instead of copying them. **Zero `web/`
      changes** — the audit is `Spec/01-windows-module/phase-7-audit.md`. See "## Designer — D7".

# Phase 2 UI frontend

Stack confirmed: **Next.js**. UI sub-milestones **U0–U6** are tracked in the Roadmap above; full
breakdown in "## Phase 2 — UI frontend (stack confirmed: Next.js)" below.

## Master PDF findings (Sunnyplast Fabrication Manual No. 1, 87pp)

The PDF is a **fabrication manual** (specs/formulas), not document templates. Cross-checked against
the calibrated catalog (`src/catalog/system-sunnyplast.ts`). **No catalog values were changed** —
the calibrated jobs (85/88/90) remain the source of truth and the manual's extra rules are
length-dependent refinements that don't conflict for the validated jobs. Recorded for reconciliation:

- **Authentic profile codes** (catalog currently uses placeholders): Frame 5ch `SPQ-5-10252`
  (✓ matches), Frame 6ch `SPQ-6-10252` (catalog has `SPQ-6-11252` — verify), Transom/Mullion
  `SPQ-05-20252` & `SPQ-005-30252`, **casement Sash `SPQ-05-30252`** (catalog placeholder `SPQ-T-SASH`),
  **Bead `SPQ-1-51252` = 32mm** (catalog placeholder `BEAD-28`). Reconcile codes before going live.
- **Reinforcement is length-dependent** in the manual (engine treats it as binary per profile):
  Frame 5ch/6ch = none (✓ matches catalog); T-transom `SPQ-05-20252` reinforced only **>1.5 m**;
  mullion `SPQ-5-30252` / Z `SPQ-005-30252` reinforced only **>1 m**. Calibrated jobs use long
  members so the binary rule happens to match; short members may be over-reinforced. Future refinement.
- **External Deduction (ED) table** by corner angle for bay/bow assemblies — **now imported
  verbatim** as `src/catalog/ed-table.ts` (91 rows, 90°=63.2 → 180°=40.85, HAWDIO PDF 42; the page
  carries no printed number). Data-only, no consumer until M6 (engine is 90°-rectangular today).
  **Never interpolate** — the step changes three times (0.22 → 0.24 → 0.29 per degree), so
  `edForAngle()` returns `undefined` for unlisted angles rather than inventing one. Three print
  defects recorded, not corrected (stray `°` in the ED column at 129°/156°; 135° prints 53.2 where
  the run implies 53.18). Integrity assertions in `ed-table.test.ts`.
- **Clear-opening (door) formulas** — SUPERSEDED by the re-issued manual
  (`collections/docs/HAWDIO 21-7-2026.pdf`, printed p40 / PDF 41; verified against the page
  2026-07-25). The old edition's `W − (X1 + 40) − (SW + 44.5)` is off by 60 mm — do NOT use it.
  Current formulas: between transoms `W − ((X1÷2) + 50) − (SW + 76.5)`; between transom & outer
  frame, and between outer frame (both): `W − (X1 + 70) − (SW + 74.5)`. Companion X2-variant page
  printed p39 / PDF 40. **Not yet implemented anywhere in code** (documentation-only — verified by
  inventory, Spec/02-manual-migration/phase-1); if a clear-opening figure is ever computed/printed,
  encode these with a `// HAWDIO p40 (PDF 41)` citation.
- **Per-product glass-deduction tables** (Casement, Tilt&Turn, French, Residential Door, …) give
  authoritative glass sizes; they differ by frame chamber (5ch vs 6ch). Use these to extend glass
  sizing beyond the 3 calibrated jobs.

### Size & weight limits (2026-07-25, Spec/02-manual-migration phase-4)

`src/engine/limits.ts` (pure, no I/O, **advisory only — feeds no cut math**) imports the manual's
never-used rule data, all cited to HAWDIO p70/p71 (PDF 72/73):

- `SIZE_LIMITS` — the 10 printed max sash/frame sizes + weights (casement top/side hung, T&T,
  flush sash, resurgence, residential + French door, fixed). Rows for families we don't model
  carry an empty `sashKinds`; **sliding has no row on p70 and must stay unmapped**.
- `sashWeightKg()` / `glazingWeightPerM2()` — `Σ GLASS pane thicknesses × 2.5 kg/m² × w(m) × h(m)`
  (spacer excluded). Self-verifying: all 10 printed max weights reproduce from their printed max
  sizes on the 4-20-4 basis (20 kg/m²) to 1 d.p. — asserted in `limits.test.ts`.
- `checkSizeLimits(geometry)` → `LimitIssue[]`: warning when a sash exceeds a printed max but is
  within the **10% rule**, error beyond +10% or when overweight; also whole-unit and
  1.8m transom/mullion checks. Returns `[]` for families with no printed row (never invents one).
  `paneThicknessesMm: []` ⇒ skip the weight check rather than guess a make-up.
- `wedgeCount()` and `TRICKLE_VENT` are **reference data with no consumer** — the wedge part code
  is a literal "( REQ CODE )" placeholder in the manual (supplier query Q-J), so no BOM line is
  emitted; surfacing vent/drainage data on documents is gated on Spec/questions.md Q16.

`POST /api/quote` returns an **additive** `limitIssues[]` alongside the unchanged quote; it never
blocks a quote. `solve()` and every document renderer are untouched.

### Manual-migration catalog additions (2026-07-25, Spec/02-manual-migration phase-2)

The re-issued manual (`HAWDIO 21-7-2026.pdf`) added parts the catalog lacked. They are seeded as
**inert catalog data**: £0, page-cited, referenced by **no design**, absent from
`reinforcementMap`, and never emitted by any cut rule — so every quote stays byte-identical. Do
**not** wire any of them into topology defaults without a deduction source or calibrated job.

| Part key | Code | What / cite |
|---|---|---|
| `mullion-75` | SPQ-050-30252 | "T" Mullion 70mm, face 75 — p11/PDF 12. No deduction set exists for it yet. |
| `reinf-35x15` | SPQ-2-83997 | 35×15 box steel — p17/PDF 18. Likely the cill-95 alternative (p12); unmapped. |
| `reinf-25x10` | SPQ-2-83998 | 25×10 box steel — p17/PDF 18. Likely the frame-extension steel (p13); unmapped. |
| `aux-ext-25`, `aux-coupling-frame` | SPQ-2-75252, SPQ-2-72252 | Add-ons (frame extension + coupling) — p13/PDF 14. No calibrated cut rule (Spec/questions.md Q6). |
| `aux-bay-corner-square`, `aux-bay-pole`, `aux-coupling-70`, `aux-bay-corner-post` | SPQ-2-63252, -61252, -76252, -74252 | Bay/bow prep for M6 — p14/PDF 15. |
| `hw-fricthinge-90` | FH-90DEG | 90° friction stay, 13.5mm stack — p7/PDF 8. Code synthesized; **no `lengthMm`** so `pickFrictionHinge()` cannot select it. |

Two findings from that phase corrected earlier records: the **sliding frame face 48 is correct**
(the manual's 84 is section depth, not sightline — see the Sliding Patio section), and the
**weld allowance comes from the calibrated jobs, not any manual** (now cited in
`src/catalog/settings.ts`).

## M3 extractor & calibration tiers

The collection SVGs **encode** structure (they are not just pictures), so topologies are _derived_,
not guessed (golden rule). In each `<g layertype="Diagram">`: a `Sightline_component` per cell
(`translate`+path-bbox = the cell daylight rect) and a `Sash_component` per _opening_ cell; in
`<g layertype="HingePointers">` a triangle per opening cell whose **apex** points to the hinge edge.
Drawing constants (SVG render units, NOT engine values): frame/divider face = 70, sash overlap = 28,
so a cell's rebate footprint = fixed→daylight, sash→sash-outer inset 28; adjacent rebate rects abut
across a ~70 gap whose centre is the divider line. Grid is rebuilt by recursive guillotine cuts;
`splitAtRatio = cutCentre / canvasDim` (a full-window fraction, matching the engine). Non-guillotine
layouts are **rejected**, never guessed.

**Regenerate:** `npx tsx src/tools/extract-topology.ts` → rewrites
`src/catalog/derived-topologies.generated.ts`; then `npm run db:seed` applies it. Deterministic.

**Calibration tiers** (only families with a validated job become production-quotable):

- **T1 quotable** — Casement (345) + Single Door (16): use existing calibrated profiles; each is
  validated through the real engine + leaf-count == `quantityOfSquares` before `quotable=true`.
- **T1 quotable (NEW)** — French Door (12): **now calibrated & quotable** from 5 real Windowmaker
  production docs ("Job 00000264", `docs/french-door/`). The old T2 zero-profile `meeting-stile`
  model is replaced by the real **STULP French mullion** (`french-mullion`, jointType "S") +
  `french-door-master`/`-slave` leaves. See the dedicated "## French Door" section.
- **T3 geometry-OK, gated false** — Tilt&Turn (123): geometry == casement sash (reuses `sash-t`);
  the `tilt-turn` content + T&T gear in `hardware.ts`/catalog are **uncalibrated** (no T&T job).
- **T1 quotable (NEW)** — Sliding Patio (7): **calibrated and quotable**, originally from the
  Job 104 (yogi test) docs, **re-calibrated 2026-07-04 from Jobs 44/48 "Andrei UK"**
  (`patio-docs/`, which supersede Job 104). See the dedicated **"## Sliding Patio"** section
  below for the full derivation. The 7 designs (OX, XO,
  OXO×2, OOX, XOO, OXXO) are **hand-authored** (`src/catalog/sliding-designs.ts`, applied by
  `prisma/seed.ts#applySlidingTopologies()` by `externalId`), NOT extracted — the extractor still
  hard-rejects sliding (its `HingePointers` encode travel direction, not a hinge edge, so the
  extractor would mis-map them; hand-authoring sidesteps that). A sliding patio is a **frame + n
  framed panels + beads + 2 reinforcements** — no transom/mullion/interlock profile in the cut list
  — so it needed **only** a new `kind:"sliding"` topology node + SashKind/hardware/SVG cases;
  `bars.ts`/`cutting.ts`/`pricing.ts`/`documents.ts`/`solve.ts` were untouched. 3 new validation
  jobs (OX/OXO/OXXO) reproduce the cutting lists to ≤0.6mm (Gasket 02 exact).

Casement/door **engine designs** (the 10 hand-authored `win-*`/`door-*` in `src/catalog/designs.ts`)
have a topology but no source image; `prisma/seed.ts` now renders a deterministic gallery `imageSvg`
for each from its topology via the pure quote path (`solveTopology` → `renderSvg`, preview-only
dimensions) so they aren't imageless in the UI — no engine math changes, assertions unaffected.

Caveats (flagged, not silently assumed): T-vs-Z transom is not encoded in the SVG → default
`transom-t-67`; `transom-z-67` only for the root top-hung-over-fixed pattern (mirrors Job 85).
To promote a gated tier: add a calibrated reference job + assertion, then flip the tier's gate —
never relax the gate alone.

## M4 — PDF + branding

**Object storage (`src/services/storage.ts`)** is the only seam to S3-compatible storage (MinIO in
dev; AWS S3 / DO Spaces in prod via the same `@aws-sdk/client-s3` code — just change `MINIO_*`).
Deterministic keys mean *existence == cached*: `orders/{orderId}/{TYPE}.pdf`, `branding/logo`.

**PDF (`src/services/pdf.ts`)** wraps Puppeteer with a lazily-launched, reused browser singleton
(`--no-sandbox`); `htmlToPdf(html)` → A4 PDF buffer. The stored `Document.html` is already a full
print-ready doc, so PDF is a direct conversion. `GET …/documents/:type/pdf` checks the cache key,
renders + stores on miss, streams on hit. Confirmed orders are immutable, so cached PDFs never go
stale. **Redis is intentionally not used** — lazy render + object cache needs no queue (revisit only
if PDF latency forces background rendering).

**Branding** is global, on the single `Setting` row (`companyName`, `companyAddress`, `accentColor`,
`logoKey`). The **catalog loader** resolves `logoKey` → an embedded base64 data-URI in
`DEFAULT_SETTINGS.branding` (storage being down is non-fatal — the logo is just omitted). The engine
stays pure: `documents.ts` takes an optional `DocBranding` param (absent ⇒ the pre-M4 plain header,
byte-for-byte). `solve()` passes `settings.branding`; order-confirm passes it too, so branding is
baked into the snapshot HTML (and thus the PDF). Admin endpoints: `GET/PUT /api/settings`,
`POST /api/settings/logo` (raw image body) — both call `loadCatalog()` to refresh in-memory branding;
public `GET /api/branding/logo`.

**Seed/pooler fix:** `prisma/seed.ts` no longer wraps the catalog in an interactive `$transaction`
(plain idempotent upserts), which fixed P2028 against a transaction-mode pooler on :5433. Regenerate
the Prisma client after the `add_branding_to_settings` migration.

**Caveats:** branding is baked at confirm-time, so orders confirmed before a logo/branding was set
show the plain header until re-confirmed (acceptable — confirmed orders are immutable snapshots).
Puppeteer bundles Chromium (~300 MB) and needs a few shared libs under WSL/Docker.

## M5 — Pricing data + options

**The catalog still ships cost/price = 0** — I never commit guessed supplier numbers (golden rule).
M5 instead builds the **editing surface** so the owner fills real prices, plus a colour-upcharge model.

- **Admin catalog CRUD (`src/api/catalog.ts`, admin-only).** Mirrors the `settings.ts` admin pattern
  (requireAuth+requireAdmin, zod-validated, `loadCatalog()` after every write so the engine sees new
  prices at once). `GET /api/catalog/:systemId` serves the in-memory `getSystem()` dump (numbers, keyed
  by partKey). `PUT …/parts/:kind/:partKey` + `…/{glass,gaskets,hardware}/:partKey` patch
  `{cost,price,weight}`. `POST …/glass` adds a glass **variant**. **CSV import** `POST …/import`
  (`Content-Type: text/csv`, header `code,cost,price`) matches each row by **part code** across
  profile_part/glass/gasket/hardware in one `$transaction`, returns `{updated, unmatched[]}`.
- **Colour / finish (`ColourOption`).** New catalog entity (`colour_option` table → `system.colours`
  Record; `profile_system.defaultColourKey` picks the active one). `computePricing()` applies the active
  colour's **% uplift** (`costUpliftPct`/`priceUpliftPct`) to **colour-bearing** lines only —
  frame/sash/transom/bead via `isColourBearingCode()`; reinforcement (internal steel), glass, gaskets
  and hardware are untouched. **Base White = 0% uplift**, so a default-colour quote is byte-identical to
  pre-M5 → the 147 geometry assertions stay green. The engine stays **pure**: colour is plain data on
  `ProfileSystem`, no I/O. `src/engine/pricing.test.ts#validatePricing(expect)` (wired into
  `npm run validate`, DB-free, synthetic prices) proves the uplift math (10 assertions).
- **Selection is still design-baked** in M5 (colour = system default; glass = the design's `glassKey`).
  Per-quote glass/colour selection (extending `solve()`/`/api/quote`) is intentionally deferred to the
  **Phase 2 configurator UI** (sub-milestone U3).
- **`Order.totalPrice`** is snapshotted at confirm (`agg.pricing.totals.grandTotal`) so the orders list
  shows a total without re-solving. Migration: `20260627010000_add_colour_options`
  (`colour_option` table + `profile_system.defaultColourKey` + `order.totalPrice`).

**Caveat:** quotes read **zero prices until the owner enters them** via the CRUD/CSV; only White (0%)
ships seeded. Colour upcharge is a flat % on profiles — per-metre/per-component pricing is a future
refinement. **M5.5 (below) now imports real supplier prices + per-profile colour tiers.**

## M5.5 — Supplier price-list import

Integrates the 4 real Sunny Plast PDFs in `docs/price_list/` (ANGLIA profiles, Cills, Panels, Sliding
System) into pricing. Three layers keep the engine pure and the numbers auditable:

1. **Transcription (source of truth).** `src/catalog/price-lists/*.ts` — every PDF line transcribed
   VERBATIM with a per-line `source` citation (golden rule; same convention as the calibration
   comments). `doc-a-…` (profiles + cills, 3 colour tiers), `doc-b-…` (cill volume tiers),
   `doc-c-panels`, `doc-d-sliding` + `mapping.ts` (explicit supplier-code → catalog `(table,kind,
   partKey)` wiring, with a `note`/`flag` on every alias/derivation) + `index.ts`.
2. **Provenance (audit).** New tables `supplier` / `price_document` / `price_item` (migration
   `20260709010000_add_price_provenance`) record **every** extracted price — mapped or not — with
   source file, effective date, unit, colour tier, pack qty, and the mapping outcome written back.
3. **Runtime read model.** Existing catalog cost/price columns + new nullable `cost1p/price1p/cost2p/
   price2p` on `profile_part` (migration `20260709020000_add_profile_tier_prices`).

**Apply:** `npm run import:prices` (`src/tools/import-prices.ts`) — deterministic, idempotent, applies
**by partKey** (never fuzzy code, so duplicate-code rows like frame-6ch/frame-french and
transom-z-67/midrail-67 are BOTH priced), then prints a mismatch report (applied / flags /
recorded-only / still-unpriced). The seed never writes prices; the M5 CSV endpoint stays for ad-hoc edits
(its duplicate-code last-wins bug is fixed — it now updates all rows sharing a code).

**Owner decisions:** cost = price = supplier nett (settings markup/wastage/VAT produce sell); per-profile
colour tiers (colour one side ⇒ 1P, both ⇒ 2P; **White byte-identical**); cills cost = Doc A £/m, price =
Doc B "Normal" ÷ 6 m; **panels = glass rows** (per m², via existing `glassKey`).

**Tier-aware pricing (engine stays pure).** `ProfileSection.tierPrices` (loader attaches it only when a
tier column is set) + `ColourOption.tier`. `pricing.ts` resolves the tier (explicit on the dual-colour
combined option set by `solve.ts`, else derived: any non-base single colour ⇒ 2P) and uses the supplier
tier price VERBATIM when the colour-bearing part has one; otherwise falls back to base × the colour
%-uplift (so parts without a tier price, e.g. 1P beads, and %-only colours keep working). White/default
⇒ no tier ⇒ the exact pre-M5.5 path ⇒ byte-identical (the 267 assertions hold).

**Codes reconciled** (placeholder → authentic, in `system-sunnyplast.ts` + asserted in `jobs.ts`):
`sash-t` SPQ-T-SASH→**SPQ-05-30252**; `sash-door-z` SPQ-DOOR-Z→**SPQ-5-45252**; `bead-28`
BEAD-28→**SPQ-1-51252**; sliding hardware `SL-*`→**GLIS-*** + new `hw-patio-cylinder` (GLIS-12, so
sliding doesn't reuse the door brass cylinder's price). Seed **cill-overwrite bug fixed** (cill prices now
preserved on reseed) and **stale reinforcement_map rows cleaned** (old placeholder keys dropped).

**Validation.** `prices.test.ts#validateSupplierPrices` (wired into `npm run validate`) is **GATED** — it
SKIPS until prices are imported (frame-5ch.cost === 0) so validate stays green on a fresh DB; after import
it asserts catalog == transcription, White/1P/2P quote lines match the list £/m, cills, panels, sliding
hardware, and that unpriced items (glass units, gaskets, casement/door hardware) stay exactly £0 (nothing
guessed). `pricing.test.ts` adds ~10 DB-free tier assertions.

**Missing data (never guessed, all £0 or recorded-only):** glazed units, gaskets, all casement/door/T&T/
French hardware, casement/door steels, aux caps GLIS16/17; open flags — sliding bead SPQ-1-51252 vs Doc D
SPQ-3-51252, bead-32 code 52253 vs 52252, steel aliases, GLIS 04 pack-of-2, GLIS 10+11 summed lock&keep.
Full list in `memory/supplier-price-lists.md` and the import report.

**Runbook** (pooler on :5433 ⇒ `migrate deploy`, not `migrate dev`):
`npx prisma migrate deploy` → `npm run db:seed` → `npm run validate` (price checks SKIP) →
`npm run import:prices` → `npm run validate` (all green) → restart API.

## Sliding Patio

The third quotable family (after Casement + Single Door). **Re-calibrated 2026-07-04** from
**2 real production saw-cut docs** in `patio-docs/` — **Job 44 "test uk Andrei londra"
(1900×2100)** and **Job 48 "Andrei Uk nr 2" (2210×2310)**, both 2-panel (slider left + fixed;
Windowmaker "Dimensiuni de debitare detaliate"). These **SUPERSEDE the original Job 104
(yogi test) calibration** (owner confirmed): the yogi docs disagreed on panel envelope
(H−79 vs H−86; (W+3)/n−6 vs (W+10)/n−6) and steel (Int−10 vs Int+30). The engine now
reproduces **every row of both Andrei docs exactly** (saw + finished sizes, quantities, steel,
aux profiles, glass). The 7 DB designs (product `73679b0a-…`) are **OX, XO, OXO Slide
Left/Right, OOX, XOO, OXXO** — all `quotable=true`.

**Structure.** A sliding patio is the *simplest* family: an outer frame (4 mitred bars) + **n
equal-width framed panels** (each a 4-bar mitred rectangle — fixed and sliding panels are cut
**identically**, only hardware differs) + beads + 2 reinforcements + glass + **auxiliary
profiles** (slide track + cover caps — see below). **No transom, no mullion, no Z-break, and no
separate interlock profile in the cut list.**

**Calibrated constants (exact on both Andrei docs; finished sizes — printed saw sizes add
3 mm/end weld on the mitred frame/sash cuts only, per-profile `weldAllowanceMm: 3`, same
convention as the French docs):**
- Frame `SPQ-GL-10252` ("Rama pentru glisare 48mm") face **48**: Hor Ext=W Int=W−96; Vert Ext=H
  Int=H−96; mitred `\ - /`, continuous jambs. (Manual cross-check 2026-07-25: the HAWDIO profile
  portfolio p15/PDF 16 draws the section 84 × 48 — the **84 is the front-to-back track depth**,
  NOT the sightline; assembly sections p29–32 confirm 48 is the elevation face. Face 48 is
  correct.) Sash `SPQ-GL-20252` ("Canat pentru glisare 85mm")
  face **85**. Bead `SPQ-1-51252` ("Bagheta ptr.24mm", `bead-sl-24`) face 20. Glass rebate **15**
  (glass = beadInt + 30: 809×1874 / 964×2084). All authentic codes (old `SPQ-SL-*` placeholders
  are gone).
- **Panel width Ext:** bypass (OX/XO/OXO/OOX/XOO) = `(W+10)/n − 6` *(exact for n=2 — 949/1104;
  n=3 is the same formula EXTENDED, no 3-panel Andrei doc yet)*; centre-meeting (OXXO) =
  `(W+79)/4 − 6` *(still the old Job 104 single data point — UNCALIBRATED against the new
  settings; needs an Andrei-era OXXO doc)*. Panel height Ext = **H − 86** (2014/2224).
- Sash Int = Ext − 170; Bead Int = sash Int, Ext = Int+40 (the docs mark beads 45/45 mitre but
  the length carries no weld add; engine prints square `[ - ]`, cosmetic).
- **Reinforcement = bar Int + 30** (steel runs 15mm past Int per end): catalog
  `endClearance = −15` on `reinf-44x12` (frame steel, code `AO44X12`) and `reinf-25x27-u`
  (sash steel, code `AU26X26`) — casement/door keep `endClearance=0`, byte-identical.
  Verified on all 8 steel rows (1834/2034, 809/1874, 2144/2244, 964/2084).
- **Auxiliary profiles** (new `AUXILIARY` PartKind + `ProfileSystem.auxiliaries`; lengths in
  `bars.ts#emitSlidingAuxBars`, all square-cut): track `AD16014` = W−95; channel cap `GLIS17` =
  H−95; slide cap `SPQ-GL-10253` = H−96 ×1 + (W−45) ×2; sash cap `SPQ-GL-20253` = panelExtH−2
  per panel; `AD55142`/`GLIS16` = panelExtW−99 **per FIXED panel**. Per-fixed-panel counts and
  the ×2 W−45 pieces are derived from 2-panel docs only — re-verify on a 3/4-panel doc.
- Gasket 02 = Σ glass perimeter (the casement rule; the Andrei docs list no gaskets — rule
  retained from Job 104 where it was exact).
- Hardware (unchanged from Job 104 — the Andrei docs list no hardware): per **fixed** panel 7×
  Fixed Panel Support; per **sliding** panel 1× handle, 1× cylinder, 1× lock&keep, **2× roller**,
  1× stopper, 1× top + 1× bottom brush. **Approximate/flagged**: Bridge Packer, Glazing Bridge
  Packer, Woolpile.

**How it's wired (engine stays pure).** `kind:"sliding"` `CellNode` variant (`src/types.ts`) +
`buildSlidingPanels()` in `topology.ts` emit one `SolvedCell` per panel (explicit `sashOuter`/
`sashInner`/`glassRect`/`beadInt`); `bars.ts` additionally runs `emitSlidingAuxBars()` (no-op
unless sliding cells + `system.auxiliaries` exist — other families byte-identical). Aux parts
price per metre via `pricing.ts#findProfileByCode` but are **not colour-bearing**. SashKinds
`sliding-fixed`/`sliding-slide-left`/`sliding-slide-right`, a hardware branch (`hardware.ts`),
SVG slide arrows (`svg.ts`). Topologies are hand-authored in `src/catalog/sliding-designs.ts`
(pin `beadKey:"bead-sl-24"` — NB the loader orders parts by partKey, so any non-default bead key
must sort AFTER `bead-28` or it hijacks the default-bead pick) and applied by `externalId` in
`prisma/seed.ts#applySlidingTopologies()`. The extractor (`extract-topology.ts`) still rejects
sliding. **Seed caveat:** the seed never overwrites `weldAllowanceMm`/cost/price/weight
(owner-editable) — pre-existing DBs needed a one-off `weldAllowanceMm=3` fix on
`frame-sliding`/`sash-sliding` (applied to the current DB 2026-07-04).

**Per-design default dimensions.** New nullable `design.defaultWidthMm/defaultHeightMm` columns
(migration `…_add_design_default_dimensions`) replace the old hardcoded **1200×1200**. Surfaced by
the loader, `GET /api/designs/:id`, and the web configurator (preloads W×H, still editable). Sliding
defaults from the work orders: 2-panel 1500×1750, 3-panel 2000×1750, OXXO 2600×1750. `previewDimsFor()`
in the seed now honours a design's own defaults for the gallery preview.

**Validation.** 5 sliding jobs in `src/validation/jobs.ts`: `JOB_44_ANDREI`/`JOB_48_ANDREI`
(**doc-exact** — every PDF row incl. steel + aux profiles + glass) and `JOB_SL_OX`/`OXO`/`OXXO`
(the old yogi sizes recomputed as **formula-consistency** jobs under the new constants; OXO also
covers the multi-panel aux rules). `validateSlidingWeld()` asserts the printed saw sizes
(1906/2106/955/2020; bead/steel/aux print unwelded), mirroring `validateFrenchWeld`.
`validate()` searches `parts.bars` **and** `parts.reinforcement`. Existing casement/door/French
assertions stay green (no shared-path change). **OOX/XOO/XO have no dedicated doc** — they reuse
the verified 2-/3-panel cut math (panels are identical width; only slide/handle assignment
differs).

**Drag-to-resize spans (per-panel widths).** Like casement/door transom-drag, the configurator lets
you drag panel boundaries and read each panel's mm width. Panels carry optional per-quote share
fractions `fᵢ` (Σ=1, default `1/n`): the sliding `CellNode` gains `boundaries?: number[]` (n−1
cumulative daylight fractions), written by `solve.ts#applySplitRatios` from `splitRatios` keys
`root.b{i}` (normalised: strictly increasing, min 5% share). `buildSlidingPanels` lays columns out by
fraction and sets `panelExtᵢ = fᵢ·(W+K) − 6` (K=10 bypass / 79 OXXO) — which **reduces exactly to
the equal calibrated formula** when `fᵢ=1/n`, so equal-panel quotes stay byte-identical (validation:
`validateSlidingSpans()` proves equal=749 and a dragged b1=0.40 → 598/900 summing to 1498).
Unequal widths are an **interpolation, flagged uncalibrated** (no unequal-panel reference job). The
UI is `web/components/window-designer.tsx` (a sliding branch: per-panel labels + n−1 boundary
handles); the rest of the `splitRatios` pipeline (live quote → `order_item.splitRatios` → confirm
re-solve → docs) was already wired, so the dragged spans flow into the work order / cutting list.

## French Door

The fourth quotable family (after Casement, Single Door, Sliding Patio), calibrated from **5 real
Windowmaker production docs** in `docs/french-door/` ("Job 00000264", Design 408, all **1700×2100**,
"PR01 70mm Casement Series"): T-sash full-glass, Z-sash with a midrail per leaf (×2 mirrored), and a
mirrored unequal-leaf pair (724/924 printed). All **12 collection French designs are now
`quotable=true`** (extractor-derived, tier promoted), plus 3 hand-authored engine designs
(`door-french`, `door-french-t`, `door-french-midrail` in `src/catalog/designs.ts`).

**Structure.** Two door leaves meet on a **STULP French mullion** (`SPQ-1-46252`, "French Mullion
70mm") — a **square-cut** bar (`[ - ]`, no welded horns) spanning the full daylight height, mounted
on the slave leaf. Each leaf is a normal welded sash ring; optionally a **midrail** ("T/M small" =
`SPQ-005-30252`, the transom-z-67 profile) is **T-welded INSIDE the sash ring** between the
uprights, splitting the glazing into stacked panes — a new engine capability (`CellSpec.midrails`).

**Calibrated constants (all 5 docs reproduce exactly; printed saw sizes = finished + 3 mm/end weld
on mitred/horned cuts — per-profile `weldAllowanceMm: 3` on the French parts):**

- **Frame `frame-french`** = code `SPQ-6-11252`, face **48** ("KASA 70-48" names it; the sliding
  frame independently derived 48). NB Job 90 (Quotila) calibrated the same physical code at face 68
  (`frame-6ch`) — the two doc sources disagree, so French has its **own frame entry**; the door-pair
  cut list is identical under either face (the face only moves drawn daylight + uncalibrated
  fixed-sidelight glass). Printed frame 1706/2106 = W/H + 6.
- **Door sashes** both cut identically with engine face **105**, overlap **20**, glass rebate 15:
  `sash-door-z-fr` (= `SPQ-5-45252`, "85mm KAPI 70-85") and `sash-door-t-fr` (= `SPQ-5-47252`,
  "105mm"). Printed 824/2050 → finished 818/2044 = leafDaylight + 2×20; bead Int = sash − 210.
- **French mullion** face 48, `jointType: "S"` (new): topology lays cells out around it like any
  vsplit mullion, but `Ext == Int == bounds.h` and end prep `[ - ]` (printed 2004 = 2100 − 96, no
  weld add). Leaf daylight = (1604 − 48)/2 = 778 each; unequal docs 2/3 = the same design with the
  stulp centreline at x=750 (verified via `splitRatios`).
- **Midrail `midrail-67`** (own catalog entry, same code `SPQ-005-30252`, face 67, weld 3): Int =
  sash Int (608), Ext = Int + 134 = 742 (printed 748 `<>`). Panes 883.5 high → printed beads 924,
  glass 638×914 (engine 923.5/913.5, ≤0.5 rounding).
- **Bead `bead-32`** (= `SPQ-1-52253`, "BEAD 32 mm"): Ext = Int + 40, same rule as bead-28. French
  leaves pin it via `beadKey`. (bead-28 must stay FIRST in the catalog Record — default-bead pick.)
- **Gaskets** (docs list ONLY these two; French cells are excluded from Gasket 01/02):
  `gasket-fm` (`SP_GSKFM`) = Σ stulp lengths (2004); `gasket-sash` (`SP_S001`) = Σ per leaf of
  (sash outer perim + leaf daylight perim) = 22576 — invariant across equal/unequal/midrail docs,
  and it **only fits with frame face 48** (further evidence for 48).
- **Hardware calibrated:** 2× Inverter Caps (`SPQ-2-91252`) per stulp; 4× Cavity Locking Block
  (`SP_CBLOCK01`) per leaf; **8× Glazing Bridge (`SP_GBRIDGE`) per glass pane** (16/32 across docs).
  **Approximate/flagged:** operating gear isn't itemised in the docs' cut tables — master leaf
  reuses the single-door set (handle/lock/cylinder per the "Door Handle w Key-A" header), slave gets
  the shootbolt; 3 flag hinges per leaf mirror the single door. **Reinforcement:** docs carry "+R1"
  on every profile but no steel section — French sashes are mapped to the door steel
  (`reinf-28x44.5-u`, **assumed**, not asserted); the stulp is left unmapped. Reconcile both against
  an itemised French cutting list.

**How it's wired (engine stays pure).** New `SashKind`s `french-door-master` / `french-door-slave`
(master = handle side, left by convention; hinge side is positional — each leaf hinges on its outer
jamb). New `TransomSection.jointType: "S"` (topology/bars emit square-cut, no horns; SVG marker like
T). `CellSpec.midrails` → `applyMidrails()` in `topology.ts`: the PRIMARY SolvedCell keeps
`sashOuter` (hardware/gaskets/labour key off it) and is narrowed to pane 1; panes 2..n are emitted
as glazing-only cells (no sash rects) with the leaf's content — `bars/cutting/documents/solve.ts`
untouched. `pricing.ts`: French leaves count as doors for labour (pane cells don't); gasket wastage
exclusion is now catalog-lookup based (covers SP_GSKFM/SP_S001). The **extractor** promotes french
to `calibrated/eligible` and, wherever two door leaves meet across a vertical cut (directly or at
nested-vsplit edges — fixes designs 5/7/9–12 which previously got a `mullion-78` between the pair,
and replaces the old zero-profile `meeting-stile`), sets `french-mullion` + rewrites the pair to
master (left) / slave (right) with `bead-32`. The legacy `meeting-stile` machinery still exists but
no design uses it. Pure-pair collection design + the 3 engine designs default to **1700×2100**.

**Validation.** 3 jobs (`JOB_264_T`, `JOB_264_MIDRAIL`, `JOB_264_UNEQUAL` — the unequal one drives
the collection design through `splitRatios: {root: 750/1700}`) assert every doc line (finished
sizes), and `validateFrenchDoor()` asserts the PRINTED welded saw sizes (1706/2106/824/2050/748;
stulp stays 2004), the `[ - ]` stulp end prep, the equal-split default (818), and that Gasket 01/02
stay empty on French quotes. The extractor test now asserts french quotable = 12 with exactly one
stulp + master/slave pair each.

## Phase 2 — UI frontend (stack confirmed: Next.js)

Stack confirmed with the owner: **Next.js (React, App Router, TypeScript)**. The **Express API stays the
single backend/engine host** (do not replace it); Next.js is the **UI + a thin BFF proxy** (server-side
route handlers forward to Express so the JWT lives in an httpOnly cookie, no browser CORS). New code in a
new `web/` workspace; `src/*` untouched. Built as sequential sub-milestones, one at a time:
**U0** scaffold + API seam · **U1** auth + app shell · **U2** product/design gallery (inline SVG) ·
**U3** quote configurator + live preview (introduces per-quote glass/colour selection — the deferred M5
selection) · **U4** orders + PDF download · **U5** admin console (settings + the M5 pricing editor) ·
**U6** polish + deploy. Each adds backend endpoints only where missing (e.g. U3 adds the quote-time
`glassKey`/`colourKey` override). Full breakdown in the approved plan.

### Phase 2 — U0 (scaffold + API seam) — DONE

The `web/` Next.js app (**Next 16, App Router, React 19, Tailwind v4, TS**) is scaffolded as its own
npm project (own `package.json`/`node_modules`/lockfile — `src/*`, Prisma, engine all untouched; the
**only** root edit is this CLAUDE.md). It builds and lints clean (`cd web && npm run build && npm run
lint`).

- **The seam (BFF proxy).** The browser only ever calls **same-origin** Next routes (`/api/...`).
  `web/app/api/[...path]/route.ts` forwards each to `EXPRESS_API_BASE/api/...` (default
  `http://localhost:3005`), injecting `Authorization: Bearer <jwt>` read from an **httpOnly `token`
  cookie** — so the token never reaches client JS and there's no browser CORS. Status/body/content-type
  pass through verbatim (JSON, HTML docs, PDF streams). Explicit routes beat the catch-all:
  `…/api/auth/login` forwards creds to the engine, stores the returned JWT in the httpOnly cookie, and
  returns only `{ user }`; `…/api/auth/logout` clears it.
- **Two API helpers.** Client Components → `web/lib/api.ts` (calls the BFF; client-safe, no
  server-only imports). Server Components / Route Handlers → `web/lib/server-api.ts` (calls the engine
  directly, attaching the cookie's JWT; imports `next/headers`). Minimal response types in
  `web/lib/types.ts` (not imported from root `src/types.ts` — its explicit-`.ts` ESM imports don't
  suit Next's bundler). `web/app/page.tsx` is a throwaway **seam-check** (lists `/api/systems`,
  gracefully reports if the engine is down); U1 replaces it.
- **Next 16 specifics heeded** (per `node_modules/next/dist/docs`): `cookies()` and route `params` are
  **async**; `GET` route handlers default to **dynamic**; `turbopack.root` pinned to `web/` so the
  nested lockfile isn't mis-rooted. `server-only` resolves as a Next built-in alias (not in
  node_modules). Run with `cd web && npm run dev` (UI :3000 → engine :3005).
- **Verified** end-to-end against a mock engine: proxy GET, login sets `HttpOnly; Secure(prod);
  SameSite=lax` cookie with body carrying **no token**, cookie-authed `/api/auth/me` (bearer injected
  by the proxy), and 401 relay for bad/missing auth. Live run against the real engine needs Postgres
  (owner-side: migrate + seed + `npm start`, then `cd web && npm run dev`).

### Phase 2 — U1 (auth + app shell) — DONE

Auth-gated app shell on top of the U0 seam. Still `web/`-only; `src/*` untouched.

- **Auth guard is server-side.** `web/lib/server-api.ts#getCurrentUser()` resolves `GET /api/auth/me`
  (bearer from the cookie) → `AuthUser | null` (null on 401/unreachable, never throws). The protected
  **route group `web/app/(app)/`** has a `layout.tsx` that calls it and `redirect("/login")` when null;
  every page under it (dashboard + section stubs) is thus gated by one check. `/login` does the inverse
  (redirect to `/` if already authed). Both are `dynamic = "force-dynamic"` (they read the cookie).
- **Login** (`web/app/login/`): a Server Component shell + a `"use client"` `login-form.tsx` that calls
  the U0 `lib/api.ts#login()` (BFF → httpOnly cookie, returns `{user}` only), then
  `router.replace("/") + refresh()` so the layout re-evaluates with the cookie set.
- **Top nav** (`web/app/(app)/nav.tsx`, client): active-link highlight via `usePathname`, current user +
  role badge, **logout** (`lib/api.ts#logout()` clears the cookie → back to `/login`). **Admin-only
  links are gated by `user.role === "admin"`**, and the `/admin` route **also** guards server-side
  (`redirect("/")` for non-admins) — the hidden nav link is defence-in-depth, not the gate.
- **Section stubs** (`/products` U2, `/quote` U3, `/orders` U4, `/admin` U5) render a shared
  `web/components/placeholder.tsx` so the shell is fully navigable now without 404s. The dashboard
  (`web/app/(app)/page.tsx`) greets the user and shows the engine seam status (system count).
- **Verified** against the mock engine on the built server: unauthed `/` → 307 `/login`; login → 200 +
  `Set-Cookie token … HttpOnly` and `{user}`-only body; authed `/`, `/admin` → 200; `/login` while
  authed → 307 `/`; `/api/auth/me` via proxy → user (401 without cookie); logout clears the cookie →
  `/` 307 `/login`; bad creds → 401, no cookie. `npm run build` + `npm run lint` clean (11 routes).
  Non-admin role-gating is code-verified (the mock only issues an admin). Live run still owner-side
  (needs Postgres: migrate + seed + `npm start`, then `cd web && npm run dev`).

### Phase 2 — U2 (product & design gallery) — DONE

First content screens, on the existing **already-paginated** backend (no `src/*` change):
`GET /api/products`, `…/:id`, `…/:id/designs`, `GET /api/designs/:id`.

- **All Server Components**, `dynamic = "force-dynamic"`, fetching via `lib/server-api.ts`
  (`serverApiGet`, cookie bearer attached server-side) — no client data fetching. `page` comes from
  `await searchParams` (Next 16: `params`/`searchParams` are Promises). New shapes in `lib/types.ts`
  (`Paginated<T>`, `ProductSummary`, `DesignListItem`, `DesignDetail`).
- **Products list** `web/app/(app)/products/page.tsx` (replaced the U1 stub): card grid (name,
  type/system, design-count pill) → each links to `/products/[id]`.
- **Design gallery** `web/app/(app)/products/[id]/page.tsx`: the list endpoint **omits `imageSvg`**
  (it's large), so the page fetches the page of designs then **`Promise.all`-fetches each design's full
  record in parallel** for its SVG (a failed fetch degrades to a "no preview" tile, never fails the
  page). 404 from the engine → `notFound()`. Page size capped at `limit=24`.
- **`DesignCard`** (`web/components/design-card.tsx`): inline SVG via `dangerouslySetInnerHTML`
  (**first-party catalog SVG**, not user input), responsively scaled
  (`[&>svg]:h-auto [&>svg]:w-full`), plus a **green "Quotable" / zinc "Preview only" badge** and leaf
  count. **`Pager`** (`web/components/pager.tsx`): link-based (`?page=`), no client JS, reused by both.
- **Verified** against the extended mock engine (now serves products/designs + a tiny inline `<svg>`,
  one quotable + one non-quotable, bearer-gated): BFF paginates `/api/products` and relays 401 without
  the cookie; `/products` renders both products + gallery links; `/products/[id]` renders inline
  `<svg>`, both badges, leaf counts; unknown id → 404. `npm run build` + `npm run lint` clean
  (routes `/products`, `/products/[id]`). Live run owner-side (real engine + Postgres) shows the full
  ~500-design gallery.

### Phase 2 — U3 (quote configurator) — DONE

The first feature that **changes the engine** — minimally and safely.

- **Engine (the only `src/*` edit besides the options route):** `QuoteInput` gains optional
  `glassKey`/`colourKey` (`src/types.ts`); `solve()` (`src/engine/solve.ts`) applies them by
  **cloning** — colour clones the system with a new `defaultColourKey` (computePricing then applies
  its uplift), glass clones the design's cell tree filling the chosen glass into any leaf that doesn't
  pin its own (`fillDefaultGlass`, pure/recursive). **Both no-ops when omitted** (or colour==default),
  so a quote without them is byte-identical to pre-U3 → the **147+10 assertions stay green** (owner
  must run `npm run validate` to confirm against the DB; I can't here — no Postgres). Unknown
  glass/colour keys throw a clear error. `npx tsc --noEmit` clean.
- **`GET /api/systems/:id/options`** (public, `src/api/server.ts`): selectable glass (key+name) +
  colours (key+name+`priceUpliftPct`) for a system — the configurator's selectors. Deliberately
  **free of supplier costs** (unlike the admin `/api/catalog/:id` dump). `/api/quote` already spreads
  the body into `solve()`, so glass/colour flow with no route change.
- **UI:** `web/app/(app)/quote/` — a thin Server page + client `configurator.tsx`: system/W×H/glass/
  colour controls, **350 ms-debounced** `POST /api/quote`, live inline SVG + price summary. Reached
  via a **"Configure →"** link on each **quotable** `DesignCard` (carries `systemId/designId/productId
  /name`, and `orderId` when adding to a draft). Includes an **"Add to order"** bridge into U4.
- **Caveat (matches the roadmap):** glass/colour selection is **quote-time only** — saved order items
  use the design-baked default (persisting per-item glass/colour would need an `OrderItem` migration;
  deferred). The configurator notes this.

### Phase 2 — U4 (orders) — DONE

Pure frontend on the existing order API (no `src/*` change). `web/app/(app)/orders/`:

- **List** (`page.tsx`): `GET /api/orders` table — orderNo, customer, status badge, item count,
  snapshotted `totalPrice`, created; **"New order"** (client) creates a draft → detail.
- **Detail** (`[id]/page.tsx`): header + line-item table. **Draft** → "Add item from gallery"
  (`/products?orderId=…` deep-links the gallery→configurator→`POST items`), per-row **Remove**, and
  **Confirm** (≥1 item) which generates the 7 docs. **Confirmed** → documents grid with **View** (HTML)
  + **PDF** links hitting `/api/orders/:id/documents/:type[/pdf]` **through the BFF** (cookie→bearer,
  streams verbatim). Client actions in `order-actions.tsx` (`router.refresh()` after each write).

### Phase 2 — U5 (admin console) — DONE

Pure frontend on the M5 admin API (no `src/*` change); all routes **server-guarded** by
`role === "admin"` (like the U1 stub). `web/app/(app)/admin/`:

- **`/admin`** hub → settings + catalog.
- **`/admin/settings`** (`settings-form.tsx`): financial fields + branding (company name/address/accent
  colour) → `PUT /api/settings`; **logo upload** as a raw `image/*` body (`apiSendRaw`) with a live
  preview via `/api/branding/logo`.
- **`/admin/catalog`** (`catalog-editor.tsx`): system selector; per-row **cost/price/weight** edit
  (dirty-tracked Save) across frames/sashes/transoms/beads/reinforcement (`PUT …/parts/:KIND/:key`) and
  glass/gaskets/hardware (`PUT …/:table/:key`); **add glass variant**; **colour** uplift add/edit; and
  **CSV import** (`POST …/import`, raw `text/csv` via `apiSendRaw`) showing `{updated, unmatched}`.

**Verified (U3–U5)** against an extended mock engine on the built server: options + quote
glass/colour passthrough (anthracite → +15% material, glass/colour echoed in the SVG); orders
create→add-item→confirm→documents (HTML via BFF); admin pages render; settings PUT, catalog part PUT,
and **raw `text/csv` import all proxy correctly through the BFF**. `web/` `npm run build` + `npm run
lint` clean (15 routes). Live run owner-side (engine + Postgres + MinIO for PDF/logo).

## U7 — Visualization & dual-colour

Three additive features. **Default behaviour is byte-identical** (the 3 weld-drift failures in
`npm run validate` are pre-existing DB drift, not these changes — new totals: 267 passed, 3 failed,
all new colour/joint/svg assertions green).

**1. Inner-joint overlay (visual).** `renderSvg(geometry, opts?)` gained an optional `opts.joints`
that emits a `<g id="joints">` layer — 45° mitre diagonals at the four outer-frame corners and at
every sash ring, plus a T/Z-styled tick marker at each transom/mullion junction (T = one tick, Z =
offset double tick). **All coordinates derive from rects already on the solved geometry** (no new
engine math, no new required type fields). Omitting `opts` ⇒ byte-identical SVG. `QuoteInput.showJoints`
threads it into `solve()` so documents can include it; the configurator also has a live "Joints" toggle.

**2. Inside/outside colour (priced + persisted).** `QuoteInput.colourKeyOutside` is the OUTSIDE
finish; the existing `colourKey` is the INSIDE/primary. When they differ, `solve.ts` **synthesizes
ONE combined `ColourOption`** whose uplift is the SUM of the two (`__combined__:in+out`) and points
`defaultColourKey` at it — so **`pricing.ts` is UNCHANGED** (it still reads a single multiplier).
Equal keys ⇒ single colour (no double-count); White+White ⇒ no clone ⇒ byte-identical. New optional
`ColourOption.hex` (cosmetic swatch; null ⇒ grey) tints the preview SVG (outside drives the visible
fill, a thin inside liner hints the inside colour) and the 3D materials. Persisted on
`OrderItem.colourKeyInside/colourKeyOutside` (migration `20260630010000_add_inside_outside_colour`,
+ `colour_option.hex`); threaded through `addItemSchema` → `buildQuoteInput` → confirm re-solve
exactly like `cillKey`. Documents show a `DocColour` header row ("White (in) / Anthracite (out)").
Admin colour CRUD + `GET /api/systems/:id/options` carry `hex`; the admin catalog editor has a swatch
picker. **Live-verified:** white(0%)+anthracite(20%) on a priced frame ⇒ materialPrice 530.75 → 636.9.

**3. 3D window view (frontend-only).** `web/components/window-3d.tsx` — plain `three` (+ `OrbitControls`,
the only new dep; lazy-loaded via `next/dynamic({ssr:false})` so it never enters the server bundle).
Extrudes the **same `QuoteGeometry` rects** the 2D view uses into a massing model (constant catalog-ish
depths for v1 — no engine change); box front faces carry the outside colour, back faces the inside.
A 2D/3D tab switch lives in the configurator preview card; WebGL-absent ⇒ graceful 2D fallback.
Future: expose per-profile `depthMm` via the options API for dimensionally-accurate extrusion.

**Dashboard honesty pass (D6).** The dashboard's 12-bar chart and its three-service "system
health" list were hardcoded decoration. They are now real: monthly CONFIRMED-order value from
`GET /api/orders` (bucketed client-free in the Server Component, with an empty state when there is
nothing to chart) and three rows that report only what the page actually observed — engine
reachable, catalog product count, documents generated. Money on the dashboard, the orders list and
the order page is the same `BasketTotals.grandTotal`.

**Tests:** `src/engine/svg.test.ts#validateSvg` (render-option byte-identity + joints/tint markers),
`pricing.test.ts` (+ summed dual-colour uplift), and `jobs.ts#validateColourAndJoints` (solve-level
White+White == default, joints additive, joints don't change pricing) — all wired into `npm run validate`.

## Designer — D1 (option engine)

The first slice of the schema-driven Designer (`Spec/01-windows-module/phase-1-option-engine.md`).
**Backend data layer only** — no resolver, no line items, no UI, and `src/engine/*` untouched, so
the legacy `/quote` path and every geometry/pricing assertion are unaffected.

**The shape of it.** A product family is ONE `ProductFamilyDescriptor` (JSONB on `product_family`)
plus option definitions; the UI, resolver and basket read the descriptor and never special-case a
family. Options live in three tables (`option_group` → `option_def` → `option_choice`), are seeded
from `src/catalog/options/windows.ts`, loaded into memory by `loadDesignerSnapshot()`, and served
by `GET /api/families/:key`. Contracts + the `EngineEffectKind` → engine-touch-point table are in
`src/designer/option-types.ts`. `order` columns map to `sort_order` (reserved SQL word).

**Catalog is the single source of truth for choices.** Colour/glass/cill/bead/frame/hardware
choices are GENERATED from the live `ProfileSystem` — label AND partKey both come from the catalog,
never retyped — so renaming a catalog part renames its choice (asserted). Prices are never stored
on a choice; a choice points at a catalog part via `partKey` and the price is resolved from there.
A dangling `partKey` is a hard seed failure, because it would silently price to £0.

**Size constraints are generated, not retyped.** `casement-window.ts` builds its 16 constraints
from `src/engine/limits.ts#SIZE_LIMITS` — the verbatim HAWDIO p70 transcription — so there is ONE
copy of the printed size table in the repo, and every constraint carries that page cite. Two bounds
per dimension mirror `checkSizeLimits()`: warning at the printed max, error past the 10% rule.

**Golden rule, applied to options.** Six options ship `pricingMode:"none"` + a helpText saying why:
`profile.addon` (parts exist, no calibrated cut rule — Q6), `hardware.locking` / `hardware.hinge`
(the espag/stay are SIZE-SELECTED by the engine; free choice would break a calibrated rule from
the UI — Q19), `hardware.ventilator` (no vent part exists), `general.drainage` (Q7), and
`glazing.method` (unglazed still prices its glass until the phase-2 resolver can omit it — Q20).
They appear, persist and print; they do not fabricate or price.

**Owner-owned vs seed-owned.** Reseeding preserves `presentation`, `order`/`sort_order` and
`defaultCollapsed` (verified by a row-level diff across two full seeds with edits in between);
everything else is re-applied from the seed. `isDefault` is seed-owned and deliberately NOT
patchable — a default decides what every new line item gets (bead-28 keeps quotes byte-identical)
and an admin flip would silently revert on the next deploy.

**API.** `GET /api/families` + `GET /api/families/:key` are PUBLIC (no cost data — same split as
`/api/systems/:id/options`); `PATCH /api/families/{option-groups,options,choices}/:key` require
`catalog.update` (RBAC reuses the catalog module — no new module, no RBAC migration) and refresh
the snapshot in place. Creating/deleting options is NOT exposed: seeds own structure, and deleting
a choice that persisted line items reference would corrupt history.

**Validation.** `validateRules` (62 assertions: every operator, nesting, 17 fail-loud cases) and
`validateOptionSystem` (descriptor, 1:1 catalog correspondence, cited constraints, unique
constraint ids, a recursive scan proving no cost/price key is served, and seven deliberately
corrupted copies of the real seed that must be rejected). Baseline moved 571 → **691 passed**,
same 3 pre-existing weld-drift failures.

## Designer — D2 (line-item core)

The stateless resolve pipeline + persisted line items
(`Spec/01-windows-module/phase-2-line-item-core.md`). After this the designer works **headlessly
over HTTP**; D3–D5 add only UI. Legacy `/quote` and legacy `OrderItem`s are untouched and
coexist in the same order.

**The pipeline** (`src/designer/resolve.ts#resolveLineItem(draft, snapshot)`, PURE — the catalog
arrives as a `CatalogSnapshot`, never read as I/O): validate dimensions against the family
descriptor → apply `topologyEdits` via the adapter → resolve scoped selections → map
`engineEffect`s to `QuoteInput` slots → **`solve()` (unchanged entrypoint)** → evaluate the
descriptor's constraints on solved geometry → assemble a `ResolvedLineItem`. Issues never throw:
an invalid-but-well-formed draft returns a resolve carrying error issues (malformed JSON is the
API's 400). Contracts live in `src/designer/line-item-types.ts`.

**Two additive `QuoteInput` fields — the only engine change**, both clone-on-override exactly like
`glassKey`/`frameKey`, both byte-identical when absent (the 691 assertions held):
`hardwareOverrides?: Record<slot, partKey>` (threaded to `computeHardware`; only genuine 1:1 slots
— "handle" today — since espag/friction stay are SIZE-selected, questions.md Q19) and
`topologyOverride?: CellNode` (the seam through which every topology edit reaches the engine).

**The `cellnode` adapter** (`src/designer/adapters/cellnode.ts`, registry in `adapters/index.ts`):
stable **position-derived componentIds** — `cell:<path>`, `cell:<path>/glass`, `divider:<path>`,
`edge:<side>`, `cill` (never uuids, so ids survive re-solves and line-item duplication) — plus
immutable tree transforms for `split` / `add-midrail` / `convert-component` / `set-sash-kind` /
`remove-divider`, `equalSplitRatios()` for the `equalSplit` mode, and `pinCellField`/`pinAllCells`
for component-scoped glass/bead. **No new engine math**: "equal" is the midpoint of the target
cell's solved bounds, which the engine's "divider centred on ratio × window" rule turns into equal
daylight children; inserted dividers default to `transom-t-67`/`mullion-78`, the same defaults the
M3 extractor applies to every collection design.

**Selection precedence** (`src/designer/select.ts`, option-schema §7): component-scoped >
`<type>:*` all-of-type > item-level > `isDefault` > unset. Hidden options are skipped entirely
(no issue even when required); malformed visibility rules become error issues rather than a silent
false (`rules.ts` stays fail-loud).

**API.** `POST /api/line-items/resolve` is **public** like `/api/quote` (stateless, powers the live
designer). `POST/PUT/DELETE /api/orders/:id/line-items[/:itemId]` persist a draft + its cached
resolve + `catalogVersion` (drafts MAY carry error issues — the designer saves work in progress).
`GET /api/orders/:id` gained a `designerItems[]` (draft + summary + issues + totals, not the full
resolve). **Confirm** re-resolves every designer item: any error-severity issue ⇒ **422** with the
issues and the order stays draft; otherwise the resolver's engine output — shape-identical to a
legacy item's — joins the same `aggregate.ts` stream, so the 7-document flow needed no per-kind
branching. `getCatalogVersion()` (new loader accessor, bumped on every load/refresh) stamps
provenance on each resolve.

**Deliberate limits (golden rule).** `equalGlass` emits a not-implemented warning and falls back to
the drawn positions (Q4). `hardware-substitution` is per-slot, so differing per-sash picks warn
`conflicting-selection` and the first wins (per-sash hardware needs a per-cell engine map — D4).
`bom-line` accepts catalog **hardware** parts only; glass/gasket/profile rows carry per-m²/per-metre
semantics no calibrated source gives. Only the **weight** verdicts from `checkSizeLimits()` merge
into the issues — the size verdicts already arrive as descriptor constraints generated from the same
`SIZE_LIMITS` transcription.

**Validation.** `src/designer/resolve.test.ts#validateDesigner` (wired into `npm run validate`,
SKIPs on a DB predating the D1 seed): the **golden byte-identity test** (a defaults-only draft
reproduces a direct `solve()` exactly — bars, reinforcement, glass, gaskets, hardware, pricing
lines and totals), scoped glass touching exactly one pane, the three-rung precedence ladder,
`split(equal)` == the authored design at ratio 0.5, `equalSplit` equalising an unequal authored
split, required-unset vs hidden-required, a constraint firing with its HAWDIO citation at the right
severity, idempotence, the `hardwareOverrides` substitution, and unknown option/choice keys
degrading to issues rather than crashes. Baseline **691 → 725 passed**, same 3 weld-drift failures.
Also curl-verified end to end (resolve → persist → GET → confirm → 7 documents; the 422 path; and a
legacy quote + legacy order confirm proving coexistence).

## Designer — D3 (configurator shell)

The `/designer` workspace (`Spec/01-windows-module/phase-3-configurator-shell.md`). Almost
entirely `web/`; the legacy `/quote` configurator is **untouched** and stays the gallery's default
action.

**One state, one writer.** `web/components/designer/workspace.tsx` holds a single `LineItemDraft`
in a `useReducer`; every control dispatches and nothing keeps a shadow copy of an answer. That is
why "reopen a saved item and see the same state" is trivially true — **the saved draft IS the
state** (the route restores it verbatim from `GET /api/orders/:id`, never re-derives it from query
params). The resolve is a pure function of that draft: a **350 ms debounced**
`POST /api/line-items/resolve` with a sequence counter that discards superseded responses; a failed
resolve shows a banner over the retained last-good preview rather than wiping the canvas.

**Schema-driven, provably.** The Options tab renders groups → options → choices straight from
`GET /api/families/:key`: order, labels, defaults, filters, help text and the control type all come
from the option system, and `controls/index.tsx` picks a primitive from `display`
(`segmented`/`select`/`select-image` grid popover with filter chips/`toggle`/`number`/`text`).
Seeding a new option row makes it appear correctly grouped and styled with **no `web/` change** —
verified by grep: no option key appears anywhere in `web/components/designer/*` or
`web/lib/designer-draft.ts`. The tri-state grammar (default muted / changed emphasised + reset /
amber-required / red-error) lives in ONE place, `controls/option-row.tsx`, so a new control type
inherits it.

**What phase 3 can answer.** Item-level options, plus component-level options whose **declared
default apply-scope is `all-of-type`** (`applyScopes[0]`) — glass type, handle, locking, hinge.
Those render as item-wide controls writing an **unscoped** selection, which the server's precedence
ladder already applies to every component in scope (`select.ts` rung 3) and which a D4
per-component answer will override. Options whose default apply-scope is `"this"` (add-on, sash
type, ventilator) and every `display:"action"` are genuinely per-part: they are counted in a
per-group hint chip and wait for D4.

**Measurements.** Dimension fields come from `descriptor.dimensions` (inline min/max), the split
modes from `descriptor.splitModes` — with any mode the resolver reports as not-implemented
**hidden rather than offered-and-ignored** (equalGlass today, questions.md Q4). Span rows are
generated from the SOLVED geometry, one per divider, and commit `centreline ÷ solved frame
dimension` — the exact fraction the canvas drag handles write, so keyboard and pointer editing
round-trip identically. Dragging a divider also switches the item to `byDimensions`, otherwise the
resolver would recompute equal positions and silently discard the drag.

**Two structural rules instead of hardcoded keys.** The location field is hoisted into Measurements
by matching an *item-level text option carrying a suggestion list*; `draft.location` (which the
documents print) is written at SAVE time from `resolved.summary.locationLabel`, so the option
system stays the single source of the answer. Colour swatches for the 3D view are found by
`engineEffect.kind === "colour-key"` + `params.side`, and the hex is catalog data
(`ColourOption.hex`) — the UI computes no colour.

**The one server change** is additive: `ResolvedLineItem.geometry` now carries the engine's solved
rects — the `/api/quote` geometry **minus its `svg`** (already in `geometrySvg.external`; carrying
it twice would double every persisted resolve). The canvas cannot place drag handles, nor D4
hit-test a component, from an SVG string alone. `solve()`, pricing and the documents are untouched;
**725 assertions unchanged** (same 3 pre-existing weld-drift failures).

**Reuse, not rebuild.** The canvas is the existing `window-designer.tsx` (drag handles, dimension
overlay) fed `{...resolved.geometry, svg: geometrySvg.external}`, and the 3D tab the existing lazy
`window-3d.tsx`. Internal/Schematic views are **hidden** until D5.

**Entry + exit.** Quotable gallery cards gain a secondary **"Design in studio"** action; the family
is matched from the descriptors' own `designSource.productIds` (a non-casement product shows no
link, and registering a second family in D7 lights its products up with no `web/` change). Order
detail gained a **Designer line items** table (edit → studio, remove, per-item total and issue
count) so a saved item is reopenable; the confirm gate now counts legacy + designer items together.
The full commercial basket stays D6.

**Verified live** against the real engine + Postgres: draft → persist → `GET /api/orders/:id`
returns the draft byte-for-byte → `/designer?orderId&itemId` restores every value → confirm → the
work order prints `1400 × 1300 … ×2 — Kitchen`. Equal-split recomputes a 1400×1300 unit's transom
to 650.0 and equalises glass (582.5/582.5); an oversize unit returns the HAWDIO-p70-cited
constraint pair. `npm run build` + `npm run lint` clean (22 routes).

## Designer — D4 (component editing)

Selection, scoping and structural editing (`Spec/01-windows-module/phase-4-component-editing.md`).
Almost entirely `web/`; `/quote` stays untouched and the engine is unchanged.

**One additive server field.** `ResolvedLineItem.components` is the adapter's `listComponents()`
of the SOLVED geometry — stable position-derived id, type, kind, label and a **mm rect**. The
browser cannot hit-test a component, nor label a tree, from an SVG string; re-deriving topology in
the UI would be a second implementation of the adapter. Asserted stable across a resize (ids
identical at 1200×1200 and 1400×1300 while the rects move) — which is what lets a selection AND a
component-scoped answer survive editing.

**Selection is always on** (the reference UI needs a modal "edit individual components" mode).
Click a part on the drawing or a row in the Structure tree — one `useState` feeds both, so they
cannot disagree. Hit-areas are sorted **biggest-first** so the smallest component under the cursor
wins; the highlight is a 20 % accent fill, never opaque, so the fabrication drawing stays readable.
Escape and the breadcrumb return to item scope. If an edit deletes the selected component the
selection falls back to its parent, then to the item — computed during render, so the inspector
can never point at something that no longer exists. **The canvas is the existing
`window-designer.tsx`**, which gained three OPTIONAL props (`components`, `selectedComponentId`,
`onSelectComponent`); omitting them is the pre-D4 behaviour, which is how `/quote` is untouched.

**Scoping mirrors the server, it doesn't reimplement it.** `web/lib/designer-draft.ts`
`effectiveAnswer(draft, option, component?)` walks the same ladder as `src/designer/select.ts`
(component > `<type>:*` > item > default > unset) purely to render honestly: which rung answered
(badge "Override" / "All sashes" / "From item") and what a Reset falls back to. The apply-scope
toggle offers exactly the scopes the OPTION declares (`scope.applyScopes`) and writes
`cell:root.left` or `sash:*`; switching it **moves** an existing answer rather than leaving a stale
one winning elsewhere. Item-level options stay visible under a "Whole item" divider, minus anything
already answerable in the component scope — one answer never gets two controls.

**Structure tab = the a11y contract.** Every canvas interaction has an equivalent there: the
component tree (selection), the instant actions, and the edit history. Actions are whatever
`display:"action"` options the seed declares for the selected component's type, executed by
appending **the option's own `action` template** with the selection's componentId filled in — so a
new action option is pure data. Undo removes one edit and **replays the rest** (asserted:
removing an edit == never having made it). A failed edit is shown in red with the resolver's
message and a remove button rather than silently dropped.

**The one behavioural change in the resolver: selections + effects now run at most TWICE.** A
selection can BE a structural change (convert a pane to a sash), and that changes which components
exist — a sash owns a `…/glass` pane a glass cell does not. With a single pass, an answer scoped to
that new pane could never resolve (permanent `unknown-component`), so "convert this pane to a sash,
then give only that sash obscure glass" was unreachable. When pass 1 applies a structural effect the
components are re-derived and selections resolved once more; only the final pass's issues are
reported. It terminates because the resolver already skips a topology edit whose component matches,
and every other effect is idempotent into a fresh effects object. **The golden byte-identity test
and all 738 assertions hold.**

**Orphan pruning.** `pruneSelections(draft, components)` drops selections whose concrete
componentId is gone (never `<type>:*` or item-level answers) after each resolve. The server-side
safety net stays fail-loud: an orphaned scope that slips through is an `unknown-component` ERROR,
never applied to some other component.

**Still no option key anywhere in `web/`** (same grep as D3). Two new structural rules make that
true: conversions are filtered to the descriptor's `componentConversions` by reading each choice's
own `engineEffect.params.to`, and actions are found by `display === "action"` + the option's
declared `componentTypes`.

**Validation.** `resolve.test.ts` gains 13 assertions: the components contract (stability, typing,
sub-components, dividers, edges, absent on a failed solve), edit-history determinism, and the
orphaned-scope issue. Baseline **725 → 738 passed**, same 3 pre-existing weld-drift failures.
Live-verified end to end: split → convert → per-pane glass resolves clean, prices the sash ring +
its hardware, and the BOM prints exactly two glass rows (one per pane); `glass:*` collapses them to
one; the draft round-trips byte-for-byte through save and reopen.

## Designer — D5 (views & preview)

The elevation the user is looking at (`Spec/01-windows-module/phase-5-views-and-preview.md`).
All three 2D views are **engine renders of the same solved geometry** — the UI stays dumb, and
documents could embed any of them later without new machinery.

**Two more `renderSvg` options, same byte-identity discipline as joints/colour.**
`view:"internal"` wraps the whole drawing in ONE mirror about the window centreline
(`matrix(-1 0 0 1 w 0)`; the viewBox is symmetric about `w/2`, so it is unchanged) — hinge sides
and opening chevrons flip together, and nothing can drift out of frame. `schematic:{faceWidths?,
glassSizes?}` swaps in a white-fill/thin-stroke palette and appends `<g id="schematic">`. Omitting
both ⇒ the historical SVG, byte for byte.

**No new engine math — every annotated number is a rect the engine already solved:** frame face =
`outer`→`rootDaylight`, divider face = the transom's `rect.h` / the mullion's `rect.w`, sash ring
face = `sashOuter`→`sashInner`, glass = `glassRect` rounded EXACTLY as `bars.ts#emitGlass` rounds
it — so a schematic pane label and its cutting-list row are the same number by construction
(asserted row-by-row on a real job). Live: casement 64/67/79, French 48/48/67/105, sliding 48/85 —
all calibrated catalog face widths.

**Handles are drawn only where the hinge edge is recorded.** The glyph (lever + rose, bounded by
the stile rect) goes on the closing edge — opposite the hinge the chevron already points at — for
casement, door, tilt&turn and French leaves. **Sliding panels get none**: the catalog gives each
sliding panel a handle but records no stile for it, and inventing one is a guess. Note the
internal view mirrors the handle too: a sash hinged left from outside reads hinge-right /
handle-left from inside. That contradicts the phase file's original acceptance wording and is the
physically correct behaviour of a mirror (recorded as a deviation there).

**Views are a REQUEST option, never draft data.** `QuoteInput.views` (precedent: `showJoints`) →
`QuoteOutput.geometry.svgViews`; `resolveLineItem(draft, snapshot, {views})` →
`ResolvedLineItem.geometrySvg.{external,internal,schematic}`. `POST /api/line-items/resolve` reads
`views` from the body or `?views=`, and the draft zod schema **strips** it — so the view someone
happened to be looking at can never be persisted on a line item. Absent ⇒ external only ⇒ the
pre-D5 payload.

**The canvas.** The view switch drives which elevation is requested; rendered SVGs are cached per
(view, draft) so switching back is free, and a switch to a new view skips the 350 ms debounce
(it's a click, not typing). `window-designer.tsx` gained ONE optional `mirrored` prop: it mirrors
the mm→px transform for hit-testing (verified in a browser — clicking a pane gives the identical
breadcrumb in External, Internal and Schematic) and suppresses the dimension lines + drag handles,
because a dragged position would have to be un-mirrored on the way back to `splitRatios`.
Measuring therefore lives in External and Schematic, which are un-mirrored — Schematic being the
natural measure mode. `/quote` passes neither prop and is untouched. "Download SVG/PNG" is
client-side (`web/lib/svg-download.ts`); no backend route, no storage key.

**Incidental fix:** the designer canvas stage had resolved to **height 0** since D3 (the card
centres its children, so `h-full` resolved against an indefinite min-height-only flex container,
and `overflow-hidden` clipped the drawing). `self-stretch` on `designer/canvas.tsx`'s root fixes
it — the stage now measures 838×798 where it measured 838×0.

**Validation.** `svg.test.ts` +26 (external byte-identity, the mirror wrapper preserving every base
shape verbatim, handle handedness + containment, each annotation family toggling independently,
French/sliding smoke) and `jobs.ts#validateViews` +11 (no `svgViews` by default; identical SVG /
parts / documents / totals with views requested; every cutting-list glass row present as a pane
label; the 67 mm transom face). Baseline **738 → 775 passed**, same 3 pre-existing weld-drift
failures.

## Designer — D6 (basket & orders)

The commercial layer on top of the fabrication price
(`Spec/01-windows-module/phase-6-basket-and-orders.md`): fitting, survey, delivery, discount codes
and a per-order VAT override.

**One function owns order money.** `src/designer/basket.ts#computeBasket(items, commercials,
settings, at, opts)` is pure (no I/O, no clock beyond the `at` used for discount validity) and is
what the API response, the orders list, the order detail ledger and the Price Summary all render.
`src/api/order-basket.ts` is its I/O half: it prices the order's items (legacy items through
`solve()`, designer items through the resolver) and loads the discount row. Drafts are priced LIVE;
confirmed orders replay the `basketTotals` snapshot frozen at confirm — that is what makes a
confirmed order immutable even after a price list, a VAT rate or a discount code changes.

**Two deliberate deviations from the phase file's formula, both to keep ONE number:**

1. **The items subtotal is PRE-TAX.** The phase file sums each item's `grandTotal`, but the engine's
   grand total already includes VAT; taxing that base again charges VAT twice per item. The subtotal
   is `netPrice`, and tax is applied exactly once over items − discount + extras.
2. **The subtotal is the AGGREGATED order price**, not the sum of the lines. `aggregateOrder()`
   prices an order as ONE job (flat setup labour once, wastage over merged material) and that is
   what the BOM/Price Summary print — charging the line sum would have overcharged the verification
   order by **£105.03** against its own paperwork. Lines keep their own prices; the gap is shown
   explicitly as `itemsAdjustment` ("Order-level adjustment — shared setup"), never hidden.

Discount rules: percent or fixed, applied to the ITEMS subtotal before extras, clamped to
`[0, subtotal]` (a £500 code on a £200 basket makes the items free, never negative). Fitting
applicability: `none` ⇒ neither fitting nor survey; `fit` ⇒ fitting only; `fit-and-survey` ⇒ both;
**delivery is independent and always charged when set**.

**Schema/API.** Migration `20260726020000_add_basket_commercials` — seven nullable `order` columns
plus `basketTotals` JSONB, and a `discount_code` table (plain SQL, `migrate deploy`-safe).
`PUT /api/orders/:id/commercials` validates the code BEFORE storing it (400 with the reason) and
returns fresh totals; `GET /api/orders/:id` carries `basket`; the list carries `basketTotal` and
now supports `?q=`/`?status=`. Discount CRUD lives at `/api/discounts` under its **own RBAC module**
(`discounts` in `src/rbac/registry.ts`, nav `/admin/discounts`) — commercial data, not catalog data,
so no `loadCatalog()` refresh. **Run `npm run sync:permissions` (or `db:seed`) after deploying** so
the module row exists.

**Documents.** `renderPriceSummary` and `renderPlannerList` take an optional `DocBasket` (plain data,
same additive pattern as `DocBranding`). When present, the engine's own tax/GRAND TOTAL rows are
replaced by the basket block so a document never prints two contradictory totals; when absent the
output is **byte-identical** to pre-D6 (asserted live).

**UI.** Order detail (draft) gains a "Pricing & extras" card — fitting segmented control, three
price inputs with applicability hints, discount code, tax override, and a totals ledger that shows
only the lines that apply. Confirm now lists WHICH designer item blocked it and why (the 422 body).
Both item tables show a per-line total read from the same basket. `/admin/discounts` is the CRUD
page (live/scheduled/expired/inactive status derived, not stored).

**Validation.** `src/designer/basket.test.ts#validateBasket` — 65 DB-free assertions (percent/fixed
discounts, the floor-at-zero clamp, validity windows, the applicability matrix, default vs override
vs zero-rated tax, the aggregate override, rounding, mixed legacy+designer lines). Baseline
**775 → 862 passed**, same 3 pre-existing weld-drift failures. Plus 46 live end-to-end assertions
(recorded in the phase file).

## Designer — D7 (second family: entrance-door)

The extensibility proof (`Spec/01-windows-module/phase-7-extensibility-proof.md`), audited in
`Spec/01-windows-module/phase-7-audit.md`. A whole second configurable product family —
**`entrance-door`**, over the 19 quotable Single Door designs — added as **pure seed data**, with
**zero changes under `web/`**.

- **`src/catalog/families/entrance-door.ts`** — the descriptor. Leaf constraints are GENERATED from
  `src/engine/limits.ts#SIZE_LIMITS` (the residential-door row, HAWDIO p70), so the repo still holds
  ONE transcription of the printed size table. The overall width/height bounds are declared as
  ergonomic UI guard rails and explicitly NOT manual figures — the manual prints a maximum door
  LEAF but no outer-frame maximum for a doorset, and the "FIXED - (OUTER FRAME SIZE)" 2000 mm row
  would have warned on every ordinary 2100 mm door.
- **`src/catalog/options/doors.ts`** — door leaf type (a real `set-sash-kind` topology edit),
  handle / lock / cylinder / hinges (real catalog-priced 1:1 substitutions), plus door sash profile
  and threshold as INFORMATIONAL options (`pricingMode:"none"` + a helpText saying why — golden
  rule). `adoptShared()` extends 13 family-agnostic options' `familyKeys` in place rather than
  copying them.
- **`src/catalog/families/index.ts`** — the registry. `prisma/seed.ts` now imports `FAMILIES` +
  `buildOptionSystem()` from here and names no family; `mergeOptionSystems()` unions `familyKeys`
  for a shared option key and **throws** if two families define the same key differently.
- **`src/engine/hardware.ts`** — the one engine change: `lock`, `cylinder` and `hinge` join `handle`
  as substitution slots on the door leaf. They qualify by the same test the handle passed (fixed
  quantity per leaf, nothing size-selected). The keep set stays UNSLOTTED on purpose — the engine
  picks R/H or L/H from the hinge side, and a free choice could fit a wrong-handed keep.
  Byte-identical when no override is passed.

**Validation.** `resolve.test.ts#validateSecondFamily` — the door golden test (a defaults-only door
draft reproduces a direct `solve()` byte-for-byte), descriptor-driven assertions, the shared vs
door-specific option split, a hardware substitution that changes the BOM and not the geometry, and a
fanlight split producing the seeded default transom. Live-verified end to end: both families served,
a door resolves and prices (net £245.09), persists on an order beside a legacy casement item, and
confirms into the 7 documents.

## Designer — D8 (presentation pass: realistic preview + simplified inspector)

Owner feedback after using D1–D7: the inspector was overwhelming, the shared UI was noisy, and the
canvas preview "looked basic" next to the reference designer in `collections/windows/views/*.png`.
Three changes, none of which touch fabrication output.

**1. A realistic render style — opt-in, engine-side.** `RenderSvgOpts.style: "flat" | "realistic"`
(`src/engine/svg.ts`). Realistic draws each profile ring as **four mitred trapezoid faces** whose
shared edges ARE the 45° mitres, lit from the top left by a four-stop gradient per face (the doubled
stop near the middle is the moulding step); adds a moulded **bead band** between a sash's inner rect
and its `glassRect`; paints glass with a tinted gradient plus two diagonal reflection bands sized to
sit wholly inside the pane (so no clip path is needed); and casts one `feDropShadow` for the unit,
applied OUTSIDE the mirror group so the internal elevation is lit from the same side.
**No new engine math** — every polygon corner is a corner of a rect the solver already produced.
`schematic` always wins over `style` (a technical drawing must stay flat).

**Woodgrain is catalog data, not a guess.** New nullable `colour_option.texture`
(migration `20260727010000_add_colour_texture`) → `ColourOption.texture?: "woodgrain"` → an
`feTurbulence` + `feColorMatrix` filter on the grained faces (horizontal grain on rails, vertical on
stiles). Nothing about a hex says whether a foil is grained, so an untagged finish renders smooth
and the admin catalog editor gets a Texture select beside the swatch picker. The seed never writes
it, so a reseed cannot clear a finish the owner has tagged (same rule as the uplift %s).

**Threading follows `showJoints`/`views` exactly.** `QuoteInput.svgStyle` → `solve()`;
`ResolveOptions.style` → a per-REQUEST option the draft schema strips, so a saved line item never
remembers the style someone was looking at; `POST /api/line-items/resolve` reads `style` from the
body or `?style=`. **Documents are excluded by construction**: when a realistic preview is asked
for, `solve()` renders a SECOND flat SVG and hands THAT to the document renderers — so
`geometry.svg` is glossy while the work order, cutting list, BOM and price summary stay byte-for-byte
what they were (verified by diffing all 4 documents × 4 designs before/after). The 516 seeded gallery
SVGs are untouched — no re-seed. Consumers: the Designer canvas and the `/quote` preview only.

**2. The inspector is two tabs, not three.** `Measurements | Product`. `structure.tsx` stopped being
a tab and became sections inside Product (`PartsList`, `ComponentActions`, `EditHistory`) that appear
only when they have something to say — parts at item scope, actions when a part is selected, history
only once an edit exists. **The a11y contract is unchanged**: every canvas interaction still has a
keyboard-reachable equivalent, which was the only reason that tab existed. Three further rules, all
structural (so **still no option key anywhere under `web/`**):

- **One group open at a time**, seeded from the option system's own `defaultCollapsed`.
- **"N more" per group**: a row is shown at rest when it is answered, required-and-unset, carrying an
  issue, or among the first three in seed order — and `pricingMode: "none"` rows always start in the
  "more" bucket. Search bypasses the disclosure entirely.
- **One apply-scope control for the whole panel** ("This sash" / "All sashes") instead of a pair of
  pills on every row; an option whose `applyScopes` exclude the panel scope is written its own way.
- Help text moved behind an **ⓘ** per row. Printing every option's caveat paragraph at once was most
  of what made the panel feel dense.
- Qty / customer / save moved out of the header into a **footer action bar** on the inspector.

**3. Shared kit refresh** (`web/components/ui.tsx` + `globals.css`) — ONE elevation scale
(`--shadow-xs/sm/md/lg`) replacing four ad-hoc shadows, one `labelClass` replacing a dozen inline
micro-label declarations, consistent radii, lighter borders, a single focus-ring treatment. **No
component API changed**, so every other page inherits it with no edit. The canvas overlay
(`window-designer.tsx`) picked up drafting-style dimension leaders (hairline + end ticks, no arrow
markers) with an editable white pill carrying a pencil glyph and an amber value, and the selection
highlight gained a white rim so it reads on both glass and profile. The drawing stage
(`.industrial-grid`) lost its blue dot grid for a plain graded field — the reference puts nothing
behind the window, and a pattern competes with the glass reflections.

**4. Issues are actionable.** The Issues popover lists a repair beside each problem instead of only
navigating to it. `web/lib/designer-draft.ts#fixForIssue()` is pure and returns a **reducer action**
(so the reducer stays the draft's only writer): an out-of-range or missing dimension snaps to the
descriptor's own declared bound; a rejected topology edit offers "Undo this change"; an answer
pointing at a component/option/choice that no longer exists offers a reset to the seed's default;
and a required-but-unanswered option offers its OWN `isDefault` choice when it declares one. The
button says what it will do ("Set overall width to 3000 mm"), and a "Fix N automatically" appears
when several are repairable.

**What deliberately has NO one-click fix**, shown as "Needs a decision" with the citation:
`constraint` / `size-limit` — the HAWDIO-cited printed maxima (sash sizes, weights, 1.8 m divider
runs). Resizing a unit until a printed maximum is satisfied is the fabricator's call, not the UI's,
and the printed figure is not on the client to clamp against. `conflicting-selection` is excluded
for the same reason: only the user knows which of two answers they meant. Verified live (7/7): an
out-of-range width offers and applies the clamp, while a 3000×2000 casement raises the
"HAWDIO p70 (PDF 72)" warning with no fix button.

**Validation.** `svg.test.ts` +16 (flat byte-identity, defs/faces/shadow counts, finish-derived
gradient ids, grain only when flagged, schematic-wins, mirror ordering, French/sliding smoke):
**862 → 880 passed**, same 3 pre-existing weld-drift failures. Plus the document byte-identity diff
above, and a live headless-browser pass over all four canvas views with no console errors.

## Designer — D9 (field-report fixes: splits, the confirm gate, the hardware list)

Three defects the owner hit using the Designer on a real job. None of them changes fabrication
math; the first two change what the Designer *lets you do*, the third fills a catalog gap.

**1. A divider dropped into a sash is a MIDRAIL — the opener survives.**
`applyEdit`'s `case "split"` (`src/designer/adapters/cellnode.ts`) copied the whole `CellSpec` into
both children, so splitting an opening sash produced **two complete sash rings** — visually two
windows, with a doubled handle/espag/stay set in the BOM. The first fix made both children **fixed**
— which deleted the opener and its opening chevron instead, and was equally wrong.

**Job 154** settles it (`Work Order - windows - 27-07-2026.pdf`, 5 pages, all 705 × 705): every page
prints ONE T Sash ring (2 × 633 hor + 2 × 633 vert) and ONE handle + ONE 400 mm espagnolette + ONE
16" friction stay. The bar welds **inside** the one ring. So:

| You click a… | What happens |
|---|---|
| **fixed / glass** cell | a real guillotine split — a transom or mullion in the FRAME, both new areas fixed |
| **sash** cell | a **midrail inside the ring** — one opener, one handle, glazing split into panes |

The document reproduces from values already in the catalog — nothing was re-derived: frame face 64
⇒ daylight 577; sash overlap 28 ⇒ ring **633**; `sash-t` face 79 ⇒ ring Int **475**; and
`applyMidrails()`'s existing **`Ext = Int + 2 × face`** ⇒ **609** for the 67 mm SPQ-005-30252 (p1)
and **631** for the 78 mm SPQ-5-30252 (p3 and p4). A third-party production document therefore
confirms three calibrated values *and* the Job 00000264 horn rule, on two profiles and both axes.

**Vertical midrails** are the new engine capability p4 calibrates: `CellSpec.midrails[].axis`
(absent ⇒ `"horizontal"`, so every French quote is byte-identical) and an `applyMidrails()` that
transposes — same arithmetic, other axis — pushing the bar onto `out.mullions` so `emitMullionBars`
prints it **Vert** with the `< - >` horn prep the doc shows. One axis per ring: a pane GRID has no
reference job, so mixing them is a hard error rather than a guess.

`openingSymbol()` (`src/engine/svg.ts`) lost its French-only pane guard for the general rule — **a
glazing-only pane never draws a symbol; the leaf that owns the ring does** — and chevrons are now
collected and appended AFTER every cell in both the flat and realistic paths, because a midrailed
sash's later panes were painting over the leaf's chevron. Disjoint guillotine cells never overlapped,
so this is pixel-identical for every pre-existing design (element order only).

**Not asserted from Job 154, on purpose:** its bead lengths (510 for a 475 pane, where our
Quotila-calibrated rule gives Int + 40 = 515), its glass (500 × 500) and its sash steel at 470 where
ours is the ring Int 475. Those are a different bead/steel convention; adopting them would silently
re-calibrate the whole casement family. Recorded in the job comment as open reconciliation.

**A fanlight is still a frame split** — it is a separate light above the unit, so the frame must
divide. Convert the leaf to glass, split, then set the lower cell back to an opener; asserted
end-to-end on a doorset. The seeded actions also gained **`structure.add-transom-at` /
`add-mullion-at`** (`position:"at-ratio"`), which light up the existing inline prompt — now in
**mm, not %** ("drop 400 mm from the head"), converted by `mm ÷ the outer dimension on that axis`,
the same full-window fraction the canvas drag handles write.

**2. Fabrication limits are ADVISORY, not blocking.** Confirm returned **422** on any
error-severity issue, so a 4050 mm unit could not produce paperwork — while the legacy `/quote`
path, which gates on nothing, had already printed exactly such a work order
(`work_order-welded (2).pdf`, sliding OX 4050 × 1040). `ADVISORY_ISSUE_KINDS` +
`isBlockingIssue()` (`src/designer/line-item-types.ts`) name the three kinds that record a
fabrication JUDGEMENT rather than a broken item — `constraint`, `size-limit`,
`dimension-out-of-range` — and only NON-advisory errors block. **Severity is unchanged**: an
oversize unit still reads red in the inspector with its HAWDIO citation, and D8's `fixForIssue()`
still offers the clamp; the additive `ResolvedLineItem.blocking` is what confirm and the save toast
now read. The manual's own 10% tolerance assumes maxima get exceeded deliberately.

The advisories then **print on the work order**: an optional `DocAdvisory[]` param on
`renderWorkOrder` (same additive pattern as `DocBranding`/`DocBasket`, styled inline like
`weldNote` so the shared `STYLE` constant — and therefore every other document — is untouched).
Omitted **or empty** ⇒ byte-identical. The shop floor is told; the office is not stopped.

**3. The handle dropdown had one entry because the CATALOG had one handle.**
`src/tools/extract-hardware.ts` (build-time, like the M3 topology extractor) transcribes the
owner's real stock list — `collections/part-list/stockitems.json` — into
`src/catalog/hardware-stock.generated.ts`, restricted to the five sub-categories the engine
substitutes 1:1: casement handles, door handles, cylinders, door hinges, door locks.
**128 rows**, spread into `SUNNYPLAST_70.hardware` **before** the hand-written entries so a
calibrated row always wins. All **£0**, no `lengthMm` (so `pickEspag`/`pickFrictionHinge` can never
choose one), referenced by no design and emitted by no cut rule ⇒ **every quote byte-identical**.
Codes are verbatim where the export has one (cylinders: `GBC1`, `9416N`, …) and **synthesized**
from the name where it is blank — the convention `HDL-INLINE`/`DR-HDL-LL`/`FH-90DEG` already set;
reconcile before ordering. The generator dedupes by key AND name against the hand-written rows,
computed as `SUNNYPLAST_70.hardware[k] !== STOCK_HARDWARE[k]`, which is what makes a re-run
byte-identical.

`src/catalog/options/hardware-filters.ts` derives **filter chips** from the supplier's own naming
(finish · style · hand) — pure seed data, so **zero `web/` change**: handle 1 → **35 choices with
14 chips**, door handle **54**, cylinder **15**, hinge **18**, lock **9**. Four rows that share a
category but are not selectable are now excluded with a reason (keep sets — the engine picks the
hand; the French inverter cap / cavity block / shootbolt; the sliding `GLIS-12` cylinder). Cranked
and monkeytail handles are HANDED, so the resolver **warns** (never blocks, never auto-corrects)
when an `L/H`/`R/H` part meets a side-hung leaf of the opposite hand — read from the supplier's own
label, and skipped entirely for top-hung and fixed cells, which have no hand.

**Validation.** `jobs.ts#validateJob154` +27 (the 705 × 705 doc reproduced: ring 633/475, the 609
and 631 bars on both axes with `< - >`, the pane transpose, and ONE handle / espag / stay with the
chevron still drawn on every page), `resolve.test.ts` +27 (a sash split keeps its ring, its kind,
its handle and its ring cut IDENTICALLY; the vertical twin; a fixed cell still splits the frame; a
door leaf midrails while the 3-step fanlight still yields a frame transom; advisory vs blocking both
ways) and `jobs.ts#validateAdvisories` +5 (the band prints its message/citation/item/count; absent
**and** empty ⇒ byte-identical): **880 → 947 passed**, same 3 pre-existing weld-drift failures.
Plus 38 live assertions against the running engine + Postgres — including the two that matter: the
opening chevron **survives** a transom (one chevron, not one per pane, not none), and a
**4050 × 1040 designer item now confirms** with the `HAWDIO p70` note on its work order.

## Conventions

- Comment every fabrication formula with its source (jobnumber / PDF section).
- Use transactions for DB writes (`prisma.$transaction`) — EXCEPT the catalog seed, which uses plain
  idempotent upserts so it survives transaction-mode connection poolers (see M4 seed/pooler fix).
- Validate dimension inputs before calling `solve()`.
- After any change to the catalog or engine, run `npm run validate`.
