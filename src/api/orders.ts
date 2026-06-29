// =====================================================================
// api/orders.ts — the order flow: draft → add items → confirm → docs.
// Mounted at /api/orders (behind requireAuth).
// =====================================================================

import { Router } from "express";
import { DocumentType, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/client.ts";
import { solve } from "../engine/solve.ts";
import {
  aggregateOrder,
  type ItemForAggregation,
} from "../engine/aggregate.ts";
import {
  renderBom,
  renderCuttingList,
  renderDmo,
  renderPlannerList,
  renderPriceSummary,
  renderWorkOrder,
  renderWorkPlanner,
  type PlannerLine,
} from "../engine/documents.ts";
import { DEFAULT_SETTINGS, getSystem } from "../catalog/index.ts";
import type {
  DocImage,
  EngineOverrides,
  QuoteInput,
  Settings,
} from "../types.ts";
import {
  asyncHandler,
  type AuthedRequest,
  HttpError,
  validate,
} from "./http.ts";
import { paginated, parsePagination } from "./pagination.ts";
import { htmlToPdf } from "../services/pdf.ts";
import { getObject, objectExists, putObject } from "../services/storage.ts";

export const ordersRouter = Router();

// ---- helpers --------------------------------------------------------

/** Fetch an order owned by the caller, or 404. */
async function ownOrder(req: AuthedRequest, id: string) {
  const order = await prisma.order.findFirst({
    where: { id, userId: req.user!.id },
  });
  if (!order) throw new HttpError(404, "Order not found");
  return order;
}

/** Owned order that must still be a draft (mutations only). */
async function ownDraftOrder(req: AuthedRequest, id: string) {
  const order = await ownOrder(req, id);
  if (order.status !== "draft") {
    throw new HttpError(
      409,
      "Order is already confirmed and cannot be modified",
    );
  }
  return order;
}

type DocVariant = "normal" | "welded";

/** Validate the ?variant query param (default "welded"). */
function parseVariant(q: unknown): DocVariant {
  const v = typeof q === "string" ? q.toLowerCase() : "welded";
  if (v !== "normal" && v !== "welded")
    throw new HttpError(400, `Unknown document variant: ${v}`);
  return v;
}

/**
 * Find a stored document by variant, falling back to the "normal" variant when a
 * welded copy doesn't exist (e.g. pricing docs, which have no welded variant), so
 * the UI never dead-links a Welded button.
 */
async function findDoc(
  orderId: string,
  type: DocumentType,
  variant: DocVariant,
) {
  let doc = await prisma.document.findUnique({
    where: { orderId_type_variant: { orderId, type, variant } },
  });
  if (!doc && variant !== "normal") {
    doc = await prisma.document.findUnique({
      where: { orderId_type_variant: { orderId, type, variant: "normal" } },
    });
  }
  return doc;
}

// ---- create / list / get -------------------------------------------

const createOrderSchema = z.object({
  customerName: z.string().min(1),
  reference: z.string().optional(),
  customerId: z.string().optional(),
});

ordersRouter.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = validate(createOrderSchema, req.body);
    const orderNo = `ORD-${Date.now()}`;
    const order = await prisma.order.create({
      data: {
        orderNo,
        userId: req.user!.id,
        customerName: body.customerName,
        reference: body.reference ?? null,
        customerId: body.customerId ?? null,
      },
    });
    res.status(201).json(order);
  }),
);

ordersRouter.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const p = parsePagination(req.query);
    const where = { userId: req.user!.id };
    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: p.skip,
        take: p.take,
        include: { _count: { select: { items: true, documents: true } } },
      }),
      prisma.order.count({ where }),
    ]);
    res.json(paginated(data, total, p));
  }),
);

ordersRouter.get(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: {
        items: {
          include: {
            design: { select: { name: true } },
            product: { select: { name: true } },
          },
        },
        documents: { select: { type: true, variant: true, createdAt: true } },
      },
    });
    if (!order) throw new HttpError(404, "Order not found");
    res.json(order);
  }),
);

// ---- items ----------------------------------------------------------

const addItemSchema = z.object({
  productId: z.string().min(1),
  designId: z.string().min(1),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  qty: z.number().int().positive().optional(),
  mode: z.enum(["default", "custom"]).optional(),
  overrides: z.any().optional(),
  splitRatios: z.record(z.string(), z.number()).optional(),
  cillKey: z.string().optional(),
});

