"use client";

// =====================================================================
// Pricing & extras (Designer phase 6) — the order's commercial layer.
//
// The panel NEVER does arithmetic. Every number it shows comes from the
// server's `BasketTotals`, which is `src/designer/basket.ts` — the same
// function the Price Summary document and the orders list use. Editing a field
// PUTs /api/orders/:id/commercials and re-renders from the totals that come
// back, so the screen can never disagree with the paperwork.
//
// Confirmed orders render the frozen snapshot read-only: a confirmed order is
// an immutable record of what the customer agreed to.
// =====================================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import type { BasketTotals, FittingType, OrderDetail } from "@/lib/types";
import { Badge, Button, Card, FieldLabel, SectionHeader, fieldClass } from "@/components/ui";
import { Icon } from "@/components/icons";

const FITTING_OPTIONS: { value: FittingType; label: string; hint: string }[] = [
  { value: "none", label: "Supply only", hint: "No fitting or survey charged" },
  { value: "fit", label: "Supply & fit", hint: "Fitting charged, survey not" },
  { value: "fit-and-survey", label: "Fit + survey", hint: "Both charged" },
];

interface Draft {
  fittingType: FittingType;
  fittingPrice: string;
  surveyPrice: string;
  deliveryCharge: string;
  discountCode: string;
  taxRatePct: string;
}

function toDraft(order: OrderDetail, basket: BasketTotals): Draft {
  return {
    fittingType: (order.fittingType as FittingType) ?? basket.fittingType ?? "none",
    fittingPrice: order.fittingPrice != null ? String(order.fittingPrice) : "",
    surveyPrice: order.surveyPrice != null ? String(order.surveyPrice) : "",
    deliveryCharge: order.deliveryCharge != null ? String(order.deliveryCharge) : "",
    discountCode: order.discountCode ?? "",
    taxRatePct: order.taxRatePct != null ? String(order.taxRatePct) : "",
  };
}

