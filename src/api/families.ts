// =====================================================================
// api/families.ts — product families + the JSON option system (Designer
// platform, Task 1 phase 1).
//
//   GET   /api/families                       public: active families
//   GET   /api/families/:key                  public: descriptor + option system
//   PATCH /api/families/option-groups/:key    admin: presentation + order
//   PATCH /api/families/options/:key          admin: presentation + order
//   PATCH /api/families/choices/:key          admin: label / order / default
//
// The two GETs are PUBLIC for the same reason /api/systems/:id/options is:
// the designer needs them to render before anything is priced, and they carry
// NO supplier cost data — a choice references a catalog part by `partKey` and
// the price is resolved separately (golden rule: prices live on catalog parts,
// never on a choice). Compare the admin-only /api/catalog/:id dump, which does
// carry cost/price.
//
// Creating and deleting options is deliberately NOT exposed: the seed sources
// (src/catalog/families/*, src/catalog/options/*) are the source of truth, and
// deleting a choice that persisted line items reference would corrupt history
// (data-model.md §5). Admins edit presentation and ordering; the seed owns
// structure. Every write refreshes the in-memory snapshot, exactly like the
// catalog admin routes.
// =====================================================================

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/client.ts";
import { asyncHandler, HttpError, validate } from "./http.ts";
import { requireAuth } from "./middleware/auth.ts";
import { requirePermission } from "./middleware/authorize.ts";
import { getFamily, getOptionSystem, listFamilies, loadDesignerSnapshot } from "../catalog/index.ts";

export const familiesRouter = Router();

// ---- Admin: presentation + ordering ---------------------------------
// Mounted BEFORE the public "/:key" route so the literal prefixes win.

const groupPatchSchema = z
  .object({
    name: z.string().min(1),
    order: z.number().int(),
    icon: z.string().nullable(),
    defaultCollapsed: z.boolean(),
    scope: z.enum(["item", "component", "mixed"]),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, "Provide at least one field");

familiesRouter.patch(
  "/option-groups/:key",
  requireAuth,
  requirePermission("catalog", "update"),
  asyncHandler(async (req, res) => {
    const data = validate(groupPatchSchema, req.body);
    const existing = await prisma.optionGroup.findUnique({ where: { key: req.params.key } });
    if (!existing) throw new HttpError(404, `Unknown option group: ${req.params.key}`);
    await prisma.optionGroup.update({ where: { key: req.params.key }, data });
    await loadDesignerSnapshot();
    res.json({ ok: true });
  }),
);

const presentationSchema = z.object({
  omitFromSummary: z.boolean().optional(),
  omitFromDocuments: z.boolean().optional(),
  helpText: z.string().optional(),
  suggestions: z.array(z.string()).optional(),
});

const optionPatchSchema = z
  .object({
    name: z.string().min(1),
    order: z.number().int(),
    required: z.boolean(),
    presentation: presentationSchema,
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, "Provide at least one field");

familiesRouter.patch(
  "/options/:key",
  requireAuth,
  requirePermission("catalog", "update"),
  asyncHandler(async (req, res) => {
    const data = validate(optionPatchSchema, req.body);
    const existing = await prisma.optionDef.findUnique({ where: { key: req.params.key } });
    if (!existing) throw new HttpError(404, `Unknown option: ${req.params.key}`);
    await prisma.optionDef.update({ where: { key: req.params.key }, data });
    await loadDesignerSnapshot();
    res.json({ ok: true });
  }),
);

// `isDefault` is deliberately NOT patchable. A default choice decides what
// every new line item gets — and some defaults exist to keep quotes
// byte-identical (bead-28 is the engine's default bead). It is also a
// SEED-owned field, so an admin flip would silently revert on the next deploy;
// offering a control that quietly undoes itself is worse than not offering it.
// Changing a default is a one-line edit to src/catalog/options/windows.ts.
const choicePatchSchema = z
  .object({
    label: z.string().min(1),
    order: z.number().int(),
    swatchHex: z.string().nullable(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, "Provide at least one field");

familiesRouter.patch(
  "/choices/:key",
  requireAuth,
  requirePermission("catalog", "update"),
  asyncHandler(async (req, res) => {
    const data = validate(choicePatchSchema, req.body);
    const existing = await prisma.optionChoice.findUnique({ where: { key: req.params.key } });
    if (!existing) throw new HttpError(404, `Unknown option choice: ${req.params.key}`);
    await prisma.optionChoice.update({ where: { key: existing.key }, data });
    await loadDesignerSnapshot();
    res.json({ ok: true });
  }),
);

// ---- Public: read the family catalogue -------------------------------

familiesRouter.get("/", (_req, res) => {
  res.json(
    listFamilies()
      .filter((f) => f.status === "active")
      .map((f) => ({
        familyKey: f.familyKey,
        name: f.name,
        status: f.status,
        systemIds: f.systemIds,
      })),
  );
});

familiesRouter.get("/:key", (req, res) => {
  const family = getFamily(req.params.key);
  if (!family) throw new HttpError(404, `Unknown family: ${req.params.key}`);
  // getOptionSystem is defined whenever the family is (same cache).
  res.json({ family, optionSystem: getOptionSystem(req.params.key) ?? { groups: [] } });
});
