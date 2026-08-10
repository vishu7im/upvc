// =====================================================================
// engine/topology.ts
//
// Walks the design's cell tree and produces a fully solved geometry:
//   - one Rect for every cell's outer & daylight bounds
//   - one Rect for every transom and mullion (centered on its split line)
//   - sash outer / inner / glass rectangles for cells that have a sash
//
// Coordinate system: top-left origin, mm units. Window outer is at (0,0).
//
// The CRITICAL math (calibrated against Job 85, 88, 90):
//   • Transom/mullion is CENTERED on the split line (face/2 on each side)
//   • Cell daylight = parent inner bounds minus surrounding profile faces
//   • Sash outer = cell daylight + 2 × sash overlap (28mm per side)
//   • Sash inner = sash outer − 2 × sash face
//   • Glass     = bead Int + 2 × glassRebate (rebate from the profile)
// =====================================================================

import type {
  AddonSelection,
  CellNode,
  Design,
  FrameEdge,
  FrameSection,
  JointMethod,
  ProfileSystem,
  Rect,
  SashKind,
  SolvedCell,
  SolvedGeometry,
  SolvedMullion,
  SolvedTransom,
} from "../types.ts";

export type { SolvedGeometry };

/**
 * Where the outer frame sits inside the unit, and how big it is.
 *
 * Without add-ons the frame fills the unit and this is `{0, 0, W, H}` — the
 * pre-add-on behaviour, byte for byte. An add-on (frame extension) fitted to an
 * edge pushes the frame in from that edge by the add-on's face width, so the
 * unit still measures W × H while everything the frame contains is built to the
 * smaller rectangle (Job 169; see `SolvedGeometry.frameRect`).
 */
export function frameRectFor(
  widthMm: number,
  heightMm: number,
  system: ProfileSystem,
  addons?: AddonSelection,
): Rect {
  const face = (key?: string): number => {
    if (!key) return 0;
    const aux = system.auxiliaries?.[key];
    if (!aux) throw new Error(`Unknown add-on profile: ${key}`);
    if (aux.faceWidthMm === undefined) {
      throw new Error(`Add-on profile ${key} (${aux.code}) has no faceWidthMm — it cannot be fitted to a frame edge`);
    }
    return aux.faceWidthMm;
  };

  const top = face(addons?.top);
  const bottom = face(addons?.bottom);
  const left = face(addons?.left);
  const right = face(addons?.right);

  return {
    x: left,
    y: top,
    w: widthMm - left - right,
    h: heightMm - top - bottom,
  };
}

/**
 * The frame profile on each outer edge.
 *
 * The reference configurator offers a frame profile per edge (Job 169 prints
 * all four in Main Options), and on this system they differ — `frame-5ch` is
 * face 64, `frame-6ch` face 68. An absent side falls back to `design.frameKey`,
 * so every design that exists today resolves to the same profile on all four
 * edges and the geometry below is unchanged.
 */
export function framesForEdges(
  design: Design,
  system: ProfileSystem,
): Record<FrameEdge, FrameSection> {
  const pick = (side: FrameEdge): FrameSection => {
    const key = design.frameKeys?.[side] ?? design.frameKey;
    const frame = system.frames[key];
    if (!frame) throw new Error(`Unknown frame: ${key}`);
    return frame;
  };
  return { top: pick("top"), bottom: pick("bottom"), left: pick("left"), right: pick("right") };
}

