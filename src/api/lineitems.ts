// =====================================================================
// api/lineitems.ts — the Designer line-item API (Task 1 phase 2).
//
//   POST /api/line-items/resolve                  PUBLIC, stateless: body =
//        LineItemDraft → ResolvedLineItem. Powers the live designer exactly
//        like /api/quote powers /quote (debounced, no auth, no persistence).
//        400 only for MALFORMED bodies; an invalid-but-well-formed draft
//        returns 200 with error issues inside (line-item-schema.md §5).
//
//   POST   /api/orders/:id/line-items             auth'd, draft orders only
//   PUT    /api/orders/:id/line-items/:itemId       (mounted by orders.ts —
//   DELETE /api/orders/:id/line-items/:itemId        the order guards live
//                                                    there with the legacy
//                                                    item routes)
//
// Drafts MAY persist with error issues (the designer saves work-in-progress);
// confirm is the gate that rejects them (orders.ts).
// =====================================================================

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/client.ts";
import {
  DEFAULT_SETTINGS,
  getCatalogVersion,
  getDesign,
  getFamily,
  getOptionSystem,
  getSystem,
} from "../catalog/index.ts";
import { resolveLineItem } from "../designer/resolve.ts";
import type { CatalogSnapshot, LineItemDraft } from "../designer/line-item-types.ts";
import type { QuoteView } from "../types.ts";
import { asyncHandler, type AuthedRequest, HttpError, validate } from "./http.ts";
import { requirePermission } from "./middleware/authorize.ts";

// ---------------------------------------------------------------------
// The live catalog snapshot (the loader cache, stamped with its version)
// ---------------------------------------------------------------------

export function liveCatalogSnapshot(): CatalogSnapshot {
  return {
    catalogVersion: getCatalogVersion(),
    settings: DEFAULT_SETTINGS,
    getFamily,
    getOptionSystem,
    getSystem,
    getDesign,
  };
}

// ---------------------------------------------------------------------
// Draft validation (STRUCTURAL — semantic problems become resolve issues)
// ---------------------------------------------------------------------

const topologyEditOps = [
  "split",
  "add-midrail",
  "convert-component",
  "set-sash-kind",
  "remove-divider",
] as const;

