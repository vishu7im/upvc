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

  emitFrameBars(bars, reinforcement, geometry, design, system, widthMm, heightMm, weldDefaultMm);
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

  // Cill (window sill) — an external profile spanning the full product width,
  // emitted as a per-metre cut/BOM line. Source of truth is `geometry.cill`
  // (attached by solve() when a cill is selected). Square-cut, no welded ends.
  if (geometry.cill) {
    const c = geometry.cill;
    bars.push(withWeld({
      code: c.code,
      name: c.name,
      position: "Cill",
      orientation: "H",
      extMm: round1(widthMm),
      intMm: round1(widthMm),
      endPrep: "[ - ]",
    }, 0));
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
  weldDefaultMm: number,
): void {
  const frame = system.frames[design.frameKey];
  const fw = frame.faceWidth;
  const wd = weldDefaultMm;

  // Top & bottom — always continuous, fully mitered.
  bars.push(barFrame(frame, "Frame top",    W, W - 2 * fw, "H", "\\ - /", wd));
  bars.push(barFrame(frame, "Frame bottom", W, W - 2 * fw, "H", "\\ - /", wd));

  if (geom.jambsBrokenAtY !== undefined) {
    const splitY = geom.jambsBrokenAtY;
    // Top piece: miter at frame corner, Y-notch where the transom welds in.
    // Length Ext = splitY (raw cut goes from y=0 to the transom centerline).
    // Int = Ext - frame face (only ONE miter loss; Y-notch has no length loss).
    const topPieceExt = splitY;
    const topPieceInt = splitY - fw;
    const bottomPieceExt = H - splitY;
    const bottomPieceInt = (H - splitY) - fw;

    bars.push(barFrame(frame, "Frame left top",     topPieceExt,    topPieceInt,    "V", "\\ - Y]", wd));
    bars.push(barFrame(frame, "Frame left bottom",  bottomPieceExt, bottomPieceInt, "V", "[Y - /", wd));
    bars.push(barFrame(frame, "Frame right top",    topPieceExt,    topPieceInt,    "V", "\\ - Y]", wd));
    bars.push(barFrame(frame, "Frame right bottom", bottomPieceExt, bottomPieceInt, "V", "[Y - /", wd));
  } else {
    // Continuous jambs (Job 88 / Job 90 style)
    bars.push(barFrame(frame, "Frame left",  H, H - 2 * fw, "V", "\\ - /", wd));
    bars.push(barFrame(frame, "Frame right", H, H - 2 * fw, "V", "\\ - /", wd));
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
        }, effectiveWeld(r, weldDefaultMm)));
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
    const piece: BarPiece = withWeld({
      code: profile.code,
      name: profile.name,
      position: `Transom (${t.parentPathId})`,
      orientation: "H",
      extMm: round1(t.extLengthMm),
      intMm: round1(t.intLengthMm),
      endPrep: "< - >",
    }, effectiveWeld(profile, weldDefaultMm));
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
function weldedEnds(endPrep: string): number {
  let n = 0;
  if (/^[\\/]|^</.test(endPrep)) n++;   // left/outer end is a miter or horn
  if (/[\\/]$|>$/.test(endPrep)) n++;   // right/inner end is a miter or horn
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
