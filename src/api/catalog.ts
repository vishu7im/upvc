// =====================================================================
// api/catalog.ts — admin catalog editing + bulk price import (M5).
//
// The catalog (profiles/glass/gaskets/hardware/colours) ships with cost/price
// = 0; the owner fills real supplier numbers HERE, never guessed in code
// (golden rule). All routes require admin. After every write we call
// loadCatalog() so the in-memory catalog the engine reads refreshes
// immediately — same pattern as src/api/settings.ts.
//
//   GET  /api/catalog/:systemId                         full priced dump
//   PUT  /api/catalog/:systemId/parts/:kind/:partKey    profile cost/price/weight
//   PUT  /api/catalog/:systemId/glass/:partKey          glass cost/price/weight
//   PUT  /api/catalog/:systemId/gaskets/:partKey        gasket cost/price/weight
//   PUT  /api/catalog/:systemId/hardware/:partKey       hardware cost/price/weight
//   PUT  /api/catalog/:systemId/cills/:partKey          cill cost/price/weight
//   POST /api/catalog/:systemId/glass                   add a glass variant
//   POST /api/catalog/:systemId/cills                   add a cill variant
//   POST /api/catalog/:systemId/colours                 add a colour/finish
//   PUT  /api/catalog/:systemId/colours/:key            edit a colour/finish
//   POST /api/catalog/:systemId/import                  CSV bulk price import
// =====================================================================

import express, { Router } from "express";
import { PartKind } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/client.ts";
import { asyncHandler, HttpError, validate } from "./http.ts";
import { requireAuth } from "./middleware/auth.ts";
import { requirePermission } from "./middleware/authorize.ts";
import { loadCatalog, refreshSystemCatalog } from "../catalog/index.ts";

export const catalogRouter = Router();

// Every catalog route needs a valid session; the specific permission
// (catalog.read / .update / .create) is enforced per-route below (PLAN §5.3).
catalogRouter.use(requireAuth);

/** 404 unless the system exists. */
async function assertSystem(systemId: string) {
  const sys = await prisma.profileSystem.findUnique({ where: { id: systemId } });
  if (!sys) throw new HttpError(404, `Unknown system: ${systemId}`);
}

// ---- Read: full priced dump (served from the in-memory catalog) ------
catalogRouter.get(
  "/:systemId",
  requirePermission("catalog", "read"),
  asyncHandler(async (req, res) => {
    const sys = await refreshSystemCatalog(req.params.systemId);
    if (!sys) throw new HttpError(404, `Unknown system: ${req.params.systemId}`);
    res.json(sys);
  }),
);

