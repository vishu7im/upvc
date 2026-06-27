// =====================================================================
// engine/cutting.ts — 1D cutting stock optimization.
//
// Algorithm: First Fit Decreasing (FFD). For each profile code, gather
// all the Ext lengths needed, sort descending, then pack onto bars of
// stockBarLengthMm with a saw kerf reserved between cuts.
//
// FFD is not optimal but is fast and good enough (typically 95-100% of
// optimum) and easy to reason about. Switch to a stronger algorithm if
// you ever need it — the interface here won't change.
// =====================================================================

import type { BarPiece, CutBar, CuttingPlan, ProfileSystem, SolvedParts } from "../types.ts";

export function planCuts(parts: SolvedParts, system: ProfileSystem): CuttingPlan {
  const stock = system.stockBarLengthMm;
  const kerf = system.sawKerfMm;

  // Group all bars (including reinforcement) by profile code.
  const allBars: BarPiece[] = [...parts.bars, ...parts.reinforcement];
  const byCode = new Map<string, BarPiece[]>();
  for (const b of allBars) {
    if (!byCode.has(b.code)) byCode.set(b.code, []);
    byCode.get(b.code)!.push(b);
  }

  const plan: CuttingPlan = { byCode: {} };

  for (const [code, list] of byCode.entries()) {
    // Sort by Ext descending — FFD core step.
    const sorted = [...list].sort((a, b) => b.extMm - a.extMm);
    const bars: CutBar[] = [];

    for (const piece of sorted) {
      let placed = false;
      // Try to place on an existing bar.
      for (const bar of bars) {
        // After at least one cut, every new cut consumes (length + kerf).
        const cost = bar.cuts.length === 0 ? piece.extMm : piece.extMm + kerf;
        if (bar.usedMm + cost <= stock) {
          bar.cuts.push({ position: piece.position, lengthMm: piece.extMm });
          bar.usedMm += cost;
          bar.remainderMm = stock - bar.usedMm;
          placed = true;
          break;
        }
      }
      if (!placed) {
        // Start a new bar.
        bars.push({
          code,
          stockMm: stock,
          cuts: [{ position: piece.position, lengthMm: piece.extMm }],
          usedMm: piece.extMm,
          remainderMm: stock - piece.extMm,
        });
      }
    }

    const name = list[0]?.name ?? code;
    const totalLengthMm = bars.reduce((sum, b) => sum + b.usedMm, 0);
    const utilizationPct = bars.length === 0 ? 0 : (totalLengthMm / (bars.length * stock)) * 100;
    plan.byCode[code] = {
      name,
      bars,
      totalLengthMm,
      utilizationPct: Math.round(utilizationPct * 10) / 10,
    };
  }

  return plan;
}
