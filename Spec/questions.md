# Open Questions & Ambiguities

> Living document. Each entry: context → options → **recommendation** (planning continued on the
> recommendation; executors follow it unless the owner overrides). Q-numbers are referenced from
> the phase files — do not renumber; append new questions at the end.
> Supplier-facing questions live separately in `02-manual-migration/supplier-queries.md` (Q-A…Q-K).

## Task 1 — Windows Module / Designer

**Q1. Are option definitions global or per profile-system?**
Options/choices reference catalog partKeys, which are per-system. When Veka/Rehau systems arrive
(M6), do option definitions duplicate per system?
Options: (a) global definitions + per-system choice generation (choices derive from each system's
catalog at seed/load time); (b) fully per-system option sets.
**Recommendation: (a)** — definitions are family-scoped and stable; only catalog-derived choices
vary by system. `option-schema.md` is written this way (catalog-derived choices, phase-1
deliverable 3).

**Q2. Route name and legacy retirement.**
Owner chose "build alongside". Specs use `/designer`. When feature parity is reached, does
`/quote` redirect, hide from nav, or persist indefinitely?
**Recommendation:** revisit after phase 5; hide the gallery "Configure →" entry first, keep the
route live one release, then redirect. No spec depends on this.

**Q3. Location suggestion list.**
The reference offers 13 canned locations + free text. Source for ours?
Options: (a) hardcode a sensible UK list in the option seed; (b) admin-editable choice list.
**Recommendation: (a)** for phase 1 (it's just a seeded choice list — admin editability arrives
free with the admin option CRUD).

**Q4. "Equal Glass" split mode needs iterative solving.**
Splitting so finished GLASS widths (not daylight spans) are equal requires inverting deduction
math — an iterative solve around the engine. Reference has it; value is real (glazing symmetry).
Options: (a) implement in resolver phase 2 (bisection over splitRatios, few iterations, engine is
fast); (b) defer, hide the mode.
**Recommendation: (b) defer** — ship byDimensions + equalSplit first; resolver returns
not-implemented issue for equalGlass (phase-2 notes this), implement as a fast-follow in phase 4+
when component machinery exists.

**Q5. Flat panels as component type.**
The reference converts glass → "Flat panel". Our catalog has panels as glass rows (M5.5, per-m²).
Is a converted panel just a glass-row swap, or does it change fabrication (no bead? different
gasket)?
**Recommendation:** treat as glass-row swap (bead retained) until a calibrated reference says
otherwise — never guess fabrication differences; phase-2 records any discovered gap here.

**Q6. Add-on profiles (frame extenders) have no catalog entries.** ✅ RESOLVED 2026-07-30
(`03-doors-module/phase-1`)
Reference exposes per-side Add-ons. Manual p13 lists SPQ-2-75252 25mm extension. No calibrated
cut rule existed for add-ons in our engine.
**Resolved by Job 169** (`collections/doors/Work Order - sunnyplast order test - 30-07-2026.pdf`,
5 pages, 1000 × 2000): a 25 mm `SPQ-2-75252` on an edge shortens the frame by exactly 25 mm on the
**perpendicular** axis and leaves the parallel axis alone — verified independently on all four
edges (Top p1, Bottom p2, Left p3, Right p4). Frame prints 1005/1980 with a top or bottom add-on
and 980/2005 with a left or right one; the overall unit stays 1000 × 2000 and split ratios are
frame-relative (p1: 375 + 1600 = 1975). Implemented as `SolvedGeometry.frameRect`. See **Q21** for
the one thing the document still does not answer.

**Q7. Options with no calibrated fabrication effect (drainage, threshold, glazing method…).**
Ship them as spec-recording, documents-only options (per `option-schema.md` §8), or hide until
calibrated?
**Recommendation:** ship documents-only with helpText flag — fabricators need the spec recorded
on the work order even when the machining rule isn't automated. This is the planned behaviour.

**Q8. Hardware option pricing granularity.**
Scoped hardware substitutions price via catalog partKeys (per-piece). Reference also has
priced *upgrades* (e.g. handle colour groups). Sufficient?
**Recommendation:** yes — per-piece catalog pricing + M5.5 import covers it; % uplift machinery
(colours) already exists separately. No new pricing model.