ordersRouter.post(
  "/:id/items",
  asyncHandler(async (req: AuthedRequest, res) => {
    const order = await ownDraftOrder(req, req.params.id);
    const body = validate(addItemSchema, req.body);

    const design = await prisma.design.findUnique({
      where: { designId: body.designId },
    });
    if (!design) throw new HttpError(404, "Design not found");
    if (!design.quotable) {
      throw new HttpError(
        400,
        "Design is not quotable yet (no fabrication topology). Pick a quotable design.",
      );
    }
    const product = await prisma.product.findUnique({
      where: { id: body.productId },
    });
    if (!product) throw new HttpError(404, "Product not found");

    // Validate the dimensions/overrides by actually solving once.
    try {
      solve(
        buildQuoteInput(order.orderNo, order.customerName, order.reference, {
          designId: design.designId,
          widthMm: body.widthMm,
          heightMm: body.heightMm,
          systemId: product.systemId,
          mode: body.mode,
          overrides: body.overrides as EngineOverrides | undefined,
          splitRatios: body.splitRatios,
          cillKey: body.cillKey,
        }),
      );
    } catch (e: any) {
      throw new HttpError(
        400,
        `Cannot solve this design at those dimensions: ${e.message}`,
      );
    }

    const item = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        designId: design.designId,
        systemId: product.systemId,
        widthMm: body.widthMm,
        heightMm: body.heightMm,
        qty: body.qty ?? 1,
        mode: body.mode ?? "default",
        overrides: (body.overrides ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        splitRatios: (body.splitRatios ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        cillKey: body.cillKey ?? null,
      },
    });
    res.status(201).json(item);
  }),
);

ordersRouter.delete(
  "/:id/items/:itemId",
  asyncHandler(async (req: AuthedRequest, res) => {
    const order = await ownDraftOrder(req, req.params.id);
    const result = await prisma.orderItem.deleteMany({
      where: { id: req.params.itemId, orderId: order.id },
    });
    if (result.count === 0) throw new HttpError(404, "Order item not found");
    res.status(204).end();
  }),
);

// ---- confirm: generate & persist all 7 documents -------------------

