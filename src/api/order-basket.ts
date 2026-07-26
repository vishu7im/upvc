// =====================================================================
// api/order-basket.ts — turning a stored order into priced basket lines.
//
// The ARITHMETIC lives in the pure `src/designer/basket.ts`; this module is
// the I/O half: it reads the order's items (legacy + designer), prices each
// one through the engine, loads the discount row, and hands both halves to
// `computeBasket()`. Every surface that shows a total goes through here, so
// the API response, the orders list, the order detail card and the Price
// Summary document cannot disagree (phase-6 acceptance §1).
//
// Draft orders are priced LIVE (prices move until you confirm). Confirmed
// orders serve the `basketTotals` snapshot frozen at confirm — immutability is
// the whole point of a confirmed order.
// =====================================================================

import { prisma } from "../db/client.ts";
import { solve } from "../engine/solve.ts";
import { aggregateOrder, type ItemForAggregation } from "../engine/aggregate.ts";
import { DEFAULT_SETTINGS, getSystem } from "../catalog/index.ts";
import { resolveLineItem } from "../designer/resolve.ts";
import {
  computeBasket,
  type BasketDiscount,
  type BasketItemInput,
  type BasketTotals,
} from "../designer/basket.ts";
import type { LineItemDraft } from "../designer/line-item-types.ts";
import { liveCatalogSnapshot } from "./lineitems.ts";
import type { EngineOverrides, QuoteInput, Pricing } from "../types.ts";

/** The commercial columns as Prisma returns them (Decimal | null). */
export interface OrderCommercialRow {
  id: string;
  status: string;
  fittingType: string | null;
  fittingPrice: unknown;
  surveyPrice: unknown;
  deliveryCharge: unknown;
  discountCode: string | null;
  discountAmount: unknown;
  taxRatePct: unknown;
  basketTotals: unknown;
}

