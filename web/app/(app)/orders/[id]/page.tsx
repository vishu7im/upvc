import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, serverApiGet } from "@/lib/server-api";
import { ApiError } from "@/lib/api";
import { can } from "@/lib/permissions";
import type { OrderDetail } from "@/lib/types";
import { money, dateShort, docLabel } from "@/lib/format";
import { StatusBadge } from "../page";
import {
  RemoveItemButton,
  RemoveDesignerItemButton,
  ConfirmOrderButton,
  ReopenOrderButton,
  EditOrderDetails,
} from "./order-actions";
import { DocumentViewer } from "./document-viewer";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  SectionHeader,
  tableClass,
  tableWrapClass,
  tdClass,
  thClass,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import DeleteOrderButton from "../delete-order-button";
import PricingPanel, { BasketSummary } from "./pricing-panel";

export const dynamic = "force-dynamic";

const documentTone = ["blue", "purple", "green", "amber", "red", "slate"] as const;

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let order: OrderDetail;
  let canDeleteOrder = false;
  try {
    const [fetchedOrder, user] = await Promise.all([
      serverApiGet<OrderDetail>(`/api/orders/${id}`),
      getCurrentUser(),
    ]);
    order = fetchedOrder;
    canDeleteOrder = can(user, "orders", "delete");
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const isDraft = order.status === "draft";
  // Money on this page comes from ONE place: the server's BasketTotals
  // (src/designer/basket.ts), which is also what the Price Summary prints.
  const basket = order.basket;
  const currency = basket?.currency ?? "GBP";
  const basketTotal = basket ? basket.grandTotal : order.totalPrice;
  // Per-line money also comes from the basket, so a row and the ledger below it
  // can never show different arithmetic.
  const lineTotal = (id: string) =>
    basket?.lines.find((l) => l.id === id)?.lineNetPrice ?? null;
  // Designer line items (D2) and legacy items coexist on one order; both count
  // towards "is this order confirmable".
  const designerItems = order.designerItems ?? [];
  const totalLines = order.items.length + designerItems.length;

  // The confirm step stores up to two rows per doc type (normal + welded for the
  // length-bearing docs). Collapse to one card per type, carrying its variants.
  const docTypes: { type: string; variants: string[]; createdAt: string }[] = [];
  const seenType = new Map<string, number>();
  for (const d of order.documents) {
    const at = seenType.get(d.type);
    if (at === undefined) {
      seenType.set(d.type, docTypes.length);
      docTypes.push({ type: d.type, variants: [d.variant], createdAt: d.createdAt });
    } else {
      docTypes[at].variants.push(d.variant);
    }
  }

  return (
    <div>
      <Link href="/orders" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950">
        <Icon name="arrowLeft" className="h-4 w-4" />
        Orders
      </Link>

      <PageHeader
        eyebrow={isDraft ? "Draft order" : "Document center"}
        title={order.orderNo}
        description={
          <>
            <span className="font-semibold text-slate-800">{order.customerName}</span>
            {order.reference ? ` / ${order.reference}` : ""} / Created {dateShort(order.createdAt)}
          </>
        }
        actions={
          <>
            {isDraft ? (
              <ButtonLink href={`/products?orderId=${order.id}`} variant="secondary" icon="plus">
                Add item from gallery
              </ButtonLink>
            ) : (
              <>
                <ReopenOrderButton orderId={order.id} orderNo={order.orderNo} />
                <ButtonLink href="/orders" variant="secondary" icon="orders">
                  All orders
                </ButtonLink>
              </>
            )}
            {canDeleteOrder && (
              <DeleteOrderButton orderId={order.id} orderNo={order.orderNo} status={order.status} />
            )}
          </>
        }
        meta={
          <>
            <StatusBadge status={order.status} />
            <Badge tone="slate">{totalLines} {totalLines === 1 ? "item" : "items"}</Badge>
            <Badge tone={isDraft ? "amber" : "green"}>{money(basketTotal, currency)}</Badge>
          </>
        }
      />

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Customer</p>
          <p className="mt-2 text-xl font-bold text-slate-950">{order.customerName}</p>
          <p className="mt-1 text-sm text-slate-500">{order.reference || "No reference supplied"}</p>
          {isDraft && (
            <EditOrderDetails
              orderId={order.id}
              customerName={order.customerName}
              reference={order.reference ?? null}
            />
          )}
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Order value</p>
          <p className="mt-2 text-xl font-bold text-slate-950">{money(basketTotal, currency)}</p>
          <p className="mt-1 text-sm text-slate-500">
            {isDraft ? "Live total incl. extras, discount and VAT" : "Frozen at confirmation"}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Documents</p>
          <p className="mt-2 text-xl font-bold text-slate-950">{docTypes.length}</p>
          <p className="mt-1 text-sm text-slate-500">{isDraft ? "Confirm order to generate pack" : "Generated production assets"}</p>
        </Card>
      </section>

      <Card className="overflow-hidden">
        <SectionHeader title="Line items" description="Configured product designs attached to this order" />
        <div className={tableWrapClass + " rounded-none border-x-0 border-b-0"}>
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Design</th>
                  <th className={thClass}>Product</th>
                  <th className={thClass}>Size</th>
                  <th className={thClass + " text-right"}>Qty</th>
                  <th className={thClass}>Mode</th>
                  <th className={thClass + " text-right"}>Line total</th>
                  {isDraft && <th className={thClass} />}
                </tr>
              </thead>
              <tbody>
                {order.items.length === 0 ? (
                  <tr>
                    <td colSpan={isDraft ? 7 : 6} className="px-4 py-10">
                      {designerItems.length > 0 ? (
                        <p className="text-center text-sm text-slate-500">
                          This order&apos;s items were configured in the studio — see below.
                        </p>
                      ) : (
                        <EmptyState
                          icon="products"
                          title="No items yet"
                          description="Add a configured design from the product gallery before confirming this order."
                          action={
                            <ButtonLink href={`/products?orderId=${order.id}`} icon="plus">
                              Add item
                            </ButtonLink>
                          }
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  order.items.map((item) => (
                    <tr key={item.id} className="transition hover:bg-slate-50">
                      <td className={tdClass}>
                        <div className="font-semibold text-slate-950">{item.design?.name ?? item.designId}</div>
                        <div className="text-xs font-medium text-slate-500">{item.designId}</div>
                      </td>
                      <td className={tdClass}>{item.product?.name ?? item.productId}</td>
                      <td className={tdClass}>
                        <span className="font-mono text-sm text-slate-800">
                          {item.widthMm} x {item.heightMm} mm
                        </span>
                        {item.cillKey && (
                          <div className="mt-1 text-xs font-medium text-slate-500">
                            Cill: {item.cillKey} (mfg −30 mm)
                          </div>
                        )}
                      </td>
                      <td className={tdClass + " text-right font-semibold"}>{item.qty}</td>
                      <td className={tdClass}>
                        <Badge tone="slate">{item.mode}</Badge>
                      </td>
                      <td className={tdClass + " text-right font-semibold"}>
                        {money(lineTotal(item.id), currency)}
                      </td>
                      {isDraft && (
                        <td className={tdClass + " text-right"}>
                          <div className="flex items-center justify-end gap-1">
                            {/* Older items were added straight from the gallery
                                and have no studio draft. Editing one CONVERTS it
                                — the studio says so, and nothing is written
                                until the user saves there. */}
                            {item.studioFamilyKey && (
                              <Link
                                href={`/designer?family=${encodeURIComponent(item.studioFamilyKey)}&design=${encodeURIComponent(item.designId)}&system=${encodeURIComponent(item.systemId)}&orderId=${order.id}&fromItem=${item.id}`}
                                className="inline-flex h-8 items-center rounded-md px-2 text-sm font-semibold text-[#4442e3] transition hover:bg-[#e7e6ff]"
                              >
                                Edit
                              </Link>
                            )}
                            <RemoveItemButton orderId={order.id} itemId={item.id} />
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {designerItems.length > 0 && (
        <Card className="mt-6 overflow-hidden">
          <SectionHeader
            title="Designer line items"
            description="Configured in the studio — reopen one to change its measurements or specification"
          />
          <div className={tableWrapClass + " rounded-none border-x-0 border-b-0"}>
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Item</th>
                    <th className={thClass}>Size</th>
                    <th className={thClass}>Specification</th>
                    <th className={thClass + " text-right"}>Qty</th>
                    <th className={thClass + " text-right"}>Total</th>
                    <th className={thClass} />
                  </tr>
                </thead>
                <tbody>
                  {designerItems.map((item) => {
                    const errors = item.issues.filter((i) => i.severity === "error").length;
                    const qty = item.draft.quantity ?? 1;
                    return (
                      <tr key={item.id} className="transition hover:bg-slate-50">
                        <td className={tdClass}>
                          <div className="font-semibold text-slate-950">
                            {item.summary?.locationLabel || `Item ${item.position}`}
                          </div>
                          <div className="text-xs font-medium text-slate-500">{item.draft.familyKey}</div>
                        </td>
                        <td className={tdClass}>
                          <span className="font-mono text-sm text-slate-800">
                            {item.summary?.sizeLabel ?? "—"} mm
                          </span>
                        </td>
                        <td className={tdClass}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.summary?.colourLabel && <Badge tone="slate">{item.summary.colourLabel}</Badge>}
                            <Badge tone="slate">
                              {item.summary?.leafCount ?? 0}{" "}
                              {item.summary?.leafCount === 1 ? "leaf" : "leaves"}
                            </Badge>
                            {errors > 0 && <Badge tone="red">{errors} to fix</Badge>}
                          </div>
                        </td>
                        <td className={tdClass + " text-right font-semibold"}>{qty}</td>
                        <td className={tdClass + " text-right font-semibold"}>
                          {item.totals ? money(item.totals.grandTotal * qty) : "—"}
                        </td>
                        <td className={tdClass + " text-right"}>
                          {isDraft && (
                            <div className="flex items-center justify-end gap-1">
                              <Link
                                href={`/designer?family=${encodeURIComponent(item.draft.familyKey)}&design=${encodeURIComponent(item.draft.designId)}&system=${encodeURIComponent(item.draft.systemId)}&orderId=${order.id}&itemId=${item.id}`}
                                className="inline-flex h-8 items-center rounded-md px-2 text-sm font-semibold text-[#4442e3] transition hover:bg-[#e7e6ff]"
                              >
                                Edit
                              </Link>
                              <RemoveDesignerItemButton orderId={order.id} itemId={item.id} />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {basket && (
        <div className="mt-6">
          {isDraft ? (
            <PricingPanel order={order} editable />
          ) : (
            <Card className="overflow-hidden">
              <SectionHeader
                title="Order summary"
                description="Frozen at confirmation — the numbers on the customer's paperwork."
              />
              <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <dl className="grid grid-cols-2 gap-4 self-start text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">Fitting</dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {basket.fittingType === "none"
                        ? "Supply only"
                        : basket.fittingType === "fit"
                          ? "Supply & fit"
                          : "Fit + survey"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">Discount</dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {basket.discountCode ?? "None"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">VAT rate</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{basket.taxRatePct}%</dd>
                  </div>
                </dl>
                <BasketSummary basket={basket} currency={currency} />
              </div>
            </Card>
          )}
        </div>
      )}

      {isDraft && (
        <Card className="mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Ready to release?</h2>
            <p className="mt-1 text-sm text-slate-500">
              Confirming locks the order and generates the production document set.
            </p>
          </div>
          <ConfirmOrderButton orderId={order.id} disabled={totalLines === 0} />
        </Card>
      )}

      {!isDraft && (
        <section className="mt-6">
          <PageHeader
            eyebrow="Generated assets"
            title="Documents"
            description="Welded cut-length documents are selected by default. Switch to Normal when you need finished dimensions."
          />
          {docTypes.length === 0 ? (
            <EmptyState icon="document" title="No documents generated" description="The engine did not return any generated documents for this order." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {docTypes.map((document, index) => (
                <Card key={document.type} className="flex min-h-56 flex-col p-5">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                      <Icon name="document" className="h-6 w-6" />
                    </span>
                    <Badge tone={documentTone[index % documentTone.length]}>{dateShort(document.createdAt)}</Badge>
                  </div>
                  <h3 className="mt-6 text-xl font-bold text-slate-950">{docLabel(document.type)}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">
                    {document.variants.includes("welded")
                      ? "Welded includes the weld-shrinkage allowance for saw cutting. Normal shows finished sizes."
                      : "Production-ready fabrication document generated from confirmed order data."}
                  </p>
                  <DocumentViewer
                    label={docLabel(document.type)}
                    viewHref={`/api/orders/${order.id}/documents/${document.type}`}
                    pdfHref={`/api/orders/${order.id}/documents/${document.type}/pdf`}
                    variants={document.variants}
                  />
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
