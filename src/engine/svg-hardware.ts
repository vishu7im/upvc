// =====================================================================
// engine/svg-hardware.ts — reusable, catalogue-style SVG door hardware.
//
// These helpers are PAINT only. They consume solved sash rectangles and
// presentation metadata; they never affect geometry, cuts, BOM quantities or
// pricing. Every item is kept as its own renderer so future visual-only options
// can enable it without changing the main SVG renderer.
// =====================================================================

import type { Rect, SolvedCell, SolvedGeometry } from "../types.ts";

export type HardwareFinish = "white" | "black" | "chrome" | "gold";
export type HingeStyle = "flag" | "high-security";

export interface DoorHardwareVisuals {
  /** Which face carries the visible hinge barrel. Defaults to the calibrated inward swing. */
  openingDirection?: "in" | "out";
  handle?: false | { finish?: HardwareFinish };
  cylinder?: false | { finish?: HardwareFinish };
  hinge?: false | { finish?: HardwareFinish; style?: HingeStyle; count?: number };
  lock?: false | { finish?: HardwareFinish };
  ventilator?: false | { finish?: HardwareFinish; location?: "frame" | "sash" };
  restrictor?: false | { finish?: HardwareFinish };
  letterbox?: false | { finish?: HardwareFinish };
  knocker?: false | { finish?: HardwareFinish };
  spyhole?: false | { finish?: HardwareFinish };
  catFlap?: false | { finish?: HardwareFinish };
}

export interface HardwareAssetPlacement {
  cx: number;
  cy: number;
  scale: number;
  side?: "left" | "right";
  finish?: HardwareFinish;
  defsId: string;
}

export interface HardwareLayerOpts {
  view: "external" | "internal";
  defsId: string;
  visuals?: DoorHardwareVisuals;
}

/**
 * Shared gradients for the four supported catalogue finishes. Hardware uses
 * small highlight/shadow shapes instead of extra filters, keeping the SVG fast.
 */
export function doorHardwareDefs(prefix: string): string {
  const gradient = (id: HardwareFinish, stops: [number, string][]) =>
    `<linearGradient id="${prefix}-hw-${id}" x1="0" y1="0" x2="1" y2="1">` +
    stops.map(([offset, colour]) => `<stop offset="${offset}" stop-color="${colour}"/>`).join("") +
    `</linearGradient>`;

  return [
    gradient("white", [
      [0, "#ffffff"],
      [0.38, "#f8fafc"],
      [0.72, "#d7dce2"],
      [1, "#aeb6bf"],
    ]),
    gradient("black", [
      [0, "#59616a"],
      [0.25, "#252b31"],
      [0.7, "#090c0f"],
      [1, "#32383f"],
    ]),
    gradient("chrome", [
      [0, "#ffffff"],
      [0.18, "#9ca6b0"],
      [0.36, "#f8fafc"],
      [0.58, "#6f7a85"],
      [0.78, "#e9edf1"],
      [1, "#858f99"],
    ]),
    gradient("gold", [
      [0, "#fff4b5"],
      [0.25, "#dcb94e"],
      [0.5, "#fff0a0"],
      [0.72, "#a87916"],
      [1, "#e0bf52"],
    ]),
  ].join("\n    ");
}

/**
 * Render hardware for every solved door leaf. Single doors and the French
 * master receive operating gear; every hinged leaf receives its own hinges.
 */
