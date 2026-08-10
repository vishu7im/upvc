import { Alert, ButtonLink, Cluster, EmptyState, Section, Stack, StatusChip } from "@/components/v2";
import { requirePagePermission } from "@/lib/authz";
import { money } from "@/lib/format";
import { can } from "@/lib/permissions";
import { configureHref } from "@/lib/v2/configure";
import { unifiedOrderLines } from "@/lib/v2/orders";
import { RemoveOrderLineAction } from "../../_components/order-actions";
import { OrderPageChrome } from "../../_components/order-chrome";
import { getV2Order } from "../../_components/order-data";

export const dynamic = "force-dynamic";

export default async function V2OrderItemsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("orders", "read");
  const { id } = await params;
  const order = await getV2Order(id);
  const lines = unifiedOrderLines(order);
  const editable = order.status === "draft" && can(user, "orders", "create");
  const canConfigure = editable && can(user, "quotes", "view") && can(user, "quotes", "create");
  const currency = order.basket?.currency ?? "GBP";
  const addHref = configureHref({ mode: "standard", orderId: order.id });

  return (
    <OrderPageChrome
      actions={canConfigure && lines.length > 0 ? <ButtonLink href={addHref}>Add item</ButtonLink> : undefined}
      current="items"
      order={order}
    >
      <Stack gap="section">
        {canConfigure ? (
          <Alert title="Configure in context" tone="neutral">
            Add and edit actions now stay inside the V2 Quote workspace with this order preserved.
          </Alert>
        ) : order.status === "confirmed" ? (
          <Alert title="Items are frozen" tone="success">
            Reopen this order from Overview before changing or removing an item.
          </Alert>
        ) : null}

        <Section
          description="All configured units share one list and use the server basket for line prices."
          title="Order items"
        >
          {lines.length === 0 ? (
            <EmptyState
              action={canConfigure ? { label: "Add first item", href: addHref } : undefined}
              description={canConfigure ? "Choose a family and compatible layout for the first unit." : "This order has no configured items."}
              title="No items yet"
            />
          ) : (
            <ul className="v2-order-lines">
              {lines.map((line) => (
                <li key={`${line.kind}-${line.id}`}>
                  <div className="v2-order-line-identity">
                    <strong>{line.name}</strong>
                    {line.detail ? <span>{line.detail}</span> : null}
                    <span>{line.size}</span>
                  </div>
                  <dl>
                    <div><dt>Quantity</dt><dd>{line.quantity}</dd></div>
                    <div><dt>Line price</dt><dd>{money(line.lineNetPrice, currency)}</dd></div>
                  </dl>
                  {line.issueMessages.length > 0 ? (
                    <div className="v2-order-line-issues">
                      <StatusChip label={`${line.issueMessages.length} to fix`} tone="error" />
                      <ul>
                        {line.issueMessages.map((message, index) => <li key={`${line.id}-issue-${index}`}>{message}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  {editable ? (
                    <Cluster>
                      {canConfigure && line.editHref ? <ButtonLink href={line.editHref} variant="secondary">Edit item</ButtonLink> : null}
                      <RemoveOrderLineAction itemId={line.id} kind={line.kind} orderId={order.id} />
                    </Cluster>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </Stack>
    </OrderPageChrome>
  );
}
