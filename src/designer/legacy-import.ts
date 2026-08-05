// =====================================================================
// designer/legacy-import.ts — legacy OrderItem → LineItemDraft.
//
// An order can hold two kinds of item (see CLAUDE.md "Designer — D2"):
//
//   OrderItem         the pre-Designer row. Named columns: designId, systemId,
//                     widthMm/heightMm, qty, splitRatios, frameKey, cillKey,
//                     colourKeyInside/Outside, and mode+overrides.
//   DesignerLineItem  a LineItemDraft: familyKey + dimensions + selections[],
//                     where colour/cill/frame are ANSWERS to seeded options
//                     rather than columns.
//
// The studio can only open the second kind. Owner request 2026-08-05 ("click on
// order, edit, then edit the product on the order; on edit it opens the design
// studio") therefore needs a bridge, and this is it.
//
// PURE — same rule as the rest of `src/designer/*`. The catalog arrives as a
// `CatalogSnapshot`; nothing here reads Prisma, the filesystem or the clock. The
// API half (which loads the row and persists the swap) lives in
// `src/api/orders.ts`.
//
// GOLDEN RULE, applied to a migration: a legacy value this cannot express is
// reported, never dropped. A silently-lost cill is 30 mm of manufacturing
// height; a silently-lost colour is a mispriced order.
// =====================================================================

import type { ProductFamilyDescriptor } from "./option-types.ts";
import type {
  CatalogSnapshot,
  DraftSelection,
  LineItemDraft,
  LineItemIssue,
} from "./line-item-types.ts";
import { LINE_ITEM_SCHEMA_VERSION } from "./line-item-types.ts";

/** The legacy columns this converter reads (a structural copy of `OrderItem`). */
export interface LegacyItemInput {
  productId: string;
  designId: string;
  systemId: string;
  widthMm: number;
  heightMm: number;
  qty?: number | null;
  mode?: string | null;
  overrides?: unknown;
  splitRatios?: Record<string, number> | null;
  frameKey?: string | null;
  cillKey?: string | null;
  colourKeyInside?: string | null;
  colourKeyOutside?: string | null;
}

export interface LegacyImportResult {
  /** Absent when `blocking` is true — there is nothing safe to open. */
  draft?: LineItemDraft;
  issues: LineItemIssue[];
  /** True when an error-severity issue means the item must not be converted. */
  blocking: boolean;
}

/**
 * Which family claims a product. The descriptor's own `designSource.productIds`
 * is the authority — the same match the gallery uses to decide whether to show a
 * "Design in studio" link — so registering a family lights up its products with
 * no change here.
 */
export function familyForProduct(
  productId: string,
  families: ProductFamilyDescriptor[],
): ProductFamilyDescriptor | undefined {
  return families.find((f) => f.designSource.productIds?.includes(productId));
}

/**
 * Find the choice that ALREADY means "this catalog part, in this slot".
 *
 * The reverse of what the resolver does: it reads a choice and produces an
 * engine key; we hold the engine key and need the choice. Matching on the
 * choice's own `partKey` plus its option's `engineEffect` is what keeps this
 * honest — we never guess an option key, so a family that names its colour
 * option differently still converts, and a family with no such option produces
 * an issue instead of a wrong answer.
 */
function findChoiceFor(
  snapshot: CatalogSnapshot,
  familyKey: string,
  partKey: string,
  matches: (effect: { kind: string; params?: Record<string, unknown> }) => boolean,
): { optionKey: string; choiceKey: string } | undefined {
  const os = snapshot.getOptionSystem(familyKey);
  if (!os) return undefined;
  for (const group of os.groups) {
    for (const option of group.options) {
      for (const choice of option.choices) {
        if (choice.partKey !== partKey) continue;
        const effect = choice.engineEffect as
          | { kind: string; params?: Record<string, unknown> }
          | undefined;
        if (effect && matches(effect)) {
          return { optionKey: option.key, choiceKey: choice.key };
        }
      }
    }
  }
  return undefined;
}

/**
 * Convert one legacy item into a draft the studio can open.
 *
 * Returns issues rather than throwing: a caller rendering an order list must be
 * able to ask "is this editable?" about every row without any of them blowing up
 * the page.
 */