ordersRouter.post(
  "/:id/confirm",
  asyncHandler(async (req: AuthedRequest, res) => {
    const order = await ownDraftOrder(req, req.params.id);
    const items = await prisma.orderItem.findMany({
      where: { orderId: order.id },
      include: {
        design: { select: { imageSvg: true, svgPreview: true } },
        product: { select: { name: true } },
      },
      orderBy: { id: "asc" },
    });
    if (items.length === 0)
      throw new HttpError(400, "Order has no items to confirm");

    const systemId = items[0].systemId;
    const system = getSystem(systemId);
    if (!system) throw new HttpError(500, `System not loaded: ${systemId}`);
    const settings: Settings = DEFAULT_SETTINGS;

    const solved: ItemForAggregation[] = [];
    const plannerLines: PlannerLine[] = [];
    // Match the product gallery/configurator preview in every generated document.
    // Fallback to engine SVG only for designs without a stored catalog preview.
    const images: DocImage[] = [];
    const snapshotUpdates: Prisma.PrismaPromise<unknown>[] = [];

    items.forEach((item, i) => {
      const output = solve(
        buildQuoteInput(order.orderNo, order.customerName, order.reference, {
          designId: item.designId,
          widthMm: item.widthMm,
          heightMm: item.heightMm,
          systemId: item.systemId,
          mode: item.mode as "default" | "custom",
          overrides: item.overrides as EngineOverrides | null | undefined,
          splitRatios: item.splitRatios as
            | Record<string, number>
            | null
            | undefined,
          cillKey: item.cillKey,
        }),
      );
      solved.push({ output, qty: item.qty });
      plannerLines.push({
        lineNo: i + 1,
        productName: item.product.name,
        designName: output.designName,
        widthMm: item.widthMm,
        heightMm: item.heightMm,
        qty: item.qty,
        mode: item.mode,
        totalPrice: output.pricing.totals.grandTotal * item.qty,
      });
      images.push({
        // Items WITH a cill or span-drag overrides use the engine SVG (it carries
        // the cill drawn below the frame and/or the custom span geometry at the
        // real W×H); the catalog preview reflects neither. Items with neither keep
        // the catalog preview to match the gallery.
        svg:
          item.cillKey || item.splitRatios
            ? output.geometry.svg
            : item.design.imageSvg ?? item.design.svgPreview ?? output.geometry.svg,
        caption: `${i + 1}. ${output.designName} — ${item.widthMm} × ${item.heightMm} mm${item.qty > 1 ? ` ×${item.qty}` : ""}`,
      });
      snapshotUpdates.push(
        prisma.orderItem.update({
          where: { id: item.id },
          data: {
            pricingSnapshot: output.pricing
              .totals as unknown as Prisma.InputJsonValue,
          },
        }),
      );
    });

    // Order-level aggregation (multi-window).
    const agg = aggregateOrder(solved, system, settings);
    // Single-item orders carry that item's real W×H in the shared header;
    // genuine multi-window orders have no single dimension, so 0/0 ⇒ the header
    // renders "—" (each line's own W×H still shows in the preview-band captions).
    const synth = buildQuoteInput(
      order.orderNo,
      order.customerName,
      order.reference,
      {
        designId: "",
        widthMm: items.length === 1 ? items[0].widthMm : 0,
        heightMm: items.length === 1 ? items[0].heightMm : 0,
        systemId,
      },
    );
    const label = `${items.length} line(s)`;
    const sysName = system.name;

    const brand = settings.branding;
    // The 3 length-bearing docs (Work Order, Cutting List, Work Planner) are
    // rendered TWICE: a "normal" copy (finished sizes) and a "welded" copy (sizes
    // with welding-shrinkage compensation). The pricing/summary docs carry no cut
    // lengths, so they only get the single "normal" variant. Both copies share the
    // same aggregated parts; only the printed length column differs.
    const docRows: { type: DocumentType; variant: string; html: string }[] = [
      {
        type: DocumentType.WORK_ORDER,
        variant: "normal",
        html: renderWorkOrder(
          synth,
          sysName,
          label,
          agg.parts,
          brand,
          images,
          "normal",
        ),
      },
      {
        type: DocumentType.WORK_ORDER,
        variant: "welded",
        html: renderWorkOrder(
          synth,
          sysName,
          label,
          agg.parts,
          brand,
          images,
          "welded",
        ),
      },
      {
        type: DocumentType.CUTTING_LIST,
        variant: "normal",
        html: renderCuttingList(
          synth,
          sysName,
          label,
          agg.parts,
          brand,
          images,
          "normal",
        ),
      },
      {
        type: DocumentType.CUTTING_LIST,
        variant: "welded",
        html: renderCuttingList(
          synth,
          sysName,
          label,
          agg.parts,
          brand,
          images,
          "welded",
        ),
      },
      {
        type: DocumentType.WORK_PLANNER,
        variant: "normal",
        html: renderWorkPlanner(
          synth,
          sysName,
          label,
          agg.parts,
          brand,
          images,
          "normal",
        ),
      },
      {
        type: DocumentType.WORK_PLANNER,
        variant: "welded",
        html: renderWorkPlanner(
          synth,
          sysName,
          label,
          agg.parts,
          brand,
          images,
          "welded",
        ),
      },
      {
        type: DocumentType.BOM,
        variant: "normal",
        html: renderBom(synth, sysName, label, agg.pricing, brand, images),
      },
      {
        type: DocumentType.PRICE_SUMMARY,
        variant: "normal",
        html: renderPriceSummary(
          synth,
          sysName,
          label,
          agg.pricing,
          brand,
          images,
        ),
      },
      {
        type: DocumentType.DMO,
        variant: "normal",
        html: renderDmo(synth, sysName, label, agg.pricing, brand, images),
      },
      {
        type: DocumentType.PLANNER_LIST,
        variant: "normal",
        html: renderPlannerList(
          synth,
          sysName,
          plannerLines,
          agg.pricing.currency,
          brand,
          images,
        ),
      },
    ];

    await prisma.$transaction([
      ...docRows.map((d) =>
        prisma.document.upsert({
          where: {
            orderId_type_variant: {
              orderId: order.id,
              type: d.type,
              variant: d.variant,
            },
          },
          update: { html: d.html },
          create: {
            orderId: order.id,
            type: d.type,
            variant: d.variant,
            html: d.html,
          },
        }),
      ),
      ...snapshotUpdates,
      prisma.order.update({
        where: { id: order.id },
        // Denormalise the order grand total (M5) so the orders list can show a
        // price without re-solving every item.
        data: {
          status: "confirmed",
          totalPrice: agg.pricing.totals.grandTotal,
        },
      }),
    ]);

    res.json({
      orderId: order.id,
      status: "confirmed",
      documents: docRows.map((d) => ({ type: d.type, variant: d.variant })),
      totals: agg.pricing.totals,
    });
  }),
);

