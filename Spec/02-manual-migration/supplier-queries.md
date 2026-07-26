# Supplier Query List (Sunny Plast)

> Written questions to raise with Sunny Plast SRL before executing the gated parts of the
> migration. Each entry: the question, why it matters, what is blocked on it, and our holding
> position (what the app does until answered). Page cites = printed page / PDF page of
> `HAWDIO 21-7-2026.pdf`. Send as one document; record answers inline here (this file is the
> audit trail).

## Q-A. Frame 6-chamber profile code — `SPQ-6-10252` vs `SPQ-6-11252`

- **Question:** Our system uses `SPQ-6-11252` for the 70mm 6-chamber frame. Both manual editions
  print `SPQ-6-10252` everywhere (portfolio p10/11, reinforcement p44/46, glass deductions p46/48,
  wind loading p72/74). Which code is the orderable article?
- **Blocked:** phase-2 code reconciliation for `frame-6ch`.
- **Holding:** keep `SPQ-6-11252` (it prices correctly against the supplier price lists already
  imported); no fabrication impact either way (dims identical).

## Q-B. French mullion code collision

- **Question:** Portfolio p10/11 labels "French Mullion 70mm" as `SPQ-005-30252` — the same code
  as the Casement "T" Sash on the same page (physically different profiles: 68.7×36 vs 67×27).
  Meanwhile `SPQ-1-46252` (which our production docs and your reinforcement p44 + wind-loading p73
  pages use for the French mullion) is absent from the portfolio. Please confirm the correct code
  for each of the three profiles.
- **Blocked:** phase-2 French/casement code confirmation.
- **Holding:** keep `SPQ-1-46252` (calibrated from Job 00000264 production docs — stronger
  provenance than the contradictory portfolio page).

## Q-C. Casement default bead/glass: 28mm vs 32mm

- **Question:** The casement assembly (p19/20) now shows glass "28mm (32mm optional)" — reversed
  from the previous edition — but the casement glass-deduction page (p46/48) still specifies
  Bead 32mm. Which is the intended default, and are the published deduction values valid for both
  bead sizes (or only 32mm)?
- **Blocked:** phase-2 default-glass decision (C5/X4). Also affects EnergyPlus (28mm bead but
  deductions identical to casement — please confirm that identity is intentional).
- **Holding:** app default unchanged (bead-28 first in catalog per current calibration; glass per
  design). No deduction changes.

## Q-D. Bead code `SPQ-1-51252` used for BOTH 28mm and 32mm beads

- **Question:** p13/14 lists Bead 28mm and Bead 32mm under the same code `SPQ-1-51252` (our
  records also show 32mm bead as `SPQ-1-52253` from your price list — and Doc D sliding bead as
  `SPQ-3-51252`). Please provide the definitive code per bead size.
- **Blocked:** phase-2 bead reconciliation; also resolves two pre-existing open flags from the
  M5.5 price-list import (bead-32 code 52253 vs 52252; sliding bead 51252 vs 3-51252).
- **Holding:** current catalog codes stay.

## Q-E. Tilt&Turn sash code — `SPQ-05-45252` vs `SPQ-5-20252`

- **Question:** The portfolio (p10/11) lists the T&T sash as `SPQ-5-20252` (60×70), but every T&T
  assembly and glass-deduction page (p21/22, p48/50) uses `SPQ-05-45252`. One part, two codes —
  which is orderable?
- **Blocked:** phase-3 T&T calibration (catalog entry needs the right code; geometry can proceed —
  the dims are consistent).
- **Holding:** phase-3 may proceed with the code marked `// code pending supplier query Q-E`.

## Q-F. Sash & sliding reinforcement thresholds are blank

- **Question:** Reinforcement Guidelines (p44/46) leave the rule column blank for all sash rows
  (SPQ-05-30252, SPQ-5-20252, SPQ-5-47252, SPQ-5-45252) and sliding rows (SPQ-GL-20252,
  SPQ-GL-10252), with only the footnote "max lengths depends upon window size…". Please publish
  the length/size thresholds at which sash and sliding reinforcement becomes mandatory.
