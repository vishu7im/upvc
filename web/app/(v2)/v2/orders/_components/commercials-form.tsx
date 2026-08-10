"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Grid,
  SelectField,
  Stack,
  TextField,
  useToast,
} from "@/components/v2";
import { apiSend, ApiError } from "@/lib/api";
import type { BasketTotals, FittingType, OrderDetail } from "@/lib/types";
import { commercialNumber } from "@/lib/v2/orders";
import { BasketLedger } from "./basket-ledger";

interface CommercialDraft {
  fittingType: FittingType;
  fittingPrice: string;
  surveyPrice: string;
  deliveryCharge: string;
  discountCode: string;
  taxRatePct: string;
}

const FITTING_OPTIONS: ReadonlyArray<{ value: FittingType; label: string }> = [
  { value: "none", label: "Supply only" },
  { value: "fit", label: "Supply and fit" },
  { value: "fit-and-survey", label: "Fit and survey" },
];

function draftFromOrder(order: OrderDetail, basket: BasketTotals): CommercialDraft {
  return {
    fittingType: order.fittingType ?? basket.fittingType ?? "none",
    fittingPrice: order.fittingPrice == null ? "" : String(order.fittingPrice),
    surveyPrice: order.surveyPrice == null ? "" : String(order.surveyPrice),
    deliveryCharge: order.deliveryCharge == null ? "" : String(order.deliveryCharge),
    discountCode: order.discountCode ?? "",
    taxRatePct: order.taxRatePct == null ? "" : String(order.taxRatePct),
  };
}

export function CommercialsForm({ editable, order }: { editable: boolean; order: OrderDetail }) {
  const initialBasket = order.basket!;
  const router = useRouter();
  const { showToast } = useToast();
  const [basket, setBasket] = useState(initialBasket);
  const [draft, setDraft] = useState<CommercialDraft>(() => draftFromOrder(order, initialBasket));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof CommercialDraft>(key: K, value: CommercialDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fittingPrice = commercialNumber(draft.fittingPrice);
    const surveyPrice = commercialNumber(draft.surveyPrice);
    const deliveryCharge = commercialNumber(draft.deliveryCharge);
    const taxRatePct = commercialNumber(draft.taxRatePct);
    if ([fittingPrice, surveyPrice, deliveryCharge, taxRatePct].includes(undefined)) {
      setError("Prices and the tax rate must be zero or a positive number.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await apiSend<{ basket: BasketTotals }>(
        `/api/orders/${encodeURIComponent(order.id)}/commercials`,
        "PUT",
        {
          fittingType: draft.fittingType,
          fittingPrice,
          surveyPrice,
          deliveryCharge,
          discountCode: draft.discountCode.trim() || null,
          taxRatePct,
        },
      );
      setBasket(response.basket);
      showToast({ tone: "success", title: "Customer price saved", description: "The server total and order documents now use these values." });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save the customer price.");
    } finally {
      setSaving(false);
    }
  }

  if (!editable) {
    return (
      <Grid columns="two">
        <Card description="Reopen the order before changing fitting, delivery, discounts, or tax." title="Commercial settings">
          <Alert title="Confirmed price" tone="success">
            These values are frozen at confirmation and match the generated customer paperwork.
          </Alert>
        </Card>
        <BasketLedger basket={basket} frozen />
      </Grid>
    );
  }

  const fittingDisabled = draft.fittingType === "none";
  const surveyDisabled = draft.fittingType !== "fit-and-survey";

  return (
    <form onSubmit={save}>
      <Grid columns="two">
        <Card
          description="Save changes to ask the pricing service for a new basket total."
          title="Commercial settings"
        >
          <Stack gap="form">
            <SelectField
              disabled={saving}
              label="Fitting"
              onChange={(event) => set("fittingType", event.target.value as FittingType)}
              options={FITTING_OPTIONS}
              value={draft.fittingType}
            />
            <Grid columns="two">
              <TextField
                disabled={saving || fittingDisabled}
                hint={fittingDisabled ? "Not charged for supply-only orders." : undefined}
                inputMode="decimal"
                label="Fitting price"
                min="0"
                onChange={(event) => set("fittingPrice", event.target.value)}
                step="0.01"
                type="number"
                value={draft.fittingPrice}
              />
              <TextField
                disabled={saving || surveyDisabled}
                hint={surveyDisabled ? "Available when Fit and survey is selected." : undefined}
                inputMode="decimal"
                label="Survey price"
                min="0"
                onChange={(event) => set("surveyPrice", event.target.value)}
                step="0.01"
                type="number"
                value={draft.surveyPrice}
              />
              <TextField
                disabled={saving}
                hint="Charged independently of fitting."
                inputMode="decimal"
                label="Delivery"
                min="0"
                onChange={(event) => set("deliveryCharge", event.target.value)}
                step="0.01"
                type="number"
                value={draft.deliveryCharge}
              />
              <TextField
                disabled={saving}
                hint={`Leave blank to use the company setting; current basket is ${basket.taxRatePct}%.`}
                inputMode="decimal"
                label="Tax rate override"
                min="0"
                onChange={(event) => set("taxRatePct", event.target.value)}
                step="0.01"
                type="number"
                unit="%"
                value={draft.taxRatePct}
              />
            </Grid>
            <TextField
              disabled={saving}
              hint="The service validates active and expiry rules when saved."
              label="Discount code"
              onChange={(event) => set("discountCode", event.target.value)}
              value={draft.discountCode}
            />
            {error ? <Alert title="Could not save customer price" tone="error">{error}</Alert> : null}
            <Button loading={saving} loadingLabel="Saving customer price" type="submit">Save customer price</Button>
          </Stack>
        </Card>
        <BasketLedger basket={basket} />
      </Grid>
    </form>
  );
}
