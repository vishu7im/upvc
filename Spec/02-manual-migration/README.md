# Manual Migration — Phase Map

> Task 2: align the app with the re-issued fabrication manual
> `collections/docs/HAWDIO 21-7-2026.pdf`. **Read `findings.md` first** — headline: this is the
> SAME Sunnyplast manual as before with ~14 localized edits (not a rebrand, not a rewrite), so the
> migration is surgical, not structural.

## Files

| File | Purpose |
|---|---|
| `findings.md` | Full verified TOC, complete New/Changed/Removed/Contradicts diff with page cites, transcription-priority table. The evidence base for everything else. |
| `supplier-queries.md` | 11 written queries (Q-A…Q-K) for Sunny Plast + holding positions. **The audit trail — record answers inline.** |
| `phase-1-breaking-fixes.md` | Door clear-opening formula correction (app off by 60mm). Ungated. **Do first.** |
| `phase-2-catalog-additions.md` | New profiles/steels + provenance/doc fixes (ungated part) + code reconciliations (gated on Q-A…Q-E). |
| `phase-3-tilt-turn-calibration.md` | Promote 123 gated T&T designs using the manual's complete T&T data. Gated on owner sign-off (manual-only calibration). |
| `phase-4-limits-and-validation.md` | Import never-used rule data: size/weight limits, sash-weight formula, wedge counts, ED lookup, fabrication notes. Partially gated on owner preferences (Q16/Q17). |

## Execution order

```
phase-1 (ungated, breaking fix)
   → phase-2 ungated items  → phase-2 gated items (as Q-A…Q-E answers arrive)
   → phase-3 (after owner sign-off Q15; steps 1–3 may start immediately)
   → phase-4 (independent of 2–3; constraint wiring is richer if Task 1's Designer exists)
```

Send `supplier-queries.md` to Sunny Plast **immediately** (before any implementation) — answers
gate the most items and have the longest lead time.

## Non-negotiables (repo golden rule, applied to this migration)

- Every changed/added fabrication value carries a `// HAWDIO pNN (PDF NN)` citation. Page
  numbering is treacherous (three schemes; the ED table page is unnumbered) — cite BOTH forms,
  per `findings.md` §0.
- Assertions BEFORE changes: extend `src/validation/jobs.ts` (or the relevant `*.test.ts`) with
  the new expected values first, then change the catalog/engine.
- `npm run validate` after every step; baseline is ~484 passed + 3 known pre-existing weld-drift
  failures (`memory/validate-weld-drift.md`) — any other failure is yours.
- Manual self-contradictions (bead 28/32, French mullion code) are **queries, never coin-flips**.
- Production-job calibration outranks manual drawings where they conflict (established repo
  precedent: Andrei jobs superseded Job 104; Job 00000264 defines French) — the manual fills gaps
  and defines *reported* figures like clear openings.
- Keep `HAWDWARE_PLANER(MAIN DOCUMENT).pdf` in the repo — sole record of the pre-change formulas.
