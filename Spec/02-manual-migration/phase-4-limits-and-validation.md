# Migration Phase 4 — Limits, Rule Data & Validation Import

## Goal

Import the manual's rule/limit data that the app has never used — size/weight limits, the
sash-weight formula, accessory count rules, the ED lookup table — as **validation and BOM data**,
wired into input validation (and the Designer's constraint system if Task 1 has landed). None of
this changes existing cut math.

## Context-in-a-box

Engine/catalog architecture as in the other phase files (pure engine, seeded catalog, golden rule,
`npm run validate` baseline ~484 + 3 known weld-drift failures). Two integration targets exist for
limits, depending on what's built when this executes:
- **Always**: server-side dimension validation before `solve()` (repo convention "validate
  dimension inputs before calling solve()") — extend wherever that lives (check `src/api/server.ts`
  quote route + orders item validation).
- **If Task 1 (Designer) is present**: the family-descriptor `constraints[]` system
  (`Spec/00-architecture/product-family-plugin.md` §2) is the natural home — emit these as
  descriptor constraints with `source` cites; the resolver evaluates them into issues.

All data below from `HAWDIO 21-7-2026.pdf` (printed/PDF pages); it is UNCHANGED from the old
manual — nothing here is revision-driven; it is catch-up on data both editions carried.

## Data blocks & how each lands

### 1. Size limitations (p70 / PDF 72) → constraints

Per-product max sash sizes/weights (28mm 4-20-4 DGU basis):

| Product | Max sash w×h (mm) | Max kg |
|---|---|---|
| Casement top hung | 1265 × 1342 | 34 |
| Casement side hung | 715 × 1342 | 19.2 |
| Tilt&Turn vent | 1402 × 1402 | 39.3 |
| Residential door leaf | 1002 × 2156 | 43.2 |
| French door leaf | 998 × 2146 | 42.8 |
| Fixed (outer frame) | 3000 × 2000 | 120 |

Plus: multi-light max 2700×1800 @1200Pa with 67/87mm transoms; **longest transom/mullion 1.8m**;
the **10% rule** (one dimension may exceed by ≤10% if the other shrinks until weight ≤ limit).
Implement as **warnings** by default (fabricators do exceed limits deliberately), severity
configurable per constraint; the 10% rule = a second, error-severity bound at 1.1×.

### 2. Custom sash-weight formula (p71 / PDF 73) → pure helper + constraint input

**RESOLVED 2026-07-25 — page re-read, formula confirmed:**

```
glazing kg/m² = (Σ GLASS pane thicknesses in mm) × 2.5     // spacer EXCLUDED
sash kg       = glazing kg/m² × sash w(m) × sash h(m)
```

The worked example prints as `8.4/14/6 = 8+6+4mm of glass (14.4mm)`, then `14.4 x 2.5 = 36kg/m²`.
The unit is pane 8.4 / spacer 14 / pane 6, so the glass total is **8.4 + 6 = 14.4mm** — the
"8+6+4" is the manual's own garbled make-up notation; the bracketed **14.4** is authoritative and
its own next line multiplies it out to 36. Implemented as `glazingWeightPerM2()` / `sashWeightKg()`
in `src/engine/limits.ts`.

**The transcription turned out to be self-verifying.** p70's max weights and p71's formula sit on
separate pages and never reference each other, yet **all 10 rows satisfy
`maxW(m) × maxH(m) × 20 kg/m² = the printed max weight` to 1 d.p.** (20 kg/m² being p70's own
basis: 4-20-4 ⇒ 8mm glass ⇒ 8 × 2.5). For example the residential door: 1.002 × 2.156 × 20 = 43.21
against a printed 43.2; the fixed row: 3.0 × 2.0 × 20 = 120 exactly. `limits.test.ts` asserts this
on every row, validating the formula reading and the table transcription simultaneously — the
strongest check available without a production job.

### 3. Interlocking wedge counts (p66–67 / PDF 68–69) → BOM rule (optional) + constraint

Sash width <800mm: 0 · >800: 1 · >1200: 2 (casement); Reversible bands N/A (family not modelled;
Q-K). Land as: hardware-count rule in the existing per-sash hardware computation IF the wedge
part exists in the catalog (add £0 part, p66 cite); otherwise constraint-only note.

### 4. Trickle vents (p68 / PDF 70) + cill venting (p62–63 / PDF 64–65) + drainage dims (p55–61)

Documents/knowledge data, not cut math: slot 13mm, offsets casement 8 / T&T 10 / French 25;
cill vent Ø5 ≤500mm centres, drill positions per cill (CILL-95: 33, 89.85 · CILL-150: 33, 71,
102, 132 · CILL-180: 33, 71, 102, 132, 165); drainage/pressure slots 30×4. Land as structured
catalog `fabricationNotes` (JSONB on parts or a small table) surfaced on the Work Order document
for the relevant parts — display-only, cited. (Skip if the owner prefers not to clutter docs —
`../questions.md` Q16.)

### 5. External Deduction table (PDF 42 — the unnumbered page) → lookup table for M6 bay/bow

91 rows, 90°→180° (63.2 → 40.85). **Import as a verbatim lookup table** (`src/catalog/`
seed + table `ed_table(angleDeg int PK, edMm decimal)`), following the M5.5 price-list
transcription pattern (verbatim + per-row source cite). Two known print defects: rows 129 and 156
carry a stray `°` in the value column (values 54.62, 47.81). **Never interpolate** (step is
non-uniform: 0.22/° through 129, irregular after). No consumer yet — M6 bay/bow will read it;
gate its import behind actually starting M6 if preferred (owner call, `../questions.md` Q17).

### 6. Manufacture/installation tolerances (p79–81 / PDF 81–83) → documents

±3mm assembled frame (4mm for ≥3-joint members), ≤4mm diagonal difference; fixing positions
(corners 150–250mm, ≥2 per jamb ≤600mm centres, 4.3×25 screws). Candidate for a QC checklist
block on the Work Order — same mechanism as item 4, same Q16 gate.

## Implementation checklist

- [x] `sashWeightKg` helper + verbatim-example test (p71). → `src/engine/limits.ts` (pure,
      cited), tested in `src/engine/limits.test.ts`.
- [~] Glass `paneThicknessesMm` (schema + seed …). **DEFERRED, deliberately — no schema change.**
      Both seeded glass rows are 4-20-4, i.e. exactly the basis the printed limits assume, so
      the column would today hold one constant and buy nothing. `sashWeightKg()` takes the pane
      list as a parameter and `checkSizeLimits()` defaults to `STANDARD_UNIT_PANES_MM` ([4,4]),
      with `paneThicknessesMm: []` meaning "unknown ⇒ skip the weight check" (never guess).
      Add the column when a non-4-20-4 unit is first seeded; the helper needs no change.
- [x] Constraint data: per-family limits (table 1) as … server-side dimension validation warnings;
      severity model per above. → `SIZE_LIMITS` + `checkSizeLimits()`; `POST /api/quote` now
      returns an additive `limitIssues[]`. The Designer doesn't exist yet, so the
      descriptor-constraint route is not applicable; when Task 1 lands, its constraints can be
      generated from `SIZE_LIMITS` rather than re-transcribed.
- [x] Wedge count rule (+£0 part) if part added; else document as constraint note. → **rule
      transcribed and tested (`wedgeCount()`), NO part added and NO BOM line emitted**: the
      manual prints the literal placeholders "( code )" / "( REQ CODE )" where the part number
      belongs, so there is nothing to put in a BOM. Folded into supplier query **Q-J**.
- [x] ED lookup table transcription + seed + integrity test (91 rows, spot-assert 90/135/180,
      defect rows clean) — subject to Q17 gating. → `src/catalog/ed-table.ts` +
      `ed-table.test.ts`. **Deviation from the spec: TS module only, no `ed_table` DB table.**
      It has no consumer until M6, so a DB round-trip adds risk for zero benefit; this follows
      the `price-lists/*` precedent where the transcription IS the source of truth, and M6 can
      seed straight from it. Q17's recommendation ("import now, unconsumed") is honoured.
- [ ] Fabrication-notes mechanism + Work Order surfacing — subject to Q16. **NOT DONE — gated.**
      Q16 is an explicit owner preference about printed-document content, and the phase rule is
      "skip gated steps, never improvise past a gate". The *data* is captured where it was free
      to do so (`TRICKLE_VENT` constants, p68), but nothing is surfaced on any document. Items 4
      and 6 stay open pending the Q16 answer.
- [x] `npm run validate` baseline intact; new tests green; existing quotes byte-identical.

## Verification results (2026-07-25)

- New files: `src/engine/limits.ts` + `limits.test.ts`, `src/catalog/ed-table.ts` +
  `ed-table.test.ts`; both test suites wired into `npm run validate`.
- `npx tsc --noEmit` clean. **`npm run validate`: 571 passed, 3 failed** — up from the 481-passed
  baseline (+90 new assertions, all green), with the same 3 pre-existing weld-drift failures and
  no new ones.
- Byte-identity holds by construction: `solve()`, `bars.ts`, `pricing.ts` and the documents are
  untouched; `limits.ts` is imported only by its test and the quote route, and `ed-table.ts` only
  by its test. Nothing in this phase can move a cut size or a price.
- Live end-to-end check against the running API: a 800×1200 side-hung quote returns
  `limitIssues: [warning sash-oversize]` (its 728mm sash genuinely exceeds the printed 715mm
  side-hung max — a real constraint, not noise), and a 1100×1500 one returns both
  `error sash-oversize-beyond-10pct` and `error sash-overweight` (29.36 kg vs 19.2 kg). In both
  cases the full quote and price are still returned — the check is advisory, never blocking.

## Acceptance criteria

- Oversize/overweight configurations produce cited warnings (and errors past 110%) without
  blocking preview; confirm behaviour per severity.
- Sash-weight formula reproduces the manual's worked example exactly.
- ED table (if imported) is verbatim, defect-corrected, spot-asserted, and unconsumed by cut math.
- Zero change to any existing computed output (byte-identity check).

## Out of scope

Deflection-based transom limits (blocked on Q-G — the chart is missing from the PDF), Reversible
family (Q-K), bay/bow geometry itself (M6), length-dependent sash reinforcement (Q-F).
