// =====================================================================
// prisma/seed.ts — load the calibrated catalog into PostgreSQL.
//
// The hardcoded TypeScript catalog (system-sunnyplast.ts, designs.ts,
// settings.ts) is the SOURCE OF TRUTH for structural catalog data: every
// deduction in it is calibrated against real Quotila jobs 85/88/90. Admin-owned
// commercial/runtime fields are created from these defaults once, then preserved
// on later deploy reseeds.
//
// Idempotent: re-running upserts on the unique keys is safe, and admin-owned
// fields are not rewritten.
//
//   npm run db:seed
// =====================================================================

import { PrismaClient, PartKind, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SUNNYPLAST_70 } from "../src/catalog/system-sunnyplast.ts";
import { DESIGNS } from "../src/catalog/designs.ts";
import { solveTopology } from "../src/engine/topology.ts";
import { renderSvg } from "../src/engine/svg.ts";
import { DERIVED } from "../src/catalog/derived-topologies.generated.ts";
import { SLIDING_DESIGNS } from "../src/catalog/sliding-designs.ts";
import { DEFAULT_SETTINGS } from "../src/catalog/settings.ts";
import type { Design, ProfileSystem } from "../src/types.ts";

const prisma = new PrismaClient();

const SYSTEMS: ProfileSystem[] = [SUNNYPLAST_70];
const SYSTEM_ID = SUNNYPLAST_70.systemId;

const __dirname = dirname(fileURLToPath(import.meta.url));
const COLLECTIONS = join(__dirname, "..", "collections");

/**
 * Preview-only dimensions (mm) for rendering an engine design's gallery image.
 * Picked purely so the topology lays out legibly — they never touch a real
 * quote. The multi-panel sidelight door needs extra width for sidelight + door
 * + toplights to render without crowding.
 */
function previewDimsFor(d: Design): [number, number] {
  // A design's own default dimensions win when present (no more 1200×1200 guess).
  if (d.defaultWidthMm != null && d.defaultHeightMm != null) {
    return [d.defaultWidthMm, d.defaultHeightMm];
  }
  if (d.designId === "door-sidelight-toplights") return [1800, 2100];
  if (d.productType === "door") return [1000, 2100];
  return [1200, 1200];
}

