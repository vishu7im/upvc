import type { BasketTotals, OrderDetail, OrderSummary } from "@/lib/types";
import { configureHref } from "@/lib/v2/configure";

export type OrderStatusFilter = "" | "draft" | "confirmed";

export interface UnifiedOrderLine {
  id: string;
  kind: "legacy" | "designer";
  name: string;
  detail: string | null;
  size: string;
  quantity: number;
  lineNetPrice: number | null;
  issueMessages: string[];
  editHref: string | null;
}

export interface GroupedOrderDocument {
  type: string;
  label: string;
  description: string;
  variants: Array<"normal" | "welded">;
  createdAt: string;
}

export interface OrderDocumentGroup {
  id: "office" | "production" | "dispatch";
  label: string;
  description: string;
  documents: GroupedOrderDocument[];
}

const DOCUMENT_GROUPS: ReadonlyArray<Omit<OrderDocumentGroup, "documents"> & {
  types: ReadonlyArray<{ type: string; label: string; description: string }>;
}> = [
  {
    id: "office",
    label: "Office",
    description: "Customer and commercial records.",
    types: [
      { type: "price_summary", label: "Price summary", description: "Server-calculated customer price." },
      { type: "work_order", label: "Work order", description: "Full job instruction for the office and workshop." },
    ],
  },
  {
    id: "production",
    label: "Production",
    description: "Workshop documents, with welded saw-cut variants where generated.",
    types: [
      { type: "cutting_list", label: "Cutting list", description: "Material lengths for cutting." },
      { type: "bom", label: "Bill of materials", description: "Materials required for the order." },
      { type: "work_planner", label: "Work planner", description: "Production sequence and planning." },
      { type: "planner_list", label: "Planner list", description: "Consolidated production planning list." },
    ],
  },
  {
    id: "dispatch",
    label: "Dispatch",
    description: "Documents used when the completed order leaves the workshop.",
    types: [
      { type: "dmo", label: "DMO", description: "Despatch and material output." },
    ],
  },
];

export function positivePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function orderStatusFilter(value: string | undefined): OrderStatusFilter {
  return value === "draft" || value === "confirmed" ? value : "";
}

export function orderItemCount(order: Pick<OrderSummary, "_count"> | OrderDetail): number {
  if ("items" in order) return order.items.length + (order.designerItems?.length ?? 0);
  return (order._count?.items ?? 0) + (order._count?.designerItems ?? 0);
}

export function orderGrandTotal(order: Pick<OrderSummary, "basketTotal" | "totalPrice"> | OrderDetail): number | null {
  if ("basket" in order && order.basket) return order.basket.grandTotal;
  return order.basketTotal ?? order.totalPrice;
}

export function ordersHref({
  page,
  query,
  status,
}: {
  page?: number;
  query?: string;
  status?: OrderStatusFilter;
}): string {
  const params = new URLSearchParams();
  if (page && page > 1) params.set("page", String(page));
  if (query?.trim()) params.set("q", query.trim());
  if (status) params.set("status", status);
  const encoded = params.toString();
  return encoded ? `/v2/orders?${encoded}` : "/v2/orders";
}

function designerHref(
  orderId: string,
  draft: { familyKey: string; designId: string; systemId: string },
  itemParameter: "fromItem" | "itemId",
  itemId: string,
): string {
  return configureHref({
    mode: "custom",
    family: draft.familyKey,
    design: draft.designId,
    system: draft.systemId,
    orderId,
    [itemParameter]: itemId,
  });
}

function basketLineTotal(basket: BasketTotals | undefined, id: string): number | null {
  return basket?.lines.find((line) => line.id === id)?.lineNetPrice ?? null;
}

export function unifiedOrderLines(order: OrderDetail): UnifiedOrderLine[] {
  const legacy = order.items.map<UnifiedOrderLine>((item) => ({
    id: item.id,
    kind: "legacy",
    name: item.design?.name ?? "Configured unit",
    detail: item.product?.name ?? null,
    size: `${item.widthMm} × ${item.heightMm} mm`,
    quantity: item.qty,
    lineNetPrice: basketLineTotal(order.basket, item.id),
    issueMessages: [],
    editHref: item.studioFamilyKey
      ? designerHref(
          order.id,
          { familyKey: item.studioFamilyKey, designId: item.designId, systemId: item.systemId },
          "fromItem",
          item.id,
        )
      : null,
  }));

  const designer = (order.designerItems ?? []).map<UnifiedOrderLine>((item) => {
    const colour = item.summary?.colourLabel?.trim();
    const leaves = item.summary
      ? `${item.summary.leafCount} ${item.summary.leafCount === 1 ? "leaf" : "leaves"}`
      : null;
    const detail = [colour, leaves].filter(Boolean).join(" · ") || null;
    return {
      id: item.id,
      kind: "designer",
      name: item.summary?.locationLabel?.trim() || `Configured item ${item.position}`,
      detail,
      size: item.summary?.sizeLabel ? `${item.summary.sizeLabel} mm` : "Size unavailable",
      quantity: item.draft.quantity ?? 1,
      lineNetPrice: basketLineTotal(order.basket, item.id),
      issueMessages: item.issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => issue.message),
      editHref: designerHref(order.id, item.draft, "itemId", item.id),
    };
  });

  return [...legacy, ...designer];
}

export function groupedOrderDocuments(order: Pick<OrderDetail, "documents">): OrderDocumentGroup[] {
  const byType = new Map<string, { variants: Set<"normal" | "welded">; createdAt: string }>();
  for (const document of order.documents) {
    const type = document.type.toLocaleLowerCase();
    const variant = document.variant.toLocaleLowerCase();
    if (variant !== "normal" && variant !== "welded") continue;
    const current = byType.get(type) ?? { variants: new Set<"normal" | "welded">(), createdAt: document.createdAt };
    current.variants.add(variant);
    byType.set(type, current);
  }

  return DOCUMENT_GROUPS.map(({ types, ...group }) => ({
    ...group,
    documents: types.flatMap((definition) => {
      const stored = byType.get(definition.type);
      if (!stored) return [];
      return [{
        ...definition,
        variants: (["welded", "normal"] as const).filter((variant) => stored.variants.has(variant)),
        createdAt: stored.createdAt,
      }];
    }),
  }));
}

export function commercialNumber(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
