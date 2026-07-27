// =====================================================================
// tools/extract-hardware.ts — supplier stock list → catalog hardware rows.
//
// Build/seed-time ONLY, exactly like extract-topology.ts: the pure engine never
// reads JSON. This tool transcribes the owner's real stock list
// (`collections/part-list/stockitems.json` + `sub-categories.json`) into
// `src/catalog/hardware-stock.generated.ts`, which `system-sunnyplast.ts`
// merges into `SUNNYPLAST_70.hardware`.
//
// WHY: the catalog shipped ONE casement handle, so the Designer's handle
// dropdown had one entry. The supplier list has 35 — plus 54 door handles,
// 16 cylinders, 18 door hinges and 13 door locks. These are the slots
// `src/engine/hardware.ts` substitutes 1:1 (handle / lock / cylinder / hinge):
// swapping the part changes the BOM line and nothing geometric.
//
// GOLDEN RULE compliance:
//   • cost / price / weight ship at 0. No supplier price is invented; the owner
//     fills them via the admin CRUD / CSV import (M5) or the price-list import.
//   • NO `lengthMm` on any generated row, so `pickEspag()` / `pickFrictionHinge()`
//     can never select one (the guard `hw-fricthinge-90` already uses). Nothing
//     here can enter a cut list or change a quote: no design references these
//     keys and no cut rule picks them.
//   • Codes: used VERBATIM when the stock list has one (cylinders do — GBC1,
//     9416N, …). Handles / hinges / locks ship a BLANK code in the export, so a
//     deterministic code is SYNTHESIZED from the part name — the same thing the
//     hand-written catalog already did for HDL-INLINE / DR-HDL-LL / FH-90DEG.
//     Synthesized codes are marked in the generated header; the authentic codes
//     are a supplier query (Spec/02-manual-migration/supplier-queries.md).
//
// Regenerate: `npx tsx src/tools/extract-hardware.ts` → rewrites the generated
// file, then `npm run db:seed` applies it. Deterministic: a second run must
// produce a byte-identical file.
// =====================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { HardwareItem } from "../types.ts";
import { SUNNYPLAST_70 } from "../catalog/system-sunnyplast.ts";
import { STOCK_HARDWARE } from "../catalog/hardware-stock.generated.ts";

/**
 * The HAND-WRITTEN hardware rows — the calibrated ones this tool must never
 * duplicate or shadow. `SUNNYPLAST_70.hardware` is `{...STOCK, ...HAND}`, so an
 * entry the catalog holds by a different object identity than the generated
 * map is, by construction, hand-written. Computing it this way (rather than
 * from the merged map) is what makes a re-run IDEMPOTENT: on run two the tool
 * still sees exactly the rows it saw on run one.
 */
