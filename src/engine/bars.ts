// =====================================================================
// engine/bars.ts
//
// Turns solved geometry into the cuttable pieces and glass + gasket lists.
// All deductions calibrated against Jobs 85, 88, 90.
//
// End-prep notation (matches Quotila's docs):
//   "\ - /"   double miter (frame & sash corners)
//   "< - >"   horns on each end (transom/mullion welded ends)
//   "[ - ]"   square cut (bead, reinforcement)
//   "\ - Y]"  miter at outer end, Y-notch at inner end (Z-broken jamb, top)
//   "[Y - /"  Y-notch at outer end, miter at inner end (Z-broken jamb, bottom)
// =====================================================================

import type {
  BarPiece,
  Design,
  GasketPiece,
  GlassPiece,
  ProfileSystem,
  Reinforcement,
  SolvedCell,
  SolvedGeometry,
  SolvedParts,
} from "../types.ts";
import { framesForEdges } from "./topology.ts";

/**
 * How far a cill overhangs the unit on EACH side.
 *
 * Job 173 (all six items) and Job 172 print a 1100 mm cill under a 1000 mm
 * unit, on items whose add-on sits on every one of the four edges in turn — so
 * the cill is cut to `unit width + 2 × 50`, independent of the frame. `svg.ts`
 * draws the same overhang, so the drawing and the cut row agree.
 */
export const CILL_OVERHANG_MM = 50;

/**
 * Weld allowance per end for a transom that BREAKS THE FRAME (welded into the
 * two Y-notched jambs), as opposed to one welded between two cells.
 *
 * Job 173 p4 prints 984 for a 78 mm SPQ-5-30252 in a 975 mm frame — the frame's
 * full outer span plus 4.5 mm per end. The 4.5 is NOT derivable from any
 * catalog value or manual page (the frame face is 68, the transom face 78, and
 * 984 would need a 72.5 mm horn per end): it is the decomposition the owner
 * chose on 2026-07-30 out of the two that fit. Recorded in Spec/questions.md
 * Q25 — revisit if a second frame-split document ever appears.
 *
 * Only the T branch uses it. A frame-breaking Z transom keeps its Quotila
 * length (Job 85: 1206 = 1072 + 2 × 67) and the ordinary weld, because the
 * reference package contains no Z transom to supersede it.
 */
const FRAME_BREAK_WELD_MM = 4.5;

