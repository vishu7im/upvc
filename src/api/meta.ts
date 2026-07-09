// =====================================================================
// api/meta.ts — RBAC metadata for the role-grid editor (PLAN §6.3).
//
//   GET /api/meta/permissions  → { modules, actions }
//
// Harmless catalogue of the permission surface (module slugs + nav metadata and
// the available actions). Guarded by requireAuth only — it feeds the grid editor
// and carries no per-user data.
// =====================================================================

import { Router } from "express";
import { prisma } from "../db/client.ts";
import { asyncHandler } from "./http.ts";
import { requireAuth } from "./middleware/auth.ts";

export const metaRouter = Router();

metaRouter.get(
  "/permissions",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const [modules, actions] = await Promise.all([
      prisma.module.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { slug: true, name: true, navPath: true, category: true, sortOrder: true },
      }),
      prisma.permissionAction.findMany({
        orderBy: { sortOrder: "asc" },
        select: { slug: true, name: true },
      }),
    ]);
    res.json({ modules, actions });
  }),
);
