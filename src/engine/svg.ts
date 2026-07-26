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
// Schematic (technical-drawing) palette: white fills + thin strokes, so the
// annotation numbers are what the eye lands on.
const SCHEMATIC_FILL = "#ffffff";
const SCHEMATIC_STROKE = "#334155";
const SCHEMATIC_LINE_SCALE = 0.6;
const ANNOTATION_FILL = "#1f2937";
const HANDLE_FILL = "#9aa3ad"; // stylised internal handle glyph (not hardware art)

/** Which side of the unit the elevation is drawn from. */
export type SvgView = "external" | "internal";

/**
 * How the elevation is DRAWN. "flat" is the historical line drawing (and the
 * only style any document or seeded gallery image uses). "realistic" adds the
 * presentation layer the live configurators show: bevelled mitred profile
 * faces, a moulded bead step, glazed glass and a soft drop shadow. It changes
 * no coordinate — every shape is still read off the solved rects.
 */
export type SvgStyle = "flat" | "realistic";

/** Which annotations the technical (schematic) style carries. */
export interface SchematicOpts {
  /** Profile face widths: frame edges, dividers, sash rings. Default true. */
  faceWidths?: boolean;
  /** Per-pane "W × H" glass size (the cutting list's numbers). Default true. */
  glassSizes?: boolean;
}

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
   *
   * `grain` marks the finish as a woodgrain. It is catalog data
   * (`ColourOption.texture`), never inferred from the hex, and is consumed by
   * the realistic style only — so it can never change a document.
   */
  colour?: { insideHex?: string; outsideHex?: string; grain?: boolean };
  /**
   * How the elevation is drawn. Omitted / "flat" ⇒ the historical line drawing.
   * "realistic" is the live-configurator presentation style; `schematic` always
   * wins over it, because a technical drawing must stay flat.
   */
  style?: SvgStyle;
  /**
   * Which side the elevation is drawn from. "internal" mirrors the drawing
   * horizontally (so hinge sides and opening symbols read as they do from
   * inside the room) and adds a stylised handle glyph on each opening sash's
   * closing edge. Omitted / "external" ⇒ the historical output.
   */
  view?: SvgView;
  /**
   * Render the technical style (white fills, thin strokes) plus the annotation
   * layer. Every number comes from rects already on the solved geometry — no
   * new engine math, nothing invented. Omitted ⇒ the historical output.
   */
  schematic?: SchematicOpts;
}

/** The pen the shape helpers draw with (schematic swaps the whole palette). */
interface Ink {
  profile: string;
  glass: string;
  stroke: string;
  /** Multiplier on every stroke-width (1 ⇒ the historical widths). */
  lw: number;
}