export function computeParts(
  geometry: SolvedGeometry,
  design: Design,
  system: ProfileSystem,
  widthMm: number,
  heightMm: number,
  /**
   * Global welding-shrinkage default (mm per welded end) from Settings. Each
   * profile uses its own `weldAllowanceMm` when > 0, else this. Defaults to 0
   * so direct (non-solve) callers stay byte-identical; `solve()` passes the
   * loaded setting. Mirrors the `computePricing(…, settings)` precedent.
   */
  weldDefaultMm: number = 0,
): SolvedParts {
  const bars: BarPiece[] = [];
  const reinforcement: BarPiece[] = [];
  const glass: GlassPiece[] = [];

  // The outer frame is built to `frameRect`, not the unit — an add-on (frame
  // extension) on an edge pushes it in by that profile's face (Job 169).
  // Absent ⇒ the frame fills the unit ⇒ these are widthMm/heightMm exactly.
  const frameW = geometry.frameRect?.w ?? widthMm;
  const frameH = geometry.frameRect?.h ?? heightMm;

  emitFrameBars(bars, reinforcement, geometry, design, system, frameW, frameH, weldDefaultMm);
  emitTransomBars(bars, reinforcement, geometry, system, weldDefaultMm);
  emitMullionBars(bars, reinforcement, geometry, system, weldDefaultMm);

  // Per-leaf-cell: sashes, beads, reinforcement-inside-sashes, glass.
  let glassIdx = 1;
  for (const cell of geometry.cells) {
    if (cell.sashKey && cell.sashOuter) {
      emitSashBars(bars, reinforcement, cell, system, weldDefaultMm);
    }
    emitBeadBars(bars, cell, system, weldDefaultMm);
    emitGlass(glass, cell, glassIdx++, system);
  }

  // Cill (window sill) — an external profile fitted below the frame, emitted as
  // a per-metre cut/BOM line. Source of truth is `geometry.cill` (attached by
  // solve() when a cill is selected). Square-cut, no welded ends.
  //
  // LENGTH = unit width + 100 (50 mm of overhang each side). Job 173 prints
  // `Hor Cill 150mm Cill 1 1100 [-]` on all six 1000 mm items AND on Job 172 —
  // unchanged whether the add-on sits on the left, right, top or bottom, so it
  // is the UNIT width it overhangs, not the (add-on-reduced) frame.
  if (geometry.cill) {
    const c = geometry.cill;
    const cillLen = round1(widthMm + 2 * CILL_OVERHANG_MM);
    const piece: BarPiece = withWeld({
      code: c.code,
      name: c.name,
      position: "Cill",
      orientation: "H",
      extMm: cillLen,
      intMm: cillLen,
      endPrep: "[ - ]",
    }, 0);
    // Cill steel — Job 173/172 fit a 35 × 15 (SPQ-2-83997) at the cill's OWN
    // length (1100) on every item, printed both in the cill row's Reinforcing
    // column and as its own `Hor Cill` section row.
    const r = reinforcementFor(system, c.code, cillLen);
    if (r) {
      piece.reinforcementCode = r.code;
      piece.reinforcementLengthMm = round1(cillLen - 2 * r.endClearance);
      reinforcement.push(withWeld({
        code: r.code,
        name: r.name,
        position: "Reinf for Cill",
        orientation: "H",
        extMm: piece.reinforcementLengthMm,
        intMm: piece.reinforcementLengthMm,
        endPrep: "[ - ]",
      }, effectiveWeld(r, weldDefaultMm)));
    }
    bars.push(piece);
  }

  // Sliding-patio auxiliary profiles (track + cover caps) — no-op unless the
  // geometry has sliding panels AND the system carries `auxiliaries`.
  emitSlidingAuxBars(bars, geometry, system, widthMm, heightMm);

  const gaskets = computeGaskets(geometry, system);

  return { bars, reinforcement, glass, gaskets, hardware: [] /* filled by hardware module */ };
}

// ---------------------------------------------------------------------
// SLIDING AUXILIARY PROFILES — slide track + cover caps, calibrated from
// Jobs 44 + 48 (patio-docs/, Andrei UK, 1900×2100 and 2210×2310; both exact):
//   AD16014      track (bottom)      = W − 95            ×1  (1805 / 2115)
//   GLIS17       frame channel cap   = H − 95            ×1  (2005 / 2215)
//   SPQ-GL-10253 frame slide cap     = H − 96 (=frameInt) ×1 + (W − 45) ×2
//                                                            (2004+1855×2 / 2214+2165×2)
//   SPQ-GL-20253 sash PVC cap        = panelExtH − 2     ×1 per panel (2012 / 2222)
//   AD55142      big frame cap (alu) = panelExtW − 99    ×1 per FIXED panel (850 / 1005)
//   GLIS16       fixed-panel cap     = panelExtW − 99    ×1 per FIXED panel (850 / 1005)
// Per-FIXED-panel quantities and the ×2 (W − 45) pieces are derived from
// 2-panel docs only (1 slider + 1 fixed each) — re-verify against a 3/4-panel
// doc when one is available. All square-cut, never welded.
// ---------------------------------------------------------------------
function emitSlidingAuxBars(
  bars: BarPiece[],
  geom: SolvedGeometry,
  system: ProfileSystem,
  W: number,
  H: number,
): void {
  const aux = system.auxiliaries;
  if (!aux) return;
  const panels = geom.cells.filter(
    (c) => c.content.startsWith("sliding") && c.sashOuter,
  );
  if (panels.length === 0) return;

  const push = (key: string, position: string, orientation: "H" | "V", len: number) => {
    const a = aux[key];
    if (!a) return; // part not in the catalog ⇒ skip the row (never guess)
    bars.push(withWeld({
      code: a.code,
      name: a.name,
      position,
      orientation,
      extMm: round1(len),
      intMm: round1(len),
      endPrep: "[ - ]",
    }, 0));
  };

  push("aux-track-alu",         "Slide track bottom",   "H", W - 95);
  push("aux-cap-frame-channel", "Frame channel cap",    "V", H - 95);
  push("aux-cap-frame-slide",   "Frame slide cap jamb", "V", H - 96);
  push("aux-cap-frame-slide",   "Frame slide cap head", "H", W - 45);
  push("aux-cap-frame-slide",   "Frame slide cap sill", "H", W - 45);

  panels.forEach((c, i) => {
    const p = c.sashOuter!;
    push("aux-cap-sash-pvc", `Sash PVC cap panel ${i + 1}`, "V", p.h - 2);
    if (c.content === "sliding-fixed") {
      push("aux-cap-frame-alu",   `Big frame cap (fixed panel ${i + 1})`, "H", p.w - 99);
      push("aux-cap-fixed-panel", `Fixed-panel cap (panel ${i + 1})`,     "H", p.w - 99);
    }
  });
}