export function solveTopology(
  design: Design,
  widthMm: number,
  heightMm: number,
  system: ProfileSystem,
  addons?: AddonSelection,
): SolvedGeometry {
  const frames = framesForEdges(design, system);

  const outer: Rect = { x: 0, y: 0, w: widthMm, h: heightMm };
  // The frame need not fill the unit — an add-on on an edge pushes it in.
  // Absent add-ons ⇒ frameRect === outer ⇒ every line below is unchanged.
  const frameRect = frameRectFor(widthMm, heightMm, system, addons);
  // Each edge insets by its OWN frame face. Identical to the symmetric
  // `2 × faceWidth` form when all four edges share a profile, which is every
  // design that exists today.
  const rootDaylight: Rect = {
    x: frameRect.x + frames.left.faceWidth,
    y: frameRect.y + frames.top.faceWidth,
    w: frameRect.w - frames.left.faceWidth - frames.right.faceWidth,
    h: frameRect.h - frames.top.faceWidth - frames.bottom.faceWidth,
  };

  const result: SolvedGeometry = {
    outer,
    rootDaylight,
    cells: [],
    transoms: [],
    mullions: [],
  };
  if (frameRect.w !== outer.w || frameRect.h !== outer.h) result.frameRect = frameRect;

  // A root-level transom divides the FRAME, so it welds into the jambs and
  // breaks them into two pieces each. This holds for EVERY joint type: Job 85
  // (Z, Quotila) and Job 173 p4 (T, printed 405 + 1575 with `[Y - /` / `\ - Y]`
  // end preps) both show the break. Owner decision 2026-07-30 — it supersedes
  // Quotila Job 88, which printed continuous jambs under a T transom
  // (Spec/questions.md Q25).
  //
  // A root-level MULLION (vsplit) presumably breaks the head and sill the same
  // way, but no production document shows one — left alone, and flagged in Q25.
  if (design.topology.kind === "hsplit") {
    // Split ratios are FRAME-relative (Job 169 p1 prints 375 + 1600 = 1975,
    // the frame height, not the 2000 unit height).
    result.jambsBrokenAtY = frameRect.y + design.topology.splitAtRatio * frameRect.h;
  }

  walk(design.topology, "root", rootDaylight, system, result, frameRect);

  return result;
}

