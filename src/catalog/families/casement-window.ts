// =====================================================================
// catalog/families/casement-window.ts — the windows family descriptor.
//
// SEED SOURCE (repo convention: the hardcoded TS catalog is the source of
// truth; prisma/seed.ts copies it into `product_family`).
//
// Contract: Spec/00-architecture/product-family-plugin.md §2 — everything here
// is DECLARATIVE DATA. The designer UI, the resolver, the line-item store and
// the basket read this descriptor and never special-case the family.
//
// GOLDEN RULE: the fabrication numbers below are not invented here. Every
// constraint is GENERATED from `src/engine/limits.ts#SIZE_LIMITS`, the verbatim
// HAWDIO p70 transcription imported in migration phase 4, and carries that
// page cite in its `source`. Phase 4 anticipated exactly this ("when Task 1
// lands, its constraints can be generated from SIZE_LIMITS rather than
// re-transcribed"), so there is ONE transcription of the size table in the repo.
// =====================================================================

import {
  MAX_TRANSOM_MULLION_LENGTH_MM,
  OVERSIZE_TOLERANCE,
  SIZE_LIMITS,
  findSizeLimit,
} from "../../engine/limits.ts";
import type {
  FamilyConstraint,
  ProductFamilyDescriptor,
} from "../../designer/option-types.ts";
import type { SashKind } from "../../types.ts";

/** Catalog product uuid for "Sunny Plast 70mm Casement" (collections/products). */
const CASEMENT_PRODUCT_ID = "1e503ae1-b978-4dc7-8747-935423503cc9";

/**
 * The sash kinds a casement unit can contain. Tilt&Turn is deliberately ABSENT:
 * it is a separate product line whose 123 designs are still gated
 * `quotable:false` pending migration phase 3 / question Q15.
 */
const CASEMENT_SASH_KINDS: SashKind[] = [
  "fixed",
  "casement-top",
  "casement-side-left",
  "casement-side-right",
];

// ---------------------------------------------------------------------
// Constraints, generated from the printed size table
// ---------------------------------------------------------------------

/**
 * Two bounds per dimension, mirroring `checkSizeLimits()`'s severity model
 * (phase 4): a WARNING at the printed maximum (fabricators do exceed limits
 * deliberately) and an ERROR past the 10% rule. Weight is not expressible in
 * the rule DSL (it needs the glass make-up), so it stays with the advisory
 * `limitIssues[]` on /api/quote — the resolver surfaces both.
 */
function sashConstraints(kind: SashKind): FamilyConstraint[] {
  const limit = findSizeLimit(kind);
  if (!limit) return []; // no printed row ⇒ no constraint. Never invent one.

  const out: FamilyConstraint[] = [];
  for (const axis of ["width", "height"] as const) {
    const path = axis === "width" ? "component.widthMm" : "component.heightMm";
    const max = axis === "width" ? limit.maxWidthMm : limit.maxHeightMm;
    const hard = Math.round(max * OVERSIZE_TOLERANCE * 10) / 10;

    // The id is keyed on the SASH KIND, not the limit row: one printed row can
    // cover several kinds (side-hung left/right share a row), and two issues
    // with the same id would be indistinguishable in the UI.
    out.push({
      id: `${kind}-max-${axis}`,
      severity: "warning",
      when: { componentType: "sash", componentKind: kind },
      assert: { lte: [path, max] },
      message: `${limit.label}: ${axis} exceeds the ${max} mm maximum (within the 10% rule — reduce the other dimension until the sash is within weight)`,
      source: limit.source,
    });
    out.push({
      id: `${kind}-max-${axis}-hard`,
      severity: "error",
      when: { componentType: "sash", componentKind: kind },
      assert: { lte: [path, hard] },
      message: `${limit.label}: ${axis} exceeds the ${max} mm maximum by more than 10% (${hard} mm)`,
      source: `${limit.source}; 10% rule, same page`,
    });
  }
  return out;
}

/** Whole-unit bound: the printed "Fixed (outer frame)" row is measured on the frame. */
function unitConstraints(): FamilyConstraint[] {
  const fixed = SIZE_LIMITS.find((l) => l.key === "fixed");
  if (!fixed) return [];
  return [
    {
      id: "unit-max-width",
      severity: "warning",
      assert: { lte: ["item.widthMm", fixed.maxWidthMm] },
      message: `Overall width exceeds the ${fixed.maxWidthMm} mm maximum outer-frame width`,
      source: fixed.source,
    },
    {
      id: "unit-max-height",
      severity: "warning",
      assert: { lte: ["item.heightMm", fixed.maxHeightMm] },
      message: `Overall height exceeds the ${fixed.maxHeightMm} mm maximum outer-frame height`,
      source: fixed.source,
    },
  ];
}

