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

export function renderSvg(geometry: SolvedGeometry): string {
  const w = geometry.outer.w;
  const h = geometry.outer.h;
  // Inset the viewBox slightly so the chevron symbols aren't clipped.
  const pad = 20;

  const shapes: string[] = [];

  // Outer frame — the whole window starts as profile-grey; the daylight
  // opening is then "cut" as clear glass on top.
  shapes.push(rect(geometry.outer, PROFILE_FILL, STROKE, 2));
  shapes.push(rect(geometry.rootDaylight, GLASS_FILL, STROKE, 1));

  // Transoms & mullions (profile-grey strips drawn over the daylight).
  for (const t of geometry.transoms) {
    shapes.push(rect(t.rect, PROFILE_FILL, STROKE, 1));
  }
  for (const m of geometry.mullions) {
    shapes.push(rect(m.rect, PROFILE_FILL, STROKE, 1));
  }

  // Cells — sash outline (if any) + glazed area + opening-direction chevron.
  for (const c of geometry.cells) {
    drawCell(c, shapes);
  }

  return `<svg viewBox="-${pad} -${pad} ${w + 2 * pad} ${h + 2 * pad}" xmlns="http://www.w3.org/2000/svg">
  ${shapes.join("\n  ")}
</svg>`;
}

function drawCell(c: SolvedCell, shapes: string[]): void {
  if (c.sashOuter && c.sashInner) {
    // Opening cell: grey sash profile ring with a clear glazed centre.
    shapes.push(rect(c.sashOuter, PROFILE_FILL, STROKE, 1));
    shapes.push(rect(c.sashInner, GLASS_FILL, STROKE, 1));
  } else {
    // Fixed cell: clear glazed pane with a bead outline.
    shapes.push(rect(c.glassRect, GLASS_FILL, STROKE, 1));
  }

  // Opening-direction chevron — visual indicator only.
  const symbol = openingSymbol(c);
  if (symbol) shapes.push(symbol);
}

type Pt = { x: number; y: number };
type Chevron = { c1: Pt; apex: Pt; c2: Pt };

/**
 * One or more open chevrons (`corner → apex → corner`), each apex pointing
 * toward a hinge edge, sized as a contained symbol within the glazed area —
 * matching the collection artwork. Tilt&turn draws two (turn "<" + tilt "v").
 * Returns null for fixed cells / unknown content.
 */
function openingSymbol(c: SolvedCell): string | null {
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
