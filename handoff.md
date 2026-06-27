# uPVC SaaS Engine — Project Handoff

---

## 1. WHAT THIS PROJECT IS

A SaaS competitor to **Quotila** (uPVC window/door fabrication software for India/UK markets). The product workflow is:

```
Customer order → Pick design from library → Set W×H dimensions →
Live SVG preview → Auto-generate: Work Order + Cutting List + BOM + Price Quote
```

The user has **admin access to Quotila** and intercepted API responses & 6 PDF documents (3 work orders + 3 matching cutting lists) for reverse-engineering. We avoided ingesting Quotila's data directly (IP risk) and instead reverse-engineered the **physical fabrication rules** from real work orders.

### Architecture decision

- **Engine** (this codebase) — robust, stateless backend that does all geometry, parts derivation, cutting, pricing, document generation
- **SaaS UI** — user will build their own production frontend on top of this engine via REST API

### Target system (Phase 1)

- **Sunny Plast 70mm** profile system (used by user's Indian fabrication shop)
- Two product lines: **Casement windows** (5-Chamber 64mm frame) + **Single doors** (6-Chamber 68mm frame)
- Currency: **GBP** • Tax: **20%** • Markup: **75%** • Wastage: **10%**
- Stock bar: **6000mm** • Saw kerf: **5mm**

---

## 2. THE THREE REAL JOBS (SOURCE OF TRUTH)

Every rule in this codebase was derived from these three actual Quotila outputs. Keep these for validation.

### JOB 85 — 1200 × 1200, Top-Hung over Fixed, Z-transom

**Drawing:** Top section 400mm tall has top-hung sash; bottom 800mm is fixed glass. Transom at y=400.

**Materials from Work Order:**

- Frame: SPQ-5-10252 64mm 5 Chamber (all 4 sides)
- Transom: SPQ-05-20252/SPQ-005-30252 67mm (Welded, Z-type — the Chasement Z Sash)
- Sash Type: Casement top hung left hand
- Glass: 4-20-4 Clear Low E
- Hardware: 4× Mushroom Striker, 2× Run Up Block, 1× Inline Handle, 1× 1000mm Espagnolette, 1× 8" Friction Hinge
- Gaskets: Gasket 01 = 5946mm, Gasket 02 = 6158mm
- Glazing Bridge Packer: 13

**Cutting List:**
| Section | Description | Qty | Int | Ext | H/V | End Prep |
|---|---|---|---|---|---|---|
| Bead | 28mm Bead | 2 | 1072 | 1112 | Hor | `[ - ]` |
| Bead | 28mm Bead | 2 | 702.5 | 742.5 | Vert | `[ - ]` |
| Bead | 28mm Bead | 2 | 970 | 1010 | Hor | `[ - ]` |
| Bead | 28mm Bead | 2 | 200.5 | 240.5 | Vert | `[ - ]` |
| Frame | Frame 5 Chamber | 2 | 1072 | 1200 | Hor | `\ - /` |
| Frame | Frame 5 Chamber | 1 | 336 | 400 | Vert | `\ - Y]` |
| Frame | Frame 5 Chamber | 1 | 736 | 800 | Vert | `\ - Y]` |
| Frame | Frame 5 Chamber | 1 | 736 | 800 | Vert | `[Y - /` |
| Frame | Frame 5 Chamber | 1 | 336 | 400 | Vert | `[Y - /` |
| Frame | Chasement Z Sash | 1 | 1072 | 1206 | Hor | `< - >` |
| Sash | T Sash | 2 | 970 | 1128 | Hor | `\ - /` |
| Sash | T Sash | 2 | 200.5 | 358.5 | Vert | `\ - /` |
| Frame | 13×29 Steel Reinforcement | 1 | 1072 | 1072 | Hor | `[ - ]` (in transom) |
| Sash | 28×24 Steel Reinforcement | 2 | 970 | 970 | Hor | `[ - ]` |
| Sash | 28×24 Steel Reinforcement | 2 | 200.5 | 200.5 | Vert | `[ - ]` |

**Glass:**

- 1× 1007 × 238 (top sash)
- 1× 1102 × 732 (bottom fixed)

### JOB 88 — 800 × 1200, Top-Hung + Side-Hung, T-transom

**Drawing:** Top 400mm = top-hung sash; bottom 800mm = side-hung left sash. Transom at y=400.

**Materials from Work Order:**

- Frame: SPQ-5-10252 64mm 5 Chamber
- Transom: SPQ-05-20252/SPQ-005-30252 67mm (Welded, **T-type — the Chasement T Sash**)
- Hinge (Casement) (S/H) = Standard ← side-hung indicator
- Hinge (Casement) (T/H) = Standard ← top-hung indicator
- Hardware: 4× Mushroom Striker, 3× Run Up Block, 2× Inline Handle, 2× 600mm Espagnolette, 1× 8" Friction Hinge, 1× 16" Friction Hinge
- Gaskets: Gasket 01 = 10292mm, Gasket 02 = 4178mm
- Glazing Bridge Packer: 16

**Cutting List:**
| Section | Description | Qty | Int | Ext | H/V |
|---|---|---|---|---|---|
| Bead | 28mm Bead | 4 | 570 | 610 | Hor |
| Bead | 28mm Bead | 2 | 200.5 | 240.5 | Vert |
| Bead | 28mm Bead | 2 | 600.5 | 640.5 | Vert |
| Frame | Frame 5 Chamber | 2 | 672 | 800 | Hor |
| Frame | Frame 5 Chamber | 2 | 1072 | 1200 | Vert ← jambs UNBROKEN (T-transom) |
| Frame | Chasement T Sash | 1 | 672 | 806 | Hor (transom) |
| Sash | T Sash | 4 | 570 | 728 | Hor |
| Sash | T Sash | 2 | 200.5 | 358.5 | Vert |
| Sash | T Sash | 2 | 600.5 | 758.5 | Vert |
| Sash | 28×24 Reinforcement | 4 | 570 | 570 | Hor |
| Sash | 28×24 Reinforcement | 2 | 200.5 | 200.5 | Vert |
| Sash | 28×24 Reinforcement | 2 | 600.5 | 600.5 | Vert |

**Glass:**

- 1× 607 × 238 (top sash)
- 1× 607 × 638 (bottom sash)

### JOB 90 — 1400 × 2000, Single Door + Sidelight + 2 Toplights

**Drawing:** Full-height mullion at x=700 splits left/right. In each half, transom at y=400 creates a small toplight. Bottom-left = sidelight (fixed), bottom-right = door (right-hung).

**Materials from Work Order:**

- Frame: **SPQ-6-11252 68mm 6 Chamber** (different from windows — heavier door frame)
- Transom + Mullion: SPQ-5-30252 78mm (both same profile, Welded)
- Sash Type: Door right hung
- Glass: 4-20-4 Clear Tuff Low E (tempered for door)
- Hardware: 1× Run Up Block, 1× Lever/Lever Handle, 3× Flag Hinge White, 1× R/H Keep Set, 1× Standard Door Lock, 1× Brass Cylinder
- Gaskets: Gasket 01 = 8792mm, Gasket 02 = 11752mm
- Glazing Bridge Packer: 23

**Cutting List (key entries):**
| Section | Description | Qty | Int | Ext | H/V |
|---|---|---|---|---|---|
| Frame | Frame 6 Chamber | 2 | 1264 | 1400 | Hor |
| Frame | Frame 6 Chamber | 2 | 1864 | 2000 | Vert |
| Frame | T Transom/Mullion | 1 | 1864 | 2020 | (Mullion — full-height) |
| Frame | T Transom/Mullion | 2 | 593 | 749 | (Transom pieces, one each side of mullion) |
| Frame | 26×26 U Reinforcement | 1 | 1864 | 1864 | (in mullion only) |
| Sash | Door Sash Z | 2 | 439 | 649 | Hor |
| Sash | Door Sash Z | 2 | 1339 | 1549 | Vert |
| Sash | 28×44.5 U Reinforcement | 2 | 439 | 439 | Hor |
| Sash | 28×44.5 U Reinforcement | 2 | 1339 | 1339 | Vert |
| Bead | 28mm Bead | 6 | 593 | 633 | Hor (3 fixed cells × 2 each) |
| Bead | 28mm Bead | 4 | 293 | 333 | Vert (2 toplights × 2 each) |
| Bead | 28mm Bead | 2 | 1493 | 1533 | Vert (sidelight) |
| Bead | 28mm Bead | 2 | 439 | 479 | Hor (door panel) |
| Bead | 28mm Bead | 2 | 1339 | 1379 | Vert (door panel) |

**Glass:**

- 2× 623 × 323 (toplights, fixed)
- 1× 469 × 1369 (door panel, sash-glazed)
- 1× 623 × 1523 (sidelight, fixed)

---

## 3. CALIBRATED RULES (THE PHYSICS)

**All numbers below were derived from the three jobs above — NOT from a spec sheet. They are what makes the engine produce the same cuts the shop floor is used to.**

### Profile face widths (= the miter deduction)

| Profile                          | Face (mm)     | Derived from                     |
| -------------------------------- | ------------- | -------------------------------- |
| Frame 5-Chamber (SPQ-5-10252)    | **64**        | 1200 Ext − 1072 Int = 128 = 2×64 |
| Frame 6-Chamber (SPQ-6-11252)    | **68**        | 1400 Ext − 1264 Int = 136 = 2×68 |
| T Sash (casement)                | **79**        | 728 Ext − 570 Int = 158 = 2×79   |
| Door Sash Z                      | **105**       | 649 Ext − 439 Int = 210 = 2×105  |
| Transom T-67 (SPQ-05-20252)      | **67**        | 806 Ext − 672 Int = 134 = 2×67   |
| Transom Z-67 (SPQ-005-30252)     | **67**        | 1206 Ext − 1072 Int = 134 = 2×67 |
| Mullion/Transom 78 (SPQ-5-30252) | **78**        | 2020 Ext − 1864 Int = 156 = 2×78 |
| Bead 28mm                        | **20** (face) | 1112 Ext − 1072 Int = 40 = 2×20  |

### Cell-level constants

| Quantity                         | Value               | Source                                              |
| -------------------------------- | ------------------- | --------------------------------------------------- |
| Sash-to-frame overlap            | **28mm per side**   | (Sash outer − cell daylight) ÷ 2 = (728−672)/2 = 28 |
| Sash glass rebate (T Sash)       | **18.5mm per side** | Glass − Sash bead Int = 1007−970 = 37 → 18.5/side   |
| Frame glass rebate (fixed cells) | **15mm per side**   | Glass − Frame bead Int = 1102−1072 = 30 → 15/side   |
| Door glass rebate (Door Sash Z)  | **15mm per side**   | Glass − Door bead Int = 469−439 = 30 → 15/side      |

### THE FORMULAS

```text
Frame bar Ext         = window dimension (W or H)
Frame bar Int         = Ext − 2 × frame_face

Transom Ext           = daylight_width  + 2 × transom_face
Transom Int           = daylight_width
Mullion Ext           = daylight_height + 2 × mullion_face
Mullion Int           = daylight_height

Cell daylight height (between frame top + transom centered at y=T):
                      = T − frame_face − transom_face/2

Sash outer            = cell_daylight + 2 × 28  (overlap per side)
Sash bar Ext          = sash outer dim
Sash bar Int          = Ext − 2 × sash_face

Bead Int              = sash inner (sash-glazed) OR cell daylight (fixed)
Bead Ext              = Bead Int + 2 × 20    (bead face)
Bead end-prep         = "[ - ]"   (SQUARE CUT — confirmed despite Ext>Int)

Glass dimension       = bead Int + 2 × glass_rebate
                        (18.5 if cell has T Sash; 15 if fixed or door)

Reinforcement length  = bar Int  (NO end-clearance in this system — confirmed)

Gasket 01 length      = 2 × Σ sash outer perimeter (across all opening sashes)
Gasket 02 length      = Σ glass perimeter (across all glass pieces, sash AND fixed)
```

### Z-transom vs T-transom (CRITICAL distinction)

| Transom type                             | Effect on outer frame jambs                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| **T-type** (Chasement T Sash, T Transom) | Jambs stay continuous — emit 2 full-length vertical pieces                            |
| **Z-type** (Chasement Z Sash)            | Jambs are BROKEN at transom centerline — emit 4 vertical pieces with Y-notch end-prep |

For Z-transom at split height T from top:

- Top jamb piece: Ext = T, Int = T − frame_face, end-prep `\ - Y]`
- Bottom jamb piece: Ext = H − T, Int = (H − T) − frame_face, end-prep `[Y - /`
- Sum of two pieces = H exactly (no extra material consumed by the Y-joint)

### Reinforcement allocation rule

| Profile                                                | Reinforcement                                   |
| ------------------------------------------------------ | ----------------------------------------------- |
| Frame 5-Ch / Frame 6-Ch                                | **None** (in observed jobs)                     |
| T Sash (casement)                                      | **28 × 24 Steel** — every sash bar              |
| Door Sash Z                                            | **28 × 44.5 U Steel** — every door bar          |
| Chasement Z Sash (Z-transom)                           | **13 × 29 Steel** — Z-transom always reinforced |
| Chasement T Sash (T-transom)                           | **None** — T-transom NOT reinforced             |
| Mullion/Transom 78mm (full-height mullion)             | **26 × 26 U Steel**                             |
| Mullion/Transom 78mm (transom pieces in upper section) | **None**                                        |

### Hardware allocation rules (calibrated)

**Top-hung casement sash:**

- 1× Inline Handle, 1× Espagnolette (largest standard ≤ sash WIDTH), 1× Friction Hinge (size from sash HEIGHT)
- Mushroom Strikers = 2 if espag ≤ 600mm, else 4
- 2× Run Up Block

**Side-hung casement sash (left or right):**

- 1× Inline Handle, 1× Espagnolette (largest ≤ sash HEIGHT), 1× Friction Hinge (size from sash WIDTH)
- Mushroom Strikers = 2 if espag ≤ 600mm, else 4
- 1× Run Up Block

**Single door (right or left hung):**

- 1× Lever Handle, 3× Flag Hinge, 1× Door Lock, 1× Cylinder, 1× R/H or L/H Keep Set, 1× Run Up Block
- No mushroom strikers, no friction hinges

**Espagnolette sizes (standard, mm):** 600, 800, 1000
**Friction hinge banding (calibrated):**

- dim ≤ 400 → 8" (200mm)
- ≤ 500 → 10"
- ≤ 600 → 12"
- ≤ 800 → 16"
- ≤ 1000 → 20"
- > 1000 → 24"

### Approximate / placeholder rules (NEED MORE DATA)

These are best-guess from 3 data points — **revisit when more sample jobs available**:

- **Glazing Bridge Packer**: currently `5 × glassCount + 3 base`. Job 85 (2 glass) → 13 ✓; Job 88 (2 glass) → 16 (off); Job 90 (4 glass) → 23 ✓. Not perfectly consistent.

---

## 4. CATALOG REFERENCE

### Sunny Plast 70mm part codes

| Code                     | Name              | Face      | Notes                                       |
| ------------------------ | ----------------- | --------- | ------------------------------------------- |
| SPQ-5-10252              | Frame 5 Chamber   | 64mm      | Window frame                                |
| SPQ-6-11252              | Frame 6 Chamber   | 68mm      | Door frame                                  |
| SPQ-T-SASH (placeholder) | T Sash            | 79mm      | Casement sash, overlap=28, glassRebate=18.5 |
| SPQ-DOOR-Z (placeholder) | Door Sash Z       | 105mm     | Door panel, overlap=28, glassRebate=15      |
| SPQ-05-20252             | Chasement T Sash  | 67mm      | T-type transom                              |
| SPQ-005-30252            | Chasement Z Sash  | 67mm      | Z-type transom (breaks jamb)                |
| SPQ-5-30252              | T Transom/Mullion | 78mm      | Used as mullion AND heavy transom           |
| BEAD-28 (placeholder)    | 28mm Bead         | 20mm face | All glazing beads                           |

Reinforcement codes: `REINF-28x24`, `REINF-13x29`, `REINF-26x26-U`, `REINF-28x44.5-U`
Gasket codes: `GKT-01` (weather seal), `GKT-02` (glazing seal)
Glass codes: `G-4-20-4-LE` (Low E), `G-4-20-4-TLE` (Tuff Low E for doors)

**Cost/Price values currently 0** — engine works end-to-end with zeros; user will populate from supplier price list. Nothing in engine logic needs to change.

### Financial categories (from user spec)

Frame – (Standard), Sash – (Standard), Beads, Structural T/Z – (Standard), Reinf - (steel), Gasket/Woolpile, Glazing Accessories, Casement Handles, Casement Locking, Casement Extras, Friction Stays, Door Handle, Door Hinge, Door Lock, Cylinders.

---

## 5. CODEBASE STRUCTURE

```
upvc-saas-engine/
├── package.json                          tsx + express, ESM modules
├── tsconfig.json
├── README.md
├── src/
│   ├── types.ts                          All TypeScript contracts — read first
│   ├── catalog/
│   │   ├── system-sunnyplast.ts          The Sunny Plast 70mm system (all rules)
│   │   ├── designs.ts                    Design library (8 designs including Job 85/88/90)
│   │   ├── settings.ts                   Default GBP/20%/75%/10%
│   │   └── index.ts                      Registry
│   ├── engine/
│   │   ├── topology.ts                   Cell tree → geometry (where math lives)
│   │   ├── bars.ts                       Geometry → cut pieces (deductions applied)
│   │   ├── hardware.ts                   Per-cell hardware allocation
│   │   ├── cutting.ts                    First-fit-decreasing 1D bin packing
│   │   ├── pricing.ts                    Material + labour + markup + tax
│   │   ├── svg.ts                        SVG preview generator
│   │   ├── documents.ts                  HTML for WorkOrder/CuttingList/BOM/Quote
│   │   └── solve.ts                      Main: solve(input) → QuoteOutput
│   ├── api/
│   │   └── server.ts                     Express API
│   └── validation/
│       └── jobs.ts                       132 assertions vs Jobs 85/88/90
└── public/
    ├── index.html                        Driver UI
    └── app.js                            Driver UI logic
```

**Total: ~3,100 lines across 20 files.**

### Topology DSL (used in designs.ts)

```ts
type CellNode =
  | { kind: "leaf"; cell: { content: SashKind; sashKey?: string } }
  | {
      kind: "hsplit";
      splitAtRatio: number;
      transomKey: string;
      top: CellNode;
      bottom: CellNode;
    }
  | {
      kind: "vsplit";
      splitAtRatio: number;
      mullionKey: string;
      left: CellNode;
      right: CellNode;
    };

type SashKind =
  | "fixed"
  | "casement-side-left"
  | "casement-side-right"
  | "casement-top"
  | "door-right"
  | "door-left";
```

**Use exact fractions** (e.g. `1/3`, not `0.333`) — preserves mm accuracy.

### API surface

```
GET  /api/systems         List profile systems
GET  /api/designs         List designs
POST /api/quote           Run engine: body { systemId, designId, widthMm, heightMm, customer, orderNo }
                          Returns full QuoteOutput { geometry, parts, cuttingPlan, pricing, documents }
POST /api/quote/document  Run engine + return one HTML document
```

### Tech stack decisions

- **TypeScript + tsx** (no compile step — just `tsx src/api/server.ts`)
- **ESM modules** (`.ts` imports with explicit `.ts` extension)
- **No database** — catalog in source files. Easy to migrate to Postgres later (just swap `catalog/index.ts` for a DB-backed loader).
- **No PDF library** — documents are HTML, ready for Puppeteer/Playwright when needed.
- **No frontend framework in driver UI** — vanilla JS, replaceable by user's SaaS UI.

---

## 6. VALIDATION STATUS

`npm run validate` runs `src/validation/jobs.ts` with **132 assertions** across the three jobs:

```
==================================================
RESULTS:  132 passed,  0 failed
==================================================
```

Each assertion checks one of: bar code+Ext, bar Int, glass dimension pair, gasket length, hardware quantity. **Every cut length matches Quotila's output to the millimetre.**

**Tolerance**: ≤ 0.6mm to allow for Quotila's intermediate rounding (some Int values like 237.5 get rounded to 238 in their PDFs).

---

## 7. WHAT'S DONE vs WHAT'S PENDING

### ✅ Done

- Engine reproduces Jobs 85, 88, 90 exactly (132/132)
- All 7 Sunny Plast profile types calibrated
- T-transom and Z-transom logic (including jamb-breaking)
- Mullion + transom-in-vsplit-half (Job 90's door layout)
- Sash outer / inner / glass rectangles computed
- 4 document HTML renderers (WorkOrder/CuttingList/BOM/Quote)
- SVG preview with hinge-direction arrows
- 1D cutting stock optimization (FFD + kerf)
- Pricing pipeline (material + wastage + labour + markup + VAT)
- 8 designs in library
- Express API + driver UI
- Validation harness

### 🟡 Approximated (works but needs more data)

- Glazing Bridge Packer count rule (3 data points insufficient)
- Friction hinge size bands (calibrated to 2 sizes seen; more sizes need verification)
- Labour costs (placeholder values £25/sash, £60/door, £30 base)

### 📋 Pending (user-driven next steps)

1. **Fill supplier prices** — replace `cost: 0, price: 0` in `system-sunnyplast.ts` (all the way through; the engine math is already correct)
2. **Add more designs** — currently 8; user has access to Quotila's ~345 design SVGs. Each one needs a topology entry. The DSL is simple — most are 5-20 lines each.
3. **Optional: Map to Quotila's design UUIDs** — user has the UUIDs and wants to link them to our internal designIds. Add a `quotilaUuid?: string` field to `Design` interface and populate.
4. **Build production SaaS UI** — replace `public/index.html`
5. **PDF generation** — wrap document HTML in Puppeteer for PDF download
6. **Persist to DB** — Postgres tables for systems, designs, orders. Swap `catalog/index.ts` for DB loader.
7. **More profile systems** — Veka, Rehau, Aluplast, etc. Each gets its own `system-<name>.ts`.
8. **Multi-window orders** — wrap `solve()` in an order endpoint that aggregates BOM + cutting across multiple windows
9. **Hardware variants** — colours (gold, anthracite), security upgrades
10. **More structural details** — coupling profiles, structural mullions for >2m heights

---

## 8. CRITICAL THINGS NOT TO BREAK

If a future Claude is editing this code:

1. **Keep validation passing.** Run `npm run validate` after ANY change to:
   - `src/catalog/system-sunnyplast.ts`
   - `src/catalog/designs.ts` (Job 85/88/90 designs)
   - `src/engine/topology.ts`
   - `src/engine/bars.ts`
   - `src/engine/hardware.ts`
     132/132 must stay green.

2. **Do not change** the deduction constants in `system-sunnyplast.ts` for: frame faces (64, 68), sash faces (79, 105), transom/mullion faces (67, 67, 78), bead face (20), overlap (28), glass rebates (18.5/15/15). These are physical facts about the system.

3. **Bead end-prep is `[ - ]` (square)** even though Ext > Int. The Ext/Int difference reflects the bead's foot vs lip geometry, not miters. Do not change to `\ - /`.

4. **Reinforcement length = bar Int**, no end clearance, for Sunny Plast. Different from other systems we may add later — keep the catalog-driven approach.

5. **Split ratios should be exact fractions** (`1/3`, `0.5`, `0.2`) not decimal approximations (`0.333`). Decimal approximations break mm accuracy.

6. **Currency, tax, markup, wastage** all come from `Settings`, never hardcode anywhere else.

7. **Z-transom only breaks the OUTER frame jambs** when it's at the ROOT level of the topology. Nested Z-transoms (not yet supported) would need more thought.

---

## 9. KNOWN AMBIGUITIES / OPEN QUESTIONS

For the next Claude or the user to resolve when more data arrives:

1. **When does a transom get reinforcement?** Pattern from 3 jobs:
   - Z-transom (Chasement Z Sash) → always reinforced (Job 85)
   - T-transom (Chasement T Sash) → NOT reinforced (Job 88)
   - 78mm full-height mullion → reinforced (Job 90)
   - 78mm transom pieces in upper section → NOT reinforced (Job 90)
     Current implementation: per-profile via `reinforcementMap`. Works for these cases. May need to become per-context (e.g. transom carrying a top-hung sash always reinforced).

2. **Run Up Block count** — derived rule "2 per top-hung, 1 per side-hung, 1 per door" matches all 3 jobs perfectly but is only 3 data points.

3. **Hinge direction interpretation** — Quotila's SVGs use a triangular pointer where the arrow TIP is on the HINGE side. Current engine encodes this convention in `src/engine/svg.ts`. If user's preview shows arrows backward, flip there.

4. **Door swing direction (open in vs open out)** — Job 90 has "Opening Direction: Open In" in the work order. Currently not captured in our `SashKind`. Add if needed.

5. **Mullion full-height vs partial-height** — current implementation makes mullions in `vsplit` always full-height (Job 90 case). If a mullion should only span part of the height (e.g. only above a transom), need a different topology arrangement.

---

## 10. HOW TO PICK UP WORK

A fresh Claude session should:

1. Read this doc end-to-end.
2. `cd upvc-saas-engine && npm install && npm run validate` — confirm 132/132 green.
3. `npm start` and open http://localhost:3000 — confirm engine runs.
4. Then ask the user what's next:
   - "Add new designs?" → edit `src/catalog/designs.ts`
   - "Fill supplier prices?" → edit `src/catalog/system-sunnyplast.ts` cost/price fields
   - "Add new profile system?" → copy `system-sunnyplast.ts`, register in `catalog/index.ts`
   - "Fix something the user complained about?" → likely in `engine/bars.ts` or `engine/topology.ts`
   - "PDF export?" → add Puppeteer to `engine/documents.ts`
   - "DB persistence?" → swap `catalog/index.ts`

---

## 11. USER CONTEXT

- Building this as a SaaS to **compete with Quotila** (the Indian uPVC software market).
- Has admin access to Quotila for reference (designs, work orders) — won't be data-importing it directly (IP risk).
- ESL English, on mobile, prefers concise responses and concrete deliverables over long discussions.
- Wants Claude to build robust engine + minimal UI, then will build their own production SaaS UI on top.
- Long-term vision: support multiple profile systems (Sunny Plast first, then Veka/Rehau/Aluplast/Schüco), multiple regions, multiple currencies.

---

## 12. ONE-PARAGRAPH SUMMARY (in case the doc gets truncated)

We built a TypeScript+Express engine that takes a design + W×H and outputs a Quotila-compatible cutting list, work order, BOM, and price quote — calibrated to Sunny Plast 70mm by reverse-engineering 3 real Quotila work orders (Jobs 85, 88, 90). Engine math is in `src/engine/`, catalog in `src/catalog/`, types in `src/types.ts`. All deduction constants (frame face = 64/68mm, sash face = 79mm, door = 105mm, transom = 67/78mm, bead = 20mm, sash overlap = 28mm, sash glass rebate = 18.5mm, frame glass rebate = 15mm) come from those 3 jobs. Z-transoms break the outer frame jambs (4 vertical pieces with `\ - Y]` / `[Y - /` end-prep), T-transoms don't (2 continuous pieces). Reinforcement length = bar Int (no end-clearance). Bead end-prep is square `[ - ]`. Gasket 01 = 2× Σ sash perimeter; Gasket 02 = Σ glass perimeter. Run `npm run validate` — 132/132 pass. Catalog prices are currently 0; user will fill from supplier price list. Next steps: add more designs (~345 to go), fill prices, PDF export, multi-window orders.

---

**End of handoff document.**
