import Link from "next/link";
import { notFound } from "next/navigation";
import { serverApiGet } from "@/lib/server-api";
import { ApiError } from "@/lib/api";
import type { OrderDetail } from "@/lib/types";
import { money, dateShort, docLabel } from "@/lib/format";
import { StatusBadge } from "../page";
import { RemoveItemButton, ConfirmOrderButton } from "./order-actions";
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

export const dynamic = "force-dynamic";

const documentTone = ["blue", "purple", "green", "amber", "red", "slate"] as const;

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let order: OrderDetail;
  try {
    order = await serverApiGet<OrderDetail>(`/api/orders/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const isDraft = order.status === "draft";

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
          isDraft ? (
            <ButtonLink href={`/products?orderId=${order.id}`} variant="secondary" icon="plus">
              Add item from gallery
            </ButtonLink>
          ) : (
            <ButtonLink href="/orders" variant="secondary" icon="orders">
              All orders
            </ButtonLink>
          )
        }
        meta={
          <>
            <StatusBadge status={order.status} />
            <Badge tone="slate">{order.items.length} {order.items.length === 1 ? "item" : "items"}</Badge>
            <Badge tone={isDraft ? "amber" : "green"}>{money(order.totalPrice)}</Badge>
          </>
        }
      />

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Customer</p>
          <p className="mt-2 text-xl font-bold text-slate-950">{order.customerName}</p>
          <p className="mt-1 text-sm text-slate-500">{order.reference || "No reference supplied"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Order value</p>
          <p className="mt-2 text-xl font-bold text-slate-950">{money(order.totalPrice)}</p>
          <p className="mt-1 text-sm text-slate-500">Snapshot total from engine pricing</p>
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
                  {isDraft && <th className={thClass} />}
                </tr>
              </thead>
              <tbody>
                {order.items.length === 0 ? (
                  <tr>
                    <td colSpan={isDraft ? 6 : 5} className="px-4 py-10">
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
                      </td>
                      <td className={tdClass + " text-right font-semibold"}>{item.qty}</td>
                      <td className={tdClass}>
                        <Badge tone="slate">{item.mode}</Badge>
                      </td>
                      {isDraft && (
                        <td className={tdClass + " text-right"}>
                          <RemoveItemButton orderId={order.id} itemId={item.id} />
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

      {isDraft && (
        <Card className="mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Ready to release?</h2>
            <p className="mt-1 text-sm text-slate-500">
              Confirming locks the order and generates the production document set.
            </p>
          </div>
          <ConfirmOrderButton orderId={order.id} disabled={order.items.length === 0} />
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
