// =====================================================================
// designer/rules.test.ts — exhaustive rule-DSL assertions.
//
// Pure unit test (no DB). Wired into `npm run validate` via
// validateRules(expect), like the limits/pricing/svg suites.
//
// Coverage bar (phase-1 acceptance): EVERY operator in the language, nesting,
// operand-path resolution, and the fail-loud contract — an unknown operator or
// a malformed node must THROW, never evaluate to false. A silently-false rule
// would hide a fabrication constraint, which is exactly what §6 forbids.
// =====================================================================

import { RuleError, assertValidRule, evalRule, resolveOperand } from "./rules.ts";
import type { Rule, RuleContext } from "./option-types.ts";

type Expect = (label: string, actual: any, expected: any) => void;

const CTX: RuleContext = {
  item: { family: "casement-window", system: "sunnyplast-70", widthMm: 1200, heightMm: 1500 },
  component: { type: "sash", kind: "casement-side-left", widthMm: 728, heightMm: 1342, areaM2: 0.977 },
  selection: {
    "glazing.method": "glazed",
    "profile.cill": "cill-150-white",
    "placement.location": "Kitchen",
    "general.drainage": null,
  },
};

/** Item-level context: any `component.*` path must throw here. */
const ITEM_CTX: RuleContext = { item: CTX.item, selection: CTX.selection };

/** True iff evaluating the rule throws a RuleError. */
function throws(rule: unknown): boolean {
  try {
    evalRule(rule as Rule, CTX);
    return false;
  } catch (err) {
    return err instanceof RuleError;
  }
}

