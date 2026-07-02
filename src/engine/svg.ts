// =====================================================================
// engine/svg.ts — render the solved geometry as a clean SVG preview.
// Uses real mm coordinates with a viewBox sized to the window.
//
// Visual language matches the "normalized" collection artwork: grey
// profiles, transparent/white glass, near-black outlines, and a clean
// open-chevron opening symbol (apex toward the hinge) drawn as a
// contained symbol — NOT a sash-filling triangle.
// =====================================================================

import type { SolvedGeometry, SolvedCell, Rect } from "../types.ts";

const PROFILE_FILL = "#e6e6e6"; // grey profile material (frame/transom/mullion/sash)
const GLASS_FILL = "#ffffff"; // glazed openings (clear)
const STROKE = "#1f2937"; // near-black outline
const SYMBOL_STROKE = "rgba(30,30,30,0.55)"; // opening-direction chevron
const CILL_FILL = "#c9ccd1"; // darker grey so the cill reads distinct from the frame
const JOINT_STROKE = "rgba(31,41,55,0.85)"; // mitre / joint marker line
// Drawing-only constants (NOT fabrication values): a small horizontal overhang
// each side gives the cill its sill silhouette below the frame.
const CILL_OVERHANG = 30;

/**
 * Optional, purely-visual render options. ALL fields default to the historical
 * behaviour, so `renderSvg(geometry)` and `renderSvg(geometry, {})` produce a
 * byte-identical SVG to before this param existed (the validation gate).
 */
export interface RenderSvgOpts {
  /** Draw the inner-joint overlay: 45° mitre corners + T/Z divider markers. */
  joints?: boolean;
  /**
   * Tint the profile fill with the chosen finish. The elevation is viewed from
   * OUTSIDE, so `outside` (falling back to `inside`) drives the profile fill;
   * `inside` adds a thin inner liner hint when the two differ. Omitted ⇒ the
   * historical grey fill.
   */
  colour?: { insideHex?: string; outsideHex?: string };
}

export function renderSvg(geometry: SolvedGeometry, opts?: RenderSvgOpts): string {
  const w = geometry.outer.w;
  const h = geometry.outer.h;
  // Inset the viewBox slightly so the chevron symbols aren't clipped.
  const pad = 20;

  // Profile fill: outside colour drives the visible face (elevation is "viewed
  // from outside"); omitted ⇒ historical grey, so default quotes are unchanged.
  const profileFill = opts?.colour?.outsideHex ?? opts?.colour?.insideHex ?? PROFILE_FILL;
  const insideHex = opts?.colour?.insideHex;
  const dualColour = Boolean(insideHex && opts?.colour?.outsideHex && insideHex !== opts.colour.outsideHex);

  const shapes: string[] = [];

  // Outer frame — the whole window starts as profile-grey; the daylight
  // opening is then "cut" as clear glass on top.
  shapes.push(rect(geometry.outer, profileFill, STROKE, 2));
  // Dual-colour hint: a thin liner just inside the frame face carries the INSIDE
  // colour, so a white-in / anthracite-out finish reads at a glance. Single
  // colour (or none) ⇒ not drawn, so the SVG is unchanged.
  if (dualColour && insideHex) {
    shapes.push(linerRect(geometry.rootDaylight, insideHex));
  }
  shapes.push(rect(geometry.rootDaylight, GLASS_FILL, STROKE, 1));

  // Transoms & mullions (profile-grey strips drawn over the daylight).
  for (const t of geometry.transoms) {
    shapes.push(rect(t.rect, profileFill, STROKE, 1));
  }
  for (const m of geometry.mullions) {
    shapes.push(rect(m.rect, profileFill, STROKE, 1));
  }

  // Cells — sash outline (if any) + glazed area + opening-direction chevron.
  for (const c of geometry.cells) {
    drawCell(c, shapes, profileFill, geometry.outer);
  }

  // Inner-joint overlay (opt-in) — drawn above profiles, below the cill.
  if (opts?.joints) {
    shapes.push(jointLayer(geometry));
  }

  // Cill — a distinct bar attached below the outer frame, spanning the full
  // width plus a small overhang each side. Its drawn height = the cill's
  // nominal size, so 95/150/180 read visibly different. No cill ⇒ unchanged.
  let minX = -pad;
  let vbW = w + 2 * pad;
  let vbH = h + 2 * pad;
  if (geometry.cill) {
    const c = geometry.cill;
    const cillRect: Rect = {
      x: c.rect.x - CILL_OVERHANG,
      y: c.rect.y,
      w: c.rect.w + 2 * CILL_OVERHANG,
      h: c.rect.h,
    };
    shapes.push(rect(cillRect, CILL_FILL, STROKE, 2));
    // Grow the viewBox to show the overhang (sides) and the cill depth (bottom).
    minX = -(pad + CILL_OVERHANG);
    vbW = w + 2 * CILL_OVERHANG + 2 * pad;
    vbH = h + c.rect.h + 2 * pad;
  }

  return `<svg viewBox="${minX} -${pad} ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg">
  ${shapes.join("\n  ")}
</svg>`;
}

