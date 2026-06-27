// =====================================================================
// engine/solve.ts — the main entry point of the engine.
//
// One call. One input. One full quote.
//
//   const quote = solve({ designId, widthMm, heightMm, systemId, customer, orderNo });
//
// =====================================================================

import type { CellNode, QuoteInput, QuoteOutput, Settings } from "../types.ts";
import { getSystem, getDesign, DEFAULT_SETTINGS } from "../catalog/index.ts";
import { solveTopology } from "./topology.ts";
import { computeParts } from "./bars.ts";
import { computeHardware } from "./hardware.ts";
import { planCuts } from "./cutting.ts";
import { computePricing } from "./pricing.ts";
import { renderSvg } from "./svg.ts";
import { applyOverrides } from "./overrides.ts";
import { renderWorkOrder, renderCuttingList, renderBom, renderPriceSummary } from "./documents.ts";

export function solve(input: QuoteInput): QuoteOutput {
  const baseSystem = getSystem(input.systemId);
  if (!baseSystem) throw new Error(`Unknown system: ${input.systemId}`);

  const baseDesign = getDesign(input.designId);
  if (!baseDesign) throw new Error(`Unknown design: ${input.designId}`);

  const settings: Settings = { ...DEFAULT_SETTINGS, ...(input.settings ?? {}) };

  // Custom mode: apply per-quote allowance overrides onto a cloned system.
  // Default mode (no overrides) leaves the catalog system byte-identical.
  let system =
    input.mode === "custom"
      ? applyOverrides(baseSystem, input.overrides)
      : baseSystem;

  // Per-quote colour selection (U3). Clone the system with the chosen colour so
  // computePricing applies its uplift. Omitted (or == default) ⇒ no clone, so
  // the quote stays byte-identical to pre-U3 (and the 157 assertions hold).
  if (input.colourKey && input.colourKey !== system.defaultColourKey) {
    if (!system.colours?.[input.colourKey]) throw new Error(`Unknown colour: ${input.colourKey}`);
    system = { ...system, defaultColourKey: input.colourKey };
  }

  // Per-quote glass selection (U3). Fill the chosen glass into every cell that
  // doesn't pin its own glass. Omitted ⇒ design's baked default (byte-identical).
  let design = baseDesign;
  if (input.glassKey) {
    if (!system.glass?.[input.glassKey]) throw new Error(`Unknown glass: ${input.glassKey}`);
    design = { ...baseDesign, topology: fillDefaultGlass(baseDesign.topology, input.glassKey) };
  }

  // 1. Topology — solve geometry
  const geometry = solveTopology(design, input.widthMm, input.heightMm, system);

  // 2. Bars — derive cut pieces, glass, gaskets
  const parts = computeParts(geometry, design, system, input.widthMm, input.heightMm, settings.weldAllowanceMm ?? 0);

  // 3. Hardware — allocate per cell
  parts.hardware = computeHardware(geometry, system);

  // 4. Cutting plan
  const cuttingPlan = planCuts(parts, system);

  // 5. Pricing
  const pricing = computePricing(parts, cuttingPlan, geometry, system, settings);

  // 6. SVG preview
  const svg = renderSvg(geometry);

  // 7. Documents — every doc carries the design preview at the *modified*
  // (chosen W×H) dimensions, so the paperwork shows what was actually quoted.
  const images = [
    { svg, caption: `${design.name} — ${input.widthMm} × ${input.heightMm} mm` },
  ];
  const documents = {
    workOrder:    renderWorkOrder(input, system.name, design.name, parts, settings.branding, images),
    cuttingList:  renderCuttingList(input, system.name, design.name, parts, settings.branding, images),
    bom:          renderBom(input, system.name, design.name, pricing, settings.branding, images),
    priceSummary: renderPriceSummary(input, system.name, design.name, pricing, settings.branding, images),
  };

  return {
    input,
    systemName: system.name,
    designName: design.name,
    geometry: {
      outer: geometry.outer,
      cells: geometry.cells,
      transoms: geometry.transoms,
      mullions: geometry.mullions,
      svg,
    },
    parts,
    cuttingPlan,
    pricing,
    documents,
  };
}

/**
 * Returns a clone of the cell tree where every leaf that doesn't already pin
 * its own glass is glazed with `glassKey` (per-quote glass selection, U3). A
 * leaf with an explicit `cell.glassKey` is left untouched. Pure; the input tree
 * is not mutated.
 */
function fillDefaultGlass(node: CellNode, glassKey: string): CellNode {
  if (node.kind === "leaf") {
    return node.cell.glassKey ? node : { kind: "leaf", cell: { ...node.cell, glassKey } };
  }
  if (node.kind === "hsplit") {
    return { ...node, top: fillDefaultGlass(node.top, glassKey), bottom: fillDefaultGlass(node.bottom, glassKey) };
  }
  return { ...node, left: fillDefaultGlass(node.left, glassKey), right: fillDefaultGlass(node.right, glassKey) };
}