export function legacyItemToDraft(
  item: LegacyItemInput,
  snapshot: CatalogSnapshot,
): LegacyImportResult {
  const issues: LineItemIssue[] = [];

  // ---- 1. The family ------------------------------------------------
  const family = familyForProduct(item.productId, snapshot.listFamilies());
  if (!family) {
    issues.push({
      severity: "error",
      kind: "not-implemented",
      message:
        "No configurable product family claims this item's product, so there is no option " +
        "system to open it against. It can still be removed and re-added from the gallery.",
    });
    return { issues, blocking: true };
  }

  // ---- 2. Custom extraction mode is not expressible ------------------
  // `mode:"custom"` carries an EngineOverrides blob of per-profile allowance
  // tweaks (engine/overrides.ts). A draft has no slot for it and the option
  // system exposes no equivalent, so converting would quietly re-cut the item
  // with catalog allowances. Refuse instead.
  if (item.mode === "custom") {
    issues.push({
      severity: "error",
      kind: "not-implemented",
      message:
        "This item was quoted in Custom extraction mode, whose per-profile allowance overrides " +
        "the studio cannot express. Converting it would silently re-cut the item with the " +
        "catalog's own allowances.",
    });
    return { issues, blocking: true };
  }

  // ---- 3. The design must still exist and belong to the family -------
  const design = snapshot.getDesign(item.designId);
  if (!design) {
    issues.push({
      severity: "error",
      kind: "unknown-design",
      message: `Design "${item.designId}" is no longer in the catalog.`,
    });
    return { issues, blocking: true };
  }

  // ---- 4. The parts that map straight across ------------------------
  const draft: LineItemDraft = {
    schemaVersion: LINE_ITEM_SCHEMA_VERSION,
    familyKey: family.familyKey,
    systemId: item.systemId,
    designId: item.designId,
    quantity: item.qty && item.qty > 0 ? item.qty : 1,
    dimensions: { widthMm: item.widthMm, heightMm: item.heightMm },
    ...(item.splitRatios && Object.keys(item.splitRatios).length
      ? // A dragged divider must stay where it was dragged, which means the
        // item keeps its explicit positions rather than being re-equalised.
        { splitMode: "byDimensions" as const, splitRatios: item.splitRatios }
      : {}),
  };

  // ---- 5. The columns that become option answers --------------------
  const selections: DraftSelection[] = [];

  const carry = (
    partKey: string | null | undefined,
    label: string,
    matches: (e: { kind: string; params?: Record<string, unknown> }) => boolean,
  ) => {
    if (!partKey) return;
    const hit = findChoiceFor(snapshot, family.familyKey, partKey, matches);
    if (!hit) {
      issues.push({
        severity: "warning",
        kind: "unknown-choice",
        message:
          `This item's ${label} ("${partKey}") is not offered as a choice by the ` +
          `${family.name} option system, so it could not be carried over. Re-pick it before saving.`,
      });
      return;
    }
    selections.push({ optionKey: hit.optionKey, choiceKey: hit.choiceKey });
  };

  // The frame needs care that the other columns do not.
  //
  // A legacy item with `frameKey: null` was cut with the DESIGN's baked frame
  // (casement designs bake `frame-5ch`, face 64). A studio draft with no frame
  // answer is NOT the same thing: `profile.frame-chamber` carries an
  // `isDefault` of `frame-6ch` (face 68) and — unlike the bead and sash
  // branches — the resolver's frame branch APPLIES a default-sourced answer
  // (owner decision 2026-08-04, "chamber is a whole-unit choice"). Converting
  // without saying anything would therefore re-cut the item 4 mm narrower in
  // daylight and re-price it, which is exactly the silent change this module
  // exists to prevent.
  //
  // So: carry the item's own override when it has one, and otherwise pin the
  // design's baked frame EXPLICITLY. Either way the converted item cuts
  // identically to the legacy one, and the user can still change it in the
  // studio deliberately.
  carry(item.frameKey ?? design.frameKey, "frame profile", (e) =>
    e.kind === "profile-substitution" && e.params?.slot === "frame" && !e.params?.side);
  carry(item.cillKey, "cill", (e) => e.kind === "cill-key");
  carry(item.colourKeyInside, "inside colour", (e) =>
    e.kind === "colour-key" && e.params?.side !== "outside");
  carry(item.colourKeyOutside, "outside colour", (e) =>
    e.kind === "colour-key" && e.params?.side === "outside");

  if (selections.length) draft.selections = selections;

  return { draft, issues, blocking: false };
}
