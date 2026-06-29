// =====================================================================
// Quote configurator route (U3). Deep-linked from the gallery with
// ?systemId&designId&productId&name (&orderId to append to a draft).
// The page is a thin Server Component; the interactive work is the client
// Configurator.
// =====================================================================

import Configurator from "./configurator";
import { serverApiGet } from "@/lib/server-api";
import type { DesignDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<{
    systemId?: string;
    designId?: string;
    productId?: string;
    name?: string;
    orderId?: string;
  }>;
}) {
  const sp = await searchParams;
  const detail = sp.designId
    ? await serverApiGet<DesignDetail>(`/api/designs/${sp.designId}`).catch(() => null)
    : null;

  return (
    <Configurator
      // Remount per design so the chamber default (and other per-design state) resets.
      key={sp.designId ?? "none"}
      systemId={sp.systemId}
      designId={sp.designId}
      productId={sp.productId}
      designName={sp.name}
      orderId={sp.orderId}
      designSvg={detail?.imageSvg ?? null}
      designFrameKey={detail?.frameKey ?? null}
      defaultWidthMm={detail?.defaultWidthMm ?? null}
      defaultHeightMm={detail?.defaultHeightMm ?? null}
    />
  );
}
