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
`npm run validate` runs **435 assertions** (432 green + 3 pre-existing DB weld-drift failures —
see memory/validate-weld-drift.md; they are not a regression signal).

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

# 4. Prove the engine is intact (MUST be 147 passed, 0 failed):
npm run validate         # 132 default jobs + 3 custom-mode + 12 M3 extractor assertions

# 5. Run the API:
npm start                # http://localhost:3005  (or PORT from .env)
```

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

**Authenticated (JWT bearer — `Authorization: Bearer <token>`):**

- `POST /api/auth/login` → `{ token, user }`; `GET /api/auth/me`; `POST /api/auth/register` (admin only)
- `GET  /api/products?page&limit` · `GET /api/products/:id` · `GET /api/products/:id/designs?page&limit`
  (paginated gallery; SVG-only designs flagged `quotable:false`)
- `GET  /api/designs/:id` — single design incl. `imageSvg` + `quotable`
- `POST /api/orders` (draft) · `GET /api/orders?page&limit` · `GET /api/orders/:id`
- `POST /api/orders/:id/items` (rejects non-quotable designs) · `DELETE /api/orders/:id/items/:itemId`
- `POST /api/orders/:id/confirm` → generates & persists 7 documents (aggregated across items)
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
- `src/validation/jobs.ts` — the 147-assertion geometry safety net (run after ANY engine/catalog
  change); also calls `src/tools/extract-topology.test.ts#validateExtractor` and (M5)
  `src/engine/pricing.test.ts#validatePricing` (+10 colour-uplift assertions → 157 total).
- `src/tools/extract-topology.ts` — M3 SVG→topology extractor (build/seed-time; pure of the engine).
- `src/catalog/derived-topologies.generated.ts` — generated extractor output (DO NOT hand-edit).

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
- **External Deduction (ED) table** by corner angle for bay/bow assemblies: 90°=63.2 mm down to
  135°=53.2 mm. Needed when bay/bow products are added (engine is 90°-rectangular only today).
- **Clear-opening (door) formula:** `Clear Opening = W − (X1 + 40) − (SW + 44.5)`.
- **Per-product glass-deduction tables** (Casement, Tilt&Turn, French, Residential Door, …) give
  authoritative glass sizes; they differ by frame chamber (5ch vs 6ch). Use these to extend glass
  sizing beyond the 3 calibrated jobs.

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
refinement.

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
  Int=H−96; mitred `\ - /`, continuous jambs. Sash `SPQ-GL-20252` ("Canat pentru glisare 85mm")
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

**Tests:** `src/engine/svg.test.ts#validateSvg` (render-option byte-identity + joints/tint markers),
`pricing.test.ts` (+ summed dual-colour uplift), and `jobs.ts#validateColourAndJoints` (solve-level
White+White == default, joints additive, joints don't change pricing) — all wired into `npm run validate`.

## Conventions

- Comment every fabrication formula with its source (jobnumber / PDF section).
- Use transactions for DB writes (`prisma.$transaction`) — EXCEPT the catalog seed, which uses plain
  idempotent upserts so it survives transaction-mode connection poolers (see M4 seed/pooler fix).
- Validate dimension inputs before calling `solve()`.
- After any change to the catalog or engine, run `npm run validate`.
