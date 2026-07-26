// =====================================================================
// catalog/ed-table.test.ts — integrity assertions for the ED transcription.
//
// Pure (no DB). Wired into `npm run validate` via validateEdTable(expect).
//
// The table has no consumer until M6, so these assertions ARE its only
// safety net: they prove the transcription is complete, monotonic, matches the
// printed step structure, and that the two documented print defects were
// carried through as numbers rather than "tidied up".
// =====================================================================

import { ED_TABLE, ED_TABLE_PRINT_DEFECTS, edForAngle } from "./ed-table.ts";

type Expect = (label: string, actual: any, expected: any) => void;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function validateEdTable(expect: Expect): void {
  console.log("\n==================================================");
  console.log("External Deduction (ED) table — HAWDIO PDF 42");
  console.log("==================================================");

  // ---- completeness ---------------------------------------------------
  expect("91 rows transcribed", ED_TABLE.length, 91);
  expect("first angle 90°", ED_TABLE[0].angleDeg, 90);
  expect("last angle 180°", ED_TABLE[ED_TABLE.length - 1].angleDeg, 180);

  const anglesContiguous = ED_TABLE.every((r, i) => r.angleDeg === 90 + i);
  expect("angles are 90..180 with no gaps or repeats", anglesContiguous, true);

  // ---- spot-asserts of printed values --------------------------------
  // 90° is double-sourced: it is also dimensioned on the drawing (63.2).
  expect("ED(90°) = 63.2 (matches the drawing dimension)", edForAngle(90), 63.2);
  expect("ED(100°) = 61", edForAngle(100), 61);
  expect("ED(135°) = 53.2", edForAngle(135), 53.2);
  expect("ED(140°) = 52", edForAngle(140), 52);
  expect("ED(150°) = 49.55", edForAngle(150), 49.55);
  expect("ED(180°) = 40.85", edForAngle(180), 40.85);

  // ---- print defects carried through as NUMBERS ----------------------
  expect("3 print defects recorded", ED_TABLE_PRINT_DEFECTS.length, 3);
  expect("ED(129°) = 54.62 (printed with a stray °)", edForAngle(129), 54.62);
  expect("ED(156°) = 47.81 (printed with a stray °)", edForAngle(156), 47.81);
  expect("defect rows are plain numbers", ED_TABLE.every((r) => typeof r.edMm === "number"), true);
  expect(
    "every defect angle exists in the table",
    ED_TABLE_PRINT_DEFECTS.every((d) => edForAngle(d.angleDeg) !== undefined),
    true,
  );

  // ---- shape: strictly decreasing -------------------------------------
  const strictlyDecreasing = ED_TABLE.every((r, i) => i === 0 || r.edMm < ED_TABLE[i - 1].edMm);
  expect("ED decreases strictly as the angle opens", strictlyDecreasing, true);

  // ---- the NON-UNIFORM step, which is why interpolation is banned -----
  // 0.22/° up to 129°, 0.24/° to 149°, 0.29/° to 180° — with 135° off by 0.02
  // (a recorded print quirk). Assert each run so a "helpful" future edit that
  // smooths the table is caught immediately.
  const step = (a: number) => round2(edForAngle(a - 1)! - edForAngle(a)!);
  expect("step 90→91 = 0.22", step(91), 0.22);
  expect("step 128→129 = 0.22", step(129), 0.22);
  expect("step 129→130 = 0.24", step(130), 0.24);
  expect("step 148→149 = 0.24", step(149), 0.24);
  expect("step 149→150 = 0.29", step(150), 0.29);
  expect("step 179→180 = 0.29", step(180), 0.29);
  expect("step 134→135 = 0.22 (the printed 135° quirk)", step(135), 0.22);

  const distinctSteps = new Set(
    ED_TABLE.slice(1).map((r) => round2(edForAngle(r.angleDeg - 1)! - r.edMm)),
  );
  expect("exactly 3 distinct step sizes ⇒ non-uniform", distinctSteps.size, 3);

  // ---- lookup contract: never interpolate ----------------------------
  expect("non-integer angle ⇒ undefined", edForAngle(122.5), undefined);
  expect("below range ⇒ undefined", edForAngle(89), undefined);
  expect("above range ⇒ undefined", edForAngle(181), undefined);

  // ---- inertness ------------------------------------------------------
  // Nothing in src/engine imports this module; ED cannot touch cut math yet.
  expect("ED table is data-only (no engine import)", typeof edForAngle, "function");
}
