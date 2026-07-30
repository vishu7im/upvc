# Phase 5 — Main Options on documents, the Job 169 suite, and the audit

## Goal

Make our work order print what the reference's prints, prove the whole module against Job 169, and
record what was deliberately not adopted.

## Context-in-a-box

Every page of the Job 169 Work Order opens with a **Main Options** table — a two-column list of
every option answered for that item (Colour External/Internal, the four Frame rows, Transom,
Add-on, Joint, Bead, Sash Type, Cylinder, Handle, Hinge, Hinge Colour, Hinge Position, Lock,
Glazing Method, Glass Type, Gas Fill, Opening Direction, Component Type, Drainage, Location, Split
Position). Ours prints a fixed header and no option list.

The additive-document pattern is well established: `DocBranding` (M4), `DocBasket` (D6) and
`DocAdvisory` (D9) are all optional params on a renderer that produce byte-identical output when
omitted, and `DocAdvisory` is styled **inline** specifically so the shared `STYLE` constant — and
therefore every other document — stays untouched. Follow it exactly.

`ResolvedLineItem.summary` already carries the answered options; nothing new needs computing.

## Deliverables

1. **`DocOptions[]`** (`{ label, value }`) — an optional param on `renderWorkOrder`, rendered as
   the Main Options block under the header, styled inline. Omitted **or empty** ⇒ byte-identical.
2. **`JOB_169_DOOR` in `src/validation/jobs.ts`** — the five pages as five assertion blocks, using
   `topologyOverride` so no reseed is required (the `validateJob154` pattern):

   | Page | Asserts |
   |---|---|
   | 1 | add-on top: frame 1005 / **1980**, sash 925 / **1900**, midrail **871** `< - >` with **no** steel, beads 750 / 231 / 1456, glass 740 × 221 and 740 × 1446, sash steel 710 / **1685** |
   | 2 | add-on bottom: identical frame/sash/steel to p1; beads 831 / 856; glass 740 × 846 and 740 × 821 |
   | 3 | add-on left: frame **980** / 2005, sash **900** / 1925, vertical midrail **1871** `< - >` **with** 26×26 U **1710**, glass 346 × 1740 and 321 × 1740 |
   | 4 | add-on right: same frame/sash as p3; horizontal midrail **846** with **no** steel; beads 725 / 756 / 956; glass 715 × 946 and 715 × 746 |
   | 5 | no add-on: frame 1005 / 2005, sash 925 / 1925, vertical midrail **1871** with steel **1710**, beads 1750 ×4 / 356 ×4, glass 346 × 1740 ×2 |

   Plus, on **every** page: exactly one handle, one lock, one cylinder, three hinges, one sash ring.
3. **`src/engine/svg.test.ts`** — the add-on band toggles independently and absent ⇒ byte-identical.
4. **The audit**, in the genre of `../01-windows-module/phase-7-audit.md`: files touched by class
   (`seed-data` / `platform-fix` / `tests` / `docs`), contract gaps found and closed, and what is
   deliberately not modelled.

## Deliberately NOT adopted from Job 169 (record, do not silently absorb)

- **The add-on's own cut length.** The Cutting List itemises no add-on row. Emitting one would be an
  inference. Recorded as a new question.
- **Gasket 01 / 02 metreage.** Job 169 prints 11.26 / 6.294 m (p1). Our Gasket 01 = 2 × Σ sash outer
  perimeter and Gasket 02 = Σ glass perimeter are calibrated on Jobs 85/88/90; reconciling the two
  conventions needs its own pass, not a quiet swap.
- **"Run Up Block"** — an accessory line with no catalog part.
- **The "Mechanical" joint deduction** — offered by the reference, evidenced by no document.

## Implementation checklist

- [x] `src/engine/documents.ts`: `DocOptions` + inline-styled Main Options block.
- [x] `src/api/orders.ts` + `src/engine/solve.ts`: feed it from the resolved summary.
- [x] `src/validation/jobs.ts`: `JOB_169_DOOR` (5 blocks) wired into the runner.
- [x] `src/engine/svg.test.ts`: add-on band assertions.
- [x] `CLAUDE.md`: a "Doors module" section; update the assertion counts.
- [x] `../questions.md`: Q6 → RESOLVED (Job 169), plus the new questions above.
- [x] This file's audit section, written after execution.