// ---------------------------------------------------------------------
// FRAME — 4 mitered bars, or 6 pieces if a root Z-transom breaks the jambs
// ---------------------------------------------------------------------
function emitFrameBars(
  bars: BarPiece[],
  reinf: BarPiece[],
  geom: SolvedGeometry,
  design: Design,
  system: ProfileSystem,
  W: number,
  H: number,
  weldDefaultMm: number,
): void {
  // A frame profile per edge (the reference's four Frame (Standard) rows; Job
  // 169 prints all four). Every design today names one profile, so all four
  // resolve to it and every length below is the historical `W − 2 × fw` form.
  const frames = framesForEdges(design, system);
  const wd = weldDefaultMm;
  // A bar's Int loses the face of the profile at EACH of its two ends — which
  // are the perpendicular edges, not its own.
  const horInt = W - frames.left.faceWidth - frames.right.faceWidth;
  const vertInt = H - frames.top.faceWidth - frames.bottom.faceWidth;

  const pieces: BarPiece[] = [];

  // Top & bottom — always continuous, fully mitered.
  pieces.push(barFrame(frames.top,    "Frame top",    W, horInt, "H", "\\ - /", wd));
  pieces.push(barFrame(frames.bottom, "Frame bottom", W, horInt, "H", "\\ - /", wd));

  if (geom.jambsBrokenAtY !== undefined) {
    // `jambsBrokenAtY` is an absolute y in unit coordinates; the jamb pieces are
    // measured from the FRAME's top edge (identical without an add-on, where the
    // frame starts at y = 0).
    const splitY = geom.jambsBrokenAtY - (geom.frameRect?.y ?? 0);
    // Top piece: miter at the frame corner (the head's face), Y-notch where the
    // transom welds in. Length Ext = splitY (raw cut goes from the frame's top
    // edge to the transom centerline). Int = Ext − the mitred end's face only
    // (a Y-notch costs no length).
    const topPieceExt = splitY;
    const topPieceInt = splitY - frames.top.faceWidth;
    const bottomPieceExt = H - splitY;
    const bottomPieceInt = (H - splitY) - frames.bottom.faceWidth;

    pieces.push(barFrame(frames.left,  "Frame left top",     topPieceExt,    topPieceInt,    "V", "\\ - Y]", wd));
    pieces.push(barFrame(frames.left,  "Frame left bottom",  bottomPieceExt, bottomPieceInt, "V", "[Y - /", wd));
    pieces.push(barFrame(frames.right, "Frame right top",    topPieceExt,    topPieceInt,    "V", "\\ - Y]", wd));
    pieces.push(barFrame(frames.right, "Frame right bottom", bottomPieceExt, bottomPieceInt, "V", "[Y - /", wd));
  } else {
    // Continuous jambs (Job 88 / Job 90 style)
    pieces.push(barFrame(frames.left,  "Frame left",  H, vertInt, "V", "\\ - /", wd));
    pieces.push(barFrame(frames.right, "Frame right", H, vertInt, "V", "\\ - /", wd));
  }

  // Frame reinforcement (none in your data — left as a hook). Keyed off each
  // piece's OWN code, so a mixed-profile frame reinforces each edge correctly.
  for (const b of pieces) {
    const r = reinforcementFor(system, b.code, b.intMm);
    if (r) {
      reinf.push(withWeld({
        code: r.code,
        name: r.name,
        position: `Reinf for ${b.position}`,
        orientation: b.orientation,
        extMm: b.intMm - 2 * r.endClearance,
        intMm: b.intMm - 2 * r.endClearance,
        endPrep: "[ - ]",
      }, effectiveWeld(r, weldDefaultMm)));
    }
  }

  bars.push(...pieces);
}

