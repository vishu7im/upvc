// =====================================================================
// catalog/families/french-door.ts — the French-door family descriptor.
//
// SEED SOURCE. Like `entrance-door.ts`, this file plus
// `src/catalog/options/french.ts` are pure DATA: no designer-UI code, no
// resolver branch, no new adapter. A French doorset is an ordinary `CellNode`
// tree (two leaves either side of a vsplit), so it runs on the `cellnode`
// adapter unchanged.
//
// NOTHING HERE IS A NEW FABRICATION RULE. The family was calibrated in full
// from 5 real Windowmaker production documents ("Job 00000264",
// docs/french-door/) — see CLAUDE.md "## French Door". Every printed limit
// below is generated from `src/engine/limits.ts#SIZE_LIMITS`, the verbatim
// HAWDIO p70 transcription, exactly as the casement and entrance-door
// descriptors do, so the repo still holds ONE copy of the printed size table.
// =====================================================================

import {
  MAX_TRANSOM_MULLION_LENGTH_MM,
  OVERSIZE_TOLERANCE,
  findSizeLimit,
} from "../../engine/limits.ts";
import type {
  FamilyConstraint,
  ProductFamilyDescriptor,
} from "../../designer/option-types.ts";
import type { SashKind } from "../../types.ts";

/** Catalog product uuid for "Sunny Plast 70mm French Door" (collections/products). */
const FRENCH_PRODUCT_ID = "3acbb38c-351b-44e5-8378-33c70ef07a8b";

/**
 * What a French unit can contain: the two leaves plus fixed lights, since 5 of
 * the 12 quotable French designs carry sidelights and fanlights around the pair.
 *
 * MASTER is the handle side (left by convention); SLAVE takes the shootbolt.
 * The engine reads the pair off the cell contents — `hardware.ts` fits the
 * master-leaf gear on `french-door-master` and the shootbolt on
 * `french-door-slave` — so which leaf is which is a topology answer, not a
 * separate option.
 */
export const FRENCH_SASH_KINDS: SashKind[] = [
  "fixed",
  "french-door-master",
  "french-door-slave",
];

/**
 * Two bounds per leaf dimension from the printed FRENCH DOOR row, mirroring
 * `checkSizeLimits()`: a WARNING at the printed maximum and an ERROR past the
 * 10% rule. Identical in shape to the casement and entrance-door generators.
 */