export function renderDoorHardwareLayer(
  geometry: SolvedGeometry,
  opts: HardwareLayerOpts,
): string {
  const frame = geometry.frameRect ?? geometry.outer;
  const handles: string[] = [];
  const cylinders: string[] = [];
  const hinges: string[] = [];
  const locks: string[] = [];
  const ventilators: string[] = [];
  const restrictors: string[] = [];
  const externalAccessories: string[] = [];
  const openingDirection = opts.visuals?.openingDirection ?? "in";
  const hingesFaceViewer =
    (openingDirection === "in" && opts.view === "internal") ||
    (openingDirection === "out" && opts.view === "external");

  for (const cell of geometry.cells) {
    if (!cell.sashOuter || !cell.sashInner || !isDoorLeaf(cell)) continue;

    const hingeSide = doorHingeSide(cell, frame);
    if (!hingeSide) continue;
    const closingSide = hingeSide === "left" ? "right" : "left";
    const r = cell.sashOuter;
    const inner = cell.sashInner;
    const scale = clamp(Math.min(r.w, r.h) * 0.055, 24, 48);
    const hingeX = stileCentre(r, inner, hingeSide);
    const closingX = stileCentre(r, inner, closingSide);
    const operatingLeaf =
      cell.content === "door-left" ||
      cell.content === "door-right" ||
      cell.content === "french-door-master";

    const hingeVisual = opts.visuals?.hinge;
    if (hingeVisual !== false && hingesFaceViewer) {
      const count = Math.round(clamp(hingeVisual?.count ?? 3, 1, 5));
      const positions = evenlySpacedHingePositions(r, count);
      for (const cy of positions) {
        hinges.push(
          renderHinge({
            cx: hingeX,
            cy,
            scale,
            side: hingeSide,
            finish: hingeVisual?.finish ?? "white",
            defsId: opts.defsId,
          }, hingeVisual?.style ?? "flag"),
        );
      }
    }

    if (!operatingLeaf) continue;

    const operatingY = r.y + r.h * 0.53;
    const handleVisual = opts.visuals?.handle;
    if (handleVisual !== false) {
      handles.push(
        renderDoorHandle({
          cx: closingX,
          cy: operatingY,
          scale,
          side: closingSide,
          finish: handleVisual?.finish ?? "white",
          defsId: opts.defsId,
        }, opts.view),
      );
    }

    const cylinderVisual = opts.visuals?.cylinder;
    if (cylinderVisual !== false) {
      cylinders.push(
        renderCylinder({
          cx: closingX,
          cy: operatingY + scale * 0.82,
          scale,
          side: closingSide,
          finish: cylinderVisual?.finish ?? "gold",
          defsId: opts.defsId,
        }),
      );
    }

    const lockVisual = opts.visuals?.lock;
    if (lockVisual !== false) {
      locks.push(
        renderDoorLock(
          r,
          inner,
          closingSide,
          lockVisual?.finish ?? "chrome",
          opts.defsId,
        ),
      );
    }

    const ventilatorVisual = opts.visuals?.ventilator;
    if (ventilatorVisual !== false && ventilatorVisual) {
      const target =
        ventilatorVisual.location === "frame"
          ? frame
          : r;
      ventilators.push(
        renderVentilator({
          cx: target.x + target.w / 2,
          cy: target.y + Math.min(target.h * 0.035, scale * 0.85),
          scale: Math.min(scale, target.w * 0.11),
          finish: ventilatorVisual.finish ?? "white",
          defsId: opts.defsId,
        }),
      );
    }

    const restrictorVisual = opts.visuals?.restrictor;
    if (opts.view === "internal" && restrictorVisual !== false && restrictorVisual) {
      restrictors.push(
        renderRestrictor(
          r,
          inner,
          hingeSide,
          restrictorVisual.finish ?? "chrome",
          opts.defsId,
        ),
      );
    }

    if (opts.view === "external") {
      const letterbox = opts.visuals?.letterbox;
      if (letterbox !== false && letterbox) {
        externalAccessories.push(
          renderLetterbox({
            cx: r.x + r.w / 2,
            cy: r.y + r.h * 0.69,
            scale,
            finish: letterbox.finish ?? "chrome",
            defsId: opts.defsId,
          }, r.w),
        );
      }

      const knocker = opts.visuals?.knocker;
      if (knocker !== false && knocker) {
        externalAccessories.push(
          renderKnocker({
            cx: r.x + r.w / 2,
            cy: r.y + r.h * 0.33,
            scale,
            finish: knocker.finish ?? "chrome",
            defsId: opts.defsId,
          }),
        );
      }

      const spyhole = opts.visuals?.spyhole;
      if (spyhole !== false && spyhole) {
        externalAccessories.push(
          renderSpyhole({
            cx: r.x + r.w / 2,
            cy: r.y + r.h * 0.23,
            scale,
            finish: spyhole.finish ?? "chrome",
            defsId: opts.defsId,
          }),
        );
      }

      const catFlap = opts.visuals?.catFlap;
      if (catFlap !== false && catFlap) {
        externalAccessories.push(
          renderCatFlap({
            cx: r.x + r.w / 2,
            cy: r.y + r.h * 0.84,
            scale,
            finish: catFlap.finish ?? "white",
            defsId: opts.defsId,
          }, r),
        );
      }
    }
  }

  const groups = [
    hardwareGroup("door-locks", locks),
    hardwareGroup("hinges", hinges),
    hardwareGroup("handles", handles),
    hardwareGroup("cylinders", cylinders),
    hardwareGroup("ventilators", ventilators),
    hardwareGroup("restrictors", restrictors),
    hardwareGroup("external-hardware", externalAccessories),
  ].filter(Boolean);

  if (!groups.length) return "";
  return `<g id="door-hardware" data-view="${opts.view}">
    ${groups.join("\n    ")}
  </g>`;
}

