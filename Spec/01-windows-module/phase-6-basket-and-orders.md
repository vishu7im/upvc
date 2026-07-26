# Phase 6 — Basket & Orders (Commercial Layer)

## Goal

Order-level commercials — fitting price, survey price, delivery charge, discount codes, tax — with
a basket summary UI, invalid-item surfacing, and document/admin integration. Owner decision: this
is IN scope for Task 1 ("full basket").

## Context-in-a-box

Orders today: `src/api/orders.ts` — draft orders hold items; confirm re-solves, generates 7 HTML
documents (aggregated via `src/engine/aggregate.ts`), snapshots `Order.totalPrice`; confirmed
orders are immutable; PDFs render lazily (`src/services/pdf.ts` + object storage). Settings
(`GET/PUT /api/settings`, single row) already hold financial settings incl. VAT/markup — check
`src/catalog/settings.ts` for the exact fields before adding tax config. Orders UI:
`web/app/(app)/orders/` (list + detail with add/remove/confirm/documents). Phase 2 added designer
line items coexisting with legacy items. Contracts for this phase:
`../00-architecture/data-model.md` §2 (Order columns, `DiscountCode`, totals derivation — the
formula there is normative), `../00-architecture/line-item-schema.md` (issues/`invalidSpec`
rollups). Reference for scope (concepts only): `collections/windows/basketsummary.json` — fitting/
survey/delivery/discount/tax(-exempt)/exchange-rate; we implement all EXCEPT tax-exempt splits and
exchange rates (deferred — `Spec/questions.md` Q9/Q10).

## Deliverables

1. **Migration** `add_basket_commercials`: Order columns (`fittingType`, `fittingPrice`,
   `surveyPrice`, `deliveryCharge`, `discountCode`, `discountAmount`, `taxRatePct`) +
   `discount_code` table, per `data-model.md` §2.
2. **Totals engine** `src/designer/basket.ts` — ONE pure function
   `computeBasket(order, items, settings) → BasketTotals` implementing the normative formula
   (items subtotal → discount → extras → tax → grand total). Unit tests: percent + fixed
   discounts, floor-at-zero, fittingType applicability matrix, default-vs-override tax rate,
   mixed legacy+designer items.
