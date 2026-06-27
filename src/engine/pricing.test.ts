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
        code: "F1", name: "Test Frame", faceWidth: 64, glassRebate: 15,
        cost: 10, price: 20, per: "m", weight: 0, financialCategory: "Frame",
      },
    },
    sashes: {},
    transoms: {},
    beads: {},
    reinforcement: {
      r1: {
        code: "R1", name: "Test Reinf", faceWidth: 0, endClearance: 0,
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
}
