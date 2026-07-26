// =====================================================================
// engine/limits.ts — SIZE & WEIGHT LIMITS (pure)
//
// Imported from the fabrication manual `collections/docs/HAWDIO 21-7-2026.pdf`
// (migration phase-4). Every value below is transcribed VERBATIM from a printed
// page and carries its citation — nothing here is derived or guessed.
//
// Cited pages (printed / PDF): p70 / 72 "SIZE LIMITATIONS — maximum sizes for
// windows & doors"; p71 / 73 "SIZE LIMITATIONS — custom sash weight calculation".
//
// PURE: like the rest of `src/engine/*` this module does no I/O. It is
// advisory only — NOTHING here feeds cut math, so importing it cannot change a
// single cut size, price or document. Callers turn the returned issues into
// warnings (see `src/api/*`).
// =====================================================================

import type { Rect, SashKind, SolvedCell, SolvedMullion, SolvedTransom } from "../types.ts";

/**
 * The minimum shape `checkSizeLimits` needs. Deliberately narrower than
 * `SolvedGeometry` so it also accepts `QuoteOutput.geometry` (which omits
 * `rootDaylight`) without a cast.
 */
export interface LimitCheckGeometry {
  outer: Rect;
  cells: readonly SolvedCell[];
  transoms: readonly SolvedTransom[];
  mullions: readonly SolvedMullion[];
}

// ---------------------------------------------------------------------
// GLAZING WEIGHT — HAWDIO p71 (PDF 73), "CUSTOM SASH WEIGHT CALCULATION"
//
// Printed verbatim:
//   "1mm thickness of glass weighs 2.5kg/m²"
//   "To calculate the weight per m² of a glazed unit, add up the total
//    thickness of glass  eg. 8.4/14/6 = 8+6+4mm of glass (14.4mm)"
//   "Multiply the total glass thickness by 2.5kg/m²  eg. 14.4 x 2.5 = 36kg/m²"
//   "Sash weight (kg) = glazing weight/m² (kg) x (sash width (m) x sash height (m))"
//
// NB on the worked example: the unit "8.4/14/6" is pane 8.4mm / spacer 14mm /
// pane 6mm. The GLASS total is 8.4 + 6 = 14.4mm — the SPACER IS EXCLUDED. The
// manual's "8+6+4mm" is its own (garbled) way of writing the make-up; the
// authoritative figure is the bracketed 14.4mm, which its own next line
// multiplies out to 36 kg/m². The tests assert the printed 14.4 and 36.
// ---------------------------------------------------------------------

/** kg/m² per 1mm of glass thickness — HAWDIO p71 (PDF 73). */
export const GLAZING_KG_PER_MM_PER_M2 = 2.5;

/**
 * The glazing make-up the printed size limits are based on — HAWDIO p70
 * (PDF 72) header: "The maximum sizes stated below (mm) are based on 28 mm
 * 4-20-4 standard double glazed units within frames manufactured to the
 * reinforcement guidelines."
 *
 * 4-20-4 = two 4mm panes around a 20mm spacer ⇒ 8mm of glass ⇒ 20 kg/m².
 * Every printed max weight equals maxW(m) × maxH(m) × 20 — see limits.test.ts,
 * which asserts that on all 9 rows. That agreement is what proves both this
 * formula and the transcription of the table below.
 */
export const STANDARD_UNIT_PANES_MM: readonly number[] = [4, 4];

/**
 * Glazed-unit weight per m². Sum of the GLASS pane thicknesses (spacers
 * excluded) × 2.5. HAWDIO p71 (PDF 73).
 */
export function glazingWeightPerM2(paneThicknessesMm: readonly number[]): number {
  const totalGlassMm = paneThicknessesMm.reduce((a, b) => a + b, 0);
  return totalGlassMm * GLAZING_KG_PER_MM_PER_M2;
}

/**
 * Sash weight in kg, assuming the sash is made completely from glass — the
 * manual's stated simplification ("All custom sash weights are calculated by
 * taking the overall width & height of the sash, and assuming it is made
 * completely from glass"). HAWDIO p71 (PDF 73).
 */
export function sashWeightKg(
  paneThicknessesMm: readonly number[],
  widthMm: number,
  heightMm: number,
): number {
  return glazingWeightPerM2(paneThicknessesMm) * (widthMm / 1000) * (heightMm / 1000);
}

// ---------------------------------------------------------------------
// SIZE LIMITATIONS — HAWDIO p70 (PDF 72)
//
// Transcribed verbatim. `maxWidthMm`/`maxHeightMm` are SASH sizes except for
// the `fixed` row, which the page explicitly labels "(OUTER FRAME SIZE)".
// Families the app does not model (50mm Flush Sash, Resurgence, Reversible)
// are transcribed anyway — recording costs nothing and they become live the
// moment such a family is added. `sashKinds` is empty for those.
// ---------------------------------------------------------------------

