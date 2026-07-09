// =====================================================================
// tools/import-prices.ts — apply the transcribed supplier price lists.
//
//   npm run import:prices
//
// Deterministic + idempotent. Three things happen, in one pass:
//   1. PROVENANCE: upsert supplier + each price_document (by docKey), then
//      delete+recreate its price_item rows so the audit tables mirror the
//      reviewed TS transcriptions exactly.
//   2. APPLY: for every PRICE_MAPPINGS entry, resolve its supplier price(s) and
//      write cost/price (+ 1P/2P tier columns for profiles) onto the catalog row,
//      matched by (systemId, kind, partKey) — never by fuzzy code. cost = price =
//      supplier nett (owner decision); cills split cost (Doc A) / price (Doc B).
//   3. REPORT: print the mapping outcome back onto each price_item, then a
//      mismatch report (unmapped price rows, still-unpriced catalog rows, flags).
//
// The engine is never imported here; the next server/validation boot reloads the
// catalog fresh. No guessed numbers — every value traces to a cited PDF line.
// =====================================================================

import { PrismaClient, PartKind, type Prisma } from "@prisma/client";
import {
  ALL_PRICE_DOCS,
  PRICE_MAPPINGS,
  type EntryRef,
  type PriceRef,
  type PriceEntry,
  type PriceMapping,
} from "../catalog/price-lists/index.ts";
import { SUNNYPLAST_70 } from "../catalog/system-sunnyplast.ts";

const prisma = new PrismaClient();
const SYSTEM_ID = SUNNYPLAST_70.systemId;

/** Stable identity for a price entry (code, or description|tier|variant when code-less). */
function identity(e: { supplierCode: string; description: string; colourTier?: string | null; variant?: string | null }): string {
  return e.supplierCode && e.supplierCode.length
    ? `code:${e.supplierCode}`
    : `desc:${e.description}|${e.colourTier ?? ""}|${e.variant ?? ""}`;
}

/** Find the transcribed entry a ref points at (hard error if absent — typo guard). */
function findEntry(ref: EntryRef): PriceEntry {
  const doc = ALL_PRICE_DOCS.find((d) => d.docKey === ref.docKey);
  if (!doc) throw new Error(`Mapping references unknown docKey "${ref.docKey}"`);
  const hits = doc.entries.filter((e) => {
    if (ref.supplierCode != null) return e.supplierCode === ref.supplierCode;
    const m = ref.match ?? {};
    return (
      (m.description == null || e.description === m.description) &&
      (m.colourTier == null || e.colourTier === m.colourTier) &&
      (m.variant == null || e.variant === m.variant)
    );
  });
  if (hits.length === 0) {
    throw new Error(`Mapping ref not found in ${ref.docKey}: ${JSON.stringify(ref.supplierCode ?? ref.match)}`);
  }
  if (hits.length > 1) {
    throw new Error(`Mapping ref is ambiguous in ${ref.docKey} (${hits.length} matches): ${JSON.stringify(ref.supplierCode ?? ref.match)}`);
  }
  return hits[0];
}

/** Convert one entry to a per-target-unit price (Doc B cills: £/6m → £/m). */
function perUnit(e: PriceEntry, targetPer: string): number {
  if (e.unit === "length" && targetPer === "m" && e.stockLengthM) {
    return round4(e.unitPrice / e.stockLengthM);
  }
  return e.unitPrice;
}

/** Resolve a ref (or ref[]) to a single number in the target unit (array ⇒ sum). */
function resolveValue(ref: PriceRef, targetPer: string): { value: number; entries: PriceEntry[] } {
  const refs = Array.isArray(ref) ? ref : [ref];
  const entries = refs.map(findEntry);
  const value = round4(entries.reduce((s, e) => s + perUnit(e, targetPer), 0));
  return { value, entries };
}

