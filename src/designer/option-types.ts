// =====================================================================
// designer/option-types.ts — the Designer platform contracts.
//
// These are the TypeScript shapes behind the JSON-driven option system and
// the product-family plugin contract:
//   Spec/00-architecture/product-family-plugin.md  §2  (ProductFamilyDescriptor)
//   Spec/00-architecture/option-schema.md          §3–6 (groups/defs/choices, rule DSL)
//
// They are PURE DATA declarations — no I/O, no Prisma, no engine import
// beyond the SashKind union — so the seed sources, the loader, the API and
// (from phase 2) the resolver can all share them.
//
// The DB tables in prisma/schema.prisma mirror these one-for-one; the JSONB
// columns (`scope`, `filters`, `visibility`, `validation`, `presentation`,
// `action`, `image`, `engineEffect`, `descriptor`) hold exactly the sub-shapes
// declared here.
// =====================================================================

import type { JointMethod, SashKind } from "../types.ts";

// ---------------------------------------------------------------------
// Shared vocabulary
// ---------------------------------------------------------------------

/** What the canvas can address and what an option can be scoped to. */
export type ComponentType =
  | "frame-edge"
  | "transom"
  | "mullion"
  | "sash"
  | "glass"
  | "panel"
  | "cill"
  | "addon";

/** Which side of the unit a side-addressable component sits on. */
export type ComponentSide = "top" | "bottom" | "left" | "right";

/** How the designer renders an option's choice control. */
export type OptionDisplay =
  | "select"
  | "select-image"
  | "segmented"
  | "toggle"
  | "number"
  | "text"
  | "action";

/** item = one answer per line item · component = one answer per component. */
export type OptionLevel = "item" | "component";

/** Which set of components a single answer is written to. */
export type ApplyScope = "this" | "all-of-type";

/** Group placement in the inspector (which tab shows it). */
export type OptionGroupScope = "item" | "component" | "mixed";

/**
 * How a choice is priced.
 *  - "catalog": the choice's `partKey` resolves to a catalog part and the
 *    engine/BOM prices it (the golden rule — prices NEVER live on a choice).
 *  - "none": cosmetic or specification-only. The answer is persisted and
 *    printed on documents but adds no cost and no BOM line.
 */
export type OptionPricingMode = "catalog" | "none";

// ---------------------------------------------------------------------
// Engine effects — the closed enum the resolver understands
// ---------------------------------------------------------------------

/**
 * A choice's `engineEffect.kind` is a CLOSED enum: adding a kind is a platform
 * change (resolver code), while adding options/choices within an existing kind
 * is pure data. Each kind names the engine touch-point it maps onto, so the
 * phase-2 resolver has an unambiguous target:
 *
 * | kind                   | engine touch-point                                              |
 * |------------------------|-----------------------------------------------------------------|
 * | `colour-key`           | `QuoteInput.colourKey` / `.colourKeyOutside` (U7 dual colour)    |
 * | `glass-key`            | `QuoteInput.glassKey` (U3 clone-on-override)                     |
 * | `cill-key`             | `QuoteInput.cillKey`                                             |
 * | `addon`                | `QuoteInput.addons[side]` — a frame-extension profile on one     |
 * |                        | frame edge, which pushes the frame in by that profile's face     |
 * |                        | (Job 169). `params.side` = top/bottom/left/right                 |
 * | `profile-substitution` | a profile slot on the topology/quote (`frameKey` today; `beadKey`|
 * |                        | fill is a phase-2 resolver addition, mirroring `fillDefaultGlass`)|
 * | `hardware-substitution`| swap one hardware key in the computed hardware tally             |
 * | `preview`              | presentation-only metadata; never changes fabrication or pricing |
 * | `bom-line`             | append a plain priced BOM line (catalog part × qty)              |
 * | `topology-edit`        | a `TopologyEdit` applied by the family's engine adapter          |
 * | `none`                 | NO engine effect — recorded on the line item + documents only    |
 *
 * `none` is the honest home for every option whose fabrication rule is not yet
 * calibrated (golden rule): it appears, persists and prints, but never
 * fabricates or prices until a calibrated rule exists.
 */
export type EngineEffectKind =
  | "colour-key"
  | "glass-key"
  | "cill-key"
  | "addon"
  | "profile-substitution"
  | "hardware-substitution"
  | "preview"
  | "bom-line"
  | "topology-edit"
  | "none";

export interface EngineEffect {
  kind: EngineEffectKind;
  /** Kind-specific payload (e.g. `{side:"outside"}`, `{slot:"handle"}`). */
  params?: Readonly<Record<string, string | number | boolean>>;
}

