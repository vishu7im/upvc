import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { LineItemDraft, OptionDef, OptionGroupWithOptions } from "../lib/types";
import {
  CONFIGURE_DEBOUNCE_MS,
  configureHref,
  configureMode,
  isStandardDraftCompatible,
  productIdsForFamily,
  standardOptionGroups,
  standardOrderItemInput,
  standardPreviewRequest,
} from "../lib/v2/configure";

function choiceOption(
  key: string,
  effect: { kind: string; params?: Record<string, string> },
  partKey: string,
): OptionDef {
  return {
    key,
    groupKey: "essentials",
    name: key,
    order: 1,
    display: "select",
    required: false,
    scope: { level: "item" },
    pricingMode: "catalog",
    choices: [{
      key: `${key}-choice`,
      optionKey: key,
      label: key,
      order: 1,
      isDefault: false,
      partKey,
      engineEffect: effect,
    }],
  };
}

const frame = choiceOption("test.frame", { kind: "profile-substitution", params: { slot: "frame" } }, "frame-part");
const glass = choiceOption("test.glass", { kind: "glass-key" }, "glass-part");
const colour = choiceOption("test.colour", { kind: "colour-key", params: { side: "inside" } }, "colour-part");
const cill = choiceOption("test.cill", { kind: "cill-key" }, "cill-part");
const advanced = choiceOption("test.hardware", { kind: "hardware-substitution" }, "hardware-part");
const groups: OptionGroupWithOptions[] = [{
  key: "essentials",
  name: "Essentials",
  order: 1,
  defaultCollapsed: false,
  scope: "item",
  options: [frame, glass, colour, cill, advanced],
}];
const draft: LineItemDraft = {
  schemaVersion: 1,
  familyKey: "test-family",
  systemId: "test-system",
  designId: "test-design",
  quantity: 2,
  dimensions: { widthMm: 1200, heightMm: 1400 },
  selections: [frame, glass, colour, cill].map((option) => ({
    optionKey: option.key,
    choiceKey: option.choices[0]!.key,
  })),
};

assert.equal(CONFIGURE_DEBOUNCE_MS, 350);
assert.equal(configureMode("custom"), "custom");
assert.equal(configureMode("unknown"), "standard");
assert.equal(
  configureHref({ mode: "custom", family: "window family", design: "D-1", orderId: "O-1" }),
  "/v2/configure?mode=custom&family=window+family&design=D-1&orderId=O-1",
);
assert.deepEqual(standardOptionGroups(groups)[0]?.options.map((option) => option.key), [
  frame.key,
  glass.key,
  colour.key,
  cill.key,
]);
assert.equal(isStandardDraftCompatible(draft, groups), true);
assert.equal(isStandardDraftCompatible({ ...draft, selections: [...draft.selections!, { optionKey: advanced.key, choiceKey: advanced.choices[0]!.key }] }, groups), false);
assert.equal(isStandardDraftCompatible({ ...draft, topologyEdits: [{ id: "e1", edit: { op: "remove-divider", componentId: "part" } }] }, groups), false);

const preview = standardPreviewRequest(draft, groups);
assert.equal(preview.glassKey, "glass-part", "Standard live preview must carry the selected glass");
assert.equal(preview.frameKey, "frame-part");
const orderItem = standardOrderItemInput(draft, groups, "product-1");
assert.equal("glassKey" in orderItem, false, "existing Standard order persistence must not store quote-time glass");
assert.equal(orderItem.colourKeyInside, "colour-part");
assert.equal(orderItem.cillKey, "cill-part");
assert.equal(orderItem.qty, 2);
assert.deepEqual(productIdsForFamily({ designSource: { mode: "products", productIds: ["a", "a", "b"] } } as never), ["a", "b"]);

const page = readFileSync(new URL("../app/(v2)/v2/configure/page.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../app/(v2)/v2/configure/_components/configure-workspace.tsx", import.meta.url), "utf8");
const inspector = readFileSync(new URL("../app/(v2)/v2/configure/_components/configure-inspector.tsx", import.meta.url), "utf8");
const orderItems = readFileSync(new URL("../app/(v2)/v2/orders/[id]/items/page.tsx", import.meta.url), "utf8");

assert.match(page, /requirePagePermission\("quotes", "view"\)/);
assert.match(page, /serverApiGet<FamilySummary\[]>\("\/api\/families"\)/);
assert.match(page, /productIdsForFamily\(family\.family\)/);
assert.equal((workspace.match(/useReducer\(/g) ?? []).length, 1, "workspace must have exactly one reducer");
assert.match(workspace, /const mine = \+\+sequence\.current/);
assert.match(workspace, /mine !== sequence\.current/);
assert.match(workspace, /CONFIGURE_DEBOUNCE_MS/);
assert.match(workspace, /settledOnceRef\.current/);
assert.doesNotMatch(workspace, /setResolved\(null\)/, "failed resolves must retain the last good result");
assert.match(workspace, /WindowDesigner/);
assert.match(workspace, /CommercialsForm/);
assert.match(workspace, /Show joints/);
for (const label of ["External", "Internal", "Schematic", "3D"]) assert.match(workspace, new RegExp(label));
assert.match(inspector, /ROWS_BEFORE_MORE/);
assert.match(inspector, /Apply answers to/);
assert.match(inspector, /Structural actions/);
assert.match(inspector, /Structural changes/);
assert.match(orderItems, /configureHref\(\{ mode: "standard", orderId: order\.id \}\)/);

for (const source of [page, workspace, inspector]) {
  assert.doesNotMatch(source, /@\/components\/ui|@\/components\/toast/, "V2 Configure must use the V2 kit");
}

console.log("V2 Quote/configure contract checks passed (task-first entry, one reducer, guarded resolve loop, Standard persistence, Custom parity, in-workspace basket)." );