// ---------------------------------------------------------------------
// Recursive walker.
// `bounds` is the DAYLIGHT rect available to this subtree — the space
// inside any surrounding profile faces. For the root, that's inside the
// frame; for a child of a vsplit, it's between the frame and the mullion;
// for a child of an hsplit, it's between the frame/transom on top/bottom.
// ---------------------------------------------------------------------
function walk(
  node: CellNode,
  pathId: string,
  bounds: Rect,
  system: ProfileSystem,
  out: SolvedGeometry,
  /**
   * The rectangle the frame occupies (`{0,0,W,H}` unless an add-on pushes it
   * in). Split ratios are fractions OF THIS RECT, which is what Job 169 p1
   * prints: 375 + 1600 = 1975, the frame height, not the 2000 unit height.
   * Identical to the unit when no add-on is fitted, so every pre-add-on quote
   * is unchanged.
   */
  frame: Rect,
): void {
  if (node.kind === "leaf") {
    const cell = buildLeafCell(node, pathId, bounds, system);
    out.cells.push(cell);
    // Midrails INSIDE the sash (French doors, Job 00000264; casement Job 154):
    // the sash stays one welded ring; each midrail is a horn-cut bar between
    // the sash members splitting the glazing into panes (own beads/glass each).
    if (node.cell.midrails?.length && cell.sashInner && cell.sashKey) {
      applyMidrails(cell, node.cell.midrails, system, out, frame);
    }
    return;
  }

  if (node.kind === "sliding") {
    buildSlidingPanels(node, pathId, bounds, system, out, frame);
    return;
  }

  if (node.kind === "hsplit") {
    const transom = system.transoms[node.transomKey];
    if (!transom) throw new Error(`Unknown transom: ${node.transomKey}`);
    const tFace = transom.faceWidth;

    // Split line in window coordinates.
    const splitY = frame.y + node.splitAtRatio * frame.h;

    // Transom strip spans the full horizontal extent of the parent bounds,
    // centered vertically on the split line.
    const transomRect: Rect = {
      x: bounds.x,
      y: splitY - tFace / 2,
      w: bounds.w,
      h: tFace,
    };
    // Cut sizes for this transom piece:
    //   Int = visible (between the two side-walls this transom is welded to)
    //   Ext = Int + 2 × face  (the horns that go into each side-wall)
    //
    // A ROOT transom is the exception: it divides the frame rather than welding
    // between two cells, and Job 173 p4 prints a 78 mm SPQ-5-30252 in a 975 mm
    // frame at 984 — the frame's full outer span plus 4.5 mm of weld per end
    // (`bars.ts#FRAME_BREAK_WELD_MM`), NOT 839 + 2×78 = 995. The Z case keeps
    // the Quotila rule: no Z transom appears in the reference package, so it
    // cannot supersede Job 85 (1206 = 1072 + 2×67). See Spec/questions.md Q25.
    const breaksFrame = pathId === "root";
    const intLen = bounds.w;
    const extLen = breaksFrame && transom.jointType === "T" ? frame.w : intLen + 2 * tFace;
    out.transoms.push({
      rect: transomRect,
      parentPathId: pathId,
      transomKey: node.transomKey,
      extLengthMm: extLen,
      intLengthMm: intLen,
      jointType: transom.jointType,
      ...(breaksFrame ? { breaksFrame: true } : {}),
      // A "mechanical" joint is CUT AS WELDED — no production document gives its
      // deduction (Spec/questions.md Q22). Recording it here is what lets the
      // resolver warn and the work order print the choice, without the engine
      // inventing a length. Absent ⇒ welded ⇒ byte-identical.
      ...(node.jointMethod && node.jointMethod !== "welded" ? { jointMethod: node.jointMethod } : {}),
    });

    // Children: top and bottom of the transom.
    const topBounds: Rect = {
      x: bounds.x,
      y: bounds.y,
      w: bounds.w,
      h: splitY - tFace / 2 - bounds.y,
    };
    const bottomBounds: Rect = {
      x: bounds.x,
      y: splitY + tFace / 2,
      w: bounds.w,
      h: bounds.y + bounds.h - (splitY + tFace / 2),
    };
    walk(node.top, pathId + ".top", topBounds, system, out, frame);
    walk(node.bottom, pathId + ".bottom", bottomBounds, system, out, frame);
    return;
  }

  if (node.kind === "vsplit") {
    // "meeting-stile" is a zero-profile divider (French doors): the two sashes
    // meet on a central meeting stile with NO mullion between them. No mullion
    // bar is cut and the divider has no face width — the cells abut directly.
    const isMeetingStile = node.mullionKey === "meeting-stile";
    const mullion = isMeetingStile ? undefined : system.transoms[node.mullionKey];
    if (!isMeetingStile && !mullion) throw new Error(`Unknown mullion: ${node.mullionKey}`);
    const mFace = mullion ? mullion.faceWidth : 0;

    const splitX = frame.x + node.splitAtRatio * frame.w;

    if (mullion) {
      const mullionRect: Rect = {
        x: splitX - mFace / 2,
        y: bounds.y,
        w: mFace,
        h: bounds.h,
      };
      const intLen = bounds.h;
      // S-type (STULP / French mullion, Job 00000264): square-cut bar, NO
      // welded horns — Ext == Int == the daylight span (printed 2004 [ ]).
      const extLen = mullion.jointType === "S" ? intLen : intLen + 2 * mFace;
      out.mullions.push({
        rect: mullionRect,
        parentPathId: pathId,
        mullionKey: node.mullionKey,
        extLengthMm: extLen,
        intLengthMm: intLen,
        jointType: mullion.jointType,
        // See the transom branch: cut as welded, recorded for the warning.
        ...(node.jointMethod && node.jointMethod !== "welded" ? { jointMethod: node.jointMethod } : {}),
      });
    } else {
      out.meetingStiles = (out.meetingStiles ?? 0) + 1;
    }

    const leftBounds: Rect = {
      x: bounds.x,
      y: bounds.y,
      w: splitX - mFace / 2 - bounds.x,
      h: bounds.h,
    };
    const rightBounds: Rect = {
      x: splitX + mFace / 2,
      y: bounds.y,
      w: bounds.x + bounds.w - (splitX + mFace / 2),
      h: bounds.h,
    };
    walk(node.left,  pathId + ".left",  leftBounds,  system, out, frame);
    walk(node.right, pathId + ".right", rightBounds, system, out, frame);
    return;
  }
}

