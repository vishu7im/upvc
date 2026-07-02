// =====================================================================
// engine/hardware.ts — allocate hardware items per the sash/door types.
//
// Rules calibrated against Job 85, 88, 90:
//   TOP-HUNG sash:
//     1 inline handle
//     1 espag (largest standard ≤ sash WIDTH)
//     1 friction hinge (size chosen from sash HEIGHT — vertical hinge on jambs)
//     mushroom strikers: 2 per espag ≤ 600mm, 4 otherwise
//     run-up blocks: 2 per sash
//
//   SIDE-HUNG sash (left or right):
//     1 inline handle
//     1 espag (largest standard ≤ sash HEIGHT)
//     1 friction hinge (size chosen from sash WIDTH — horizontal hinge on head/sill)
//     mushroom strikers: 2 per espag ≤ 600mm, 4 otherwise
//     run-up blocks: 1 per sash
//
//   DOOR (right/left hung):
//     1 lever handle, 1 door lock, 1 cylinder
//     3 flag hinges
//     1 R/H or L/H keep set
//     1 run-up block
//
// Glazing Bridge Packers: 5 per glass + 3 base overhead (placeholder rule
// — tune `glazingBridgePackerPerGlass` and `glazingBridgePackerBase` below
// against more sample jobs as you gather them).
// =====================================================================

import type { HardwarePiece, ProfileSystem, SolvedGeometry } from "../types.ts";

const TUNING = {
  glazingBridgePackerPerGlass: 5,
  glazingBridgePackerBase: 3,
};

