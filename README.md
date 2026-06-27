# uPVC SaaS Fabrication Engine

A robust, modular engine for uPVC window & door quote generation — calibrated against real Sunny Plast 70mm work orders. Designed to power your SaaS UI.

## What it does

Given **a design + dimensions**, it produces:

- **Solved geometry** — every cell, sash, transom, mullion, and glass pane with mm-accurate positions
- **SVG preview** — live drawing in real mm coordinates
- **Cutting list** — every bar to cut, with Ext/Int lengths, end-prep notation, V/H orientation
- **Work order** — shop-floor document matching the Quotila format
- **BOM** — parts grouped by financial category
- **Cutting plan** — 1D bin-packing across 6m stock bars with kerf compensation
- **Pricing** — material → labour → markup → VAT → grand total

## Validated against real Quotila jobs

The engine reproduces — to the millimetre — the cut sizes, glass dimensions, gasket lengths, and hardware quantities from your real jobs:

| Job | Design | Dimensions |
|-----|--------|------------|
| 85 | Top-hung sash over fixed (Z-transom) | 1200 × 1200 |
| 88 | Top-hung over side-hung (T-transom) | 800 × 1200 |
| 90 | Single door + sidelight + 2 toplights | 1400 × 2000 |

Run `npm run validate` to verify.

## Quick start

```bash
npm install
npm start
```

Open **http://localhost:3000** — drives the engine via the API and renders everything.

To verify the engine against the three reference jobs:

```bash
npm run validate
```

## Architecture

```
src/
├── types.ts                       Contracts — read this first
├── catalog/
│   ├── system-sunnyplast.ts       The Sunny Plast 70mm catalog (all rules)
│   ├── designs.ts                 Topology templates (Job 85, 88, 90 + more)
│   ├── settings.ts                GBP, 20% VAT, 75% markup, 10% wastage
│   └── index.ts                   Registry
├── engine/
│   ├── topology.ts                Cell tree → solved geometry
│   ├── bars.ts                    Geometry → cut pieces (the deductions live here)
│   ├── hardware.ts                Cell types → hardware allocation
│   ├── cutting.ts                 First-fit-decreasing 1D bin packing
│   ├── pricing.ts                 Material + labour + markup + tax
│   ├── svg.ts                     SVG preview renderer
│   ├── documents.ts               Work order / cutting list / BOM / quote HTML
│   └── solve.ts                   Main orchestrator: solve(input) → QuoteOutput
├── api/
│   └── server.ts                  Express HTTP API
└── validation/
    └── jobs.ts                    Test harness — Jobs 85/88/90
```

## API endpoints

```
GET  /api/systems                  List available profile systems
GET  /api/designs                  List available designs
POST /api/quote                    Run the engine, return everything
POST /api/quote/document           Run engine, return one document as HTML
```

### POST /api/quote

```json
{
  "systemId":  "sunnyplast-70",
  "designId":  "win-th-over-fixed-z",
  "widthMm":   1200,
  "heightMm":  1200,
  "customer":  "Mr Smith",
  "orderNo":   "ORD-001",
  "reference": "Kitchen window"
}
```

Returns the full `QuoteOutput` — geometry, parts, cutting plan, pricing, four ready-to-print HTML documents.

## The deduction rules (calibrated from your real outputs)

Every number below was derived from your three sample jobs, not from a spec sheet:

| Profile | Face | Source |
|---|---|---|
| Frame 5-Chamber (64mm) | **64mm** | Job 85/88: Ext 1200 − Int 1072 = 128 = 2×64 |
| Frame 6-Chamber (68mm) | **68mm** | Job 90: Ext 1400 − Int 1264 = 136 = 2×68 |
| T Sash | **79mm** | Job 88: Ext 728 − Int 570 = 158 = 2×79 |
| Door Sash Z | **105mm** | Job 90: Ext 649 − Int 439 = 210 = 2×105 |
| Transom 67mm | **67mm** | Job 85/88 |
| Mullion 78mm | **78mm** | Job 90 |
| Bead 28mm | **20mm** (face) | Bead Ext − Int = 40 = 2×20 |
| Sash-to-frame overlap | **28mm/side** | (Sash outer − cell daylight) ÷ 2 |
| Sash glass rebate | **18.5mm/side** | Glass − Sash bead Int = 37 |
| Frame/door glass rebate | **15mm/side** | Glass − Frame bead Int = 30 |

