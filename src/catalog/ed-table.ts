// =====================================================================
// catalog/ed-table.ts — EXTERNAL DEDUCTION (ED) LOOKUP TABLE
//
// VERBATIM transcription of the "EXTERNAL DEDUCTION ( ED )" table printed on
// the JOINT ASSEMBLIES / BAY POLE NEST ASSEMBLIES page of
// `collections/docs/HAWDIO 21-7-2026.pdf` — **PDF page 42**. That page carries
// NO printed page number (it sits in an unnumbered run), so it can only be
// cited by PDF page; see Spec/02-manual-migration/findings.md §0 on the
// manual's three numbering schemes.
//
// Same convention as `src/catalog/price-lists/*` (M5.5): the transcription IS
// the source of truth, values are copied exactly as printed, and print defects
// are RECORDED rather than silently corrected.
//
// ── NO CONSUMER YET ──────────────────────────────────────────────────
// The engine is 90°-rectangular only; ED is needed when bay/bow assemblies
// arrive (M6). This module is imported by its integrity test and nothing else,
// so it cannot affect any cut size, price or document today. Imported now, per
// Spec/questions.md Q17, because the analysis is fresh and the table has print
// defects worth capturing while they are documented.
//
// ── NEVER INTERPOLATE ────────────────────────────────────────────────
// The step is NOT uniform: 0.22/° from 90° to 129°, 0.24/° from 129° to 149°,
// then 0.29/° from 149° to 180° (plus the 135° quirk noted below). Reading a
// value for a non-integer or unlisted angle is therefore not defined by the
// manual — `edForAngle()` returns undefined rather than inventing one.
// =====================================================================

export interface EdRow {
  /** Corner angle in whole degrees, 90–180. */
  angleDeg: number;
  /** External Deduction in mm, exactly as printed. */
  edMm: number;
}

/**
 * Print defects on the source page, recorded not corrected.
 *
 * 1–2. The ED column for 129° and 156° prints a stray degree sign after the
 *      number ("54.62°", "47.81°") — the ED column is millimetres, so the `°`
 *      is a typesetting slip. The numeric values are transcribed as-is.
 * 3.   135° prints 53.2 where the surrounding 0.24/° run would give 53.18
 *      (134° = 53.42). Transcribed as printed; flagged so nobody "corrects" it.
 */
export const ED_TABLE_PRINT_DEFECTS = [
  { angleDeg: 129, note: "ED printed as '54.62°' — stray degree sign in a mm column" },
  { angleDeg: 156, note: "ED printed as '47.81°' — stray degree sign in a mm column" },
  { angleDeg: 135, note: "ED printed 53.2; the 0.24/° run implies 53.18 — printed value kept" },
] as const;