/** "" ⇒ null (clears the column); otherwise a number, or undefined if unparseable. */
function num(v: string): number | null | undefined {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export default function PricingPanel({
  order,
  editable,
}: {
  order: OrderDetail;
  editable: boolean;
}) {
  const router = useRouter();
  const initial = order.basket!;
  const [basket, setBasket] = useState<BasketTotals>(initial);
  const [draft, setDraft] = useState<Draft>(() => toDraft(order, initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const c = basket.currency;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  };

  async function save() {
    const fittingPrice = num(draft.fittingPrice);
    const surveyPrice = num(draft.surveyPrice);
    const deliveryCharge = num(draft.deliveryCharge);
    const taxRatePct = num(draft.taxRatePct);
    if ([fittingPrice, surveyPrice, deliveryCharge, taxRatePct].includes(undefined)) {
      setError("Prices and the tax rate must be zero or a positive number.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiSend<{ basket: BasketTotals }>(
        `/api/orders/${order.id}/commercials`,
        "PUT",
        {
          fittingType: draft.fittingType,
          fittingPrice,
          surveyPrice,
          deliveryCharge,
          taxRatePct,
          discountCode: draft.discountCode.trim() || null,
        },
      );
      setBasket(res.basket);
      setSaved(true);
      router.refresh(); // the header badge + list totals read the same numbers
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the pricing changes");
    } finally {
      setSaving(false);
    }
  }

  const surveyDisabled = draft.fittingType !== "fit-and-survey";
  const fittingDisabled = draft.fittingType === "none";

  return (
    <Card className="overflow-hidden">
      <SectionHeader
        title="Pricing & extras"
        description={
          editable
            ? "Fitting, survey, delivery, discount and tax. Totals recalculate on save."
            : "Frozen at confirmation — these are the numbers on the customer's paperwork."
        }
        actions={
          editable ? (
            <div className="flex items-center gap-2">
              {saved && !saving && (
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600">
                  <Icon name="check" className="h-4 w-4" /> Saved
                </span>
              )}
              <Button onClick={save} disabled={saving} icon={saving ? undefined : "check"}>
                {saving ? "Saving…" : "Save pricing"}
              </Button>
            </div>
          ) : (
            <Badge tone="green">Confirmed</Badge>
          )
        }
      />

      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ---- inputs ---------------------------------------------- */}
        <div className={editable ? "" : "opacity-70"}>
          <fieldset disabled={!editable || saving} className="space-y-5">
            <div>
              <FieldLabel>Fitting</FieldLabel>
              <div className="grid gap-2 sm:grid-cols-3">
                {FITTING_OPTIONS.map((opt) => {
                  const active = draft.fittingType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set("fittingType", opt.value)}
                      className={
                        "rounded-md border px-3 py-2.5 text-left transition " +
                        (active
                          ? "border-[#4442e3] bg-[#e7e6ff] shadow-[0_1px_0_rgba(15,23,42,0.04)]"
                          : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50")
                      }
                      aria-pressed={active}
                    >
                      <span
                        className={
                          "block text-sm font-semibold " + (active ? "text-[#4442e3]" : "text-slate-800")
                        }
                      >
                        {opt.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">{opt.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <FieldLabel>Fitting price</FieldLabel>
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={draft.fittingPrice}
                  disabled={fittingDisabled}
                  onChange={(e) => set("fittingPrice", e.target.value)}
                />
                {fittingDisabled && (
                  <span className="mt-1 block text-xs text-slate-500">Not charged on supply-only</span>
                )}
              </label>
              <label className="block">
                <FieldLabel>Survey price</FieldLabel>
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={draft.surveyPrice}
                  disabled={surveyDisabled}
                  onChange={(e) => set("surveyPrice", e.target.value)}
                />
                {surveyDisabled && (
                  <span className="mt-1 block text-xs text-slate-500">Needs “Fit + survey”</span>
                )}
              </label>
              <label className="block">
                <FieldLabel>Delivery</FieldLabel>
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={draft.deliveryCharge}
                  onChange={(e) => set("deliveryCharge", e.target.value)}
                />
                <span className="mt-1 block text-xs text-slate-500">Charged independently</span>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>Discount code</FieldLabel>
                <input
                  className={fieldClass + " uppercase"}
                  placeholder="e.g. SAVE10"
                  value={draft.discountCode}
                  onChange={(e) => set("discountCode", e.target.value)}
                />
                <span className="mt-1 block text-xs text-slate-500">
                  Validated on save — expired or inactive codes are rejected
                </span>
              </label>
              <label className="block">
                <FieldLabel>Tax rate override (%)</FieldLabel>
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  placeholder={`Default ${initial.taxRatePct}%`}
                  value={draft.taxRatePct}
                  onChange={(e) => set("taxRatePct", e.target.value)}
                />
                <span className="mt-1 block text-xs text-slate-500">
                  Leave blank to use the company VAT setting
                </span>
              </label>
            </div>
          </fieldset>

          {error && (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
              {error}
            </p>
          )}
        </div>

        {/* ---- totals ---------------------------------------------- */}
        <BasketSummary basket={basket} currency={c} />
      </div>
    </Card>
  );
}

/** The read-only totals ledger — shown on drafts and confirmed orders alike. */
export function BasketSummary({ basket, currency }: { basket: BasketTotals; currency: string }) {
  const row = (label: string, value: number, hint?: string) => (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-sm text-slate-600">
        {label}
        {hint && <span className="ml-1 text-xs text-slate-400">{hint}</span>}
      </span>
      <span className="font-mono text-sm font-semibold text-slate-900">{money(value, currency)}</span>
    </div>
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">Order total</p>
      <p className="mt-1 text-3xl font-bold text-slate-950">{money(basket.grandTotal, currency)}</p>

      <div className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
        <div className="py-1">
          {row("Items (net)", basket.itemsSubtotal)}
          {basket.itemsAdjustment !== 0 &&
            row("Order-level adjustment", basket.itemsAdjustment, "shared setup")}
          {basket.discount > 0 &&
            row(`Discount${basket.discountCode ? ` (${basket.discountCode})` : ""}`, -basket.discount)}
        </div>
        {basket.extras > 0 && (
          <div className="py-1">
            {basket.fitting > 0 && row("Fitting", basket.fitting)}
            {basket.survey > 0 && row("Survey", basket.survey)}
            {basket.delivery > 0 && row("Delivery", basket.delivery)}
          </div>
        )}
        <div className="py-1">
          {row("Subtotal", basket.taxableBase)}
          {row(`VAT (${basket.taxRatePct}%)`, basket.tax)}
        </div>
        <div className="flex items-baseline justify-between gap-4 pt-2">
          <span className="text-sm font-bold text-slate-900">Grand total</span>
          <span className="font-mono text-base font-bold text-slate-950">
            {money(basket.grandTotal, currency)}
          </span>
        </div>
      </div>

      {basket.lines.some((l) => l.errorCount > 0) && (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          Some lines could not be priced. Fix their issues before confirming.
        </p>
      )}
    </div>
  );
}