/** Lever/lever door handle with a moulded backplate and a proper horizontal lever. */
export function renderDoorHandle(
  p: HardwareAssetPlacement,
  view: "external" | "internal" = "external",
): string {
  const side = p.side ?? "right";
  const finish = p.finish ?? "white";
  const plateW = p.scale * (view === "internal" ? 0.42 : 0.48);
  const plateH = p.scale * (view === "internal" ? 2.55 : 2.9);
  const leverLength = p.scale * 1.72;
  const leverH = p.scale * 0.23;
  const direction = side === "right" ? -1 : 1;
  const leverX = direction < 0 ? p.cx - leverLength : p.cx;
  const shadow = p.scale * 0.075;
  const fill = hardwareFill(p.defsId, finish);

  return `<g class="door-handle">
      <rect x="${n(p.cx - plateW / 2 + shadow)}" y="${n(p.cy - plateH / 2 + shadow)}" width="${n(plateW)}" height="${n(plateH)}" rx="${n(plateW * 0.38)}" fill="rgba(15,23,42,0.22)"/>
      <rect x="${n(p.cx - plateW / 2)}" y="${n(p.cy - plateH / 2)}" width="${n(plateW)}" height="${n(plateH)}" rx="${n(plateW * 0.38)}" fill="${fill}" stroke="rgba(15,23,42,0.48)" stroke-width="${n(p.scale * 0.035)}"/>
      <rect x="${n(p.cx - plateW * 0.28)}" y="${n(p.cy - plateH * 0.42)}" width="${n(plateW * 0.18)}" height="${n(plateH * 0.68)}" rx="${n(plateW * 0.09)}" fill="rgba(255,255,255,0.38)"/>
      <circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.scale * 0.29)}" fill="${fill}" stroke="rgba(15,23,42,0.5)" stroke-width="${n(p.scale * 0.035)}"/>
      <rect x="${n(leverX + shadow)}" y="${n(p.cy - leverH / 2 + shadow)}" width="${n(leverLength)}" height="${n(leverH)}" rx="${n(leverH / 2)}" fill="rgba(15,23,42,0.25)"/>
      <rect x="${n(leverX)}" y="${n(p.cy - leverH / 2)}" width="${n(leverLength)}" height="${n(leverH)}" rx="${n(leverH / 2)}" fill="${fill}" stroke="rgba(15,23,42,0.48)" stroke-width="${n(p.scale * 0.035)}"/>
      <path d="M ${n(leverX + p.scale * 0.18)} ${n(p.cy - leverH * 0.18)} H ${n(leverX + leverLength - p.scale * 0.18)}" fill="none" stroke="rgba(255,255,255,0.62)" stroke-width="${n(p.scale * 0.045)}" stroke-linecap="round"/>
    </g>`;
}