// ---------------------------------------------------------------------
// Build a fully solved leaf cell — daylight, sash rects, glass rect.
// ---------------------------------------------------------------------
function buildLeafCell(
  node: { kind: "leaf"; cell: { content: any; sashKey?: string; beadKey?: string; glassKey?: string } },
  pathId: string,
  bounds: Rect,
  system: ProfileSystem,
): SolvedCell {
  // Defaults
  const beadKey = node.cell.beadKey ?? Object.keys(system.beads)[0];
  const isDoor =
    node.cell.content?.startsWith("door-") || node.cell.content?.startsWith("french-door");
  const glassKey =
    node.cell.glassKey ??
    (isDoor ? "glass-4-20-4-tuff-lowe" : "glass-4-20-4-lowe");

  // The `bounds` we receive IS the cell's daylight (between frame/transom/mullion faces).
  const daylight = { ...bounds };

  let sashOuter: Rect | undefined;
  let sashInner: Rect | undefined;
  let glassRect: Rect;
  let beadIntW: number;
  let beadIntH: number;

  if (node.cell.content === "fixed") {
    // Fixed: glass sits in the frame rebate directly.
    // Bead Int = daylight; Glass = bead Int + 2 × frameGlassRebate.
    // We use the root frame's glass rebate (15mm in your data).
    const frameRebate = firstFrameRebate(system);
    beadIntW = daylight.w;
    beadIntH = daylight.h;
    glassRect = {
      x: daylight.x - frameRebate,
      y: daylight.y - frameRebate,
      w: daylight.w + 2 * frameRebate,
      h: daylight.h + 2 * frameRebate,
    };
  } else {
    // Sash-glazed cell.
    const sash = system.sashes[node.cell.sashKey!];
    if (!sash) throw new Error(`Unknown sash: ${node.cell.sashKey}`);

    // Sash outer = daylight + 2 × overlap (sash extends INTO the frame rebate)
    sashOuter = {
      x: daylight.x - sash.overlap,
      y: daylight.y - sash.overlap,
      w: daylight.w + 2 * sash.overlap,
      h: daylight.h + 2 * sash.overlap,
    };
    // Sash inner = sash outer - 2 × sash face (this is where the glass opening sits)
    sashInner = {
      x: sashOuter.x + sash.faceWidth,
      y: sashOuter.y + sash.faceWidth,
      w: sashOuter.w - 2 * sash.faceWidth,
      h: sashOuter.h - 2 * sash.faceWidth,
    };
    beadIntW = sashInner.w;
    beadIntH = sashInner.h;
    glassRect = {
      x: sashInner.x - sash.glassRebate,
      y: sashInner.y - sash.glassRebate,
      w: sashInner.w + 2 * sash.glassRebate,
      h: sashInner.h + 2 * sash.glassRebate,
    };
  }

  return {
    pathId,
    outer: bounds,
    daylight,
    content: node.cell.content,
    sashKey: node.cell.sashKey,
    beadKey,
    glassKey,
    sashOuter,
    sashInner,
    glassRect,
    beadIntW,
    beadIntH,
  };
}

