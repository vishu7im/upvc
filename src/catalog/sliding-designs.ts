// =====================================================================
// catalog/sliding-designs.ts
//
// The 7 Sunny Plast Sliding Patio designs (product 73679b0a-…-b402544a600c).
// Each is a single row of equal-width framed panels (O = fixed, X = sliding),
// hand-authored as a `kind:"sliding"` topology node. The engine reproduces the
// real Job 104 (yogi test 1–4) cutting lists to ≤0.6mm — see CLAUDE.md
// "Sliding Patio" and src/validation/jobs.ts.
//
// `prisma/seed.ts#applySlidingTopologies()` patches the 7 collection designs
// (matched by `externalId`) with: topology, frameKey="frame-sliding",
// quotable=true, and per-config default dimensions taken from the work orders
// (2-panel 1500×1750, 3-panel 2000×1750, 4-panel 2600×1750).
//
// Default dims rationale (per owner): OX/XO from Job 1 (1500×1750); the 3-panel
// configs from Jobs 2/3 (2000×1750); OXXO from Job 4 (2600×1750). OOX/XOO have
// no dedicated job but share the verified 3-panel cut math.
// =====================================================================

import type { CellNode } from "../types.ts";

type Panel = { role: "fixed" | "slide"; slideDir?: "left" | "right" };

export interface SlidingDesignDef {
  /** collections design UUID (the design.externalId in the DB). */
  externalId: string;
  /** Config label (OX/XO/OXO/OOX/XOO/OXXO) — matches the design name. */
  config: string;
  topology: Extract<CellNode, { kind: "sliding" }>;
  defaultWidthMm: number;
  defaultHeightMm: number;
}

const slidingTopology = (
  panels: Panel[],
  meeting = false,
): Extract<CellNode, { kind: "sliding" }> => ({
  kind: "sliding",
  sashKey: "sash-sliding",
  panels,
  meeting,
});

const O: Panel = { role: "fixed" };
const Xl: Panel = { role: "slide", slideDir: "left" };
const Xr: Panel = { role: "slide", slideDir: "right" };

export const SLIDING_DESIGNS: SlidingDesignDef[] = [
  // ---- 2-panel (Job 1: 1500×1750) ----
  {
    externalId: "0057bd49-577c-4b61-bf5f-f8d69ca760b3",
    config: "OX",
    topology: slidingTopology([O, Xl]), // sliding panel on the right, slides left
    defaultWidthMm: 1500,
    defaultHeightMm: 1750,
  },
  {
    externalId: "fbf4592c-ee97-4ac9-ba96-862370213bff",
    config: "XO",
    topology: slidingTopology([Xr, O]), // sliding panel on the left, slides right
    defaultWidthMm: 1500,
    defaultHeightMm: 1750,
  },
  // ---- 3-panel (Jobs 2/3: 2000×1750) ----
  {
    externalId: "8a1b8a80-e31a-4f0b-aa62-2771e04ec985",
    config: "OXO Slide Left",
    topology: slidingTopology([O, Xl, O]),
    defaultWidthMm: 2000,
    defaultHeightMm: 1750,
  },
  {
    externalId: "8cdbd800-fc30-49d8-ba7f-629477854084",
    config: "OXO Slide Right",
    topology: slidingTopology([O, Xr, O]),
    defaultWidthMm: 2000,
    defaultHeightMm: 1750,
  },
  {
    externalId: "659df78b-5fee-464d-b5b6-92288a2c8ecc",
    config: "OOX",
    topology: slidingTopology([O, O, Xl]),
    defaultWidthMm: 2000,
    defaultHeightMm: 1750,
  },
  {
    externalId: "1ae6a0b0-3eb8-4b7a-bafb-6118ec554b52",
    config: "XOO",
    topology: slidingTopology([Xr, O, O]),
    defaultWidthMm: 2000,
    defaultHeightMm: 1750,
  },
  // ---- 4-panel centre-meeting (Job 4: 2600×1750) ----
  {
    externalId: "bd0ad364-3313-442d-871f-db7fab0502c4",
    config: "OXXO",
    // Two centre sliders meet/part in the middle. `meeting:true` selects the
    // OXXO width formula (single-data-point — see topology.ts caveat).
    topology: slidingTopology([O, Xl, Xr, O], true),
    defaultWidthMm: 2600,
    defaultHeightMm: 1750,
  },
];