// NB: typed as the full PrismaClient (not a TransactionClient). The catalog
// seed deliberately runs WITHOUT a wrapping interactive transaction — see main().
async function seedSystem(
  tx: PrismaClient,
  sys: ProfileSystem,
) {
  // 1. The system row
  await tx.profileSystem.upsert({
    where: { id: sys.systemId },
    update: {
      name: sys.name,
      currency: sys.currency,
      stockBarLengthMm: sys.stockBarLengthMm,
      sawKerfMm: sys.sawKerfMm,
      defaultColourKey: sys.defaultColourKey ?? null,
    },
    create: {
      id: sys.systemId,
      name: sys.name,
      currency: sys.currency,
      stockBarLengthMm: sys.stockBarLengthMm,
      sawKerfMm: sys.sawKerfMm,
      defaultColourKey: sys.defaultColourKey ?? null,
    },
  });

  // 2. Profile parts (frames, sashes, transoms, beads, reinforcement)
  const upsertPart = (
    partKey: string,
    kind: PartKind,
    base: {
      code: string;
      name: string;
      faceWidth: number;
      weldAllowanceMm: number;
      cost: number;
      price: number;
      per: string;
      weight: number;
      financialCategory: string;
    },
    extra: {
      glassRebate?: number;
      overlap?: number;
      stickOut?: number;
      jointType?: string;
      endClearance?: number;
    } = {},
  ) => {
    // These values are edited in Admin > Catalog / filled by the price-list
    // import. Do not reset them on every deploy, because docker-compose runs
    // this seed during backend startup. tierPrices is stripped too — it is never
    // set in the catalog source (imported into cost1p/… by import-prices), so it
    // must never reach a Prisma payload (it is not a column) nor clobber imports.
    const {
      cost: _cost,
      price: _price,
      weight: _weight,
      weldAllowanceMm: _weldAllowanceMm,
      tierPrices: _tierPrices,
      ...catalogFields
    } = base as typeof base & { tierPrices?: unknown };

    return tx.profilePart.upsert({
      where: {
        systemId_kind_partKey: { systemId: sys.systemId, kind, partKey },
      },
      update: { ...catalogFields, ...extra },
      create: { systemId: sys.systemId, partKey, kind, ...base, ...extra },
    });
  };

  for (const [key, f] of Object.entries(sys.frames)) {
    await upsertPart(key, PartKind.FRAME, f, { glassRebate: f.glassRebate });
  }
  for (const [key, s] of Object.entries(sys.sashes)) {
    await upsertPart(key, PartKind.SASH, s, {
      glassRebate: s.glassRebate,
      overlap: s.overlap,
    });
  }
  for (const [key, t] of Object.entries(sys.transoms)) {
    await upsertPart(key, PartKind.TRANSOM, t, { jointType: t.jointType });
  }
  for (const [key, b] of Object.entries(sys.beads)) {
    await upsertPart(key, PartKind.BEAD, b, { stickOut: b.stickOut });
  }
  for (const [key, r] of Object.entries(sys.reinforcement)) {
    await upsertPart(key, PartKind.REINFORCEMENT, r, {
      endClearance: r.endClearance,
    });
  }
  // Auxiliary profiles (sliding tracks/caps, Jobs 44/48). No face/weld concept —
  // stored with the base columns only (faceWidth/weld 0, specialised cols NULL).
  for (const [key, a] of Object.entries(sys.auxiliaries ?? {})) {
    await upsertPart(key, PartKind.AUXILIARY, {
      ...a,
      faceWidth: 0,
      weldAllowanceMm: 0,
    });
  }

  // 3. Glass
  for (const [partKey, g] of Object.entries(sys.glass)) {
    const {
      cost: _cost,
      price: _price,
      weight: _weight,
      ...catalogFields
    } = g;
    await tx.glass.upsert({
      where: { systemId_partKey: { systemId: sys.systemId, partKey } },
      update: { ...catalogFields },
      create: { systemId: sys.systemId, partKey, ...g },
    });
  }

  // 4. Gaskets
  for (const [partKey, g] of Object.entries(sys.gaskets)) {
    const {
      cost: _cost,
      price: _price,
      weight: _weight,
      ...catalogFields
    } = g;
    await tx.gasket.upsert({
      where: { systemId_partKey: { systemId: sys.systemId, partKey } },
      update: { ...catalogFields },
      create: { systemId: sys.systemId, partKey, ...g },
    });
  }

  // 5. Hardware
  for (const [partKey, h] of Object.entries(sys.hardware)) {
    const {
      cost: _cost,
      price: _price,
      weight: _weight,
      ...catalogFields
    } = h;
    await tx.hardware.upsert({
      where: { systemId_partKey: { systemId: sys.systemId, partKey } },
      update: { ...catalogFields, lengthMm: h.lengthMm ?? null },
      create: { systemId: sys.systemId, partKey, ...h, lengthMm: h.lengthMm ?? null },
    });
  }

  // 6. Colours / finishes (M5 + U7) — base white at 0% uplift; the rest ship a
  // display hex but 0% uplift (owner sets real upcharges via the admin editor).
  // update = structural fields only (uplift %s preserved across re-seed); create
  // seeds the full row incl. hex.
  for (const [key, c] of Object.entries(sys.colours)) {
    const {
      costUpliftPct: _costUpliftPct,
      priceUpliftPct: _priceUpliftPct,
      ...catalogFields
    } = c;
    await tx.colourOption.upsert({
      where: { systemId_key: { systemId: sys.systemId, key } },
      update: catalogFields,
      create: {
        systemId: sys.systemId,
        key,
        code: c.code,
        name: c.name,
        costUpliftPct: c.costUpliftPct,
        priceUpliftPct: c.priceUpliftPct,
        isBase: c.isBase,
        hex: c.hex ?? null,
      },
    });
  }

  // 6b. Cills (window sills) — 3 sizes × 3 finishes. cost/price/weight are
  // owner-editable / price-list-imported, so (like glass/gasket/hardware) they
  // are STRIPPED from the update branch — a reseed must not reset imported cill
  // prices back to 0. Only structural fields are re-applied on update.
  for (const [partKey, c] of Object.entries(sys.cills)) {
    const {
      cost: _cost,
      price: _price,
      weight: _weight,
      ...cillFields
    } = c;
    await tx.cill.upsert({
      where: { systemId_partKey: { systemId: sys.systemId, partKey } },
      update: {
        code: cillFields.code,
        name: cillFields.name,
        projectionMm: cillFields.projectionMm,
        per: cillFields.per,
        financialCategory: cillFields.financialCategory,
      },
      create: {
        systemId: sys.systemId,
        partKey,
        code: c.code,
        name: c.name,
        projectionMm: c.projectionMm,
        cost: c.cost,
        price: c.price,
        per: c.per,
        weight: c.weight,
        financialCategory: c.financialCategory,
      },
    });
  }

  // 7. reinforcementMap (profile code -> reinforcement record key)
  for (const [profileCode, reinforcementKey] of Object.entries(
    sys.reinforcementMap,
  )) {
    await tx.reinforcementMapEntry.upsert({
      where: {
        systemId_profileCode: { systemId: sys.systemId, profileCode },
      },
      update: { reinforcementKey },
      create: { systemId: sys.systemId, profileCode, reinforcementKey },
    });
  }
  // Drop stale map entries whose profile code is no longer in the catalog map.
  // The map is NOT owner-edited, so deleting rows the source removed is safe —
  // this clears the old placeholder keys (SPQ-T-SASH, SPQ-DOOR-Z) after the
  // code reconciliation so they can't linger and mis-reinforce.
  await tx.reinforcementMapEntry.deleteMany({
    where: {
      systemId: sys.systemId,
      profileCode: { notIn: Object.keys(sys.reinforcementMap) },
    },
  });
}