/** Euro-profile cylinder escutcheon and keyway. */
export function renderCylinder(p: HardwareAssetPlacement): string {
  const finish = p.finish ?? "gold";
  const rx = p.scale * 0.31;
  const ry = p.scale * 0.22;
  const fill = hardwareFill(p.defsId, finish);
  return `<g class="door-cylinder">
      <ellipse cx="${n(p.cx + p.scale * 0.05)}" cy="${n(p.cy + p.scale * 0.07)}" rx="${n(rx)}" ry="${n(ry)}" fill="rgba(15,23,42,0.24)"/>
      <ellipse cx="${n(p.cx)}" cy="${n(p.cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}" stroke="rgba(15,23,42,0.58)" stroke-width="${n(p.scale * 0.04)}"/>
      <path d="M ${n(p.cx)} ${n(p.cy - ry * 0.42)} v ${n(ry * 0.55)} l ${n(-rx * 0.15)} ${n(ry * 0.32)} h ${n(rx * 0.3)} l ${n(-rx * 0.15)} ${n(-ry * 0.32)}" fill="none" stroke="#1f2937" stroke-width="${n(p.scale * 0.06)}" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`;
}

/** Flag or high-security door hinge with knuckle, flag and fixing caps. */
export function renderHinge(
  p: HardwareAssetPlacement,
  style: HingeStyle = "flag",
): string {
  const side = p.side ?? "left";
  const finish = p.finish ?? "white";
  const fill = hardwareFill(p.defsId, finish);
  const dir = side === "left" ? 1 : -1;
  const bodyW = p.scale * 0.46;
  const bodyH = p.scale * 1.42;
  const flagW = p.scale * (style === "high-security" ? 0.95 : 0.75);
  const bodyX = p.cx - bodyW / 2;
  const flagX = dir > 0 ? p.cx : p.cx - flagW;
  const y = p.cy - bodyH / 2;
  const shadow = p.scale * 0.07;
  const screws = [-0.3, 0.3]
    .map((offset) => `<circle cx="${n(p.cx + dir * flagW * 0.46)}" cy="${n(p.cy + bodyH * offset)}" r="${n(p.scale * 0.075)}" fill="rgba(15,23,42,0.52)"/>`)
    .join("");

  return `<g class="door-hinge" data-style="${style}">
      <rect x="${n(flagX + shadow)}" y="${n(y + bodyH * 0.12 + shadow)}" width="${n(flagW)}" height="${n(bodyH * 0.76)}" rx="${n(p.scale * 0.12)}" fill="rgba(15,23,42,0.2)"/>
      <rect x="${n(flagX)}" y="${n(y + bodyH * 0.12)}" width="${n(flagW)}" height="${n(bodyH * 0.76)}" rx="${n(p.scale * 0.12)}" fill="${fill}" stroke="rgba(15,23,42,0.46)" stroke-width="${n(p.scale * 0.035)}"/>
      <rect x="${n(bodyX)}" y="${n(y)}" width="${n(bodyW)}" height="${n(bodyH)}" rx="${n(bodyW / 2)}" fill="${fill}" stroke="rgba(15,23,42,0.55)" stroke-width="${n(p.scale * 0.04)}"/>
      <rect x="${n(p.cx - bodyW * 0.16)}" y="${n(y + bodyH * 0.08)}" width="${n(bodyW * 0.16)}" height="${n(bodyH * 0.74)}" rx="${n(bodyW * 0.08)}" fill="rgba(255,255,255,0.48)"/>
      ${screws}
    </g>`;
}

