// =====================================================================
// designer/rules.ts — the JSON rule-DSL evaluator.
//
//   evalRule(rule, ctx) → boolean
//
// One small predicate language (Spec/00-architecture/option-schema.md §6)
// shared by option visibility, choice visibility and family constraints.
//
// PURE: no I/O, no catalog access, no mutation of the context.
//
// FAIL-LOUD BY DESIGN. This evaluator gates FABRICATION constraints — a
// silently-false rule would hide a size limit or expose an option that cannot
// be built. So every malformed rule throws instead of degrading:
//   • unknown operator            → throw
//   • more than one operator key   → throw (ambiguous)
//   • wrong operand arity/type     → throw
//   • unknown item./component. path→ throw
// The single deliberate exception is `selection.<optionKey>`: an unanswered
// option legitimately resolves to `undefined` (that is what `exists` tests for),
// so unknown selection keys do NOT throw.
// =====================================================================

import type { Rule, RuleContext, RuleOperand, SelectionValue } from "./option-types.ts";

/** Thrown for malformed rules / unknown paths, so callers can distinguish. */
export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleError";
  }
}

const COMPARISONS = ["eq", "neq", "lt", "lte", "gt", "gte"] as const;
const OPERATORS = ["all", "any", "not", ...COMPARISONS, "in", "selected", "exists"] as const;
type Operator = (typeof OPERATORS)[number];

const ITEM_PATHS = ["family", "system", "widthMm", "heightMm"] as const;
const COMPONENT_PATHS = ["type", "kind", "widthMm", "heightMm", "areaM2"] as const;

/**
 * Resolve one operand. Strings prefixed `item.` / `component.` / `selection.`
 * are PATHS into the context; every other value (including a plain string) is
 * a literal. The prefixes are what make the language unambiguous — a literal
 * can never be mistaken for a path and vice versa.
 */
export function resolveOperand(operand: RuleOperand, ctx: RuleContext): SelectionValue {
  if (typeof operand !== "string") return operand;

  if (operand.startsWith("item.")) {
    const key = operand.slice("item.".length);
    if (!(ITEM_PATHS as readonly string[]).includes(key)) {
      throw new RuleError(`Unknown operand path "${operand}" (item.${ITEM_PATHS.join(" | item.")})`);
    }
    return ctx.item[key as (typeof ITEM_PATHS)[number]];
  }

  if (operand.startsWith("component.")) {
    const key = operand.slice("component.".length);
    if (!(COMPONENT_PATHS as readonly string[]).includes(key)) {
      throw new RuleError(
        `Unknown operand path "${operand}" (component.${COMPONENT_PATHS.join(" | component.")})`,
      );
    }
    if (!ctx.component) {
      throw new RuleError(
        `Operand "${operand}" used in an item-level context (no component in scope)`,
      );
    }
    return ctx.component[key as (typeof COMPONENT_PATHS)[number]];
  }

  if (operand.startsWith("selection.")) {
    // Unanswered options resolve to undefined — a legitimate state, not an error.
    return ctx.selection[operand.slice("selection.".length)];
  }

  return operand;
}

/** The single operator key of a rule node, or a throw. */
function operatorOf(rule: Rule): Operator {
  if (rule === null || typeof rule !== "object" || Array.isArray(rule)) {
    throw new RuleError(`Rule must be an object, got ${JSON.stringify(rule)}`);
  }
  const keys = Object.keys(rule);
  if (keys.length !== 1) {
    throw new RuleError(
      `Rule must carry exactly one operator, got [${keys.join(", ")}] — wrap multiple conditions in {all:[…]}`,
    );
  }
  const op = keys[0];
  if (!(OPERATORS as readonly string[]).includes(op)) {
    throw new RuleError(`Unknown rule operator "${op}" (expected one of: ${OPERATORS.join(", ")})`);
  }
  return op as Operator;
}

function asRuleArray(value: unknown, op: string): Rule[] {
  if (!Array.isArray(value)) throw new RuleError(`"${op}" expects an array of rules`);
  if (value.length === 0) throw new RuleError(`"${op}" expects at least one rule`);
  return value as Rule[];
}

function asPair(value: unknown, op: string): [RuleOperand, RuleOperand] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new RuleError(`"${op}" expects exactly two operands, got ${JSON.stringify(value)}`);
  }
  return value as [RuleOperand, RuleOperand];
}

/** Ordered comparison is numbers-only — comparing strings by < is a bug source. */
function asNumber(value: SelectionValue, op: string, side: "left" | "right"): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new RuleError(`"${op}" needs a number on the ${side}, got ${JSON.stringify(value)}`);
  }
  return value;
}

