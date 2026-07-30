# Doors Module — Phase Map

> Task 3: bring the **entrance-door** family up to parity with the reference configurator, using
> the owner's package in `collections/doors/` (14 screenshots, `lineitems.json` = the reference
> app's own 41-row option payload, and the **Job 169** production documents: a 5-page Work Order,
> its Cutting List and its Glass Order, all 1000 × 2000 single doors).
> Architecture in `../00-architecture/` (read `overview.md` first). The Designer platform this
> builds on is `../01-windows-module/`.

## What Job 169 established

The five pages exercise a plain leaf, a horizontal divider at two positions, a vertical divider at
two positions, and a 25 mm add-on on each of the four frame edges (every divider is the 78 mm
SPQ-5-30252, whatever the option row calls it). **Every printed number
reproduces from values already calibrated in `src/catalog/system-sunnyplast.ts`** — this document
validates the catalog rather than changing it:

| Value | Existing calibration | Job 169 confirms |
|---|---|---|
| `frame-6ch` faceWidth 68 | Job 90 | daylight 864 = 1000 − 2×68 |
| `sash-door-z` overlap 28, face 105 | Job 90 | ring 920 = 864 + 56; Int 710 = 920 − 210 |
| `Ext = Int + 2 × face` (midrail) | Job 00000264 (French) | **871**, **846** and **1871** — all the 78 mm SPQ-5-30252, at Int 710 / 685 / 1710 |
| bead Ext = pane + 40 | Quotila 85/88/90 | 725 / 756 / 956 / 1750 / 356 |
| glass = pane + 30 (rebate 15) | Job 90 | 715 × 946, 346 × 1740 |
| sash steel = ring Int | Job 90 | 685 / 710 / 1685 / 1710 |
| `Settings.weldAllowanceMm = 2.5` | Jobs 85/88/90 | every printed size = finished + 5 |

It also confirms, from a third party, the **D9 midrail rule**: all five pages carry ONE sash ring,
ONE handle, ONE lock, ONE cylinder and 3 hinges — the divider welds inside the leaf whichever
button ("Transom" / "Mullion" / "Horizontal Midrail" / "Vertical Midrail") was pressed.

Two findings are genuinely new, and both are phase 1:

- **Add-on geometry** — a 25 mm `SPQ-2-75252` on an edge shortens the frame by exactly 25 mm on the
  perpendicular axis and leaves the parallel axis alone (independently verified on all four edges).
  This resolves `../questions.md` **Q6**.
- **Reinforcement is length-dependent** — `SPQ-5-30252` carries its 26×26 U steel at Int 1710 but
  not on the short runs. That is the manual's ">1 m" rule, now evidenced by a production document.

## Owner decisions (fixed — do not re-litigate)

- **Add-on: match the document exactly.** It changes the frame's geometry and prints in Main
  Options; it emits **no cut row**, because the reference Cutting List prints none.
- **Hardware art: generated SVG glyphs + an admin photo upload that overrides them.** The
  reference's pictures are third-party CDN JPEGs; we do not hotlink them.
- **Option scope: full parity, honestly gated.** Every reference row appears; anything with no
  catalog part and no calibrated rule ships `pricingMode:"none"` + a helpText saying why.
- **Per-edge frame profiles and per-divider joint method: build now.**

## Phases & dependency graph

```
phase-1-addon-profiles        engine: frameRect + per-edge add-ons (windows AND doors),
        │                     length-dependent reinforcement
phase-2-per-edge-profiles     engine: a frame profile per edge, a joint method per divider
        │
        ├── phase-3-choice-imagery      catalog+api+web: a picture on every hardware choice
        ├── phase-4-door-option-parity  seed: the reference's remaining option rows
        └── phase-5-documents-and-audit docs: Main Options block, JOB_169 suite, audit
```

Phases 3 and 4 are parallelisable after phase 2. Phase 5 requires all others.

## Per-phase one-liners & key deliverables

| Phase | Delivers | Primary code locations |
|---|---|---|
| 1 | `SolvedGeometry.frameRect`, `QuoteInput.addons`, four per-edge add-on options shared by both families, `Reinforcement.minBarLengthMm` | `src/types.ts`, `src/engine/{topology,bars,svg}.ts`, `src/catalog/options/windows.ts` |
| 2 | `Design.frameKeys` per edge, asymmetric daylight/bars, `jointMethod` per divider with an honest warning for `mechanical` | `src/engine/{topology,bars}.ts`, `src/catalog/options/*` |
| 3 | `src/catalog/glyphs.ts`, `GET /api/catalog/assets/hardware/:partKey`, admin upload, `image` on hardware choices, `ImageChoices` renders it | `src/catalog/glyphs.ts`, `src/api/catalog.ts`, `web/components/designer/controls/index.tsx` |
| 4 | Hinge colour (real substitution) + hinge count / restrictor / ventilators / glass decoration / gas fill / opening direction (gated) | `src/catalog/options/doors.ts` |
| 5 | Optional `DocOptions` Main-Options block, `JOB_169_DOOR` validation suite, extensibility audit | `src/engine/documents.ts`, `src/validation/jobs.ts` |

## Cross-phase conventions (apply to every phase)

- **Engine purity**: no I/O in `src/engine/*` or `src/designer/*`. Every engine extension is
  additive and byte-identical when unused, keeping `npm run validate` at its baseline
  (**1129 passed, 0 failed** — the 3 long-standing weld failures turned out to be DB
  drift and are fixed by migration `20260730020000`; `memory/validate-weld-drift.md`).
- **Golden rule**: no guessed fabrication values. An option with no calibrated effect is
  documents-only (`pricingMode:"none"` + `presentation.helpText` saying why) and never fabricates.
- **Seeds are source of truth**; idempotent upserts, no interactive transactions (pooler-safe).
- **Admin writes call `loadCatalog()`** to refresh the in-memory snapshot.
- **No option key may appear under `web/`** — the D3/D8 rule. Anything the UI needs must arrive as a
  schema field.
- **Verification stack per phase**: `npx tsc --noEmit`, `npm run validate`,
  `cd web && npm run build && npm run lint`, plus the phase's own assertions and a live pass.
- Each phase file is self-contained (context-in-a-box) — executable in a fresh session with only
  that file + the `00-architecture/` folder.
