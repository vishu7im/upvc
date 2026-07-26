// =====================================================================
// api/discounts.ts — discount-code CRUD (Designer phase 6).
//
//   GET    /api/discounts            list (newest first)
//   POST   /api/discounts            create
//   PUT    /api/discounts/:code      edit (kind/value/active/validity window)
//   DELETE /api/discounts/:code      remove
//
// Commercial data, NOT catalog data — so there is deliberately no
// `loadCatalog()` refresh here: nothing the engine reads changes. A code is
// validated at APPLY time (orders.ts), not cached anywhere, so an admin
// deactivating a code takes effect on the next basket computation.
//
// Deleting a code is safe for history: confirmed orders keep the applied
// `discountCode` string and the frozen `discountAmount`/`basketTotals`, so the
// paperwork still says what the customer was charged.
// =====================================================================

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/client.ts";
import { asyncHandler, HttpError, validate } from "./http.ts";
import { requireAuth } from "./middleware/auth.ts";
import { requirePermission } from "./middleware/authorize.ts";

export const discountsRouter = Router();

discountsRouter.use(requireAuth);

/** Codes are stored and matched upper-case so "save10" and "SAVE10" are one code. */
function normaliseCode(code: string): string {
  return code.trim().toUpperCase();
}

const dateish = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : null));

const upsertSchema = z.object({
  code: z.string().min(2).max(40).optional(),
  kind: z.enum(["percent", "fixed"]),
  value: z.number().positive(),
  active: z.boolean().optional(),
  validFrom: dateish,
  validTo: dateish,
});

function assertWindow(from: Date | null, to: Date | null): void {
  if (from && Number.isNaN(from.getTime())) throw new HttpError(400, "validFrom is not a date");
  if (to && Number.isNaN(to.getTime())) throw new HttpError(400, "validTo is not a date");
  if (from && to && from > to)
    throw new HttpError(400, "validFrom must be before validTo");
}

function assertValue(kind: string, value: number): void {
  if (kind === "percent" && value > 100)
    throw new HttpError(400, "A percentage discount cannot exceed 100%");
}

discountsRouter.get(
  "/",
  requirePermission("discounts", "read"),
  asyncHandler(async (_req, res) => {
    const rows = await prisma.discountCode.findMany({ orderBy: { createdAt: "desc" } });
    res.json(rows.map((r) => ({ ...r, value: Number(r.value) })));
  }),
);

discountsRouter.post(
  "/",
  requirePermission("discounts", "create"),
  asyncHandler(async (req, res) => {
    const body = validate(upsertSchema, req.body);
    if (!body.code) throw new HttpError(400, "code is required");
    const code = normaliseCode(body.code);
    assertWindow(body.validFrom, body.validTo);
    assertValue(body.kind, body.value);

    const existing = await prisma.discountCode.findUnique({ where: { code } });
    if (existing) throw new HttpError(409, `Discount code ${code} already exists`);

    const row = await prisma.discountCode.create({
      data: {
        code,
        kind: body.kind,
        value: body.value,
        active: body.active ?? true,
        validFrom: body.validFrom,
        validTo: body.validTo,
      },
    });
    res.status(201).json({ ...row, value: Number(row.value) });
  }),
);

discountsRouter.put(
  "/:code",
  requirePermission("discounts", "update"),
  asyncHandler(async (req, res) => {
    const code = normaliseCode(req.params.code);
    const body = validate(upsertSchema, req.body);
    assertWindow(body.validFrom, body.validTo);
    assertValue(body.kind, body.value);

    const existing = await prisma.discountCode.findUnique({ where: { code } });
    if (!existing) throw new HttpError(404, `Unknown discount code: ${code}`);

    const row = await prisma.discountCode.update({
      where: { code },
      data: {
        kind: body.kind,
        value: body.value,
        active: body.active ?? existing.active,
        validFrom: body.validFrom,
        validTo: body.validTo,
      },
    });
    res.json({ ...row, value: Number(row.value) });
  }),
);

discountsRouter.delete(
  "/:code",
  requirePermission("discounts", "delete"),
  asyncHandler(async (req, res) => {
    const code = normaliseCode(req.params.code);
    const result = await prisma.discountCode.deleteMany({ where: { code } });
    if (result.count === 0) throw new HttpError(404, `Unknown discount code: ${code}`);
    res.status(204).end();
  }),
);
