import { Alert, ButtonLink, Card, Cluster, EmptyState, Grid, Section, Stack, StatusChip } from "@/components/v2";
import { requirePagePermission } from "@/lib/authz";
import { dateShort } from "@/lib/format";
import { groupedOrderDocuments } from "@/lib/v2/orders";
import { OrderPageChrome } from "../../_components/order-chrome";
import { getV2Order } from "../../_components/order-data";

export const dynamic = "force-dynamic";

function fileName(label: string, variant: "normal" | "welded"): string {
  const stem = label.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "document";
  return `${stem}${variant === "welded" ? "-welded" : ""}.pdf`;
}

export default async function V2OrderDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("orders", "read");
  const { id } = await params;
  const order = await getV2Order(id);
  const groups = groupedOrderDocuments(order);
  const availableDocuments = groups.reduce((count, group) => count + group.documents.length, 0);

  return (
    <OrderPageChrome
      actions={<ButtonLink href={`/v2/orders/${encodeURIComponent(order.id)}`} variant="secondary">Back to overview</ButtonLink>}
      current="documents"
      order={order}
    >
      {order.status === "draft" ? (
        <EmptyState
          action={{ label: "Review before confirming", href: `/v2/orders/${encodeURIComponent(order.id)}` }}
          description="Confirm this order from Overview to generate its office, production, and dispatch documents."
          title="Documents are generated at confirmation"
        />
      ) : availableDocuments === 0 ? (
        <Alert title="Document pack is unavailable" tone="error">
          The order is confirmed but no stored documents were returned. Reopen and reconfirm the order, or retry after checking the document service.
        </Alert>
      ) : (
        <Stack gap="section">
          <Alert title={`${availableDocuments} document ${availableDocuments === 1 ? "type" : "types"} ready`} tone="success">
            View HTML in the browser or download the server-generated PDF. Welded variants are listed first where available.
          </Alert>
          {groups.map((group) => (
            <Section description={group.description} key={group.id} title={group.label}>
              {group.documents.length === 0 ? (
                <p className="v2-order-muted">No {group.label.toLocaleLowerCase()} documents were returned.</p>
              ) : (
                <Grid columns="three">
                  {group.documents.map((document) => (
                    <Card description={`${document.description} Generated ${dateShort(document.createdAt)}.`} key={document.type} title={document.label}>
                      <Stack gap="card">
                        {document.variants.map((variant) => {
                          const type = encodeURIComponent(document.type);
                          const variantQuery = encodeURIComponent(variant);
                          const base = `/api/orders/${encodeURIComponent(order.id)}/documents/${type}`;
                          return (
                            <div className="v2-document-variant" key={variant}>
                              <StatusChip
                                label={variant === "welded" ? "Welded saw-cut" : "Normal finished"}
                                tone={variant === "welded" ? "warning" : "neutral"}
                              />
                              <Cluster>
                                <ButtonLink href={`${base}?variant=${variantQuery}`} variant="secondary">View HTML</ButtonLink>
                                <ButtonLink
                                  download={fileName(document.label, variant)}
                                  href={`${base}/pdf?variant=${variantQuery}&download=1`}
                                  variant="ghost"
                                >
                                  Download PDF
                                </ButtonLink>
                              </Cluster>
                            </div>
                          );
                        })}
                      </Stack>
                    </Card>
                  ))}
                </Grid>
              )}
            </Section>
          ))}
        </Stack>
      )}
    </OrderPageChrome>
  );
}