function handWrittenHardware(): [string, { name: string }][] {
  return Object.entries(SUNNYPLAST_70.hardware).filter(([k, h]) => STOCK_HARDWARE[k] !== h);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const STOCK = join(ROOT, "collections", "part-list", "stockitems.json");
const SUBCATS = join(ROOT, "collections", "part-list", "sub-categories.json");
const OUT = join(ROOT, "src", "catalog", "hardware-stock.generated.ts");

interface StockItem {
  subCategoryId: number;
  code: string;
  part: string;
  per: string;
}
interface SubCategory {
  id: number;
  description: string;
}

/**
 * The stock sub-categories worth importing: one per 1:1 substitution slot in
 * `src/engine/hardware.ts`. Everything else in the stock list is deliberately
 * NOT imported — friction stays and casement locking are SIZE-SELECTED by the
 * engine from the sash span (calibrated, Jobs 85/88/90), so offering the
 * individual parts would let a quote break a calibrated rule from the UI
 * (questions.md Q19); trickle vents, numerals, letter plates and spyholes have
 * no engine slot at all.
 */
const CATEGORIES: { subCategory: string; keyPrefix: string; codePrefix: string }[] = [
  { subCategory: "Casement Handles", keyPrefix: "hw-handle", codePrefix: "HDL" },
  { subCategory: "Door Handle", keyPrefix: "hw-door-handle", codePrefix: "DR-HDL" },
  { subCategory: "Cylinders", keyPrefix: "hw-cylinder", codePrefix: "DR-CYL" },
  { subCategory: "Door Hinge", keyPrefix: "hw-door-hinge", codePrefix: "DR-HNG" },
  { subCategory: "Door Lock", keyPrefix: "hw-door-lock", codePrefix: "DR-LCK" },
];

/** Name → url-safe slug ("White L/H Cranked Handle" → "white-l-h-cranked"). */
function slug(name: string, dropWord: string): string {
  return name
    .toLowerCase()
    .replace(new RegExp(`\\b${dropWord}\\b`, "g"), "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The trailing noun each category's names repeat, dropped from the slug. */
const DROP_WORD: Record<string, string> = {
  "Casement Handles": "handle",
  "Door Handle": "handle",
  Cylinders: "cylinder",
  "Door Hinge": "hinge",
  "Door Lock": "lock",
};

export function runExtractor(): { rows: Record<string, HardwareItem>; report: string } {
  const items: StockItem[] = JSON.parse(readFileSync(STOCK, "utf8"));
  const subs: SubCategory[] = JSON.parse(readFileSync(SUBCATS, "utf8"));
  const subName = new Map(subs.map((s) => [s.id, s.description]));

  const rows: Record<string, HardwareItem> = {};
  const lines: string[] = [];
  const seenCodes = new Set<string>();
  let synthesized = 0;

  const hand = handWrittenHardware();
  const handKeys = new Set(hand.map(([k]) => k));
  const handNames = new Set(hand.map(([, h]) => h.name));

  for (const cat of CATEGORIES) {
    const drop = DROP_WORD[cat.subCategory] ?? "";
    const matched = items.filter((i) => subName.get(i.subCategoryId) === cat.subCategory);
    let added = 0;
    let skipped = 0;

    for (const item of matched) {
      const name = item.part.trim();
      if (!name) continue;
      const partKey = `${cat.keyPrefix}-${slug(name, drop)}`;

      // Never duplicate OR shadow a hand-written, calibrated row — by key (it
      // would change that part's code, and thus what a door quote prints) or by
      // name (the dropdown would list the same handle twice, and the calibrated
      // default would stop being the one the engine picks).
      if (handKeys.has(partKey) || handNames.has(name)) {
        skipped += 1;
        continue;
      }

      let code = item.code.trim();
      if (!code) {
        code = `${cat.codePrefix}-${slug(name, drop).toUpperCase()}`;
        synthesized += 1;
      }
      if (seenCodes.has(code)) continue; // defensive: codes must stay unique
      seenCodes.add(code);

      rows[partKey] = {
        code,
        name,
        cost: 0,
        price: 0,
        per: "pc",
        weight: 0,
        financialCategory: cat.subCategory,
      };
      added += 1;
    }
    lines.push(
      `  ${cat.subCategory.padEnd(18)} ${String(added).padStart(3)} added, ${skipped} already in the catalog (${matched.length} in the stock list)`,
    );
  }

  const report = [
    "Hardware stock import",
    ...lines,
    `  ${Object.keys(rows).length} rows total, ${synthesized} codes synthesized (blank in the export).`,
  ].join("\n");
  return { rows, report };
}

function writeGenerated(rows: Record<string, HardwareItem>): void {
  // Deterministic key order for stable diffs.
  const ordered: Record<string, HardwareItem> = {};
  for (const k of Object.keys(rows).sort()) ordered[k] = rows[k];

  const header = `// AUTO-GENERATED by src/tools/extract-hardware.ts — DO NOT EDIT BY HAND.
// Run \`npx tsx src/tools/extract-hardware.ts\` to regenerate.
//
// The owner's real supplier stock list (collections/part-list/stockitems.json),
// restricted to the sub-categories the engine substitutes 1:1 — casement
// handles, door handles, cylinders, door hinges, door locks. Merged into
// SUNNYPLAST_70.hardware by system-sunnyplast.ts, AFTER the hand-written
// entries, so a calibrated key always wins.
//
// cost / price / weight are 0 — no supplier price is guessed (golden rule); the
// owner fills them via the admin catalog CRUD / CSV import. No \`lengthMm\`, so
// the size-selecting pickers can never choose one of these. No design
// references them and no cut rule emits them, so every quote is unchanged.
//
// CODES: verbatim from the stock list where it has one (cylinders). Handles,
// hinges and locks export a BLANK code, so theirs are SYNTHESIZED from the part
// name — same convention as the hand-written HDL-INLINE / DR-HDL-LL / FH-90DEG.
// Reconcile against an authentic supplier code list before ordering from them.
import type { HardwareItem } from "../types.ts";

export const STOCK_HARDWARE: Record<string, HardwareItem> = ${JSON.stringify(ordered, null, 2)};
`;
  writeFileSync(OUT, header, "utf8");
}

// Run when invoked directly (tsx src/tools/extract-hardware.ts).
if (import.meta.url === `file://${process.argv[1]}`) {
  const { rows, report } = runExtractor();
  writeGenerated(rows);
  console.log(report);
  console.log(`\nWrote ${Object.keys(rows).length} hardware rows → ${OUT}`);
}
