// =====================================================================
// engine/pricing.ts — quote totals.
//
// Pricing flow:
//   1. For each part on the BOM, compute totalCost = qty × unitCost
//                                 totalPrice = qty × unitPrice
//   2. materialCost = Σ totalCost
//      materialPrice = Σ totalPrice + wastage-on-profiles-&-beads
//   3. labour = base + (perSash × #sashes) + (perDoor × #doors)
//   4. factoryCost = materialPrice + labour
//   5. markup     = factoryCost × markupPct / 100
//   6. netPrice   = factoryCost + markup
//   7. tax        = netPrice × taxPct / 100  (if taxApply)
//   8. grandTotal = netPrice + tax
//
// Note: cost/price values come straight from the catalog. Until you fill
// in supplier prices, totals are £0 — but every line is still computed
// and ready to multiply.
// =====================================================================

import type {
  LineItem,
  Pricing,
  ProfileSystem,
  Settings,
  SolvedParts,
  CuttingPlan,
  SolvedGeometry,
} from "../types.ts";

export function computePricing(
  parts: SolvedParts,
  plan: CuttingPlan,
  geometry: SolvedGeometry,
  system: ProfileSystem,
  settings: Settings,
): Pricing {
  const lines: LineItem[] = [];

  // ---------- Colour / finish uplift (M5)
  // The active colour applies a % uplift to the VISIBLE profile lines
  // (frame/sash/transom/bead) only — reinforcement (internal steel), glass,
  // gaskets and hardware are unaffected. The base colour (e.g. white) is 0%,
  // so a default-colour quote is byte-identical to pre-M5.
  const colour = system.defaultColourKey ? system.colours?.[system.defaultColourKey] : undefined;
  const costMul = colour ? 1 + colour.costUpliftPct / 100 : 1;
  const priceMul = colour ? 1 + colour.priceUpliftPct / 100 : 1;

  // ---------- Linear profiles (frames, sashes, transoms, mullions, beads, reinforcement)
  // We use total cut length per code from the cutting plan — that's the
  // actual material your shop consumes after kerf accounting.
  for (const [code, group] of Object.entries(plan.byCode)) {
    const lengthM = group.totalLengthMm / 1000;
    const def = findProfileByCode(system, code);
    if (!def) continue;
    const coloured = isColourBearingCode(system, code);
    const unitCost = coloured ? def.cost * costMul : def.cost;
    const unitPrice = coloured ? def.price * priceMul : def.price;
    lines.push(makeLine(code, group.name, def.financialCategory, lengthM, def.per as any, unitCost, unitPrice));
  }

  // ---------- Glass (area-based)
  const glassByCode = new Map<string, { name: string; area: number; category: string; cost: number; price: number }>();
  for (const g of parts.glass) {
    const def = findGlassByCode(system, g.code);
    if (!def) continue;
    const slot = glassByCode.get(g.code) ?? {
      name: g.name, area: 0, category: def.financialCategory, cost: def.cost, price: def.price,
    };
    slot.area += g.areaM2;
    glassByCode.set(g.code, slot);
  }
  for (const [code, slot] of glassByCode.entries()) {
    lines.push(makeLine(code, slot.name, slot.category, slot.area, "m2", slot.cost, slot.price));
  }

  // ---------- Gaskets
  for (const gk of parts.gaskets) {
    const def = findGasketByCode(system, gk.code);
    if (!def) continue;
    lines.push(makeLine(gk.code, gk.name, def.financialCategory, gk.lengthMm / 1000, "m", def.cost, def.price));
  }

  // ---------- Hardware
  for (const hw of parts.hardware) {
    const def = findHardwareByCode(system, hw.code);
    if (!def) continue;
    lines.push(makeLine(hw.code, hw.name, def.financialCategory, hw.qty, "pc", def.cost, def.price));
  }

  // ---------- Totals
  const materialCost = lines.reduce((s, l) => s + l.totalCost, 0);
  const materialPriceBeforeWastage = lines.reduce((s, l) => s + l.totalPrice, 0);

  // Wastage on profile/bead linear material only (your spec: 10% on cuttable stock).
  // Gaskets are per-metre but NOT cuttable stock — excluded by catalog lookup
  // (covers GKT-01/02 and the French SP_GSKFM/SP_S001 alike).
  const wastageEligibleLines = lines.filter((l) => l.unit === "m" && !findGasketByCode(system, l.code));
  const wastageBase = wastageEligibleLines.reduce((s, l) => s + l.totalPrice, 0);
  const wastageAdd = wastageBase * (settings.wastagePct / 100);
  const materialPrice = materialPriceBeforeWastage + wastageAdd;

  // Labour. French leaves (french-door-*) are doors; only the leaf cell (the
  // one carrying sashOuter) counts — midrail pane cells share its sash.
  const isDoorContent = (content: string) =>
    content.startsWith("door-") || content.startsWith("french-door");
  const sashCount = geometry.cells.filter((c) => c.sashKey && !isDoorContent(c.content)).length;
  const doorCount = geometry.cells.filter(
    (c) => isDoorContent(c.content) && (c.content.startsWith("door-") || c.sashOuter),
  ).length;
  const labour = settings.labour.base + settings.labour.perSash * sashCount + settings.labour.perDoor * doorCount;

  const factoryCost = materialPrice + labour;
  const markup = factoryCost * (settings.markupPct / 100);
  const netPrice = factoryCost + markup;
  const tax = settings.taxApply ? netPrice * (settings.taxPct / 100) : 0;
  const grandTotal = netPrice + tax;

  return {
    currency: settings.currency,
    lines,
    totals: {
      materialCost:  round2(materialCost),
      materialPrice: round2(materialPrice),
      labour:        round2(labour),
      factoryCost:   round2(factoryCost),
      markup:        round2(markup),
      netPrice:      round2(netPrice),
      tax:           round2(tax),
      grandTotal:    round2(grandTotal),
    },
  };
}