/** Prisma Decimal | null | undefined → number | null. */
export function dec(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Look up a discount code row and shape it for the pure function. */
export async function loadDiscount(code: string | null): Promise<BasketDiscount | null> {
  if (!code) return null;
  const row = await prisma.discountCode.findUnique({ where: { code } });
  if (!row) return null;
  return {
    code: row.code,
    kind: row.kind as BasketDiscount["kind"],
    value: Number(row.value),
    active: row.active,
    validFrom: row.validFrom,
    validTo: row.validTo,
  };
}

export interface CollectedOrderPricing {
  items: BasketItemInput[];
  /**
   * The order priced as ONE job by `aggregateOrder()` (flat setup labour once,
   * wastage over merged material) — what the BOM and Price Summary print, and
   * therefore what the basket charges. null when nothing could be solved.
   */
  aggregateNetPrice: number | null;
}

/**
 * Price every line on the order: legacy items through `solve()`, designer items
 * through the resolver, plus the one aggregated order price the documents use.
 * A line the engine cannot price is kept (at its confirm-time snapshot, or £0)
 * and flagged with an error count — a silently missing line would understate
 * the order.
 */
export async function collectBasketItems(
  orderId: string,
  opts: { useSnapshots?: boolean } = {},
): Promise<CollectedOrderPricing> {
  const [legacy, designer] = await Promise.all([
    prisma.orderItem.findMany({
      where: { orderId },
      orderBy: { id: "asc" },
      include: { design: { select: { name: true } } },
    }),
    prisma.designerLineItem.findMany({ where: { orderId }, orderBy: { position: "asc" } }),
  ]);

  const out: BasketItemInput[] = [];
  const solved: ItemForAggregation[] = [];
  let systemId: string | null = legacy[0]?.systemId ?? null;

  for (const item of legacy) {
    let netPrice = 0;
    let errorCount = 0;
    try {
      const output = solve(
        buildQuoteInput("", "", null, {
          designId: item.designId,
          widthMm: item.widthMm,
          heightMm: item.heightMm,
          systemId: item.systemId,
          mode: item.mode as "default" | "custom",
          overrides: item.overrides as EngineOverrides | null,
          splitRatios: item.splitRatios as Record<string, number> | null,
          frameKey: item.frameKey,
          cillKey: item.cillKey,
          colourKeyInside: item.colourKeyInside,
          colourKeyOutside: item.colourKeyOutside,
        }),
      );
      netPrice = output.pricing.totals.netPrice;
      solved.push({ output, qty: item.qty });
    } catch {
      // Unpriceable line: fall back to the confirm-time snapshot when there is
      // one, and flag it either way — never silently drop a line.
      const snap = item.pricingSnapshot as Pricing["totals"] | null;
      netPrice = opts.useSnapshots && typeof snap?.netPrice === "number" ? snap.netPrice : 0;
      errorCount = 1;
    }
    out.push({
      id: item.id,
      kind: "legacy",
      label: `${item.design.name} — ${item.widthMm} × ${item.heightMm} mm`,
      qty: item.qty,
      netPrice,
      errorCount,
    });
  }

  const catalog = designer.length ? liveCatalogSnapshot() : null;
  for (const row of designer) {
    const draft = row.draft as unknown as LineItemDraft;
    // Always re-resolve rather than reading the cached `resolved`: the aggregate
    // needs the engine OUTPUT, which the cache does not carry, so a cache hit
    // would still cost one resolve — and a stale cached price would then
    // disagree with the aggregate computed beside it. The resolver is pure and
    // this is what the confirm path does too.
    const { resolved, output } = resolveLineItem(draft, catalog!);
    const qty = Math.max(1, draft.quantity ?? 1);
    if (output) {
      solved.push({ output, qty });
      systemId ??= draft.systemId;
    }
    out.push({
      id: row.id,
      kind: "designer",
      label:
        `${resolved.summary?.sizeLabel ?? `${draft.dimensions.widthMm} × ${draft.dimensions.heightMm} mm`}` +
        `${draft.location ? ` — ${draft.location}` : ""}`,
      qty,
      netPrice: resolved.pricing?.totals.netPrice ?? 0,
      errorCount: resolved.issues.filter((i) => i.severity === "error").length,
    });
  }

  // One aggregated price for the whole order — the same call the confirm path
  // and the documents make, so the basket charges exactly what they print.
  let aggregateNetPrice: number | null = null;
  const system = systemId ? getSystem(systemId) : null;
  if (system && solved.length > 0) {
    try {
      aggregateNetPrice = aggregateOrder(solved, system, DEFAULT_SETTINGS).pricing.totals.netPrice;
    } catch {
      aggregateNetPrice = null; // fall back to the line sum
    }
  }

  return { items: out, aggregateNetPrice };
}

/**
 * The order's basket totals. Confirmed orders replay their frozen snapshot;
 * drafts are recomputed from live prices.
 */
export async function computeOrderBasket(order: OrderCommercialRow): Promise<BasketTotals> {
  if (order.status === "confirmed" && order.basketTotals) {
    return order.basketTotals as unknown as BasketTotals;
  }
  const { items, aggregateNetPrice } = await collectBasketItems(order.id, {
    useSnapshots: order.status === "confirmed",
  });
  const discount = await loadDiscount(order.discountCode);
  return computeBasket(
    items,
    {
      fittingType: order.fittingType,
      fittingPrice: dec(order.fittingPrice),
      surveyPrice: dec(order.surveyPrice),
      deliveryCharge: dec(order.deliveryCharge),
      discount,
      taxRatePct: dec(order.taxRatePct),
    },
    DEFAULT_SETTINGS,
    new Date(),
    { aggregateNetPrice },
  );
}

/**
 * Build a `QuoteInput` from a stored item. Shared by the confirm path, the
 * add-item validation and the basket pricing above so all three price an item
 * exactly the same way.
 */
export function buildQuoteInput(
  orderNo: string,
  customer: string,
  reference: string | null,
  rest: {
    designId: string;
    widthMm: number;
    heightMm: number;
    systemId: string;
    mode?: "default" | "custom";
    overrides?: EngineOverrides | null;
    splitRatios?: Record<string, number> | null;
    frameKey?: string | null;
    cillKey?: string | null;
    colourKeyInside?: string | null;
    colourKeyOutside?: string | null;
  },
): QuoteInput {
  return {
    orderNo,
    customer,
    reference: reference ?? undefined,
    designId: rest.designId,
    widthMm: rest.widthMm,
    heightMm: rest.heightMm,
    systemId: rest.systemId,
    mode: rest.mode,
    overrides: rest.overrides ?? undefined,
    splitRatios: rest.splitRatios ?? undefined,
    frameKey: rest.frameKey ?? undefined,
    cillKey: rest.cillKey ?? undefined,
    colourKey: rest.colourKeyInside ?? undefined,
    colourKeyOutside: rest.colourKeyOutside ?? undefined,
  };
}