/**
 * The reinforcement for a profile code, IF this particular bar is long enough
 * to take it.
 *
 * The manual reinforces the lighter dividers only on long runs (HAWDIO p17/PDF
 * 18; recorded under "Master PDF findings" in CLAUDE.md), and Job 169 shows the
 * rule in production: its 78 mm SPQ-5-30252 divider carries 26×26 U steel at
 * Int 1710 (pages 3 and 5) and none at Int 685/710 (pages 1, 2 and 4).
 *
 * A reinforcement without `minBarLengthMm` is always fitted — which is every
 * entry the casement / French / sliding jobs use, so they are byte-identical.
 */
function reinforcementFor(
  system: ProfileSystem,
  profileCode: string,
  barIntMm: number,
): Reinforcement | undefined {
  const key = system.reinforcementMap[profileCode];
  if (!key) return undefined;
  const r = system.reinforcement[key];
  if (r?.minBarLengthMm !== undefined && barIntMm < r.minBarLengthMm) return undefined;
  return r;
}

function barFrame(
  frame: any,
  position: string,
  ext: number,
  int: number,
  orientation: "H" | "V",
  endPrep: string,
  weldDefaultMm: number,
): BarPiece {
  return withWeld(
    {
      code: frame.code,
      name: frame.name,
      position,
      orientation,
      extMm: round1(ext),
      intMm: round1(int),
      endPrep,
    },
    effectiveWeld(frame, weldDefaultMm),
  );
}

// ---------------------------------------------------------------------
// TRANSOMS
// ---------------------------------------------------------------------
function emitTransomBars(bars: BarPiece[], reinf: BarPiece[], geom: SolvedGeometry, system: ProfileSystem, weldDefaultMm: number): void {
  for (const t of geom.transoms) {
    const profile = system.transoms[t.transomKey];
    // A frame-breaking T transom welds into the two Y-notched jambs rather than
    // between two cells, and takes a bigger allowance than a mitre: Job 173 p4
    // prints 984 over a 975 mm frame span. See FRAME_BREAK_WELD_MM.
    const weld = t.breaksFrame && t.jointType === "T"
      ? FRAME_BREAK_WELD_MM
      : effectiveWeld(profile, weldDefaultMm);
    const piece: BarPiece = withWeld({
      code: profile.code,
      name: profile.name,
      position: `Transom (${t.parentPathId})`,
      orientation: "H",
      extMm: round1(t.extLengthMm),
      intMm: round1(t.intLengthMm),
      endPrep: "< - >",
    }, weld);
    // Reinforcement (e.g. Job 85: Z-transom gets 13x29 steel), skipped on runs
    // below the profile's printed minimum (Job 169 pages 1/2/4).
    const r = reinforcementFor(system, profile.code, t.intLengthMm);
    if (r) {
      piece.reinforcementCode = r.code;
      piece.reinforcementLengthMm = round1(t.intLengthMm - 2 * r.endClearance);
      reinf.push(withWeld({
        code: r.code,
        name: r.name,
        position: `Reinf for ${piece.position}`,
        orientation: "H",
        extMm: piece.reinforcementLengthMm,
        intMm: piece.reinforcementLengthMm,
        endPrep: "[ - ]",
      }, effectiveWeld(r, weldDefaultMm)));
    }
    bars.push(piece);
  }
}