**Q9. Tax-exempt splits.**
Reference basket carries taxable/tax-exempt parallel totals (UK zero-rating cases).
**Recommendation:** defer — single tax rate per order (override field exists). Schema keeps room
(`data-model.md` §2). Implement only when the owner has a real zero-rated flow.

**Q10. Exchange rate / multi-currency.**
Reference carries `exchangeRate`. **Recommendation:** defer — single-currency (GBP display
formats exist already). Revisit with a concrete requirement.

**Q11. Migrating legacy OrderItems to designer line items.**
**Recommendation:** don't (coexistence is designed in, `data-model.md` §3); optional one-off
script later if the owner wants old orders editable in the designer.

**Q12. Embed schematic view in printed documents?**
Documents currently embed the external-style SVG. The phase-5 schematic (face widths + glass
sizes) may be MORE useful on the Work Order / Cutting List.
**Recommendation:** yes, as a follow-up after phase 5 (additive `DocImage` variant, byte-identical
when unused) — owner to confirm which documents get which view.

## Task 2 — Manual Migration

**Q13. Clear-opening figures vs production-doc calibrated jobs.**
If the calibrated door jobs' printed docs disagree with the new p40 formula (they predate it):
production docs win for CUT sizes; the manual wins for the *reported clear-opening figure*.
Phase-1 (migration) asserts the formula and records any conflict here.
**Recommendation:** as stated; if a conflict is found, also add it to `supplier-queries.md`.

**Q14. Sliding frame face 48 → 84 correction impact. ✅ RESOLVED 2026-07-25 (phase-2) — no correction needed.**
The findings X5 row had the two dimensions swapped. The manual's assembly sections (p29–32 /
PDF 30–33) show the sliding frame section is **84 deep (front-to-back track depth) × 48 tall**,
and 48 IS the elevation sightline — dimensioned against the sash's 85 sightline in the same
sections, and independently proven by the calibrated deduction `Int = Ext − 96 = 2×48` (Andrei
Jobs 44/48). Catalog `faceWidth: 48`, CLAUDE.md, and all validated outputs were already correct;
zero changes made. X5 row in `02-manual-migration/findings.md` corrected in place.

**Q15. Tilt&Turn: manual-only calibration sign-off. ⚠ OWNER DECISION REQUIRED**
Every prior family was calibrated against real production cut docs; T&T would be first calibrated
from the manual alone (no T&T job exists). Risk: manual drawing vs factory practice drift.
Options: (a) promote on manual data + mandatory cross-check of the first real T&T order;
(b) wait for a production T&T job doc.
**Recommendation: (a)** — the manual now carries complete, internally consistent T&T data (both
mullion variants), and 123 designs are waiting; the first-order cross-check contains the risk.
Phase-3 gate-flip is blocked until the owner picks.

**Q16. Fabrication notes (venting/drainage/tolerances) on Work Order documents. OWNER PREFERENCE**
⏳ **STILL OPEN — phase-4 deliberately stopped at this gate (2026-07-25).**
Adds cited QC/drilling data to printed docs — useful on the shop floor, but more ink.
**Recommendation:** yes for cill vent drill positions + drainage slot spec (directly actionable);
skip tolerance text. Phase-4 items 4/6 gated on this answer.
Phase-4 captured the trickle-vent constants (`TRICKLE_VENT` in `src/engine/limits.ts`, p68) because
that was free, but surfaced **nothing** on any document. Answering this unblocks items 4 and 6 only;
nothing else in the migration depends on it.

**Q17. ED lookup table import timing. ✅ RESOLVED 2026-07-25 — imported per the recommendation.**
No consumer until M6 bay/bow. Import now (verbatim transcription while the analysis is fresh) or
with M6?
**Recommendation:** import now, unconsumed (cheap, follows the M5.5 transcription pattern, and
the table has print defects worth capturing while documented). Phase-4 item 5.
Done as `src/catalog/ed-table.ts` (91 rows verbatim + 3 recorded print defects) with an integrity
test. **One deviation:** it is a TS module only, with no `ed_table` DB table — with no consumer,
a DB round-trip adds risk for no benefit, and this matches the `price-lists/*` precedent where the
transcription is the source of truth. M6 can seed from it directly.