function drawCell(c: SolvedCell, shapes: string[], profileFill: string, outer: Rect): void {
  if (c.sashOuter && c.sashInner) {
    // Opening cell: grey sash profile ring with a clear glazed centre. The
    // glazed rect is the cell's bead-Int area — identical to sashInner for
    // ordinary cells, but only PANE 1 for a midrail leaf (French doors), so
    // the midrail bar drawn earlier stays visible.
    shapes.push(rect(c.sashOuter, profileFill, STROKE, 1));
    shapes.push(rect({ x: c.sashInner.x, y: c.sashInner.y, w: c.beadIntW, h: c.beadIntH }, GLASS_FILL, STROKE, 1));
  } else {
    // Fixed cell (or a midrail glazing pane): clear pane with a bead outline.
    shapes.push(rect(c.glassRect, GLASS_FILL, STROKE, 1));
  }

  // Opening-direction chevron — visual indicator only.
  const symbol = openingSymbol(c, outer);
  if (symbol) shapes.push(symbol);
}

/**
 * Inner-joint overlay (opt-in via RenderSvgOpts.joints). Pure: every coordinate
 * is derived from rects ALREADY present on the solved geometry — no new engine
 * math. Draws:
 *  • 45° mitre lines at the four corners of the outer frame and of every sash
 *    ring (frame & sash corners are double-mitred `\ - /` welds).
 *  • a marker at each transom/mullion-to-frame junction, styled by jointType:
 *    T = single tick across the divider; Z = offset double tick (jamb breaks).
 */
function jointLayer(geometry: SolvedGeometry): string {
  const parts: string[] = [];

  // Frame mitres (face = gap between outer rect and the daylight opening).
  const face = Math.max(
    1,
    Math.min(
      geometry.rootDaylight.x - geometry.outer.x,
      geometry.rootDaylight.y - geometry.outer.y,
    ),
  );
  parts.push(...mitreCorners(geometry.outer, face));

  // Sash mitres — the sash ring face (sashOuter → sashInner) per opening cell.
  for (const c of geometry.cells) {
    if (c.sashOuter && c.sashInner) {
      const sf = Math.max(1, Math.min(c.sashInner.x - c.sashOuter.x, c.sashInner.y - c.sashOuter.y));
      parts.push(...mitreCorners(c.sashOuter, sf));
    }
  }

  // Transom / mullion junction markers.
  for (const t of geometry.transoms) parts.push(dividerMarker(t.rect, "h", t.jointType));
  for (const m of geometry.mullions) parts.push(dividerMarker(m.rect, "v", m.jointType));

  return `<g id="joints" fill="none" stroke="${JOINT_STROKE}" stroke-width="1.5" stroke-linecap="round">
  ${parts.join("\n  ")}
</g>`;
}

/** Four 45° mitre diagonals, one per corner of a rect with profile face `f`. */
function mitreCorners(r: Rect, f: number): string[] {
  const x2 = r.x + r.w;
  const y2 = r.y + r.h;
  return [
    line(r.x, r.y, r.x + f, r.y + f),       // top-left  ╲
    line(x2, r.y, x2 - f, r.y + f),         // top-right ╱
    line(r.x, y2, r.x + f, y2 - f),         // bot-left  ╱
    line(x2, y2, x2 - f, y2 - f),           // bot-right ╲
  ];
}

/**
 * A divider-to-frame joint marker. `axis:"h"` = transom (ticks at left/right
 * ends), `"v"` = mullion (ticks at top/bottom ends). T = one tick centred on the
 * divider; Z = two offset ticks (the jamb breaks, so the joint reads doubled).
 */
function dividerMarker(r: Rect, axis: "h" | "v", joint: "T" | "Z" | "S"): string {
  // S (STULP / French mullion) butts square into the frame — reads like a T tick.
  const tick = 8; // mm, drawing only
  const segs: string[] = [];
  if (axis === "h") {
    const cy = r.y + r.h / 2;
    const xs = joint === "Z" ? [r.x - tick, r.x + r.w + tick] : [r.x, r.x + r.w];
    for (const x of xs) segs.push(line(x, cy - tick, x, cy + tick));
    if (joint === "Z") for (const x of xs) segs.push(line(x - tick / 2, cy, x + tick / 2, cy));
  } else {
    const cx = r.x + r.w / 2;
    const ys = joint === "Z" ? [r.y - tick, r.y + r.h + tick] : [r.y, r.y + r.h];
    for (const y of ys) segs.push(line(cx - tick, y, cx + tick, y));
    if (joint === "Z") for (const y of ys) segs.push(line(cx, y - tick / 2, cx, y + tick / 2));
  }
  return segs.join("\n  ");
}

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}"/>`;
}