// ---------------------------------------------------------------------
// Topology edits (instant actions)
// ---------------------------------------------------------------------

/**
 * A structural change to a line item's working topology. Edits are APPENDED to
 * the line item (never applied destructively), so removing an edit is a full
 * undo — see `line-item-schema.md` §4. `componentId` is the adapter's stable
 * position-derived id (e.g. `cell:0.1`), never a random uuid.
 */
export type TopologyEdit =
  | {
      op: "split";
      componentId: string;
      /** horizontal ⇒ a transom is added; vertical ⇒ a mullion. */
      axis: "horizontal" | "vertical";
      position: "equal" | "at-ratio";
      /** Required when position === "at-ratio": fraction of the FULL unit. */
      atRatio?: number;
      /** Catalog transom/mullion partKey; omitted ⇒ the family default. */
      dividerKey?: string;
    }
  | {
      op: "add-midrail";
      componentId: string;
      position: "equal" | "at-ratio";
      atRatio?: number;
      transomKey?: string;
      /**
       * Which way the bar runs inside the sash ring. Omitted ⇒ "horizontal",
       * the Job 00000264 French case; "vertical" is calibrated by Job 154 p4.
       */
      axis?: "horizontal" | "vertical";
    }
  | {
      op: "convert-component";
      componentId: string;
      to: ComponentType;
      /** Target sash kind when `to === "sash"` (line-item-schema.md §2 example). */
      kind?: SashKind;
    }
  | { op: "set-sash-kind"; componentId: string; kind: SashKind }
  | { op: "remove-divider"; componentId: string }
  /**
   * Swap ONE divider's profile (the reference's per-divider Transom / Mullion
   * dropdowns), or how it joins the frame. `jointMethod: "mechanical"` is
   * recorded and printed but CUT AS WELDED — no production document gives its
   * deduction (Spec/questions.md Q22) — and the resolver warns.
   */
  | {
      op: "set-divider";
      componentId: string;
      dividerKey?: string;
      jointMethod?: JointMethod;
    };

export type TopologyEditOp = TopologyEdit["op"];

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * The `action` payload stored on an OptionDef: a TopologyEdit with the target
 * left out. The designer fills `componentId` from the current selection when
 * the action is executed.
 */
export type TopologyEditTemplate = DistributiveOmit<TopologyEdit, "componentId">;

// ---------------------------------------------------------------------
// Rule DSL (option-schema.md §6)
// ---------------------------------------------------------------------

/** A literal, or an operand path resolved against the RuleContext. */
export type RuleOperand = string | number | boolean | null;

/**
 * The whole predicate language: no loops, no arithmetic, fully serializable.
 * Shared by option visibility, choice visibility and family constraints.
 */
export type Rule =
  | { all: Rule[] }
  | { any: Rule[] }
  | { not: Rule }
  | { eq: [RuleOperand, RuleOperand] }
  | { neq: [RuleOperand, RuleOperand] }
  | { lt: [RuleOperand, RuleOperand] }
  | { lte: [RuleOperand, RuleOperand] }
  | { gt: [RuleOperand, RuleOperand] }
  | { gte: [RuleOperand, RuleOperand] }
  | { in: [RuleOperand, RuleOperand[]] }
  /** `["<optionKey>", "<choiceKey>"]` — is that choice the effective answer? */
  | { selected: [string, string] }
  /** `["<optionKey>"]` — does the option have any effective answer? */
  | { exists: [string] };

/** Values a selection can hold (choice key, or a raw number/text answer). */
export type SelectionValue = string | number | boolean | null | undefined;

/**
 * Everything the operand paths can address. `component` is absent when a rule
 * is evaluated at item level; a `component.*` path then throws (fail-loud),
 * because asking a component question outside a component is a caller bug.
 */
export interface RuleContext {
  item: {
    family: string;
    system: string;
    widthMm: number;
    heightMm: number;
  };
  component?: {
    type: ComponentType;
    kind?: string;
    widthMm: number;
    heightMm: number;
    areaM2: number;
  };
  /** optionKey → effective value (see option-schema.md §7). */
  selection: Readonly<Record<string, SelectionValue>>;
}

// ---------------------------------------------------------------------
// Option system (option-schema.md §3–5)
// ---------------------------------------------------------------------

export interface OptionGroup {
  key: string;
  name: string;
  order: number;
  /** Designer icon slug (web/components/icons.tsx). */
  icon?: string;
  defaultCollapsed: boolean;
  scope: OptionGroupScope;
}

