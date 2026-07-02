// =====================================================================
// catalog/loader.ts — load the catalog from PostgreSQL into memory.
//
// THE ONLY behavioural change of the "engine on DB" milestone lives here.
//
// The engine functions are pure: they take a `ProfileSystem` / `Design`
// object and never know where it came from. So we read the catalog from
// the DB once at startup, rebuild the EXACT same in-memory shapes the
// engine has always consumed, and serve them through SYNCHRONOUS
// accessors. `solve()`, the validation harness and every engine module
// stay completely unchanged.
//
// Call `await loadCatalog()` once during bootstrap (server start /
// validation run) before any `solve()`.
// =====================================================================

import type { Prisma } from "@prisma/client";
import type {
  ProfileSystem,
  Design,
  Settings,
  FrameSection,
  SashSection,
  TransomSection,
  BeadSection,
  Reinforcement,
  GlassSection,
  Gasket,
  HardwareItem,
  ColourOption,
  CillOption,
  CellNode,
  DocBranding,
} from "../types.ts";
import { prisma } from "../db/client.ts";
import { getObject } from "../services/storage.ts";

// Prisma returns Decimal objects; the engine wants plain numbers.
type Decimalish = { toNumber(): number } | number | null | undefined;
const num = (d: Decimalish): number =>
  d == null ? 0 : typeof d === "number" ? d : d.toNumber();
const optNum = (d: Decimalish): number | undefined =>
  d == null ? undefined : typeof d === "number" ? d : d.toNumber();

const systemCatalogInclude = {
  // Deterministic part order: cells without an explicit beadKey default to the
  // FIRST bead in the Record (topology.ts), which must stay "bead-28" now that
  // "bead-32" (French) exists — partKey order guarantees it.
  parts: { orderBy: { partKey: "asc" as const } },
  glass: true,
  gaskets: true,
  hardware: true,
  colours: true,
  cills: true,
  reinforcementMap: true,
} satisfies Prisma.ProfileSystemInclude;

type DbSystemWithCatalog = Prisma.ProfileSystemGetPayload<{
  include: typeof systemCatalogInclude;
}>;

// ---- In-memory caches (populated by loadCatalog) --------------------
let systemsCache: Record<string, ProfileSystem> = {};
let designsCache: Design[] = [];

// Live binding: re-exported by index.ts and read by solve() at call time.
// Reassigned inside loadCatalog(); ESM live bindings propagate the update.
export let DEFAULT_SETTINGS: Settings = {
  currency: "GBP",
  taxApply: true,
  taxPct: 20,
  markupPct: 75,
  wastagePct: 10,
  labour: { perSash: 25, perDoor: 60, base: 30 },
  weldAllowanceMm: 2.5,
};

let loaded = false;

/** Load the entire catalog from Postgres into memory. Idempotent. */
export async function loadCatalog(): Promise<void> {
  const dbSystems = await prisma.profileSystem.findMany({
    include: systemCatalogInclude,
  });

  const nextSystems: Record<string, ProfileSystem> = {};

  for (const s of dbSystems) {
    nextSystems[s.id] = buildProfileSystem(s);
  }

  const dbDesigns = await prisma.design.findMany({ orderBy: { designId: "asc" } });
  const nextDesigns: Design[] = dbDesigns.map((d) => ({
    designId: d.designId,
    name: d.name,
    productType: d.productType as "window" | "door",
    frameKey: d.frameKey,
    topology: d.topology as unknown as CellNode,
    ...(d.svgPreview ? { svgPreview: d.svgPreview } : {}),
    ...(d.defaultWidthMm != null ? { defaultWidthMm: d.defaultWidthMm } : {}),
    ...(d.defaultHeightMm != null ? { defaultHeightMm: d.defaultHeightMm } : {}),
  }));

  const dbSettings = await prisma.setting.findUnique({ where: { id: 1 } });
  if (dbSettings) {
    DEFAULT_SETTINGS = {
      currency: dbSettings.currency,
      taxApply: dbSettings.taxApply,
      taxPct: num(dbSettings.taxPct),
      markupPct: num(dbSettings.markupPct),
      wastagePct: num(dbSettings.wastagePct),
      labour: {
        perSash: num(dbSettings.labourPerSash),
        perDoor: num(dbSettings.labourPerDoor),
        base: num(dbSettings.labourBase),
      },
      weldAllowanceMm: num(dbSettings.weldAllowanceMm),
      branding: await loadBranding(dbSettings),
    };
  }

  systemsCache = nextSystems;
  designsCache = nextDesigns;
  loaded = true;
}

/** Refresh one profile system from Postgres without reloading every design/SVG. */
export async function refreshSystemCatalog(systemId: string): Promise<ProfileSystem | undefined> {
  const dbSystem = await prisma.profileSystem.findUnique({
    where: { id: systemId },
    include: systemCatalogInclude,
  });
  if (!dbSystem) {
    if (loaded) {
      const { [systemId]: _removed, ...rest } = systemsCache;
      systemsCache = rest;
    }
    return undefined;
  }
  const system = buildProfileSystem(dbSystem);
  systemsCache = { ...systemsCache, [systemId]: system };
  return system;
}

