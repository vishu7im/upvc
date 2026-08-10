import type { DesignListItem } from "@/lib/types";
import { configureHref } from "@/lib/v2/configure";

export type CatalogConfigureMode = "standard" | "custom";

export function positiveCatalogPage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function catalogConfigureMode(value: string | undefined): CatalogConfigureMode {
  return value === "custom" ? "custom" : "standard";
}

export function productsHref({
  page,
  orderId,
}: {
  page?: number;
  orderId?: string;
} = {}): string {
  const query = new URLSearchParams();
  if (page && page > 1) query.set("page", String(page));
  if (orderId) query.set("orderId", orderId);
  const encoded = query.toString();
  return encoded ? `/v2/products?${encoded}` : "/v2/products";
}

export function productDesignsHref(
  productId: string,
  {
    page,
    orderId,
    mode,
  }: {
    page?: number;
    orderId?: string;
    mode?: CatalogConfigureMode;
  } = {},
): string {
  const query = new URLSearchParams();
  if (page && page > 1) query.set("page", String(page));
  if (orderId) query.set("orderId", orderId);
  if (mode) query.set("mode", mode);
  const encoded = query.toString();
  const path = `/v2/products/${encodeURIComponent(productId)}`;
  return encoded ? `${path}?${encoded}` : path;
}

export function partitionCatalogDesigns(designs: ReadonlyArray<DesignListItem>): {
  configurable: DesignListItem[];
  reference: DesignListItem[];
} {
  return {
    configurable: designs.filter((design) => design.quotable),
    reference: designs.filter((design) => !design.quotable),
  };
}

export function layoutConfigureHref({
  mode,
  family,
  designId,
  systemId,
  productId,
  orderId,
}: {
  mode: CatalogConfigureMode;
  family?: string;
  designId: string;
  systemId: string;
  productId: string;
  orderId?: string;
}): string | null {
  if (mode === "custom" && !family) return null;
  return configureHref({
    mode,
    family,
    design: designId,
    system: systemId,
    productId,
    orderId,
  });
}
