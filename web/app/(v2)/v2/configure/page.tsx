import { notFound } from "next/navigation";
import {
  ButtonLink,
  Card,
  EmptyState,
  Grid,
  PageFrame,
  PageHeading,
  Stack,
  StatusChip,
} from "@/components/v2";
import { requirePagePermission } from "@/lib/authz";
import { ApiError } from "@/lib/api";
import { newDraft } from "@/lib/designer-draft";
import { can } from "@/lib/permissions";
import { serverApiGet } from "@/lib/server-api";
import type {
  DesignDetail,
  DesignListItem,
  FamilyResponse,
  FamilySummary,
  LineItemDraft,
  LineItemIssue,
  OrderDetail,
  Paginated,
  ProductSummary,
} from "@/lib/types";
import {
  configureHref,
  configureMode,
  productIdsForFamily,
  type ConfigureMode,
} from "@/lib/v2/configure";
import ConfigureWorkspace from "./_components/configure-workspace";

export const dynamic = "force-dynamic";

const FALLBACK_WIDTH_MM = 1200;
const FALLBACK_HEIGHT_MM = 1200;

interface ConfigureSearchParams {
  mode?: string;
  family?: string;
  design?: string;
  system?: string;
  designId?: string;
  systemId?: string;
  productId?: string;
  orderId?: string;
  itemId?: string;
  fromItem?: string;
}

interface StartingLayout {
  product: ProductSummary;
  design: DesignListItem;
}