/** Evaluate a rule against a context. Throws (never silently false) on malformed input. */
export function evalRule(rule: Rule, ctx: RuleContext): boolean {
  const op = operatorOf(rule);
  const node = rule as Record<string, unknown>;
  const value = node[op];

  switch (op) {
    case "all":
      return asRuleArray(value, op).every((r) => evalRule(r, ctx));
    case "any":
      return asRuleArray(value, op).some((r) => evalRule(r, ctx));
    case "not":
      return !evalRule(value as Rule, ctx);

    case "eq":
    case "neq": {
      const [l, r] = asPair(value, op);
      const equal = resolveOperand(l, ctx) === resolveOperand(r, ctx);
      return op === "eq" ? equal : !equal;
    }

    case "lt":
    case "lte":
    case "gt":
    case "gte": {
      const [l, r] = asPair(value, op);
      const a = asNumber(resolveOperand(l, ctx), op, "left");
      const b = asNumber(resolveOperand(r, ctx), op, "right");
      return op === "lt" ? a < b : op === "lte" ? a <= b : op === "gt" ? a > b : a >= b;
    }

    case "in": {
      if (!Array.isArray(value) || value.length !== 2) {
        throw new RuleError(`"in" expects [operand, [values…]], got ${JSON.stringify(value)}`);
      }
      const [l, list] = value as [RuleOperand, unknown];
      if (!Array.isArray(list)) throw new RuleError(`"in" expects an array as its second operand`);
      const needle = resolveOperand(l, ctx);
      return (list as RuleOperand[]).some((v) => resolveOperand(v, ctx) === needle);
    }

    case "selected": {
      const [optionKey, choiceKey] = asPair(value, op);
      if (typeof optionKey !== "string" || typeof choiceKey !== "string") {
        throw new RuleError(`"selected" expects ["<optionKey>", "<choiceKey>"]`);
      }
      return ctx.selection[optionKey] === choiceKey;
    }

    case "exists": {
      if (!Array.isArray(value) || value.length !== 1 || typeof value[0] !== "string") {
        throw new RuleError(`"exists" expects ["<optionKey>"], got ${JSON.stringify(value)}`);
      }
      const v = ctx.selection[value[0]];
      return v !== undefined && v !== null;
    }
  }
}

/**
 * Structural check with NO evaluation: proves a rule is well-formed (operator
 * names, operand arity, operand paths) so a bad seed or admin write fails at
 * WRITE time rather than at quote time.
 *
 * Deliberately structural rather than "evaluate against a probe context" —
 * evaluating would reject perfectly legal rules whose operands only have a
 * value at runtime (e.g. `{lt:["selection.qty", 5]}` on an unanswered option).
 * Returns the rule for chaining; throws on the first fault.
 */
export function assertValidRule(rule: Rule, where: string): Rule {
  try {
    walkRule(rule);
  } catch (err) {
    throw new RuleError(`Invalid rule at ${where}: ${(err as Error).message}`);
  }
  return rule;
}

/** Path operands are checked for a KNOWN path; literals pass untouched. */
function assertOperandPath(operand: unknown): void {
  if (typeof operand !== "string") return;
  if (operand.startsWith("item.")) {
    const key = operand.slice("item.".length);
    if (!(ITEM_PATHS as readonly string[]).includes(key)) {
      throw new RuleError(`Unknown operand path "${operand}"`);
    }
  } else if (operand.startsWith("component.")) {
    const key = operand.slice("component.".length);
    if (!(COMPONENT_PATHS as readonly string[]).includes(key)) {
      throw new RuleError(`Unknown operand path "${operand}"`);
    }
  }
}

function walkRule(rule: Rule): void {
  const op = operatorOf(rule);
  const value = (rule as Record<string, unknown>)[op];

  switch (op) {
    case "all":
    case "any":
      asRuleArray(value, op).forEach(walkRule);
      return;
    case "not":
      walkRule(value as Rule);
      return;
    case "eq":
    case "neq":
    case "lt":
    case "lte":
    case "gt":
    case "gte":
      asPair(value, op).forEach(assertOperandPath);
      return;
    case "in": {
      if (!Array.isArray(value) || value.length !== 2 || !Array.isArray(value[1])) {
        throw new RuleError(`"in" expects [operand, [values…]], got ${JSON.stringify(value)}`);
      }
      assertOperandPath(value[0]);
      (value[1] as unknown[]).forEach(assertOperandPath);
      return;
    }
    case "selected": {
      const [optionKey, choiceKey] = asPair(value, op);
      if (typeof optionKey !== "string" || typeof choiceKey !== "string") {
        throw new RuleError(`"selected" expects ["<optionKey>", "<choiceKey>"]`);
      }
      return;
    }
    case "exists":
      if (!Array.isArray(value) || value.length !== 1 || typeof value[0] !== "string") {
        throw new RuleError(`"exists" expects ["<optionKey>"], got ${JSON.stringify(value)}`);
      }
      return;
  }
}
