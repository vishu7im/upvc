// =====================================================================
// designer/adapters/sliding.ts — the engine adapter for sliding-patio rows.
//
//   Spec/00-architecture/product-family-plugin.md §3 (adapter contract) ·
//   CLAUDE.md "## Sliding Patio" (Jobs 44/48 "Andrei UK", patio_calibration.pdf).
//
// PURE: projections of already-solved geometry and immutable node patches.
// No I/O, no catalog access beyond the ProfileSystem handed in via context.
//
// WHY A SECOND ADAPTER AT ALL. A sliding patio is not a `CellNode` TREE: it is
// ONE `kind:"sliding"` node carrying `panels[]` (roles left→right), an optional
// `meeting` flag and optional `boundaries` (n−1 cumulative daylight fractions).
// There is no hsplit/vsplit to walk, no path segments, and the glazing keys sit
// on the NODE rather than per panel. `cellnode.ts` rejects the node outright in
// `replaceAt`, `pinAllCells` and `walkEqual` rather than pretending — this file
// is what those rejections have been pointing at.
//
// COMPONENT IDS USE THE `cell:` PREFIX, NOT `panel:`. `parseComponentId`,
// `resolve.ts#topologyEditFromParams` and `resolve.ts#buildSummary` are shared
// platform code that hard-codes `cell:`, and the engine already names these
// cells: `topology.ts#buildSlidingPanels` emits `pathId` `root.p1`, `root.p2`, …
// So:
//   cell:root.pN               one panel (type `sash`, kind = its SashKind)
//   edge:top|bottom|left|right the outer-frame edges (adapters/shared.ts)
//   cill                       the fitted cill, when present
//
// There are deliberately NO `cell:root.pN/glass` sub-components and no
// `boundary:` components:
//   • the sliding node carries ONE `glassKey`/`beadKey` for the whole row
//     (`buildSlidingPanels`), so a per-panel glazing answer is not expressible.
//     Emitting a glass component per panel would make that answer REACHABLE and
//     then fail it n times; not emitting one keeps the option honest and
//     item-level. `pinCellField` throws `NotImplementedError` for the same
//     reason — see options/sliding.ts and Spec/questions.md.
//   • the canvas already synthesises the n−1 drag handles from adjacent panel
//     rects, and a boundary is a share FRACTION, not a part.
//
// EVERY TOPOLOGY EDIT IS REJECTED — with a reason. See `applyEdit`.
// =====================================================================

import type { CellNode, ProfileSystem, Rect, SolvedGeometry } from "../../types.ts";
import type { TopologyEdit } from "../option-types.ts";
import type {
  AdapterEditContext,
  CellPin,
  ComponentRef,
  EngineAdapter,
} from "../line-item-types.ts";
import { AdapterError, NotImplementedError } from "./errors.ts";
import { cillComponent, frameEdgeComponents, toQuoteInput } from "./shared.ts";

// ---------------------------------------------------------------------
// listComponents
// ---------------------------------------------------------------------

/** "Panel 2 — Sliding (left)" / "Panel 1 — Fixed", from the solved content. */
function panelLabel(index: number, content: string): string {
  const role =
    content === "sliding-slide-left"
      ? "Sliding (left)"
      : content === "sliding-slide-right"
        ? "Sliding (right)"
        : "Fixed";
  return `Panel ${index} — ${role}`;
}

export function listComponents(geometry: SolvedGeometry): ComponentRef[] {
  const out: ComponentRef[] = frameEdgeComponents(geometry);

  for (const [i, cell] of geometry.cells.entries()) {
    // A panel IS a sash ring — four mitred bars around its own glazing — so it
    // is typed `sash`, the same type a casement opener gets. Its `kind` is the
    // engine's own SashKind, which is what lets a family constraint or an
    // option filter address "the sliding leaves" without a new vocabulary.
    const rect: Rect = cell.sashOuter ?? cell.glassRect;
    out.push({
      componentId: `cell:${cell.pathId}`,
      type: "sash",
      label: panelLabel(i + 1, cell.content),
      rect,
      path: cell.pathId,
      kind: cell.content,
    });
  }

  const cill = cillComponent(geometry);
  if (cill) out.push(cill);

  return out;
}

// ---------------------------------------------------------------------
// applyEdit — every op is rejected, each with its own reason
// ---------------------------------------------------------------------

/**
 * Why each op is refused. These are not "unsupported" placeholders: each one
 * names the production evidence that is missing (golden rule) or the scope
 * decision that excludes it, so the message the user sees is the reason.
 *
 * They surface as `topology-edit-failed` ERROR issues through the resolver's
 * existing catch — `resolveLineItem` never throws.
 */
