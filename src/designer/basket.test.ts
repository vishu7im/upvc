// =====================================================================
// designer/basket.test.ts — the commercial-layer arithmetic (phase 6).
//
// Pure unit test (no DB), wired into `npm run validate` via
// validateBasket(expect) like the rules/limits/pricing suites.
//
// Coverage bar (phase-6 acceptance): percent + fixed discounts, the floor-at-
// zero clamp, the fittingType applicability matrix, default-vs-override tax
// rate, mixed legacy+designer lines, and — the one that keeps every surface
// honest — that an order with NO commercial data reproduces the engine's own
// tax + grand total exactly.
// =====================================================================

import { computeBasket, discountRejection, type BasketItemInput } from "./basket.ts";
import type { Settings } from "../types.ts";

type Expect = (label: string, actual: any, expected: any) => void;

const SETTINGS: Settings = {
  currency: "GBP",
  taxApply: true,
  taxPct: 20,
  markupPct: 75,
  wastagePct: 10,
  labour: { perSash: 25, perDoor: 60, base: 30 },
};

const AT = new Date("2026-07-26T12:00:00Z");

const ITEMS: BasketItemInput[] = [
  { id: "legacy-1", kind: "legacy", label: "Casement 1200×1200", qty: 2, netPrice: 100 },
  { id: "designer-1", kind: "designer", label: "Kitchen window", qty: 1, netPrice: 300 },
];
// itemsSubtotal = 2×100 + 300 = 500