function buildProfileSystem(s: DbSystemWithCatalog): ProfileSystem {
  const frames: Record<string, FrameSection> = {};
  const sashes: Record<string, SashSection> = {};
  const transoms: Record<string, TransomSection> = {};
  const beads: Record<string, BeadSection> = {};
  const reinforcement: Record<string, Reinforcement> = {};

  for (const p of s.parts) {
    const base = {
      code: p.code,
      name: p.name,
      faceWidth: num(p.faceWidth),
      weldAllowanceMm: num(p.weldAllowanceMm),
      cost: num(p.cost),
      price: num(p.price),
      per: p.per as "m" | "pc" | "m2" | "set",
      weight: num(p.weight),
      financialCategory: p.financialCategory,
    };
    switch (p.kind) {
      case "FRAME":
        frames[p.partKey] = { ...base, glassRebate: num(p.glassRebate) };
        break;
      case "SASH":
        sashes[p.partKey] = {
          ...base,
          overlap: num(p.overlap),
          glassRebate: num(p.glassRebate),
        };
        break;
      case "TRANSOM":
        transoms[p.partKey] = {
          ...base,
          jointType: (p.jointType as "T" | "Z" | "S") ?? "T",
        };
        break;
      case "BEAD":
        beads[p.partKey] = { ...base, stickOut: num(p.stickOut) };
        break;
      case "REINFORCEMENT":
        reinforcement[p.partKey] = {
          ...base,
          endClearance: num(p.endClearance),
        };
        break;
    }
  }

  const glass: Record<string, GlassSection> = {};
  for (const g of s.glass) {
    glass[g.partKey] = {
      code: g.code,
      name: g.name,
      rebatePerSide: num(g.rebatePerSide),
      cost: num(g.cost),
      price: num(g.price),
      per: "m2",
      weight: num(g.weight),
      financialCategory: g.financialCategory,
    };
  }

  const gaskets: Record<string, Gasket> = {};
  for (const g of s.gaskets) {
    gaskets[g.partKey] = {
      code: g.code,
      name: g.name,
      cost: num(g.cost),
      price: num(g.price),
      per: "m",
      weight: num(g.weight),
      financialCategory: g.financialCategory,
    };
  }

  const hardware: Record<string, HardwareItem> = {};
  for (const h of s.hardware) {
    hardware[h.partKey] = {
      code: h.code,
      name: h.name,
      cost: num(h.cost),
      price: num(h.price),
      per: "pc",
      weight: num(h.weight),
      financialCategory: h.financialCategory,
      ...(optNum(h.lengthMm) !== undefined
        ? { lengthMm: optNum(h.lengthMm) }
        : {}),
    };
  }

  const colours: Record<string, ColourOption> = {};
  for (const c of s.colours) {
    colours[c.key] = {
      key: c.key,
      code: c.code,
      name: c.name,
      costUpliftPct: num(c.costUpliftPct),
      priceUpliftPct: num(c.priceUpliftPct),
      isBase: c.isBase,
      ...(c.hex ? { hex: c.hex } : {}),
    };
  }

  const cills: Record<string, CillOption> = {};
  for (const c of s.cills) {
    cills[c.partKey] = {
      key: c.partKey,
      code: c.code,
      name: c.name,
      projectionMm: c.projectionMm,
      cost: num(c.cost),
      price: num(c.price),
      per: "m",
      weight: num(c.weight),
      financialCategory: c.financialCategory,
    };
  }

  const reinforcementMap: Record<string, string> = {};
  for (const r of s.reinforcementMap) {
    reinforcementMap[r.profileCode] = r.reinforcementKey;
  }

  return {
    systemId: s.id,
    name: s.name,
    currency: s.currency,
    stockBarLengthMm: s.stockBarLengthMm,
    sawKerfMm: s.sawKerfMm,
    frames,
    sashes,
    transoms,
    beads,
    reinforcement,
    gaskets,
    glass,
    hardware,
    colours,
    ...(s.defaultColourKey ? { defaultColourKey: s.defaultColourKey } : {}),
    cills,
    reinforcementMap,
  };
}

/**
 * Build render-ready branding from the Setting row. The stored `logoKey` is
 * resolved to an embedded data-URI by fetching the object once at load time, so
 * documents/PDFs are self-contained. Storage being unreachable is non-fatal:
 * the catalog still loads (just without the logo). Returns undefined when no
 * branding is configured ⇒ documents fall back to the plain header.
 */
async function loadBranding(s: {
  companyName: string | null;
  companyAddress: string | null;
  accentColor: string | null;
  logoKey: string | null;
}): Promise<DocBranding | undefined> {
  let logoDataUri: string | undefined;
  if (s.logoKey) {
    try {
      const { body, contentType } = await getObject(s.logoKey);
      logoDataUri = `data:${contentType};base64,${body.toString("base64")}`;
    } catch (err) {
      console.warn(
        `[catalog] logo "${s.logoKey}" could not be loaded from storage:`,
        (err as Error).message,
      );
    }
  }
  if (!s.companyName && !s.companyAddress && !s.accentColor && !logoDataUri) {
    return undefined;
  }
  return {
    companyName: s.companyName ?? undefined,
    address: s.companyAddress ?? undefined,
    accentColor: s.accentColor ?? undefined,
    logoDataUri,
  };
}

function assertLoaded() {
  if (!loaded) {
    throw new Error(
      "Catalog not loaded. Call `await loadCatalog()` during bootstrap before solving.",
    );
  }
}

// ---- Synchronous accessors (served from cache) ----------------------

export function getSystem(systemId: string): ProfileSystem | undefined {
  assertLoaded();
  return systemsCache[systemId];
}

export function getDesign(designId: string): Design | undefined {
  assertLoaded();
  return designsCache.find((d) => d.designId === designId);
}

export function listSystems(): ProfileSystem[] {
  assertLoaded();
  return Object.values(systemsCache);
}

export function listDesigns(): Design[] {
  assertLoaded();
  return designsCache;
}