/** Concealed multipoint strip: faceplate, latch and three locking points. */
export function renderDoorLock(
  outer: Rect,
  inner: Rect,
  side: "left" | "right",
  finish: HardwareFinish,
  defsId: string,
): string {
  const stile = stileWidth(outer, inner, side);
  const width = Math.min(stile * 0.13, 9);
  const x =
    side === "right"
      ? inner.x + inner.w + stile * 0.18
      : inner.x - stile * 0.18 - width;
  // Only the central faceplate is visible in an elevation; the full multipoint
  // gearbox is concealed inside the stile and must not read like an exposed rod.
  const y = outer.y + outer.h * 0.37;
  const height = outer.h * 0.32;
  const fill = hardwareFill(defsId, finish);
  const bolts = [0.16, 0.5, 0.84]
    .map((ratio) => `<rect x="${n(x - width * 0.4)}" y="${n(y + height * ratio - width)}" width="${n(width * 1.8)}" height="${n(width * 2)}" rx="${n(width * 0.4)}" fill="${fill}" stroke="rgba(15,23,42,0.5)" stroke-width="${n(width * 0.16)}"/>`)
    .join("");
  return `<g class="door-lock">
      <rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" rx="${n(width / 2)}" fill="${fill}" opacity="0.88"/>
      ${bolts}
    </g>`;
}

/** Slim trickle ventilator with individually modelled grille slots. */
export function renderVentilator(p: HardwareAssetPlacement): string {
  const finish = p.finish ?? "white";
  const fill = hardwareFill(p.defsId, finish);
  const width = p.scale * 4.4;
  const height = p.scale * 0.62;
  const x = p.cx - width / 2;
  const y = p.cy - height / 2;
  const slots = Array.from({ length: 9 }, (_, index) => {
    const sx = x + width * (0.12 + index * 0.095);
    return `<line x1="${n(sx)}" y1="${n(y + height * 0.3)}" x2="${n(sx)}" y2="${n(y + height * 0.7)}" stroke="rgba(15,23,42,0.52)" stroke-width="${n(p.scale * 0.035)}" stroke-linecap="round"/>`;
  }).join("");
  return `<g class="door-ventilator">
      <rect x="${n(x + p.scale * 0.06)}" y="${n(y + p.scale * 0.08)}" width="${n(width)}" height="${n(height)}" rx="${n(height / 2)}" fill="rgba(15,23,42,0.18)"/>
      <rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" rx="${n(height / 2)}" fill="${fill}" stroke="rgba(15,23,42,0.45)" stroke-width="${n(p.scale * 0.035)}"/>
      ${slots}
    </g>`;
}

/** Internal opening restrictor arm, anchored between frame and sash. */
export function renderRestrictor(
  outer: Rect,
  inner: Rect,
  hingeSide: "left" | "right",
  finish: HardwareFinish,
  defsId: string,
): string {
  const dir = hingeSide === "left" ? 1 : -1;
  const startX = stileCentre(outer, inner, hingeSide);
  const startY = outer.y + outer.h * 0.13;
  const length = clamp(outer.w * 0.24, 70, 190);
  const endX = startX + dir * length;
  const endY = startY + length * 0.28;
  const sw = clamp(Math.min(outer.w, outer.h) * 0.008, 4, 10);
  const fill = hardwareFill(defsId, finish);
  return `<g class="door-restrictor">
      <line x1="${n(startX + sw * 0.5)}" y1="${n(startY + sw * 0.6)}" x2="${n(endX + sw * 0.5)}" y2="${n(endY + sw * 0.6)}" stroke="rgba(15,23,42,0.22)" stroke-width="${n(sw * 1.5)}" stroke-linecap="round"/>
      <line x1="${n(startX)}" y1="${n(startY)}" x2="${n(endX)}" y2="${n(endY)}" stroke="${fill}" stroke-width="${n(sw)}" stroke-linecap="round"/>
      <circle cx="${n(startX)}" cy="${n(startY)}" r="${n(sw * 0.8)}" fill="${fill}" stroke="rgba(15,23,42,0.55)" stroke-width="${n(sw * 0.25)}"/>
      <circle cx="${n(endX)}" cy="${n(endY)}" r="${n(sw * 0.8)}" fill="${fill}" stroke="rgba(15,23,42,0.55)" stroke-width="${n(sw * 0.25)}"/>
    </g>`;
}

