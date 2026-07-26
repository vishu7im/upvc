// =====================================================================
// catalog/families/entrance-door.ts — the single-door family descriptor.
//
// SEED SOURCE, and the EXTENSIBILITY PROOF (Spec/01-windows-module/
// phase-7-extensibility-proof.md): registering a second product family is
// supposed to be pure data. This file plus `src/catalog/options/doors.ts` are
// that data — no designer-UI code, no resolver branch, no new adapter.
//
// The engine already fabricates single doors (sash kinds `door-left`/
// `door-right`, the door hardware set in `hardware.ts`, per-door labour in
// `pricing.ts`) and 19 door designs are quotable, so NOTHING here is a new
// fabrication rule. Every printed limit is generated from
// `src/engine/limits.ts#SIZE_LIMITS` — the verbatim HAWDIO p70 transcription —
// exactly as the casement descriptor does, so the repo still holds ONE copy of
// the printed size table.
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

/** Catalog product uuid for "Sunny Plast 70mm Single Door" (collections/products). */
const DOOR_PRODUCT_ID = "d1ab3175-2475-437c-a901-ae869299ab2b";

/**
 * What a door unit can contain: the two door leaves plus fixed lights, since
 * the quotable door designs include sidelights and fanlights around the leaf.
 * French leaves are deliberately ABSENT — French doors are their own product
 * (15 quotable designs) and get their own descriptor when someone asks for it;
 * the recipe is this file.
 */
export const DOOR_SASH_KINDS: SashKind[] = ["fixed", "door-left", "door-right"];

/**
 * Two bounds per dimension from the printed row, mirroring `checkSizeLimits()`:
 * a WARNING at the printed maximum and an ERROR past the 10% rule. Identical in
 * shape to the casement generator — same transcription, same severity model.
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

/** Longest transom/mullion = 1.8 m — a fanlight transom is still a transom. */
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

export const ENTRANCE_DOOR_FAMILY: ProductFamilyDescriptor = {
  familyKey: "entrance-door",
  name: "Entrance Door",
  status: "active",
  systemIds: ["sunnyplast-70"],

  designSource: {
    mode: "design-gallery",
    productIds: [DOOR_PRODUCT_ID],
  },

  // GUARD RAILS, NOT MANUAL FIGURES. The manual publishes a maximum DOOR LEAF
  // (residential door, 1002 × 2156 — enforced by the generated constraints
  // below) but no maximum outer-frame size for a door: the printed
  // "FIXED - (OUTER FRAME SIZE)" row is about fixed lights and its 2000 mm
  // height would flag every ordinary 2100 mm doorset. So these bounds are
  // ergonomic input limits, chosen the same way the casement minima were, and
  // are deliberately NOT cited to a page.
  dimensions: [
    {
      key: "widthMm",
      label: "Overall width",
      unit: "mm",
      required: true,
      min: 600,
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
    { type: "transom" }, // fanlight over the door
    { type: "mullion" }, // sidelight beside the door
    { type: "sash", kinds: DOOR_SASH_KINDS },
    { type: "glass" },
    { type: "panel" },
    { type: "cill" },
    { type: "addon", sides: ["top", "bottom", "left", "right"] },
  ],

  componentConversions: [
    { from: "glass", to: ["sash", "panel"] },
    { from: "sash", to: ["glass", "panel"] },
    { from: "panel", to: ["glass", "sash"] },
  ],

  topology: {
    guillotineSplits: true, // sidelights/fanlights are guillotine cuts
    midrails: true, // engine: CellSpec.midrails (calibrated on Job 00000264)
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

  constraints: [...DOOR_SASH_KINDS.flatMap(leafConstraints), ...dividerConstraints()],
};