// ---------------------------------------------------------------------
// MIDRAILS-IN-SASH
//   HORIZONTAL — calibrated Job 00000264 (French doors, docs 1/4).
//   VERTICAL   — calibrated Job 154 (Work Order - windows - 27-07-2026.pdf p4).
//
// A leaf with midrails keeps its ONE welded sash ring — so ONE opener, ONE
// handle and ONE set of gear, whatever bars run inside it. Each midrail is a
// horn-cut bar welded between the opposite sash members:
//   Int = the sash Int span it crosses      Ext = Int + 2 × face
//
// The rule is the SAME on both axes, and Job 154 proves it on two profiles at
// once. A 705×705 casement (frame face 64 ⇒ daylight 577; sash overlap 28 ⇒
// sash outer 633; sash-t face 79 ⇒ sash Int 475) prints:
//   p1  67mm SPQ-005-30252, horizontal → 475 + 2×67 = 609  ✓
//   p3  78mm SPQ-5-30252,   horizontal → 475 + 2×78 = 631  ✓
//   p4  78mm SPQ-5-30252,   VERTICAL   → 475 + 2×78 = 631  ✓  (the transpose:
//       p3's panes are 510w × 236h, p4's are 236w × 510h)
// …with ONE T Sash ring (2×633 + 2×633) and one handle / espag / stay on every
// page — which is exactly why a divider dropped into a sash must NOT split the
// frame into two sashes.
//
// A vertical midrail is pushed onto `out.mullions`, so `bars.ts#emitMullionBars`
// prints it as a VERT bar (the printed orientation on p4); horizontal ones stay
// on `out.transoms` (HOR). Both get the `< - >` horn end prep the doc shows.
//
// The PRIMARY SolvedCell (the one carrying sashOuter — hardware/gasket/labour
// still key off it) is narrowed to pane 1; panes 2..n are emitted as extra
// cells with the same content but NO sash rects, so bars/glass/SVG treat them
// as pure glazing and no hardware/gasket double-counts.
//
// `axis` is optional and defaults to "horizontal", so every design authored
// before Job 154 (i.e. every French door) is byte-identical.
// ---------------------------------------------------------------------
function applyMidrails(
  primary: SolvedCell,
  midrails: { transomKey: string; atRatio: number; axis?: "horizontal" | "vertical" }[],
  system: ProfileSystem,
  out: SolvedGeometry,
  /** The frame rect — midrail ratios are fractions of it (see `walk`). */
  frame: Rect,
): void {
  const inner = primary.sashInner!;
  const sash = system.sashes[primary.sashKey!];
  const rebate = sash.glassRebate;

  // One axis per sash: mixing them inside a single ring would need a grid of
  // panes, which no reference job shows. The first midrail's axis wins and a
  // contradicting one is a hard error rather than a silently ignored field.
  const axis = midrails[0].axis ?? "horizontal";
  if (midrails.some((m) => (m.axis ?? "horizontal") !== axis)) {
    throw new Error(
      `Mixed horizontal and vertical midrails in ${primary.pathId} — no calibrated job builds a pane grid`,
    );
  }
  const vertical = axis === "vertical";

  const sorted = [...midrails].sort((a, b) => a.atRatio - b.atRatio);

  // Pane boundaries along the split axis (top→bottom, or left→right); each
  // midrail is centred on atRatio × the FULL window dimension of that axis.
  const span = vertical ? frame.w : frame.h;
  const origin = vertical ? frame.x : frame.y;
  const start = vertical ? inner.x : inner.y;
  const end = vertical ? inner.x + inner.w : inner.y + inner.h;
  /** The bar's Int length = the sash Int span it crosses. */
  const crossing = vertical ? inner.h : inner.w;

  const panes: Rect[] = [];
  let cursor = start;
  for (const m of sorted) {
    const profile = system.transoms[m.transomKey];
    if (!profile) throw new Error(`Unknown midrail profile: ${m.transomKey}`);
    const face = profile.faceWidth;
    const centre = origin + m.atRatio * span;
    const near = centre - face / 2;
    panes.push(
      vertical
        ? { x: cursor, y: inner.y, w: near - cursor, h: inner.h }
        : { x: inner.x, y: cursor, w: inner.w, h: near - cursor },
    );
    const bar = {
      parentPathId: primary.pathId,
      extLengthMm: crossing + 2 * face,
      intLengthMm: crossing,
      jointType: profile.jointType,
    };
    if (vertical) {
      out.mullions.push({
        ...bar,
        rect: { x: near, y: inner.y, w: face, h: inner.h },
        mullionKey: m.transomKey,
      });
    } else {
      out.transoms.push({
        ...bar,
        rect: { x: inner.x, y: near, w: inner.w, h: face },
        transomKey: m.transomKey,
      });
    }
    cursor = centre + face / 2;
  }
  panes.push(
    vertical
      ? { x: cursor, y: inner.y, w: end - cursor, h: inner.h }
      : { x: inner.x, y: cursor, w: inner.w, h: end - cursor },
  );

  for (const p of panes) {
    if (p.w <= 0 || p.h <= 0) throw new Error(`Midrail collapses a pane in ${primary.pathId}`);
  }

  // Primary cell carries pane 1's glazing; panes 2..n become glazing-only cells.
  primary.beadIntW = panes[0].w;
  primary.beadIntH = panes[0].h;
  primary.glassRect = grow(panes[0], rebate);

  for (let i = 1; i < panes.length; i++) {
    out.cells.push({
      pathId: `${primary.pathId}.pane${i + 1}`,
      outer: panes[i],
      daylight: panes[i],
      content: primary.content,
      beadKey: primary.beadKey,
      glassKey: primary.glassKey,
      glassRect: grow(panes[i], rebate),
      beadIntW: panes[i].w,
      beadIntH: panes[i].h,
    });
  }
}

