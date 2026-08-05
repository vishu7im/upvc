// =====================================================================
// api/orders.ts — the order flow: draft → add items → confirm → docs.
// Mounted at /api/orders (behind requireAuth).
// =====================================================================

import { Router } from "express";
// `Prisma` is imported as a VALUE (not `import type`) because clearing the
// nullable `basketTotals` Json column on reopen needs `Prisma.DbNull`.
import { DocumentType, Prisma } from "@prisma/client";
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
import type { DocAdvisory, DocOption } from "../types.ts";
import { DEFAULT_SETTINGS, getFamily, getSystem } from "../catalog/index.ts";
import { resolveLineItem } from "../designer/resolve.ts";
import type {
  LineItemDraft,
  LineItemIssue,
  ResolvedLineItem,
} from "../designer/line-item-types.ts";
import { ADVISORY_ISSUE_KINDS, isBlockingIssue } from "../designer/line-item-types.ts";
import {
  buildOrderLineItemsRouter,
  liveCatalogSnapshot,
} from "./lineitems.ts";
import { legacyItemToDraft } from "../designer/legacy-import.ts";
import {
  buildQuoteInput,
  computeOrderBasket,
  dec,
  loadDiscount,
  type OrderCommercialRow,
} from "./order-basket.ts";
import {
  computeBasket,
  discountRejection,
  FITTING_TYPES,
  type BasketTotals,
} from "../designer/basket.ts";
import type {
  DocBasket,
  DocImage,
  EngineOverrides,
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

// Correcting who an order is for is not a fabrication change — but it IS
// printed on all 7 documents, so it is a DRAFT-only edit like every other
// mutation. A confirmed order must be reopened first.
const updateOrderSchema = z.object({
  customerName: z.string().min(1).optional(),
  reference: z.string().max(200).nullable().optional(),
});

ordersRouter.put(
  "/:id",
  requirePermission("orders", "create"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const order = await ownDraftOrder(req, req.params.id);
    const body = validate(updateOrderSchema, req.body);
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        ...(body.customerName !== undefined ? { customerName: body.customerName } : {}),
        ...(body.reference !== undefined ? { reference: body.reference } : {}),
      },
    });
    res.json(updated);
  }),
);

