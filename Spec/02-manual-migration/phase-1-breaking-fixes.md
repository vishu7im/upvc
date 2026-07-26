# Migration Phase 1 — Breaking Fixes (Door Clear-Opening Formula)

## Goal

Correct the residential-door clear-opening formulas to the new manual's values. This is the one
unambiguous, ungated, breaking change in the revision: the app's formula is off by **60mm** per
opening. Execute FIRST, independently of all supplier queries.

## Context-in-a-box

The app is a fabrication ERP whose engine (`src/engine/*`, pure TS) computes window/door geometry
from a Postgres-backed catalog (`src/catalog/*`; seed sources `src/catalog/system-sunnyplast.ts`
etc. are the source of truth — update seed AND ensure DB matches). Golden rule: every fabrication
value carries a source comment (manual page or validated job). Validation:
`src/validation/jobs.ts`, run via `npm run validate` — baseline ~484 passed + 3 known pre-existing
weld-drift failures (not yours). Repo convention: add/adjust assertions BEFORE changing values.

The manual (`collections/docs/HAWDIO 21-7-2026.pdf`, printed p40 / PDF 41 — "Clear Openings,
Residential Doors", door-leaf page) changed the formulas vs the old edition
(`HAWDWARE_PLANER(MAIN DOCUMENT).pdf`, same section — keep for provenance):

| Case | OLD (what the app encodes) | NEW (p40) |
|---|---|---|
| Between transoms | `W − ((X1÷2)+40) − (SW+44.5)` | `W − ((X1÷2)+50) − (SW+76.5)` |
| Between transom & outer frame | (malformed in old print) | `W − (X1+70) − (SW+74.5)` |
| Between outer frame | `W − (X1+40) − (SW+44.5)` | `W − (X1+70) − (SW+74.5)` |

Drawing reference dims changed 37→50 and 62→70. The window-type clear-opening pages (p35–39) are
**unchanged** — only the door-leaf page moved. `W` = frame width, `X1` = adjacent member factor,
`SW` = sash width factor; **re-derive the exact operand meanings from the p40 drawing during
implementation** (trace the leader lines; do not trust this table's variable glosses blindly).

## Scope of impact (find before you change)

1. Locate every encoding of the door clear-opening rule. Known/likely sites:
   - `grep -rn "44.5\|clear.opening\|clearOpening" src/ prisma/` — the CLAUDE.md "Master PDF
     findings" records the old formula `Clear Opening = W − (X1 + 40) − (SW + 44.5)`;
   - check whether it is engine math (`src/engine/topology.ts`/`bars.ts`), catalog data, or
     documentation-only (it may currently be recorded but UNUSED — if so, this phase updates the
     record and adds the implementation-with-tests only if a consumer exists; do not build new
     clear-opening features here).
2. Affected families: single doors, French doors (leaf clear openings). Windows unaffected.
3. Documents: if any of the 7 documents print clear-opening values, they inherit the fix.

## Implementation checklist

- [x] Inventory (step above); write down every site in the PR/commit description.
      **RESULT (2026-07-25): the formula has NO code consumer.** `grep -rn "44.5|clear.opening|
      clearOpening|opening"` across `src/`, `prisma/`, `web/` finds only: the steel part name
      `reinf-28x44.5-u` (unrelated), SVG "opening chevron" comments (unrelated), and supplier
      price-list descriptions ("outward opening 70mm" — unrelated). No engine module, document
      renderer, API route, or catalog field computes or prints a clear-opening figure. The ONLY
      encoding was the CLAUDE.md "Master PDF findings" note.
- [x] ~~Add/adjust validation assertions FIRST~~ — N/A per the "if UNUSED" branch above: no
      consumer exists, so there is nothing to assert against. No conflict to record in Q13
      (calibrated job docs don't print clear openings into any assertion we hold).
- [x] ~~Apply the change (engine or catalog per inventory)~~ — N/A, record-only (see inventory).
- [x] Update the stale CLAUDE.md "Master PDF findings" clear-opening line — done: now records all
      three p40 formulas (verified against the PDF page 2026-07-25), marks the old formula
      superseded/off-by-60mm, and notes the not-implemented status + required citation form.
- [x] `npm run validate`: baseline confirmed (no code touched — run as a baseline snapshot for
      subsequent phases).
- [x] ~~Spot-check one door quote end-to-end~~ — N/A: no quote/document carries a clear-opening
      figure today. Follow-up recorded in `../questions.md` Q18 (whether to ADD the figure to door
      Work Orders — that would be a new feature, out of scope here by the phase's own rule).

## Acceptance criteria

- New formulas encoded with p40 citations; old formula appears nowhere except historical notes.
- Validation green at baseline; new clear-opening assertions pass.
- No cut-size regressions: cutting-list assertions for door jobs unchanged (clear opening is a
  reported figure, not a cut input — verify this assumption during inventory; if cut math DOES
  consume it anywhere, that consumption is itself a finding to surface before changing).

## Out of scope

Everything supplier-gated (codes, bead defaults — phases 2+), T&T, new capabilities.