/** The 90° figure is also dimensioned on the drawing above the table (63.2). */
export const ED_TABLE: readonly EdRow[] = [
  // ---- left column, 90°–135° ----
  { angleDeg: 90, edMm: 63.2 },
  { angleDeg: 91, edMm: 62.98 },
  { angleDeg: 92, edMm: 62.76 },
  { angleDeg: 93, edMm: 62.54 },
  { angleDeg: 94, edMm: 62.32 },
  { angleDeg: 95, edMm: 62.1 },
  { angleDeg: 96, edMm: 61.88 },
  { angleDeg: 97, edMm: 61.66 },
  { angleDeg: 98, edMm: 61.44 },
  { angleDeg: 99, edMm: 61.22 },
  { angleDeg: 100, edMm: 61 },
  { angleDeg: 101, edMm: 60.78 },
  { angleDeg: 102, edMm: 60.56 },
  { angleDeg: 103, edMm: 60.34 },
  { angleDeg: 104, edMm: 60.12 },
  { angleDeg: 105, edMm: 59.9 },
  { angleDeg: 106, edMm: 59.68 },
  { angleDeg: 107, edMm: 59.46 },
  { angleDeg: 108, edMm: 59.24 },
  { angleDeg: 109, edMm: 59.02 },
  { angleDeg: 110, edMm: 58.8 },
  { angleDeg: 111, edMm: 58.58 },
  { angleDeg: 112, edMm: 58.36 },
  { angleDeg: 113, edMm: 58.14 },
  { angleDeg: 114, edMm: 57.92 },
  { angleDeg: 115, edMm: 57.7 },
  { angleDeg: 116, edMm: 57.48 },
  { angleDeg: 117, edMm: 57.26 },
  { angleDeg: 118, edMm: 57.04 },
  { angleDeg: 119, edMm: 56.82 },
  { angleDeg: 120, edMm: 56.6 },
  { angleDeg: 121, edMm: 56.38 },
  { angleDeg: 122, edMm: 56.16 },
  { angleDeg: 123, edMm: 55.94 },
  { angleDeg: 124, edMm: 55.72 },
  { angleDeg: 125, edMm: 55.5 },
  { angleDeg: 126, edMm: 55.28 },
  { angleDeg: 127, edMm: 55.06 },
  { angleDeg: 128, edMm: 54.84 },
  { angleDeg: 129, edMm: 54.62 }, // printed "54.62°" — see ED_TABLE_PRINT_DEFECTS
  { angleDeg: 130, edMm: 54.38 },
  { angleDeg: 131, edMm: 54.14 },
  { angleDeg: 132, edMm: 53.9 },
  { angleDeg: 133, edMm: 53.66 },
  { angleDeg: 134, edMm: 53.42 },
  { angleDeg: 135, edMm: 53.2 }, // 0.24/° run implies 53.18 — printed value kept
  // ---- right column, 136°–180° ----
  { angleDeg: 136, edMm: 52.96 },
  { angleDeg: 137, edMm: 52.72 },
  { angleDeg: 138, edMm: 52.48 },
  { angleDeg: 139, edMm: 52.24 },
  { angleDeg: 140, edMm: 52 },
  { angleDeg: 141, edMm: 51.76 },
  { angleDeg: 142, edMm: 51.52 },
  { angleDeg: 143, edMm: 51.28 },
  { angleDeg: 144, edMm: 51.04 },
  { angleDeg: 145, edMm: 50.8 },
  { angleDeg: 146, edMm: 50.56 },
  { angleDeg: 147, edMm: 50.32 },
  { angleDeg: 148, edMm: 50.08 },
  { angleDeg: 149, edMm: 49.84 },
  { angleDeg: 150, edMm: 49.55 },
  { angleDeg: 151, edMm: 49.26 },
  { angleDeg: 152, edMm: 48.97 },
  { angleDeg: 153, edMm: 48.68 },
  { angleDeg: 154, edMm: 48.39 },
  { angleDeg: 155, edMm: 48.1 },
  { angleDeg: 156, edMm: 47.81 }, // printed "47.81°" — see ED_TABLE_PRINT_DEFECTS
  { angleDeg: 157, edMm: 47.52 },
  { angleDeg: 158, edMm: 47.23 },
  { angleDeg: 159, edMm: 46.94 },
  { angleDeg: 160, edMm: 46.65 },
  { angleDeg: 161, edMm: 46.36 },
  { angleDeg: 162, edMm: 46.07 },
  { angleDeg: 163, edMm: 45.78 },
  { angleDeg: 164, edMm: 45.49 },
  { angleDeg: 165, edMm: 45.2 },
  { angleDeg: 166, edMm: 44.91 },
  { angleDeg: 167, edMm: 44.62 },
  { angleDeg: 168, edMm: 44.33 },
  { angleDeg: 169, edMm: 44.04 },
  { angleDeg: 170, edMm: 43.75 },
  { angleDeg: 171, edMm: 43.46 },
  { angleDeg: 172, edMm: 43.17 },
  { angleDeg: 173, edMm: 42.88 },
  { angleDeg: 174, edMm: 42.59 },
  { angleDeg: 175, edMm: 42.3 },
  { angleDeg: 176, edMm: 42.01 },
  { angleDeg: 177, edMm: 41.72 },
  { angleDeg: 178, edMm: 41.43 },
  { angleDeg: 179, edMm: 41.14 },
  { angleDeg: 180, edMm: 40.85 },
] as const;

const BY_ANGLE = new Map<number, number>(ED_TABLE.map((r) => [r.angleDeg, r.edMm]));

/**
 * External Deduction for a corner angle, or `undefined` when the angle is not
 * a listed whole degree in 90–180.
 *
 * Deliberately does NOT interpolate — the printed step changes three times, so
 * any interpolated figure would be invented, not sourced (golden rule).
 */
export function edForAngle(angleDeg: number): number | undefined {
  return BY_ANGLE.get(angleDeg);
}
