// =====================================================================
// catalog/glyphs.ts — a picture for every hardware choice.
//
// The reference configurator shows a photograph beside each handle, cylinder
// and hinge (collections/doors/WhatsApp Image 2026-07-30 at 4.01.39 PM (3)…(7)).
// In its payload those are third-party CDN JPEGs
// (`media.bm-touch.co.uk/...`, see collections/doors/lineitems.json) — the only
// SVG in that file is the window elevation, not hardware. So the artwork has to
// be ours.
//
// This module draws one, deterministically, from data the catalog already has:
// the part's `financialCategory` picks the SHAPE and its name picks the STYLE
// and FINISH via the very same chips the pickers filter by
// (`options/hardware-filters.ts`, derived from the supplier's own naming). So
// all 128 stock rows get a picture on day one, with nothing to host and nothing
// to license.
//
// This is a DRAWING, not hardware art and not a fabrication input: it feeds no
// cut, no BOM line and no price. An admin can upload a real product photo,
// which overrides the glyph for that part (see `src/api/catalog.ts`).
//
// PURE: no I/O, no clock, no randomness. The same part always yields the same
// bytes, which is what makes the asset route cacheable.
// =====================================================================

import type { HardwareItem } from "../types.ts";
import {
  CASEMENT_STYLE_FILTERS,
  DOOR_STYLE_FILTERS,
  FINISH_FILTERS,
  filterKeysFor,
} from "./options/hardware-filters.ts";

/** Canvas the glyphs are drawn on; the viewBox every one of them declares. */
const SIZE = 96;

/**
 * A finish's two-stop metal ramp: [highlight, shadow]. Keyed by the SAME chip
 * keys the pickers filter by, so a finish that earns a chip is a finish that
 * gets its colour — one source of truth, no second list of finish names.
 * A finish with no entry falls back to the neutral ramp.
 */
const FINISH_RAMP: Record<string, [string, string]> = {
  "fin-white": ["#ffffff", "#c9ced6"],
  "fin-black": ["#5a5f66", "#1b1e22"],
  "fin-antique-black": ["#4a4640", "#1a1815"],
  "fin-chrome": ["#f4f7fa", "#8b95a1"],
  "fin-silver": ["#eceff3", "#98a0aa"],
  "fin-stainless": ["#e3e7ea", "#8d959c"],
  "fin-satin": ["#dfe3e6", "#9aa1a8"],
  "fin-nickel": ["#e8ebef", "#909aa5"],
  "fin-gold": ["#ffe9a3", "#b8892a"],
  "fin-brass": ["#f6dd94", "#a8791d"],
  "fin-bronze": ["#e0a877", "#7d4a22"],
  "fin-antique-bronze": ["#b08a63", "#4f3721"],
  "fin-brown": ["#a57550", "#4e3520"],
  "fin-graphite": ["#7c8288", "#33383d"],
};
const NEUTRAL_RAMP: [string, string] = ["#e9edf1", "#98a1ab"];

/** The shapes this module knows how to draw. */
export type GlyphShape =
  | "door-handle-lever-lever"
  | "door-handle-lever-lever-long"
  | "door-handle-lever-pad"
  | "door-handle-lever-pad-long"
  | "door-handle-bar"
  | "casement-handle-inline"
  | "casement-handle-cranked"
  | "casement-handle-monkeytail"
  | "cylinder"
  | "cylinder-thumbturn"
  | "hinge-flag"
  | "hinge-butt"
  | "lock"
  | "keep"
  | "generic";

/**
 * Which shape a part draws as. Category first (it is catalog data), then the
 * supplier's own style wording. An unrecognised part draws the "generic"
 * fitting rather than throwing — a picker must never fail because a new part
 * arrived with unfamiliar wording.
 */