export function renderSvg(geometry: SolvedGeometry, opts?: RenderSvgOpts): string {
  const w = geometry.outer.w;
  const h = geometry.outer.h;
  // Inset the viewBox slightly so the chevron symbols aren't clipped.
  const pad = 20;

  const internal = opts?.view === "internal";
  const schematic = opts?.schematic;
  // A technical drawing must stay flat, so `schematic` always wins over `style`.
  const realistic = opts?.style === "realistic" && !schematic;

  // Profile fill: outside colour drives the visible face (elevation is "viewed
  // from outside"); omitted ⇒ historical grey, so default quotes are unchanged.
  // The schematic is a technical drawing, so it ignores the finish tint (its
  // subject is the numbers, not the colour) — noted in the phase-5 doc.
  const profileFill = schematic
    ? SCHEMATIC_FILL
    : (opts?.colour?.outsideHex ?? opts?.colour?.insideHex ?? PROFILE_FILL);
  const insideHex = schematic ? undefined : opts?.colour?.insideHex;
  const dualColour = Boolean(insideHex && opts?.colour?.outsideHex && insideHex !== opts.colour.outsideHex);
  const ink: Ink = schematic
    ? { profile: SCHEMATIC_FILL, glass: SCHEMATIC_FILL, stroke: SCHEMATIC_STROKE, lw: SCHEMATIC_LINE_SCALE }
    : { profile: profileFill, glass: GLASS_FILL, stroke: STROKE, lw: 1 };

  // The realistic elevation shows the face you are actually looking at, so the
  // internal view is drawn in the INSIDE finish. (The flat drawing keeps the
  // single fill it has always had — its byte-identity is the validation gate.)
  const realisticBase = realistic && internal ? (insideHex ?? profileFill) : profileFill;
  const skin = realistic ? buildSkin(realisticBase, Boolean(opts?.colour?.grain)) : null;

  const shapes: string[] = [];

  if (skin) {
    shapes.push(...realisticBody(geometry, skin));
  } else {
    // Outer frame — the whole window starts as profile-grey; the daylight
    // opening is then "cut" as clear glass on top.
    shapes.push(rect(geometry.outer, ink.profile, ink.stroke, 2 * ink.lw));
    // Dual-colour hint: a thin liner just inside the frame face carries the INSIDE
    // colour, so a white-in / anthracite-out finish reads at a glance. Single
    // colour (or none) ⇒ not drawn, so the SVG is unchanged.
    if (dualColour && insideHex) {
      shapes.push(linerRect(geometry.rootDaylight, insideHex));
    }
    shapes.push(rect(geometry.rootDaylight, ink.glass, ink.stroke, 1 * ink.lw));

    // Transoms & mullions (profile-grey strips drawn over the daylight).
    for (const t of geometry.transoms) {
      shapes.push(rect(t.rect, ink.profile, ink.stroke, 1 * ink.lw));
    }
    for (const m of geometry.mullions) {
      shapes.push(rect(m.rect, ink.profile, ink.stroke, 1 * ink.lw));
    }

    // Cells — sash outline (if any) + glazed area + opening-direction chevron.
    for (const c of geometry.cells) {
      drawCell(c, shapes, ink, geometry.outer);
    }
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
    if (skin) shapes.push(...realisticCill(cillRect, skin));
    else shapes.push(rect(cillRect, schematic ? SCHEMATIC_FILL : CILL_FILL, ink.stroke, 2 * ink.lw));
    // Grow the viewBox to show the overhang (sides) and the cill depth (bottom).
    minX = -(pad + CILL_OVERHANG);
    vbW = w + 2 * CILL_OVERHANG + 2 * pad;
    vbH = h + c.rect.h + 2 * pad;
  }

  // The internal elevation is the SAME drawing seen from the other side: one
  // horizontal mirror about the window's centreline. Because the viewBox is
  // symmetric about x = w/2 (the cill overhang is equal both sides), mirroring
  // leaves it unchanged — so hinge sides, opening chevrons and every rect flip
  // together and nothing can drift out of frame.
  let body = internal
    ? `<g transform="matrix(-1 0 0 1 ${num(w)} 0)">\n    ${shapes.join("\n    ")}\n  </g>`
    : shapes.join("\n  ");
  // The realistic unit casts one soft shadow as a whole — applied outside the
  // mirror group so the internal elevation is lit from the same side.
  if (skin) body = `<g filter="url(#${skin.id}-shadow)">\n  ${body}\n  </g>`;

  // Overlays that must NOT be mirrored (their text would read backwards) are
  // drawn outside that group at already-mirrored coordinates.
  const mirror = (r: Rect): Rect => (internal ? { ...r, x: w - (r.x + r.w) } : r);
  const overlays = [
    internal ? handleLayer(geometry, mirror) : "",
    schematic ? annotationLayer(geometry, schematic, mirror) : "",
  ].filter(Boolean);

  return `<svg viewBox="${minX} -${pad} ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg">
  ${skin ? `${skin.defs}\n  ` : ""}${body}${overlays.length ? `\n  ${overlays.join("\n  ")}` : ""}
</svg>`;
}

