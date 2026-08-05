// =====================================================================
// designer/adapters/errors.ts — the one error type every adapter throws.
//
// Extracted from `cellnode.ts` when the second adapter arrived: `sliding.ts`
// must be able to reject an illegal edit without importing from a sibling
// adapter (which would make cellnode the de-facto base class of a contract
// that is supposed to be an interface). `cellnode.ts` re-exports it, so every
// existing importer is unaffected.
//
// The resolver converts these into `topology-edit-failed` / `unknown-component`
// / `not-implemented` Issues — an adapter never terminates a resolve.
// =====================================================================

/** Thrown for illegal edits / unknown componentIds, so callers can convert to Issues. */
export class AdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterError";
  }
}

/**
 * "This family's topology cannot express that", as opposed to "you addressed
 * something that does not exist".
 *
 * The distinction is what keeps the resolver honest across families. A sliding
 * row carries its glass and bead keys on the ROW, not per panel
 * (`topology.ts#buildSlidingPanels`), so a per-panel glass answer is not a user
 * error and not a bug — it is a capability we do not have. The resolver reports
 * those as a `not-implemented` WARNING (the item still solves and prices with
 * the row's glass) and everything else as an error, so a genuinely broken scope
 * can never hide behind a missing capability.
 */
export class NotImplementedError extends AdapterError {
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedError";
  }
}