export function glyphShapeFor(part: Pick<HardwareItem, "name" | "financialCategory">): GlyphShape {
  const name = part.name;
  switch (part.financialCategory) {
    case "Door Handle": {
      if (/\bbar handle\b/i.test(name)) return "door-handle-bar";
      // The supplier names the backplate length, and it is the most visible
      // difference between two otherwise identical handles.
      const long = /\blong backplate\b/i.test(name);
      if (/lever\/pad/i.test(name)) return long ? "door-handle-lever-pad-long" : "door-handle-lever-pad";
      return long ? "door-handle-lever-lever-long" : "door-handle-lever-lever";
    }
    case "Casement Handles":
      if (/\bcranked\b/i.test(name)) return "casement-handle-cranked";
      if (/\bmonkeytail\b/i.test(name)) return "casement-handle-monkeytail";
      return "casement-handle-inline";
    case "Cylinders":
      return /\bthumb ?turn\b/i.test(name) ? "cylinder-thumbturn" : "cylinder";
    case "Door Hinge":
      return /\bflag\b/i.test(name) ? "hinge-flag" : "hinge-butt";
    case "Door Lock":
      return /\bkeep\b/i.test(name) ? "keep" : "lock";
    default:
      return "generic";
  }
}

/** The finish chip a part earns, or "" when its name names no known finish. */
export function glyphFinishFor(part: Pick<HardwareItem, "name">): string {
  return filterKeysFor(part.name, [FINISH_FILTERS])[0] ?? "";
}

/**
 * A self-contained SVG for one hardware part. Square, viewBox-only (no width /
 * height), so a caller sizes it with CSS.
 */
export function hardwareGlyph(part: Pick<HardwareItem, "name" | "financialCategory">): string {
  const shape = glyphShapeFor(part);
  const finish = glyphFinishFor(part);
  const [light, dark] = FINISH_RAMP[finish] ?? NEUTRAL_RAMP;
  // Deterministic gradient id, so two glyphs on one page cannot collide and the
  // same part always serialises to the same bytes.
  const id = `g-${shape}-${finish || "plain"}`;

  const defs =
    `<defs>` +
    `<linearGradient id="${id}" x1="0" y1="0" x2="0.35" y2="1">` +
    `<stop offset="0%" stop-color="${light}"/>` +
    `<stop offset="55%" stop-color="${mix(light, dark)}"/>` +
    `<stop offset="100%" stop-color="${dark}"/>` +
    `</linearGradient>` +
    `</defs>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" role="img" ` +
    `aria-label="${escapeXml(part.name)}">` +
    defs +
    `<g fill="url(#${id})" stroke="${dark}" stroke-width="1.1" stroke-linejoin="round">` +
    body(shape) +
    `</g>` +
    `</svg>`
  );
}