## Audit (written after execution, 2026-07-30)

### Verdict

The doors module landed as **one new engine concept** (`frameRect`), **one widened one**
(a frame profile per edge), and otherwise pure seed data. `web/` changed in exactly two places —
the picker tile now renders `choice.image`, and the admin catalog gained an upload cell — and
**no option key entered the UI**, so the D3/D8 rule still holds.

### Files touched, by class

| File | Class | What / why |
|---|---|---|
| `src/types.ts` | platform | `SolvedGeometry.frameRect`, `QuoteInput.addons` / `.frameKeys`, `Design.frameKeys`, `JointMethod`, `Reinforcement.minBarLengthMm`, `DocOption` — all optional, all byte-identical when absent |
| `src/engine/{topology,bars,svg,solve,documents}.ts` | platform | the frame rect, per-edge frame bars, the add-on band, the Main Options block |
| `src/catalog/system-sunnyplast.ts` | seed-data | `aux-ext-25.faceWidthMm = 25`, `reinf-26x26-u.minBarLengthMm = 1000` |
| `src/catalog/options/{windows,doors,hardware-filters}.ts` | seed-data | 4 add-on + 4 frame-edge + divider + joint options; the reference's remaining door rows; per-slot style chips; `image` on every hardware choice |
| `src/catalog/glyphs.ts` | platform | the drawing (new, pure) |
| `src/api/{catalog,catalog-assets,server,orders}.ts` | platform | the asset route + admin upload + Main Options plumbing |
| `src/designer/{option-types,resolve,line-item-types,adapters/cellnode}.ts` | platform | the `addon` effect, the per-edge `side` param, `set-divider`, `summary.mainOptions` |
| `prisma/` | migration | `minBarLengthMm` column; the weld-drift data fix |
| `web/components/designer/controls/index.tsx`, `web/app/(app)/admin/catalog/*`, `web/lib/api.ts` | ui | render the picture; upload a replacement |
| `src/validation/jobs.ts`, `src/catalog/glyphs.test.ts`, `src/engine/svg.test.ts`, `src/designer/options.test.ts` | tests | Job 169, per-edge frames, joint method, glyphs, the add-on band |

### Contract gaps found, and how they were closed

1. **The frame was assumed to fill the unit.** Every consumer read `outer`. Closed by
   `SolvedGeometry.frameRect`, defaulting to `outer` — one concept, absent by default.
2. **Split ratios were unit-relative.** Job 169 p1 prints 375 + 1600 = 1975 (the FRAME height), so
   `walk()` now takes the frame rect instead of two window dimensions. Identical without an add-on.
3. **`OptionChoice.image` was fully plumbed and completely unused** — typed, migrated, seeded,
   loaded and served, with nothing writing it and nothing rendering it. Closed by a generator, an
   asset route and six lines in the picker.
4. **A three-year-old red baseline was data, not code.** The 3 weld failures were DB drift; Job 169
   is the third document to prove 2.5 mm/end. `npm run validate` is now **0 failed**.

### What is deliberately NOT modelled

- **The add-on's own cut length** (questions.md Q21) — the reference itemises no row for it.
- **The mechanical joint deduction** (Q22) — offered, warned about, cut as welded.
- **The other three reinforcement thresholds** (Q23) — the manual states them, no production
  document evidences them, and the calibrated Quotila jobs are the source of truth for those parts.
- **The Job 169 gasket convention** (Q24) — it contradicts Jobs 85/88/90; left alone.
- **Coupling and bay/bow profiles** — parts exist, no reference job, and no `faceWidthMm`, so they
  cannot be selected as an add-on.

## Acceptance criteria

- `npm run validate` sits at its baseline + the new assertions. **Result: 1129 passed, 0 failed**
  (the previous baseline was 947 passed + 3 pre-existing weld failures, now fixed).
- A work order rendered without `DocOptions` is byte-identical to before.
- All five Job 169 pages reproduce.

## Out of scope

- Reconciling the gasket convention.
- A Glass Order document (we print the glass table inside the work order and BOM).
