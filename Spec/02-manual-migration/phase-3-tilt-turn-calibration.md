# Migration Phase 3 — Tilt & Turn Calibration

## Goal

Promote the Tilt&Turn family from `quotable:false` to production-quotable using the manual's
now-complete T&T data. This is the migration's biggest value item: **123 gated T&T designs**
already exist with valid geometry, waiting on calibration.

## Context-in-a-box

App status: T&T topologies are extracted and geometry-valid (they reuse the casement sash model,
`sash-t`); a `tilt-turn` cell content + T&T hardware branch exist in `src/engine/hardware.ts` and
the catalog but are **uncalibrated** — the M3 tier rule gates them: *"To promote a gated tier: add
a calibrated reference job + assertion, then flip the tier's gate — never relax the gate alone."*
The extractor (`src/tools/extract-topology.ts`) assigns tiers; `prisma/seed.ts` applies
`quotable` by tier. Validation: `src/validation/jobs.ts` (`npm run validate`; baseline ~484 + 3
known weld-drift failures). Catalog seed: `src/catalog/system-sunnyplast.ts`. Precedent to copy:
the French Door calibration (CLAUDE.md "## French Door") — same flow: derive constants from
authoritative docs → dedicated catalog entries → validation jobs asserting every derived line →
flip the gate → extractor test asserts the promoted count.

**Difference from precedent:** French/Sliding were calibrated from *production job docs* (cut
lists). For T&T we have no production job — the calibration source is the MANUAL itself
(`HAWDIO 21-7-2026.pdf`), which now fully specifies T&T. Owner sign-off recorded in
`../questions.md` Q15 is REQUIRED before flipping the gate (manual-only calibration is weaker
than a job; the first real T&T order should be cross-checked against the engine before mass
production).

## Manual data to calibrate from (all values verified present)

| Data | Printed/PDF | Content |
|---|---|---|
| Assembly | p21 / 22 | frame 70 (SPQ-6-10252 6ch); head/transom dims **114 / 114** (changed this revision from 111.5/113.8 — use the NEW values); sec-C 178.5; build-ups 20/58/36/64; glass 32mm |
| System spec | p7 / 8 | Espag 15mm backset, 9mm cam; top stay 13mm axis, 20mm rebate; euro groove 13mm; spindle 40mm; screw M5×45 |
| Glass deductions | p48 / 50 | **two mullion variants**: with SPQ-5-30252 → 53.00 (fixed) / 103.00 (sash) / 148.50 / 87.75; with SPQ-005-30252 → 53.00 / 103.00 / 137.00 / 87.00 |
| Clear openings | p37–38 / 38–39 | chamfered + sculptured T&T formulas (same 3-case structure as casement, T&T factors) |
| Size limits | p70 / 72 | max vent 1402×1402, 39.3 kg |
| Wind loading | p72–73 / 74–75 | EI for the T&T-relevant profiles |
| Reinforcement | p44 / 46 | sash rows blank (Q-F) — use the app's existing binary reinforcement map for T&T sash, flagged |

Sash profile code: assemblies/deductions say `SPQ-05-45252`, portfolio says `SPQ-5-20252` (60×70)
— supplier query **Q-E**; proceed with dims (consistent) + a `// code pending Q-E` comment.

## Approach (mirror the French calibration recipe)

1. **Derive constants** from p21 + p48: T&T sash face width, sash overlap, glass rebate — derived
   as: deductions (p48) give authoritative glass sizes; assembly (p21) gives face build-ups;
   back-solve overlap/rebate so the engine's generic pipeline reproduces the p48 deduction values
   exactly for both mullion variants and both frame chambers if specified. Every derived number
   gets a `// HAWDIO pNN` comment; anything NOT derivable stays unset and is listed in the
   phase's findings (never guessed).
2. **Catalog entries**: dedicated `sash-tt` profile part (do not overload `sash-t` — French
   precedent: same physical code can need distinct entries per doc source), T&T hardware set
   (espag, top stay, hinges/gear per p7 — items without price-list entries stay £0), reinforcement
   mapping (existing binary map, flagged per Q-F).
3. **Validation jobs**: 2–3 synthetic reference jobs in `src/validation/jobs.ts` asserting the p48
   deduction values verbatim: (a) 1×1 T&T vent in 6ch frame — frame→glass 53.00/103.00 cases;
   (b) vent + fixed over SPQ-5-30252 mullion — 148.50/87.75; (c) same over SPQ-005-30252 —
   137.00/87.00. Plus clear-opening assertions from p37–38 and a size-limit constraint check
   (1402×1402/39.3kg — the weight needs phase-4's sash-weight formula; if phase 4 hasn't landed,
   assert dims only).
4. **Flip the gate**: extractor tier `tilt-turn` → calibrated/eligible; regenerate
   `derived-topologies.generated.ts` (`npx tsx src/tools/extract-topology.ts`); reseed; extractor
   test asserts T&T quotable == 123 with correct hardware.
5. **Docs/UI**: nothing needed — quotable designs flow into gallery/quote/designer automatically.

## Implementation checklist

- [ ] Owner sign-off on manual-only calibration (Q15) — BLOCKING for step 4 (steps 1–3 may
      proceed).
- [ ] Constants derivation worksheet committed as comments/notes (each value → page cite).
- [ ] Catalog entries + seed + `npm run db:seed`.
- [ ] Validation jobs (write assertions BEFORE flipping anything; they should pass against the
      new catalog with the gate still closed — solve via explicit topology, like other jobs).
- [ ] Gate flip + regenerate + reseed + extractor-test update (T&T count assertion).
- [ ] `npm run validate`: baseline + new T&T assertions green; casement/door/French/sliding
      unchanged (T&T entries are new — byte-identity for other families must hold).
- [ ] Update CLAUDE.md tier table (T&T → T1 quotable, manual-calibrated, first-order
      cross-check pending) + memory notes.

## Acceptance criteria

- Both p48 mullion-variant deduction sets reproduced exactly by the engine (assertions verbatim).
- 123 T&T designs quotable; every other family's outputs byte-identical.
- Every calibrated value page-cited; underivable values absent + listed, not guessed.
- The known weak points are explicitly flagged in code comments: sash code (Q-E), sash
  reinforcement thresholds (Q-F), no-production-job caveat (Q15).

## Out of scope

Reversible windows, Resurgence/Flush-sash families (present in manual, absent in app — future
family additions follow the phase-7 designer recipe + this calibration recipe), T&T-specific
designer options (designer picks them up generically).