function grow(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by };
}

// ---------------------------------------------------------------------
// SLIDING PATIO — a single row of `n` equal-width framed panels.
//
// Calibrated against patio.pdf (owner package, 07 Aug 2026, "100 SOFT UK",
// items F1–F4: 2000×2000 OX, 3000×2000 XOO, 4000×2000 4-panel, 3500×2000 OXO),
// which SUPERSEDES patio_calibration.pdf (31 Jul, the same four jobs) and the
// panel rows of Jobs 44 + 48 (patio-docs/, "Andrei UK", 1900×2100 / 2210×2310).
// A line-by-line diff of the two packages shows exactly ONE substantive change:
// every panel is 3 mm bigger in BOTH axes (sash 1005/1920 → 1008/1923 saw, bead
// +3, sash steel +3, glass +3, the panel-tracking SPQ-GL-20253 cap +3), while
// the frame, the frame steel and EVERY auxiliary row are identical.
//   • Frame face 48 (handled by the frame profile in emitFrameBars);
//     frame Ext = W/H exactly on every doc (finished; printed adds 3mm/end weld).
//   • Panel outer width (Ext, finished): (W + K)/n − clearance.widthMm, where K
//     is calibrated PER CONFIGURATION — see PANEL_WIDTH_K below. It is NOT one
//     bypass value: the 2-, 3- and 4-panel documents each print a different one.
//   • Panel outer height (Ext, finished): frameH − clearance.heightMm.
//   • The two clearances are CATALOG data (SashSection.panelClearance, 3/83 —
//     the same physical profiles printed 6/86 four weeks earlier, so they are a
//     fabricator setting, not profile geometry). See PANEL_ENVELOPE_DEFAULT.
//   • Sash face 85 ⇒ sash Int = Ext − 170; glass rebate 15 ⇒ glass = beadInt + 30
//     (both rules unchanged from Job 104 and exact on every later doc).
// Every panel (fixed or sliding) is cut identically — only hardware (hardware.ts)
// and the SVG slide arrow (svg.ts) differ, via the cell `content`.
//
// Panels are laid out left→right across the daylight for the PREVIEW only; cut
// lengths use the explicit panel envelope (panelExtW/H), never the x position.
// ---------------------------------------------------------------------

