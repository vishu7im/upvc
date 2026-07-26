// =====================================================================
// The Designer route (Task 1 phase 3). Thin Server Component: it resolves the
// family descriptor + option system, the starting design, and (when reopening a
// saved line item) the persisted draft — then hands the client workspace a
// fully-formed initial state so the first paint already shows the right unit.
//
// The legacy /quote configurator is untouched and stays the default gallery
// action; this route is reached from the gallery's "Design in studio".
// =====================================================================

import { notFound } from "next/navigation";
import { serverApiGet } from "@/lib/server-api";
import { ApiError } from "@/lib/api";
import type {
  DesignDetail,
  FamilyResponse,
  LineItemDraft,
  OrderDetail,
} from "@/lib/types";
import { newDraft } from "@/lib/designer-draft";
import Workspace from "@/components/designer/workspace";
import { ButtonLink, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const FALLBACK_WIDTH_MM = 1200;
const FALLBACK_HEIGHT_MM = 1200;

export default async function DesignerPage({
  searchParams,
}: {
  searchParams: Promise<{
    family?: string;
    design?: string;
    system?: string;
    orderId?: string;
    itemId?: string;
    name?: string;
  }>;
}) {
  const sp = await searchParams;

  if (!sp.family || !sp.design) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <EmptyState
          icon="quote"
          title="Open the studio from a design"
          description="Pick a product whose family is registered with the designer, then choose a design to configure."
          action={
            <ButtonLink href="/products" icon="products">
              Browse products
            </ButtonLink>
          }
        />
      </div>
    );
  }

  // Unknown family / design ⇒ 404 (the engine's own 404 is authoritative).
  let family: FamilyResponse;
  try {
    family = await serverApiGet<FamilyResponse>(`/api/families/${sp.family}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  let design: DesignDetail;
  try {
    design = await serverApiGet<DesignDetail>(`/api/designs/${sp.design}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  // Reopening a persisted item: the SAVED DRAFT is the state, so the workspace
  // restores exactly what was stored (no re-derivation from query params).
  let savedDraft: LineItemDraft | null = null;
  if (sp.orderId && sp.itemId) {
    const order = await serverApiGet<OrderDetail>(`/api/orders/${sp.orderId}`).catch(() => null);
    savedDraft = order?.designerItems?.find((d) => d.id === sp.itemId)?.draft ?? null;
    if (!savedDraft) notFound();
  }

  const systemId = sp.system ?? family.family.systemIds[0];
  const initialDraft =
    savedDraft ??
    newDraft({
      familyKey: family.family.familyKey,
      systemId,
      designId: design.designId,
      // `defaultFrom: "design"` in the descriptor — the design's own stored
      // manufacturing size, falling back to the app-wide preview size.
      widthMm: design.defaultWidthMm ?? FALLBACK_WIDTH_MM,
      heightMm: design.defaultHeightMm ?? FALLBACK_HEIGHT_MM,
    });

  return (
    <Workspace
      // Remount per design/item so per-design defaults reset cleanly.
      key={`${sp.itemId ?? "new"}:${design.designId}`}
      family={family}
      initialDraft={initialDraft}
      designName={sp.name ?? design.name}
      fallbackSvg={design.imageSvg}
      orderId={sp.orderId}
      itemId={sp.itemId}
    />
  );
}
