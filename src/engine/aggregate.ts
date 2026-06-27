// =====================================================================
// engine/aggregate.ts — combine multiple order items into one set of
// order-level parts / cutting plan / pricing (multi-window orders).
//
// Each item is solved independently (solve()), then we merge:
//   • bars / reinforcement / glass / cells — repeated `qty` times
//   • gaskets — summed length per code
//   • hardware — summed qty per code
// and re-run the (pure) planCuts + computePricing on the merged parts so
// the order-level Cutting List / BOM / Price Summary reflect the whole
// order rather than a single window.
// =====================================================================

import type {
  CuttingPlan,
  GasketPiece,
  HardwarePiece,
  Pricing,
  ProfileSystem,
  Settings,
  SolvedCell,
  SolvedGeometry,
  SolvedParts,
  BarPiece,
  GlassPiece,
  QuoteOutput,
} from "../types.ts";
import { planCuts } from "./cutting.ts";
import { computePricing } from "./pricing.ts";

export interface ItemForAggregation {
  output: QuoteOutput;
  qty: number;
}

export interface AggregatedOrder {
  parts: SolvedParts;
  cuttingPlan: CuttingPlan;
  pricing: Pricing;
}

export function aggregateOrder(
  items: ItemForAggregation[],
  system: ProfileSystem,
  settings: Settings,
): AggregatedOrder {
  const bars: BarPiece[] = [];
  const reinforcement: BarPiece[] = [];
  const glass: GlassPiece[] = [];
  const cells: SolvedCell[] = [];
  const gasketMap = new Map<string, GasketPiece>();
  const hardwareMap = new Map<string, HardwarePiece>();

  for (const { output, qty } of items) {
    const n = Math.max(1, Math.floor(qty));
    for (let i = 0; i < n; i++) {
      bars.push(...output.parts.bars);
      reinforcement.push(...output.parts.reinforcement);
      glass.push(...output.parts.glass);
      cells.push(...output.geometry.cells);

      for (const g of output.parts.gaskets) {
        const slot = gasketMap.get(g.code) ?? { code: g.code, name: g.name, lengthMm: 0 };
        slot.lengthMm = round1(slot.lengthMm + g.lengthMm);
        gasketMap.set(g.code, slot);
      }
      for (const h of output.parts.hardware) {
        const slot = hardwareMap.get(h.code) ?? { code: h.code, name: h.name, qty: 0 };
        slot.qty += h.qty;
        hardwareMap.set(h.code, slot);
      }
    }
  }

  const parts: SolvedParts = {
    bars,
    reinforcement,
    glass,
    gaskets: [...gasketMap.values()],
    hardware: [...hardwareMap.values()],
  };

  // Only `cells` is consumed downstream (labour counts in pricing).
  const geometry: SolvedGeometry = {
    outer: { x: 0, y: 0, w: 0, h: 0 },
    rootDaylight: { x: 0, y: 0, w: 0, h: 0 },
    cells,
    transoms: [],
    mullions: [],
  };

  const cuttingPlan = planCuts(parts, system);
  const pricing = computePricing(parts, cuttingPlan, geometry, system, settings);
  return { parts, cuttingPlan, pricing };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