export function validateRules(expect: Expect): void {
  console.log("\n==================================================");
  console.log("Designer rule DSL (option-schema.md §6)");
  console.log("==================================================");

  // ---- 1. Operand resolution ---------------------------------------
  expect("path item.family resolves", resolveOperand("item.family", CTX), "casement-window");
  expect("path item.widthMm resolves", resolveOperand("item.widthMm", CTX), 1200);
  expect("path component.type resolves", resolveOperand("component.type", CTX), "sash");
  expect("path component.areaM2 resolves", resolveOperand("component.areaM2", CTX), 0.977);
  expect("path selection.<key> resolves", resolveOperand("selection.glazing.method", CTX), "glazed");
  expect(
    "unanswered selection ⇒ undefined (not a throw)",
    resolveOperand("selection.nothing.here", CTX),
    undefined,
  );
  expect("plain string is a literal", resolveOperand("casement-window", CTX), "casement-window");
  expect("number is a literal", resolveOperand(715, CTX), 715);
  expect("boolean is a literal", resolveOperand(true, CTX), true);
  expect("null is a literal", resolveOperand(null, CTX), null);

  // ---- 2. Comparison operators -------------------------------------
  expect("eq true", evalRule({ eq: ["item.family", "casement-window"] }, CTX), true);
  expect("eq false", evalRule({ eq: ["item.family", "entrance-door"] }, CTX), false);
  expect("eq is strict (no 1200 == '1200')", evalRule({ eq: ["item.widthMm", "1200"] }, CTX), false);
  expect("neq true", evalRule({ neq: ["item.family", "entrance-door"] }, CTX), true);
  expect("neq false", evalRule({ neq: ["item.family", "casement-window"] }, CTX), false);
  expect("lt true", evalRule({ lt: ["component.widthMm", 800] }, CTX), true);
  expect("lt false", evalRule({ lt: ["component.widthMm", 715] }, CTX), false);
  expect("lte boundary true", evalRule({ lte: ["component.heightMm", 1342] }, CTX), true);
  expect("lte false", evalRule({ lte: ["component.widthMm", 715] }, CTX), false);
  expect("gt true", evalRule({ gt: ["component.widthMm", 715] }, CTX), true);
  expect("gt false", evalRule({ gt: ["component.widthMm", 728] }, CTX), false);
  expect("gte boundary true", evalRule({ gte: ["component.widthMm", 728] }, CTX), true);
  expect("gte false", evalRule({ gte: ["component.widthMm", 729] }, CTX), false);
  expect("both operands may be paths", evalRule({ gt: ["item.heightMm", "item.widthMm"] }, CTX), true);

  // ---- 3. Set membership -------------------------------------------
  expect(
    "in true",
    evalRule({ in: ["component.type", ["sash", "glass"]] }, CTX),
    true,
  );
  expect("in false", evalRule({ in: ["component.type", ["glass", "panel"]] }, CTX), false);
  expect("in with an empty list is false", evalRule({ in: ["component.type", []] }, CTX), false);

  // ---- 4. Selection operators --------------------------------------
  expect("selected true", evalRule({ selected: ["glazing.method", "glazed"] }, CTX), true);
  expect("selected false", evalRule({ selected: ["glazing.method", "unglazed"] }, CTX), false);
  expect("selected on an unanswered option is false", evalRule({ selected: ["nope", "x"] }, CTX), false);
  expect("exists true", evalRule({ exists: ["profile.cill"] }, CTX), true);
  expect("exists false (never answered)", evalRule({ exists: ["hardware.handle"] }, CTX), false);
  expect("exists false (answered null)", evalRule({ exists: ["general.drainage"] }, CTX), false);

  // ---- 5. Logical combinators + nesting ----------------------------
  expect(
    "all true",
    evalRule({ all: [{ eq: ["component.type", "sash"] }, { gt: ["component.widthMm", 700] }] }, CTX),
    true,
  );
  expect(
    "all false when one member fails",
    evalRule({ all: [{ eq: ["component.type", "sash"] }, { gt: ["component.widthMm", 900] }] }, CTX),
    false,
  );
  expect(
    "any true",
    evalRule({ any: [{ eq: ["component.type", "glass"] }, { gt: ["component.widthMm", 700] }] }, CTX),
    true,
  );
  expect(
    "any false when every member fails",
    evalRule({ any: [{ eq: ["component.type", "glass"] }, { gt: ["component.widthMm", 900] }] }, CTX),
    false,
  );
  expect("not inverts", evalRule({ not: { eq: ["component.type", "glass"] } }, CTX), true);
  expect("not inverts (true case)", evalRule({ not: { eq: ["component.type", "sash"] } }, CTX), false);
  expect(
    "deep nesting (all > any > not)",
    evalRule(
      {
        all: [
          { eq: ["item.family", "casement-window"] },
          {
            any: [
              { not: { in: ["component.type", ["glass", "panel"]] } },
              { selected: ["glazing.method", "unglazed"] },
            ],
          },
        ],
      },
      CTX,
    ),
    true,
  );

  // ---- 6. Fail-loud contract ---------------------------------------
  expect("unknown operator throws", throws({ equals: ["item.family", "x"] }), true);
  expect("two operators in one node throws", throws({ eq: ["a", "a"], neq: ["a", "b"] }), true);
  expect("empty node throws", throws({}), true);
  expect("non-object rule throws", throws("item.family"), true);
  expect("array rule throws", throws([{ eq: ["a", "a"] }]), true);
  expect("null rule throws", throws(null), true);
  expect("unknown item path throws", throws({ eq: ["item.colour", "white"] }), true);
  expect("unknown component path throws", throws({ eq: ["component.colour", "white"] }), true);
  expect("comparison with wrong arity throws", throws({ eq: ["item.family"] }), true);
  expect("ordered comparison on a string throws", throws({ lt: ["item.family", "z"] }), true);
  expect("ordered comparison on undefined throws", throws({ lt: ["selection.absent", 5] }), true);
  expect("in without a list throws", throws({ in: ["component.type", "sash"] }), true);
  expect("all with a non-array throws", throws({ all: { eq: ["a", "a"] } }), true);
  expect("all with an empty array throws", throws({ all: [] }), true);
  expect("selected with a non-string throws", throws({ selected: ["glazing.method", 3] }), true);
  expect("exists with wrong arity throws", throws({ exists: ["a", "b"] }), true);

  // component.* outside a component context is a caller bug, not "false".
  let itemCtxThrew = false;
  try {
    evalRule({ eq: ["component.type", "sash"] }, ITEM_CTX);
  } catch (err) {
    itemCtxThrew = err instanceof RuleError;
  }
  expect("component.* in an item-level context throws", itemCtxThrew, true);

  // ---- 7. Structural validation (write-time gate) -------------------
  const structurallyOk = (rule: unknown): boolean => {
    try {
      assertValidRule(rule as Rule, "test");
      return true;
    } catch {
      return false;
    }
  };
  expect(
    "assertValidRule accepts a well-formed rule",
    structurallyOk({ all: [{ eq: ["item.family", "casement-window"] }, { gt: ["item.widthMm", 0] }] }),
    true,
  );
  expect(
    "assertValidRule accepts runtime-only operands (no evaluation)",
    structurallyOk({ lt: ["selection.qty", 5] }),
    true,
  );
  expect("assertValidRule rejects an unknown operator", structurallyOk({ equals: ["a", "b"] }), false);
  expect("assertValidRule rejects an unknown path", structurallyOk({ eq: ["item.colour", "x"] }), false);
  expect(
    "assertValidRule rejects a bad nested node",
    structurallyOk({ all: [{ eq: ["item.family", "x"] }, { nope: [] }] }),
    false,
  );
}
