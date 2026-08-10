import { notFound } from "next/navigation";
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
import { ApiError } from "@/lib/api";
import { can } from "@/lib/permissions";
import { serverApiGet } from "@/lib/server-api";
import { normalizeSvgForPreview } from "@/lib/svg-preview";
import type {
  DesignDetail,
  DesignListItem,
  FamilyResponse,
  FamilySummary,
  Paginated,
  ProductSummary,
} from "@/lib/types";
import {
  catalogConfigureMode,
  layoutConfigureHref,
  partitionCatalogDesigns,
  positiveCatalogPage,
  productDesignsHref,
  productsHref,
  type CatalogConfigureMode,
} from "@/lib/v2/products";

export const dynamic = "force-dynamic";

const GALLERY_LIMIT = 24;

interface DesignPreview {
  design: DesignListItem;
  svg: string | null;
}

async function familyForProduct(productId: string): Promise<string | undefined> {
  try {
    const families = await serverApiGet<FamilySummary[]>("/api/families");
    const descriptors = await Promise.all(
      families.map((family) =>
        serverApiGet<FamilyResponse>(`/api/families/${encodeURIComponent(family.familyKey)}`)
          .catch(() => null),
      ),
    );
    return descriptors.find((descriptor) =>
      descriptor?.family.designSource.productIds?.includes(productId),
    )?.family.familyKey;
  } catch {
    return undefined;
  }
}

async function productOrNotFound(id: string): Promise<ProductSummary> {
  try {
    return await serverApiGet<ProductSummary>(`/api/products/${encodeURIComponent(id)}`);
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 404) notFound();
    throw caught;
  }
}

async function previewsFor(designs: ReadonlyArray<DesignListItem>): Promise<DesignPreview[]> {
  return Promise.all(
    designs.map(async (design) => {
      const svg = await serverApiGet<DesignDetail>(
        `/api/designs/${encodeURIComponent(design.designId)}`,
      )
        .then((detail) => detail.imageSvg)
        .catch(() => null);
      return { design, svg };
    }),
  );
}

function ModeChoice({
  productId,
  mode,
  page,
  orderId,
}: {
  productId: string;
  mode: CatalogConfigureMode;
  page: number;
  orderId?: string;
}) {
  return (
    <nav aria-label="Choose how to use a configurable layout" className="v2-product-mode-choice">
      <ButtonLink
        href={productDesignsHref(productId, { page, orderId, mode: "standard" })}
        variant={mode === "standard" ? "primary" : "secondary"}
      >
        Standard quote
      </ButtonLink>
      <ButtonLink
        href={productDesignsHref(productId, { page, orderId, mode: "custom" })}
        variant={mode === "custom" ? "primary" : "secondary"}
      >
        Custom unit
      </ButtonLink>
    </nav>
  );
}

function DesignPreviewCard({
  preview,
  mode,
  product,
  family,
  orderId,
  canConfigure,
}: {
  preview: DesignPreview;
  mode: CatalogConfigureMode;
  product: ProductSummary;
  family?: string;
  orderId?: string;
  canConfigure: boolean;
}) {
  const { design, svg } = preview;
  const href = canConfigure
    ? layoutConfigureHref({
        mode,
        family,
        designId: design.designId,
        systemId: product.systemId,
        productId: product.id,
        orderId,
      })
    : null;

  return (
    <Card
      actions={<StatusChip label={design.quotable ? "Configurable" : "Reference only"} tone={design.quotable ? "success" : "neutral"} />}
      description={`${design.quantityOfSquares} ${design.quantityOfSquares === 1 ? "leaf" : "leaves"}`}
      title={design.name}
    >
      <div className="v2-product-preview">
        {svg ? (
          <div
            className="v2-product-preview-image"
            dangerouslySetInnerHTML={{ __html: normalizeSvgForPreview(svg) }}
          />
        ) : (
          <div className="v2-product-preview-missing">
            <strong>No preview available</strong>
            <span>The layout details are still available.</span>
          </div>
        )}
      </div>
      <p className="v2-product-layout-id">Layout {design.designId}</p>
      {href && design.quotable ? (
        <ButtonLink href={href} icon="arrow-right" variant="secondary">
          {mode === "custom" ? "Customise this layout" : orderId ? "Configure and add" : "Start standard quote"}
        </ButtonLink>
      ) : design.quotable && mode === "custom" && !family ? (
        <p className="v2-product-unavailable">This product is not assigned to an active Custom family.</p>
      ) : design.quotable && !canConfigure ? (
        <p className="v2-product-unavailable">Your access allows browsing, but not configuration.</p>
      ) : (
        <p className="v2-product-unavailable">Preview for reference; this catalog record cannot start a configuration.</p>
      )}
    </Card>
  );
}

