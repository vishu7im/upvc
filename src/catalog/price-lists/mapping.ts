// =====================================================================
// price-lists/mapping.ts — supplier price → catalog row wiring.
//
// Each entry maps ONE catalog row (by table + partKey, NEVER by fuzzy code) to
// its supplier price(s). Profiles: base = White nett (cost = price), tier1p/tier2p
// set the 1P/2P tier columns. Cills: cost = Doc A £/m, price = Doc B Normal ÷ 6.
// Glass panels / hardware / auxiliaries: base = the single nett price. Every
// alias / derivation / tier-reuse carries a `note` (and a `flag` for the report).
// =====================================================================

import type { PriceMapping } from "./types.ts";

const A = "sp-profiles-anglia-2025-04-25";
const B = "sp-cills-per-length";
const C = "sp-panels-2025";
const D = "sp-sliding-2025-07-29";

/** Profile tier mapping helper: base/1P/2P from one doc's three codes. */
function tri(
  table: "profile_part",
  kind: string,
  partKey: string,
  docKey: string,
  codes: [string, string | null, string | null],
  note: string,
  flag?: PriceMapping["flag"],
): PriceMapping {
  const [w, p1, p2] = codes;
  return {
    target: { table, kind, partKey },
    base: { docKey, supplierCode: w },
    ...(p1 ? { tier1p: { docKey, supplierCode: p1 } } : {}),
    ...(p2 ? { tier2p: { docKey, supplierCode: p2 } } : {}),
    note,
    ...(flag ? { flag } : {}),
  };
}

