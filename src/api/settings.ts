// =====================================================================
// api/settings.ts — admin settings + company branding (M4).
//
//   GET  /api/settings           (admin) current financial + branding settings
//   PUT  /api/settings           (admin) update financial + branding text fields
//   POST /api/settings/logo      (admin) upload the company logo (raw image body)
//
// The public logo route GET /api/branding/logo is mounted in server.ts so a
// browser <img> can load it without a bearer token.
//
// After any change we call loadCatalog() so DEFAULT_SETTINGS.branding (and the
// embedded logo data-URI baked into documents) refreshes immediately.
// =====================================================================

import express, { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/client.ts";
import { asyncHandler, HttpError, validate } from "./http.ts";
import { requireAuth } from "./middleware/auth.ts";
import { requirePermission } from "./middleware/authorize.ts";
import { loadCatalog } from "../catalog/index.ts";
import { putObject } from "../services/storage.ts";

export const settingsRouter = Router();

const LOGO_KEY = "branding/logo";

settingsRouter.get(
  "/",
  requireAuth,
  requirePermission("settings", "read"),
  asyncHandler(async (_req, res) => {
    const s = await prisma.setting.findUnique({ where: { id: 1 } });
    if (!s) throw new HttpError(404, "Settings not seeded");
    res.json({
      currency: s.currency,
      taxApply: s.taxApply,
      taxPct: Number(s.taxPct),
      markupPct: Number(s.markupPct),
      wastagePct: Number(s.wastagePct),
      labourPerSash: Number(s.labourPerSash),
      labourPerDoor: Number(s.labourPerDoor),
      labourBase: Number(s.labourBase),
      weldAllowanceMm: Number(s.weldAllowanceMm),
      branding: {
        companyName: s.companyName,
        companyAddress: s.companyAddress,
        accentColor: s.accentColor,
        hasLogo: Boolean(s.logoKey),
        logoUrl: s.logoKey ? "/api/branding/logo" : null,
      },
    });
  }),
);

const updateSchema = z
  .object({
    currency: z.string().min(1),
    taxApply: z.boolean(),
    taxPct: z.number().min(0),
    markupPct: z.number().min(0),
    wastagePct: z.number().min(0),
    labourPerSash: z.number().min(0),
    labourPerDoor: z.number().min(0),
    labourBase: z.number().min(0),
    weldAllowanceMm: z.number().min(0),
    companyName: z.string().max(200).nullable(),
    companyAddress: z.string().max(500).nullable(),
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{3,8}$/, "accentColor must be a hex colour like #1f6feb")
      .nullable(),
  })
  .partial();

settingsRouter.put(
  "/",
  requireAuth,
  requirePermission("settings", "update"),
  asyncHandler(async (req, res) => {
    const data = validate(updateSchema, req.body);
    if (Object.keys(data).length === 0) throw new HttpError(400, "No fields to update");
    await prisma.setting.update({ where: { id: 1 }, data });
    await loadCatalog(); // refresh DEFAULT_SETTINGS (incl. branding) in memory
    res.json({ ok: true });
  }),
);

// Raw image upload (e.g. `--data-binary @logo.png` with Content-Type: image/png).
settingsRouter.post(
  "/logo",
  requireAuth,
  requirePermission("settings", "update"),
  express.raw({ type: "image/*", limit: "2mb" }),
  asyncHandler(async (req, res) => {
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new HttpError(400, "Send the logo as a raw image body with an image/* Content-Type");
    }
    const contentType = req.headers["content-type"] || "image/png";
    await putObject(LOGO_KEY, body, contentType);
    await prisma.setting.update({ where: { id: 1 }, data: { logoKey: LOGO_KEY } });
    await loadCatalog(); // re-fetch the logo into the in-memory branding data-URI
    res.json({ ok: true, logoUrl: "/api/branding/logo", bytes: body.length });
  }),
);