- **Blocked:** phase-4 length-dependent reinforcement refinement (sash part). The app currently
  always reinforces per its job-calibrated reinforcement map — safe (over-reinforces at worst).
- **Holding:** keep binary job-calibrated behaviour.

## Q-G. Missing deflection chart (max transom lengths, BS6180)

- **Question:** p77/79 "Maximum Length of Transoms Before Allowable Deflection of 25mm is
  Exceeded" — the chart is a broken image in the PDF (a local file path is printed instead).
  Please supply the chart/table for UDLs −0.36 / −0.74 / −1.50 kN/m.
- **Blocked:** phase-4 optional transom-length validation rule.
- **Holding:** rely on the p70 blanket rule "longest transom/mullion length = 1.8m" (which IS
  published) for validation; no deflection-specific checks.

## Q-H. 3-pane vs 4-pane sliding drawings appear identical

- **Question:** p31/32 (4-pane) and p32/33 (3-pane) share identical section-D details (84/6/84).
  Please confirm the 3-pane centre-slider construction genuinely matches the 4-pane at the meeting
  sections, or supply the corrected page.
- **Blocked:** nothing today (our sliding is calibrated from Andrei production jobs 44/48, which
  supersede manual drawings for the built variants); relevant when 3/4-panel aux quantities are
  re-verified (pre-existing memory note).
- **Holding:** Andrei-job calibration stands.

## Q-I. French Door section absent

- **Question:** The contents page lists "French Door" sections (~p35–36) that do not exist in the
  document; only French *Window* (p23 assembly, p50 deductions) is covered. Are French Door
  fabrication pages (incl. door-leaf deductions, stulp details, reinforcement) available?
- **Blocked:** nothing (our French door is calibrated from Job 00000264 production docs); would
  strengthen provenance for the two flagged French assumptions (door steel mapping, operating
  gear) recorded in the repo's memory notes.
- **Holding:** job calibration stands.

## Q-J. Dummy sash block / run-up ramp part codes

- **Question:** p64–65 print literal placeholders "( CODE )" / "( REQ CODE )" for the dummy sash
  block and run-up ramp/hinge protector. **Also p66 (PDF 68) "INTEROCKING WEDGE POSITIONING":
  the heading reads "X - Run-up Ramp Positioning ( code )" and the footnote "Interlocking wedge
  ( REQ CODE ) compatible with Resurgence" — both placeholders.** Please supply the actual part
  codes (needed for BOM completeness and PAS24 documentation).
- **Blocked:** phase-4 optional accessory-BOM rules — **confirmed blocking 2026-07-25**: the
  wedge COUNT rule (<800 ⇒ 0, >800 ⇒ 1, >1200 ⇒ 2) is transcribed and tested in
  `src/engine/limits.ts#wedgeCount`, but no hardware line can be emitted without a code.
- **Holding:** accessories not emitted in BOM; `wedgeCount()` exists as reference data only.
- **Second, smaller question (p66):** the rule's threshold is drawn against the HINGED edge
  (the ">800 mm" dimension marks sash height on the side-hung drawing and sash width on the
  top-hung one) but this is never stated in words. Please confirm the measured dimension.

## Q-K. Reversible window min/max grid headers

- **Question:** The Reversible size table (p70/72) contains two rows labelled "Min. size (w)" and
  two labelled "Max. size (w)" (apparently width vs height, and the compression-device bands).
  Please confirm the intended header for each row.
- **Blocked:** phase-4 Reversible limits (only if Reversible products are ever added — not an
  app family today).
- **Holding:** Reversible not modelled.

---

### Not supplier questions (internal notes, resolved by us)

- Weld allowance 3mm/end: appears in no manual edition; provenance is the calibrated production
  jobs (Quotila 85/88/90, Andrei 44/48, Job 00000264). Phase-2 fixes the citation comments —
  nothing to ask the supplier.
- "HAWDIO": filename only; no action.
- "Liniar" residue (p70–71): treat those paragraphs as template residue, not Sunnyplast claims.