function refEntries(ref: PriceRef): PriceEntry[] {
  return (Array.isArray(ref) ? ref : [ref]).map(findEntry);
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

async function main() {
  // ---- 1. Provenance: supplier + documents + items -------------------
  // Index price_item ids per (docKey → identity) so we can write mapping
  // outcomes back after applying.
  const itemIdBy = new Map<string, Map<string, string>>();

  for (const doc of ALL_PRICE_DOCS) {
    const supplier = await prisma.supplier.upsert({
      where: { key: doc.supplierKey },
      update: { name: doc.supplierName },
      create: { key: doc.supplierKey, name: doc.supplierName },
    });
    const document = await prisma.priceDocument.upsert({
      where: { docKey: doc.docKey },
      update: {
        supplierId: supplier.id,
        sourceFile: doc.sourceFile,
        effectiveDate: new Date(doc.effectiveDate),
        currency: doc.currency,
        priceBasis: doc.priceBasis,
        notes: doc.notes ?? null,
        importedAt: new Date(),
      },
      create: {
        docKey: doc.docKey,
        supplierId: supplier.id,
        sourceFile: doc.sourceFile,
        effectiveDate: new Date(doc.effectiveDate),
        currency: doc.currency,
        priceBasis: doc.priceBasis,
        notes: doc.notes ?? null,
      },
    });
    // Recreate items so the audit table mirrors the transcription exactly.
    await prisma.priceItem.deleteMany({ where: { documentId: document.id } });
    const idMap = new Map<string, string>();
    for (const e of doc.entries) {
      const row = await prisma.priceItem.create({
        data: {
          documentId: document.id,
          supplierCode: e.supplierCode,
          description: e.description,
          unit: e.unit,
          colourTier: e.colourTier ?? null,
          variant: e.variant ?? null,
          packQty: e.packQty ?? null,
          stockLengthM: e.stockLengthM ?? null,
          unitPrice: e.unitPrice,
          source: e.source,
        },
      });
      idMap.set(identity(e), row.id);
    }
    itemIdBy.set(doc.docKey, idMap);
    console.log(`  provenance: ${doc.docKey} → ${doc.entries.length} price rows`);
  }

  // ---- 2. Apply mappings onto the catalog ----------------------------
  const catalogWrites: Prisma.PrismaPromise<unknown>[] = [];
  const itemWrites: Prisma.PrismaPromise<unknown>[] = [];
  const applied: { partKey: string; table: string; detail: string }[] = [];

  // Which price_item ids a mapping consumed → tag them with the outcome.
  const tagItems = (m: PriceMapping, refs: (PriceRef | undefined)[]) => {
    const note = m.note;
    for (const ref of refs) {
      if (!ref) continue;
      for (const rf of Array.isArray(ref) ? ref : [ref]) {
        const idMap = itemIdBy.get(rf.docKey);
        if (!idMap) continue;
        const e = findEntry(rf);
        const id = idMap.get(identity(e));
        if (!id) continue;
        itemWrites.push(
          prisma.priceItem.update({
            where: { id },
            data: {
              mappedTable: m.target.table,
              mappedKind: m.target.kind ?? null,
              mappedPartKey: m.target.partKey,
              applyNote: note,
            },
          }),
        );
      }
    }
  };

  for (const m of PRICE_MAPPINGS) {
    const { table, kind, partKey } = m.target;

    if (table === "profile_part" || table === "auxiliary") {
      // cost = price = White nett; tier columns from 1P/2P where present.
      if (!m.base) throw new Error(`Mapping for ${partKey} missing base price`);
      const base = resolveValue(m.base, "m").value;
      const data: Prisma.ProfilePartUpdateManyMutationInput = { cost: base, price: base };
      if (m.tier1p) {
        const v = resolveValue(m.tier1p, "m").value;
        data.cost1p = v; data.price1p = v;
      }
      if (m.tier2p) {
        const v = resolveValue(m.tier2p, "m").value;
        data.cost2p = v; data.price2p = v;
      }
      const kindEnum = (kind ?? (table === "auxiliary" ? "AUXILIARY" : undefined)) as PartKind;
      catalogWrites.push(
        prisma.profilePart.updateMany({ where: { systemId: SYSTEM_ID, kind: kindEnum, partKey }, data }),
      );
      applied.push({ partKey, table, detail: `base ${base}${m.tier1p ? ` / 1P ${data.price1p}` : ""}${m.tier2p ? ` / 2P ${data.price2p}` : ""}` });
      tagItems(m, [m.base, m.tier1p, m.tier2p]);
    } else if (table === "glass") {
      if (!m.base) throw new Error(`Mapping for ${partKey} missing base price`);
      const v = resolveValue(m.base, "m2").value;
      catalogWrites.push(
        prisma.glass.updateMany({ where: { systemId: SYSTEM_ID, partKey }, data: { cost: v, price: v } }),
      );
      applied.push({ partKey, table, detail: `${v} /m²` });
      tagItems(m, [m.base]);
    } else if (table === "hardware") {
      if (!m.base) throw new Error(`Mapping for ${partKey} missing base price`);
      const v = resolveValue(m.base, "pc").value;
      catalogWrites.push(
        prisma.hardware.updateMany({ where: { systemId: SYSTEM_ID, partKey }, data: { cost: v, price: v } }),
      );
      applied.push({ partKey, table, detail: `${v} /pc` });
      tagItems(m, [m.base]);
    } else if (table === "cill") {
      if (!m.cost || !m.price) throw new Error(`Cill mapping for ${partKey} needs both cost and price`);
      const cost = resolveValue(m.cost, "m").value;
      const price = resolveValue(m.price, "m").value;
      catalogWrites.push(
        prisma.cill.updateMany({ where: { systemId: SYSTEM_ID, partKey }, data: { cost, price } }),
      );
      applied.push({ partKey, table, detail: `cost ${cost} / price ${price} £/m` });
      tagItems(m, [m.cost, m.price]);
    }
  }

  await prisma.$transaction([...catalogWrites, ...itemWrites]);
  console.log(`\nApplied ${applied.length} catalog price mappings.`);

  // ---- 3. Mismatch / missing-data report -----------------------------
  console.log("\n==================================================");
  console.log("PRICE IMPORT REPORT");
  console.log("==================================================");

  console.log(`\n✔ Applied (${applied.length}):`);
  for (const a of applied) console.log(`   ${a.table.padEnd(13)} ${a.partKey.padEnd(24)} ${a.detail}`);

  const flagged = PRICE_MAPPINGS.filter((m) => m.flag);
  console.log(`\n⚑ Flags / decisions (${flagged.length}):`);
  for (const m of flagged) console.log(`   [${m.flag}] ${m.target.partKey}: ${m.note}`);

  // Unmapped price rows (recorded-only) — provenance kept, no catalog target.
  const unmapped = await prisma.priceItem.findMany({
    where: { mappedPartKey: null },
    select: { supplierCode: true, description: true, colourTier: true, unitPrice: true, document: { select: { docKey: true } } },
    orderBy: [{ documentId: "asc" }, { description: "asc" }],
  });
  console.log(`\n○ Recorded-only price rows (no catalog target) — ${unmapped.length}:`);
  for (const u of unmapped) {
    const code = u.supplierCode || "(no code)";
    console.log(`   ${u.document.docKey.padEnd(30)} ${code.padEnd(14)} ${u.description}${u.colourTier ? ` [${u.colourTier}]` : ""} = ${u.unitPrice}`);
  }

  // Catalog rows still at 0/0 after import — genuinely missing supplier data.
  const [zParts, zGlass, zGask, zHw, zCill] = await Promise.all([
    prisma.profilePart.findMany({ where: { systemId: SYSTEM_ID, cost: 0, price: 0 }, select: { partKey: true, code: true, kind: true } }),
    prisma.glass.findMany({ where: { systemId: SYSTEM_ID, cost: 0, price: 0 }, select: { partKey: true, code: true } }),
    prisma.gasket.findMany({ where: { systemId: SYSTEM_ID, cost: 0, price: 0 }, select: { partKey: true, code: true } }),
    prisma.hardware.findMany({ where: { systemId: SYSTEM_ID, cost: 0, price: 0 }, select: { partKey: true, code: true } }),
    prisma.cill.findMany({ where: { systemId: SYSTEM_ID, cost: 0, price: 0 }, select: { partKey: true, code: true } }),
  ]);
  const totalUnpriced = zParts.length + zGlass.length + zGask.length + zHw.length + zCill.length;
  console.log(`\n△ Catalog rows still UNPRICED (cost = price = 0) — ${totalUnpriced} (no supplier data; NOT guessed):`);
  for (const p of zParts) console.log(`   profile_part/${p.kind.padEnd(13)} ${p.partKey.padEnd(24)} ${p.code}`);
  for (const g of zGlass) console.log(`   glass         ${g.partKey.padEnd(24)} ${g.code}`);
  for (const g of zGask) console.log(`   gasket        ${g.partKey.padEnd(24)} ${g.code}`);
  for (const h of zHw) console.log(`   hardware      ${h.partKey.padEnd(24)} ${h.code}`);
  for (const c of zCill) console.log(`   cill          ${c.partKey.padEnd(24)} ${c.code}`);

  console.log("\n==================================================");
  console.log(`DONE. ${applied.length} priced · ${flagged.length} flags · ${unmapped.length} recorded-only · ${totalUnpriced} still unpriced.`);
  console.log("Restart the API / re-run npm run validate to price with the new numbers.");
  console.log("==================================================");
}

main()
  .catch((e) => {
    console.error("\n✗ Import failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
