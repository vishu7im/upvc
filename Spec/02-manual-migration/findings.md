# HAWDIO 21-7-2026.pdf — Full Analysis & Diff vs Old Manual / Current App

> Source: `collections/docs/HAWDIO 21-7-2026.pdf` (86 pages). Predecessor:
> `collections/docs/HAWDWARE_PLANER(MAIN DOCUMENT).pdf` (87 pages) — **keep it in the repo**; it is
> the only record of the pre-change door formula. Analysis performed 2026-07-25 by reading all 86
> pages and cross-diffing against both the old manual and the app's calibrated catalog.

## 0. Headline

**This is NOT a new manual and NOT a rebrand.** It is the *same* "SUNNYPLAST FABRICATION MANUAL
NO. 1 — 70MM WINDOOW & DOOR" (identical cover incl. the "WINDOOW" typo; revision log still says
Rev 1, 1/9/2025, unchanged; © 2025 Sunny Plast SRL; the string "HAWDIO" appears nowhere in the
document — it is a filename only) re-issued with **~14 localized edits**. Page count 87 → 86
because a duplicated thermal-reinforcement page was removed. PDF metadata: AutoCAD 2025, created
2026-07-12.

⇒ Task 2 is a **point-revision migration**: one breaking formula fix, one contested default flip,
a handful of catalog additions, a large supplier-query list, and one big opportunity (Tilt&Turn is
now fully calibratable).

### Page numbering warning (cite carefully)

