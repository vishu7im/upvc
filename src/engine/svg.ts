// =====================================================================
// engine/svg.ts — render the solved geometry as a clean SVG preview.
// Uses real mm coordinates with a viewBox sized to the window.
// =====================================================================

import type { SolvedGeometry, SolvedCell } from "../types.ts";

export function renderSvg(geometry: SolvedGeometry): string {
  const w = geometry.outer.w;
  const h = geometry.outer.h;
  // Inset the viewBox slightly so hinge arrows aren't clipped.
  const pad = 20;

  const shapes: string[] = [];

  // Outer frame — drawn as the area BETWEEN outer and daylight.
  shapes.push(
    `<rect x="0" y="0" width="${w}" height="${h}" fill="#e9eef3" stroke="#28323c" stroke-width="2"/>`,
  );
  shapes.push(
    `<rect x="${geometry.rootDaylight.x}" y="${geometry.rootDaylight.y}" width="${geometry.rootDaylight.w}" height="${geometry.rootDaylight.h}" fill="#ffffff" stroke="#28323c" stroke-width="1"/>`,
  );

  // Transoms & mullions (drawn after the frame, before cells).
  for (const t of geometry.transoms) {
    shapes.push(rect(t.rect, "#e9eef3", "#28323c"));
  }
  for (const m of geometry.mullions) {
    shapes.push(rect(m.rect, "#e9eef3", "#28323c"));
  }

  // Cells — sash outline (if any) + glass area + hinge pointer arrow.
  for (const c of geometry.cells) {
    drawCell(c, shapes);
  }

  return `<svg viewBox="-${pad} -${pad} ${w + 2 * pad} ${h + 2 * pad}" xmlns="http://www.w3.org/2000/svg">
  ${shapes.join("\n  ")}
</svg>`;
}

function drawCell(c: SolvedCell, shapes: string[]): void {
  // Glass tint
  shapes.push(rect(c.glassRect, "#cee5f2", "none"));

  // Sash outline (if applicable)
  if (c.sashOuter && c.sashInner) {
    shapes.push(rect(c.sashOuter, "#ffffff", "#28323c"));
    shapes.push(rect(c.sashInner, "#cee5f2", "#28323c"));
  }

  // Hinge pointer arrow — visual indicator of opening direction.
  const arrow = hingeArrow(c);
  if (arrow) shapes.push(arrow);
}

function hingeArrow(c: SolvedCell): string | null {
  const o = c.sashOuter ?? c.outer;
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  const pad = 12;

  // Direction:
  //   casement-top         arrow tip at TOP edge
  //   casement-side-left   arrow tip at LEFT edge
  //   casement-side-right  arrow tip at RIGHT edge
  //   door-right           arrow tip at RIGHT edge (longer line)
  //   door-left            arrow tip at LEFT edge (longer line)
  let tip = { x: 0, y: 0 };
  switch (c.content) {
    case "casement-top":         tip = { x: cx,           y: o.y + pad };           break;
    case "casement-side-left":   tip = { x: o.x + pad,    y: cy };                  break;
    case "casement-side-right":  tip = { x: o.x + o.w - pad, y: cy };               break;
    case "door-right":           tip = { x: o.x + o.w - pad, y: cy };               break;
    case "door-left":            tip = { x: o.x + pad,    y: cy };                  break;
    default: return null;
  }

  // Lines from the two corners on the OPPOSITE edge converging to tip.
  const corners = (() => {
    switch (c.content) {
      case "casement-top":        return [{ x: o.x + pad, y: o.y + o.h - pad }, { x: o.x + o.w - pad, y: o.y + o.h - pad }];
      case "casement-side-left":  return [{ x: o.x + o.w - pad, y: o.y + pad }, { x: o.x + o.w - pad, y: o.y + o.h - pad }];
      case "casement-side-right": return [{ x: o.x + pad, y: o.y + pad },       { x: o.x + pad, y: o.y + o.h - pad }];
      case "door-right":          return [{ x: o.x + pad, y: o.y + pad },       { x: o.x + pad, y: o.y + o.h - pad }];
      case "door-left":           return [{ x: o.x + o.w - pad, y: o.y + pad }, { x: o.x + o.w - pad, y: o.y + o.h - pad }];
      default: return [];
    }
  })();

  return corners.map((p) =>
    `<line x1="${p.x}" y1="${p.y}" x2="${tip.x}" y2="${tip.y}" stroke="#28323c" stroke-width="1.5"/>`
  ).join("\n  ");
}

function rect(r: { x: number; y: number; w: number; h: number }, fill: string, stroke: string): string {
  return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
}