export interface SizeLimit {
  key: string;
  /** Exactly as printed on p70. */
  label: string;
  maxWidthMm: number;
  maxHeightMm: number;
  maxWeightKg: number;
  /** Whether the dims describe the SASH or the OUTER FRAME (p70 wording). */
  measuredOn: "sash" | "outerFrame";
  /** Engine SashKinds this row governs; empty ⇒ family not modelled yet. */
  sashKinds: readonly SashKind[];
  source: string;
}

export const SIZE_LIMITS: readonly SizeLimit[] = [
  {
    key: "casement-top-hung",
    label: "CASEMENT TOP HUNG - (SASH SIZE)",
    maxWidthMm: 1265, maxHeightMm: 1342, maxWeightKg: 34,
    measuredOn: "sash",
    sashKinds: ["casement-top"],
    source: "HAWDIO p70 (PDF 72): '1265 w x 1342 h, max sash weight = 34 kg'",
  },
  {
    key: "casement-side-hung",
    label: "CASEMENT SIDE HUNG - (SASH SIZE)",
    maxWidthMm: 715, maxHeightMm: 1342, maxWeightKg: 19.2,
    measuredOn: "sash",
    sashKinds: ["casement-side-left", "casement-side-right"],
    source: "HAWDIO p70 (PDF 72): '715 w x 1342 h, max sash weight = 19.2 kg'",
  },
  {
    key: "tilt-turn-vent",
    label: "TILT & TURN VENT SIZE - (SASH SIZE)",
    maxWidthMm: 1402, maxHeightMm: 1402, maxWeightKg: 39.3,
    measuredOn: "sash",
    sashKinds: ["tilt-turn"],
    source: "HAWDIO p70 (PDF 72): '1402 w x1402 h, max sash weight = 39.3 kg'",
  },
  {
    key: "flush-sash-50-top-hung",
    label: "50MM FLUSH SASH TOP HUNG - (SASH SIZE)",
    maxWidthMm: 1080, maxHeightMm: 1080, maxWeightKg: 23.3,
    measuredOn: "sash",
    sashKinds: [], // Flush Sash family not modelled
    source: "HAWDIO p70 (PDF 72): '1080 w x 1080 h, max sash weight = 23.3 kg'",
  },
  {
    key: "flush-sash-50-side-hung",
    label: "5OMM FLUSH SASH SIDE HUNG - (SASH SIZE)",
    maxWidthMm: 715, maxHeightMm: 1342, maxWeightKg: 19.2,
    measuredOn: "sash",
    sashKinds: [], // Flush Sash family not modelled
    source: "HAWDIO p70 (PDF 72): '715 w x 1342 h, max sash weight = 19.2 kg,'",
  },
  {
    key: "resurgence-top-hung",
    label: "RESURGENCE TOP HUNG - (SASH SIZE)",
    maxWidthMm: 1265, maxHeightMm: 1342, maxWeightKg: 34.0,
    measuredOn: "sash",
    sashKinds: [], // Resurgence family not modelled
    source: "HAWDIO p70 (PDF 72): '1265 w x 1342 h, max sash weight = 34.0 kg'",
  },
  {
    key: "resurgence-side-hung",
    label: "RESURGENCE SIDE HUNG - (SASH SIZE)",
    maxWidthMm: 715, maxHeightMm: 1342, maxWeightKg: 19.2,
    measuredOn: "sash",
    sashKinds: [], // Resurgence family not modelled
    source: "HAWDIO p70 (PDF 72): '715 w x 1342 h, max sash weight = 19.2 kg'",
  },
  {
    key: "residential-door",
    label: "RESIDENTIAL DOOR - (SASH SIZE)",
    maxWidthMm: 1002, maxHeightMm: 2156, maxWeightKg: 43.2,
    measuredOn: "sash",
    sashKinds: ["door-left", "door-right"],
    source: "HAWDIO p70 (PDF 72): '1002 w x2156 h, max sash weight = 43.2 kg'",
  },
  {
    key: "french-door",
    label: "FRENCH DOOR - (SASH SIZE)",
    maxWidthMm: 998, maxHeightMm: 2146, maxWeightKg: 42.8,
    measuredOn: "sash",
    sashKinds: ["french-door-master", "french-door-slave"],
    source: "HAWDIO p70 (PDF 72): '998 wx 2146 h, max sash weight = 42.8 kg'",
  },
  {
    key: "fixed",
    label: "FIXED - (OUTER FRAME SIZE)",
    // Printed "2000 h x 3000 w" — i.e. width 3000, height 2000.
    maxWidthMm: 3000, maxHeightMm: 2000, maxWeightKg: 120,
    measuredOn: "outerFrame",
    sashKinds: [], // applies to the whole unit, not a sash — checked separately
    source: "HAWDIO p70 (PDF 72): '2000 h x 3000 w, max weight = 120 kg'",
  },
] as const;