function leafConstraints(kind: SashKind): FamilyConstraint[] {
  const limit = findSizeLimit(kind);
  if (!limit) return []; // no printed row ⇒ no constraint. Never invent one.

  const out: FamilyConstraint[] = [];
  for (const axis of ["width", "height"] as const) {
    const path = axis === "width" ? "component.widthMm" : "component.heightMm";
    const max = axis === "width" ? limit.maxWidthMm : limit.maxHeightMm;
    const hard = Math.round(max * OVERSIZE_TOLERANCE * 10) / 10;
    out.push({
      id: `${kind}-max-${axis}`,
      severity: "warning",
      when: { componentType: "sash", componentKind: kind },
      assert: { lte: [path, max] },
      message: `${limit.label}: ${axis} exceeds the ${max} mm maximum (within the 10% rule — check the leaf weight)`,
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

/**
 * The 1.8 m transom/mullion rule — WITH THE STULP EXEMPTED.
 *
 * The printed maximum governs a welded FRAME divider. The French mullion is not
 * one: `SPQ-1-46252` is a square-cut STULP mounted on the slave leaf and
 * spanning the full daylight height, and Job 00000264 prints it at **2004 mm**
 * on an ordinary 1700 × 2100 doorset — a real production document, well past
 * 1.8 m, on the standard size of the product. Applying the generic rule would
 * therefore warn on EVERY French door we can build, which is the definition of
 * a constraint that teaches the user to ignore constraints.
 *
 * The exemption is expressed in the rule itself (`kind` is the divider's
 * jointType, "S" for the stulp) rather than by omitting the mullion rule, so a
 * French unit with a real welded mullion beside a sidelight is still checked.
 */
function dividerConstraints(): FamilyConstraint[] {
  const source = "HAWDIO p70 (PDF 72): longest transom/mullion length = 1.8 m";
  return [
    {
      id: "transom-max-length",
      severity: "warning",
      when: { componentType: "transom" },
      assert: { lte: ["component.widthMm", MAX_TRANSOM_MULLION_LENGTH_MM] },
      message: `Transom longer than the ${MAX_TRANSOM_MULLION_LENGTH_MM} mm maximum`,
      source,
    },
    {
      id: "mullion-max-length",
      severity: "warning",
      when: { componentType: "mullion" },
      assert: {
        any: [
          // The stulp: square-cut, leaf-mounted, calibrated at 2004 mm.
          { eq: ["component.kind", "S"] },
          { lte: ["component.heightMm", MAX_TRANSOM_MULLION_LENGTH_MM] },
        ],
      },
      message: `Mullion longer than the ${MAX_TRANSOM_MULLION_LENGTH_MM} mm maximum`,
      source: `${source}. The French stulp is exempt: Job 00000264 prints SPQ-1-46252 at 2004 mm.`,
    },
  ];
}

export const FRENCH_DOOR_FAMILY: ProductFamilyDescriptor = {
  familyKey: "french-door",
  name: "French Door",
  status: "active",
  systemIds: ["sunnyplast-70"],

  designSource: {
    mode: "design-gallery",
    productIds: [FRENCH_PRODUCT_ID],
  },

  // GUARD RAILS, NOT MANUAL FIGURES — the same honesty as `entrance-door`. The
  // manual publishes a maximum French LEAF (998 × 2146, enforced by the
  // generated constraints above) but no maximum outer-frame size for a doorset.
  // The minimum width is the one figure with a reason behind it: a French unit
  // is a PAIR, so it must hold two leaves plus the 48 mm stulp and two 48 mm
  // jambs — below ~900 mm there is no doorset to build.
  dimensions: [
    {
      key: "widthMm",
      label: "Overall width",
      unit: "mm",
      required: true,
      min: 900,
      max: 3000,
      defaultFrom: "design",
    },
    {
      key: "heightMm",
      label: "Overall height",
      unit: "mm",
      required: true,
      min: 1500,
      max: 2700,
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

  // equalGlass is declared but still deferred platform-wide (questions.md Q4);
  // the resolver reports not-implemented rather than approximating.
  splitModes: ["byDimensions", "equalSplit", "equalGlass"],

  componentTypes: [
    { type: "frame-edge", sides: ["top", "bottom", "left", "right"] },
    { type: "transom" }, // fanlight over the pair
    { type: "mullion" }, // the stulp, and any sidelight mullion
    { type: "sash", kinds: FRENCH_SASH_KINDS },
    { type: "glass" },
    { type: "panel" },
    { type: "cill" },
    { type: "addon", sides: ["top", "bottom", "left", "right"] },
  ],

  // DELIBERATELY EMPTY. Converting a fixed light INTO a sash goes through
  // `cellnode.ts#applyEdit`, which falls back to `DEFAULT_SASH_KEY = "sash-t"`
  // when the target cell carries no `sashKey` of its own — the casement profile
  // (face 79, 2.5 mm weld), not a French leaf (face 105, 20 mm overlap, 3 mm
  // weld). A French sidelight would therefore be converted into a casement sash
  // and cut wrong. Until the adapter takes a family-supplied default sash
  // profile, this family offers no conversions and `structure.component-type`
  // is not adopted (see options/french.ts). Recorded in Spec/questions.md.
  componentConversions: [],

  topology: {
    guillotineSplits: true, // sidelights/fanlights are guillotine cuts
    midrails: true, // engine: CellSpec.midrails — CALIBRATED here (Job 00000264)
    slidingPanels: false,
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

  constraints: [...FRENCH_SASH_KINDS.flatMap(leafConstraints), ...dividerConstraints()],
};