// ---------------------------------------------------------------------
// MULLIONS
// ---------------------------------------------------------------------
function emitMullionBars(bars: BarPiece[], reinf: BarPiece[], geom: SolvedGeometry, system: ProfileSystem, weldDefaultMm: number): void {
  for (const m of geom.mullions) {
    const profile = system.transoms[m.mullionKey];
    // S-type (STULP / French mullion, Job 00000264): square-cut "[ - ]", no
    // welded horns (0 welded ends ⇒ no weld compensation — printed 2004 exact).
    const piece: BarPiece = withWeld({
      code: profile.code,
      name: profile.name,
      position: `Mullion (${m.parentPathId})`,
      orientation: "V",
      extMm: round1(m.extLengthMm),
      intMm: round1(m.intLengthMm),
      endPrep: profile.jointType === "S" ? "[ - ]" : "< - >",
    }, effectiveWeld(profile, weldDefaultMm));
    const r = reinforcementFor(system, profile.code, m.intLengthMm);
    if (r) {
      piece.reinforcementCode = r.code;
      piece.reinforcementLengthMm = round1(m.intLengthMm - 2 * r.endClearance);
      reinf.push(withWeld({
        code: r.code,
        name: r.name,
        position: `Reinf for ${piece.position}`,
        orientation: "V",
        extMm: piece.reinforcementLengthMm,
        intMm: piece.reinforcementLengthMm,
        endPrep: "[ - ]",
      }, effectiveWeld(r, weldDefaultMm)));
    }
    bars.push(piece);
  }
}

// ---------------------------------------------------------------------
// SASH BARS — 4 mitered pieces per opening sash. Reinforcement = bar Int.
// ---------------------------------------------------------------------
function emitSashBars(bars: BarPiece[], reinf: BarPiece[], cell: SolvedCell, system: ProfileSystem, weldDefaultMm: number): void {
  const sash = system.sashes[cell.sashKey!];
  const so = cell.sashOuter!;
  const fw = sash.faceWidth;
  const intW = so.w - 2 * fw;
  const intH = so.h - 2 * fw;

  const wa = effectiveWeld(sash, weldDefaultMm);
  const pieces: BarPiece[] = [
    withWeld({ code: sash.code, name: sash.name, position: `Sash ${cell.pathId} head`,  orientation: "H", extMm: round1(so.w), intMm: round1(intW), endPrep: "\\ - /" }, wa),
    withWeld({ code: sash.code, name: sash.name, position: `Sash ${cell.pathId} sill`,  orientation: "H", extMm: round1(so.w), intMm: round1(intW), endPrep: "\\ - /" }, wa),
    withWeld({ code: sash.code, name: sash.name, position: `Sash ${cell.pathId} left`,  orientation: "V", extMm: round1(so.h), intMm: round1(intH), endPrep: "\\ - /" }, wa),
    withWeld({ code: sash.code, name: sash.name, position: `Sash ${cell.pathId} right`, orientation: "V", extMm: round1(so.h), intMm: round1(intH), endPrep: "\\ - /" }, wa),
  ];

  // Reinforcement for every sash bar — always required in your system.
  for (const p of pieces) {
    const r = reinforcementFor(system, sash.code, p.intMm);
    if (r) {
      const reinfLen = p.intMm - 2 * r.endClearance;
      p.reinforcementCode = r.code;
      p.reinforcementLengthMm = round1(reinfLen);
      reinf.push(withWeld({
        code: r.code,
        name: r.name,
        position: `Reinf for ${p.position}`,
        orientation: p.orientation,
        extMm: round1(reinfLen),
        intMm: round1(reinfLen),
        endPrep: "[ - ]",
      }, effectiveWeld(r, weldDefaultMm)));
    }
  }
  bars.push(...pieces);
}