export default async function V2ProductDesignsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; orderId?: string; mode?: string }>;
}) {
  const user = await requirePagePermission("products", "read");
  const { id } = await params;
  const parameters = await searchParams;
  const page = positiveCatalogPage(parameters.page);
  const orderId = parameters.orderId;
  const mode = catalogConfigureMode(parameters.mode);

  let product: ProductSummary | null = null;
  let designs: Paginated<DesignListItem> | null = null;
  let family: string | undefined;
  let loadError: string | null = null;
  try {
    product = await productOrNotFound(id);
    [designs, family] = await Promise.all([
      serverApiGet<Paginated<DesignListItem>>(
        `/api/products/${encodeURIComponent(id)}/designs?page=${page}&limit=${GALLERY_LIMIT}`,
      ),
      familyForProduct(id),
    ]);
  } catch (caught) {
    loadError = caught instanceof Error ? caught.message : "The product layouts did not respond.";
  }

  const previewRows = designs ? await previewsFor(designs.data) : [];
  const groups = partitionCatalogDesigns(previewRows.map((entry) => entry.design));
  const previewById = new Map(previewRows.map((entry) => [entry.design.designId, entry]));
  const configurable = groups.configurable.map((design) => previewById.get(design.designId)!);
  const reference = groups.reference.map((design) => previewById.get(design.designId)!);
  const canConfigure = can(user, "quotes", "view");
  const retryHref = productDesignsHref(id, { page, orderId, mode });

  return (
    <PageFrame width="wide">
      <Stack gap="section">
        <PageHeading
          actions={product && designs ? (
            <ModeChoice
              mode={mode}
              orderId={orderId}
              page={designs.pagination.page}
              productId={product.id}
            />
          ) : undefined}
          description={product && designs
            ? `${designs.pagination.total} catalog ${designs.pagination.total === 1 ? "layout" : "layouts"}. Choose Standard for essentials or Custom for structural editing.`
            : "Review the product's fabrication layouts."}
          eyebrow="Product layouts"
          title={product?.name ?? "Product"}
        />

        <Cluster>
          <ButtonLink href={productsHref({ orderId })} variant="ghost">All products</ButtonLink>
          {product ? <StatusChip label={product.systemId} /> : null}
          {product ? <StatusChip label={product.typeId} /> : null}
        </Cluster>

        {orderId ? (
          <Alert title="Order context retained">
            The layout you configure will be added to the active draft order.
          </Alert>
        ) : null}

        {mode === "custom" && product && !family ? (
          <Alert title="Custom setup unavailable" tone="warning">
            This product is not assigned to an active Custom family. Standard quoting remains available.
          </Alert>
        ) : null}

        {loadError ? (
          <Card
            elevation="flat"
            state={{
              status: "error",
              title: "Layouts could not be loaded",
              description: loadError,
              recovery: { label: "Try again", href: retryHref },
            }}
          >
            <span />
          </Card>
        ) : designs?.data.length === 0 ? (
          <EmptyState
            action={{ label: "Back to products", href: productsHref({ orderId }) }}
            description="This product line does not currently contain any catalog layouts."
            title="No layouts in this product"
          />
        ) : product && designs ? (
          <>
            <Section
              actions={<StatusChip label={`${configurable.length} on this page`} tone="success" />}
              description={mode === "custom"
                ? "Each action opens the shared workspace with component and structural tools disclosed."
                : "Each action opens the shared workspace with the essential quoting controls first."}
              title="Ready to configure"
            >
              {configurable.length ? (
                <div className="v2-product-design-grid">
                  {configurable.map((preview) => (
                    <DesignPreviewCard
                      canConfigure={canConfigure}
                      family={family}
                      key={preview.design.designId}
                      mode={mode}
                      orderId={orderId}
                      preview={preview}
                      product={product}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  description="This catalog page contains reference layouts only. Use the catalog pagination to continue browsing."
                  title="No configurable layouts on this page"
                />
              )}
            </Section>

            {reference.length ? (
              <Section
                actions={<StatusChip label={`${reference.length} on this page`} />}
                description="These records remain visible for catalog parity, but they do not offer a configuration action."
                title="Reference previews"
              >
                <div className="v2-product-design-grid">
                  {reference.map((preview) => (
                    <DesignPreviewCard
                      canConfigure={false}
                      family={family}
                      key={preview.design.designId}
                      mode={mode}
                      orderId={orderId}
                      preview={preview}
                      product={product}
                    />
                  ))}
                </div>
              </Section>
            ) : null}
          </>
        ) : null}

        {designs && designs.pagination.pages > 1 ? (
          <nav aria-label="Catalog layout pagination" className="v2-product-pager">
            <span>Catalog page {designs.pagination.page} of {designs.pagination.pages}</span>
            <Cluster>
              {page > 1 ? (
                <ButtonLink
                  href={productDesignsHref(id, { page: page - 1, orderId, mode })}
                  variant="secondary"
                >
                  Previous
                </ButtonLink>
              ) : null}
              {page < designs.pagination.pages ? (
                <ButtonLink
                  href={productDesignsHref(id, { page: page + 1, orderId, mode })}
                  variant="secondary"
                >
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
