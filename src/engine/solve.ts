// =====================================================================
// engine/solve.ts — the main entry point of the engine.
//
// One call. One input. One full quote.
//
//   const quote = solve({ designId, widthMm, heightMm, systemId, customer, orderNo });
//
// =====================================================================

import type { CellNode, ColourOption, DocCill, DocColour, QuoteInput, QuoteOutput, Settings } from "../types.ts";
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

  // Per-quote colour selection (U3 + inside/outside finish). `colourKey` is the
  // INSIDE / primary colour; an optional `colourKeyOutside` adds a second finish
  // whose uplift is SUMMED on top (dual-colour). We synthesize ONE combined
  // colour option and point defaultColourKey at it, so computePricing stays
  // unchanged (it reads a single multiplier). Omitted / White+White ⇒ no clone,
  // so the quote stays byte-identical to pre-existing quotes (157 assertions hold).
  if (input.colourKey && !system.colours?.[input.colourKey]) throw new Error(`Unknown colour: ${input.colourKey}`);
  if (input.colourKeyOutside && !system.colours?.[input.colourKeyOutside]) throw new Error(`Unknown colour: ${input.colourKeyOutside}`);
  const insideKey = input.colourKey ?? system.defaultColourKey;
  const insideColour = insideKey ? system.colours?.[insideKey] : undefined;
  // A dual-colour finish only when an explicit, DIFFERENT outside colour is given.
  const dualColour = Boolean(input.colourKeyOutside && input.colourKeyOutside !== insideKey);
  const outsideColour = dualColour ? system.colours?.[input.colourKeyOutside!] : insideColour;

  if (dualColour && insideColour && outsideColour) {
    const combinedKey = `__combined__:${insideColour.key}+${outsideColour.key}`;
    // Tier for per-profile supplier tier prices (M5.5): count coloured sides.
    // Both White ⇒ no tier (byte-identical); one coloured ⇒ 1P; both ⇒ 2P.
    const nonBaseSides = (insideColour.isBase ? 0 : 1) + (outsideColour.isBase ? 0 : 1);
    const combined: ColourOption = {
      key: combinedKey,
      code: `${insideColour.code}/${outsideColour.code}`,
      name: `${insideColour.name} / ${outsideColour.name}`,
      costUpliftPct: insideColour.costUpliftPct + outsideColour.costUpliftPct,
      priceUpliftPct: insideColour.priceUpliftPct + outsideColour.priceUpliftPct,
      isBase: false,
      hex: outsideColour.hex ?? insideColour.hex,
      ...(nonBaseSides === 2 ? { tier: "2p" as const } : nonBaseSides === 1 ? { tier: "1p" as const } : {}),
    };
    system = { ...system, colours: { ...system.colours, [combinedKey]: combined }, defaultColourKey: combinedKey };
  } else if (input.colourKey && input.colourKey !== system.defaultColourKey) {
    system = { ...system, defaultColourKey: input.colourKey };
  }

  // Per-quote glass selection (U3). Fill the chosen glass into every cell that
  // doesn't pin its own glass. Omitted ⇒ design's baked default (byte-identical).
  let design = baseDesign;
  if (input.glassKey) {
    if (!system.glass?.[input.glassKey]) throw new Error(`Unknown glass: ${input.glassKey}`);
    design = { ...baseDesign, topology: fillDefaultGlass(baseDesign.topology, input.glassKey) };
  }

  // Per-quote chamber selection. Swap the design's frame profile (e.g. 5ch→6ch);
  // solveTopology/bars then derive all geometry from the chosen frame's faceWidth.
  // Omitted (or == design default) ⇒ no clone, byte-identical (the 157 assertions hold).
  if (input.frameKey && input.frameKey !== design.frameKey) {
    if (!system.frames[input.frameKey]) throw new Error(`Unknown frame: ${input.frameKey}`);
    design = { ...design, frameKey: input.frameKey };
  }

  // Per-quote internal split overrides (multi-span editing). Re-position each
  // transom/mullion split by its node pathId. Omitted/empty ⇒ design's baked
  // splits, so the quote stays byte-identical (and the 157 assertions hold).
  if (input.splitRatios && Object.keys(input.splitRatios).length) {
    design = { ...design, topology: applySplitRatios(design.topology, input.splitRatios) };
  }

  // Per-quote cill selection. Any cill reduces the MANUFACTURING height by a
  // fixed 30 mm (independent of cill size — spec: "Automatic Cill Height
  // Adjustment"). The customer-entered `input.heightMm` is preserved for display;
  // only `mfgHeightMm` feeds the geometry/cut math. Omitted ⇒ no cill, so the
  // quote is byte-identical to a no-cill quote (the 157 assertions hold).
  const CILL_HEIGHT_DEDUCTION_MM = 30; // fixed, per the cill feature spec
  const cill = input.cillKey ? system.cills?.[input.cillKey] : undefined;
  if (input.cillKey && !cill) throw new Error(`Unknown cill: ${input.cillKey}`);
  const mfgHeightMm = cill ? input.heightMm - CILL_HEIGHT_DEDUCTION_MM : input.heightMm;

  // 1. Topology — solve geometry (at the manufacturing height)
  const geometry = solveTopology(design, input.widthMm, mfgHeightMm, system);

  // Attach the cill as a bar below the frame: full product width, sitting at
  // y = manufacturing height (= geometry.outer.h). svg.ts draws it; bars.ts
  // emits it as a per-metre cut/BOM line.
  if (cill) {
    geometry.cill = {
      rect: { x: 0, y: mfgHeightMm, w: input.widthMm, h: cill.projectionMm },
      code: cill.code,
      name: cill.name,
      projectionMm: cill.projectionMm,
    };
  }

  // 2. Bars — derive cut pieces, glass, gaskets (at the manufacturing height)
  const parts = computeParts(geometry, design, system, input.widthMm, mfgHeightMm, settings.weldAllowanceMm ?? 0);

  // 3. Hardware — allocate per cell
  parts.hardware = computeHardware(geometry, system);

  // 4. Cutting plan
  const cuttingPlan = planCuts(parts, system);

  // 5. Pricing
  const pricing = computePricing(parts, cuttingPlan, geometry, system, settings);

  // 6. SVG preview. Joint overlay + colour tint are purely visual and opt-in;
  // a default quote (no joints, base/no-hex colour) passes no opts ⇒ the SVG is
  // byte-identical to before these features existed.
  const tintInsideHex = insideColour && !insideColour.isBase ? insideColour.hex : undefined;
  const tintOutsideHex = outsideColour && !outsideColour.isBase ? outsideColour.hex : undefined;
  const colourOpts =
    tintInsideHex || tintOutsideHex ? { insideHex: tintInsideHex, outsideHex: tintOutsideHex } : undefined;
  const svgOpts =
    input.showJoints || colourOpts ? { joints: input.showJoints, colour: colourOpts } : undefined;
  const svg = renderSvg(geometry, svgOpts);

  // Colour display for document headers. Only when a non-default finish is in
  // play; absent ⇒ no colour row (byte-identical header for default White).
  const docColour: DocColour | undefined =
    dualColour
      ? { inside: insideColour?.name ?? "—", outside: outsideColour?.name }
      : insideColour && !insideColour.isBase
        ? { inside: insideColour.name }
        : undefined;

  // 7. Documents — every doc carries the design preview at the *modified*
  // (chosen W×H) dimensions, so the paperwork shows what was actually quoted.
  const images = [
    { svg, caption: `${design.name} — ${input.widthMm} × ${input.heightMm} mm` },
  ];
  // Cill display info (customer height stays on "Width × Height"; the header adds
  // the cill name + reduced manufacturing height). Omitted ⇒ no cill rows.
  const docCill: DocCill | undefined = cill
    ? { name: cill.name, manufacturingHeightMm: mfgHeightMm }
    : undefined;
  const documents = {
    workOrder:    renderWorkOrder(input, system.name, design.name, parts, settings.branding, images, "normal", docCill, docColour),
    cuttingList:  renderCuttingList(input, system.name, design.name, parts, settings.branding, images, "normal", docCill, docColour),
    bom:          renderBom(input, system.name, design.name, pricing, settings.branding, images, docCill, docColour),
    priceSummary: renderPriceSummary(input, system.name, design.name, pricing, settings.branding, images, docCill, docColour),
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
      ...(geometry.cill ? { cill: geometry.cill } : {}),
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
  if (node.kind === "sliding") {
    // Sliding rows glaze every panel from the node-level glassKey.
    return node.glassKey ? node : { ...node, glassKey };
  }
  if (node.kind === "hsplit") {
    return { ...node, top: fillDefaultGlass(node.top, glassKey), bottom: fillDefaultGlass(node.bottom, glassKey) };
  }
  return { ...node, left: fillDefaultGlass(node.left, glassKey), right: fillDefaultGlass(node.right, glassKey) };
}