const REJECTIONS: Record<TopologyEdit["op"], string> = {
  split:
    "A sliding row has no transom, mullion or interlock in its cut list — Jobs 44/48 and " +
    "patio_calibration.pdf print a frame, n identical panels, beads, two steels and the " +
    "auxiliary caps, and nothing else. No production document gives a deduction for a bar " +
    "inside a patio panel, so there is nothing to cut it to.",
  "add-midrail":
    "A midrail is calibrated only for a WELDED sash ring (Job 00000264 across a French leaf, " +
    "Job 154 across a casement sash). A sliding panel is a separate framed leaf and no " +
    "document cuts a midrail into one.",
  "remove-divider":
    "A sliding row has no divider to remove: panel boundaries are share fractions of the " +
    "daylight (CellNode.boundaries), not profiles. Drag a boundary to change the widths.",
  "set-divider":
    "A sliding row has no divider profile to set — the panels meet on their own frames, and " +
    "the boundary between them is a share fraction, not a part.",
  "convert-component":
    "Panel count and layout come from the design (OX, XO, OXO, OOX, XOO, OXXO). A panel " +
    "cannot be converted to fixed glass or to a casement sash — it is cut as a framed leaf " +
    "either way. Choose a different patio design instead.",
  "set-sash-kind":
    "Flipping a panel between fixed and sliding is not enabled: the patio studio is scoped to " +
    "sizes, panel widths and options (owner decision, 2026-08-04). The CUT is identical either " +
    "way — only the hardware tally and the auxiliary rows change — so this is a scope decision, " +
    "not a fabrication limit.",
};

export function applyEdit(
  _topology: CellNode,
  edit: TopologyEdit,
  _ctx: AdapterEditContext,
): CellNode {
  throw new AdapterError(REJECTIONS[edit.op] ?? `Sliding rows do not support "${edit.op}"`);
}

// ---------------------------------------------------------------------
// Pinning — the row's glazing keys live on the NODE
// ---------------------------------------------------------------------

function requireSlidingRoot(topology: CellNode): Extract<CellNode, { kind: "sliding" }> {
  if (topology.kind !== "sliding") {
    throw new AdapterError(
      `The sliding adapter expects a sliding row at the root, got "${topology.kind}"`,
    );
  }
  return topology;
}

/**
 * Per-PANEL pinning is not expressible: `buildSlidingPanels` glazes every panel
 * from the node's single `glassKey`/`beadKey`. Reported by the resolver as a
 * `not-implemented` WARNING (the row still solves and prices with its own
 * glass), never as a broken draft — and unreachable in practice, because this
 * adapter emits no per-panel glass component to scope an answer to.
 */
export function pinCellField(_topology: CellNode, path: string, _patch: CellPin): CellNode {
  throw new NotImplementedError(
    `A sliding row carries one glass and bead specification for every panel, so it cannot be ` +
      `pinned on "${path}" alone. Per-panel glazing needs CellNode.panels[].glassKey ` +
      `(Spec/questions.md) — until then, answer it for the whole item.`,
  );
}

/** Item-level glass/bead: the node's own slots, which is exactly what the engine reads. */
export function pinAllCells(topology: CellNode, patch: CellPin): CellNode {
  const node = requireSlidingRoot(topology);
  if (patch.sashKey !== undefined) {
    // The sliding sash (`SPQ-GL-20252`, face 85) is the only panel profile the
    // catalog holds and the only one Jobs 44/48 cut. Swapping in a casement or
    // door sash would change face, overlap and weld allowance all at once, so
    // it is refused rather than applied to a row it was never calibrated on.
    throw new NotImplementedError(
      "A sliding panel has one calibrated profile (SPQ-GL-20252, Jobs 44/48); there is no " +
        "sash substitution for a patio row.",
    );
  }
  return {
    ...node,
    ...(patch.glassKey !== undefined ? { glassKey: patch.glassKey } : {}),
    ...(patch.beadKey !== undefined ? { beadKey: patch.beadKey } : {}),
  };
}

// ---------------------------------------------------------------------
// equalSplitRatios
// ---------------------------------------------------------------------

/**
 * EQUAL IS THE DEFAULT, so there is nothing to write.
 *
 * `topology.ts#panelFractions` gives every panel 1/n when `boundaries` is
 * absent, and that is the state the calibrated width formula
 * (`fraction × (W + K) − 6`) was derived in. Returning `{}` therefore makes
 * `equalSplit` reproduce the calibrated row byte-for-byte instead of
 * re-deriving positions the engine already owns — the family can declare the
 * mode honestly.
 */
export function equalSplitRatios(
  _topology: CellNode,
  _widthMm: number,
  _heightMm: number,
  _system: ProfileSystem,
  _frameFaceWidth: number,
): Record<string, number> {
  return {};
}

export const slidingAdapter: EngineAdapter = {
  applyEdit,
  listComponents,
  toQuoteInput,
  pinCellField,
  pinAllCells,
  equalSplitRatios,
};
