// =====================================================================
// designer/adapters/index.ts — the adapter registry.
//
// Keyed by `ProductFamilyDescriptor.engine.adapter`. Unknown adapters fail
// loud — a family whose adapter is missing must not resolve to a silently
// wrong quote, which is also why a family is never seeded ahead of its
// adapter (`resolve.ts` calls `getAdapter` unguarded).
//
//   cellnode — CellNode trees: casement-window, entrance-door, french-door
//   sliding  — the `kind:"sliding"` row: sliding-patio
// =====================================================================

import type { EngineAdapter } from "../line-item-types.ts";
import { cellnodeAdapter } from "./cellnode.ts";
import { slidingAdapter } from "./sliding.ts";

const ADAPTERS: Record<string, EngineAdapter> = {
  cellnode: cellnodeAdapter,
  sliding: slidingAdapter,
};

export function getAdapter(name: string): EngineAdapter {
  const adapter = ADAPTERS[name];
  if (!adapter) {
    throw new Error(`No engine adapter registered for "${name}" (known: ${Object.keys(ADAPTERS).join(", ")})`);
  }
  return adapter;
}