/**
 * Longest permitted transom/mullion — HAWDIO p70 (PDF 72):
 * "Longest transom/ mullion length = 1.8m".
 */
export const MAX_TRANSOM_MULLION_LENGTH_MM = 1800;

/**
 * Multi-light unit limit — HAWDIO p70 (PDF 72): "Max size multi-light window
 * suitable for use Upto 1200 Pa gusting is 2700x1800h when using either 67rmm
 * or 87mm transom/ mullion profiles."
 */
export const MULTI_LIGHT_LIMIT = {
  maxWidthMm: 2700,
  maxHeightMm: 1800,
  gustingPa: 1200,
  source: "HAWDIO p70 (PDF 72), multi-light note",
} as const;

/**
 * The "10% rule" — HAWDIO p70 (PDF 72), printed verbatim:
 * "Width or height of above maximum sizes may be increased by a maximum of 10%
 *  if required so long as the dimension perpendicular is reduced until the
 *  product maximum weight is equal or lower than stated above."
 *
 * So a dimension over its printed max but within +10% is ALLOWED PROVIDED the
 * weight still fits — that is a warning (check the weight), while beyond +10%
 * there is no allowance at all — that is an error.
 *
 * NB p70 also states "10% rules not applicable to reversible window" (family
 * not modelled here).
 */
export const OVERSIZE_TOLERANCE = 1.1;

// ---------------------------------------------------------------------
// CHECKING
// ---------------------------------------------------------------------

