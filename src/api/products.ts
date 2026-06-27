// =====================================================================
// api/products.ts — product lines and their (paginated) design galleries.
// Mounted at /api/products (behind requireAuth).
// =====================================================================

import { Router } from "express";
import { prisma } from "../db/client.ts";
import { asyncHandler, HttpError } from "./http.ts";
import { paginated, parsePagination } from "./pagination.ts";

export const productsRouter = Router();

// GET /api/products — paginated product list.
productsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const p = parsePagination(req.query);
    const [data, total] = await Promise.all([
      prisma.product.findMany({
        orderBy: { listIndex: "asc" },
        skip: p.skip,
        take: p.take,
        include: { _count: { select: { designs: true } } },
      }),
      prisma.product.count(),
    ]);
    res.json(
      paginated(
        data.map((d) => ({
          id: d.id,
          name: d.name,
          typeId: d.typeId,
          systemId: d.systemId,
          designCount: d._count.designs,
        })),
        total,
        p,
      ),
    );
  }),
);

// GET /api/products/:id
productsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { designs: true } } },
    });
    if (!product) throw new HttpError(404, "Product not found");
    res.json({
      id: product.id,
      name: product.name,
      typeId: product.typeId,
      systemId: product.systemId,
      designCount: product._count.designs,
    });
  }),
);

// GET /api/products/:id/designs?page&limit — paginated design gallery.
// Excludes the (large) imageSvg here; fetch it via GET /api/designs/:id.
productsRouter.get(
  "/:id/designs",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) throw new HttpError(404, "Product not found");

    const p = parsePagination(req.query);
    const where = { productId: product.id };
    const [data, total] = await Promise.all([
      prisma.design.findMany({
        where,
        orderBy: [{ quotable: "desc" }, { listIndex: "asc" }, { name: "asc" }],
        skip: p.skip,
        take: p.take,
        select: {
          designId: true,
          name: true,
          productType: true,
          quotable: true,
          quantityOfSquares: true,
          externalId: true,
        },
      }),
      prisma.design.count({ where }),
    ]);
    res.json(paginated(data, total, p));
  }),
);