/** External letter plate with lid, frame and finger recess. */
export function renderLetterbox(p: HardwareAssetPlacement, availableWidth: number): string {
  const finish = p.finish ?? "chrome";
  const fill = hardwareFill(p.defsId, finish);
  const width = Math.min(availableWidth * 0.48, p.scale * 5.8);
  const height = p.scale * 0.9;
  const x = p.cx - width / 2;
  const y = p.cy - height / 2;
  return `<g class="door-letterbox">
      <rect x="${n(x + p.scale * 0.08)}" y="${n(y + p.scale * 0.1)}" width="${n(width)}" height="${n(height)}" rx="${n(height * 0.16)}" fill="rgba(15,23,42,0.22)"/>
      <rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" rx="${n(height * 0.16)}" fill="${fill}" stroke="rgba(15,23,42,0.55)" stroke-width="${n(p.scale * 0.045)}"/>
      <rect x="${n(x + height * 0.24)}" y="${n(y + height * 0.24)}" width="${n(width - height * 0.48)}" height="${n(height * 0.5)}" rx="${n(height * 0.08)}" fill="rgba(15,23,42,0.2)" stroke="rgba(255,255,255,0.48)" stroke-width="${n(p.scale * 0.03)}"/>
      <path d="M ${n(p.cx - p.scale * 0.32)} ${n(y + height * 0.25)} Q ${n(p.cx)} ${n(y + height * 0.08)} ${n(p.cx + p.scale * 0.32)} ${n(y + height * 0.25)}" fill="none" stroke="rgba(15,23,42,0.5)" stroke-width="${n(p.scale * 0.055)}" stroke-linecap="round"/>
    </g>`;
}

/** Traditional ring knocker with a separate striker. */
export function renderKnocker(p: HardwareAssetPlacement): string {
  const finish = p.finish ?? "chrome";
  const fill = hardwareFill(p.defsId, finish);
  const radius = p.scale * 0.62;
  const sw = p.scale * 0.2;
  return `<g class="door-knocker">
      <circle cx="${n(p.cx + p.scale * 0.06)}" cy="${n(p.cy + p.scale * 0.08)}" r="${n(radius)}" fill="none" stroke="rgba(15,23,42,0.24)" stroke-width="${n(sw)}"/>
      <circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(radius)}" fill="none" stroke="${fill}" stroke-width="${n(sw)}"/>
      <circle cx="${n(p.cx)}" cy="${n(p.cy - radius)}" r="${n(p.scale * 0.3)}" fill="${fill}" stroke="rgba(15,23,42,0.52)" stroke-width="${n(p.scale * 0.04)}"/>
      <rect x="${n(p.cx - p.scale * 0.46)}" y="${n(p.cy + radius * 0.78)}" width="${n(p.scale * 0.92)}" height="${n(p.scale * 0.26)}" rx="${n(p.scale * 0.13)}" fill="${fill}" stroke="rgba(15,23,42,0.52)" stroke-width="${n(p.scale * 0.04)}"/>
    </g>`;
}

/** Small glazed-door viewer with concentric metal rings. */
export function renderSpyhole(p: HardwareAssetPlacement): string {
  const finish = p.finish ?? "chrome";
  const fill = hardwareFill(p.defsId, finish);
  return `<g class="door-spyhole">
      <circle cx="${n(p.cx + p.scale * 0.04)}" cy="${n(p.cy + p.scale * 0.06)}" r="${n(p.scale * 0.28)}" fill="rgba(15,23,42,0.25)"/>
      <circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.scale * 0.28)}" fill="${fill}" stroke="rgba(15,23,42,0.58)" stroke-width="${n(p.scale * 0.04)}"/>
      <circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.scale * 0.13)}" fill="#142333"/>
      <circle cx="${n(p.cx - p.scale * 0.045)}" cy="${n(p.cy - p.scale * 0.05)}" r="${n(p.scale * 0.035)}" fill="rgba(255,255,255,0.82)"/>
    </g>`;
}