export interface LimitIssue {
  severity: "warning" | "error";
  /** Stable machine code, e.g. "sash-oversize". */
  code: string;
  /** Which SIZE_LIMITS row raised it. */
  limitKey: string;
  /** Human message, including the cited limit. */
  message: string;
  /** Cell pathId when the issue is about one sash; undefined for whole-unit. */
  pathId?: string;
  source: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function findSizeLimit(kind: SashKind): SizeLimit | undefined {
  return SIZE_LIMITS.find((l) => l.sashKinds.includes(kind));
}

/**
 * Advisory size/weight check over solved geometry.
 *
 * Returns [] when everything is inside the printed maxima — and ALWAYS returns
 * [] for families the manual doesn't cover (no matching SIZE_LIMITS row), since
 * inventing a limit would breach the golden rule.
 *
 * `paneThicknessesMm` defaults to the manual's own basis (4-20-4). Pass the
 * real make-up when a heavier unit is specified; weight checks are skipped
 * entirely if an empty array is passed (unknown make-up ⇒ never guess).
 */
export function checkSizeLimits(
  geometry: LimitCheckGeometry,
  opts: { paneThicknessesMm?: readonly number[] } = {},
): LimitIssue[] {
  const panes = opts.paneThicknessesMm ?? STANDARD_UNIT_PANES_MM;
  const weighable = panes.length > 0;
  const issues: LimitIssue[] = [];

  // --- per-sash checks -------------------------------------------------
  for (const cell of geometry.cells) {
    const rect = cell.sashOuter;
    if (!rect) continue; // fixed light: no sash to weigh
    const limit = findSizeLimit(cell.content);
    if (!limit) continue; // family not covered by p70 — never invent a limit

    const overW = rect.w > limit.maxWidthMm;
    const overH = rect.h > limit.maxHeightMm;

    if (overW || overH) {
      const beyondTolerance =
        rect.w > limit.maxWidthMm * OVERSIZE_TOLERANCE ||
        rect.h > limit.maxHeightMm * OVERSIZE_TOLERANCE;
      const dims: string[] = [];
      if (overW) dims.push(`width ${round2(rect.w)} > ${limit.maxWidthMm}`);
      if (overH) dims.push(`height ${round2(rect.h)} > ${limit.maxHeightMm}`);
      issues.push({
        severity: beyondTolerance ? "error" : "warning",
        code: beyondTolerance ? "sash-oversize-beyond-10pct" : "sash-oversize",
        limitKey: limit.key,
        pathId: cell.pathId,
        message: beyondTolerance
          ? `${limit.label}: sash ${dims.join(", ")} — beyond the 10% rule ` +
            `(max +10% ⇒ ${round2(limit.maxWidthMm * OVERSIZE_TOLERANCE)} × ` +
            `${round2(limit.maxHeightMm * OVERSIZE_TOLERANCE)}).`
          : `${limit.label}: sash ${dims.join(", ")} — within the 10% rule, ` +
            `allowed only if the perpendicular dimension is reduced so the sash ` +
            `weight stays ≤ ${limit.maxWeightKg} kg.`,
        source: limit.source,
      });
    }

    if (weighable) {
      const kg = sashWeightKg(panes, rect.w, rect.h);
      if (kg > limit.maxWeightKg) {
        issues.push({
          severity: "error",
          code: "sash-overweight",
          limitKey: limit.key,
          pathId: cell.pathId,
          message:
            `${limit.label}: sash weight ${round2(kg)} kg > ${limit.maxWeightKg} kg ` +
            `(${round2(glazingWeightPerM2(panes))} kg/m² glazing).`,
          source: limit.source,
        });
      }
    }
  }

  // --- whole-unit (outer frame) check ---------------------------------
  const fixed = SIZE_LIMITS.find((l) => l.key === "fixed")!;
  const { w, h } = geometry.outer;
  if (w > fixed.maxWidthMm || h > fixed.maxHeightMm) {
    const parts: string[] = [];
    if (w > fixed.maxWidthMm) parts.push(`width ${round2(w)} > ${fixed.maxWidthMm}`);
    if (h > fixed.maxHeightMm) parts.push(`height ${round2(h)} > ${fixed.maxHeightMm}`);
    issues.push({
      severity: "warning",
      code: "unit-oversize",
      limitKey: fixed.key,
      message: `${fixed.label}: outer frame ${parts.join(", ")}.`,
      source: fixed.source,
    });
  }

  // --- transom / mullion length ---------------------------------------
  const longBars = [
    ...geometry.transoms.map((t) => ({ kind: "transom", len: t.extLengthMm })),
    ...geometry.mullions.map((m) => ({ kind: "mullion", len: m.extLengthMm })),
  ].filter((b) => b.len > MAX_TRANSOM_MULLION_LENGTH_MM);

  for (const bar of longBars) {
    issues.push({
      severity: "warning",
      code: "divider-too-long",
      limitKey: "transom-mullion-length",
      message:
        `${bar.kind} length ${round2(bar.len)} mm exceeds the longest permitted ` +
        `transom/mullion (${MAX_TRANSOM_MULLION_LENGTH_MM} mm).`,
      source: "HAWDIO p70 (PDF 72): 'Longest transom/ mullion length = 1.8m'",
    });
  }

  return issues;
}

// ---------------------------------------------------------------------
// INTERLOCKING WEDGES — HAWDIO p66 (PDF 68), recorded but NOT a BOM rule.
//
// Printed verbatim: "X - Run-up Ramp Positioning ( code )
//   <800  mm = 0 required / >800  mm = 1 required / >1200 mm = 2 required"
//
// TWO reasons this is data-only and emits no hardware line:
//  1. The manual prints the literal placeholders "( code )" and "( REQ CODE )"
//     where the part number belongs — Sunny Plast never filled them in, so
//     there is NO code to put in a BOM (golden rule ⇒ supplier query Q-L).
//  2. Which dimension the rule measures is not stated in words. The two
//     drawings mark ">800 mm" on the HINGED edge (height for the side-hung
//     sash, width for the top-hung one), so `wedgeCount` takes that edge's
//     length — but that reading is inferred from the drawings, not printed.
//
// The separate Reversible rule on p67 (500–1200 ⇒ 1, 1201–1500 ⇒ 2) is NOT
// encoded: the Reversible family is not modelled (supplier query Q-K).
// ---------------------------------------------------------------------

export function wedgeCount(hingedEdgeLengthMm: number): number {
  if (hingedEdgeLengthMm > 1200) return 2;
  if (hingedEdgeLengthMm > 800) return 1;
  return 0;
}

// ---------------------------------------------------------------------
// TRICKLE VENT ROUTING — HAWDIO p68 (PDF 70). Reference data only; no
// consumer (surfacing these on the Work Order is gated on Spec/questions.md
// Q16). Slot width is printed once for all products.
// ---------------------------------------------------------------------

export const TRICKLE_VENT = {
  slotWidthMm: 13, // "Vent slot typically 13 mm wide"
  /** Routing offset from the reference face, per product (p68 drawings). */
  offsetMm: { casement70: 8, tiltTurn: 10, frenchDoor: 25 },
  source: "HAWDIO p68 (PDF 70) 'TYPICAL TRICKLE VENT ROUTING POSITIONS'",
} as const;