The formulas:

```
Frame bar Ext         = window dimension
Frame bar Int         = Ext − 2 × frame_face

Transom Ext           = daylight_width + 2 × transom_face
Mullion Ext           = daylight_height + 2 × mullion_face

Cell daylight (under transom):
                      = section height − frame_face − transom_face/2

Sash outer            = cell_daylight + 2 × 28
Sash bar Ext          = sash outer dim
Sash bar Int          = Ext − 2 × sash_face

Bead Int              = sash inner OR cell daylight (for fixed)
Bead Ext              = Int + 2 × 20

Glass                 = bead Int + 2 × glass_rebate

Gasket 01             = 2 × Σ sash outer perimeter
Gasket 02             =      Σ glass perimeter
```

## Extending the engine

### Add a new profile

Edit `src/catalog/system-sunnyplast.ts` and add to `frames` / `sashes` / `transoms`:

```ts
"frame-new": {
  code: "SPQ-NEW",
  name: "Frame New 70mm",
  faceWidth: 70,
  glassRebate: 15,
  cost: 12.50, price: 18.00,
  per: "m",
  weight: 1.2,
  financialCategory: "Frame – (Standard)",
}
```

### Add a new design

Edit `src/catalog/designs.ts` and add a `Design` object. The topology is recursive — combine `leaf`, `hsplit`, `vsplit` nodes.

Example: a 3-cell tilt-and-turn window:

```ts
{
  designId: "win-3cell-tt",
  name: "3-Cell Tilt & Turn",
  productType: "window",
  frameKey: "frame-5ch",
  topology: {
    kind: "vsplit",
    splitAtRatio: 0.333,
    mullionKey: "mullion-78",
    left:  { kind: "leaf", cell: { content: "casement-side-left", sashKey: "sash-t" } },
    right: {
      kind: "vsplit",
      splitAtRatio: 0.5,
      mullionKey: "mullion-78",
      left:  { kind: "leaf", cell: { content: "fixed" } },
      right: { kind: "leaf", cell: { content: "casement-side-right", sashKey: "sash-t" } },
    },
  },
}
```

### Add a new profile system

Copy `src/catalog/system-sunnyplast.ts` to a new file, change the deductions, register it in `src/catalog/index.ts`. The engine doesn't need to know about it.

### Fill in supplier prices

Open `src/catalog/system-sunnyplast.ts` and replace the `cost: 0, price: 0` values with your supplier's price list. Nothing else needs to change — totals will start computing immediately.

### Calibrate hardware rules

Open `src/engine/hardware.ts`. The friction-hinge ranges and run-up block counts are encoded as plain code — edit and re-run validation.

## Performance

- **Engine call**: < 5ms for a single window on a laptop
- **Stateless**: no DB, no session — pure function `solve(input) → output`
- **Concurrent**: Express handles many requests in parallel; engine has no shared mutable state

## Roadmap suggestions

1. **Persist catalog in DB** — Postgres tables for `profiles`, `designs`, `systems`. The engine reads via an interface; swap the in-memory module for a DB-backed loader.
2. **PDF generation** — pipe the HTML documents through Puppeteer or `@react-pdf/renderer`.
3. **Multi-window orders** — wrap `solve()` in an order endpoint that takes an array of inputs and aggregates BOM + cutting plan across the order.
4. **More transom/mullion types** — e.g. coupling profiles, structural mullions for >2m heights.
5. **Hardware variants** — colours (gold, anthracite), security upgrades, T-shape handles.
6. **More profile systems** — Veka, Rehau, Aluplast, Schüco. Each gets its own `system-<name>.ts`.