/** A thin coloured liner just inside a rect's edge (dual-colour inside hint). */
function linerRect(r: Rect, hex: string): string {
  const inset = 6;
  return `<rect x="${num(r.x - inset)}" y="${num(r.y - inset)}" width="${num(r.w + 2 * inset)}" height="${num(r.h + 2 * inset)}" fill="none" stroke="${hex}" stroke-width="${inset}"/>`;
}

type Pt = { x: number; y: number };
type Chevron = { c1: Pt; apex: Pt; c2: Pt };

/**
 * One or more open chevrons (`corner → apex → corner`), each apex pointing
 * toward a hinge edge, sized as a contained symbol within the glazed area —
 * matching the collection artwork. Tilt&turn draws two (turn "<" + tilt "v").
 * Returns null for fixed cells / unknown content.
 */
function openingSymbol(c: SolvedCell, outer: Rect): string | null {
  // French midrail panes (no sashOuter) never draw a symbol — the leaf cell does.
  if (c.content.startsWith("french-door") && !c.sashOuter) return null;
  // Bound the symbol to the glazed area so it never overlaps the frame.
  const b = c.sashInner ?? c.glassRect ?? c.sashOuter ?? c.outer;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  // Margins: apex ~28% in from the hinge edge; base corners ~30% from the
  // opposite edge and ~18% from the sides.
  const ax = b.w * 0.28; // apex inset along the hinge axis
  const bx = b.w * 0.18; // base corner side inset
  const ay = b.h * 0.28;
  const by = b.h * 0.18;

  const topHung = (): Chevron => ({ // hinge at top ⇒ "^"
    apex: { x: cx, y: b.y + ay },
    c1: { x: b.x + bx, y: b.y + b.h - ay },
    c2: { x: b.x + b.w - bx, y: b.y + b.h - ay },
  });
  const tiltUp = (): Chevron => ({ // tilt hinge at bottom ⇒ "v" (apex bottom-centre)
    apex: { x: cx, y: b.y + b.h - ay },
    c1: { x: b.x + bx, y: b.y + ay },
    c2: { x: b.x + b.w - bx, y: b.y + ay },
  });
  const hingeLeft = (): Chevron => ({ // hinge at left ⇒ "<"
    apex: { x: b.x + ax, y: cy },
    c1: { x: b.x + b.w - ax, y: b.y + by },
    c2: { x: b.x + b.w - ax, y: b.y + b.h - by },
  });
  const hingeRight = (): Chevron => ({ // hinge at right ⇒ ">"
    apex: { x: b.x + b.w - ax, y: cy },
    c1: { x: b.x + ax, y: b.y + by },
    c2: { x: b.x + ax, y: b.y + b.h - by },
  });

  let chevrons: Chevron[];
  switch (c.content) {
    case "casement-top":                       chevrons = [topHung()]; break;
    case "casement-side-left":
    case "door-left":                          chevrons = [hingeLeft()]; break;
    case "casement-side-right":
    case "door-right":                         chevrons = [hingeRight()]; break;
    // Tilt&turn: turn (side hinge) + tilt (bottom hinge) marks, conventionally
    // drawn together.
    case "tilt-turn":                          chevrons = [hingeLeft(), tiltUp()]; break;
    // Sliding patio: chevron points in the panel's travel direction. Fixed
    // sliding panels (sliding-fixed) draw no symbol (fall through to default).
    case "sliding-slide-left":                 chevrons = [hingeLeft()]; break;
    case "sliding-slide-right":                chevrons = [hingeRight()]; break;
    // French leaves hinge on their OUTER jamb (positional): the left leaf
    // hinges left, the right leaf hinges right — master/slave doesn't change it.
    case "french-door-master":
    case "french-door-slave":
      chevrons = [cx < outer.x + outer.w / 2 ? hingeLeft() : hingeRight()];
      break;
    default: return null;
  }

  const sw = Math.max(4, Math.min(b.w, b.h) * 0.012);
  return chevrons
    .map((ch) => {
      const pts = `${num(ch.c1.x)},${num(ch.c1.y)} ${num(ch.apex.x)},${num(ch.apex.y)} ${num(ch.c2.x)},${num(ch.c2.y)}`;
      return `<polyline points="${pts}" fill="none" stroke="${SYMBOL_STROKE}" stroke-width="${num(sw)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("\n  ");
}

function rect(r: Rect, fill: string, stroke: string, strokeWidth = 1): string {
  return `<rect x="${num(r.x)}" y="${num(r.y)}" width="${num(r.w)}" height="${num(r.h)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
}

function num(n: number): number {
  return Math.round(n * 100) / 100;
}