/** Longest transom/mullion = 1.8 m (a divider's length is its long axis). */
function dividerConstraints(): FamilyConstraint[] {
  return [
    {
      id: "transom-max-length",
      severity: "warning",
      when: { componentType: "transom" },
      assert: { lte: ["component.widthMm", MAX_TRANSOM_MULLION_LENGTH_MM] },
      message: `Transom longer than the ${MAX_TRANSOM_MULLION_LENGTH_MM} mm maximum`,
      source: "HAWDIO p70 (PDF 72): longest transom/mullion length = 1.8 m",
    },
    {
      id: "mullion-max-length",
      severity: "warning",
      when: { componentType: "mullion" },
      assert: { lte: ["component.heightMm", MAX_TRANSOM_MULLION_LENGTH_MM] },
      message: `Mullion longer than the ${MAX_TRANSOM_MULLION_LENGTH_MM} mm maximum`,
      source: "HAWDIO p70 (PDF 72): longest transom/mullion length = 1.8 m",
    },
  ];
}

// ---------------------------------------------------------------------
// The descriptor
// ---------------------------------------------------------------------

export const CASEMENT_WINDOW_FAMILY: ProductFamilyDescriptor = {
  familyKey: "casement-window",
  name: "Casement Window",
  status: "active",
  systemIds: ["sunnyplast-70"],

  designSource: {
    mode: "design-gallery",
    productIds: [CASEMENT_PRODUCT_ID],
  },

  // Overall-size guard rails for the measurements panel. The MAXIMA are the
  // printed outer-frame maxima (HAWDIO p70, via SIZE_LIMITS "fixed"); the
  // MINIMA are ergonomic UI floors, NOT manual figures — the manual publishes
  // no minimum unit size, so nothing is inferred. Real per-sash limits are
  // enforced by `constraints` below, not by these bounds.
  dimensions: [
    {
      key: "widthMm",
      label: "Overall width",
      unit: "mm",
      required: true,
      min: 400,
      max: SIZE_LIMITS.find((l) => l.key === "fixed")?.maxWidthMm ?? 3000,
      defaultFrom: "design",
    },
    {
      key: "heightMm",
      label: "Overall height",
      unit: "mm",
      required: true,
      min: 400,
      max: SIZE_LIMITS.find((l) => l.key === "fixed")?.maxHeightMm ?? 2000,
      defaultFrom: "design",
    },
    {
      key: "distanceFromFloorMm",
      label: "Distance from floor",
      unit: "mm",
      required: false,
      min: 0,
      max: 9999,
      informational: true, // recorded on documents; no engine effect
    },
  ],

  // equalGlass is DECLARED but deferred (questions.md Q4): it needs an
  // iterative solve around the engine. The phase-2 resolver returns a
  // not-implemented Issue for it rather than silently approximating.
  splitModes: ["byDimensions", "equalSplit", "equalGlass"],

  componentTypes: [
    { type: "frame-edge", sides: ["top", "bottom", "left", "right"] },
    { type: "transom" },
    { type: "mullion" },
    { type: "sash", kinds: CASEMENT_SASH_KINDS },
    { type: "glass" },
    { type: "panel" },
    { type: "cill" },
    { type: "addon", sides: ["top", "bottom", "left", "right"] },
  ],

  // Panel conversion is a glass-row swap (questions.md Q5) — our catalog models
  // panels as glass rows priced per m², so no fabrication difference is assumed.
  componentConversions: [
    { from: "glass", to: ["sash", "panel"] },
    { from: "sash", to: ["glass", "panel"] },
    { from: "panel", to: ["glass", "sash"] },
  ],

  topology: {
    guillotineSplits: true, // the extractor proves casement layouts are guillotine
    midrails: true, // engine: CellSpec.midrails (calibrated on Job 00000264)
    slidingPanels: false, // sliding is its own family/adapter
    maxNestingDepth: 3,
  },

  optionGroupKeys: [
    "profile-ancillary",
    "hardware",
    "glazing",
    "structure",
    "general",
    "placement",
  ],

  viewModes: ["external", "internal", "schematic", "3d"],

  engine: { adapter: "cellnode", quotable: true },

  constraints: [
    ...CASEMENT_SASH_KINDS.flatMap(sashConstraints),
    ...unitConstraints(),
    ...dividerConstraints(),
  ],
};

// The FAMILIES list moved to ./index.ts (phase 7): the seed reads the registry
// so that adding a family never edits a family file that isn't its own.
