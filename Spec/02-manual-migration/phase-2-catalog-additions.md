# Migration Phase 2 — Catalog Additions & Reconciliations

## Goal

Add the revision's new catalog entities, fix documentation/provenance errors, and apply whichever
code reconciliations the supplier answers (from `supplier-queries.md`) unblock. Partially gated:
ungated items first, gated items as answers arrive (this file marks each).

## Context-in-a-box

Catalog architecture: Postgres via Prisma; seed sources in `src/catalog/system-sunnyplast.ts`
(profiles/steels/glass/gaskets/hardware for the Sunnyplast system) are the source of truth,
applied by `prisma/seed.ts` (idempotent upserts; NEVER overwrites owner-edited cost/price/weight/
weldAllowanceMm). Loader: `src/catalog/loader.ts`. Supplier prices are applied separately by
`npm run import:prices` from verbatim transcriptions in `src/catalog/price-lists/*` (M5.5) — new
parts start at cost/price 0 unless present in those price lists (golden rule: no guessed prices).
Reinforcement mapping: `reinforcement_map` table + catalog. Validation baseline: ~484 passed + 3
known weld-drift failures. Manual cites below = `HAWDIO 21-7-2026.pdf` printed/PDF pages; full
diff in `findings.md`.

## Work items

### Ungated (do now)

1. **New steel `SPQ-2-83997`** (35×15 box, p17/PDF 18) and **`SPQ-2-83998`** (25×10 box, p17):
   add as reinforcement parts (cost/price 0, cite p17). Do NOT map them into
   `reinforcement_map` — no manual page assigns them to a host profile yet; note their likely
   roles (35×15 = cill-95 alternative per N6/p12; 25×10 = frame-extension steel per p13) in the
   part comments, unmapped until a calibrated source assigns them.