// ---- Update price/cost/weight on a single part ----------------------
const priceSchema = z
  .object({
    cost: z.number().min(0),
    price: z.number().min(0),
    weight: z.number().min(0),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, "Provide at least one of cost, price, weight");

// Profile parts also carry a welding-shrinkage allowance (mm per welded end).
// Only profile_part has this column, so it lives on the parts PUT — not on the
// shared glass/gasket/hardware updater below.
// The four cost1p/price1p/cost2p/price2p tier columns (M5.5) are nullable: pass
// a number to set a tier price, or null to clear it back to the %-uplift fallback.
const partSchema = z
  .object({
    cost: z.number().min(0),
    price: z.number().min(0),
    weight: z.number().min(0),
    weldAllowanceMm: z.number().min(0),
    cost1p: z.number().min(0).nullable(),
    price1p: z.number().min(0).nullable(),
    cost2p: z.number().min(0).nullable(),
    price2p: z.number().min(0).nullable(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, "Provide at least one editable field");

catalogRouter.put(
  "/:systemId/parts/:kind/:partKey",
  requirePermission("catalog", "update"),
  asyncHandler(async (req, res) => {
    await assertSystem(req.params.systemId);
    const kind = req.params.kind.toUpperCase();
    if (!(kind in PartKind)) throw new HttpError(400, `Unknown part kind: ${req.params.kind}`);
    const data = validate(partSchema, req.body);
    const result = await prisma.profilePart.updateMany({
      where: { systemId: req.params.systemId, kind: kind as PartKind, partKey: req.params.partKey },
      data,
    });
    if (result.count === 0) throw new HttpError(404, `No ${kind} part "${req.params.partKey}"`);
    await loadCatalog();
    res.json({ ok: true, updated: result.count });
  }),
);

/** Shared cost/price updater for the single-table parts (glass/gasket/hardware/cill). */
function makePartPriceUpdater(
  table: "glass" | "gasket" | "hardware" | "cill",
  label: string,
) {
  return asyncHandler(async (req, res) => {
    await assertSystem(req.params.systemId);
    const data = validate(priceSchema, req.body);
    // @ts-expect-error — delegate picked dynamically; the where/data shapes match.
    const result = await prisma[table].updateMany({
      where: { systemId: req.params.systemId, partKey: req.params.partKey },
      data,
    });
    if (result.count === 0) throw new HttpError(404, `No ${label} "${req.params.partKey}"`);
    await loadCatalog();
    res.json({ ok: true, updated: result.count });
  });
}

const catalogUpdate = requirePermission("catalog", "update");
catalogRouter.put("/:systemId/glass/:partKey", catalogUpdate, makePartPriceUpdater("glass", "glass"));
catalogRouter.put("/:systemId/gaskets/:partKey", catalogUpdate, makePartPriceUpdater("gasket", "gasket"));
catalogRouter.put("/:systemId/hardware/:partKey", catalogUpdate, makePartPriceUpdater("hardware", "hardware"));
catalogRouter.put("/:systemId/cills/:partKey", catalogUpdate, makePartPriceUpdater("cill", "cill"));

// ---- Add a glass variant --------------------------------------------
const newGlassSchema = z.object({
  partKey: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  rebatePerSide: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  price: z.number().min(0).optional(),
  weight: z.number().min(0).optional(),
  financialCategory: z.string().min(1).optional(),
});

catalogRouter.post(
  "/:systemId/glass",
  requirePermission("catalog", "create"),
  asyncHandler(async (req, res) => {
    await assertSystem(req.params.systemId);
    const b = validate(newGlassSchema, req.body);
    const exists = await prisma.glass.findUnique({
      where: { systemId_partKey: { systemId: req.params.systemId, partKey: b.partKey } },
    });
    if (exists) throw new HttpError(409, `Glass "${b.partKey}" already exists (use PUT to edit)`);
    await prisma.glass.create({
      data: {
        systemId: req.params.systemId,
        partKey: b.partKey,
        code: b.code,
        name: b.name,
        rebatePerSide: b.rebatePerSide ?? 0,
        cost: b.cost ?? 0,
        price: b.price ?? 0,
        per: "m2",
        weight: b.weight ?? 0,
        financialCategory: b.financialCategory ?? "Glazing Accessories",
      },
    });
    await loadCatalog();
    res.status(201).json({ ok: true, partKey: b.partKey });
  }),
);

// ---- Add a cill variant ---------------------------------------------
const newCillSchema = z.object({
  partKey: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  projectionMm: z.number().int().positive(),
  cost: z.number().min(0).optional(),
  price: z.number().min(0).optional(),
  weight: z.number().min(0).optional(),
  financialCategory: z.string().min(1).optional(),
});

catalogRouter.post(
  "/:systemId/cills",
  requirePermission("catalog", "create"),
  asyncHandler(async (req, res) => {
    await assertSystem(req.params.systemId);
    const b = validate(newCillSchema, req.body);
    const exists = await prisma.cill.findUnique({
      where: { systemId_partKey: { systemId: req.params.systemId, partKey: b.partKey } },
    });
    if (exists) throw new HttpError(409, `Cill "${b.partKey}" already exists (use PUT to edit)`);
    await prisma.cill.create({
      data: {
        systemId: req.params.systemId,
        partKey: b.partKey,
        code: b.code,
        name: b.name,
        projectionMm: b.projectionMm,
        cost: b.cost ?? 0,
        price: b.price ?? 0,
        per: "m",
        weight: b.weight ?? 0,
        financialCategory: b.financialCategory ?? "Glazing Accessories",
      },
    });
    await loadCatalog();
    res.status(201).json({ ok: true, partKey: b.partKey });
  }),
);

// ---- Colours / finishes ---------------------------------------------
const newColourSchema = z.object({
  key: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  costUpliftPct: z.number().min(0).optional(),
  priceUpliftPct: z.number().min(0).optional(),
  isBase: z.boolean().optional(),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "hex must be like #353b3f").optional(),
});

catalogRouter.post(
  "/:systemId/colours",
  requirePermission("catalog", "create"),
  asyncHandler(async (req, res) => {
    await assertSystem(req.params.systemId);
    const b = validate(newColourSchema, req.body);
    const exists = await prisma.colourOption.findUnique({
      where: { systemId_key: { systemId: req.params.systemId, key: b.key } },
    });
    if (exists) throw new HttpError(409, `Colour "${b.key}" already exists (use PUT to edit)`);
    await prisma.colourOption.create({
      data: {
        systemId: req.params.systemId,
        key: b.key,
        code: b.code,
        name: b.name,
        costUpliftPct: b.costUpliftPct ?? 0,
        priceUpliftPct: b.priceUpliftPct ?? 0,
        isBase: b.isBase ?? false,
        hex: b.hex ?? null,
      },
    });
    await loadCatalog();
    res.status(201).json({ ok: true, key: b.key });
  }),
);

const editColourSchema = z
  .object({
    code: z.string().min(1),
    name: z.string().min(1),
    costUpliftPct: z.number().min(0),
    priceUpliftPct: z.number().min(0),
    isBase: z.boolean(),
    hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "hex must be like #353b3f"),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, "Provide at least one field to update");

catalogRouter.put(
  "/:systemId/colours/:key",
  requirePermission("catalog", "update"),
  asyncHandler(async (req, res) => {
    await assertSystem(req.params.systemId);
    const data = validate(editColourSchema, req.body);
    const result = await prisma.colourOption.updateMany({
      where: { systemId: req.params.systemId, key: req.params.key },
      data,
    });
    if (result.count === 0) throw new HttpError(404, `No colour "${req.params.key}"`);
    await loadCatalog();
    res.json({ ok: true, updated: result.count });
  }),
);

// ---- CSV bulk price import ------------------------------------------
// Body is raw CSV (Content-Type: text/csv) with a header `code,cost,price`.
// Each row is matched by part CODE across profile_part/glass/gasket/hardware
// and its cost/price upserted. Idempotent. Returns { updated, unmatched }.
catalogRouter.post(
  "/:systemId/import",
  requirePermission("catalog", "update"),
  express.text({ type: ["text/csv", "text/plain"], limit: "1mb" }),
  asyncHandler(async (req, res) => {
    await assertSystem(req.params.systemId);
    const csv = typeof req.body === "string" ? req.body : "";
    const rows = parseCsv(csv);
    if (rows.length === 0) throw new HttpError(400, "No CSV rows (expected header `code,cost,price`)");

    // Build code → {table, partKey} index for this system.
    const systemId = req.params.systemId;
    const [parts, glass, gaskets, hardware, cills] = await Promise.all([
      prisma.profilePart.findMany({ where: { systemId }, select: { code: true, kind: true, partKey: true } }),
      prisma.glass.findMany({ where: { systemId }, select: { code: true, partKey: true } }),
      prisma.gasket.findMany({ where: { systemId }, select: { code: true, partKey: true } }),
      prisma.hardware.findMany({ where: { systemId }, select: { code: true, partKey: true } }),
      prisma.cill.findMany({ where: { systemId }, select: { code: true, partKey: true } }),
    ]);
    type Target = { table: "profilePart" | "glass" | "gasket" | "hardware" | "cill"; kind?: PartKind; partKey: string };
    // One code can map to MULTIPLE catalog rows (e.g. frame-6ch and frame-french
    // share SPQ-6-11252; transom-z-67 and midrail-67 share SPQ-005-30252). Index
    // as code → Target[] and update ALL of them, so no row is silently skipped.
    const byCode = new Map<string, Target[]>();
    const push = (code: string, t: Target) => {
      const list = byCode.get(code);
      if (list) list.push(t);
      else byCode.set(code, [t]);
    };
    for (const p of parts) push(p.code, { table: "profilePart", kind: p.kind, partKey: p.partKey });
    for (const g of glass) push(g.code, { table: "glass", partKey: g.partKey });
    for (const g of gaskets) push(g.code, { table: "gasket", partKey: g.partKey });
    for (const h of hardware) push(h.code, { table: "hardware", partKey: h.partKey });
    for (const c of cills) push(c.code, { table: "cill", partKey: c.partKey });

    const updates: Promise<unknown>[] = [];
    const unmatched: string[] = [];
    let matchedRows = 0;
    for (const r of rows) {
      const targets = byCode.get(r.code);
      if (!targets || targets.length === 0) { unmatched.push(r.code); continue; }
      matchedRows++;
      const data = { cost: r.cost, price: r.price };
      for (const target of targets) {
        if (target.table === "profilePart") {
          updates.push(prisma.profilePart.updateMany({
            where: { systemId, kind: target.kind, partKey: target.partKey }, data,
          }));
        } else {
          // @ts-expect-error — delegate chosen dynamically; where/data shapes match.
          updates.push(prisma[target.table].updateMany({
            where: { systemId, partKey: target.partKey }, data,
          }));
        }
      }
    }
    await prisma.$transaction(updates as any);
    await loadCatalog();
    res.json({ ok: true, updated: matchedRows, unmatched });
  }),
);

/**
 * Minimal CSV parser for `code,cost,price`. Tolerant of an optional header,
 * blank lines and surrounding whitespace. Non-numeric cost/price → row skipped
 * into the error list via NaN guard at call sites is overkill, so we throw.
 */
function parseCsv(csv: string): { code: string; cost: number; price: number }[] {
  const out: { code: string; cost: number; price: number }[] = [];
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  for (const line of lines) {
    const cells = line.split(",").map((c) => c.trim());
    if (cells[0].toLowerCase() === "code") continue; // header
    if (cells.length < 3) throw new HttpError(400, `Bad CSV row (need code,cost,price): "${line}"`);
    const [code, costRaw, priceRaw] = cells;
    const cost = Number(costRaw), price = Number(priceRaw);
    if (!code || Number.isNaN(cost) || Number.isNaN(price)) {
      throw new HttpError(400, `Bad CSV row (cost/price must be numbers): "${line}"`);
    }
    out.push({ code, cost, price });
  }
  return out;
}
