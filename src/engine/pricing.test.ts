// =====================================================================
// engine/pricing.test.ts — colour-uplift math (M5).
//
// Pure unit test: it feeds computePricing() SYNTHETIC non-zero prices and a
// colour with a known uplift, then asserts the visible-profile lines are
// upcharged and the internal/steel line is not. This proves the colour path
// WITHOUT committing real or guessed catalog prices (golden rule) and without
// touching the 147 catalog-driven geometry assertions.
//
// Wired into `npm run validate` via validatePricing(expect) (see
// src/validation/jobs.ts), exactly like the M3 extractor test.
// =====================================================================

import { computePricing } from "./pricing.ts";
import type {
  ProfileSystem,
  SolvedParts,
  CuttingPlan,
  SolvedGeometry,
  Settings,
} from "../types.ts";

type Expect = (label: string, actual: any, expected: any) => void;

/** A tiny system: one visible frame (F1) + one internal reinforcement (R1). */
function makeSystem(defaultColourKey?: string): ProfileSystem {
  return {
    systemId: "test-sys",
    name: "Test System",
    currency: "GBP",
    stockBarLengthMm: 6000,
    sawKerfMm: 5,
    frames: {
      f1: {
        code: "F1", name: "Test Frame", faceWidth: 64, glassRebate: 15, weldAllowanceMm: 0,
        cost: 10, price: 20, per: "m", weight: 0, financialCategory: "Frame",
      },
    },
    sashes: {},
    transoms: {},
    beads: {},
    reinforcement: {
      r1: {
        code: "R1", name: "Test Reinf", faceWidth: 0, endClearance: 0, weldAllowanceMm: 0,
        cost: 5, price: 8, per: "m", weight: 0, financialCategory: "Reinf",
      },
    },
    gaskets: {},
    glass: {},
    hardware: {},
    colours: {
      white: { key: "white", code: "COL-WHITE", name: "White", costUpliftPct: 0, priceUpliftPct: 0, isBase: true },
      oak:   { key: "oak",   code: "COL-OAK",   name: "Golden Oak", costUpliftPct: 20, priceUpliftPct: 30, isBase: false },
    },
    ...(defaultColourKey ? { defaultColourKey } : {}),
    cills: {},
    reinforcementMap: {},
  };
}

// 2 m of frame (F1) + 1 m of reinforcement (R1); nothing else.
const PLAN: CuttingPlan = {
  byCode: {
    F1: { name: "Test Frame", bars: [], totalLengthMm: 2000, utilizationPct: 0 },
    R1: { name: "Test Reinf", bars: [], totalLengthMm: 1000, utilizationPct: 0 },
  },
};
const PARTS: SolvedParts = { bars: [], reinforcement: [], glass: [], gaskets: [], hardware: [] };
const GEOMETRY = { cells: [] } as unknown as SolvedGeometry;
// Zero out markup/tax/wastage/labour so the line totals are isolated.
const SETTINGS: Settings = {
  currency: "GBP", taxApply: false, taxPct: 0, markupPct: 0, wastagePct: 0,
  labour: { perSash: 0, perDoor: 0, base: 0 },
};