/**
 * The panel-width constant K in `panelExt = (W + K)/n − clearance`, TRANSCRIBED
 * per configuration. Each value is read straight off a production document by
 * inverting the printed bead (`bead Int + 170 = panel Ext`) — no interpolation.
 *
 * | Config      | Document                  | W    | n | Panel Ext | K  |
 * |-------------|---------------------------|------|---|-----------|----|
 * | OX (bypass) | patio.pdf F1, 2000×2000   | 2000 | 2 | 1002      | 10 |
 * | XOO         | patio.pdf F2, 3000×2000   | 3000 | 3 |  998      |  3 |
 * | OXO         | patio.pdf F4, 3500×2000   | 3500 | 3 | 1164.7    |  3 |
 * | OXXO        | patio.pdf F3, 4000×2000   | 4000 | 4 | 1020      | 92 |
 * | OX (bypass) | Job 44, 1900×2100         | 1900 | 2 |  952      | 10 |
 * | OX (bypass) | Job 48, 2210×2310         | 2210 | 2 | 1107      | 10 |
 *
 * The Panel Ext column is the FINISHED size under the current 3 mm clearance
 * (add 6 for the printed saw size); the same K reproduced the 31 Jul package
 * and the Andrei jobs under the superseded 6 mm clearance, which is why the
 * 07 Aug re-issue moved the clearance and not these numbers.
 *
 * Two independent 3-panel items — different widths, different slider position —
 * agree on K = 3, so that row is solid. K = 92 rests on F3 alone, but it
 * REPLACES 79, which rested on the superseded Job 104 alone and was recorded as
 * uncalibrated. n = 2 reproduces all three of its docs.
 *
 * There is no derived formula behind these numbers and none is invented: an
 * unlisted panel count falls back to the bypass value and is flagged below.
 */
const PANEL_WIDTH_K = {
  /** 2 panels, one bypassing the other. Jobs 44/48 + patio.pdf F1. */
  bypass2: 10,
  /** 3 panels, one slider (XOO / OXO / OOX). patio.pdf F2 + F4. */
  bypass3: 3,
  /** 4 panels, the two centre leaves meeting (OXXO). patio.pdf F3. */
  meeting4: 92,
} as const;

/**
 * The panel envelope deductions used when the sliding sash profile carries none
 * (a DB that predates the `panelClearanceMm` / `panelHeightDeductionMm` columns,
 * or a system whose sliding sash was added without them).
 *
 * 3 / 83 is patio.pdf (07 Aug 2026), which reproduces every printed sash, bead,
 * glass, sash-steel and sash-cap row on all four of its items:
 *   F1 2000×2000 → 1002 × 1917 (saw 1008 / 1923, glass 862 × 1777, bead 872/1787)
 *   F2 3000×2000 →  998 × 1917 · F3 4000×2000 → 1020 × 1917
 *   F4 3500×2000 → 1164.7 × 1917 (saw 1170.7, glass 1024.7 → printed 1025)
 * The superseded 31 Jul package and Jobs 44/48 print 6 / 86; setting those two
 * values on the catalog row reproduces them exactly (validateSlidingPanelEnvelope).
 */
const PANEL_ENVELOPE_DEFAULT = { widthMm: 3, heightMm: 83 } as const;

/**
 * Pick K for a panel row. `meeting` marks the centre-meeting (OXXO) layout.
 * Counts with no document reuse the nearest calibrated bypass value — the
 * pre-existing behaviour — and are the subject of Spec/questions.md Q27.
 */
function panelWidthK(n: number, meeting: boolean | undefined): number {
  if (meeting) return PANEL_WIDTH_K.meeting4; // only n=4 exists in the seed
  if (n === 3) return PANEL_WIDTH_K.bypass3;
  return PANEL_WIDTH_K.bypass2;
}