**Q18. Should door documents print the clear-opening figure? (found during migration phase-1)**
Phase-1's inventory (2026-07-25) proved the door clear-opening formula was never implemented —
it existed only as a CLAUDE.md note (now corrected to the HAWDIO p40 formulas). The "app off by
60mm" risk was therefore documentation-only; no customer-facing figure was ever wrong. Adding the
figure to door/French Work Orders would be a NEW feature: implement `clearOpeningMm` per the p40
formulas (deriving X1/SW operands from the drawing's leader lines against our catalog faces),
assert it for the calibrated door jobs, and print it in the doc header.
Options: (a) add it with migration phase-4 (it's validation/report data, same additive pattern);
(b) leave unimplemented until a fabricator asks.
**Recommendation: (a)** — cheap, useful on site surveys, and the formula is now cited and ready.

**Q19. Should size-selected hardware ever be user-overridable? (found during windows phase-1)**
The espagnolette and friction stay are chosen by the engine from the sash span
(`pickEspag` / `pickFrictionHinge`, calibrated on Jobs 85/88/90). §8's inventory lists Locking and
Hinge as catalog-hardware pickers, but exposing the individual parts would let a quote specify a
600 mm espag on a 1000 mm sash — a calibrated rule broken from the UI. Phase 1 therefore seeded
each with a single informational choice ("sized from the sash", `pricingMode:"none"`).
Options: (a) leave them engine-selected (the picker stays informational); (b) allow an override
only within the size band the rule would pick anyway; (c) allow free choice with a warning Issue.
**Recommendation: (a)** until a fabricator asks — and if they do, (b), because it keeps the
calibrated rule authoritative. Real alternatives need a calibrated SELECTION rule (which part for
which span), not just more parts in the catalog.

**Q20. Unglazed units still price their glass. (found during windows phase-1)**
`glazing.method` seeds glazed/unglazed, but nothing in the engine omits glass lines, so an
unglazed unit currently prices as if glazed. Phase 1 shipped the option `pricingMode:"none"` with
a helpText saying so rather than inventing a BOM effect.
Options: (a) phase-2 resolver drops the glass BOM/price lines for unglazed cells (no fabrication
rule needed — you simply don't supply the glass); (b) leave it documents-only indefinitely.
**Recommendation: (a)** — it is a supply decision, not a fabrication deduction, so no calibration
is required; it just needs the resolver, which is phase 2.

## Task 3 — Doors Module

*(found during doors phase-1, from the Job 169 package in `collections/doors/`)*

**Q21. What length is the add-on profile itself cut to?** ⚠ OWNER DECISION REQUIRED
Job 169 proves the add-on's effect on the FRAME exactly (Q6), but its Cutting List itemises
**no row** for `SPQ-2-75252` — the profile is selected, priced into Main Options, and never cut.
Options: (a) print no cut row, matching the reference document byte for byte; (b) infer the bar as
the full outer W (top/bottom) or H (left/right) on that edge and flag it uncalibrated; (c) ask the
supplier for an itemised add-on cutting list.
**Owner decision 2026-07-30: (a)** — match the document. Revisit if the shop floor asks for the
bar length; that is (c), not a guess.

**Q22. What does the "Mechanical" joint deduction do?** ⏳ **STILL OPEN**
The reference offers `Joint (Structural T/Z)` = `Welded (Standard)` / `Mechanical (Standard)` per
divider. Every reference job we hold is welded, so the mechanical cut (presumably a square butt
with no horn, i.e. `Ext = Int`) is unevidenced.
**Recommendation:** ship the option selectable, cut it as welded, and raise a `warning` issue that
the D9 advisory band prints on the work order — visible to the shop, never silently wrong. Replace
with the real deduction when a mechanically jointed reference job appears.

**Q23. What are the exact reinforcement length thresholds?** ⚠ PARTIALLY ANSWERED
The manual states `SPQ-05-20252` is reinforced only >1.5 m and `SPQ-5-30252` / `SPQ-005-30252`
only >1 m; our `reinforcementMap` is binary. Job 169 confirms the direction — the 78 mm divider
carries 26×26 U steel at Int 1710 (pages 3, 5) and none at Int 685/710 (pages 1, 2, 4) — but the
document brackets the threshold between 710 and 1710, it does not pin it.
**Recommendation:** encode the manual's printed thresholds (1000 / 1500 mm) with their page cites,
since Job 169 is consistent with them and contradicts no other calibrated job. Flag on the part,
not in the engine, so a corrected figure is a data edit.

**Q24. Should our Gasket 01/02 rule move to the Job 169 convention?** ✅ **RESOLVED — there was
never a conflict** (2026-07-30)
Job 169 prints Gasket 01 = 11.26 m and Gasket 02 = 6.294 m for a 1000 × 2000 single door, and this
was recorded as contradicting our Jobs-85/88/90 rule (Gasket 01 = 2 × Σ sash outer perimeter,
Gasket 02 = Σ glass perimeter). Solving that page through the engine gives **11260 / 6294 — exactly
the printed figures**; the earlier comparison must have been made against a solve without the
page's midrail, which changes the glass perimeter. Jobs 172/173 then confirm it on seven more
items (11.140 / 6.184 on p1 and 172, 11.140 / 8.124 on p2 and p6, 11.140 / 6.234 on p3,
9.656 / 7.826 on p4) — every one reproduced to the millimetre.
**Outcome:** no change; the rule was already right. Asserted in `validateJob169` and
`validateJob173` so the claim can't drift back into doubt.

## Task 3 addendum — Jobs 172/173 (`docs/correct/`, 2026-07-30)

**Q25. How is a divider that splits the FRAME cut, and does it break the jambs?**
⚠ **OWNER-DECIDED, NOT DERIVED**
Job 173 p4 puts a 78 mm `SPQ-5-30252` transom in the frame of a 975 × 1970 doorset. It prints:
jambs broken into **405 + 1575** (`[Y - /` / `\ - Y]`), and the divider at **984**.

Two conflicts with the Quotila calibration, both settled by owner decision on 2026-07-30:

1. **The break.** We broke the jambs only under a **Z** joint, because Quotila Job 88 — a real
   T-transom window — prints continuous jambs. **Decision: break under ANY frame-level divider,
   windows included.** `JOB_88`'s frame rows are re-baselined (2 × 1200 → 400 + 800 pairs) with the
   superseded Quotila values kept in a comment. A Y-notch also turned out to be a WELDED end
   (405 = 400 + 2 × 2.5), which re-baselined `validateWeldMath` too — finished sizes unmoved.
2. **The length.** Our rule is `Ext = Int + 2 × face` (839 + 156 = 995, printed 1000). 984 is not
   derivable: it needs a 72.5 mm horn per end, and neither the 68 mm frame face nor the 78 mm
   transom face gives it. Two decompositions fit equally well — `frame outer span 975 + 2 × 4.5`
   and `daylight 839 + 2 × 70`. **Decision: the first**, implemented as
   `bars.ts#FRAME_BREAK_WELD_MM = 4.5` over an Ext of the frame's outer span. The 4.5 mm has **no
   source** — it is a chosen decomposition, not a measurement.

   The **Z** branch is deliberately untouched: the reference package contains no Z transom, so it
   cannot supersede Job 85 (1206 = 1072 + 2 × 67). The two branches are each cited to their own
   production document. If a second frame-split document ever appears, check whether one rule
   covers both — a single rule would be better than this fork.

**Still unevidenced, deliberately not implemented:** a root **vsplit** mullion breaking the head
and sill (symmetry says it should; no document shows it, and it would change 181 of 516 seeded
designs), and a **nested** divider breaking whatever it welds into.

**Q26. Which cills take which reinforcement?** ⚠ PARTIALLY ANSWERED
Jobs 172/173 fit a 35 × 15 `SPQ-2-83997` at the cill's own length (1100) on all seven items — but
every one uses the **150 mm** cill. The manual (HAWDIO p12/PDF 13) shows all three sizes taking a
steel, but draws a 41.3 × 17.4 box that carries no code and has no catalog entry.
**Owner decision 2026-07-30:** map the documented 35 × 15 to all three sizes, commenting 95/180 as
extrapolated. Replace with the real sections if the supplier itemises them.

## Resolved during planning

- **Screenshots gap** — `collections/windows/` subfolders were initially empty; owner supplied 13
  screenshots on 2026-07-25; analysis incorporated (see `00-architecture/overview.md` §6).
- **Replace vs alongside** — owner: build alongside `/quote`.
- **Basket scope** — owner: full commercial layer in scope (phase 6).
- **"HAWDIO" is not a rebrand** — established by full-document comparison; no terminology
  migration needed (`02-manual-migration/findings.md` §0).