Three numbering systems: PDF pages 2–41 → printed = PDF−1; **PDF page 42 (the ED table) has NO
printed number**; PDF 43–86 → printed = PDF−2. The document's own TOC pages are stale and wrong
(they cite sections that don't exist, up to "page 90" in an 84-printed-page document). **Always
cite BOTH printed and PDF page.** In this folder, `pNN` = printed page unless stated.

## 1. Full table of contents (verified, not the document's own stale TOC)

| PDF | Printed | Section |
|---|---|---|
| 1 | – | Cover |
| 2 | 1 | Manual Revisions (Rev 1, 1/9/2025 — not updated for this re-issue) |
| 3–5 | 2–4 | Contents / Welcome / Standards / Guarantees |
| 6–9 | 5–8 | Company & System Overview; **p7 System Technical Information** (hardware spec); p8 Colours & temperatures |
| 10–19 | 9–18 | Profile portfolio: p10–11 profiles; p12 cills; p13 beads/gaskets/add-ons; p14 bay poles; p15–16 sliding system; **p17 steel reinforcements**; p18 mouldings |
| 20–33 | 19–32 | Typical assemblies: Casement 19, EnergyPlus 20, Tilt&Turn 21, Resurge Flush 22, French Window 23, Residential Doors 24–28 (incl. 44mm composite 28), Sliding 29–32 |
| 34–35 | 33–34 | Low threshold details |
| 36–41 | 35–40 | **Clear openings**: casement 35–36, T&T 37–38, res. doors (window-type) 39, **res. doors (door-leaf) 40 ← THE CHANGED PAGE** |
| 42 | (none) | **External Deduction (ED) table** + joint assemblies |
| 43–44 | 41–42 | Bay pole jacks |
| 45–47 | 43–45 | Manufacturing: **p44 Reinforcement Guidelines**, p45 Thermal reinforcement + screws |
| 48–56 | 46–54 | **Glass deductions** (9 pages: Casement, EnergyPlus, T&T, Resurge, French Window, Res. Door fan/side light, Sliding ×3) |
| 57–65 | 55–63 | Drainage & pressure equalisation; cill venting |
| 66–71 | 64–69 | Accessory rules: dummy sash blocks, run-up ramps, interlocking wedges, trickle vents, vented head drips |
| 72–73 | 70–71 | **Size limitations** + custom sash-weight formula; coupled frames |
| 74–78 | 72–76 | **Wind loading EI values** (profiles + steels) |
| 79 | 77 | Deflection calculations — **chart is a broken image link** |
| 80–86 | 78–84 | Installation, glazing practice, acoustic & thermal ratings, maintenance |

## 2. NEW in this revision

| # | Item | Page (printed/PDF) |
|---|---|---|
| N1 | Profile **`SPQ-050-30252` "T" Mullion 70mm** (75±0.3 × 70±0.3) added to portfolio | p11 / PDF 12 |
| N2 | Wind-loading EI for SPQ-050-30252: Eixx 2.17, Eiyy 3.26 (×10⁹ N·mm²) — **bare only, no reinforced value published** | p74 / PDF 76 |
| N3 | Steel **`SPQ-2-83997`** 35×15 box | p17 / PDF 18 |
| N4 | Steel **`SPQ-2-83998`** 25×10 box | p17 / PDF 18 |
| N5 | Casement friction-stay option "17mm stack / 90° 13.5mm stack" | p7 / PDF 8 |
| N6 | Cill-95 alternative reinforcement 35×15 now dimensioned | p12 / PDF 13 |

## 3. CHANGED

| # | Item | Old | New | Page | Impact |
|---|---|---|---|---|---|
| C1 | Res. door clear opening, between transoms | `W − ((X1÷2)+40) − (SW+44.5)` | `W − ((X1÷2)+50) − (SW+76.5)` | p40 / PDF 41 | **BREAKING** |
| C2 | …between transom & outer frame | (old, malformed print) | `W − (X1+70) − (SW+74.5)` | p40 | **BREAKING** |
| C3 | …between outer frame | `W − (X1+40) − (SW+44.5)` | `W − (X1+70) − (SW+74.5)` | p40 | **BREAKING — the app's formula** |
| C4 | Door clear-opening reference dims | 37, 62 | 50, 70 | p40 | supports C1–C3 |
| C5 | Casement default glass | 32mm (28 opt) | **28mm (32 opt)** | p19–20 | **contested — see X4** |
| C6 | T&T glass label | 31.5mm | 32mm | p21 | minor |
| C7 | T&T frame dims | 111.5 / 113.8 | **114 / 114** | p21 | feeds T&T calibration |
| C8 | Casement sec-C mullion overall | 161.98 | 162 | p19 | rounding |
| C9 | Resurge Flush Sash dim | 36 | 44 | p22 | n/a (family not in app) |
| C10 | Sliding sec-B (fanlight/3-pane/4-pane) | 8.55 | 8 | p30–32 | minor; plain 2-pane still 8.55 |
| C11 | Thermal reinf wall | 3.93 | 4 | p45 | rounding |
| C12 | Clear-opening drawings right-hand label | X1 | X2 | p35–39 | label fix ONLY — formulas unchanged |

## 4. REMOVED

- R1: the duplicated "Thermal Reinforcement Orientation" page (the whole 87→86 delta).
- R2: "Not to Scale" captions on 3 wind-loading pages.
- **Nothing else.** ED table, all 9 glass-deduction pages, reinforcement rules, drainage, cill
  venting, accessory rules, size limits, sash-weight formula, wind loading, installation, ratings:
  all identical.

## 5. CONTRADICTS current app (each needs handling — see phase files + supplier-queries.md)

| # | App holds | Manual says | Pages | Handling |
|---|---|---|---|---|
| X1 | Door clear opening `W−(X1+40)−(SW+44.5)` | `W−(X1+70)−(SW+74.5)` | p40 | **Fix now** — phase-1 (app off by 60mm) |
| X2 | Frame 6ch code `SPQ-6-11252` | `SPQ-6-10252` (11 occurrences; portfolio p10, reinforcement p44, deductions p46, wind p72) | multiple | Supplier query — `SPQ-6-11252` appears in NO manual, old or new |
| X3 | French mullion `SPQ-1-46252` | Portfolio labels French Mullion `SPQ-005-30252` (a code ALSO used for the casement T-sash on the same page); `SPQ-1-46252` appears only in reinforcement + wind-loading pages | p10 vs p44, p73 | Manual internally inconsistent — supplier query, do NOT change app |
| X4 | Casement bead default 32mm | Assembly p19 says 28mm default, but the casement glass-deduction page p46 still says bead 32mm | p19 vs p46 | Manual self-contradiction — supplier query before any default flip |
| X5 | Sliding frame noted "face 48" | ~~Face 84, depth 48~~ **RESOLVED 2026-07-25 (phase-2): this row had it BACKWARDS.** The assembly sections settle it: in Section A (vertical cut, p29–32 / PDF 30–33) the frame head/cill section spans **84 front-to-back (track depth)** and stands **48 tall = the elevation sightline**; the 85 sightline belongs to the sash (dimensioned on SPQ-GL-20252 in the same sections). The catalog's `faceWidth: 48` is CORRECT and independently proven by the calibrated deduction Int = Ext − 96 = 2×48 (Andrei Jobs 44/48). NO catalog or CLAUDE.md change needed — the portfolio drawing (p15: 84 wide × 48 tall) simply dimensions the section, not the face. Q14 closes with zero impact. | p15, p29–32 | No action (row corrected; catalog + docs were right) |
| X6 | 3mm/end weld allowance | Appears in NO manual (only rule: beads mitred 45°, p80). **DONE 2026-07-25 (phase-2):** grep found no code comment citing a manual for weld values (all cite jobs — already correct); the missing provenance note was added to the global 2.5mm default in `src/catalog/settings.ts`. | — | Provenance fix: cite the calibrated jobs (Quotila 85/88/90, Andrei 44/48, Job 00000264), not the manual |
| X7 | T&T gated `quotable:false` (uncalibrated) | Manual fully specifies T&T: deductions p48 (both mullion variants), clear openings p37–38, assembly p21, size limits p70, EI p72–73 | multiple | **Opportunity** — phase-3 calibration |
| X8 | French Door "STULP mullion" terminology | No "STULP" anywhere; French *Window* has assembly+deductions; French *Door* section listed in TOC **does not exist** in the document | p23, p50 | Terminology note + supplier query (our French door is job-calibrated — keep) |
| X9 | Sliding OXXO nomenclature | Manual: 2-pane, 2-pane+fanlight, 3-pane centre, 4-pane centre; 3- and 4-pane pages share identical section-D (84/6/84) — possibly copy-pasted | p29–32 | Verify vs our Andrei-job calibration; supplier query on 3-vs-4 pane |
| X10–X12 | ED table / reinforcement length rules / glass deductions | **Identical to what the app already encodes** | PDF 42, p44, p46–54 | ✅ no change |

## 6. Key data blocks (verbatim-transcription targets during implementation)

Priority 1 = fabrication-critical. All are AutoCAD drawings — numbers hang on leader lines; **a
human (or careful visual read) must map each number to its junction**; naive text extraction is
insufficient.

| Pri | Block | Printed/PDF | Notes |
|---|---|---|---|
| 1 | Glass deductions, Casement 5ch & 6ch | p46 / 48 | 5ch: 96.50 frame→glass(sash), 132.00 glass↔glass (mullion), 84.50 (transom), 83.16, 49.00 frame→glass(fixed), 37.00. 6ch: +4.00 on every frame-edge value (100.50/53.00), glass↔glass unchanged. |
| 1 | Glass deductions, Tilt&Turn (2 mullion variants) | p48 / 50 | mullion SPQ-5-30252: 53.00 / 103.00 / 148.50 / 87.75 · mullion SPQ-005-30252: 53.00 / 103.00 / 137.00 / 87.00 |
| 1 | Glass deductions, Res. Door fan/side light | p51 / 53 | 53.00 / 130.00 / 48.50 / 202.50 (meeting stiles) / 125.50 (side light) |
| 1 | Door-leaf clear openings (the changed formulas) | p40 / 41 | C1–C3 above; confirm X1-vs-SW mapping from the drawing |
| 2 | Glass deductions, Sliding ×3 | p52–54 / 54–56 | 109.45 all edges, 70.00 interlock; +fanlight: 49.00, 174.85 (across coupler SPQ-2-76252); +sidelight: 146.00 (across panel adapter AD55144) |
| 2 | ED table 90°–180° | (none) / **PDF 42** | 91 rows; 90°=63.2 … 135°=53.2 … 180°=40.85. **Defects: rows 129° and 156° carry a stray `°` in the value column (54.62°, 47.81°). Step is NON-uniform (0.22 to ~0.29/°) — import as a lookup table, NEVER interpolate.** |
| 2 | Glass deductions, EnergyPlus / Resurge / French Window | p47/49/50 | EnergyPlus numerically == Casement despite 28mm bead (verify with supplier); Resurge & French Window: 96.50 / 132.00 |
| 3 | Reinforcement guidelines | p44 / 46 | Frames none; SPQ-05-20252 none ≤1.5m; SPQ-5-30252 / SPQ-005-30252 / SPQ-1-46252 none ≤1m; **sash + sliding rows BLANK** (unpublished); ≥95% mullion/transom length, ≥90% sash; fix 100mm from ends, ≤300mm centres, min 2 |
| 3 | Size limits + Reversible grid + sash-weight formula | p70–71 / 72–73 | table in phase-4 file; formula: glazing kg/m² = Σ(glass mm) × 2.5; sash kg = kg/m² × w × h. Reversible grid has ambiguous duplicate headers — supplier query |
| 3 | Wind-loading EI | p72–76 / 74–78 | 21 blocks; SPQ-050-30252 bare-only |
| 3 | Assembly face widths (all products) | p19–32 / 20–33 | source for C5–C10 |
| 4 | Cill vent drill positions | p63 / 65 | CILL-95: 33, 89.85 · CILL-150: 33, 71, 102, 132 · CILL-180: 33, 71, 102, 132, 165; Ø5 every ≤500mm |
| 4 | Thermal reinf screws | p45 / 47 | CFG 4.3×20 (reinf) / ×45 (keep/rebate) / ×65 (hinge) Z; ≤200mm centres (thermal only) |
| 4 | Interlocking wedges / trickle vents | p66–68 / 68–70 | wedges: <800mm:0, >800:1, >1200:2 (reversible: 500–1200:1, 1201–1500:2 @400mm); trickle slot 13mm; offsets casement 8 / T&T 10 / French door 25 |
| — | Deflection chart (max transom lengths) | p77 / 79 | **UNTRANSCRIBABLE — broken image link** (`C:\Users\amolk\Downloads\chart (1).png` literal in the PDF). Request from supplier. Only the UDL labels (−0.36/−0.74/−1.50 kN/m) exist. |

## 7. Terminology & document-quality notes

- No rebrand; keep "Sunnyplast" naming in the app. Treat "HAWDIO" as the file label only.
- Residual **"Liniar"** (competitor brand) text on p70–71 — the manual derives from a Liniar
  document; treat those paragraphs' claims (Kitemark etc.) as non-authoritative for Sunnyplast.
- Spelling landmines for anyone text-searching the PDF: "WINDOOW", "CHASEMENT", "RESURGE/
  RESURGANCES", "INTEROCKING", "DECOMRESSION", "REVERSILE", "Slinding", "Seni glazed".
- Referenced-but-absent external docs: "Doc Q / Part Q Manual" (PAS24 security), cited p64–71.
- Placeholder part codes literally printed as "( CODE )" / "( REQ CODE )" (dummy sash block,
  run-up ramp) — parts exist, codes unpublished.

## 8. What this means for the app (routing to phases)

- **phase-1-breaking-fixes.md** — X1/C1–C4 door clear-opening correction (not supplier-gated; the
  manual is unambiguous and internally consistent on this page).
- **phase-2-catalog-additions.md** — N1–N6 additions + X5 doc fix + X6 provenance fix.
- **phase-3-tilt-turn-calibration.md** — X7 (the big win).
- **phase-4-limits-and-validation.md** — §6 Pri-3/4 rule data as engine validation (size/weight
  limits, wedge counts, ED lookup for future bay/bow).
- **supplier-queries.md** — X2, X3, X4, X8, X9 + §6 flagged ambiguities + the missing deflection
  chart. Phases 2–4 note which steps are gated on which query.
