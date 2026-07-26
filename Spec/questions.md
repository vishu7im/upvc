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

**Q6. Add-on profiles (frame extenders) have no catalog entries.**
Reference exposes per-side Add-ons. Manual p13 lists SPQ-2-75252 25mm extension. No calibrated
cut rule exists for add-ons in our engine.
**Recommendation:** phase 1 seeds the option with "No add-on" only; phase 2 (migration) adds the
part; enabling real add-on choices requires a calibrated rule (extension adds to frame ext sizes)
— gate on a reference job or explicit supplier doc. Documents-only until then.

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

## Resolved during planning

- **Screenshots gap** — `collections/windows/` subfolders were initially empty; owner supplied 13
  screenshots on 2026-07-25; analysis incorporated (see `00-architecture/overview.md` §6).
- **Replace vs alongside** — owner: build alongside `/quote`.
- **Basket scope** — owner: full commercial layer in scope (phase 6).
- **"HAWDIO" is not a rebrand** — established by full-document comparison; no terminology
  migration needed (`02-manual-migration/findings.md` §0).
