import assert from "node:assert/strict";
import type { BasketTotals, OrderDetail } from "../lib/types";
import {
  commercialNumber,
  groupedOrderDocuments,
  orderGrandTotal,
  orderItemCount,
  ordersHref,
  orderStatusFilter,
  positivePage,
  unifiedOrderLines,
} from "../lib/v2/orders";

const basket: BasketTotals = {
  currency: "GBP",
  lines: [
    { id: "old-1", kind: "legacy", label: "Window", qty: 2, unitNetPrice: 100, lineNetPrice: 201, errorCount: 0 },
    { id: "new-1", kind: "designer", label: "Door", qty: 1, unitNetPrice: 300, lineNetPrice: 304, errorCount: 1 },
  ],
  linesSubtotal: 505,
  itemsAdjustment: 5,
  itemsSubtotal: 510,
  discount: 10,
  discountCode: "SAVE",
  discountKind: "fixed",
  discountValue: 10,
  fittingType: "fit",
  fitting: 30,
  survey: 0,
  delivery: 20,
  extras: 50,
  taxableBase: 550,
  taxRatePct: 20,
  tax: 110,
  grandTotal: 660,
};

const order = {
  id: "order-1",
  orderNo: "ORD-1",
  customerName: "Acme",
  reference: "REF",
  status: "draft",
  totalPrice: 999,
  basketTotal: 998,
  createdAt: "2026-08-08T00:00:00.000Z",
  items: [{
    id: "old-1",
    productId: "p1",
    designId: "d1",
    systemId: "s1",
    widthMm: 1000,
    heightMm: 1200,
    qty: 2,
    mode: "default",
    design: { name: "Window" },
    product: { name: "Casement" },
    studioFamilyKey: "window",
  }],
  designerItems: [{
    id: "new-1",
    position: 2,
    draft: {
      schemaVersion: 1,
      familyKey: "door",
      systemId: "s1",
      designId: "d2",
      quantity: 1,
      dimensions: { width: 900, height: 2100 },
    },
    catalogVersion: "v1",
    summary: { sizeLabel: "900 × 2100", colourLabel: "White", locationLabel: "Rear door", leafCount: 1, glassSizes: [] },
    issues: [{ severity: "error", kind: "selection", message: "Choose compatible hardware." }],
    invalidSpec: true,
    invalidDimensions: false,
    totals: { materialCost: 0, materialPrice: 0, labour: 0, factoryCost: 0, markup: 0, netPrice: 9999, tax: 0, grandTotal: 9999 },
  }],
  documents: [
    { type: "WORK_ORDER", variant: "normal", createdAt: "2026-08-08T00:00:00.000Z" },
    { type: "WORK_ORDER", variant: "welded", createdAt: "2026-08-08T00:00:00.000Z" },
    { type: "CUTTING_LIST", variant: "normal", createdAt: "2026-08-08T00:00:00.000Z" },
    { type: "BOM", variant: "normal", createdAt: "2026-08-08T00:00:00.000Z" },
    { type: "PRICE_SUMMARY", variant: "normal", createdAt: "2026-08-08T00:00:00.000Z" },
    { type: "WORK_PLANNER", variant: "normal", createdAt: "2026-08-08T00:00:00.000Z" },
    { type: "DMO", variant: "normal", createdAt: "2026-08-08T00:00:00.000Z" },
    { type: "PLANNER_LIST", variant: "normal", createdAt: "2026-08-08T00:00:00.000Z" },
  ],
  basket,
} satisfies OrderDetail;

assert.equal(positivePage("3"), 3);
assert.equal(positivePage("bad"), 1);
assert.equal(orderStatusFilter("draft"), "draft");
assert.equal(orderStatusFilter("deleted"), "");
assert.equal(ordersHref({ page: 2, query: " Acme ", status: "confirmed" }), "/v2/orders?page=2&q=Acme&status=confirmed");

assert.equal(orderItemCount(order), 2);
assert.equal(orderGrandTotal(order), 660);
const lines = unifiedOrderLines(order);
assert.equal(lines.length, 2);
assert.deepEqual(lines.map((line) => line.lineNetPrice), [201, 304]);
assert.equal(lines[1]?.lineNetPrice, basket.lines[1]?.lineNetPrice, "line price must come from BasketTotals, not designer totals");
assert.deepEqual(lines[1]?.issueMessages, ["Choose compatible hardware."]);
assert.match(lines[0]?.editHref ?? "", /fromItem=old-1/);
assert.match(lines[1]?.editHref ?? "", /itemId=new-1/);

const groups = groupedOrderDocuments(order);
assert.deepEqual(groups.map((group) => group.id), ["office", "production", "dispatch"]);
assert.deepEqual(groups.map((group) => group.documents.length), [2, 4, 1]);
assert.equal(groups.flatMap((group) => group.documents).length, 7);
assert.deepEqual(groups[0]?.documents.find((document) => document.type === "work_order")?.variants, ["welded", "normal"]);

assert.equal(commercialNumber(""), null);
assert.equal(commercialNumber("12.50"), 12.5);
assert.equal(commercialNumber("-1"), undefined);

console.log("V2 Orders contract checks passed (server filters, unified basket lines, all seven grouped documents, commercial parsing).");
