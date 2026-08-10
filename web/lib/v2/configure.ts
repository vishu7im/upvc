import {
  effectiveAnswer,
  isAnswered,
  isItemAnswerable,
} from "@/lib/designer-draft";
import type {
  FamilyDescriptor,
  LineItemDraft,
  OptionChoice,
  OptionDef,
  OptionGroupWithOptions,
} from "@/lib/types";

export const CONFIGURE_DEBOUNCE_MS = 350;

export type ConfigureMode = "standard" | "custom";

export function configureMode(value: string | undefined): ConfigureMode {
  return value === "custom" ? "custom" : "standard";
}

export interface ConfigureHrefInput {
  mode: ConfigureMode;
  family?: string;
  design?: string;
  system?: string;
  productId?: string;
  orderId?: string;
  itemId?: string;
  fromItem?: string;
}

export function configureHref(input: ConfigureHrefInput): string {
  const query = new URLSearchParams({ mode: input.mode });
  for (const [key, value] of Object.entries(input)) {
    if (key !== "mode" && value) query.set(key, value);
  }
  return `/v2/configure?${query.toString()}`;
}

function isStandardEffect(choice: OptionChoice): boolean {
  const effect = choice.engineEffect;
  if (!effect) return false;
  if (effect.kind === "colour-key" || effect.kind === "glass-key" || effect.kind === "cill-key") {
    return true;
  }
  return effect.kind === "profile-substitution" && effect.params?.slot === "frame";
}

export function isStandardOption(option: OptionDef): boolean {
  return isItemAnswerable(option) && option.choices.some(isStandardEffect);
}

export function standardOptionGroups(
  groups: ReadonlyArray<OptionGroupWithOptions>,
): OptionGroupWithOptions[] {
  return groups
    .map((group) => ({
      ...group,
      options: group.options.filter(isStandardOption),
    }))
    .filter((group) => group.options.length > 0);
}

export function isStandardDraftCompatible(
  draft: LineItemDraft,
  groups: ReadonlyArray<OptionGroupWithOptions>,
): boolean {
  if ((draft.topologyEdits?.length ?? 0) > 0) return false;
  const standardKeys = new Set(
    groups.flatMap((group) => group.options).filter(isStandardOption).map((option) => option.key),
  );
  return (draft.selections ?? []).every((selection) =>
    !selection.scope && standardKeys.has(selection.optionKey),
  );
}

interface LegacyEffectValues {
  frameKey?: string;
  glassKey?: string;
  colourKey?: string;
  colourKeyOutside?: string;
  cillKey?: string;
}

function legacyEffectValues(
  draft: LineItemDraft,
  groups: ReadonlyArray<OptionGroupWithOptions>,
  userAnswersOnly: boolean,
): LegacyEffectValues {
  const values: LegacyEffectValues = {};
  for (const option of groups.flatMap((group) => group.options)) {
    if (!isStandardOption(option)) continue;
    const answer = effectiveAnswer(draft, option);
    if (userAnswersOnly && !isAnswered(answer)) continue;
    const choice = answer.choice;
    const effect = choice?.engineEffect;
    const partKey = choice?.partKey;
    if (!effect || !partKey) continue;

    if (effect.kind === "colour-key") {
      if (effect.params?.side === "outside") values.colourKeyOutside = partKey;
      else values.colourKey = partKey;
    } else if (effect.kind === "glass-key") {
      values.glassKey = partKey;
    } else if (effect.kind === "cill-key") {
      values.cillKey = partKey;
    } else if (effect.kind === "profile-substitution" && effect.params?.slot === "frame") {
      values.frameKey = partKey;
    }
  }
  return values;
}

export interface StandardPreviewRequest {
  systemId: string;
  designId: string;
  widthMm: number;
  heightMm: number;
  frameKey?: string;
  glassKey?: string;
  colourKey?: string;
  colourKeyOutside?: string;
  cillKey?: string;
  splitRatios?: Record<string, number>;
}

/**
 * Presentation-only adapter for Standard's joint overlay. Values are found by
 * the descriptor's engine effects, never by option keys. The line-item
 * resolver remains the authoritative configuration and pricing response.
 */
export function standardPreviewRequest(
  draft: LineItemDraft,
  groups: ReadonlyArray<OptionGroupWithOptions>,
): StandardPreviewRequest {
  const effects = legacyEffectValues(draft, groups, false);
  return {
    systemId: draft.systemId,
    designId: draft.designId,
    widthMm: draft.dimensions.widthMm,
    heightMm: draft.dimensions.heightMm,
    ...effects,
    ...(draft.splitRatios && Object.keys(draft.splitRatios).length
      ? { splitRatios: draft.splitRatios }
      : {}),
  };
}

export interface StandardOrderItemInput {
  productId: string;
  designId: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  frameKey?: string;
  cillKey?: string;
  splitRatios?: Record<string, number>;
  colourKeyInside?: string;
  colourKeyOutside?: string;
}

/**
 * Existing Standard order-item persistence. Glass is intentionally absent:
 * the production contract stores colour, cill, frame and split positions but
 * reuses the design's glass default when the item is solved from the order.
 */
export function standardOrderItemInput(
  draft: LineItemDraft,
  groups: ReadonlyArray<OptionGroupWithOptions>,
  productId: string,
): StandardOrderItemInput {
  const effects = legacyEffectValues(draft, groups, true);
  return {
    productId,
    designId: draft.designId,
    widthMm: draft.dimensions.widthMm,
    heightMm: draft.dimensions.heightMm,
    qty: draft.quantity,
    ...(effects.frameKey ? { frameKey: effects.frameKey } : {}),
    ...(effects.cillKey ? { cillKey: effects.cillKey } : {}),
    ...(effects.colourKey ? { colourKeyInside: effects.colourKey } : {}),
    ...(effects.colourKeyOutside ? { colourKeyOutside: effects.colourKeyOutside } : {}),
    ...(draft.splitRatios && Object.keys(draft.splitRatios).length
      ? { splitRatios: draft.splitRatios }
      : {}),
  };
}

export function productIdsForFamily(family: FamilyDescriptor): string[] {
  return [...new Set(family.designSource.productIds ?? [])];
}
