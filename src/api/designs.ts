// =====================================================================
// api/designs.ts — single design fetch (incl. SVG + quotable flag).
// Mounted at /api/designs (behind requireAuth).
// =====================================================================

import { Router } from "express";
import { prisma } from "../db/client.ts";
import { asyncHandler, HttpError } from "./http.ts";

export const designsRouter = Router();

// GET /api/designs/:id — full design including imageSvg/topology.
designsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const d = await prisma.design.findUnique({ where: { designId: req.params.id } });
    if (!d) throw new HttpError(404, "Design not found");
    res.json({
      designId: d.designId,
      name: d.name,
      productType: d.productType,
      productId: d.productId,
      frameKey: d.frameKey,
      quotable: d.quotable,
      quantityOfSquares: d.quantityOfSquares,
      externalId: d.externalId,
      hasTopology: d.topology != null,
      defaultWidthMm: d.defaultWidthMm,
      defaultHeightMm: d.defaultHeightMm,
      imageSvg: d.imageSvg ?? d.svgPreview ?? null,
    });
  }),
);