async function main() {
  // The catalog seed runs as plain, idempotent, order-independent upserts on the
  // PrismaClient directly — NOT inside an interactive $transaction. Interactive
  // transactions are incompatible with transaction-mode connection poolers
  // (e.g. PgBouncer on :5433): each query can land on a different backend, so the
  // tx handle is "not found" mid-seed (Prisma P2028). Auto-committing each upsert
  // is pooler-agnostic; re-running re-applies identical rows, so it's still safe.

  // Systems and their parts
  for (const sys of SYSTEMS) {
    await seedSystem(prisma, sys);
  }

  // Designs (topology stored as JSON). The hand-authored engine designs ship
  // with a CellNode topology but no image; render a deterministic gallery
  // preview from that topology via the SAME pure engine path a quote uses
  // (solveTopology → renderSvg), so they don't show imageless in the UI.
  // Preview-only dimensions — they never affect a real quote.
  for (const d of DESIGNS) {
    const [w, h] = previewDimsFor(d);
    const imageSvg = renderSvg(solveTopology(d, w, h, SUNNYPLAST_70));
    await prisma.design.upsert({
      where: { designId: d.designId },
      update: {
        name: d.name,
        productType: d.productType,
        frameKey: d.frameKey,
        topology: d.topology as any,
        svgPreview: d.svgPreview ?? null,
        imageSvg,
      },
      create: {
        designId: d.designId,
        name: d.name,
        productType: d.productType,
        frameKey: d.frameKey,
        topology: d.topology as any,
        svgPreview: d.svgPreview ?? null,
        imageSvg,
      },
    });
  }

  // Default settings (single row, id = 1). Admin can edit every setting field,
  // so seed only creates the row when it is missing.
  const s = DEFAULT_SETTINGS;
  const settingsExist = await prisma.setting.findUnique({
    where: { id: 1 },
    select: { id: true },
  });
  if (!settingsExist) {
    await prisma.setting.create({
      data: {
        id: 1,
        currency: s.currency,
        taxApply: s.taxApply,
        taxPct: s.taxPct,
        markupPct: s.markupPct,
        wastagePct: s.wastagePct,
        labourPerSash: s.labour.perSash,
        labourPerDoor: s.labour.perDoor,
        labourBase: s.labour.base,
        weldAllowanceMm: s.weldAllowanceMm ?? 2.5,
      },
    });
  }

  // Flow data (products, imported designs, admin) — also auto-committing upserts.
  await seedProducts();
  await importCollectionsDesigns();
  await linkEngineDesigns();
  await applyDerivedTopologies();
  await applySlidingTopologies();
  await seedAdminUser();

  // Quick summary so the operator can eyeball the counts.
  const [
    systems, parts, glass, gaskets, hardware, colours, rmap, settings,
    products, designs, quotable, users,
  ] = await Promise.all([
    prisma.profileSystem.count(),
    prisma.profilePart.count(),
    prisma.glass.count(),
    prisma.gasket.count(),
    prisma.hardware.count(),
    prisma.colourOption.count(),
    prisma.reinforcementMapEntry.count(),
    prisma.setting.count(),
    prisma.product.count(),
    prisma.design.count(),
    prisma.design.count({ where: { quotable: true } }),
    prisma.user.count(),
  ]);
  console.log("Seed complete:");
  console.table({ systems, parts, glass, gaskets, hardware, colours, rmap, settings, products, designs, quotable, users });
}

