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
import { requirePermission, scopeFilter } from "./middleware/authorize.ts";
import { paginated, parsePagination } from "./pagination.ts";
import { htmlToPdf } from "../services/pdf.ts";
import {
  deleteObjectsWithPrefix,
  getObject,
  objectExists,
  putObject,
  storageConfigured,
} from "../services/storage.ts";

export const ordersRouter = Router();

// ---- helpers --------------------------------------------------------

/**
 * Fetch an order the caller may access, or 404. Data scope comes from the
 * caller's `orders` grant (PLAN §5.4): scope OWN ⇒ only their own rows
 * (`{ userId }`), scope ALL / Super Admin ⇒ any order (`{}`). This is what
 * finally lets an admin see other users' orders — as a permission-driven
 * behaviour, not a hardcoded owner filter.
 */
async function ownOrder(req: AuthedRequest, id: string) {
  const order = await prisma.order.findFirst({
    where: { id, ...scopeFilter(req.auth!, "orders") },
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
  requirePermission("orders", "create"),
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
  requirePermission("orders", "read"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const p = parsePagination(req.query);
    // OWN ⇒ only the caller's orders; ALL / Super Admin ⇒ every order.
    const where = scopeFilter(req.auth!, "orders");
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
  requirePermission("orders", "read"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, ...scopeFilter(req.auth!, "orders") },
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

ordersRouter.delete(
  "/:id",
  requirePermission("orders", "delete"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const order = await ownOrder(req, req.params.id);

    // OrderItem and Document rows cascade from the Order relation.
    await prisma.order.delete({ where: { id: order.id } });

    // Generated PDFs live outside PostgreSQL. The database deletion is the
    // authoritative operation, so unavailable object storage is logged without
    // turning a successful delete into a misleading 500 response.
    if (storageConfigured()) {
      try {
        await deleteObjectsWithPrefix(`orders/${order.id}/`);
      } catch (err) {
        console.error(`[storage] failed to remove cached files for order ${order.id}`, err);
      }
    }

    res.status(204).end();
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
  frameKey: z.string().optional(),
  cillKey: z.string().optional(),
  colourKeyInside: z.string().optional(),
  colourKeyOutside: z.string().optional(),
});

// Assembling a draft (add/remove items, confirm) is part of "create" on orders:
// the seeded Customer role holds orders create OWN and must be able to build and
// confirm its own orders. A role with only `read` (e.g. a read-all auditor) can
// view but reaches none of these — the PLAN §5.4 "view but not mutate" case.
ordersRouter.post(
  "/:id/items",
  requirePermission("orders", "create"),
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
          frameKey: body.frameKey,
          cillKey: body.cillKey,
          colourKeyInside: body.colourKeyInside,
          colourKeyOutside: body.colourKeyOutside,
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
        frameKey: body.frameKey ?? null,
        cillKey: body.cillKey ?? null,
        colourKeyInside: body.colourKeyInside ?? null,
        colourKeyOutside: body.colourKeyOutside ?? null,
      },
    });
    res.status(201).json(item);
  }),
);

ordersRouter.delete(
  "/:id/items/:itemId",
  requirePermission("orders", "create"),
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
  requirePermission("orders", "create"),
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
          frameKey: item.frameKey,
          cillKey: item.cillKey,
          colourKeyInside: item.colourKeyInside,
          colourKeyOutside: item.colourKeyOutside,
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
          item.cillKey || item.splitRatios || item.colourKeyInside || item.colourKeyOutside
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
  requirePermission("orders", "read"),
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
  requirePermission("orders", "read"),
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
  requirePermission("orders", "read"),
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
      splitRatios: true,
      colourKeyInside: true,
      colourKeyOutside: true,
      design: { select: { imageSvg: true, svgPreview: true } },
    },
  });
  // Items whose baked engine SVG carries info the catalog preview lacks — a cill,
  // dragged spans, or a colour/joint tint — keep that baked SVG (null ⇒ leave the
  // original block untouched). Plain items fall back to the catalog preview.
  const svgs = previews.map((item) =>
    item.cillKey || item.splitRatios || item.colourKeyInside || item.colourKeyOutside
      ? null
      : item.design.imageSvg ?? item.design.svgPreview ?? null,
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
    frameKey?: string | null;
    cillKey?: string | null;
    colourKeyInside?: string | null;
    colourKeyOutside?: string | null;
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
    frameKey: rest.frameKey ?? undefined,
    cillKey: rest.cillKey ?? undefined,
    colourKey: rest.colourKeyInside ?? undefined,
    colourKeyOutside: rest.colourKeyOutside ?? undefined,
  };
}