function drawCell(c: SolvedCell, shapes: string[], ink: Ink, outer: Rect): void {
  if (c.sashOuter && c.sashInner) {
    // Opening cell: grey sash profile ring with a clear glazed centre. The
    // glazed rect is the cell's bead-Int area — identical to sashInner for
    // ordinary cells, but only PANE 1 for a midrail leaf (French doors), so
    // the midrail bar drawn earlier stays visible.
    shapes.push(rect(c.sashOuter, ink.profile, ink.stroke, 1 * ink.lw));
    shapes.push(
      rect({ x: c.sashInner.x, y: c.sashInner.y, w: c.beadIntW, h: c.beadIntH }, ink.glass, ink.stroke, 1 * ink.lw),
    );
  } else {
    // Fixed cell (or a midrail glazing pane): clear pane with a bead outline.
    shapes.push(rect(c.glassRect, ink.glass, ink.stroke, 1 * ink.lw));
  }

  // Opening-direction chevron — visual indicator only.
  const symbol = openingSymbol(c, outer);
  if (symbol) shapes.push(symbol);
}

// ---------------------------------------------------------------------
// Realistic style (opt-in) — bevelled mitred faces, moulded bead, glazed glass
//
// Nothing here is new engine math: every polygon corner is a corner of a rect
// the solver already produced (`outer`/`rootDaylight`, each divider `rect`,
// each cell's `sashOuter`/`sashInner`/`glassRect`). What changes is only how
// those rects are PAINTED — a profile ring becomes four trapezoids whose
// shared edges are the 45° mitres, each lit as if the light came from the top
// left, which is what makes a flat rectangle read as a moulded section.
// ---------------------------------------------------------------------

/** Hairlines between adjacent faces; the unit's outer edge is stronger. */
const REALISTIC_SEAM = "rgba(15,23,42,0.22)";
const REALISTIC_EDGE = "rgba(15,23,42,0.5)";
const REALISTIC_SYMBOL = "rgba(30,41,59,0.5)";

/** The resolved look of one finish: its gradient ids plus the defs they live in. */
interface Skin {
  /** Id prefix — derived from the colour, so identical finishes share defs. */
  id: string;
  /** The `<defs>` block this skin's shapes reference. */
  defs: string;
  /** Flat fill used behind the bevels (and for a degenerate band). */
  base: string;
  grain: boolean;
}

/** Filter ids for grained faces, keyed by which way the grain runs. */
interface Grain {
  h?: string;
  v?: string;
}

function buildSkin(baseIn: string, grain: boolean): Skin {
  const rgb = parseHex(baseIn);
  const base = rgb ? toHex(rgb) : PROFILE_FILL;
  const id = `w${base.slice(1)}${grain ? "g" : ""}`;
  const bead = lighten(base, 0.12);
  const cill = darken(base, 0.1);

  const defs = `<defs>
    ${bevelGradients(id, base)}
    ${bevelGradients(`${id}-bd`, bead)}
    ${bevelGradients(`${id}-cl`, cill)}
    <linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f4f8fb"/>
      <stop offset="0.42" stop-color="#dbe7f0"/>
      <stop offset="0.44" stop-color="#eaf2f7"/>
      <stop offset="1" stop-color="#c6d6e2"/>
    </linearGradient>
    <filter id="${id}-shadow" x="-15%" y="-12%" width="130%" height="135%">
      <feDropShadow dx="0" dy="9" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.18"/>
    </filter>${grain ? `\n    ${grainFilter(`${id}-grainH`, "0.004 0.24")}\n    ${grainFilter(`${id}-grainV`, "0.24 0.004")}` : ""}
  </defs>`;

  return { id, defs, base, grain };
}

/**
 * Four gradients — one per face of a mitred ring. The offsets run from the
 * face's OUTER edge to its inner edge for the top and left faces, and from the
 * inner edge outwards for the bottom and right ones (that is simply how each
 * trapezoid's bounding box is oriented), so a single light direction produces
 * a bright head, a shaded cill rail and two intermediate jambs. The doubled
 * stop near the middle is the moulding step.
 */
