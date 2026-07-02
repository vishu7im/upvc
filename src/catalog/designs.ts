// =====================================================================
// catalog/designs.ts — the design library.
//
// Every design is a cell-tree topology. Add more by copying an existing
// one and changing the kind/ratio/sash-key. The engine solves any well-
// formed tree generically.
//
// Designs are KEPT GENERIC by widthMm/heightMm scaling. So the same
// "casement-top-over-fixed" template handles 600×900 and 1500×2200.
//
// Split ratios are interpreted as a fraction of the WINDOW dimension
// (not the daylight). This makes them match the section labels users
// see on the drawing (e.g. "transom at 400mm from top of 1200mm" = 0.333).
// =====================================================================

import type { Design } from "../types.ts";

export const DESIGNS: Design[] = [
  // -----------------------------------------------------------------
  // PLAIN CASEMENT FIXED LIGHT
  // -----------------------------------------------------------------
  {
    designId: "win-fixed",
    name: "Fixed Light",
    productType: "window",
    frameKey: "frame-5ch",
    topology: { kind: "leaf", cell: { content: "fixed" } },
  },

  // -----------------------------------------------------------------
  // SINGLE SIDE-HUNG CASEMENT (LEFT)
  // -----------------------------------------------------------------
  {
    designId: "win-sh-left",
    name: "Side-Hung Casement (Left)",
    productType: "window",
    frameKey: "frame-5ch",
    topology: {
      kind: "leaf",
      cell: { content: "casement-side-left", sashKey: "sash-t" },
    },
  },

  // -----------------------------------------------------------------
  // SINGLE SIDE-HUNG CASEMENT (RIGHT)
  // -----------------------------------------------------------------
  {
    designId: "win-sh-right",
    name: "Side-Hung Casement (Right)",
    productType: "window",
    frameKey: "frame-5ch",
    topology: {
      kind: "leaf",
      cell: { content: "casement-side-right", sashKey: "sash-t" },
    },
  },

  // -----------------------------------------------------------------
  // SINGLE TOP-HUNG CASEMENT
  // -----------------------------------------------------------------
  {
    designId: "win-th",
    name: "Top-Hung Casement",
    productType: "window",
    frameKey: "frame-5ch",
    topology: {
      kind: "leaf",
      cell: { content: "casement-top", sashKey: "sash-t" },
    },
  },

  // -----------------------------------------------------------------
  // JOB 85: TOP-HUNG OVER FIXED (Z-TRANSOM)
  //   1200 × 1200, transom at 400 from top  →  ratio 0.333
  //   The Z-transom BREAKS the jamb into two pieces (Job 85 confirmed).
  // -----------------------------------------------------------------
  {
    designId: "win-th-over-fixed-z",
    name: "Top-Hung Sash over Fixed (Z-Transom)",
    productType: "window",
    frameKey: "frame-5ch",
    topology: {
      kind: "hsplit",
      splitAtRatio: 1 / 3,
      transomKey: "transom-z-67",
      top: { kind: "leaf", cell: { content: "casement-top", sashKey: "sash-t" } },
      bottom: { kind: "leaf", cell: { content: "fixed" } },
    },
  },

  // -----------------------------------------------------------------
  // JOB 88: TOP-HUNG OVER SIDE-HUNG (T-TRANSOM)
  //   800 × 1200, transom at 400 from top
  //   T-transom — jambs stay continuous.
  // -----------------------------------------------------------------
  {
    designId: "win-th-over-sh-t",
    name: "Top-Hung Sash over Side-Hung Sash (T-Transom)",
    productType: "window",
    frameKey: "frame-5ch",
    topology: {
      kind: "hsplit",
      splitAtRatio: 1 / 3,
      transomKey: "transom-t-67",
      top: { kind: "leaf", cell: { content: "casement-top", sashKey: "sash-t" } },
      bottom: { kind: "leaf", cell: { content: "casement-side-left", sashKey: "sash-t" } },
    },
  },

  // -----------------------------------------------------------------
  // FIXED OVER FIXED (a common simple design)
  // -----------------------------------------------------------------
  {
    designId: "win-fixed-over-fixed",
    name: "Fixed over Fixed (T-Transom)",
    productType: "window",
    frameKey: "frame-5ch",
    topology: {
      kind: "hsplit",
      splitAtRatio: 1 / 3,
      transomKey: "transom-t-67",
      top: { kind: "leaf", cell: { content: "fixed" } },
      bottom: { kind: "leaf", cell: { content: "fixed" } },
    },
  },

  // -----------------------------------------------------------------
  // JOB 90: DOOR WITH SIDELIGHT AND TWO TOPLIGHTS
  //   1400 × 2000, mullion at 50% (= 700), transom at y=400 in EACH half.
  //   Door is right-hung in the bottom-right cell.
  //   Frame is the heavier 6-Chamber 68mm (Job 90 confirmed).
  //   Mullion is 78mm full-height (T-joint to top/bottom frames).
  // -----------------------------------------------------------------
  {
    designId: "door-sidelight-toplights",
    name: "Single Door with Sidelight and Toplights",
    productType: "door",
    frameKey: "frame-6ch",
    topology: {
      kind: "vsplit",
      splitAtRatio: 0.5,
      mullionKey: "mullion-78",
      left: {
        kind: "hsplit",
        splitAtRatio: 0.2,
        transomKey: "mullion-78",   // the 78mm "T Transom/Mullion" doubles as transom here
        top: { kind: "leaf", cell: { content: "fixed" } },
        bottom: { kind: "leaf", cell: { content: "fixed" } },   // the sidelight
      },
      right: {
        kind: "hsplit",
        splitAtRatio: 0.2,
        transomKey: "mullion-78",
        top: { kind: "leaf", cell: { content: "fixed" } },
        bottom: { kind: "leaf", cell: { content: "door-right", sashKey: "sash-door-z" } },
      },
    },
  },

  // -----------------------------------------------------------------
  // SINGLE DOOR (no surround)
  // -----------------------------------------------------------------
  {
    designId: "door-single-right",
    name: "Single Door (Right Hung)",
    productType: "door",
    frameKey: "frame-6ch",
    topology: {
      kind: "leaf",
      cell: { content: "door-right", sashKey: "sash-door-z" },
    },
  },
  {
    designId: "door-single-left",
    name: "Single Door (Left Hung)",
    productType: "door",
    frameKey: "frame-6ch",
    topology: {
      kind: "leaf",
      cell: { content: "door-left", sashKey: "sash-door-z" },
    },
  },

  // -----------------------------------------------------------------
  // FRENCH DOORS — calibrated Job 00000264 (docs/french-door/, 1700×2100).
  //   Two door leaves meeting on a STULP French mullion (SPQ-1-46252,
  //   square-cut, face 48). Master leaf = handle side (left, per the docs'
  //   "L.RDoSlv"); slave leaf carries the stulp + shootbolt. Leaves hinge on
  //   their outer jambs. Frame = frame-french (SPQ-6-11252 @ face 48),
  //   bead-32 (SPQ-1-52253), sash face 105 / overlap 20 / rebate 15.
  // -----------------------------------------------------------------
  {
    designId: "door-french",
    name: "French Door (Z Sash)",
    productType: "door",
    frameKey: "frame-french",
    defaultWidthMm: 1700,
    defaultHeightMm: 2100,
    topology: {
      kind: "vsplit",
      splitAtRatio: 0.5,
      mullionKey: "french-mullion",
      left: { kind: "leaf", cell: { content: "french-door-master", sashKey: "sash-door-z-fr", beadKey: "bead-32" } },
      right: { kind: "leaf", cell: { content: "french-door-slave", sashKey: "sash-door-z-fr", beadKey: "bead-32" } },
    },
  },
  {
    designId: "door-french-t",
    name: "French Door (T Sash)",
    productType: "door",
    frameKey: "frame-french",
    defaultWidthMm: 1700,
    defaultHeightMm: 2100,
    topology: {
      kind: "vsplit",
      splitAtRatio: 0.5,
      mullionKey: "french-mullion",
      left: { kind: "leaf", cell: { content: "french-door-master", sashKey: "sash-door-t-fr", beadKey: "bead-32" } },
      right: { kind: "leaf", cell: { content: "french-door-slave", sashKey: "sash-door-t-fr", beadKey: "bead-32" } },
    },
  },
  // Job 00000264 docs 1/4: each leaf has a horizontal midrail (T/M small 67mm)
  // at mid-height splitting the glazing into two panes — the midrail is INSIDE
  // the welded sash ring (CellSpec.midrails), not a cell split.
  {
    designId: "door-french-midrail",
    name: "French Door (Z Sash, Midrail)",
    productType: "door",
    frameKey: "frame-french",
    defaultWidthMm: 1700,
    defaultHeightMm: 2100,
    topology: {
      kind: "vsplit",
      splitAtRatio: 0.5,
      mullionKey: "french-mullion",
      left: {
        kind: "leaf",
        cell: {
          content: "french-door-master",
          sashKey: "sash-door-z-fr",
          beadKey: "bead-32",
          midrails: [{ transomKey: "midrail-67", atRatio: 0.5 }],
        },
      },
      right: {
        kind: "leaf",
        cell: {
          content: "french-door-slave",
          sashKey: "sash-door-z-fr",
          beadKey: "bead-32",
          midrails: [{ transomKey: "midrail-67", atRatio: 0.5 }],
        },
      },
    },
  },
];

/** Lookup helper. */
export function getDesign(designId: string): Design | undefined {
  return DESIGNS.find((d) => d.designId === designId);
}