async function familyResponse(key: string): Promise<FamilyResponse> {
  try {
    return await serverApiGet<FamilyResponse>(`/api/families/${encodeURIComponent(key)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

async function designDetail(id: string): Promise<DesignDetail> {
  try {
    return await serverApiGet<DesignDetail>(`/api/designs/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

async function startingLayouts(family: FamilyResponse): Promise<StartingLayout[]> {
  const groups = await Promise.all(
    productIdsForFamily(family.family).map(async (productId) => {
      const [product, designs] = await Promise.all([
        serverApiGet<ProductSummary>(`/api/products/${encodeURIComponent(productId)}`),
        serverApiGet<Paginated<DesignListItem>>(
          `/api/products/${encodeURIComponent(productId)}/designs?page=1&limit=24`,
        ),
      ]);
      return designs.data
        .filter((design) => design.quotable)
        .map((design) => ({ product, design }));
    }),
  );
  return groups.flat();
}

function ModeActions({ mode, family }: { mode: ConfigureMode; family?: string }) {
  return (
    <div className="v2-configure-mode-actions" role="group" aria-label="Configuration mode">
      <ButtonLink
        href={configureHref({ mode: "standard", family })}
        variant={mode === "standard" ? "primary" : "secondary"}
      >
        Standard
      </ButtonLink>
      <ButtonLink
        href={configureHref({ mode: "custom", family })}
        variant={mode === "custom" ? "primary" : "secondary"}
      >
        Custom
      </ButtonLink>
    </div>
  );
}

function FamilyStart({ families, mode }: { families: FamilySummary[]; mode: ConfigureMode }) {
  return (
    <PageFrame width="wide">
      <Stack gap="section">
        <PageHeading
          actions={<ModeActions mode={mode} />}
          description={mode === "custom"
            ? "Choose what you are building, then start from a compatible layout with component editing available."
            : "Choose what you are building first. The next step shows only compatible starting layouts."}
          eyebrow="Start from the job"
          title={mode === "custom" ? "Build a custom unit" : "Start a quote"}
        />
        {families.length ? (
          <Grid columns="two">
            {families.map((family) => (
              <Card
                actions={family.systemIds.length > 1
                  ? <StatusChip label={`${family.systemIds.length} profile systems`} />
                  : undefined}
                description="Choose a starting layout scoped to this family."
                key={family.familyKey}
                title={family.name}
              >
                <ButtonLink
                  href={configureHref({
                    mode,
                    family: family.familyKey,
                    system: family.systemIds[0],
                  })}
                  icon="arrow-right"
                >
                  Choose {family.name}
                </ButtonLink>
              </Card>
            ))}
          </Grid>
        ) : (
          <EmptyState
            description="No active product family is available from the fabrication catalog."
            title="No configurable families"
          />
        )}
      </Stack>
    </PageFrame>
  );
}

function LayoutStart({
  family,
  layouts,
  mode,
  orderId,
}: {
  family: FamilyResponse;
  layouts: StartingLayout[];
  mode: ConfigureMode;
  orderId?: string;
}) {
  return (
    <PageFrame width="wide">
      <Stack gap="section">
        <PageHeading
          actions={<ModeActions family={family.family.familyKey} mode={mode} />}
          description="These quotable layouts come only from the selected family. Choose one to open the live workspace."
          eyebrow={mode === "custom" ? "Custom configuration" : "Standard quote"}
          title={`Choose a ${family.family.name} layout`}
        />
        <ButtonLink href={configureHref({ mode, orderId })} variant="ghost">
          Change family
        </ButtonLink>
        {layouts.length ? (
          <div className="v2-configure-layouts">
            {layouts.map(({ design, product }) => (
              <Card
                actions={<StatusChip label={`${design.quantityOfSquares} ${design.quantityOfSquares === 1 ? "leaf" : "leaves"}`} />}
                description={product.name}
                key={design.designId}
                title={design.name}
              >
                <ButtonLink
                  href={configureHref({
                    mode,
                    family: family.family.familyKey,
                    design: design.designId,
                    system: family.family.systemIds[0],
                    productId: product.id,
                    orderId,
                  })}
                  icon="arrow-right"
                >
                  Configure this layout
                </ButtonLink>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            action={{
              label: "Choose another family",
              href: configureHref({ mode, orderId }),
            }}
            description="The selected family currently has no quotable starting layout."
            title="No starting layout available"
          />
        )}
      </Stack>
    </PageFrame>
  );
}

export default async function V2ConfigurePage({
  searchParams,
}: {
  searchParams: Promise<ConfigureSearchParams>;
}) {
  const user = await requirePagePermission("quotes", "view");
  const sp = await searchParams;
  let mode = configureMode(sp.mode);
  const families = await serverApiGet<FamilySummary[]>("/api/families");

  let order: OrderDetail | null = null;
  if (sp.orderId) {
    order = await serverApiGet<OrderDetail>(`/api/orders/${encodeURIComponent(sp.orderId)}`);
  }

  let savedDraft: LineItemDraft | null = null;
  let importIssues: LineItemIssue[] = [];
  if (order && sp.itemId) {
    savedDraft = order.designerItems?.find((item) => item.id === sp.itemId)?.draft ?? null;
    if (!savedDraft) notFound();
    mode = "custom";
  } else if (order && sp.fromItem) {
    const converted = await serverApiGet<{
      draft?: LineItemDraft;
      issues: LineItemIssue[];
      blocking: boolean;
    }>(`/api/orders/${encodeURIComponent(order.id)}/items/${encodeURIComponent(sp.fromItem)}/draft`);
    if (!converted.draft || converted.blocking) notFound();
    savedDraft = converted.draft;
    importIssues = converted.issues;
    mode = "custom";
  }

  const designId = savedDraft?.designId ?? sp.design ?? sp.designId;
  let design = designId ? await designDetail(designId) : null;
  let familyKey = savedDraft?.familyKey ?? sp.family;

  // A V1 Standard deep link carries designId/productId but no family. Infer the
  // owner from descriptor data so the compatibility URL opens the same unit.
  if (!familyKey && design?.productId) {
    const descriptors = await Promise.all(
      families.map((family) => familyResponse(family.familyKey)),
    );
    familyKey = descriptors.find((candidate) =>
      productIdsForFamily(candidate.family).includes(design!.productId!),
    )?.family.familyKey;
  }

  if (!familyKey) return <FamilyStart families={families} mode={mode} />;

  const family = await familyResponse(familyKey);
  if (!designId) {
    return (
      <LayoutStart
        family={family}
        layouts={await startingLayouts(family)}
        mode={mode}
        orderId={order?.id}
      />
    );
  }

  design ??= await designDetail(designId);
  const systemId = savedDraft?.systemId ?? sp.system ?? sp.systemId ?? family.family.systemIds[0];
  if (!systemId) notFound();

  const initialDraft = savedDraft ?? newDraft({
    familyKey: family.family.familyKey,
    systemId,
    designId: design.designId,
    widthMm: design.defaultWidthMm ?? FALLBACK_WIDTH_MM,
    heightMm: design.defaultHeightMm ?? FALLBACK_HEIGHT_MM,
  });
  const writable = can(user, "quotes", "create") && can(user, "orders", "create");

  return (
    <PageFrame width="wide">
      <ConfigureWorkspace
        canPersist={writable && order?.status !== "confirmed"}
        design={design}
        family={family}
        importIssues={importIssues}
        initialDraft={initialDraft}
        itemId={sp.itemId}
        key={`${sp.itemId ?? sp.fromItem ?? "new"}:${design.designId}`}
        mode={mode}
        order={order}
        productId={design.productId ?? sp.productId}
        replacesItemId={sp.fromItem}
      />
    </PageFrame>
  );
}
