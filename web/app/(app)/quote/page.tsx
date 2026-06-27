// =====================================================================
// Quote configurator route (U3). Deep-linked from the gallery with
// ?systemId&designId&productId&name (&orderId to append to a draft).
// The page is a thin Server Component; the interactive work is the client
// Configurator.
// =====================================================================

import Configurator from "./configurator";

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
  return (
    <Configurator
      systemId={sp.systemId}
      designId={sp.designId}
      productId={sp.productId}
      designName={sp.name}
      orderId={sp.orderId}
    />
  );
}