ordersRouter.get(
  "/",
  requirePermission("orders", "read"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const p = parsePagination(req.query);
    // OWN ⇒ only the caller's orders; ALL / Super Admin ⇒ every order.
    const scope = scopeFilter(req.auth!, "orders");
    // Optional server-side search + status filter, so the list's controls work
    // across the whole table rather than only the page in the browser.
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const where: Prisma.OrderWhereInput = {
      ...scope,
      ...(status === "draft" || status === "confirmed" ? { status } : {}),
      ...(q
        ? {
            OR: [
              { orderNo: { contains: q, mode: "insensitive" as const } },
              { customerName: { contains: q, mode: "insensitive" as const } },
              { reference: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: p.skip,
        take: p.take,
        include: {
          _count: { select: { items: true, designerItems: true, documents: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);
    // The list's money column is the BASKET grand total (extras + discount +
    // tax), not the raw engine total — the same number the detail page and the
    // Price Summary show. Confirmed orders replay their frozen snapshot; drafts
    // are priced live. A row that cannot be priced degrades to null rather than
    // failing the page.
    const rows = await Promise.all(
      data.map(async (o) => {
        let basketTotal: number | null = dec(o.totalPrice);
        try {
          basketTotal = (await computeOrderBasket(o as unknown as OrderCommercialRow)).grandTotal;
        } catch (err) {
          console.error(`[orders] basket pricing failed for ${o.id}`, err);
        }
        return { ...o, basketTotal };
      }),
    );
    res.json(paginated(rows, total, p));
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
        designerItems: { orderBy: { position: "asc" } },
        documents: { select: { type: true, variant: true, createdAt: true } },
      },
    });
    if (!order) throw new HttpError(404, "Order not found");
    // Designer items ship draft + a light summary of the cached resolve — the
    // full ResolvedLineItem (incl. SVG) is fetched via a re-resolve when needed.
    const { designerItems, items, ...rest } = order;
    // Live for drafts, frozen snapshot for confirmed orders (phase 6).
    const basket = await computeOrderBasket(order as unknown as OrderCommercialRow);
    // Can this legacy item be opened in the studio, and against which family?
    // Answered here, with the pure converter, so the UI never reimplements what
    // makes an item convertible (no configurable family claims its product;
    // Custom extraction mode) — a null key simply means no Edit link. The key
    // is what the /designer route needs in its query string.
    const snap = liveCatalogSnapshot();
    res.json({
      ...rest,
      items: items.map((i) => {
        const conv = legacyItemToDraft(
          {
            productId: i.productId,
            designId: i.designId,
            systemId: i.systemId,
            widthMm: i.widthMm,
            heightMm: i.heightMm,
            qty: i.qty,
            mode: i.mode,
            splitRatios: i.splitRatios as Record<string, number> | null,
            frameKey: i.frameKey,
            cillKey: i.cillKey,
            colourKeyInside: i.colourKeyInside,
            colourKeyOutside: i.colourKeyOutside,
          },
          snap,
        );
        return { ...i, studioFamilyKey: conv.blocking ? null : conv.draft!.familyKey };
      }),
      basket,
      designerItems: designerItems.map((d) => {
        const r = d.resolved as ResolvedLineItem | null;
        return {
          id: d.id,
          position: d.position,
          draft: d.draft,
          catalogVersion: d.catalogVersion,
          summary: r?.summary ?? null,
          issues: r?.issues ?? [],
          invalidSpec: r?.invalidSpec ?? false,
          invalidDimensions: r?.invalidDimensions ?? false,
          totals: r?.pricing?.totals ?? null,
        };
      }),
    });
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

/**
 * The draft a legacy item WOULD become in the studio — read-only, so opening
 * the studio on a legacy item changes nothing until the user saves.
 *
 * The conversion itself is pure (`designer/legacy-import.ts`); this is only its
 * I/O half. `issues` is part of the response on purpose: a colour or cill that
 * the family's option system does not offer must be visible before the user
 * saves over the original.
 */
ordersRouter.get(
  "/:id/items/:itemId/draft",
  requirePermission("orders", "read"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const order = await ownOrder(req, req.params.id);
    const item = await prisma.orderItem.findFirst({
      where: { id: req.params.itemId, orderId: order.id },
    });
    if (!item) throw new HttpError(404, "Order item not found");

    const result = legacyItemToDraft(
      {
        productId: item.productId,
        designId: item.designId,
        systemId: item.systemId,
        widthMm: item.widthMm,
        heightMm: item.heightMm,
        qty: item.qty,
        mode: item.mode,
        overrides: item.overrides,
        splitRatios: item.splitRatios as Record<string, number> | null,
        frameKey: item.frameKey,
        cillKey: item.cillKey,
        colourKeyInside: item.colourKeyInside,
        colourKeyOutside: item.colourKeyOutside,
      },
      liveCatalogSnapshot(),
    );
    res.json(result);
  }),
);

// ---- designer line items (Task 1 phase 2) ---------------------------
// CRUD for persisted LineItemDrafts; coexists with the legacy items above.
ordersRouter.use("/:id/line-items", buildOrderLineItemsRouter(ownDraftOrder));

// ---- commercials: fitting / survey / delivery / discount / tax ------
// Draft-only, like every other order mutation. The response carries fresh
// BasketTotals so the UI never has to re-derive the arithmetic (phase 6).

const commercialsSchema = z.object({
  fittingType: z.enum(FITTING_TYPES as [string, ...string[]]).optional(),
  fittingPrice: z.number().min(0).max(1_000_000).nullable().optional(),
  surveyPrice: z.number().min(0).max(1_000_000).nullable().optional(),
  deliveryCharge: z.number().min(0).max(1_000_000).nullable().optional(),
  discountCode: z.string().max(40).nullable().optional(),
  taxRatePct: z.number().min(0).max(100).nullable().optional(),
});

ordersRouter.put(
  "/:id/commercials",
  requirePermission("orders", "create"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const order = await ownDraftOrder(req, req.params.id);
    const body = validate(commercialsSchema, req.body);

    // Validate the discount BEFORE storing it: a code that is unknown, expired
    // or inactive is a 400 with the reason, not a silently-ignored field.
    let code: string | null = null;
    if (body.discountCode !== undefined && body.discountCode !== null) {
      const trimmed = body.discountCode.trim().toUpperCase();
      if (trimmed) {
        const discount = await loadDiscount(trimmed);
        if (!discount) throw new HttpError(400, `Unknown discount code: ${trimmed}`);
        const reason = discountRejection(discount);
        if (reason) throw new HttpError(400, reason);
        code = trimmed;
      }
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        ...(body.fittingType !== undefined ? { fittingType: body.fittingType } : {}),
        ...(body.fittingPrice !== undefined ? { fittingPrice: body.fittingPrice } : {}),
        ...(body.surveyPrice !== undefined ? { surveyPrice: body.surveyPrice } : {}),
        ...(body.deliveryCharge !== undefined ? { deliveryCharge: body.deliveryCharge } : {}),
        ...(body.discountCode !== undefined ? { discountCode: code } : {}),
        ...(body.taxRatePct !== undefined ? { taxRatePct: body.taxRatePct } : {}),
      },
    });

    const basket = await computeOrderBasket(updated as unknown as OrderCommercialRow);
    res.json({ order: updated, basket });
  }),
);

// ---- reopen: confirmed → draft -------------------------------------

/**
 * Put a confirmed order back into draft so its items can be corrected
 * (owner 2026-08-05). Until now `confirmed` was terminal and the only escape
 * was deleting the order.
 *
 * This DELIBERATELY BREAKS the "a confirmed order is immutable" invariant that
 * the document cache was built on, so it has to clean up everything that
 * invariant licensed:
 *
 *   - the 7 stored `Document` rows (their HTML is a snapshot of items that are
 *     about to change),
 *   - the frozen basket (`basketTotals` / `discountAmount` / `totalPrice`),
 *     which must be re-derived live while the order is a draft again,
 *   - the cached PDFs under `orders/{id}/` in object storage.
 *
 * Re-confirming regenerates all of it. The PDF route additionally had to stop
 * trusting key-existence alone — see the comment there.
 */
ordersRouter.post(
  "/:id/reopen",
  requirePermission("orders", "create"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const order = await ownOrder(req, req.params.id);
    if (order.status !== "confirmed") {
      throw new HttpError(409, "Only a confirmed order can be reopened");
    }

    // The document rows and the status flip must land together: a moment where
    // the order reads "draft" while stale documents are still served would
    // show the old paperwork as if it were current.
    await prisma.$transaction([
      prisma.document.deleteMany({ where: { orderId: order.id } }),
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: "draft",
          totalPrice: null,
          discountAmount: null,
          basketTotals: Prisma.DbNull,
        },
      }),
    ]);

    // Object storage is not transactional and is not the source of truth, so a
    // purge failure is logged rather than turned into a misleading 500 — the
    // same call the DELETE route makes. The PDF route now checks for the
    // Document row first, so a survivor of a failed purge is never served.
    if (storageConfigured()) {
      try {
        await deleteObjectsWithPrefix(`orders/${order.id}/`);
      } catch (err) {
        console.error(`[storage] failed to purge cached PDFs for order ${order.id}`, err);
      }
    }

    res.json({ id: order.id, status: "draft" });
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
    const designerRows = await prisma.designerLineItem.findMany({
      where: { orderId: order.id },
      orderBy: { position: "asc" },
    });
    if (items.length === 0 && designerRows.length === 0)
      throw new HttpError(400, "Order has no items to confirm");

    // ---- designer items: re-resolve; only BLOCKING errors stop confirm ----
    // (line-item-schema.md §5 — drafts may carry errors, confirm may not.)
    // Fabrication-limit breaches are advisory: they are the fabricator's call,
    // and they travel onto the work order instead of stopping it
    // (ADVISORY_ISSUE_KINDS, line-item-types.ts).
    const snapshot = designerRows.length ? liveCatalogSnapshot() : null;
    const designerSolved: {
      row: (typeof designerRows)[number];
      draft: LineItemDraft;
      resolved: ResolvedLineItem;
      output: NonNullable<ReturnType<typeof resolveLineItem>["output"]>;
    }[] = [];
    const blocked: { id: string; position: number; issues: LineItemIssue[] }[] = [];
    /** Advisory (non-blocking) issues, printed on the work order — see below. */
    const advisories: DocAdvisory[] = [];
    /**
     * The Work Order's "Main Options" block (Job 169). The reference prints one
     * page per item; we aggregate an order into ONE work order, so each row is
     * prefixed with its item when the order has more than one designer item —
     * an unprefixed value would claim to describe the whole order.
     */
    const mainOptionRows: { item: string; options: DocOption[] }[] = [];
    for (const row of designerRows) {
      const draft = row.draft as unknown as LineItemDraft;
      const { resolved, output } = resolveLineItem(draft, snapshot!);
      const blockers = resolved.issues.filter(isBlockingIssue);
      if (blockers.length > 0 || !output) {
        blocked.push({ id: row.id, position: row.position, issues: blockers });
      } else {
        designerSolved.push({ row, draft, resolved, output });
        if (resolved.summary?.mainOptions?.length) {
          mainOptionRows.push({
            item: `${draft.dimensions.widthMm} × ${draft.dimensions.heightMm} mm`,
            options: resolved.summary.mainOptions,
          });
        }
        // Advisories ride onto the paperwork so the fabricator sees, on the
        // shop floor, exactly which printed limit this job goes past.
        for (const issue of resolved.issues) {
          if (!ADVISORY_ISSUE_KINDS.has(issue.kind)) continue;
          advisories.push({
            item: `${draft.dimensions.widthMm} × ${draft.dimensions.heightMm} mm`,
            message: issue.message,
            ...(issue.source ? { source: issue.source } : {}),
          });
        }
      }
    }
    if (blocked.length > 0) {
      res.status(422).json({
        error: "Order has designer line items with unresolved errors",
        items: blocked,
      });
      return;
    }

    const systemId =
      items[0]?.systemId ?? (designerRows[0].draft as unknown as LineItemDraft).systemId;
    const system = getSystem(systemId);
    if (!system) throw new HttpError(500, `System not loaded: ${systemId}`);
    const settings: Settings = DEFAULT_SETTINGS;

    const solved: ItemForAggregation[] = [];
    const plannerLines: PlannerLine[] = [];
    // Basket lines are built from the SAME solves the documents use, so the
    // snapshot cannot drift from the paperwork (phase 6).
    const basketLines: Parameters<typeof computeBasket>[0] = [];
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
      basketLines.push({
        id: item.id,
        kind: "legacy",
        label: `${output.designName} — ${item.widthMm} × ${item.heightMm} mm`,
        qty: item.qty,
        netPrice: output.pricing.totals.netPrice,
      });
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

    // Designer line items join the same aggregation stream: the resolver's
    // engine output is shape-identical to a legacy item's solve() output, so
    // the 7-document pipeline needs no per-kind branching (data-model.md §3).
    designerSolved.forEach(({ row, draft, resolved, output }, j) => {
      const lineNo = items.length + j + 1;
      const qty = Math.max(1, draft.quantity ?? 1);
      solved.push({ output, qty });
      basketLines.push({
        id: row.id,
        kind: "designer",
        label:
          `${resolved.summary?.sizeLabel ?? `${draft.dimensions.widthMm} × ${draft.dimensions.heightMm} mm`}` +
          `${draft.location ? ` — ${draft.location}` : ""}`,
        qty,
        netPrice: output.pricing.totals.netPrice,
      });
      plannerLines.push({
        lineNo,
        productName: getFamily(draft.familyKey)?.name ?? draft.familyKey,
        designName: output.designName,
        widthMm: draft.dimensions.widthMm,
        heightMm: draft.dimensions.heightMm,
        qty,
        mode: "designer",
        totalPrice: output.pricing.totals.grandTotal * qty,
      });
      images.push({
        // Designer items always use the engine SVG — it reflects every edit,
        // pinned glass and colour the draft carries (a catalog preview cannot).
        svg: output.geometry.svg,
        caption:
          `${lineNo}. ${output.designName} — ${draft.dimensions.widthMm} × ${draft.dimensions.heightMm} mm` +
          `${qty > 1 ? ` ×${qty}` : ""}${draft.location ? ` — ${draft.location}` : ""}`,
      });
      snapshotUpdates.push(
        prisma.designerLineItem.update({
          where: { id: row.id },
          data: {
            resolved: resolved as unknown as Prisma.InputJsonValue,
            catalogVersion: resolved.catalogVersion,
          },
        }),
      );
    });

    // Order-level aggregation (multi-window).
    const agg = aggregateOrder(solved, system, settings);

    // The commercial layer, frozen at confirm (phase 6): the customer keeps the
    // numbers they agreed to even if a price list, a VAT rate or the discount
    // code changes afterwards.
    const basket: BasketTotals = computeBasket(
      basketLines,
      {
        fittingType: order.fittingType,
        fittingPrice: dec(order.fittingPrice),
        surveyPrice: dec(order.surveyPrice),
        deliveryCharge: dec(order.deliveryCharge),
        discount: await loadDiscount(order.discountCode),
        taxRatePct: dec(order.taxRatePct),
      },
      settings,
      new Date(),
      { aggregateNetPrice: agg.pricing.totals.netPrice },
    );
    // Single-item orders carry that item's real W×H in the shared header;
    // genuine multi-window orders have no single dimension, so 0/0 ⇒ the header
    // renders "—" (each line's own W×H still shows in the preview-band captions).
    const totalLines = items.length + designerSolved.length;
    const onlyLineDims =
      totalLines === 1
        ? items.length === 1
          ? { w: items[0].widthMm, h: items[0].heightMm }
          : {
              w: designerSolved[0].draft.dimensions.widthMm,
              h: designerSolved[0].draft.dimensions.heightMm,
            }
        : { w: 0, h: 0 };
    const synth = buildQuoteInput(
      order.orderNo,
      order.customerName,
      order.reference,
      {
        designId: "",
        widthMm: onlyLineDims.w,
        heightMm: onlyLineDims.h,
        systemId,
      },
    );
    const label = `${totalLines} line(s)`;
    const sysName = system.name;

    const brand = settings.branding;
    // Only print the commercial block when the order actually carries
    // commercial data; a plain order's documents stay byte-identical to
    // pre-phase-6 output (phase-6 acceptance §5).
    const docBasket: DocBasket | undefined =
      basket.discount || basket.extras || basket.itemsAdjustment
        ? {
            currency: basket.currency,
            itemsSubtotal: basket.itemsSubtotal,
            itemsAdjustment: basket.itemsAdjustment,
            discount: basket.discount,
            discountCode: basket.discountCode,
            fitting: basket.fitting,
            survey: basket.survey,
            delivery: basket.delivery,
            taxRatePct: basket.taxRatePct,
            tax: basket.tax,
            grandTotal: basket.grandTotal,
          }
        : undefined;
    // Flatten the per-item Main Options into the single aggregated work order.
    // One designer item ⇒ the reference's plain two-column table; several ⇒ each
    // label carries its item, because one value cannot describe them all.
    const multi = mainOptionRows.length > 1;
    const mainOptions: DocOption[] = mainOptionRows.flatMap(({ item, options }) =>
      options.map((o) => ({ label: multi ? `${item} — ${o.label}` : o.label, value: o.value })),
    );

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
          undefined,
          undefined,
          advisories.length ? advisories : undefined,
          mainOptions.length ? mainOptions : undefined,
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
          undefined,
          undefined,
          advisories.length ? advisories : undefined,
          mainOptions.length ? mainOptions : undefined,
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
          undefined,
          undefined,
          docBasket,
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
          docBasket,
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
        // price without re-solving every item. Since phase 6 that total is the
        // BASKET grand total (extras + discount + tax) — what the customer
        // actually pays — and the full breakdown is frozen alongside it.
        data: {
          status: "confirmed",
          totalPrice: basket.grandTotal,
          discountAmount: basket.discount,
          basketTotals: basket as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);

    res.json({
      orderId: order.id,
      status: "confirmed",
      documents: docRows.map((d) => ({ type: d.type, variant: d.variant })),
      totals: agg.pricing.totals,
      basket,
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
// storage under a deterministic, variant-keyed name.
//
// The cache used to be keyed on existence ALONE, because a confirmed order was
// immutable. `POST /:id/reopen` ended that: an order can now go back to draft,
// have its items changed, and be re-confirmed. The DOCUMENT ROW is therefore
// checked FIRST — reopen deletes those rows in the same transaction as the
// status flip, so a stale object left behind by a failed purge can never be
// served. On a live document the extra lookup is one indexed read, and the
// cache still saves the Puppeteer render, which is the expensive part.
ordersRouter.get(
  "/:id/documents/:type/pdf",
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

    const key = `orders/${req.params.id}/${type}__${variant}__catalog-preview-v1.pdf`;
    let pdf: Buffer;
    if (await objectExists(key)) {
      pdf = (await getObject(key)).body; // cache hit
    } else {
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

// `buildQuoteInput` lives in ./order-basket.ts — the confirm path, the
// add-item validation and the basket pricing all price an item through the
// same builder, so they cannot drift apart.