/**
 * Returns a clone of the cell tree where each hsplit/vsplit node's `splitAtRatio`
 * is replaced by an override keyed on the node's pathId ("root", "root.top", …).
 * The path scheme is identical to `solveTopology`'s walk, and matches the
 * `parentPathId` carried on each solved transom/mullion. Values are full-window
 * fractions (clamped defensively to avoid degenerate cells); unknown keys are
 * ignored so a stale UI key can't break a live preview. Pure; never mutates the
 * input tree, and a no-op for any node not addressed by `ratios`.
 */
function applySplitRatios(node: CellNode, ratios: Record<string, number>, pathId = "root"): CellNode {
  if (node.kind === "leaf") return node;
  // Sliding rows: drag-to-resize sets per-panel boundaries via "root.b{i}" keys
  // (n−1 cumulative daylight fractions). No keys present ⇒ equal panels, returned
  // unchanged (byte-identical to the calibrated default).
  if (node.kind === "sliding") {
    const n = node.panels.length;
    const raw: number[] = [];
    let any = false;
    for (let i = 1; i < n; i++) {
      const r = ratios[`${pathId}.b${i}`];
      if (Number.isFinite(r)) any = true;
      raw.push(Number.isFinite(r) ? (r as number) : i / n);
    }
    if (!any) return node;
    return { ...node, boundaries: normalizeBoundaries(raw, n) };
  }
  const override = ratios[pathId];
  const splitAtRatio = Number.isFinite(override)
    ? Math.min(0.98, Math.max(0.02, override))
    : node.splitAtRatio;
  if (node.kind === "hsplit") {
    return {
      ...node,
      splitAtRatio,
      top: applySplitRatios(node.top, ratios, pathId + ".top"),
      bottom: applySplitRatios(node.bottom, ratios, pathId + ".bottom"),
    };
  }
  return {
    ...node,
    splitAtRatio,
    left: applySplitRatios(node.left, ratios, pathId + ".left"),
    right: applySplitRatios(node.right, ratios, pathId + ".right"),
  };
}

/**
 * Clamp n−1 cumulative sliding-panel boundary fractions to be strictly
 * increasing within (0,1) with a minimum panel share, so a drag can never
 * collapse a panel. Left-to-right: each boundary sits ≥ MIN past the previous
 * one and leaves ≥ MIN for every remaining panel.
 */
function normalizeBoundaries(raw: number[], n: number): number[] {
  const MIN = 0.05; // minimum panel fraction of the daylight
  const out: number[] = [];
  let prev = 0;
  for (let i = 0; i < raw.length; i++) {
    const lo = prev + MIN;
    const hi = 1 - (raw.length - i) * MIN; // room for the remaining boundaries + last panel
    let b = Number.isFinite(raw[i]) ? raw[i] : (i + 1) / n;
    b = Math.min(hi, Math.max(lo, b));
    out.push(b);
    prev = b;
  }
  return out;
}
