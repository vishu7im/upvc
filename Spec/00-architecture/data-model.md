# Data Model — Prisma Schema Deltas

> Database changes for the Designer platform: option system, family descriptors, line items,
> basket commercials. Self-contained. Existing schema: `prisma/schema.prisma`; existing
> conventions: Decimal for money, JSONB for topology, seed = idempotent upserts WITHOUT interactive
> transactions (pooler-safe — hard repo requirement), `loadCatalog()` refresh after admin writes.

## 1. New tables

```prisma
model ProductFamily {
  key        String   @id                    // "casement-window"
  name       String
  status     String   @default("active")     // active | hidden | deprecated
  descriptor Json                            // full ProductFamilyDescriptor (plugin spec §2)
  updatedAt  DateTime @updatedAt
  @@map("product_family")
}

model OptionGroup {
  key              String      @id           // "hardware"
  name             String
  order            Int
  icon             String?
  defaultCollapsed Boolean     @default(true)
  scope            String      @default("mixed")   // item | component | mixed
  options          OptionDef[]
  @@map("option_group")
}

model OptionDef {
  key          String         @id            // "hardware.handle"
  groupKey     String
  group        OptionGroup    @relation(fields: [groupKey], references: [key])
  name         String
  order        Int
  display      String                        // select | select-image | segmented | toggle | number | text | action
  required     Boolean        @default(false)
  scope        Json                          // {level, componentTypes, applyScopes}
  filters      Json?                         // [{key,label}]
  visibility   Json?                         // rule DSL
  validation   Json?
  presentation Json?
  pricingMode  String         @default("catalog")  // catalog | none
  action       Json?                         // TopologyEdit template (display=action only)
  familyKeys   String[]                      // which families show it (denormalised for fast load)
  choices      OptionChoice[]
  @@map("option_def")
}

model OptionChoice {
  key         String    @id                  // "handle-white-inline" (globally unique slug)
  optionKey   String
  option      OptionDef @relation(fields: [optionKey], references: [key])
  label       String
  order       Int
  isDefault   Boolean   @default(false)
  filterKeys  String[]
  image       Json?                          // {kind, ref}
  swatchHex   String?
  partKey     String?                        // catalog part/glass/hardware key → price/BOM (no inline prices — golden rule)
  engineEffect Json?                         // {kind, params}
  visibility  Json?
  @@map("option_choice")
}

model DesignerLineItem {
  id         String   @id @default(uuid())
  orderId    String
  order      Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  position   Int                             // stable ordering within the order
  draft      Json                            // LineItemDraft   (line-item-schema §2) — AUTHORITATIVE
  resolved   Json?                           // ResolvedLineItem (§3) — CACHE, nullable
  catalogVersion String?                     // provenance of the cached resolve
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@unique([orderId, position])
  @@map("designer_line_item")
}
```

### Why JSONB documents instead of relational selections

Selections/edits are (a) always read/written as a whole document, (b) schema-versioned, (c) never
queried relationally ("find all orders with anthracite handles" is a reporting job, not OLTP). The
repo already stores topology as JSONB on `design` — same trade-off, proven here. `draft` is
authoritative; `resolved` is a nullable cache (`catalogVersion` detects staleness). Indexed lookups
happen via the parent order only.

## 2. `Order` extensions (basket commercial layer — phase 6)

```prisma
model Order {
  // … existing fields unchanged (status, totalPrice snapshot, items, documents, …)
  fittingType        String?  @default("none")     // none | fit | fit-and-survey  (drives which extras apply)
  fittingPrice       Decimal? @db.Decimal(12, 2)
  surveyPrice        Decimal? @db.Decimal(12, 2)
  deliveryCharge     Decimal? @db.Decimal(12, 2)
  discountCode       String?
  discountAmount     Decimal? @db.Decimal(12, 2)   // snapshot of the applied discount at confirm
  taxRatePct         Decimal? @db.Decimal(5, 2)    // null ⇒ settings default (existing VAT setting)
  designerItems      DesignerLineItem[]
}

model DiscountCode {
  code       String   @id
  kind       String                          // percent | fixed
  value      Decimal  @db.Decimal(12, 2)
  active     Boolean  @default(true)
  validFrom  DateTime?
  validTo    DateTime?
  @@map("discount_code")
}
```

Totals derivation (single pure function, `src/designer/basket.ts`, used by API + documents):

```
itemsSubtotal   = Σ designer items (resolved grandTotal × qty) + Σ legacy items (existing path)
discount        = discountCode applied to itemsSubtotal (percent | fixed, floor 0)
extras          = fittingPrice + surveyPrice + deliveryCharge (per fittingType applicability)
taxable base    = itemsSubtotal − discount + extras
tax             = base × taxRatePct (default from existing Settings VAT)
grandTotal      = base + tax
```

Confirm snapshots all of these onto the order (extends the existing `totalPrice` snapshot
convention). The reference `basketsummary.json` also carries tax-exempt splits and exchange rate —
**deferred**, recorded in `questions.md` (Q9, Q10); the schema above must not preclude adding
`priceTaxExempt`/`exchangeRate` columns later.

## 3. Coexistence with legacy `OrderItem`

- Legacy `/quote` flow keeps writing `OrderItem` untouched (owner decision: build alongside).
- An order may contain both kinds. Lists, totals, confirm, and documents iterate
  `items ∪ designerItems` (position-sorted). Document aggregation reuses the existing
  `aggregate.ts` merge — the resolver produces the same engine outputs legacy items do, so the
  7-document pipeline needs no per-kind branching beyond fetching inputs.
- **No migration of existing rows.** A later optional migration script may convert legacy items to
  `LineItemDraft` form (mapping is total: designId + W×H + glassKey/colourKeys/cillKey/splitRatios
  all have direct slots), but nothing in Task 1 depends on it.

## 4. Migrations & seed

- New migrations (plain SQL, `migrate deploy`-compatible — pooler constraint, see CLAUDE.md
  runbook): `add_designer_option_system` (4 option/family tables), `add_designer_line_items`,
  `add_basket_commercials` (order columns + discount_code).
- Seed: `prisma/seed.ts` gains `applyFamilyDescriptors()` + `applyOptionSystem()` reading new seed
  sources `src/catalog/families/*.ts` (descriptors) and `src/catalog/options/*.ts` (groups/defs/
  choices). Idempotent upserts by key, NO interactive transaction. Seeds never overwrite
  owner-edited fields (repo convention: cost/price/weight/weld are owner-owned — for options, the
  owner-owned fields are `presentation`, `order`, `defaultCollapsed`).
- Loader: `src/catalog/loader.ts` additionally loads families + option system into the in-memory
  snapshot; new accessors `getFamily(key)`, `listFamilies()`, `getOptionSystem(familyKey)` exported
  via `src/catalog/index.ts` (same synchronous-accessor pattern as `getSystem`).

## 5. Integrity rules

- `OptionChoice.partKey` values are validated at seed/admin-write time against the catalog (reject
  dangling keys — a dangling partKey silently prices to 0, which violates auditability).
- Deleting a choice/option that persisted line items reference is forbidden at admin level; use
  `status`/visibility gating instead (line items are historical records).
- `DesignerLineItem.draft.schemaVersion` gates readers; resolver refuses versions it doesn't know
  (fail-loud) rather than best-effort parsing.
