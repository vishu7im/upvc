// =====================================================================
// catalog/families/sliding-patio.ts — the sliding-patio family descriptor.
//
// SEED SOURCE. Pure DATA, like every other family file. What makes this one
// different from casement/entrance-door/french-door is not the descriptor — it
// is the ADAPTER it names: `engine.adapter: "sliding"`
// (`src/designer/adapters/sliding.ts`), because a patio row is one
// `kind:"sliding"` node with `panels[]`, not a tree of splits.
//
// NOTHING HERE IS A NEW FABRICATION RULE. The family is calibrated from real
// production documents — Jobs 44/48 "Andrei UK" (patio-docs/, 2-panel) and
// `patio_calibration.pdf` (four items F1–F4 covering 2-, 3- and 4-panel
// layouts, which corrected the per-configuration width constant K). See
// CLAUDE.md "## Sliding Patio" and "## Field fixes — 2026-08-04".
//
// STUDIO SCOPE (owner decision, 2026-08-04): sizes, panel widths and options.
// NOT panel count and NOT flipping a panel between fixed and sliding — the
// design chooses those. That is why there are no `structure` actions, no
// `componentConversions` and why every topology edit is rejected with a reason
// by the adapter rather than quietly ignored.
// =====================================================================

import type { ProductFamilyDescriptor } from "../../designer/option-types.ts";
import type { SashKind } from "../../types.ts";

/** Catalog product uuid for "Sunny Plast Sliding Patio" (collections/products). */
const SLIDING_PRODUCT_ID = "73679b0a-2133-46fd-b8cd-b402544a600c";

/** The panel roles the engine emits (`topology.ts#buildSlidingPanels`). */
export const SLIDING_SASH_KINDS: SashKind[] = [
  "sliding-fixed",
  "sliding-slide-left",
  "sliding-slide-right",
];

export const SLIDING_PATIO_FAMILY: ProductFamilyDescriptor = {
  familyKey: "sliding-patio",
  name: "Sliding Patio",
  status: "active",
  systemIds: ["sunnyplast-70"],

  designSource: {
    mode: "design-gallery",
    productIds: [SLIDING_PRODUCT_ID],
  },

  // ERGONOMIC GUARD RAILS — DELIBERATELY UNCITED.
  //
  // `src/engine/limits.ts#SIZE_LIMITS` is the verbatim HAWDIO p70 transcription
  // and it has NO SLIDING ROW: the printed table covers casement, tilt&turn,
  // flush sash, resurgence, residential/French door and fixed lights only, and
  // `checkSizeLimits()` returns [] for a family with no printed row rather than
  // inventing one. So this family declares no size constraints at all (see
  // `constraints` below) and these bounds carry no `source` — they are wide
  // enough to admit every job we hold (the calibration documents run
  // 1900–4000 wide, and the D9 field job is 4050 × 1040) and exist only to
  // stop a typo reaching the engine.
  dimensions: [
    {
      key: "widthMm",
      label: "Overall width",
      unit: "mm",
      required: true,
      min: 600,
      max: 6000,
      defaultFrom: "design",
    },
    {
      key: "heightMm",
      label: "Overall height",
      unit: "mm",
      required: true,
      min: 600,
      max: 3000,
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

  // byDimensions only. A patio row's spans are the n−1 panel BOUNDARIES, which
  // the canvas writes as `splitRatios` keys `root.b{i}` → `solve.ts#
  // applySplitRatios` → `CellNode.boundaries` → `topology.ts#panelFractions`.
  // `equalSplit` is omitted because it would be a no-op with a name: equal
  // panels ARE the absence of `boundaries` (1/n each), which is the state the
  // calibrated width formula was derived in — offering the mode would suggest
  // the studio does something it does not. `equalGlass` is deferred
  // platform-wide (questions.md Q4).
  splitModes: ["byDimensions"],

  // What `adapters/sliding.ts#listComponents` actually emits. A panel is typed
  // `sash` — it IS a sash ring, four mitred bars around its own glazing — with
  // the engine's own SashKind as its `kind`. There is deliberately no `glass`
  // entry: the row carries ONE glassKey for every panel, so a per-panel glazing
  // answer is not expressible and no component is emitted to scope one to.
  componentTypes: [
    { type: "frame-edge", sides: ["top", "bottom", "left", "right"] },
    { type: "sash", kinds: SLIDING_SASH_KINDS },
    { type: "cill" },
  ],

  // DELIBERATELY EMPTY — panel count and layout come from the design.
  componentConversions: [],

  topology: {
    guillotineSplits: false, // no transom/mullion/interlock in the cut list
    midrails: false, // calibrated only for welded sash rings
    slidingPanels: true,
    maxNestingDepth: 1,
  },

  // No `hardware` group: the patio hardware set is computed per panel by the
  // engine (handle, cylinder, lock & keep, 2 rollers, stopper, brushes, fixed-
  // panel supports) and three of its rows are flagged APPROXIMATE in the
  // catalog — the Andrei documents list no hardware. Offering a substitution
  // slot over an uncalibrated tally would price a guess.
  //
  // No `structure` group either: every action it holds is an edit this family
  // rejects, and a button that always fails is worse than no button.
  optionGroupKeys: ["profile-ancillary", "glazing", "general", "placement"],

  viewModes: ["external", "internal", "schematic", "3d"],

  engine: { adapter: "sliding", quotable: true },

  // NO CONSTRAINTS, ON PURPOSE. See the dimensions comment: HAWDIO p70 prints
  // no sliding row, and `SIZE_LIMITS` leaves the family unmapped precisely so
  // that nothing invents one. The 1.8 m transom/mullion rule is not applicable
  // either — a patio row has no transom or mullion.
  constraints: [],
};
