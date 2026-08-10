import { Alert, ButtonLink, Card, Cluster, Grid, Stack } from "@/components/v2";
import { requirePagePermission } from "@/lib/authz";
import { money } from "@/lib/format";
import { can } from "@/lib/permissions";
import { orderGrandTotal, orderItemCount } from "@/lib/v2/orders";
import {
  ConfirmOrderAction,
  DeleteOrderAction,
  EditOrderAction,
  ReopenOrderAction,
} from "../_components/order-actions";
import { OrderPageChrome } from "../_components/order-chrome";
import { getV2Order } from "../_components/order-data";

export const dynamic = "force-dynamic";

export default async function V2OrderOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("orders", "read");
  const { id } = await params;
  const order = await getV2Order(id);
  const editable = order.status === "draft" && can(user, "orders", "create");
  const canMutate = can(user, "orders", "create");
  const canDelete = can(user, "orders", "delete");
  const count = orderItemCount(order);
  const total = orderGrandTotal(order);
  const currency = order.basket?.currency ?? "GBP";

  const actions = (
    <Cluster>
      {editable ? <EditOrderAction customerName={order.customerName} orderId={order.id} reference={order.reference} /> : null}
      {editable ? <ConfirmOrderAction disabled={count === 0} orderId={order.id} /> : null}
      {order.status === "confirmed" && canMutate ? <ReopenOrderAction orderId={order.id} orderNo={order.orderNo} /> : null}
      {order.status === "confirmed" ? <ButtonLink href={`/v2/orders/${encodeURIComponent(order.id)}/documents`}>View documents</ButtonLink> : null}
      {canDelete ? <DeleteOrderAction orderId={order.id} orderNo={order.orderNo} status={order.status} /> : null}
    </Cluster>
  );

  return (
    <OrderPageChrome actions={actions} current="overview" order={order}>
      <Stack gap="section">
        {order.status === "confirmed" ? (
          <Alert title="Confirmation is reversible" tone="success">
            This order is frozen with a generated document pack. Reopen it to correct details or items; the documents and cached PDFs will be removed and regenerated after the next confirmation.
          </Alert>
        ) : (
          <Alert title="Draft order" tone="neutral">
            Add and validate items, review the customer price, then confirm once. Confirmation opens the generated document pack.
          </Alert>
        )}

        <Grid columns="three">
          <Card description="Printed on every generated order document." title="Customer">
            <dl className="v2-order-detail-list">
              <div><dt>Name</dt><dd>{order.customerName}</dd></div>
              <div><dt>Reference</dt><dd>{order.reference || "Not provided"}</dd></div>
            </dl>
          </Card>
          <Card description={order.status === "draft" ? "Live server basket." : "Frozen at confirmation."} title="Order value">
            <p className="v2-order-emphasis">{money(total, currency)}</p>
            <ButtonLink href={`/v2/orders/${encodeURIComponent(order.id)}/customer-price`} variant="secondary">Open customer price</ButtonLink>
          </Card>
          <Card description={`${count} configured ${count === 1 ? "item" : "items"}.`} title="Items">
            <ButtonLink href={`/v2/orders/${encodeURIComponent(order.id)}/items`} variant="secondary">
              {editable ? "Review or change items" : "Review items"}
            </ButtonLink>
          </Card>
        </Grid>
      </Stack>
    </OrderPageChrome>
  );
}