/** Framed pet flap with a translucent swing panel and lower weather seal. */
export function renderCatFlap(
  p: HardwareAssetPlacement,
  bounds: Rect,
): string {
  const finish = p.finish ?? "white";
  const fill = hardwareFill(p.defsId, finish);
  const size = Math.min(bounds.w * 0.34, bounds.h * 0.17, p.scale * 4.8);
  const x = p.cx - size / 2;
  const y = p.cy - size / 2;
  const border = size * 0.1;
  return `<g class="door-cat-flap">
      <rect x="${n(x + border * 0.35)}" y="${n(y + border * 0.45)}" width="${n(size)}" height="${n(size)}" rx="${n(border * 1.3)}" fill="rgba(15,23,42,0.22)"/>
      <rect x="${n(x)}" y="${n(y)}" width="${n(size)}" height="${n(size)}" rx="${n(border * 1.3)}" fill="${fill}" stroke="rgba(15,23,42,0.52)" stroke-width="${n(border * 0.32)}"/>
      <path d="M ${n(x + border)} ${n(y + size - border)} V ${n(y + size * 0.29)} Q ${n(p.cx)} ${n(y + size * 0.08)} ${n(x + size - border)} ${n(y + size * 0.29)} V ${n(y + size - border)} Z" fill="rgba(124,154,176,0.32)" stroke="rgba(15,23,42,0.48)" stroke-width="${n(border * 0.28)}"/>
      <line x1="${n(x + border * 1.25)}" y1="${n(y + size - border * 1.25)}" x2="${n(x + size - border * 1.25)}" y2="${n(y + size - border * 1.25)}" stroke="rgba(15,23,42,0.62)" stroke-width="${n(border * 0.38)}" stroke-linecap="round"/>
    </g>`;
}

function isDoorLeaf(cell: SolvedCell): boolean {
  return (
    cell.content === "door-left" ||
    cell.content === "door-right" ||
    cell.content === "french-door-master" ||
    cell.content === "french-door-slave"
  );
}

function doorHingeSide(
  cell: SolvedCell,
  frame: Rect,
): "left" | "right" | null {
  if (cell.content === "door-left") return "left";
  if (cell.content === "door-right") return "right";
  if (cell.content === "french-door-master" || cell.content === "french-door-slave") {
    const r = cell.sashOuter ?? cell.outer;
    return r.x + r.w / 2 < frame.x + frame.w / 2 ? "left" : "right";
  }
  return null;
}

function stileWidth(
  outer: Rect,
  inner: Rect,
  side: "left" | "right",
): number {
  return side === "left"
    ? inner.x - outer.x
    : outer.x + outer.w - (inner.x + inner.w);
}

function stileCentre(
  outer: Rect,
  inner: Rect,
  side: "left" | "right",
): number {
  return side === "left"
    ? (outer.x + inner.x) / 2
    : (inner.x + inner.w + outer.x + outer.w) / 2;
}

function evenlySpacedHingePositions(r: Rect, count: number): number[] {
  if (count === 1) return [r.y + r.h / 2];
  const top = r.y + r.h * 0.16;
  const bottom = r.y + r.h * 0.84;
  return Array.from({ length: count }, (_, index) =>
    top + ((bottom - top) * index) / (count - 1),
  );
}

function hardwareGroup(id: string, parts: string[]): string {
  return parts.length ? `<g id="${id}">\n      ${parts.join("\n      ")}\n    </g>` : "";
}

function hardwareFill(prefix: string, finish: HardwareFinish): string {
  return `url(#${prefix}-hw-${finish})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function n(value: number): number {
  return Math.round(value * 100) / 100;
}