function bevelGradients(prefix: string, base: string): string {
  const grad = (id: string, horizontal: boolean, stops: [number, string][]): string =>
    `<linearGradient id="${id}" x1="0" y1="0" x2="${horizontal ? 1 : 0}" y2="${horizontal ? 0 : 1}">` +
    stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("") +
    `</linearGradient>`;
  return [
    grad(`${prefix}-t`, false, [
      [0, lighten(base, 0.34)],
      [0.46, lighten(base, 0.12)],
      [0.5, lighten(base, 0.26)],
      [1, lighten(base, 0.02)],
    ]),
    grad(`${prefix}-b`, false, [
      [0, darken(base, 0.03)],
      [0.46, darken(base, 0.2)],
      [0.5, darken(base, 0.08)],
      [1, darken(base, 0.28)],
    ]),
    grad(`${prefix}-l`, true, [
      [0, lighten(base, 0.22)],
      [0.46, lighten(base, 0.03)],
      [0.5, lighten(base, 0.16)],
      [1, darken(base, 0.05)],
    ]),
    grad(`${prefix}-r`, true, [
      [0, darken(base, 0.05)],
      [0.46, darken(base, 0.18)],
      [0.5, darken(base, 0.06)],
      [1, darken(base, 0.22)],
    ]),
  ].join("\n    ");
}

