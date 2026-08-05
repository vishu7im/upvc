// =====================================================================
// designer/adapters/shared.ts — the parts of the adapter contract that are
// NOT family-specific.
//
// Extracted when the sliding adapter arrived. Three things turned out to be
// true of every family, whatever its topology model:
//
//   • the OUTER FRAME edges are the four strips between `outer` and
//     `rootDaylight` — a projection of solved geometry that knows nothing
//     about cells, panels or dividers;
//   • so is the CILL, when one is fitted;
//   • `toQuoteInput` maps resolved effects onto `QuoteInput` slots and passes
//     the working topology through `topologyOverride`. It touches the topology
//     only as an opaque value.
//
// Copying them into each adapter would mean a new engine slot (the next
// `addons`-shaped field) had to be remembered in n places. Keeping them here
// means an adapter implements only what is genuinely different: how its
// topology is EDITED and how its interior is ENUMERATED.
//
// PURE — projections and object construction only.
// =====================================================================

import type {
  CellNode,
  Design,
  QuoteInput,
  QuoteView,
  Rect,
  SolvedGeometry,
} from "../../types.ts";
import type { ComponentRef, EngineEffectOutputs, LineItemDraft } from "../line-item-types.ts";

/**
 * The four outer-frame edges: the strips between the unit's outer rect and the
 * root daylight. Identical for every family — a frame is a frame.
 */
export function frameEdgeComponents(geometry: SolvedGeometry): ComponentRef[] {
  const { outer, rootDaylight: day } = geometry;
  const edges: { side: string; rect: Rect }[] = [
    { side: "top", rect: { x: 0, y: 0, w: outer.w, h: day.y } },
    { side: "bottom", rect: { x: 0, y: day.y + day.h, w: outer.w, h: outer.h - day.y - day.h } },
    { side: "left", rect: { x: 0, y: day.y, w: day.x, h: day.h } },
    { side: "right", rect: { x: day.x + day.w, y: day.y, w: outer.w - day.x - day.w, h: day.h } },
  ];
  return edges.map((e) => ({
    componentId: `edge:${e.side}`,
    type: "frame-edge",
    label: `Frame ${e.side}`,
    rect: e.rect,
    path: e.side,
  }));
}

/** The fitted cill, when the quote has one. */
export function cillComponent(geometry: SolvedGeometry): ComponentRef | undefined {
  if (!geometry.cill) return undefined;
  return {
    componentId: "cill",
    type: "cill",
    label: geometry.cill.name,
    rect: geometry.cill.rect,
    path: "cill",
  };
}

/**
 * Resolved effects → `QuoteInput`. Every field is omitted when its effect is
 * absent, which is what makes a defaults-only draft reproduce a bare `solve()`:
 * the engine's clone-on-override slots (glass, colour, cill, frame, add-ons,
 * hardware, topology) only clone when actually passed.
 */
export function toQuoteInput(args: {
  draft: LineItemDraft;
  design: Design;
  workingTopology: CellNode;
  topologyEdited: boolean;
  effects: EngineEffectOutputs;
  splitRatios?: Record<string, number>;
  views?: QuoteView[];
  svgStyle?: QuoteInput["svgStyle"];
}): QuoteInput {
  const { draft, workingTopology, topologyEdited, effects, splitRatios, views, svgStyle } = args;
  return {
    orderNo: "DESIGNER",
    customer: "Designer",
    designId: draft.designId,
    widthMm: draft.dimensions.widthMm,
    heightMm: draft.dimensions.heightMm,
    systemId: draft.systemId,
    ...(splitRatios && Object.keys(splitRatios).length ? { splitRatios } : {}),
    ...(effects.glassKey ? { glassKey: effects.glassKey } : {}),
    ...(effects.colourKey ? { colourKey: effects.colourKey } : {}),
    ...(effects.colourKeyOutside ? { colourKeyOutside: effects.colourKeyOutside } : {}),
    ...(effects.cillKey ? { cillKey: effects.cillKey } : {}),
    ...(effects.frameKey ? { frameKey: effects.frameKey } : {}),
    ...(effects.frameKeys && Object.keys(effects.frameKeys).length ? { frameKeys: effects.frameKeys } : {}),
    ...(effects.addons && Object.keys(effects.addons).length ? { addons: effects.addons } : {}),
    ...(effects.hardwareOverrides && Object.keys(effects.hardwareOverrides).length
      ? { hardwareOverrides: effects.hardwareOverrides }
      : {}),
    ...(effects.doorOpeningDirection ? { doorOpeningDirection: effects.doorOpeningDirection } : {}),
    ...(topologyEdited ? { topologyOverride: workingTopology } : {}),
    ...(views?.length ? { views } : {}),
    ...(svgStyle ? { svgStyle } : {}),
  };
}
