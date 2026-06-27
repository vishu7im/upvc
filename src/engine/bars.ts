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
  SolvedCell,
  SolvedGeometry,
  SolvedParts,
} from "../types.ts";

export function computeParts(
  geometry: SolvedGeometry,
  design: Design,
  system: ProfileSystem,
  widthMm: number,
  heightMm: number,
): SolvedParts {
  const bars: BarPiece[] = [];
  const reinforcement: BarPiece[] = [];
  const glass: GlassPiece[] = [];

  emitFrameBars(bars, reinforcement, geometry, design, system, widthMm, heightMm);
  emitTransomBars(bars, reinforcement, geometry, system);
  emitMullionBars(bars, reinforcement, geometry, system);

  // Per-leaf-cell: sashes, beads, reinforcement-inside-sashes, glass.
  let glassIdx = 1;
  for (const cell of geometry.cells) {
    if (cell.sashKey && cell.sashOuter) {
      emitSashBars(bars, reinforcement, cell, system);
    }
    emitBeadBars(bars, cell, system);
    emitGlass(glass, cell, glassIdx++, system);
  }

  const gaskets = computeGaskets(geometry, system);

  return { bars, reinforcement, glass, gaskets, hardware: [] /* filled by hardware module */ };
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
): void {
  const frame = system.frames[design.frameKey];
  const fw = frame.faceWidth;

  // Top & bottom — always continuous, fully mitered.
  bars.push(barFrame(frame, "Frame top",    W, W - 2 * fw, "H", "\\ - /"));
  bars.push(barFrame(frame, "Frame bottom", W, W - 2 * fw, "H", "\\ - /"));

  if (geom.jambsBrokenAtY !== undefined) {
    const splitY = geom.jambsBrokenAtY;
    // Top piece: miter at frame corner, Y-notch where the transom welds in.
    // Length Ext = splitY (raw cut goes from y=0 to the transom centerline).
    // Int = Ext - frame face (only ONE miter loss; Y-notch has no length loss).
    const topPieceExt = splitY;
    const topPieceInt = splitY - fw;
    const bottomPieceExt = H - splitY;
    const bottomPieceInt = (H - splitY) - fw;

    bars.push(barFrame(frame, "Frame left top",     topPieceExt,    topPieceInt,    "V", "\\ - Y]"));
    bars.push(barFrame(frame, "Frame left bottom",  bottomPieceExt, bottomPieceInt, "V", "[Y - /"));
    bars.push(barFrame(frame, "Frame right top",    topPieceExt,    topPieceInt,    "V", "\\ - Y]"));
    bars.push(barFrame(frame, "Frame right bottom", bottomPieceExt, bottomPieceInt, "V", "[Y - /"));
  } else {
    // Continuous jambs (Job 88 / Job 90 style)
    bars.push(barFrame(frame, "Frame left",  H, H - 2 * fw, "V", "\\ - /"));
    bars.push(barFrame(frame, "Frame right", H, H - 2 * fw, "V", "\\ - /"));
  }

  // Frame reinforcement (none in your data — left as a hook).
  const reinfKey = system.reinforcementMap[frame.code];
  if (reinfKey) {
    const r = system.reinforcement[reinfKey];
    bars.forEach((b) => {
      if (b.code === frame.code) {
        reinf.push(withWeld({
          code: r.code,
          name: r.name,
          position: `Reinf for ${b.position}`,
          orientation: b.orientation,
          extMm: b.intMm - 2 * r.endClearance,
          intMm: b.intMm - 2 * r.endClearance,
          endPrep: "[ - ]",
        }, r.weldAllowanceMm));
      }
    });
  }
}

function barFrame(
  frame: any,
  position: string,
  ext: number,
  int: number,
  orientation: "H" | "V",
  endPrep: string,
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
    frame.weldAllowanceMm ?? 0,
  );
}

// ---------------------------------------------------------------------
// TRANSOMS
// ---------------------------------------------------------------------
function emitTransomBars(bars: BarPiece[], reinf: BarPiece[], geom: SolvedGeometry, system: ProfileSystem): void {
  for (const t of geom.transoms) {
    const profile = system.transoms[t.transomKey];
    const piece: BarPiece = withWeld({
      code: profile.code,
      name: profile.name,
      position: `Transom (${t.parentPathId})`,
      orientation: "H",
      extMm: round1(t.extLengthMm),
      intMm: round1(t.intLengthMm),
      endPrep: "< - >",
    }, profile.weldAllowanceMm);
    // Reinforcement (e.g. Job 85: Z-transom gets 13x29 steel)
    const reinfKey = system.reinforcementMap[profile.code];
    if (reinfKey) {
      const r = system.reinforcement[reinfKey];
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
      }, r.weldAllowanceMm));
    }
    bars.push(piece);
  }
}