3. **API** (`src/api/orders.ts` extensions):
   - `PUT /api/orders/:id/commercials` (draft only, auth'd): set fitting/survey/delivery/
     discountCode/taxRatePct; validates discount code (active + window) and stores the computed
     `discountAmount` snapshot; response includes fresh `BasketTotals`.
   - `GET /api/orders/:id` includes `basket: BasketTotals` (computed live for drafts, snapshotted
     for confirmed).
   - Confirm: snapshot all commercial fields + totals (extend the existing `totalPrice` snapshot);
     confirm is blocked (422) while any designer item has error issues (phase 2 behaviour) — the
     response enumerates per-item issues so the UI can badge rows.
   - Admin CRUD for discount codes (follow `src/api/catalog.ts` admin pattern; no loadCatalog
     needed — not catalog data).
4. **Documents**: Price Summary (and the aggregated order docs where totals appear) gain a basket
   block — subtotal, discount line (with code), fitting/survey/delivery lines (only when set),
   tax line with rate, grand total. Implemented as data passed into the existing pure
   `documents.ts` renderers (new optional param, same additive pattern as `DocBranding`/
   `DocImage[]` — **omitted ⇒ byte-identical output**, keeping validation green).
5. **Orders UI**:
   - Order detail (draft): "Pricing & extras" card — fittingType select, three price inputs,
     discount code field with apply/validate feedback, tax override; live totals panel.
   - Items table: per-item status badge (OK / n issues) with popover of issues; "Open in designer"
     per designer item (deep link with `itemId`, phase 3 supports it).
   - Order list: grand total column reads the new basket totals.
   - Admin: `/admin/discounts` simple CRUD page (existing admin patterns).
6. **Legacy compatibility**: orders with only legacy items get the same basket features (formula
   consumes both item kinds); `/quote`-created flows unaffected otherwise.

## Implementation checklist

- [x] Migration + `prisma generate`. `20260726020000_add_basket_commercials`: seven nullable
      `order` columns + `basketTotals` JSONB (the frozen snapshot) + the `discount_code` table.
      Plain SQL, `migrate deploy`-compatible; applied to the live DB 2026-07-26.
- [x] `basket.ts` + unit tests. `computeBasket()` is the only place order money is derived;
      **65 assertions** in `basket.test.ts`, wired into `npm run validate`.
- [x] Commercials endpoint + discount validation + confirm snapshotting.
      `PUT /api/orders/:id/commercials` (draft-only) validates the code before storing it and
      returns fresh totals; confirm freezes `basketTotals` + `discountAmount` + `totalPrice`.
- [x] Documents basket block. Optional `DocBasket` on `renderPriceSummary` + `renderPlannerList`;
      omitted ⇒ byte-identical (asserted live: a plain order's Price Summary has no block and keeps
      the engine's own GRAND TOTAL row).
- [x] Orders UI: pricing & extras card with a live totals ledger, confirm errors listing WHICH item
      and why, per-line totals on both item tables, basket total on the list, `/admin/discounts` CRUD.
- [x] End-to-end (live engine + Postgres, 2026-07-26): draft with a designer door + a legacy
      casement ×2 → fit-and-survey + £200/£60/£40 + a 10% code → confirm → the Price Summary carries
      the whole block and the list, the detail page and the document all say £685.88.
- [x] `npm run validate` → **862 passed, 3 failed** (the same three pre-existing weld-drift
      assertions — memory/validate-weld-drift.md); root `tsc` clean; `web` build + lint clean
      (23 routes).

### Verification performed (live engine + Postgres, 2026-07-26)

46 end-to-end assertions, all green. The ones that matter:

- **One number everywhere.** The orders list, `GET /api/orders/:id` and the confirmed Price
  Summary all report £685.88 for the same order. The document's block and the UI ledger are two
  renderings of one `BasketTotals`.
- **Discount validation is a 400 with a reason**: `Unknown discount code: NOPE`,
  `Discount code E2EOLD has expired`. A percentage over 100 and a duplicate code are rejected at
  creation (400 / 409).
- **Applicability matrix**: switching `fit-and-survey` → `fit` drops the survey charge to £0 and
  keeps the fitting; delivery is charged either way.
- **Immutability**: after confirm, changing the discount code from 10% to 50% leaves the confirmed
  total at £685.88, and `PUT /commercials` returns 409.
- **Byte-identity**: an order with no commercial data prints the pre-phase-6 Price Summary.

### Deviations from this file's formula (both deliberate, both to keep ONE number)

1. **The items subtotal is PRE-TAX.** The formula above sums each item's `grandTotal`, but the
   engine's grand total already includes VAT — taxing that base again charges VAT twice on every
   item. `computeBasket` sums `netPrice` and applies tax exactly once, over items − discount +
   extras. For an order with no commercials this reproduces the engine's own grand total.
2. **The subtotal is the AGGREGATED order price, not the sum of the lines.** `aggregateOrder()`
   prices a multi-item order as one job — flat setup labour once, wastage over the merged material
   — and that is what the BOM and Price Summary print. Charging the line sum instead would have
   overcharged the verification order by **£105.03** relative to its own paperwork. The lines keep
   their individual prices and the gap is shown as an explicit `itemsAdjustment`
   ("Order-level adjustment — shared setup") rather than being hidden.

Also worth recording: **discount codes got their own RBAC module** (`discounts`, registry-driven,
nav path `/admin/discounts`) rather than borrowing `catalog` as the D1 option PATCH did — they are
commercial data, not catalog data, and no `loadCatalog()` refresh is involved. Run
`npm run sync:permissions` (or `db:seed`) after deploying so the module row exists.

## Acceptance criteria

- The normative formula is implemented in exactly one place (`basket.ts`) and every surface
  (API response, order UI, documents) agrees to the penny for the same order.
- Discount edge cases: expired code rejected with message; fixed discount larger than subtotal
  floors at zero; removing the code recomputes.
- Confirmed orders show frozen totals even after later price/settings changes (immutability).
- An order containing an invalid designer item cannot confirm; the UI shows which item and why.
- Documents without commercial data render byte-identical to before (assertion).

## Out of scope

Tax-exempt line splits, multi-currency/exchange rates (Q9/Q10), quotes-vs-orders workflow
separation, customer-facing pricing portals.