// ---------------------------------------------------------------------
// BEADS — frames the glass opening on every cell.
//   bead Int = sash inner (or cell daylight for fixed)
//   bead Ext = Int + 2 × bead face (20mm in your system)
// ---------------------------------------------------------------------
function emitBeadBars(bars: BarPiece[], cell: SolvedCell, system: ProfileSystem, weldDefaultMm: number): void {
  const bead = system.beads[cell.beadKey];
  const bf = bead.faceWidth;
  const intW = cell.beadIntW;
  const intH = cell.beadIntH;

  // Beads are square-cut (0 welded ends) so this is multiplied by 0 anyway.
  const wa = effectiveWeld(bead, weldDefaultMm);
  bars.push(
    withWeld({ code: bead.code, name: bead.name, position: `Bead ${cell.pathId} top`,    orientation: "H", extMm: round1(intW + 2 * bf), intMm: round1(intW), endPrep: "[ - ]" }, wa),
    withWeld({ code: bead.code, name: bead.name, position: `Bead ${cell.pathId} bottom`, orientation: "H", extMm: round1(intW + 2 * bf), intMm: round1(intW), endPrep: "[ - ]" }, wa),
    withWeld({ code: bead.code, name: bead.name, position: `Bead ${cell.pathId} left`,   orientation: "V", extMm: round1(intH + 2 * bf), intMm: round1(intH), endPrep: "[ - ]" }, wa),
    withWeld({ code: bead.code, name: bead.name, position: `Bead ${cell.pathId} right`,  orientation: "V", extMm: round1(intH + 2 * bf), intMm: round1(intH), endPrep: "[ - ]" }, wa),
  );
}

// ---------------------------------------------------------------------
// GLASS — sits in rebate behind the bead.
//   For sash cell:  glass = bead Int + 2 × sash.glassRebate
//   For fixed cell: glass = bead Int + 2 × frame.glassRebate
// ---------------------------------------------------------------------
function emitGlass(glass: GlassPiece[], cell: SolvedCell, idx: number, system: ProfileSystem): void {
  const g = system.glass[cell.glassKey];
  const widthMm = round1(cell.glassRect.w);
  const heightMm = round1(cell.glassRect.h);
  glass.push({
    code: g.code,
    name: g.name,
    label: `${String(idx).padStart(2, "0")} (Frame-${cell.pathId})`,
    widthMm,
    heightMm,
    areaM2: round3((widthMm * heightMm) / 1_000_000),
  });
}

// ---------------------------------------------------------------------
// GASKETS — verified totals across all three jobs.
//   Gasket 01 = 2 × Σ sash outer perimeter   (weather seal both sides)
//   Gasket 02 = Σ glass perimeter            (glazing seal once around)
//
// FRENCH DOOR leaves (calibrated Job 00000264) use their OWN gaskets and are
// EXCLUDED from Gasket 01/02 (the production docs list only these two):
//   gasket-fm   (SP_GSKFM) = Σ French-mullion lengths          (printed 2004)
//   gasket-sash (SP_S001)  = Σ per leaf: sash outer perimeter +
//                            leaf daylight perimeter           (printed 22576)
// ---------------------------------------------------------------------
function computeGaskets(geom: SolvedGeometry, system: ProfileSystem): GasketPiece[] {
  let sashPerim = 0;
  let glassPerim = 0;
  let frenchSashGasket = 0;
  let frenchMullionGasket = 0;

  for (const c of geom.cells) {
    if (c.content.startsWith("french-door")) {
      // Leaf-level seals only (pane cells carry no sashOuter → not counted).
      if (c.sashOuter) {
        frenchSashGasket +=
          2 * (c.sashOuter.w + c.sashOuter.h) + 2 * (c.daylight.w + c.daylight.h);
      }
      continue;
    }
    if (c.sashOuter) {
      sashPerim += 2 * (c.sashOuter.w + c.sashOuter.h);
    }
    glassPerim += 2 * (c.glassRect.w + c.glassRect.h);
  }

  for (const m of geom.mullions) {
    if (m.jointType === "S") frenchMullionGasket += m.intLengthMm;
  }

  const g1 = system.gaskets["gasket-01"];
  const g2 = system.gaskets["gasket-02"];
  const out: GasketPiece[] = [
    { code: g1.code, name: g1.name, lengthMm: round1(2 * sashPerim) },
    { code: g2.code, name: g2.name, lengthMm: round1(glassPerim) },
  ];

  const gfm = system.gaskets["gasket-fm"];
  if (gfm && frenchMullionGasket > 0) {
    out.push({ code: gfm.code, name: gfm.name, lengthMm: round1(frenchMullionGasket) });
  }
  const gsash = system.gaskets["gasket-sash"];
  if (gsash && frenchSashGasket > 0) {
    out.push({ code: gsash.code, name: gsash.name, lengthMm: round1(frenchSashGasket) });
  }

  return out;
}