// ---------------------------------------------------------------------
// FLOW DATA SEEDING
// ---------------------------------------------------------------------

/** 9 product lines from collections/products/product.json. */
async function seedProducts() {
  const file = join(COLLECTIONS, "products", "product.json");
  const rows: { name: string; id: string; typeId: number }[] = JSON.parse(
    readFileSync(file, "utf8"),
  );
  let i = 0;
  for (const p of rows) {
    const name = p.name.trim();
    await prisma.product.upsert({
      where: { id: p.id },
      update: { name, typeId: p.typeId, systemId: SYSTEM_ID, listIndex: i },
      create: { id: p.id, name, typeId: p.typeId, systemId: SYSTEM_ID, listIndex: i },
    });
    i++;
  }
}

/**
 * Import every SVG-only design from collections/product-degins/*.json.
 * These have NO topology, so quotable=false. designId = the collections UUID.
 * Mapped to the first product sharing the file's productTypeId.
 */
async function importCollectionsDesigns() {
  // Build productTypeId -> productId (first product wins for shared typeIds).
  const products = await prisma.product.findMany({ orderBy: { listIndex: "asc" } });
  const typeToProduct = new Map<number, { id: string; name: string }>();
  for (const p of products) {
    if (!typeToProduct.has(p.typeId)) typeToProduct.set(p.typeId, { id: p.id, name: p.name });
  }

  const dir = join(COLLECTIONS, "product-degins");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  for (const f of files) {
    const parsed = JSON.parse(readFileSync(join(dir, f), "utf8")) as {
      productTypeId: number;
      filteredList: {
        designId: string;
        name: string;
        quantityOfSquares?: number;
        imageSvg?: string;
        listIndex?: number;
      }[];
    };
    const prod = typeToProduct.get(parsed.productTypeId);
    const productType = prod && /door/i.test(prod.name) ? "door" : "window";

    // Batch the upserts so one big file doesn't open 345 awaits serially-slow.
    const list = parsed.filteredList ?? [];
    for (let i = 0; i < list.length; i += 50) {
      const chunk = list.slice(i, i + 50);
      await prisma.$transaction(
        chunk.map((d) =>
          prisma.design.upsert({
            where: { externalId: d.designId },
            update: {
              name: d.name,
              imageSvg: d.imageSvg ?? null,
              quantityOfSquares: d.quantityOfSquares ?? null,
              listIndex: d.listIndex ?? null,
              productId: prod?.id ?? null,
              productType,
            },
            create: {
              designId: d.designId, // collections UUID as PK
              externalId: d.designId,
              name: d.name,
              productType,
              frameKey: "frame-5ch", // sensible default; unused until a topology is attached
              topology: undefined, // SVG-only → not quotable
              imageSvg: d.imageSvg ?? null,
              quantityOfSquares: d.quantityOfSquares ?? null,
              listIndex: d.listIndex ?? null,
              productId: prod?.id ?? null,
              quotable: false,
            },
          }),
        ),
      );
    }
  }
}

