// =====================================================================
// designer/basket.ts — the order-level commercial layer (Designer phase 6).
//
// ONE pure function owns the arithmetic. Every surface that shows an order
// total — the API response, the orders list, the order detail card, the Price
// Summary document — calls this and therefore agrees to the penny
// (Spec/01-windows-module/phase-6-basket-and-orders.md, acceptance §1).
//
// Pure like the engine and the resolver: no I/O, no DB, no clock beyond the
// caller-supplied `at` used for discount validity. The caller resolves item
// prices (solve() for legacy items, the resolver for designer items) and hands
// them in as plain numbers.
// =====================================================================

import type { Settings } from "../types.ts";

/** How a discount reduces the items subtotal. */
export type DiscountKind = "percent" | "fixed";

/**
 * Which extras apply to the order.
 *  - "none"            supply only: no fitting, no survey
 *  - "fit"             fitting charged, survey not
 *  - "fit-and-survey"  both charged
 * Delivery is independent of fitting and always applies when set.
 */
export type FittingType = "none" | "fit" | "fit-and-survey";

export const FITTING_TYPES: FittingType[] = ["none", "fit", "fit-and-survey"];

export function isFittingType(v: unknown): v is FittingType {
  return typeof v === "string" && (FITTING_TYPES as string[]).includes(v);
}

/** A discount code as stored, in the shape the pure function needs. */
export interface BasketDiscount {
  code: string;
  kind: DiscountKind;
  value: number;
  active?: boolean;
  validFrom?: Date | null;
  validTo?: Date | null;
}

/**
 * One priced line, already resolved by the caller. `netPrice` is the engine's
 * PRE-TAX line price (`Pricing.totals.netPrice`) for ONE unit — see the tax
 * note on `computeBasket`.
 */
export interface BasketItemInput {
  /** Stable id, for per-line rollups in the UI. */
  id: string;
  kind: "legacy" | "designer";
  label: string;
  qty: number;
  /** Pre-tax price of a single unit. */
  netPrice: number;
  /** Error-severity issues that block confirm (designer items only). */
  errorCount?: number;
}

export interface BasketCommercials {
  fittingType?: FittingType | string | null;
  fittingPrice?: number | null;
  surveyPrice?: number | null;
  deliveryCharge?: number | null;
  /** The validated discount to apply, or null. */
  discount?: BasketDiscount | null;
  /** Per-order VAT override; null/undefined ⇒ the Settings rate. */
  taxRatePct?: number | null;
}

export interface BasketLine {
  id: string;
  kind: "legacy" | "designer";
  label: string;
  qty: number;
  unitNetPrice: number;
  lineNetPrice: number;
  errorCount: number;
}

export interface BasketOptions {
  /**
   * The ORDER-level net price from `aggregateOrder()` — the number the 7
   * documents price against. When supplied it wins over the sum of the lines,
   * and the difference is reported as `itemsAdjustment`. See the note on
   * `computeBasket`.
   */
  aggregateNetPrice?: number | null;
}

export interface BasketTotals {
  currency: string;
  lines: BasketLine[];
  /** Σ line net prices (pre-tax), before the order-level adjustment. */
  linesSubtotal: number;
  /**
   * `itemsSubtotal − linesSubtotal`: the saving (or uplift) that comes from
   * pricing the order as ONE job rather than as separate windows — flat setup
   * labour charged once, wastage computed over the merged material. 0 when the
   * caller supplies no aggregate.
   */
  itemsAdjustment: number;
  /** The priced items total (pre-tax) the rest of the basket builds on. */
  itemsSubtotal: number;
  /** Applied discount amount (never above `itemsSubtotal`, never below 0). */
  discount: number;
  discountCode: string | null;
  discountKind: DiscountKind | null;
  discountValue: number | null;
  /** Extras actually charged, after the fittingType applicability matrix. */
  fittingType: FittingType;
  fitting: number;
  survey: number;
  delivery: number;
  extras: number;
  /** itemsSubtotal − discount + extras. */
  taxableBase: number;
  taxRatePct: number;
  tax: number;
  grandTotal: number;
}

/** Money rounding — one place, so every surface rounds identically. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function money(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n ?? 0);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Is a discount code usable at `at`? Inactive or outside its validity window ⇒
 * no. Callers that want to TELL the user why should use `discountRejection`.
 */
export function isDiscountUsable(d: BasketDiscount, at: Date = new Date()): boolean {
  return discountRejection(d, at) === null;
}

/** Why a discount cannot be applied, or null when it can. */
export function discountRejection(d: BasketDiscount, at: Date = new Date()): string | null {
  if (d.active === false) return `Discount code ${d.code} is no longer active`;
  if (d.validFrom && at < new Date(d.validFrom))
    return `Discount code ${d.code} is not valid yet`;
  if (d.validTo && at > new Date(d.validTo)) return `Discount code ${d.code} has expired`;
  if (!(d.kind === "percent" || d.kind === "fixed"))
    return `Discount code ${d.code} has an unknown kind: ${String(d.kind)}`;
  return null;
}