function buildSlidingPanels(
  node: Extract<CellNode, { kind: "sliding" }>,
  pathId: string,
  bounds: Rect,
  system: ProfileSystem,
  out: SolvedGeometry,
  /**
   * The frame rect. Sliding designs have no add-on rule, so this is always the
   * unit rect for them — the calibrated Jobs 44/48 formulas below are unchanged.
   */
  frame: Rect,
): void {
  const sash = system.sashes[node.sashKey];
  if (!sash) throw new Error(`Unknown sliding sash: ${node.sashKey}`);
  const n = node.panels.length;
  if (n < 1) throw new Error("Sliding design needs at least one panel");

  // Per-panel share fractions fᵢ (Σ = 1). Default equal (1/n) ⇒ the calibrated
  // formula. Drag-to-resize supplies n−1 cumulative `boundaries` (set by
  // applySplitRatios), from which fᵢ = bᵢ − bᵢ₋₁ (b₀=0, bₙ=1).
  const fractions = panelFractions(node.boundaries, n);

  // Total panel material span is calibrated: Σ panelExt = (W + K) − c·n, with K
  // transcribed per configuration (see PANEL_WIDTH_K) and c the catalog
  // clearance. Distribute it per fraction so panelExtᵢ = fᵢ·(W+K) − c, which
  // reduces to (W+K)/n − c when equal (exact on every calibrated document). For
  // unequal panels this is an interpolation (no unequal reference job) —
  // flagged; equal panels stay byte-identical.
  const K = panelWidthK(n, node.meeting);
  // The two envelope deductions are catalog data on the sliding sash profile —
  // a fabricator setting the owner can change without a code change (patio.pdf
  // 07 Aug prints 3/83 where the 31 Jul package printed 6/86 on the same
  // profiles). Absent ⇒ the cited default, so a pre-migration DB still cuts the
  // current sizes.
  const env = sash.panelClearance ?? PANEL_ENVELOPE_DEFAULT;
  const panelExtH = frame.h - env.heightMm; // patio.pdf F1–F4: 1917 = 2000 − 83
  const fw = sash.faceWidth;        // 85
  const rebate = sash.glassRebate;  // 15

  const beadKey = node.beadKey ?? Object.keys(system.beads)[0];
  const glassKey = node.glassKey ?? "glass-4-20-4-lowe";

  let colX = bounds.x; // running left edge; columns tile the daylight by fraction
  for (let i = 0; i < n; i++) {
    const p = node.panels[i];
    const content: SashKind =
      p.role === "slide"
        ? p.slideDir === "right"
          ? "sliding-slide-right"
          : "sliding-slide-left"
        : "sliding-fixed";

    const colW = fractions[i] * bounds.w;
    const panelExtW = fractions[i] * (frame.w + K) - env.widthMm;
    const sashOuter: Rect = {
      x: colX + (colW - panelExtW) / 2,
      y: bounds.y + (bounds.h - panelExtH) / 2,
      w: panelExtW,
      h: panelExtH,
    };
    const sashInner: Rect = {
      x: sashOuter.x + fw,
      y: sashOuter.y + fw,
      w: sashOuter.w - 2 * fw,
      h: sashOuter.h - 2 * fw,
    };
    const glassRect: Rect = {
      x: sashInner.x - rebate,
      y: sashInner.y - rebate,
      w: sashInner.w + 2 * rebate,
      h: sashInner.h + 2 * rebate,
    };
    const daylight: Rect = { x: colX, y: bounds.y, w: colW, h: bounds.h };

    out.cells.push({
      pathId: `${pathId}.p${i + 1}`,
      outer: daylight,
      daylight,
      content,
      sashKey: node.sashKey,
      beadKey,
      glassKey,
      sashOuter,
      sashInner,
      glassRect,
      beadIntW: sashInner.w,
      beadIntH: sashInner.h,
    });

    colX += colW; // advance to the next panel column
  }
}

/**
 * Per-panel share fractions for a sliding row. Equal `1/n` by default; when
 * `boundaries` (n−1 cumulative fractions) are present, fᵢ = bᵢ − bᵢ₋₁ (b₀=0,
 * bₙ=1). `boundaries` are pre-normalised (strictly increasing, min share) by
 * `applySplitRatios`, so the fractions are always positive and sum to 1.
 */
function panelFractions(boundaries: number[] | undefined, n: number): number[] {
  if (!boundaries || boundaries.length !== n - 1) {
    return Array.from({ length: n }, () => 1 / n);
  }
  const out: number[] = [];
  let prev = 0;
  for (const b of boundaries) {
    out.push(b - prev);
    prev = b;
  }
  out.push(1 - prev);
  return out;
}

function firstFrameRebate(system: ProfileSystem): number {
  // Use the first frame's rebate as a default for fixed glazing.
  // For Sunny Plast this is 15mm — both 5-Chamber and 6-Chamber.
  const first = Object.values(system.frames)[0];
  return first?.glassRebate ?? 15;
}
