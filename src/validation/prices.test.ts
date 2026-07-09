// =====================================================================
// validation/prices.test.ts — supplier price-list assertions (M5.5).
//
// GATED: if supplier prices haven't been imported yet (frame-5ch.cost === 0),
// this logs a SKIP and asserts nothing, so `npm run validate` stays green on a
// fresh DB. After `npm run import:prices` it proves:
//   1. the catalog carries the exact transcribed £ values (base + 1P/2P tiers),
//   2. quotes read them per-profile (White + 1P + 2P) matching the price list,
//   3. items with no supplier data are still £0 (nothing guessed).
//
// Wired into `npm run validate` (src/validation/jobs.ts) after loadCatalog().
// Uses the REAL DB catalog (via getSystem) + solve().
// =====================================================================

import { solve } from "../engine/solve.ts";
import { getSystem } from "../catalog/index.ts";

type Expect = (label: string, actual: any, expected: any) => void;

const SYS = "sunnyplast-70";

/** Round to 2dp to compare against printed £ values regardless of Decimal noise. */
const p2 = (n: number | undefined) => (n == null ? -1 : Math.round(n * 100) / 100);

export function validateSupplierPrices(expect: Expect): void {
  console.log("\n==================================================");
  console.log("M5.5 supplier price-list import");
  console.log("==================================================");

  const sys = getSystem(SYS);
  if (!sys) {
    expect("system loaded", !!sys, true);
    return;
  }
  // Gate: skip cleanly until prices are imported.
  if (p2(sys.frames["frame-5ch"]?.cost) === 0) {
    console.log("  supplier prices not imported (frame-5ch.cost = 0) — SKIPPING price assertions.");
    console.log("  Run `npm run import:prices` to populate, then re-run validate.");
    return;
  }

  // ---- 1. Catalog carries the exact transcribed values ----
  const f5 = sys.frames["frame-5ch"];
  expect("frame-5ch base = 2.50", p2(f5.cost), 2.50);
  expect("frame-5ch price = 2.50", p2(f5.price), 2.50);
  expect("frame-5ch 1P = 3.50", p2(f5.tierPrices?.price1p), 3.50);
  expect("frame-5ch 2P = 4.20", p2(f5.tierPrices?.price2p), 4.20);
  const f6 = sys.frames["frame-6ch"];
  expect("frame-6ch base = 2.90", p2(f6.cost), 2.90);
  expect("frame-6ch 2P = 4.60", p2(f6.tierPrices?.price2p), 4.60);
  // Duplicate-code row frame-french must ALSO be priced (both got their mapping).
  expect("frame-french base = 2.90 (duplicate code priced)", p2(sys.frames["frame-french"].cost), 2.90);
  const st = sys.sashes["sash-t"];
  expect("sash-t base = 2.80", p2(st.cost), 2.80);
  expect("sash-t 1P = 3.80", p2(st.tierPrices?.price1p), 3.80);
  expect("sash-t 2P = 4.80", p2(st.tierPrices?.price2p), 4.80);
  const b28 = sys.beads["bead-28"];
  expect("bead-28 base = 0.60", p2(b28.cost), 0.60);
  expect("bead-28 2P = 1.50", p2(b28.tierPrices?.price2p), 1.50);
  expect("bead-28 has NO 1P tier (Doc A) ", b28.tierPrices?.price1p ?? null, null);
  // Duplicate-code transom pair both priced.
  expect("transom-z-67 base = 2.80", p2(sys.transoms["transom-z-67"].cost), 2.80);
  expect("midrail-67 base = 2.80 (duplicate code priced)", p2(sys.transoms["midrail-67"].cost), 2.80);
  // Sliding + steel + aux.
  expect("frame-sliding base = 3.12", p2(sys.frames["frame-sliding"].cost), 3.12);
  expect("sash-sliding base = 3.98", p2(sys.sashes["sash-sliding"].cost), 3.98);
  expect("frame-sliding 2P = 4.70", p2(sys.frames["frame-sliding"].tierPrices?.price2p), 4.70);
  expect("reinf-44x12 (steel) = 1.10", p2(sys.reinforcement["reinf-44x12"].cost), 1.10);
  expect("reinf-25x27-u (steel) = 1.07", p2(sys.reinforcement["reinf-25x27-u"].cost), 1.07);
  expect("aux-track-alu = 1.70", p2(sys.auxiliaries?.["aux-track-alu"]?.cost), 1.70);

  // ---- 2. Cills: cost = Doc A £/m, price = Doc B Normal ÷ 6 ----
  const c95 = sys.cills["cill-95-white"];
  expect("cill-95-white cost = 1.80 (Doc A)", p2(c95.cost), 1.80);
  expect("cill-95-white price = 2.50 (Doc B 15/6)", p2(c95.price), 2.50);
  const c180 = sys.cills["cill-180-foiled"];
  expect("cill-180-foiled cost = 7.50 (Doc A)", p2(c180.cost), 7.50);
  expect("cill-180-foiled price = 7.50 (Doc B 45/6)", p2(c180.price), 7.50);

  // ---- 3. Panels (added as glass variants) ----
  expect("panel-28-white = 18.88 /m²", p2(sys.glass["panel-28-white"].price), 18.88);
  expect("panel-hpl-2p = 36.26 /m²", p2(sys.glass["panel-hpl-2p"].price), 36.26);

  // ---- 4. Sliding hardware ----
  expect("hw-brush-top = 2.21", p2(sys.hardware["hw-brush-top"].price), 2.21);
  expect("hw-patio-lock-keep = 22.11 (GLIS 10 + 11)", p2(sys.hardware["hw-patio-lock-keep"].price), 22.11);
  expect("hw-patio-cylinder = 2.36", p2(sys.hardware["hw-patio-cylinder"].price), 2.36);

  // ---- 5. Engine line-level: a real casement quote matches the list ----
  const base = { orderNo: "PRICE-TEST", customer: "Validation", designId: "win-th-over-fixed-z", widthMm: 1200, heightMm: 1200, systemId: SYS } as const;
  const line = (q: ReturnType<typeof solve>, code: string) => q.pricing.lines.find((l) => l.code === code);

  const white = solve({ ...base });
  expect("white quote: frame line 2.50/m", p2(line(white, "SPQ-5-10252")?.unitPrice), 2.50);
  expect("white quote: sash line 2.80/m", p2(line(white, "SPQ-05-30252")?.unitPrice), 2.80);
  expect("white quote: bead line 0.60/m", p2(line(white, "SPQ-1-51252")?.unitPrice), 0.60);

  // 2P: a single non-white colour ⇒ both sides coloured ⇒ 2P tier prices.
  const twoP = solve({ ...base, colourKey: "anthracite" });
  expect("2P quote: frame line 4.20/m", p2(line(twoP, "SPQ-5-10252")?.unitPrice), 4.20);
  expect("2P quote: sash line 4.80/m", p2(line(twoP, "SPQ-05-30252")?.unitPrice), 4.80);
  expect("2P quote: bead line 1.50/m", p2(line(twoP, "SPQ-1-51252")?.unitPrice), 1.50);

  // 1P: white inside + coloured outside ⇒ 1P tier prices on parts that have them.
  const oneP = solve({ ...base, colourKey: "white", colourKeyOutside: "anthracite" });
  expect("1P quote: frame line 3.50/m", p2(line(oneP, "SPQ-5-10252")?.unitPrice), 3.50);
  expect("1P quote: sash line 3.80/m", p2(line(oneP, "SPQ-05-30252")?.unitPrice), 3.80);

  // ---- 6. Missing-data guards: NOT guessed ⇒ still £0 ----
  expect("glass (glazed unit) still 0 — no supplier data", p2(sys.glass["glass-4-20-4-lowe"].price), 0);
  expect("gasket-01 still 0 — no supplier data", p2(sys.gaskets["gasket-01"].price), 0);
  expect("casement handle still 0 — no supplier data", p2(sys.hardware["hw-handle-inline"].price), 0);
}