export function validatePricing(expect: Expect): void {
  console.log("\n==================================================");
  console.log("M5 colour-uplift pricing");
  console.log("==================================================");

  const lineFor = (sys: ProfileSystem, code: string) =>
    computePricing(PARTS, PLAN, GEOMETRY, sys, SETTINGS).lines.find((l) => l.code === code);

  // Base white (0%): frame line equals raw catalog price/cost.
  const white = lineFor(makeSystem("white"), "F1");
  expect("white frame unitCost = 10", white?.unitCost ?? -1, 10);
  expect("white frame unitPrice = 20", white?.unitPrice ?? -1, 20);

  // Oak (cost +20%, price +30%): visible frame is upcharged.
  const oakSys = makeSystem("oak");
  const oakFrame = lineFor(oakSys, "F1");
  expect("oak frame unitCost = 12", oakFrame?.unitCost ?? -1, 12);   // 10 * 1.20
  expect("oak frame unitPrice = 26", oakFrame?.unitPrice ?? -1, 26); // 20 * 1.30
  expect("oak frame totalCost = 24", oakFrame?.totalCost ?? -1, 24); // 2 m × 12
  expect("oak frame totalPrice = 52", oakFrame?.totalPrice ?? -1, 52); // 2 m × 26

  // Reinforcement (internal steel) is NEVER colour-upcharged.
  const oakReinf = lineFor(oakSys, "R1");
  expect("oak reinforcement unitCost unchanged = 5", oakReinf?.unitCost ?? -1, 5);
  expect("oak reinforcement unitPrice unchanged = 8", oakReinf?.unitPrice ?? -1, 8);

  // No defaultColourKey ⇒ no uplift (byte-identical to pre-M5).
  const none = lineFor(makeSystem(undefined), "F1");
  expect("no-colour frame unitPrice = 20", none?.unitPrice ?? -1, 20);

  // Grand total reflects the uplift end-to-end (no markup/tax/labour here):
  // oak material price = frame 52 + reinf 8 = 60.
  const oakTotals = computePricing(PARTS, PLAN, GEOMETRY, oakSys, SETTINGS).totals;
  expect("oak grandTotal = 60", oakTotals.grandTotal, 60);

  // Inside/outside (dual-colour): solve.ts synthesizes ONE combined colour whose
  // uplift is the SUM of the two finishes. Here white(0)+oak(20/30) ⇒ a combined
  // 20/30 (single non-zero finish), and oak(20/30)+oak ⇒ 40/60. We replicate the
  // synthesized colour and assert computePricing applies the summed percentages.
  const dualSys = makeSystem();
  dualSys.colours["__combined__:oak+oak"] = {
    key: "__combined__:oak+oak", code: "COL-OAK/COL-OAK", name: "Golden Oak / Golden Oak",
    costUpliftPct: 40, priceUpliftPct: 60, isBase: false,
  };
  dualSys.defaultColourKey = "__combined__:oak+oak";
  const dualFrame = lineFor(dualSys, "F1");
  expect("dual oak+oak frame unitCost = 14", dualFrame?.unitCost ?? -1, 14);   // 10 * 1.40
  expect("dual oak+oak frame unitPrice = 32", dualFrame?.unitPrice ?? -1, 32); // 20 * 1.60
  // Internal steel still never upcharged, even with a dual finish.
  const dualReinf = lineFor(dualSys, "R1");
  expect("dual reinforcement unitPrice unchanged = 8", dualReinf?.unitPrice ?? -1, 8);

  // ---------- Per-profile colour-tier prices (M5.5) ----------
  // A frame carrying supplier 1P/2P tier prices; the colour resolves a tier and
  // the tier price is used VERBATIM (no %-uplift stacking). Missing tier columns
  // fall back to base × %-uplift. A part with NO tierPrices always falls back.
  const tierSys = makeSystem();
  tierSys.frames.f1.tierPrices = { cost1p: 15, price1p: 25, cost2p: 18, price2p: 30 };
  // A frame with ONLY a 2P price (no cost2p) to prove independent cost fallback.
  tierSys.frames.f2 = {
    code: "F2", name: "Frame 2", faceWidth: 64, glassRebate: 15, weldAllowanceMm: 0,
    cost: 10, price: 20, per: "m", weight: 0, financialCategory: "Frame",
    tierPrices: { price2p: 40 },
  };
  // A frame with NO tier prices at all (fallback to %-uplift).
  tierSys.frames.f3 = {
    code: "F3", name: "Frame 3", faceWidth: 64, glassRebate: 15, weldAllowanceMm: 0,
    cost: 10, price: 20, per: "m", weight: 0, financialCategory: "Frame",
  };
  tierSys.colours.anthracite = { key: "anthracite", code: "C7016", name: "Anthracite", costUpliftPct: 20, priceUpliftPct: 30, isBase: false };
  tierSys.colours["__combined__:white+anthracite"] = {
    key: "__combined__:white+anthracite", code: "W/A", name: "White / Anthracite",
    costUpliftPct: 30, priceUpliftPct: 30, isBase: false, tier: "1p",
  };
  const tierPlan: CuttingPlan = {
    byCode: {
      F1: { name: "F1", bars: [], totalLengthMm: 1000, utilizationPct: 0 },
      F2: { name: "F2", bars: [], totalLengthMm: 1000, utilizationPct: 0 },
      F3: { name: "F3", bars: [], totalLengthMm: 1000, utilizationPct: 0 },
    },
  };
  const tierLine = (colourKey: string | undefined, code: string) => {
    const s = { ...tierSys, ...(colourKey ? { defaultColourKey: colourKey } : { defaultColourKey: undefined }) };
    return computePricing(PARTS, tierPlan, GEOMETRY, s, SETTINGS).lines.find((l) => l.code === code);
  };

  // Single non-base colour ⇒ derived 2P. F1 has tier prices ⇒ used verbatim.
  const a1 = tierLine("anthracite", "F1");
  expect("2P tier: F1 unitPrice = price2p 30 (no uplift stacking)", a1?.unitPrice ?? -1, 30);
  expect("2P tier: F1 unitCost = cost2p 18", a1?.unitCost ?? -1, 18);
  // F2 has only price2p ⇒ price uses it; cost falls back to base × costMul (10×1.2).
  const a2 = tierLine("anthracite", "F2");
  expect("2P tier: F2 unitPrice = price2p 40", a2?.unitPrice ?? -1, 40);
  expect("2P tier: F2 unitCost falls back to 12", a2?.unitCost ?? -1, 12);
  // F3 has no tier prices ⇒ full %-uplift fallback (20×1.3 = 26).
  const a3 = tierLine("anthracite", "F3");
  expect("2P tier: F3 (no tierPrices) unitPrice = 26 fallback", a3?.unitPrice ?? -1, 26);
  // Dual white+anthracite ⇒ tier "1p" ⇒ F1 uses price1p 25.
  const d1 = tierLine("__combined__:white+anthracite", "F1");
  expect("1P tier: F1 unitPrice = price1p 25", d1?.unitPrice ?? -1, 25);
  expect("1P tier: F1 unitCost = cost1p 15", d1?.unitCost ?? -1, 15);
  // Base white ⇒ no tier ⇒ tierPrices ignored, byte-identical raw price.
  const w1 = tierLine("white", "F1");
  expect("white: F1 ignores tierPrices (unitPrice 20)", w1?.unitPrice ?? -1, 20);
}