const selectionSchema = z.object({
  optionKey: z.string().min(1),
  choiceKey: z.string().min(1).optional(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  scope: z.string().min(1).optional(),
  appliedVia: z.enum(["this", "all-of-type"]).optional(),
});

const draftEditSchema = z.object({
  id: z.string().min(1),
  edit: z
    .object({
      op: z.enum(topologyEditOps),
      componentId: z.string().min(1),
    })
    .passthrough(), // op-specific params are checked by the adapter (fail-loud → issues)
});

export const lineItemDraftSchema = z.object({
  schemaVersion: z.number().int(),
  familyKey: z.string().min(1),
  systemId: z.string().min(1),
  designId: z.string().min(1),
  quantity: z.number().int().positive().max(999).default(1),
  location: z.string().max(200).optional(),
  dimensions: z.record(z.string(), z.number()),
  splitMode: z.enum(["byDimensions", "equalSplit", "equalGlass"]).optional(),
  splitRatios: z.record(z.string(), z.number()).optional(),
  topologyEdits: z.array(draftEditSchema).max(50).optional(),
  selections: z.array(selectionSchema).max(200).optional(),
});

function parseDraft(body: unknown): LineItemDraft {
  return validate(lineItemDraftSchema, body) as LineItemDraft;
}

/**
 * Which elevations to render. A REQUEST option, not part of the draft: the
 * draft schema strips it (zod drops unknown keys), so nothing view-related is
 * ever persisted. Accepted as `views` in the body or `?views=internal,schematic`
 * in the query; "external" is always rendered and needs no asking.
 */
const viewsSchema = z.array(z.enum(["internal", "schematic"])).max(2).optional();

function parseViews(req: { body: unknown; query: Record<string, unknown> }): QuoteView[] | undefined {
  const raw =
    (req.body as { views?: unknown } | undefined)?.views ??
    (typeof req.query.views === "string" ? req.query.views.split(",").filter(Boolean) : undefined);
  if (raw === undefined) return undefined;
  const parsed = validate(viewsSchema, Array.isArray(raw) ? raw.filter((v) => v !== "external") : raw);
  return parsed?.length ? (parsed as QuoteView[]) : undefined;
}

/**
 * How those elevations are drawn — the same request-only discipline as `views`.
 * The draft schema strips it, so a saved item never remembers which style
 * someone happened to be looking at, and documents always render flat.
 */
const styleSchema = z.enum(["flat", "realistic"]).optional();

function parseStyle(req: { body: unknown; query: Record<string, unknown> }): "flat" | "realistic" | undefined {
  const raw =
    (req.body as { style?: unknown } | undefined)?.style ??
    (typeof req.query.style === "string" ? req.query.style : undefined);
  if (raw === undefined) return undefined;
  return validate(styleSchema, raw);
}

// ---------------------------------------------------------------------
// Public stateless resolve
// ---------------------------------------------------------------------

export const lineItemsRouter = Router();

lineItemsRouter.post(
  "/resolve",
  asyncHandler(async (req, res) => {
    const draft = parseDraft(req.body); // 400 on malformed (validate throws HttpError)
    const views = parseViews(req);
    const style = parseStyle(req);
    const options = views || style ? { ...(views ? { views } : {}), ...(style ? { style } : {}) } : undefined;
    const { resolved } = resolveLineItem(draft, liveCatalogSnapshot(), options);
    res.json(resolved);
  }),
);

// ---------------------------------------------------------------------
// Order-scoped persistence (mounted at /api/orders/:id/line-items)
// ---------------------------------------------------------------------

/**
 * `ownDraftOrder` is injected by orders.ts (it owns the order-scope helpers);
 * mergeParams carries :id through.
 */
export function buildOrderLineItemsRouter(
  ownDraftOrder: (req: AuthedRequest, id: string) => Promise<{ id: string }>,
) {
  const router = Router({ mergeParams: true });

  router.post(
    "/",
    requirePermission("orders", "create"),
    asyncHandler(async (req: AuthedRequest, res) => {
      const order = await ownDraftOrder(req, req.params.id);
      const draft = parseDraft(req.body);
      const { resolved } = resolveLineItem(draft, liveCatalogSnapshot());

      const last = await prisma.designerLineItem.findFirst({
        where: { orderId: order.id },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const item = await prisma.designerLineItem.create({
        data: {
          orderId: order.id,
          position: (last?.position ?? 0) + 1,
          draft: draft as object,
          resolved: resolved as unknown as object,
          catalogVersion: resolved.catalogVersion,
        },
      });
      res.status(201).json({ id: item.id, position: item.position, resolved });
    }),
  );

  router.put(
    "/:itemId",
    requirePermission("orders", "create"),
    asyncHandler(async (req: AuthedRequest, res) => {
      const order = await ownDraftOrder(req, req.params.id);
      const existing = await prisma.designerLineItem.findFirst({
        where: { id: req.params.itemId, orderId: order.id },
      });
      if (!existing) throw new HttpError(404, "Line item not found");

      const draft = parseDraft(req.body);
      const { resolved } = resolveLineItem(draft, liveCatalogSnapshot());
      await prisma.designerLineItem.update({
        where: { id: existing.id },
        data: {
          draft: draft as object,
          resolved: resolved as unknown as object,
          catalogVersion: resolved.catalogVersion,
        },
      });
      res.json({ id: existing.id, position: existing.position, resolved });
    }),
  );

  router.delete(
    "/:itemId",
    requirePermission("orders", "create"),
    asyncHandler(async (req: AuthedRequest, res) => {
      const order = await ownDraftOrder(req, req.params.id);
      const result = await prisma.designerLineItem.deleteMany({
        where: { id: req.params.itemId, orderId: order.id },
      });
      if (result.count === 0) throw new HttpError(404, "Line item not found");
      res.status(204).end();
    }),
  );

  return router;
}
