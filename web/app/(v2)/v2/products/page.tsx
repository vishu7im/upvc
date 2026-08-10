import {
  Alert,
  ButtonLink,
  Card,
  Cluster,
  EmptyState,
  PageFrame,
  PageHeading,
  Section,
  Stack,
  StatusChip,
} from "@/components/v2";
import { requirePagePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { serverApiGet } from "@/lib/server-api";
import type { Paginated, ProductSummary } from "@/lib/types";
import {
  positiveCatalogPage,
  productDesignsHref,
  productsHref,
} from "@/lib/v2/products";

export const dynamic = "force-dynamic";

export default async function V2ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; orderId?: string }>;
}) {
  const user = await requirePagePermission("products", "view");
  const parameters = await searchParams;
  const page = positiveCatalogPage(parameters.page);
  const orderId = parameters.orderId;

  let result: Paginated<ProductSummary> | null = null;
  let loadError: string | null = null;
  try {
    result = await serverApiGet<Paginated<ProductSummary>>(
      `/api/products?page=${page}&limit=24`,
    );
  } catch (caught) {
    loadError = caught instanceof Error ? caught.message : "The product catalog did not respond.";
  }

  const canStartQuote = can(user, "quotes", "view");
  const total = result?.pagination.total ?? 0;

  return (
    <PageFrame width="wide">
      <Stack gap="section">
        <PageHeading
          actions={canStartQuote ? (
            <ButtonLink href="/v2/configure?mode=standard" icon="arrow-right">
              Start by task
            </ButtonLink>
          ) : undefined}
          description={result
            ? `${total} product ${total === 1 ? "line" : "lines"}, grouped before their individual layouts.`
            : "Browse product lines and their fabrication layouts."}
          eyebrow="Product catalog"
          title="Products"
        />

        {orderId ? (
          <Alert title="Adding to an existing order">
            Your order context will stay attached while you browse and choose a configurable layout.
          </Alert>
        ) : null}

        {loadError ? (
          <Card
            elevation="flat"
            state={{
              status: "error",
              title: "Products could not be loaded",
              description: loadError,
              recovery: { label: "Try again", href: productsHref({ page, orderId }) },
            }}
          >
            <span />
          </Card>
        ) : result?.data.length ? (
          <Section
            actions={<span className="v2-metadata">Page {result.pagination.page} of {result.pagination.pages}</span>}
            description="Open one product line to see its configurable and reference layouts."
            title="Product lines"
          >
            <div className="v2-product-grid">
              {result.data.map((product) => (
                <Card
                  actions={<StatusChip label={`${product.designCount} ${product.designCount === 1 ? "layout" : "layouts"}`} />}
                  description={product.typeId}
                  key={product.id}
                  title={product.name}
                >
                  <dl className="v2-product-facts">
                    <div>
                      <dt>Profile system</dt>
                      <dd>{product.systemId}</dd>
                    </div>
                    <div>
                      <dt>Catalog type</dt>
                      <dd>{product.typeId}</dd>
                    </div>
                  </dl>
                  <ButtonLink
                    href={productDesignsHref(product.id, { orderId })}
                    icon="arrow-right"
                    variant="secondary"
                  >
                    View layouts
                  </ButtonLink>
                </Card>
              ))}
            </div>
          </Section>
        ) : (
          <EmptyState
            description="Product lines will appear after the fabrication catalog is loaded."
            title="No products available"
          />
        )}

        {result && result.pagination.pages > 1 ? (
          <nav aria-label="Products pagination" className="v2-product-pager">
            <span>Page {result.pagination.page} of {result.pagination.pages}</span>
            <Cluster>
              {page > 1 ? (
                <ButtonLink href={productsHref({ page: page - 1, orderId })} variant="secondary">
                  Previous
                </ButtonLink>
              ) : null}
              {page < result.pagination.pages ? (
                <ButtonLink href={productsHref({ page: page + 1, orderId })} variant="secondary">
                  Next
                </ButtonLink>
              ) : null}
            </Cluster>
          </nav>
        ) : null}
      </Stack>
    </PageFrame>
  );
}