/** The shape itself, on the 96×96 canvas. Coordinates are drawing-only. */
function body(shape: GlyphShape): string {
  switch (shape) {
    // Two levers on one backplate; the plate's length is the named difference.
    case "door-handle-lever-lever":
      return plate(40, 22, 16, 52, 8) + lever(48, 34, -1) + lever(48, 62, 1) + keyhole(48, 48);
    case "door-handle-lever-lever-long":
      return plate(40, 8, 16, 80, 8) + lever(48, 26, -1) + lever(48, 70, 1) + keyhole(48, 48);
    // Lever above, fixed pull PAD below — the pad is a stub, not a second arm.
    case "door-handle-lever-pad":
      return plate(40, 22, 16, 52, 8) + lever(48, 34, -1) + pad(48, 62) + keyhole(48, 48);
    case "door-handle-lever-pad-long":
      return plate(40, 8, 16, 80, 8) + lever(48, 26, -1) + pad(48, 70) + keyhole(48, 48);
    case "door-handle-bar":
      // A long pull bar on two stand-offs.
      return (
        `<rect x="42" y="8" width="12" height="80" rx="6"/>` +
        `<rect x="26" y="16" width="18" height="9" rx="4"/>` +
        `<rect x="26" y="71" width="18" height="9" rx="4"/>`
      );
    case "casement-handle-inline":
      return plate(36, 26, 24, 44, 10) + `<rect x="52" y="42" width="34" height="11" rx="5"/>`;
    case "casement-handle-cranked":
      // The lever steps away from the plate — that step is the "crank".
      return (
        plate(36, 26, 24, 44, 10) +
        `<path d="M52 47h14l10-10h10v11h-6l-10 10H52z"/>`
      );
    case "casement-handle-monkeytail":
      return (
        plate(36, 26, 24, 44, 10) +
        `<path d="M52 47h22a10 10 0 1 1-6 9" fill="none" stroke-width="9" stroke-linecap="round"/>`
      );
    case "cylinder":
      return euroCylinder() + `<circle cx="48" cy="60" r="7"/>` + keyhole(48, 60);
    case "cylinder-thumbturn":
      return euroCylinder() + `<rect x="43" y="50" width="10" height="22" rx="5"/>`;
    case "hinge-flag":
      // Two knuckles offset by the flag arm — the silhouette that names it.
      return (
        `<rect x="30" y="20" width="18" height="34" rx="5"/>` +
        `<rect x="44" y="42" width="26" height="18" rx="6"/>` +
        `<rect x="56" y="52" width="14" height="26" rx="5"/>`
      );
    case "hinge-butt":
      // Two leaves either side of a barrel.
      return (
        `<rect x="20" y="26" width="26" height="44" rx="4"/>` +
        `<rect x="50" y="26" width="26" height="44" rx="4"/>` +
        `<rect x="44" y="22" width="8" height="52" rx="4"/>`
      );
    case "lock":
      // Lock case with a faceplate down one side.
      return (
        `<rect x="34" y="14" width="34" height="68" rx="4"/>` +
        `<rect x="26" y="10" width="10" height="76" rx="3"/>` +
        `<circle cx="51" cy="40" r="8"/>` +
        `<rect x="46" y="58" width="10" height="16" rx="3"/>`
      );
    case "keep":
      // Strike plate with its two fixing holes.
      return (
        `<rect x="36" y="10" width="24" height="76" rx="4"/>` +
        `<rect x="42" y="34" width="12" height="28" rx="3" fill="none"/>` +
        `<circle cx="48" cy="20" r="3.5" fill="none"/>` +
        `<circle cx="48" cy="76" r="3.5" fill="none"/>`
      );
    case "generic":
      return `<rect x="24" y="24" width="48" height="48" rx="8"/>`;
  }
}

function plate(x: number, y: number, w: number, h: number, r: number): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
}

/**
 * A lever arm reaching away from the plate with a return at its tip; `dir` is
 * −1 for the return pointing up, +1 down. Two mirrored levers on one plate is
 * what makes a "Lever/Lever" handle read as one at thumbnail size.
 */
function lever(x: number, y: number, dir: number): string {
  const arm = `<rect x="${x}" y="${y - 4.5}" width="30" height="9" rx="4.5"/>`;
  const returnY = dir < 0 ? y - 17 : y + 8;
  const tip = `<rect x="${x + 21}" y="${returnY}" width="9" height="14" rx="4.5"/>`;
  return arm + tip;
}

/** The fixed pull of a lever/pad handle: a short stub, clearly not a lever. */
function pad(x: number, y: number): string {
  return `<rect x="${x}" y="${y - 5}" width="13" height="10" rx="5"/>`;
}

function euroCylinder(): string {
  // The euro profile: a round body over a narrower cam housing.
  return `<path d="M48 14a17 17 0 0 1 17 17c0 8-5 12-8 15l3 36H36l3-36c-3-3-8-7-8-15a17 17 0 0 1 17-17z"/>`;
}

function keyhole(cx: number, cy: number): string {
  return `<path d="M${cx} ${cy - 5}a4 4 0 0 1 0 8 4 4 0 0 1 0-8m-2 7h4l1 8h-6z" fill="rgba(20,22,26,0.75)" stroke="none"/>`;
}

/** Midpoint of two #rrggbb colours — the gradient's moulding step. */
function mix(a: string, b: string): string {
  const pa = hex(a);
  const pb = hex(b);
  const c = pa.map((v, i) => Math.round((v + pb[i]) / 2));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function hex(c: string): number[] {
  const s = c.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Kept for symmetry with the pickers' style chips (see hardware-filters.ts). */
export const GLYPH_STYLE_SOURCES = [CASEMENT_STYLE_FILTERS, DOOR_STYLE_FILTERS] as const;