/**
 * Attach the engine-solvable designs (seeded with topology in the catalog tx)
 * to a product and mark them quotable. win-* → Casement, door-* → Single Door.
 */
async function linkEngineDesigns() {
  const casement = await prisma.product.findFirst({ where: { typeId: 101 }, orderBy: { listIndex: "asc" } });
  const singleDoor = await prisma.product.findFirst({ where: { typeId: 152 } });
  const frenchDoor = await prisma.product.findFirst({ where: { typeId: 153 } });

  for (const d of DESIGNS) {
    const productId = d.designId.startsWith("door-french")
      ? frenchDoor?.id ?? singleDoor?.id
      : d.productType === "door"
        ? singleDoor?.id
        : casement?.id;
    await prisma.design.update({
      where: { designId: d.designId },
      data: { quotable: true, productId: productId ?? null },
    });
  }
}

/**
 * Apply the SVG-extractor output (src/catalog/derived-topologies.generated.ts)
 * to the imported collection designs — a pure DATA update keyed by externalId:
 *   • topology  = the derived CellNode (with _meta calibration embedded; the
 *                 engine ignores _meta, it only reads .kind/children)
 *   • frameKey  = derived frame profile
 *   • quotable  = tier-gated flag (true only for calibrated families that solved)
 * Idempotent: re-running re-applies identical JSON. Designs absent from DERIVED
 * (e.g. sliding, or any rejected layout) keep topology=null, quotable=false.
 */
async function applyDerivedTopologies() {
  const entries = Object.entries(DERIVED);
  let quotableCount = 0;
  for (let i = 0; i < entries.length; i += 50) {
    const chunk = entries.slice(i, i + 50);
    await prisma.$transaction(
      chunk.map(([externalId, e]) =>
        prisma.design.update({
          where: { externalId },
          data: {
            topology: { ...(e.topology as object), _meta: e.meta } as unknown as Prisma.InputJsonValue,
            frameKey: e.frameKey,
            quotable: e.quotable,
            // French pure pair: default to the Job 00000264 reference size
            // (1700×2100). Wider French combos keep their generic fallback.
            ...(e.meta.family === "french" && e.meta.leaves === 2
              ? { defaultWidthMm: 1700, defaultHeightMm: 2100 }
              : {}),
          },
        }),
      ),
    );
    quotableCount += chunk.filter(([, e]) => e.quotable).length;
  }
  console.log(`Applied ${entries.length} derived topologies (${quotableCount} quotable).`);
}

/**
 * Sliding Patio (product 73679b0a-…): the 7 collection designs are hand-authored
 * (src/catalog/sliding-designs.ts), matched by externalId. Each gets a sliding
 * topology, frameKey="frame-sliding", quotable=true, and per-config default
 * dimensions from the Job 104 work orders. The engine reproduces those cutting
 * lists to ≤0.6mm (see src/validation/jobs.ts). The collection imageSvg is left
 * untouched (it's the gallery art); the live at-size preview uses renderSvg.
 */
async function applySlidingTopologies() {
  let applied = 0;
  for (const d of SLIDING_DESIGNS) {
    const updated = await prisma.design.updateMany({
      where: { externalId: d.externalId },
      data: {
        topology: d.topology as unknown as Prisma.InputJsonValue,
        frameKey: "frame-sliding",
        quotable: true,
        defaultWidthMm: d.defaultWidthMm,
        defaultHeightMm: d.defaultHeightMm,
      },
    });
    applied += updated.count;
    if (updated.count === 0) {
      console.warn(`  ! sliding design not found by externalId ${d.externalId} (${d.config})`);
    }
  }
  console.log(`Applied ${applied} sliding-patio topologies (quotable).`);
}

/** One admin user (only if no users exist yet). */
async function seedAdminUser() {
  if ((await prisma.user.count()) > 0) return;
  const email = process.env.ADMIN_EMAIL ?? "admin@local";
  const password = process.env.ADMIN_PASSWORD ?? "admin123";
  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      name: "Admin",
      role: "admin",
    },
  });
  console.log(`Seeded admin user: ${email} (password: ${password})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