function makeLine(
  code: string,
  description: string,
  category: string,
  qty: number,
  unit: "m" | "pc" | "m2" | "set",
  unitCost: number,
  unitPrice: number,
): LineItem {
  return {
    code, description, category,
    qty: round3(qty),
    unit,
    unitCost, unitPrice,
    totalCost: round2(qty * unitCost),
    totalPrice: round2(qty * unitPrice),
  };
}

// ---------- catalog lookups ------------------------------------------
function findProfileByCode(system: ProfileSystem, code: string) {
  // Cills are included so the cill cut line resolves its per-metre cost/price.
  // (NOT added to isColourBearingCode — the cill code already encodes its finish,
  // so the colour uplift must not double-apply.)
  for (const dict of [system.frames, system.sashes, system.transoms, system.beads, system.reinforcement, system.cills]) {
    for (const v of Object.values(dict)) {
      if ((v as any).code === code) return v as any;
    }
  }
  return null;
}
/** True for visible profiles that carry the colour finish (NOT reinforcement). */
function isColourBearingCode(system: ProfileSystem, code: string): boolean {
  for (const dict of [system.frames, system.sashes, system.transoms, system.beads]) {
    for (const v of Object.values(dict)) {
      if ((v as any).code === code) return true;
    }
  }
  return false;
}
function findGlassByCode(system: ProfileSystem, code: string) {
  for (const v of Object.values(system.glass)) if (v.code === code) return v;
  return null;
}
function findGasketByCode(system: ProfileSystem, code: string) {
  for (const v of Object.values(system.gaskets)) if (v.code === code) return v;
  return null;
}
function findHardwareByCode(system: ProfileSystem, code: string) {
  for (const v of Object.values(system.hardware)) if (v.code === code) return v;
  return null;
}

function round2(n: number) { return Math.round(n * 100) / 100; }
function round3(n: number) { return Math.round(n * 1000) / 1000; }