// ---------------------------------------------------------------------
// MULLIONS
// ---------------------------------------------------------------------
function emitMullionBars(bars: BarPiece[], reinf: BarPiece[], geom: SolvedGeometry, system: ProfileSystem): void {
  for (const m of geom.mullions) {
    const profile = system.transoms[m.mullionKey];
    const piece: BarPiece = withWeld({
      code: profile.code,
      name: profile.name,
      position: `Mullion (${m.parentPathId})`,
      orientation: "V",
      extMm: round1(m.extLengthMm),
      intMm: round1(m.intLengthMm),
      endPrep: "< - >",
    }, profile.weldAllowanceMm);
    const reinfKey = system.reinforcementMap[profile.code];
    if (reinfKey) {
      const r = system.reinforcement[reinfKey];
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
      }, r.weldAllowanceMm));
    }
    bars.push(piece);
  }
}

// ---------------------------------------------------------------------
// SASH BARS — 4 mitered pieces per opening sash. Reinforcement = bar Int.
// ---------------------------------------------------------------------
function emitSashBars(bars: BarPiece[], reinf: BarPiece[], cell: SolvedCell, system: ProfileSystem): void {
  const sash = system.sashes[cell.sashKey!];
  const so = cell.sashOuter!;
  const fw = sash.faceWidth;
  const intW = so.w - 2 * fw;
  const intH = so.h - 2 * fw;

  const wa = sash.weldAllowanceMm;
  const pieces: BarPiece[] = [
    withWeld({ code: sash.code, name: sash.name, position: `Sash ${cell.pathId} head`,  orientation: "H", extMm: round1(so.w), intMm: round1(intW), endPrep: "\\ - /" }, wa),
    withWeld({ code: sash.code, name: sash.name, position: `Sash ${cell.pathId} sill`,  orientation: "H", extMm: round1(so.w), intMm: round1(intW), endPrep: "\\ - /" }, wa),
    withWeld({ code: sash.code, name: sash.name, position: `Sash ${cell.pathId} left`,  orientation: "V", extMm: round1(so.h), intMm: round1(intH), endPrep: "\\ - /" }, wa),
    withWeld({ code: sash.code, name: sash.name, position: `Sash ${cell.pathId} right`, orientation: "V", extMm: round1(so.h), intMm: round1(intH), endPrep: "\\ - /" }, wa),
  ];

  // Reinforcement for every sash bar — always required in your system.
  const reinfKey = system.reinforcementMap[sash.code];
  if (reinfKey) {
    const r = system.reinforcement[reinfKey];
    for (const p of pieces) {
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
      }, r.weldAllowanceMm));
    }
  }
  bars.push(...pieces);
}

// ---------------------------------------------------------------------
// BEADS — frames the glass opening on every cell.
//   bead Int = sash inner (or cell daylight for fixed)
//   bead Ext = Int + 2 × bead face (20mm in your system)
// ---------------------------------------------------------------------
function emitBeadBars(bars: BarPiece[], cell: SolvedCell, system: ProfileSystem): void {
  const bead = system.beads[cell.beadKey];
  const bf = bead.faceWidth;
  const intW = cell.beadIntW;
  const intH = cell.beadIntH;

  const wa = bead.weldAllowanceMm; // 0 — beads are not welded
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
// ---------------------------------------------------------------------
function computeGaskets(geom: SolvedGeometry, system: ProfileSystem): GasketPiece[] {
  let sashPerim = 0;
  let glassPerim = 0;

  for (const c of geom.cells) {
    if (c.sashOuter) {
      sashPerim += 2 * (c.sashOuter.w + c.sashOuter.h);
    }
    glassPerim += 2 * (c.glassRect.w + c.glassRect.h);
  }

  const g1 = system.gaskets["gasket-01"];
  const g2 = system.gaskets["gasket-02"];
  return [
    { code: g1.code, name: g1.name, lengthMm: round1(2 * sashPerim) },
    { code: g2.code, name: g2.name, lengthMm: round1(glassPerim) },
  ];
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
function weldedEnds(endPrep: string): number {
  let n = 0;
  if (/^[\\/]|^</.test(endPrep)) n++;   // left/outer end is a miter or horn
  if (/[\\/]$|>$/.test(endPrep)) n++;   // right/inner end is a miter or horn
  return n;
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
