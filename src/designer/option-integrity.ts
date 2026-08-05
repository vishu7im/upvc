// =====================================================================
// designer/option-integrity.ts — structural validation of an option system.
//
// PURE (no I/O): it takes a seed and the set of catalog keys that exist, and
// throws on the first fault. Lives here rather than inside prisma/seed.ts so
// the same check can be unit-tested (options.test.ts) and reused by any future
// admin import route — a rule that only runs in the seed is a rule nobody can
// prove.
//
// Every check below is a WRITE-TIME gate: a broken option system must never
// reach the database half-applied, and a dangling `partKey` must never reach a
// quote (it would silently price to 0, which breaks auditability —
// Spec/00-architecture/data-model.md §5).
// =====================================================================

import type { OptionSystemSeed } from "./option-types.ts";
import { assertValidRule } from "./rules.ts";

export function assertOptionSystemIntegrity(
  seed: OptionSystemSeed,
  catalogKeys: ReadonlySet<string>,
): void {
  const groupKeys = new Set(seed.groups.map((g) => g.key));
  if (groupKeys.size !== seed.groups.length) throw new Error("Duplicate option group key in seed");

  const optionKeys = new Set(seed.options.map((o) => o.key));
  if (optionKeys.size !== seed.options.length) throw new Error("Duplicate option key in seed");

  const choiceKeys = new Set(seed.choices.map((c) => c.key));
  if (choiceKeys.size !== seed.choices.length) throw new Error("Duplicate option choice key in seed");

  for (const o of seed.options) {
    if (!groupKeys.has(o.groupKey)) {
      throw new Error(`Option "${o.key}" references unknown group "${o.groupKey}"`);
    }
    if (o.display === "action" && !o.action) {
      throw new Error(`Option "${o.key}" has display:"action" but no action template`);
    }
    if (o.display !== "action" && o.action) {
      throw new Error(`Option "${o.key}" carries an action template but display is "${o.display}"`);
    }
    if (o.scope.level === "component" && !o.scope.componentTypes?.length) {
      throw new Error(`Component-scoped option "${o.key}" lists no componentTypes`);
    }
    if (o.visibility) assertValidRule(o.visibility, `option ${o.key}`);
  }

  // Options whose choices QUALIFY an edit instead of answering a question.
  const actionOptionKeys = new Set(
    seed.options.filter((o) => o.display === "action").map((o) => o.key),
  );

  const defaultsPerOption = new Map<string, number>();
  for (const c of seed.choices) {
    if (!optionKeys.has(c.optionKey)) {
      throw new Error(`Choice "${c.key}" references unknown option "${c.optionKey}"`);
    }
    // An action option MAY carry choices (the divider-section picker on
    // `structure.add-*`): the option's `action` template supplies the op and the
    // choice supplies the SECTION. A choice with no `partKey` therefore says
    // nothing the template does not already say, and would render as a
    // dropdown entry that silently changes nothing.
    if (actionOptionKeys.has(c.optionKey) && !c.partKey) {
      throw new Error(
        `Choice "${c.key}" qualifies action option "${c.optionKey}" but carries no partKey — ` +
          `a choice on an action option must name the catalog part the edit uses.`,
      );
    }
    if (c.isDefault) {
      defaultsPerOption.set(c.optionKey, (defaultsPerOption.get(c.optionKey) ?? 0) + 1);
    }
    if (c.partKey && !catalogKeys.has(c.partKey)) {
      throw new Error(
        `Choice "${c.key}" points at catalog part "${c.partKey}", which does not exist. ` +
          `A dangling partKey prices to 0 — fix the seed or add the part.`,
      );
    }
    if (c.visibility) assertValidRule(c.visibility, `choice ${c.key}`);
  }
  for (const [optionKey, count] of defaultsPerOption) {
    if (count > 1) throw new Error(`Option "${optionKey}" has ${count} default choices (max 1)`);
  }
}