export interface OptionScope {
  level: OptionLevel;
  /** Component level only: which component types the option appears on. */
  componentTypes?: ComponentType[];
  /** Which apply-scopes the UI offers; the first is the default. */
  applyScopes?: ApplyScope[];
}

export interface OptionFilter {
  key: string;
  label: string;
}

export interface OptionValidation {
  min?: number;
  max?: number;
  regex?: string;
  maxLength?: number;
}

export interface OptionPresentation {
  omitFromSummary?: boolean;
  omitFromDocuments?: boolean;
  helpText?: string;
  /** Free-text suggestions for `display: "text"` options. */
  suggestions?: string[];
}

export interface OptionDef {
  key: string;
  groupKey: string;
  name: string;
  order: number;
  display: OptionDisplay;
  /** required + unanswered ⇒ an error Issue at confirm (never blocks preview). */
  required: boolean;
  scope: OptionScope;
  filters?: OptionFilter[];
  /** Absent ⇒ always visible. */
  visibility?: Rule;
  validation?: OptionValidation;
  presentation?: OptionPresentation;
  pricingMode: OptionPricingMode;
  /** `display: "action"` only. */
  action?: TopologyEditTemplate;
  /** Which families show this option. */
  familyKeys: string[];
}

export interface OptionChoiceImage {
  kind: "catalog-asset" | "url";
  ref: string;
}

export interface OptionChoice {
  /** Globally unique slug (NOT a uuid — it must be readable in a line item). */
  key: string;
  optionKey: string;
  label: string;
  order: number;
  isDefault: boolean;
  filterKeys?: string[];
  image?: OptionChoiceImage;
  /** Colour choices render a swatch instead of an image. */
  swatchHex?: string;
  /** Catalog part/glass/hardware/cill/colour key → price + BOM. */
  partKey?: string;
  engineEffect?: EngineEffect;
  visibility?: Rule;
}

/** A whole family's option system, as served to the designer. */
export interface OptionSystem {
  groups: (OptionGroup & { options: (OptionDef & { choices: OptionChoice[] })[] })[];
}

/** What a seed source hands to `applyOptionSystem()`. */
export interface OptionSystemSeed {
  groups: OptionGroup[];
  options: OptionDef[];
  choices: OptionChoice[];
}

// ---------------------------------------------------------------------
// Product family descriptor (product-family-plugin.md §2)
// ---------------------------------------------------------------------

export type FamilyStatus = "active" | "hidden" | "deprecated";

export interface FamilyDimension {
  key: string;
  label: string;
  unit: "mm";
  required: boolean;
  min: number;
  max: number;
  /** Reuses `design.defaultWidthMm` / `defaultHeightMm`. */
  defaultFrom?: "design";
  /** true ⇒ recorded on documents, no engine effect. */
  informational?: boolean;
}

export type SplitMode = "byDimensions" | "equalSplit" | "equalGlass";

export interface FamilyComponentType {
  type: ComponentType;
  sides?: ComponentSide[];
  kinds?: SashKind[];
}

export interface FamilyComponentConversion {
  from: ComponentType;
  to: ComponentType[];
}

export interface FamilyTopologyCapabilities {
  guillotineSplits: boolean;
  midrails: boolean;
  slidingPanels: boolean;
  maxNestingDepth: number;
}

export type ViewMode = "external" | "internal" | "schematic" | "3d";

export interface FamilyEngine {
  adapter: "cellnode" | "sliding";
  /** false ⇒ configurable + previewable, but not priceable or orderable. */
  quotable: boolean;
}

export interface FamilyConstraint {
  id: string;
  severity: "warning" | "error";
  /** Which components the constraint applies to; absent ⇒ the whole item. */
  when?: { componentType?: ComponentType; componentKind?: string };
  assert: Rule;
  message: string;
  /** MANDATORY for fabrication rules (golden rule): where the number came from. */
  source: string;
}

export interface FamilyDesignSource {
  mode: "design-gallery" | "fixed-topology" | "blank-canvas";
  /** Gallery products offering starting designs (mode "design-gallery"). */
  productIds?: string[];
}

export interface ProductFamilyDescriptor {
  familyKey: string;
  name: string;
  status: FamilyStatus;
  systemIds: string[];
  designSource: FamilyDesignSource;
  dimensions: FamilyDimension[];
  splitModes: SplitMode[];
  componentTypes: FamilyComponentType[];
  componentConversions: FamilyComponentConversion[];
  topology: FamilyTopologyCapabilities;
  optionGroupKeys: string[];
  viewModes: ViewMode[];
  engine: FamilyEngine;
  constraints: FamilyConstraint[];
}
