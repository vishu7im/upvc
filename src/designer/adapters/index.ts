// =====================================================================
// designer/adapters/index.ts — the adapter registry.
//
// Keyed by `ProductFamilyDescriptor.engine.adapter`. Only `cellnode` exists
// in phase 2; `sliding` arrives with the sliding family (phase 7 or when the
// family is registered). Unknown adapters fail loud — a family whose adapter
// is missing must not resolve to a silently wrong quote.
// =====================================================================

import type { EngineAdapter } from "../line-item-types.ts";
import { cellnodeAdapter } from "./cellnode.ts";

const ADAPTERS: Record<string, EngineAdapter> = {
  cellnode: cellnodeAdapter,
};

export function getAdapter(name: string): EngineAdapter {
  const adapter = ADAPTERS[name];
  if (!adapter) {
    throw new Error(`No engine adapter registered for "${name}" (known: ${Object.keys(ADAPTERS).join(", ")})`);
  }
  return adapter;
}