// ---- documents ------------------------------------------------------

ordersRouter.get(
  "/:id/documents",
  asyncHandler(async (req: AuthedRequest, res) => {
    await ownOrder(req, req.params.id);
    const docs = await prisma.document.findMany({
      where: { orderId: req.params.id },
      select: { type: true, variant: true, createdAt: true },
    });
    res.json(docs);
  }),
);

ordersRouter.get(
  "/:id/documents/:type",
  asyncHandler(async (req: AuthedRequest, res) => {
    await ownOrder(req, req.params.id);
    const type = req.params.type.toUpperCase() as DocumentType;
    if (!(type in DocumentType))
      throw new HttpError(400, `Unknown document type: ${req.params.type}`);
    const variant = parseVariant(req.query.variant);
    const doc = await findDoc(req.params.id, type, variant);
    if (!doc)
      throw new HttpError(
        404,
        "Document not generated yet (confirm the order first)",
      );
    const html = await hydrateDocumentPreviews(req.params.id, doc.html);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  }),
);

// PDF of a document — lazily rendered on first request, then cached in object
// storage. The confirmed order (and thus its stored HTML) is immutable, so the
// cached PDF never goes stale. Key existence IS the cache.
ordersRouter.get(
  "/:id/documents/:type/pdf",
  asyncHandler(async (req: AuthedRequest, res) => {
    await ownOrder(req, req.params.id);
    const type = req.params.type.toUpperCase() as DocumentType;
    if (!(type in DocumentType))
      throw new HttpError(400, `Unknown document type: ${req.params.type}`);
    const variant = parseVariant(req.query.variant);

    // Variant-keyed cache: existence == cached, and confirmed orders are immutable.
    const key = `orders/${req.params.id}/${type}__${variant}__catalog-preview-v1.pdf`;
    let pdf: Buffer;
    if (await objectExists(key)) {
      pdf = (await getObject(key)).body; // cache hit
    } else {
      const doc = await findDoc(req.params.id, type, variant);
      if (!doc)
        throw new HttpError(
          404,
          "Document not generated yet (confirm the order first)",
        );
      const html = await hydrateDocumentPreviews(req.params.id, doc.html);
      pdf = await htmlToPdf(html);
      await putObject(key, pdf, "application/pdf"); // cache for next time
    }

    const suffix = variant === "welded" ? "-welded" : "";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${type.toLowerCase()}${suffix}.pdf"`,
    );
    res.send(pdf);
  }),
);

// ---- shared ---------------------------------------------------------

async function hydrateDocumentPreviews(orderId: string, html: string): Promise<string> {
  if (!html.includes('class="preview-svg"')) return html;

  const previews = await prisma.orderItem.findMany({
    where: { orderId },
    orderBy: { id: "asc" },
    select: {
      cillKey: true,
      design: { select: { imageSvg: true, svgPreview: true } },
    },
  });
  // Items with a cill keep their baked engine SVG (it has the cill drawn);
  // null ⇒ leave the original block untouched. Others get the catalog preview.
  const svgs = previews.map((item) =>
    item.cillKey ? null : item.design.imageSvg ?? item.design.svgPreview ?? null,
  );
  let index = 0;

  return html.replace(/<div class="preview-svg">[\s\S]*?<\/div>/g, (block) => {
    const svg = svgs[index++];
    return svg ? `<div class="preview-svg">${svg}</div>` : block;
  });
}

function buildQuoteInput(
  orderNo: string,
  customer: string,
  reference: string | null,
  rest: {
    designId: string;
    widthMm: number;
    heightMm: number;
    systemId: string;
    mode?: "default" | "custom";
    overrides?: EngineOverrides | null;
    splitRatios?: Record<string, number> | null;
    cillKey?: string | null;
  },
): QuoteInput {
  return {
    orderNo,
    customer,
    reference: reference ?? undefined,
    designId: rest.designId,
    widthMm: rest.widthMm,
    heightMm: rest.heightMm,
    systemId: rest.systemId,
    mode: rest.mode,
    overrides: rest.overrides ?? undefined,
    splitRatios: rest.splitRatios ?? undefined,
    cillKey: rest.cillKey ?? undefined,
  };
}
