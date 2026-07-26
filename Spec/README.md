# Spec/ — Master Implementation Roadmap

> Planning output of 2026-07-25 covering two independent workstreams. Written so that a future AI
> session can open ONE phase file (plus the `00-architecture/` folder for Task-1 phases) and
> execute it without any other project context. No code was changed while producing these specs.

## The two workstreams

| | Workstream | Input analysed | Folder |
|---|---|---|---|
| **Task 1** | **Windows Module / Designer** — a modern, JSON-driven line-item configurator built alongside the existing `/quote`, architected to absorb doors/partitions/sliding/future families without UI redesign | `collections/windows/` (13 Quotila/BM-Touch screenshots + `jobitem.json` + `basketsummary.json`) | `00-architecture/` + `01-windows-module/` |
| **Task 2** | **Manual Migration** — align the app with the re-issued fabrication manual (finding: a point revision of the SAME Sunnyplast manual, not a new document) | `collections/docs/HAWDIO 21-7-2026.pdf` (86 pp, fully read) | `02-manual-migration/` |

The workstreams are independent and may proceed in parallel. The only coupling: migration
phase-4's limit constraints land richer if the Designer's constraint system (Task 1) exists —
both specs handle either ordering.

## Folder map

```
Spec/
├── README.md                ← you are here
├── questions.md             ← open questions Q1–Q17 with recommendations; owner decisions flagged ⚠
├── 00-architecture/         ← READ FIRST for any Task-1 phase (normative contracts)
│   ├── overview.md              target architecture, tenets, vocabulary, execution graph
│   ├── product-family-plugin.md family descriptor contract + engine adapters + the extensibility bar
│   ├── option-schema.md         the JSON option system (groups/options/choices/rules/actions)
│   ├── line-item-schema.md      LineItemDraft / ResolvedLineItem / resolve pipeline / API
│   ├── data-model.md            exact Prisma deltas, seeds, integrity rules
│   └── ux-design-language.md    layout, interaction grammar, responsive & a11y rules
├── 01-windows-module/       ← Task 1, 7 sequential-ish phases (graph in its README)
│   ├── README.md
│   ├── phase-1-option-engine.md        backend data layer
│   ├── phase-2-line-item-core.md       resolver + storage + API (headless-complete)
│   ├── phase-3-configurator-shell.md   /designer workspace UI
│   ├── phase-4-component-editing.md    canvas selection, scoping, instant actions
│   ├── phase-5-views-and-preview.md    external/internal/schematic views
│   ├── phase-6-basket-and-orders.md    commercial layer (fitting/survey/delivery/discount/tax)
│   └── phase-7-extensibility-proof.md  second family as pure data + contract audit
└── 02-manual-migration/     ← Task 2 (read findings.md first)
    ├── README.md
    ├── findings.md              full verified diff of the PDF (evidence base)
    ├── supplier-queries.md      Q-A…Q-K to Sunny Plast — SEND FIRST; answers gate phases 2–4
    ├── phase-1-breaking-fixes.md        door clear-opening fix (ungated — do first)
    ├── phase-2-catalog-additions.md     new parts + reconciliations (partly gated)
    ├── phase-3-tilt-turn-calibration.md promote 123 T&T designs (gated on Q15 sign-off)
    └── phase-4-limits-and-validation.md size/weight limits, sash-weight formula, ED table
```

## How to execute a phase (any phase)

1. Read the phase file top to bottom; for Task-1 phases also read the `00-architecture/` files it
   names (they are normative — the phase files don't restate contracts).
2. Honour the phase's "Context-in-a-box" — it lists the repo facts you need; verify them briefly
   against the code (specs written 2026-07-25; drift is possible).
3. Follow the implementation checklist in order; assertions/tests FIRST where the phase says so.
4. Gate check: some steps are marked gated on `questions.md` owner decisions (⚠) or
   `supplier-queries.md` answers — skip gated steps, never improvise past a gate.
5. Verify per the phase's acceptance criteria + the standing stack:
   `npx tsc --noEmit` · `npm run validate` (baseline: ~484 passed + 3 known pre-existing
   weld-drift DB failures — see `memory/validate-weld-drift.md`; anything else failing is caused
   by your change) · `cd web && npm run build && npm run lint` for UI phases.
6. Update: the phase file's checklist (tick), `questions.md` (new findings), and CLAUDE.md if the
   phase invalidates a recorded fact (each phase lists which).

## Non-negotiable project rules (inherited from the codebase, restated once)

- **Engine purity**: `src/engine/*` (and new `src/designer/*`) stay pure — no I/O; the catalog
  loader is the only data seam.
- **Golden rule**: never guess a fabrication formula, deduction, code, or price. Cite a manual
  page (`HAWDIO pNN / PDF NN`) or a validated production job; unknown ⇒ absent + logged, never
  invented.
- **Additive & byte-identical by default**: engine/document extensions are no-ops when their new
  inputs are absent, keeping the validation baseline green.
- **Seeds are source of truth**; idempotent upserts; no interactive transactions (pooler-safe);
  owner-edited fields never overwritten.
- **Do not touch the legacy `/quote` surface** (owner decision) — the Designer is built alongside.

## Immediate next actions (in order of leverage)

1. Send `02-manual-migration/supplier-queries.md` to Sunny Plast (longest lead time).
2. Owner decisions: Q15 (T&T sign-off), Q16, Q17 in `questions.md`.
3. Start `02-manual-migration/phase-1-breaking-fixes.md` (small, ungated, corrects a real 60mm
   error) and `01-windows-module/phase-1-option-engine.md` (unblocks the whole Task-1 chain) —
   independent, parallelisable.