export function validateBasket(expect: Expect): void {
  console.log("\n---------- Basket totals (phase 6) ----------");

  // ---- 1. no commercial data ⇒ the engine's own arithmetic -----------
  {
    const b = computeBasket(ITEMS, {}, SETTINGS, AT);
    expect("bare basket: subtotal is Σ net × qty", b.itemsSubtotal, 500);
    expect("bare basket: no discount", b.discount, 0);
    expect("bare basket: no extras", b.extras, 0);
    expect("bare basket: taxable base == subtotal", b.taxableBase, 500);
    expect("bare basket: settings VAT rate applies", b.taxRatePct, 20);
    expect("bare basket: tax == 20% of net (engine-identical)", b.tax, 100);
    expect("bare basket: grand total == net + tax", b.grandTotal, 600);
    expect("bare basket: currency from settings", b.currency, "GBP");
    expect("bare basket: one line per item", b.lines.length, 2);
    expect("bare basket: line total = unit × qty", b.lines[0].lineNetPrice, 200);
    expect("bare basket: designer line carried through", b.lines[1].kind, "designer");
  }

  // ---- 2. percent discount ------------------------------------------
  {
    const b = computeBasket(
      ITEMS,
      { discount: { code: "SAVE10", kind: "percent", value: 10 } },
      SETTINGS,
      AT,
    );
    expect("percent: 10% of 500", b.discount, 50);
    expect("percent: code echoed", b.discountCode, "SAVE10");
    expect("percent: base is subtotal − discount", b.taxableBase, 450);
    expect("percent: tax follows the reduced base", b.tax, 90);
    expect("percent: grand total", b.grandTotal, 540);
  }

  // ---- 3. fixed discount, incl. the floor-at-zero clamp --------------
  {
    const b = computeBasket(
      ITEMS,
      { discount: { code: "MINUS75", kind: "fixed", value: 75 } },
      SETTINGS,
      AT,
    );
    expect("fixed: flat amount", b.discount, 75);
    expect("fixed: base", b.taxableBase, 425);

    const huge = computeBasket(
      ITEMS,
      { discount: { code: "TOOBIG", kind: "fixed", value: 5000 } },
      SETTINGS,
      AT,
    );
    expect("oversized fixed discount caps at the subtotal", huge.discount, 500);
    expect("oversized fixed discount floors the base at 0", huge.taxableBase, 0);
    expect("oversized fixed discount floors the total at 0", huge.grandTotal, 0);

    const negative = computeBasket(
      ITEMS,
      { discount: { code: "NEG", kind: "fixed", value: -20 } },
      SETTINGS,
      AT,
    );
    expect("a negative discount value never increases the price", negative.discount, 0);
  }

  // ---- 4. discount validity -----------------------------------------
  {
    const expired = {
      code: "OLD",
      kind: "fixed" as const,
      value: 50,
      validTo: new Date("2026-01-01T00:00:00Z"),
    };
    expect(
      "expired code is rejected with a message",
      (discountRejection(expired, AT) ?? "").includes("expired"),
      true,
    );
    const b = computeBasket(ITEMS, { discount: expired }, SETTINGS, AT);
    expect("expired code applies nothing", b.discount, 0);
    expect("expired code leaves discountCode null", b.discountCode, null);

    const future = {
      code: "SOON",
      kind: "fixed" as const,
      value: 50,
      validFrom: new Date("2026-12-01T00:00:00Z"),
    };
    expect(
      "not-yet-valid code is rejected",
      (discountRejection(future, AT) ?? "").includes("not valid yet"),
      true,
    );
    const inactive = { code: "OFF", kind: "fixed" as const, value: 50, active: false };
    expect(
      "inactive code is rejected",
      (discountRejection(inactive, AT) ?? "").includes("no longer active"),
      true,
    );
    const live = { code: "OK", kind: "percent" as const, value: 5, active: true };
    expect("a live code has no rejection reason", discountRejection(live, AT), null);
  }

  // ---- 5. fittingType applicability matrix ---------------------------
  {
    const extras = { fittingPrice: 200, surveyPrice: 60, deliveryCharge: 40 };

    const none = computeBasket(ITEMS, { ...extras, fittingType: "none" }, SETTINGS, AT);
    expect("none: fitting not charged", none.fitting, 0);
    expect("none: survey not charged", none.survey, 0);
    expect("none: delivery IS charged (independent of fitting)", none.delivery, 40);
    expect("none: extras total", none.extras, 40);

    const fit = computeBasket(ITEMS, { ...extras, fittingType: "fit" }, SETTINGS, AT);
    expect("fit: fitting charged", fit.fitting, 200);
    expect("fit: survey still not charged", fit.survey, 0);
    expect("fit: extras total", fit.extras, 240);

    const both = computeBasket(ITEMS, { ...extras, fittingType: "fit-and-survey" }, SETTINGS, AT);
    expect("fit-and-survey: fitting charged", both.fitting, 200);
    expect("fit-and-survey: survey charged", both.survey, 60);
    expect("fit-and-survey: extras total", both.extras, 300);
    expect("fit-and-survey: base = subtotal + extras", both.taxableBase, 800);
    expect("fit-and-survey: tax on items AND extras", both.tax, 160);
    expect("fit-and-survey: grand total", both.grandTotal, 960);

    const unknown = computeBasket(ITEMS, { ...extras, fittingType: "bogus" }, SETTINGS, AT);
    expect("an unknown fittingType degrades to none", unknown.fittingType, "none");
  }

  // ---- 6. discount applies to items only, before extras --------------
  {
    const b = computeBasket(
      ITEMS,
      {
        fittingType: "fit",
        fittingPrice: 100,
        deliveryCharge: 50,
        discount: { code: "SAVE10", kind: "percent", value: 10 },
      },
      SETTINGS,
      AT,
    );
    expect("discount is 10% of ITEMS, not of items+extras", b.discount, 50);
    expect("base = 500 − 50 + 150", b.taxableBase, 600);
    expect("grand total", b.grandTotal, 720);
  }

  // ---- 7. tax rate: default, override, zero-rated --------------------
  {
    const override = computeBasket(ITEMS, { taxRatePct: 5 }, SETTINGS, AT);
    expect("per-order rate overrides the settings rate", override.taxRatePct, 5);
    expect("per-order rate drives the tax", override.tax, 25);

    const zero = computeBasket(ITEMS, { taxRatePct: 0 }, SETTINGS, AT);
    expect("a 0% override really means zero (not 'unset')", zero.tax, 0);
    expect("zero-rated grand total == base", zero.grandTotal, 500);

    const taxOff = computeBasket(ITEMS, {}, { ...SETTINGS, taxApply: false }, AT);
    expect("settings.taxApply=false ⇒ no tax", taxOff.tax, 0);
    expect("settings.taxApply=false ⇒ rate reported as 0", taxOff.taxRatePct, 0);
  }

  // ---- 8. order-level aggregate wins over the line sum ---------------
  // The engine prices a multi-item order as ONE job (flat setup labour once),
  // so its net price is below the sum of separately-priced lines. The basket
  // charges the aggregate and shows the gap instead of rewriting the lines.
  {
    const b = computeBasket(ITEMS, {}, SETTINGS, AT, { aggregateNetPrice: 470 });
    expect("aggregate: lines still sum to their own total", b.linesSubtotal, 500);
    expect("aggregate: items subtotal is the engine's order price", b.itemsSubtotal, 470);
    expect("aggregate: the gap is reported, not hidden", b.itemsAdjustment, -30);
    expect("aggregate: tax follows the aggregate", b.tax, 94);
    expect("aggregate: grand total", b.grandTotal, 564);

    const discounted = computeBasket(
      ITEMS,
      { discount: { code: "SAVE10", kind: "percent", value: 10 } },
      SETTINGS,
      AT,
      { aggregateNetPrice: 470 },
    );
    expect("aggregate: percent discount applies to the aggregate", discounted.discount, 47);

    const noAgg = computeBasket(ITEMS, {}, SETTINGS, AT, { aggregateNetPrice: null });
    expect("no aggregate ⇒ subtotal is the line sum", noAgg.itemsSubtotal, 500);
    expect("no aggregate ⇒ zero adjustment", noAgg.itemsAdjustment, 0);
  }

  // ---- 9. mixed / degenerate baskets ---------------------------------
  {
    const empty = computeBasket([], { fittingType: "fit", fittingPrice: 100 }, SETTINGS, AT);
    expect("empty basket: subtotal 0", empty.itemsSubtotal, 0);
    expect("empty basket: extras still charged", empty.grandTotal, 120);

    const rounding = computeBasket(
      [{ id: "x", kind: "designer", label: "odd", qty: 3, netPrice: 10.005 }],
      {},
      SETTINGS,
      AT,
    );
    expect("unit price rounds to the penny before multiplying", rounding.lines[0].unitNetPrice, 10.01);
    expect("line total is exact at 2dp", rounding.lines[0].lineNetPrice, 30.03);
    expect("tax rounds to the penny", rounding.tax, 6.01);

    const issues = computeBasket(
      [{ id: "bad", kind: "designer", label: "broken", qty: 1, netPrice: 0, errorCount: 2 }],
      {},
      SETTINGS,
      AT,
    );
    expect("error counts travel with the line (UI badges)", issues.lines[0].errorCount, 2);
  }
}