// ---------- Helpers --------------------------------------------------
function round1(n: number): number { return Math.round(n * 10) / 10; }
function round3(n: number): number { return Math.round(n * 1000) / 1000; }

/**
 * Count the welded ends of a bar from its end-prep notation. A miter ("\"/"/")
 * or a horn ("<"/">") end is welded; a Y-notch ("Y]"/"[Y") butts into the mating
 * profile (no length-bearing weld here) and a square cut ("[ ]") is snapped/inserted.
 *   "\ - /"  → 2   (frame & sash corners, both welded)
 *   "< - >"  → 2   (transom/mullion horns, both welded)
 *   "\ - Y]" → 1   (Z-broken jamb: miter welded, Y-notch not)
 *   "[Y - /" → 1
 *   "[ - ]"  → 0   (bead, reinforcement)
 */
export function weldedEnds(endPrep: string): number {
  let n = 0;
  // A Y-notch is a welded joint too — the jamb piece welds onto the transom
  // that broke it, so it shrinks at that end like any other. Job 173 p4 prints
  // 405 + 1575 for jamb pieces measuring 400 + 1570 to the transom centreline:
  // 2 × 2.5 mm on EACH piece, not one.
  if (/^[\\/]|^<|^\[Y/.test(endPrep)) n++;   // left/outer end is a miter, horn or Y-notch
  if (/[\\/]$|>$|Y\]$/.test(endPrep)) n++;   // right/inner end is a miter, horn or Y-notch
  return n;
}

/**
 * The weld allowance actually applied to a profile's pieces: the profile's own
 * `weldAllowanceMm` when set (> 0), otherwise the global `Settings` default.
 * So a per-profile 0 means "inherit the global". (Non-welded pieces get 0 welded
 * ends from their end-prep, so the value is multiplied by 0 and never matters.)
 */
function effectiveWeld(profile: { weldAllowanceMm: number }, weldDefaultMm: number): number {
  return profile.weldAllowanceMm > 0 ? profile.weldAllowanceMm : weldDefaultMm;
}

/** A bar piece before its welding-compensation fields are computed. */
type RawBar = Omit<BarPiece, "weldedExtMm" | "weldedEndCount">;

/**
 * Finalise a piece by adding its welding-shrinkage compensation. The saw must
 * cut longer by `weldAllowanceMm` at each welded end so the welded assembly
 * shrinks back to the finished (Ext) size. allowanceMm = 0 ⇒ weldedExtMm === extMm.
 */
function withWeld(piece: RawBar, allowanceMm: number): BarPiece {
  const ends = weldedEnds(piece.endPrep);
  return {
    ...piece,
    weldedEndCount: ends,
    weldedExtMm: round1(piece.extMm + allowanceMm * ends),
  };
}
