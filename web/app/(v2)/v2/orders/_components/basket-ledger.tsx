import { Alert, Card, Stack } from "@/components/v2";
import { money } from "@/lib/format";
import type { BasketTotals } from "@/lib/types";

function LedgerRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div data-v2-ledger-total={strong || undefined}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function BasketLedger({ basket, frozen = false }: { basket: BasketTotals; frozen?: boolean }) {
  const currency = basket.currency;
  const itemErrors = basket.lines.reduce((count, line) => count + line.errorCount, 0);

  return (
    <Card
      description={frozen ? "Frozen when the order was confirmed." : "Calculated and returned by the pricing service."}
      title="Order total"
    >
      <Stack gap="card">
        {itemErrors > 0 ? (
          <Alert title={`${itemErrors} item ${itemErrors === 1 ? "issue" : "issues"} need attention`} tone="warning">
            Resolve the item errors before confirming this order.
          </Alert>
        ) : null}
        <dl className="v2-order-ledger">
          <LedgerRow label="Items (net)" value={money(basket.itemsSubtotal, currency)} />
          {basket.itemsAdjustment !== 0 ? <LedgerRow label="Order-level adjustment" value={money(basket.itemsAdjustment, currency)} /> : null}
          {basket.discount > 0 ? (
            <LedgerRow
              label={`Discount${basket.discountCode ? ` (${basket.discountCode})` : ""}`}
              value={`−${money(basket.discount, currency)}`}
            />
          ) : null}
          {basket.fitting > 0 ? <LedgerRow label="Fitting" value={money(basket.fitting, currency)} /> : null}
          {basket.survey > 0 ? <LedgerRow label="Survey" value={money(basket.survey, currency)} /> : null}
          {basket.delivery > 0 ? <LedgerRow label="Delivery" value={money(basket.delivery, currency)} /> : null}
          <LedgerRow label="Subtotal" value={money(basket.taxableBase, currency)} />
          <LedgerRow label={`VAT (${basket.taxRatePct}%)`} value={money(basket.tax, currency)} />
          <LedgerRow label="Grand total" strong value={money(basket.grandTotal, currency)} />
        </dl>
      </Stack>
    </Card>
  );
}