/**
 * The normative totals derivation (data-model.md §2).
 *
 *   itemsSubtotal = Σ (unit net price × qty)
 *   discount      = code applied to itemsSubtotal      (percent | fixed, clamped to [0, subtotal])
 *   extras        = fitting + survey + delivery        (per the fittingType matrix)
 *   taxableBase   = itemsSubtotal − discount + extras
 *   tax           = taxableBase × taxRatePct
 *   grandTotal    = taxableBase + tax
 *
 * DEVIATION from the phase file's wording, deliberate: it says the subtotal
 * sums each item's `grandTotal`, but the engine's grandTotal is already
 * tax-inclusive (`netPrice + tax`), so taxing that base again would charge VAT
 * twice on every item. The subtotal is therefore the PRE-TAX `netPrice`, and
 * tax is applied exactly once, over items + extras − discount. For an order
 * with no commercial data and the default VAT rate this reproduces the engine's
 * own grand total to the penny.
 *
 * SECOND deviation, same reason (one number, one truth): a multi-item order is
 * priced by `aggregateOrder()` as ONE job — flat setup labour once, wastage over
 * the merged material — so the engine's order price is LOWER than the sum of the
 * lines priced separately. That aggregate is what the BOM and the Price Summary
 * print, so it is what the basket must charge. Callers pass it as
 * `opts.aggregateNetPrice`; the gap between it and the line sum is reported
 * explicitly as `itemsAdjustment` rather than quietly rewriting the line prices.
 */
export function computeBasket(
  items: BasketItemInput[],
  commercials: BasketCommercials,
  settings: Settings,
  at: Date = new Date(),
  opts: BasketOptions = {},
): BasketTotals {
  const lines: BasketLine[] = items.map((it) => {
    const qty = Math.max(1, Math.round(it.qty || 1));
    const unit = round2(it.netPrice || 0);
    return {
      id: it.id,
      kind: it.kind,
      label: it.label,
      qty,
      unitNetPrice: unit,
      lineNetPrice: round2(unit * qty),
      errorCount: it.errorCount ?? 0,
    };
  });

  const linesSubtotal = round2(lines.reduce((s, l) => s + l.lineNetPrice, 0));
  const itemsSubtotal =
    opts.aggregateNetPrice === null || opts.aggregateNetPrice === undefined
      ? linesSubtotal
      : round2(Math.max(0, opts.aggregateNetPrice));
  const itemsAdjustment = round2(itemsSubtotal - linesSubtotal);

  // ---- discount ------------------------------------------------------
  const d = commercials.discount ?? null;
  let discount = 0;
  if (d && isDiscountUsable(d, at)) {
    const raw = d.kind === "percent" ? (itemsSubtotal * money(d.value)) / 100 : money(d.value);
    // Floor at zero, cap at the subtotal: a £500 code on a £200 basket makes
    // the items free, never negative (acceptance §2).
    discount = round2(Math.min(Math.max(raw, 0), itemsSubtotal));
  }

  // ---- extras (applicability matrix) ---------------------------------
  const fittingType: FittingType = isFittingType(commercials.fittingType)
    ? commercials.fittingType
    : "none";
  const fitting = fittingType === "none" ? 0 : round2(money(commercials.fittingPrice));
  const survey = fittingType === "fit-and-survey" ? round2(money(commercials.surveyPrice)) : 0;
  const delivery = round2(money(commercials.deliveryCharge)); // independent of fitting
  const extras = round2(fitting + survey + delivery);

  // ---- tax -----------------------------------------------------------
  const settingsRate = settings.taxApply ? settings.taxPct : 0;
  const taxRatePct =
    commercials.taxRatePct === null || commercials.taxRatePct === undefined
      ? settingsRate
      : Math.max(0, Number(commercials.taxRatePct));

  const taxableBase = round2(itemsSubtotal - discount + extras);
  const tax = round2((taxableBase * taxRatePct) / 100);
  const grandTotal = round2(taxableBase + tax);

  return {
    currency: settings.currency,
    lines,
    linesSubtotal,
    itemsAdjustment,
    itemsSubtotal,
    discount,
    discountCode: discount > 0 && d ? d.code : null,
    discountKind: discount > 0 && d ? d.kind : null,
    discountValue: discount > 0 && d ? money(d.value) : null,
    fittingType,
    fitting,
    survey,
    delivery,
    extras,
    taxableBase,
    taxRatePct,
    tax,
    grandTotal,
  };
}

/** True when the basket carries any commercial data worth printing. */
export function hasCommercials(b: BasketTotals): boolean {
  return b.discount > 0 || b.extras > 0;
}