2. **New profile `SPQ-050-30252` "T" Mullion 70mm** (75×70, p11/PDF 12; EI p74 bare-only): add as
   a transom/mullion `profile_part` with face width **75** cited to p11, cost/price 0 (it is not
   in the M5.5 price lists — flag for the next price-list revision), and NOT referenced by any
   design (no deduction set exists for it yet — glass-deduction pages only cover the existing
   mullions; add the part, don't wire it into topology defaults).
3. **Cill-95 alternative reinforcement 35×15** (p12): record on the cill part's comment; if the
   catalog models cill reinforcement as data, add the alternative with source cite.
4. **Sliding frame face doc fix (X5)**: the CLAUDE.md sliding section says frame `SPQ-GL-10252`
   "face 48" — manual p15 + assemblies p29–32 show face **84**, depth 48. The ENGINE's sliding
   cut math is calibrated from production jobs (Andrei 44/48) and reproduces the docs exactly —
   verify which figure the catalog `faceWidthMm` actually stores and what consumes it (SVG
   rendering uses faces; cutting uses calibrated deductions). Correct the documentation and, if
   the catalog stores 48 as the *face*, evaluate the drawn-preview impact of correcting to 84
   (cut lists must remain byte-identical — they are job-calibrated; if correcting the face would
   alter any validated output, STOP and record in `../questions.md` Q14 instead).
5. **Weld-allowance provenance (X6)**: update every comment citing the manual for the 3mm/end
   weld rule to cite the actual sources: calibrated jobs (Quotila 85/88/90; Andrei 44/48; Job
   00000264). Grep `weldAllowance` across `src/` + seeds. No value change.
6. **Friction-stay 90° option (N5, p7)** + **frame-extension profile SPQ-2-75252 & coupling
   SPQ-2-72252 (p13)** + **bay-pole profiles (p14)**: add as hardware/profile parts ONLY where
   they don't already exist, cost/price 0, cited — these prep M6 (bay/bow) and designer add-on
   options; nothing consumes them yet.

### Gated on supplier answers (execute per answer; keep this table updated)

| Item | Gate | Action on answer |
|---|---|---|
| Frame-6ch code `SPQ-6-11252` → `SPQ-6-10252`? | Q-A | If confirmed 10252: update code in seed + DB + price-list `mapping.ts` alias + CLAUDE.md; codes only, no dims. |
| French mullion / casement T-sash code collision | Q-B | Update whichever code the supplier corrects; our dims/deductions stay (job-calibrated). |
| Casement 28mm default + EnergyPlus identity | Q-C | If 28mm confirmed AND deductions revalidated by supplier: flip default bead/glass per design family, with new assertions first; expect NO deduction change unless supplier reissues p46. |
| Bead codes (28/32/sliding) | Q-D | Reconcile the three long-open bead code flags (also closes M5.5 flags). |
| T&T sash code | Q-E | Feeds phase-3's catalog entry. |

## Implementation checklist

- [x] Ungated items 1–6 in seed sources + migration if schema needs new nullable fields (avoid
      schema changes if the existing `profile_part`/hardware tables suffice — they should).
      **DONE 2026-07-25 — no schema change needed** (existing `profile_part` kinds + `hardware`
      sufficed). All in `src/catalog/system-sunnyplast.ts`, every entry page-cited, £0, and
      **unreferenced by any design / unmapped in `reinforcementMap`**:
      · item 1 — `reinf-35x15` (SPQ-2-83997) + `reinf-25x10` (SPQ-2-83998), p17/PDF 18, with
        their likely-role notes (cill-95 alt / frame-extension steel) recorded as comments only.
      · item 2 — `mullion-75` (SPQ-050-30252, face **75**, jointType T), p11/PDF 12.
      · item 3 — cill reinforcement recorded as a comment on the `cills` block (41.3×17.4 std for
        all three sizes + 35×15 alternative on cill-95, p12/PDF 13); not modelled, no cut rule.
      · item 6 — `aux-ext-25` (SPQ-2-75252) + `aux-coupling-frame` (SPQ-2-72252) from p13/PDF 14;
        bay prep `aux-bay-corner-square` (SPQ-2-63252), `aux-bay-pole` (SPQ-2-61252),
        `aux-coupling-70` (SPQ-2-76252), `aux-bay-corner-post` (SPQ-2-74252) from p14/PDF 15;
        hardware `hw-fricthinge-90` (90° 13.5mm stack, p7/PDF 8) — deliberately **no `lengthMm`**
        so `pickFrictionHinge()` can never select it. `emitSlidingAuxBars` emits by explicit key,
        so the new auxiliaries are never cut into a quote.
- [x] `npm run db:seed` (idempotent, preserves owner prices) + `npm run validate`.
- [x] Assert inertness explicitly: re-run one casement + one sliding validation job before/after
      and diff outputs (should be byte-identical). **Done via a 3-design solve() snapshot
      (casement `win-th-over-fixed-z`, `door-french`, sliding OX) diffed across the reseed.**
- [ ] Update `supplier-queries.md` with any answers received; execute gated rows accordingly,
      each with assertions-first discipline. — **still pending: no answers received** (queries not
      yet sent; owner action). All 5 gated rows remain correctly gated.
- [x] Update CLAUDE.md facts that this phase invalidates (sliding face note, weld provenance,
      reconciled codes). **Sliding face: X5 was WRONG — see below; CLAUDE.md now records why 48 is
      correct. Weld provenance: provenance note added to `src/catalog/settings.ts`.**

## Executed-item notes (2026-07-25)

**Item 4 (sliding frame face) — X5 was backwards; NO change made.** The findings row claimed the
face is 84 and the app's 48 was a doc error. Reading the assembly sections (p29–32 / PDF 30–33)
disproves it: the **84 is the frame section's front-to-back track depth**, and **48 is the
elevation sightline** — dimensioned there against the sash's 85 sightline, and independently
proven by the calibrated deduction `Int = Ext − 96 = 2×48` (Andrei Jobs 44/48). The catalog was
already right. `findings.md` X5 and `../questions.md` Q14 are both corrected/closed, and CLAUDE.md
gained a note so the 84 doesn't get "fixed" into the catalog by a future reader.

**Item 5 (weld provenance) — nothing miscited in code.** `grep weldAllowance` across `src/` +
`prisma/` found no comment attributing the 3mm/2.5mm values to any manual; every per-profile
comment already cites its calibrated job. The gap was the *global* default having no provenance
at all — now cited in `src/catalog/settings.ts` (Quotila 85/88/90, with the family overrides
named, and the explicit statement that no manual edition states a weld allowance).

## Verification results (2026-07-25)

- `npx tsc --noEmit` clean.
- `npm run db:seed` exit 0 → parts 38, hardware 37, rmap 7, designs 516 / quotable 393 (unchanged).
- **Byte-identity: PASS.** `solve()` snapshots of three families (casement `win-th-over-fixed-z`
  1200×1200, `door-french` 1700×2100, sliding OX 1500×1750) captured before the reseed and again
  after are **identical** — full JSON diff empty, so bars, glass, gaskets, hardware and pricing all
  unchanged. (This is the meaningful check: the new keys sort into the catalog Records, and the
  only first-entry defaults in the engine are `frames[0]` and `beads[0]`, neither of which this
  phase touches.)
- `npm run validate`: **481 passed, 3 failed** — exactly the pre-existing weld-drift baseline
  (`memory/validate-weld-drift.md`), no new failures.
- Inertness re-asserted directly against the loaded catalog: all 10 new parts present with the
  right codes and £0 cost/price; `mullion-75` face 75; the two new steels absent from
  `reinforcementMap`; `hw-fricthinge-90` carries **no `lengthMm`**, so `pickFrictionHinge()`
  cannot return it.

## Acceptance criteria

- New parts exist in catalog + DB with correct dims, £0 prices, and page-cited comments; no
  engine output changes (byte-identity check passes).
- Every gated row either executed (with green assertions) or still accurately marked gated.
- No guessed prices, mappings, or deduction values anywhere (grep new comments for page cites).

## Out of scope

T&T calibration (phase 3), rule-data import (phase 4), bay/bow engine geometry (M6).