/** Procedural woodgrain: streaky noise tinted brown and clipped to the shape. */
function grainFilter(id: string, baseFrequency: string): string {
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="${baseFrequency}" numOctaves="4" seed="11" result="noise"/>
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.15  0 0 0 0 0.08  0 0 0 0 0.03  0 0 0 0.4 0" result="tint"/>
      <feComposite in="tint" in2="SourceGraphic" operator="atop"/>
    </filter>`;
}

/** The whole drawing in the realistic style, in painter's order. */
function realisticBody(geometry: SolvedGeometry, skin: Skin): string[] {
  const out: string[] = [];
  const grain: Grain = skin.grain ? { h: `${skin.id}-grainH`, v: `${skin.id}-grainV` } : {};

  // The daylight starts as one sheet of glass; every profile is painted over it.
  out.push(glassPane(geometry.rootDaylight, skin));

  // Outer frame ring + the unit's own edge.
  out.push(...bandFaces(geometry.outer, geometry.rootDaylight, skin.id, grain, skin.base));
  out.push(outline(geometry.outer, REALISTIC_EDGE, 1.4));

  for (const t of geometry.transoms) out.push(...barFaces(t.rect, "h", skin, grain));
  for (const m of geometry.mullions) out.push(...barFaces(m.rect, "v", skin, grain));

  for (const c of geometry.cells) {
    if (c.sashOuter && c.sashInner) {
      // Flood the leaf first: whatever the bead and pane do not cover stays
      // profile, which is what carries a French leaf's midrail area (its lower
      // pane arrives as its own cell) — the same layering the flat style uses.
      out.push(fill(c.sashOuter, skin.base));
      out.push(...bandFaces(c.sashOuter, c.sashInner, skin.id, grain, skin.base));
      out.push(outline(c.sashOuter, REALISTIC_SEAM, 1));
      out.push(...beadAndGlass(c.sashInner, c.glassRect, skin, grain));
    } else if (c.content === "fixed") {
      // A fixed pane's bead is the ring between its daylight and the glass.
      out.push(...beadAndGlass(c.daylight ?? c.outer, c.glassRect, skin, grain));
    } else if (c.glassRect) {
      // A glazing-only pane of a leaf (French midrail): the leaf already drew
      // the surrounding profile, so inventing a second ring here would double it.
      out.push(glassPane(c.glassRect, skin));
    }

    const symbol = openingSymbol(c, geometry.outer, REALISTIC_SYMBOL);
    if (symbol) out.push(symbol);
  }

  return out;
}

/** The bead ring around a pane, then the pane itself. */
function beadAndGlass(around: Rect, glass: Rect | undefined, skin: Skin, grain: Grain): string[] {
  if (!glass || glass.w <= 0 || glass.h <= 0) return [];
  return [...bandFaces(around, glass, `${skin.id}-bd`, grain, lighten(skin.base, 0.12)), glassPane(glass, skin)];
}

/**
 * The four mitred faces tiling the ring between `outer` and `inner`. Their
 * shared edges ARE the corner mitres, so no separate mitre line is needed. A
 * side with no thickness is skipped; a degenerate ring falls back to a flat fill.
 */
function bandFaces(outer: Rect, inner: Rect, prefix: string, grain: Grain, base: string): string[] {
  if (inner.w <= 0 || inner.h <= 0 || inner.w >= outer.w + 1e-6 || inner.h >= outer.h + 1e-6) {
    return inner.w >= outer.w && inner.h >= outer.h ? [] : [fill(outer, base)];
  }
  const x0 = outer.x;
  const y0 = outer.y;
  const x1 = outer.x + outer.w;
  const y1 = outer.y + outer.h;
  const ix0 = inner.x;
  const iy0 = inner.y;
  const ix1 = inner.x + inner.w;
  const iy1 = inner.y + inner.h;

  const out: string[] = [];
  if (iy0 > y0) out.push(polygon([[x0, y0], [x1, y0], [ix1, iy0], [ix0, iy0]], `url(#${prefix}-t)`, grain.h));
  if (y1 > iy1) out.push(polygon([[x0, y1], [ix0, iy1], [ix1, iy1], [x1, y1]], `url(#${prefix}-b)`, grain.h));
  if (ix0 > x0) out.push(polygon([[x0, y0], [ix0, iy0], [ix0, iy1], [x0, y1]], `url(#${prefix}-l)`, grain.v));
  if (x1 > ix1) out.push(polygon([[x1, y0], [x1, y1], [ix1, iy1], [ix1, iy0]], `url(#${prefix}-r)`, grain.v));
  return out;
}

/** A transom/mullion: a flat centre with a bevel down its two long edges. */
function barFaces(r: Rect, axis: "h" | "v", skin: Skin, grain: Grain): string[] {
  const inset = Math.min(r.w, r.h) * 0.34;
  const inner: Rect =
    axis === "h"
      ? { x: r.x, y: r.y + inset, w: r.w, h: Math.max(0, r.h - 2 * inset) }
      : { x: r.x + inset, y: r.y, w: Math.max(0, r.w - 2 * inset), h: r.h };
  return [
    fill(r, skin.base),
    ...bandFaces(r, inner, skin.id, grain, skin.base),
    outline(r, REALISTIC_SEAM, 0.8),
  ];
}

/** The cill slab: a bevelled bar with a shaded front lip. */
function realisticCill(r: Rect, skin: Skin): string[] {
  const grain: Grain = skin.grain ? { h: `${skin.id}-grainH`, v: `${skin.id}-grainV` } : {};
  const inner: Rect = { x: r.x, y: r.y + r.h * 0.3, w: r.w, h: r.h * 0.4 };
  return [
    fill(r, darken(skin.base, 0.1)),
    ...bandFaces(r, inner, `${skin.id}-cl`, grain, darken(skin.base, 0.1)),
    outline(r, REALISTIC_EDGE, 1.2),
  ];
}

/**
 * A glazed pane: the tinted unit, two diagonal reflection bands (both sized to
 * sit wholly inside the pane, so no clip path is needed) and a rebate line.
 */
function glassPane(r: Rect, skin: Skin): string {
  if (r.w <= 0 || r.h <= 0) return "";
  const band = (from: number, width: number, opacity: number): string => {
    const skew = r.w * 0.18;
    const x = r.x + r.w * from;
    return polygonOpacity(
      [
        [clampNum(x, r.x, r.x + r.w), r.y + r.h],
        [clampNum(x + skew, r.x, r.x + r.w), r.y],
        [clampNum(x + skew + r.w * width, r.x, r.x + r.w), r.y],
        [clampNum(x + r.w * width, r.x, r.x + r.w), r.y + r.h],
      ],
      "#ffffff",
      opacity,
    );
  };
  return [
    `<rect x="${num(r.x)}" y="${num(r.y)}" width="${num(r.w)}" height="${num(r.h)}" fill="url(#${skin.id}-glass)"/>`,
    band(0.05, 0.16, 0.17),
    band(0.3, 0.07, 0.1),
    outline(r, REALISTIC_SEAM, 1),
  ].join("\n  ");
}

function polygon(points: number[][], fillValue: string, filterId?: string): string {
  const pts = points.map(([x, y]) => `${num(x)},${num(y)}`).join(" ");
  return `<polygon points="${pts}" fill="${fillValue}" stroke="${REALISTIC_SEAM}" stroke-width="0.5"${
    filterId ? ` filter="url(#${filterId})"` : ""
  }/>`;
}

function polygonOpacity(points: number[][], fillValue: string, opacity: number): string {
  const pts = points.map(([x, y]) => `${num(x)},${num(y)}`).join(" ");
  return `<polygon points="${pts}" fill="${fillValue}" opacity="${opacity}"/>`;
}

function fill(r: Rect, colour: string): string {
  return `<rect x="${num(r.x)}" y="${num(r.y)}" width="${num(r.w)}" height="${num(r.h)}" fill="${colour}"/>`;
}

function outline(r: Rect, stroke: string, width: number): string {
  return `<rect x="${num(r.x)}" y="${num(r.y)}" width="${num(r.w)}" height="${num(r.h)}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`;
}

// ---- colour maths (pure; used only by the realistic style) -----------

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const s = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((v) => clampNum(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(hex: string, toward: [number, number, number], amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex([
    rgb[0] + (toward[0] - rgb[0]) * amount,
    rgb[1] + (toward[1] - rgb[1]) * amount,
    rgb[2] + (toward[2] - rgb[2]) * amount,
  ]);
}

function lighten(hex: string, amount: number): string {
  return mixHex(hex, [255, 255, 255], amount);
}

function darken(hex: string, amount: number): string {
  return mixHex(hex, [0, 0, 0], amount);
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

// ---------------------------------------------------------------------
// Internal view — handle glyphs
// ---------------------------------------------------------------------

/**
 * Which edge of an opening sash carries the handle: always the closing edge,
 * i.e. the one opposite the hinge the opening chevron already points at. A
 * family whose hinge edge isn't encoded gets NO handle rather than a guessed
 * one — sliding panels are the case in point: the catalog gives each sliding
 * panel a handle but records no stile for it.
 */
function handleSide(c: SolvedCell, outer: Rect): "left" | "right" | "top" | "bottom" | null {
  switch (c.content) {
    case "casement-top":
      return "bottom"; // hinge at the head ⇒ handle on the bottom rail
    case "casement-side-left":
    case "door-left":
    case "tilt-turn": // turn hinge is on the left; the tilt hinge is the bottom rail
      return "right";
    case "casement-side-right":
    case "door-right":
      return "left";
    // French leaves hinge on their OUTER jamb, so the handle is on the meeting
    // (stulp) side — the same positional rule the chevron uses.
    case "french-door-master":
    case "french-door-slave": {
      const b = c.sashOuter ?? c.outer;
      return b.x + b.w / 2 < outer.x + outer.w / 2 ? "right" : "left";
    }
    default:
      return null;
  }
}

/**
 * Stylised handle markers for the internal elevation (a lever bar + rose on the
 * closing stile/rail) — a symbol, not hardware art, and purely visual: it is
 * derived from the sash ring rects and feeds no cut, BOM or price line.
 */
function handleLayer(geometry: SolvedGeometry, mirror: (r: Rect) => Rect): string {
  const parts: string[] = [];
  for (const c of geometry.cells) {
    if (!c.sashOuter || !c.sashInner) continue;
    const side = handleSide(c, geometry.outer);
    if (!side) continue;
    const outerR = c.sashOuter;
    const innerR = c.sashInner;
    const vertical = side === "left" || side === "right";
    // Centre of the closing stile / rail (between the sash's outer and inner edge).
    const cx =
      side === "right"
        ? (innerR.x + innerR.w + outerR.x + outerR.w) / 2
        : side === "left"
          ? (outerR.x + innerR.x) / 2
          : outerR.x + outerR.w / 2;
    const cy =
      side === "bottom"
        ? (innerR.y + innerR.h + outerR.y + outerR.h) / 2
        : side === "top"
          ? (outerR.y + innerR.y) / 2
          : outerR.y + outerR.h / 2;

    // The stile/rail the handle is mounted on bounds the glyph: the rose never
    // spills onto the glass or off the sash.
    const stile =
      side === "right"
        ? outerR.x + outerR.w - (innerR.x + innerR.w)
        : side === "left"
          ? innerR.x - outerR.x
          : side === "bottom"
            ? outerR.y + outerR.h - (innerR.y + innerR.h)
            : innerR.y - outerR.y;
    const span = vertical ? outerR.h : outerR.w;
    const lever = clampNum(span * 0.22, 60, 260);
    const thick = Math.min(clampNum(lever * 0.22, 12, 44), Math.max(4, stile * 0.7));
    const rose = thick * 0.7; // half-side of the mounting plate
    const bar: Rect = vertical
      ? { x: cx - thick / 2, y: cy - lever / 2, w: thick, h: lever }
      : { x: cx - lever / 2, y: cy - thick / 2, w: lever, h: thick };
    const plate: Rect = { x: cx - rose, y: cy - rose, w: rose * 2, h: rose * 2 };
    parts.push(roundedRect(mirror(plate), thick * 0.4));
    parts.push(roundedRect(mirror(bar), thick * 0.4));
  }
  if (!parts.length) return "";
  return `<g id="handles" fill="${HANDLE_FILL}" stroke="${STROKE}" stroke-width="1">
    ${parts.join("\n    ")}
  </g>`;
}

function roundedRect(r: Rect, radius: number): string {
  return `<rect x="${num(r.x)}" y="${num(r.y)}" width="${num(r.w)}" height="${num(r.h)}" rx="${num(radius)}"/>`;
}

// ---------------------------------------------------------------------
// Schematic view — annotations
// ---------------------------------------------------------------------

/**
 * The technical drawing's numbers. EVERY value is read off a rect the engine
 * already solved:
 *   • frame face  = the gap between `outer` and `rootDaylight` on that side
 *   • divider face = the transom's rect.h / the mullion's rect.w
 *   • sash face   = the gap between `sashOuter` and `sashInner`
 *   • glass size  = `glassRect`, rounded to 1 dp exactly as `emitGlass` does
 *     in bars.ts, so a schematic label and its cutting-list row are the SAME
 *     number by construction.
 * Collision handling is deliberately simple: a label shrinks to fit its own
 * rect down to a floor, and below that it is dropped rather than overprinted.
 */
function annotationLayer(
  geometry: SolvedGeometry,
  opts: SchematicOpts,
  mirror: (r: Rect) => Rect,
): string {
  const showFaces = opts.faceWidths !== false;
  const showGlass = opts.glassSizes !== false;
  const { outer, rootDaylight: day } = geometry;
  const base = clampNum(Math.min(outer.w, outer.h) * 0.028, 18, 60);
  const parts: string[] = [];

  /** Centre a label in `r`; `across` is the thickness the text must fit into. */
  const put = (r: Rect, text: string, across: number, rotate = false) => {
    const fit = fitFontSize(text, base, rotate ? r.h : r.w, across);
    if (!fit) return;
    const m = mirror(r);
    const cx = m.x + m.w / 2;
    const cy = m.y + m.h / 2;
    parts.push(label(cx, cy, text, fit, rotate));
  };

  if (showFaces) {
    const faces: { r: Rect; v: number; rot: boolean }[] = [
      { r: { x: outer.x, y: outer.y, w: outer.w, h: day.y - outer.y }, v: day.y - outer.y, rot: false },
      {
        r: { x: outer.x, y: day.y + day.h, w: outer.w, h: outer.y + outer.h - (day.y + day.h) },
        v: outer.y + outer.h - (day.y + day.h),
        rot: false,
      },
      { r: { x: outer.x, y: day.y, w: day.x - outer.x, h: day.h }, v: day.x - outer.x, rot: true },
      {
        r: { x: day.x + day.w, y: day.y, w: outer.x + outer.w - (day.x + day.w), h: day.h },
        v: outer.x + outer.w - (day.x + day.w),
        rot: true,
      },
    ];
    for (const f of faces) {
      if (f.v <= 0) continue;
      put(f.r, String(num(f.v)), f.rot ? f.r.w : f.r.h, f.rot);
    }

    for (const t of geometry.transoms) put(t.rect, String(num(t.rect.h)), t.rect.h, false);
    for (const m of geometry.mullions) put(m.rect, String(num(m.rect.w)), m.rect.w, true);

    // Sash ring face — annotated on the sash's top rail (the "overlap figure at
    // the junction" between a leaf and whatever it closes against).
    for (const c of geometry.cells) {
      if (!c.sashOuter || !c.sashInner) continue;
      const face = c.sashInner.y - c.sashOuter.y;
      if (face <= 0) continue;
      put({ x: c.sashOuter.x, y: c.sashOuter.y, w: c.sashOuter.w, h: face }, String(num(face)), face, false);
    }
  }

  if (showGlass) {
    for (const c of geometry.cells) {
      const g = c.glassRect;
      if (!g || g.w <= 0 || g.h <= 0) continue;
      put(g, `${round1(g.w)} × ${round1(g.h)}`, g.h, false);
    }
  }

  if (!parts.length) return "";
  return `<g id="schematic" fill="${ANNOTATION_FILL}" font-family="ui-sans-serif, system-ui, sans-serif" text-anchor="middle">
    ${parts.join("\n    ")}
  </g>`;
}

function label(cx: number, cy: number, text: string, fontSize: number, rotate: boolean): string {
  const transform = rotate ? ` transform="rotate(-90 ${num(cx)} ${num(cy)})"` : "";
  return `<text x="${num(cx)}" y="${num(cy)}" font-size="${num(fontSize)}" dominant-baseline="central"${transform}>${text}</text>`;
}

/**
 * Largest font size (down to 55% of `base`) at which `text` fits `along` mm of
 * run and `across` mm of thickness; undefined ⇒ don't draw it at all. The width
 * estimate (0.58 em per character) is deliberately crude — this is a label
 * placement heuristic, not a typesetter.
 */
function fitFontSize(text: string, base: number, along: number, across: number): number | undefined {
  const byThickness = Math.min(base, across * 0.7);
  const byRun = (along * 0.92) / (text.length * 0.58);
  const size = Math.min(byThickness, byRun);
  return size >= base * 0.55 ? size : undefined;
}

function clampNum(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
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
function openingSymbol(c: SolvedCell, outer: Rect, stroke: string = SYMBOL_STROKE): string | null {
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
      return `<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="${num(sw)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("\n  ");
}

function rect(r: Rect, fill: string, stroke: string, strokeWidth = 1): string {
  return `<rect x="${num(r.x)}" y="${num(r.y)}" width="${num(r.w)}" height="${num(r.h)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
}

function num(n: number): number {
  return Math.round(n * 100) / 100;
}