export function computeHardware(
  geom: SolvedGeometry,
  system: ProfileSystem,
): HardwarePiece[] {
  const tally = new Map<string, { name: string; qty: number; why: string[] }>();
  const add = (key: string, qty: number, reason: string) => {
    const hw = system.hardware[key];
    if (!hw) return;
    const slot = tally.get(hw.code) ?? { name: hw.name, qty: 0, why: [] };
    slot.qty += qty;
    slot.why.push(reason);
    tally.set(hw.code, slot);
  };

  for (const cell of geom.cells) {
    // FRENCH DOOR glazing bridges — calibrated Job 00000264: 8 per glass PANE
    // (doc 0: 2 panes → 16; docs 1/4: 4 panes → 32). Every french-door cell is
    // exactly one pane (midrail panes are extra cells without a sashOuter), so
    // this counts BEFORE the sashOuter guard below.
    if (cell.content.startsWith("french-door")) {
      add("hw-glazing-bridge", 8, "8 glazing bridges per French pane");
    }
    if (!cell.sashOuter) continue;
    const sashW = cell.sashOuter.w;
    const sashH = cell.sashOuter.h;
    const c = cell.content;

    if (c === "casement-top") {
      // Top-hung: espag on bottom (horizontal), hinges on sides (vertical).
      add("hw-handle-inline", 1, "casement handle");
      const espagKey = pickEspag(sashW);
      add(espagKey, 1, `espag for top-hung sash width=${sashW}`);
      const hingeKey = pickFrictionHinge(sashH);
      add(hingeKey, 1, `friction hinge for top-hung sash height=${sashH}`);
      const espagLen = system.hardware[espagKey].lengthMm!;
      add("hw-mushroom-striker", espagLen <= 600 ? 2 : 4, `strikers per espag ${espagLen}mm`);
      add("hw-runup-block", 2, "top-hung run-up blocks");
    } else if (c === "casement-side-left" || c === "casement-side-right") {
      // Side-hung: espag on side (vertical), hinges on head/sill (horizontal).
      add("hw-handle-inline", 1, "casement handle");
      const espagKey = pickEspag(sashH);
      add(espagKey, 1, `espag for side-hung sash height=${sashH}`);
      const hingeKey = pickFrictionHinge(sashW);
      add(hingeKey, 1, `friction hinge for side-hung sash width=${sashW}`);
      const espagLen = system.hardware[espagKey].lengthMm!;
      add("hw-mushroom-striker", espagLen <= 600 ? 2 : 4, `strikers per espag ${espagLen}mm`);
      add("hw-runup-block", 1, "side-hung run-up block");
    } else if (c === "tilt-turn") {
      // TILT & TURN — UNCALIBRATED (M3): geometry is identical to a casement
      // sash (reuses sash-t), but the operating gear is a single handle driving
      // a perimeter espagnolette plus a tilt-and-turn hinge set + restrictor.
      // The master PDF (Sunnyplast manual) covers T&T profiles/sash sizing but
      // not a per-sash hardware bill, and there is NO validated T&T job — so
      // these quantities are placeholders pending a real T&T job. T&T designs
      // are gated quotable=false by the extractor; this branch only makes the
      // family structurally complete and ready for future calibration.
      add("hw-tt-handle", 1, "tilt & turn handle");
      add("hw-tt-gear", 1, `tilt & turn perimeter gear (sash ${sashW}x${sashH})`);
      add("hw-tt-hinge-set", 1, "tilt & turn hinge set (corner + top stay)");
      add("hw-tt-restrictor", 1, "tilt & turn restrictor");
    } else if (c === "door-right") {
      add("hw-door-handle", 1, "door handle");
      add("hw-flag-hinge-white", 3, "3 flag hinges");
      add("hw-door-lock", 1, "door lock");
      add("hw-cylinder-brass", 1, "cylinder");
      add("hw-keep-rh", 1, "R/H keep set");
      add("hw-runup-block", 1, "door run-up block");
    } else if (c === "door-left") {
      add("hw-door-handle", 1, "door handle");
      add("hw-flag-hinge-white", 3, "3 flag hinges");
      add("hw-door-lock", 1, "door lock");
      add("hw-cylinder-brass", 1, "cylinder");
      add("hw-keep-lh", 1, "L/H keep set");
      add("hw-runup-block", 1, "door run-up block");
    } else if (c === "french-door-master" || c === "french-door-slave") {
      // FRENCH DOOR (Job 00000264). CALIBRATED: 4 cavity locking blocks per
      // leaf (docs list 8 for 2 leaves, every configuration). APPROXIMATE
      // (flagged): the docs' cut tables don't itemise operating gear — the
      // master leaf reuses the single-door set per the doc header ("Door Handle
      // w Key-A" + cylinder), the slave gets the meeting-stile shootbolt;
      // 3 flag hinges per leaf mirrors the calibrated single door.
      add("hw-cavity-lock-block", 4, "4 cavity locking blocks per French leaf");
      add("hw-flag-hinge-white", 3, "3 flag hinges per French leaf (approx)");
      if (c === "french-door-master") {
        add("hw-door-handle", 1, "French master-leaf handle (doc header)");
        add("hw-door-lock", 1, "French master-leaf lock (approx)");
        add("hw-cylinder-brass", 1, "French cylinder (doc header)");
      } else {
        add("hw-shootbolt", 1, "French slave-leaf shootbolt (approx)");
      }
    } else if (c.startsWith("sliding-")) {
      // SLIDING PATIO — calibrated from Job 104 (yogi test 1–4).
      // Bridge packers per panel: APPROXIMATE (~4/panel; not cleanly
      // geometry-derived — flagged like the glazing-bridge-packer rule).
      add("hw-bridge-packer", 4, "bridge packers per panel (approx)");
      if (c === "sliding-fixed") {
        // 7 fixed-panel supports per FIXED panel (Job 104: 1 fixed→7, 2 fixed→14).
        add("hw-fixed-panel-support", 7, "7 fixed-panel supports per fixed panel");
      } else {
        // sliding-slide-left / sliding-slide-right — per SLIDING panel.
        add("hw-patio-handle-white", 1, "patio handle");
        add("hw-cylinder-brass", 1, "patio cylinder");
        add("hw-patio-lock-keep", 1, "patio lock & keep set");
        add("hw-patio-roller", 2, "2 patio rollers per sliding panel");
        add("hw-panel-stopper", 1, "panel stopper");
        add("hw-brush-top", 1, "top brush block");
        add("hw-brush-bottom", 1, "bottom brush block");
      }
    }
  }

  // French-door meeting stile — UNCALIBRATED (M3): the passive leaf is secured
  // by a shootbolt (top & bottom) on the central meeting stile. One shootbolt
  // assembly per meeting stile. No validated French job exists; French designs
  // are gated quotable=false, so this only completes the family structurally.
  if (geom.meetingStiles) {
    add("hw-shootbolt", geom.meetingStiles, `passive-leaf shootbolt per meeting stile (${geom.meetingStiles})`);
  }

  // FRENCH MULLION inverter caps — calibrated Job 00000264: 2 per STULP
  // (S-jointType) mullion, every configuration.
  const stulps = geom.mullions.filter((m) => m.jointType === "S").length;
  if (stulps > 0) {
    add("hw-inverter-cap", 2 * stulps, `2 inverter caps per French mullion (${stulps})`);
  }

  // Glazing bridge packer — placeholder rule (tune as you gather more data).
  const glassCount = geom.cells.length;
  add(
    "hw-glazing-bridge-pack",
    TUNING.glazingBridgePackerPerGlass * glassCount + TUNING.glazingBridgePackerBase,
    `${TUNING.glazingBridgePackerPerGlass}/glass + ${TUNING.glazingBridgePackerBase} base`,
  );

  return Array.from(tally.entries()).map(([code, v]) => ({
    code,
    name: v.name,
    qty: v.qty,
    why: v.why.join("; "),
  }));
}

// Pick the largest available espagnolette ≤ dim.
function pickEspag(dim: number): string {
  if (dim >= 1000) return "hw-espag-1000";
  if (dim >= 800) return "hw-espag-800";
  return "hw-espag-600";
}

// Friction-hinge selection — calibrated to Job 85/88:
//   358.5mm → 8" (200mm)   ← Job 85 sash height, Job 88 top sash height
//   728mm   → 16" (400mm)  ← Job 88 bottom sash width
function pickFrictionHinge(dim: number): string {
  if (dim <= 400) return "hw-fricthinge-8";
  if (dim <= 500) return "hw-fricthinge-10";
  if (dim <= 600) return "hw-fricthinge-12";
  if (dim <= 800) return "hw-fricthinge-16";
  if (dim <= 1000) return "hw-fricthinge-20";
  return "hw-fricthinge-24";
}
