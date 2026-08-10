import { ButtonLink, ErrorState, Stack } from "@/components/v2";
import { requirePagePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { CommercialsForm } from "../../_components/commercials-form";
import { OrderPageChrome } from "../../_components/order-chrome";
import { getV2Order } from "../../_components/order-data";

export const dynamic = "force-dynamic";

export default async function V2OrderCustomerPricePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("orders", "read");
  const { id } = await params;
  const order = await getV2Order(id);
  const editable = order.status === "draft" && can(user, "orders", "create");

  return (
    <OrderPageChrome
      actions={<ButtonLink href={`/v2/orders/${encodeURIComponent(order.id)}`} variant="secondary">Back to overview</ButtonLink>}
      current="customer-price"
      order={order}
    >
      <Stack gap="section">
        {order.basket ? (
          <CommercialsForm editable={editable} order={order} />
        ) : (
          <ErrorState
            description="The order response did not include its server basket, so no totals are shown or reconstructed in the browser."
            recovery={{ label: "Reload order", href: `/v2/orders/${encodeURIComponent(order.id)}/customer-price` }}
            title="Customer price is unavailable"
          />
        )}
      </Stack>
    </OrderPageChrome>
  );
}
