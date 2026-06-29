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
  CellNode,
  Design,
  ProfileSystem,
  Rect,
  SashKind,
  SolvedCell,
  SolvedGeometry,
  SolvedMullion,
  SolvedTransom,
} from "../types.ts";

export type { SolvedGeometry };

export function solveTopology(
  design: Design,
  widthMm: number,
  heightMm: number,
  system: ProfileSystem,
): SolvedGeometry {
  const frame = system.frames[design.frameKey];
  if (!frame) throw new Error(`Unknown frame: ${design.frameKey}`);

  const outer: Rect = { x: 0, y: 0, w: widthMm, h: heightMm };
  const rootDaylight: Rect = {
    x: frame.faceWidth,
    y: frame.faceWidth,
    w: widthMm - 2 * frame.faceWidth,
    h: heightMm - 2 * frame.faceWidth,
  };

  const result: SolvedGeometry = {
    outer,
    rootDaylight,
    cells: [],
    transoms: [],
    mullions: [],
  };

  // Detect root-level Z-transom — this is what causes the jambs to break (Job 85).
  if (design.topology.kind === "hsplit") {
    const transom = system.transoms[design.topology.transomKey];
    if (transom?.jointType === "Z") {
      result.jambsBrokenAtY = design.topology.splitAtRatio * heightMm;
    }
  }

  walk(design.topology, "root", rootDaylight, system, result, widthMm, heightMm);

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
  windowW: number,
  windowH: number,
): void {
  if (node.kind === "leaf") {
    out.cells.push(buildLeafCell(node, pathId, bounds, system));
    return;
  }

  if (node.kind === "sliding") {
    buildSlidingPanels(node, pathId, bounds, system, out, windowW, windowH);
    return;
  }

  if (node.kind === "hsplit") {
    const transom = system.transoms[node.transomKey];
    if (!transom) throw new Error(`Unknown transom: ${node.transomKey}`);
    const tFace = transom.faceWidth;

    // Split line in window coordinates.
    const splitY = node.splitAtRatio * windowH;

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
    const intLen = bounds.w;
    const extLen = intLen + 2 * tFace;
    out.transoms.push({
      rect: transomRect,
      parentPathId: pathId,
      transomKey: node.transomKey,
      extLengthMm: extLen,
      intLengthMm: intLen,
      jointType: transom.jointType,
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
    walk(node.top, pathId + ".top", topBounds, system, out, windowW, windowH);
    walk(node.bottom, pathId + ".bottom", bottomBounds, system, out, windowW, windowH);
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

    const splitX = node.splitAtRatio * windowW;

    if (mullion) {
      const mullionRect: Rect = {
        x: splitX - mFace / 2,
        y: bounds.y,
        w: mFace,
        h: bounds.h,
      };
      const intLen = bounds.h;
      const extLen = intLen + 2 * mFace;
      out.mullions.push({
        rect: mullionRect,
        parentPathId: pathId,
        mullionKey: node.mullionKey,
        extLengthMm: extLen,
        intLengthMm: intLen,
        jointType: mullion.jointType,
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
    walk(node.left,  pathId + ".left",  leftBounds,  system, out, windowW, windowH);
    walk(node.right, pathId + ".right", rightBounds, system, out, windowW, windowH);
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
  const isDoor = node.cell.content?.startsWith("door-");
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
// SLIDING PATIO — a single row of `n` equal-width framed panels.
//
// Calibrated against Job 104 (yogi test 1–4), height 1750:
//   • Frame face 48 (handled by the frame profile in emitFrameBars).
//   • Panel outer width (Ext):
//       bypass (OX/XO/OXO/OOX/XOO):  (W + 3)/n − 6     [exact for n=2 and n=3]
//       centre-meeting (OXXO):       (W + 79)/4 − 6     [n=4 — SINGLE data point;
//         reproduces the 2600-wide job exactly but its W-scaling is UNVERIFIED.
//         Needs a 2nd OXXO job at another width before trusting other sizes.]
//   • Panel outer height (Ext): H − 79  (sash engages frame head/sill 8.5mm/side).
//   • Sash face 85 ⇒ sash Int = Ext − 170; glass rebate 15 ⇒ glass = beadInt + 30.
// Every panel (fixed or sliding) is cut identically — only hardware (hardware.ts)
// and the SVG slide arrow (svg.ts) differ, via the cell `content`.
//
// Panels are laid out left→right across the daylight for the PREVIEW only; cut
// lengths use the explicit panel envelope (panelExtW/H), never the x position.
// ---------------------------------------------------------------------
function buildSlidingPanels(
  node: Extract<CellNode, { kind: "sliding" }>,
  pathId: string,
  bounds: Rect,
  system: ProfileSystem,
  out: SolvedGeometry,
  windowW: number,
  windowH: number,
): void {
  const sash = system.sashes[node.sashKey];
  if (!sash) throw new Error(`Unknown sliding sash: ${node.sashKey}`);
  const n = node.panels.length;
  if (n < 1) throw new Error("Sliding design needs at least one panel");

  const panelExtW = node.meeting ? (windowW + 79) / n - 6 : (windowW + 3) / n - 6;
  const panelExtH = windowH - 79;
  const fw = sash.faceWidth;        // 85
  const rebate = sash.glassRebate;  // 15

  const beadKey = node.beadKey ?? Object.keys(system.beads)[0];
  const glassKey = node.glassKey ?? "glass-4-20-4-lowe";

  const colW = bounds.w / n; // visual column per panel (preview layout only)
  for (let i = 0; i < n; i++) {
    const p = node.panels[i];
    const content: SashKind =
      p.role === "slide"
        ? p.slideDir === "right"
          ? "sliding-slide-right"
          : "sliding-slide-left"
        : "sliding-fixed";

    const colX = bounds.x + i * colW;
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
  }
}

function firstFrameRebate(system: ProfileSystem): number {
  // Use the first frame's rebate as a default for fixed glazing.
  // For Sunny Plast this is 15mm — both 5-Chamber and 6-Chamber.
  const first = Object.values(system.frames)[0];
  return first?.glassRebate ?? 15;
}