export const PRICE_MAPPINGS: PriceMapping[] = [
  // ---------------- FRAMES ----------------
  tri("profile_part", "FRAME", "frame-5ch", A, ["SPQ-5-10252", "SPQ-5-10398", "SPQ-5-10267"],
    "Exact code — Doc A 'Window Frame 70mm 5ch' = frame-5ch (Jobs 85/88)."),
  tri("profile_part", "FRAME", "frame-6ch", A, ["SPQ-6-11252", "SPQ-6-11398", "SPQ-6-11267"],
    "Exact code — Doc A 'Door & Window Frame 70mm 6ch' = frame-6ch (Job 90)."),
  tri("profile_part", "FRAME", "frame-french", A, ["SPQ-6-11252", "SPQ-6-11398", "SPQ-6-11267"],
    "Duplicate code: frame-french is the same physical SPQ-6-11252 as frame-6ch (own catalog entry only because its calibrated face differs). Both priced."),
  tri("profile_part", "FRAME", "frame-sliding", D, ["SPQ-GL-10252", "SPQ-GL-10398", "SPQ-GL-10267"],
    "Exact code — Doc D 'Sliding Frame' = frame-sliding (Jobs 44/48)."),

  // ---------------- SASHES ----------------
  tri("profile_part", "SASH", "sash-t", A, ["SPQ-05-30252", "SPQ-05-30398", "SPQ-05-30267"],
    "Doc A 'T Sash 70mm internally glazed' = sash-t (code reconciled from placeholder SPQ-T-SASH)."),
  tri("profile_part", "SASH", "sash-door-z", A, ["SPQ-5-45252", "SPQ-5-45253", "SPQ-5-45267"],
    "Doc A 'Z Door Sash inward' = sash-door-z (reconciled from placeholder SPQ-DOOR-Z; shares code with sash-door-z-fr — both priced). NB Doc A 1P code printed -45253."),
  tri("profile_part", "SASH", "sash-door-z-fr", A, ["SPQ-5-45252", "SPQ-5-45253", "SPQ-5-45267"],
    "French Z leaf = same physical SPQ-5-45252 as sash-door-z. Both priced."),
  tri("profile_part", "SASH", "sash-door-t-fr", A, ["SPQ-5-47252", "SPQ-5-47398", "SPQ-5-47267"],
    "Exact code — Doc A 'T Door Sash outward' = sash-door-t-fr (Job 00000264)."),
  tri("profile_part", "SASH", "sash-sliding", D, ["SPQ-GL-20252", "SPQ-GL-20398", "SPQ-GL-20267"],
    "Exact code — Doc D 'Sliding Sash' = sash-sliding (Jobs 44/48)."),

  // ---------------- TRANSOMS / MULLIONS ----------------
  tri("profile_part", "TRANSOM", "transom-t-67", A, ["SPQ-05-20252", "SPQ-05-20398", "SPQ-05-20267"],
    "transom-t-67 reuses the SPQ-05-20252 profile (Doc A labels it 'Casement Z Sash 70' — the engine uses it as a T-transom). Priced by its code."),
  tri("profile_part", "TRANSOM", "transom-z-67", A, ["SPQ-005-30252", "SPQ-005-30398", "SPQ-005-30267"],
    "transom-z-67 = SPQ-005-30252 (Doc A 'Casement T Sash 70'; engine uses it as a Z-transom). Shares code with midrail-67 — both priced."),
  tri("profile_part", "TRANSOM", "midrail-67", A, ["SPQ-005-30252", "SPQ-005-30398", "SPQ-005-30267"],
    "French midrail = same physical SPQ-005-30252 as transom-z-67. Both priced."),
  tri("profile_part", "TRANSOM", "mullion-78", A, ["SPQ-5-30252", "SPQ-5-30398", "SPQ-5-30267"],
    "Exact code — Doc A 'T Transom/Mullion 70' = mullion-78 (Job 90)."),
  tri("profile_part", "TRANSOM", "french-mullion", A, ["SPQ-1-46252", "SPQ-1-46398", "SPQ-1-46267"],
    "Exact code — Doc A 'French Mullion 70' = french-mullion (Job 00000264)."),

  // ---------------- BEADS (Doc A has no 1P bead row ⇒ tier1p omitted) ----------------
  tri("profile_part", "BEAD", "bead-28", A, ["SPQ-1-51252", null, "SPQ-1-51267"],
    "Doc A 'Bead 28mm' = bead-28 (reconciled from placeholder BEAD-28). No 1P row ⇒ 1P quotes fall back to the colour %-uplift."),
  tri("profile_part", "BEAD", "bead-sl-24", A, ["SPQ-1-51252", null, "SPQ-1-51267"],
    "Sliding bead — Jobs 44/48 print SPQ-1-51252, so priced from Doc A. (Doc D separately prices SPQ-3-51252 'Bead 28mm' 0.78/1.12 — recorded-only, unresolved: has sliding moved to SPQ-3-51252? Ask supplier.)"),
  tri("profile_part", "BEAD", "bead-32", A, ["SPQ-1-52252", null, "SPQ-1-52267"],
    "ALIAS: catalog/French docs print SPQ-1-52253; Doc A prices SPQ-1-52252 'Bead 32mm'. Applied Doc A's 52252 price to bead-32 (keep the -253 catalog code). Verify with supplier.", "alias"),

  // ---------------- REINFORCEMENT (steel, tierless — not colour-bearing) ----------------
  {
    target: { table: "profile_part", kind: "REINFORCEMENT", partKey: "reinf-44x12" },
    base: { docKey: D, supplierCode: "SPQ-2-85000" },
    note: "ALIAS: Doc D 'Reinforcement 12x43x12 1.5 for Frame' ≙ catalog AO44X12 '44x12' (Jobs 44/48). 12x43x12 ≈ 44x12 section. Verify.",
    flag: "alias",
  },
  {
    target: { table: "profile_part", kind: "REINFORCEMENT", partKey: "reinf-25x27-u" },
    base: { docKey: D, supplierCode: "SPQ-2-85001" },
    note: "ALIAS: Doc D 'Reinforcement for Sash 27x25x27 1.5' ≙ catalog AU26X26 '26x26 U' (Jobs 44/48). Verify.",
    flag: "alias",
  },

  // ---------------- AUXILIARY PROFILES (aluminium/caps, tierless) ----------------
  {
    target: { table: "auxiliary", kind: "AUXILIARY", partKey: "aux-track-alu" },
    base: { docKey: D, supplierCode: "SPQ_AD16014" },
    note: "Doc D 'Aluminium Sliding Rail' SPQ_AD16014 (underscore) ≙ catalog AD16014.",
    flag: "alias",
  },
  {
    target: { table: "auxiliary", kind: "AUXILIARY", partKey: "aux-cap-frame-alu" },
    base: { docKey: D, supplierCode: "SPQ-AD55142" },
    note: "Doc D 'Threshold Cover Trim' SPQ-AD55142 ≙ catalog AD55142.",
    flag: "alias",
  },
  {
    target: { table: "auxiliary", kind: "AUXILIARY", partKey: "aux-cap-frame-slide" },
    base: { docKey: D, supplierCode: "SPQ-GL-10253" },
    note: "Doc D 'Sliding Frame Cover' White = aux-cap-frame-slide (SPQ-GL-10253). Its 2P variant -10268 recorded-only (aux profiles aren't colour-bearing).",
  },
  {
    target: { table: "auxiliary", kind: "AUXILIARY", partKey: "aux-cap-sash-pvc" },
    base: { docKey: D, supplierCode: "SPQ-GL-20253" },
    note: "Doc D 'U-PVC Interlock & Sash Cover' White = aux-cap-sash-pvc (SPQ-GL-20253). 2P variant -20268 recorded-only.",
  },

  // ---------------- CILLS (cost = Doc A £/m, price = Doc B Normal ÷ 6 m) ----------------
  ...([
    [95, "white", "cill-95-white", "GL-1-00095", "95mm White"],
    [95, "1p", "cill-95-foiled-white", "GL-2-00095", "95mm 1P Color"],
    [95, "2p", "cill-95-foiled", "GL-3-00095", "95mm 2P Color"],
    [150, "white", "cill-150-white", "GL-1-00150", "150mm White"],
    [150, "1p", "cill-150-foiled-white", "GL-2-00150", "150mm 1P Color"],
    [150, "2p", "cill-150-foiled", "GL-3-00150", "150mm 2P Color"],
    [180, "white", "cill-180-white", "GL-1-00180", "180mm White"],
    [180, "1p", "cill-180-foiled-white", "GL-2-00180", "180mm 1P Color"],
    [180, "2p", "cill-180-foiled", "GL-3-00180", "180mm 2P Color"],
  ] as [number, string, string, string, string][]).map(([size, tier, partKey, docACode, docBDesc]): PriceMapping => ({
    target: { table: "cill", partKey },
    cost: { docKey: A, supplierCode: docACode },
    price: { docKey: B, match: { description: docBDesc, variant: "normal" } },
    note: `Cill ${size}mm ${tier}: cost = Doc A ${docACode} (£/m); price = Doc B '${docBDesc}' Normal tier ÷ 6 m (owner decision).`,
  })),

  // ---------------- GLASS PANELS (per m²) ----------------
  { target: { table: "glass", partKey: "panel-28-white" }, base: { docKey: C, supplierCode: "PNL-28-W" }, note: "Doc C White PVC panel (synthesized code PNL-28-W).", flag: "synthesized" },
  { target: { table: "glass", partKey: "panel-28-1p" }, base: { docKey: C, supplierCode: "PNL-28-1P" }, note: "Doc C 1P PVC panel (synthesized code).", flag: "synthesized" },
  { target: { table: "glass", partKey: "panel-28-2p" }, base: { docKey: C, supplierCode: "PNL-28-2P" }, note: "Doc C 2P PVC panel (synthesized code).", flag: "synthesized" },
  { target: { table: "glass", partKey: "panel-hpl-1p" }, base: { docKey: C, supplierCode: "PNL-HPL-1P" }, note: "Doc C 1P HPL door panel (synthesized code).", flag: "synthesized" },
  { target: { table: "glass", partKey: "panel-hpl-2p" }, base: { docKey: C, supplierCode: "PNL-HPL-2P" }, note: "Doc C 2P HPL door panel (synthesized code).", flag: "synthesized" },
  { target: { table: "glass", partKey: "panel-28-alu" }, base: { docKey: C, supplierCode: "PNL-28-ALU" }, note: "Doc C White PVC + 1mm alu panel (synthesized code).", flag: "synthesized" },

  // ---------------- SLIDING HARDWARE (per pc) ----------------
  { target: { table: "hardware", partKey: "hw-brush-top" }, base: { docKey: D, supplierCode: "GLIS 01" }, note: "Doc D GLIS 01 Top Brush Block = hw-brush-top." },
  { target: { table: "hardware", partKey: "hw-brush-bottom" }, base: { docKey: D, supplierCode: "GLIS 02" }, note: "Doc D GLIS 02 Bottom Brush Block = hw-brush-bottom." },
  { target: { table: "hardware", partKey: "hw-fixed-panel-support" }, base: { docKey: D, supplierCode: "GLIS 03" }, note: "Doc D GLIS 03 Fixed Panel Support Spacer = hw-fixed-panel-support." },
  { target: { table: "hardware", partKey: "hw-panel-stopper" }, base: { docKey: D, supplierCode: "GLIS 04" }, note: "Doc D GLIS 04 Bump Stop = hw-panel-stopper. PRICED PER PACK OF 2 — the engine adds qty 1 per sliding panel, treated as 1 pack (flagged).", flag: "pack" },
  { target: { table: "hardware", partKey: "hw-patio-handle-white" }, base: { docKey: D, supplierCode: "GLIS 09" }, note: "Doc D GLIS 09 Patio Handle Set = hw-patio-handle-white." },
  { target: { table: "hardware", partKey: "hw-patio-lock-keep" }, base: [{ docKey: D, supplierCode: "GLIS 10" }, { docKey: D, supplierCode: "GLIS 11" }], note: "DERIVED: hw-patio-lock-keep models one lock&keep set = GLIS 10 lock (14.74) + GLIS 11 keep (7.37) = 22.11.", flag: "derived" },
  { target: { table: "hardware", partKey: "hw-patio-cylinder" }, base: { docKey: D, supplierCode: "GLIS 12" }, note: "Doc D GLIS 12 Cylinder = hw-patio-cylinder (NEW row; not the door brass cylinder)." },
  { target: { table: "hardware", partKey: "hw-patio-roller" }, base: { docKey: D, supplierCode: "GLIS 13" }, note: "Doc D GLIS 13 Sliding Rolls = hw-patio-roller." },
];
