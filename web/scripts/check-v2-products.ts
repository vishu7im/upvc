import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { DesignListItem } from "../lib/types";
import {
  catalogConfigureMode,
  layoutConfigureHref,
  partitionCatalogDesigns,
  positiveCatalogPage,
  productDesignsHref,
  productsHref,
} from "../lib/v2/products";

function design(designId: string, quotable: boolean): DesignListItem {
  return {
    designId,
    name: designId,
    productType: "test",
    quotable,
    quantityOfSquares: 1,
    externalId: null,
  };
}

assert.equal(positiveCatalogPage("4"), 4);
assert.equal(positiveCatalogPage("0"), 1);
assert.equal(positiveCatalogPage("invalid"), 1);
assert.equal(catalogConfigureMode("custom"), "custom");
assert.equal(catalogConfigureMode("anything-else"), "standard");

assert.equal(
  productsHref({ page: 2, orderId: "order one" }),
  "/v2/products?page=2&orderId=order+one",
);
assert.equal(
  productDesignsHref("product/one", { page: 3, orderId: "order one", mode: "custom" }),
  "/v2/products/product%2Fone?page=3&orderId=order+one&mode=custom",
);

const groups = partitionCatalogDesigns([
  design("configurable-1", true),
  design("reference-1", false),
  design("configurable-2", true),
]);
assert.deepEqual(groups.configurable.map((item) => item.designId), ["configurable-1", "configurable-2"]);
assert.deepEqual(groups.reference.map((item) => item.designId), ["reference-1"]);

assert.equal(
  layoutConfigureHref({
    mode: "custom",
    family: "casement family",
    designId: "design-1",
    systemId: "system-1",
    productId: "product-1",
    orderId: "order-1",
  }),
  "/v2/configure?mode=custom&family=casement+family&design=design-1&system=system-1&productId=product-1&orderId=order-1",
);
assert.equal(
  layoutConfigureHref({
    mode: "custom",
    designId: "design-1",
    systemId: "system-1",
    productId: "product-1",
  }),
  null,
  "Custom entry needs an API-declared family",
);
assert.match(
  layoutConfigureHref({
    mode: "standard",
    designId: "design-1",
    systemId: "system-1",
    productId: "product-1",
  }) ?? "",
  /^\/v2\/configure\?mode=standard/,
  "Standard entry may let the workspace infer its family from the product",
);

const listPage = readFileSync(new URL("../app/(v2)/v2/products/page.tsx", import.meta.url), "utf8");
const detailPage = readFileSync(new URL("../app/(v2)/v2/products/[id]/page.tsx", import.meta.url), "utf8");

assert.match(listPage, /requirePagePermission\("products", "view"\)/);
assert.match(listPage, /\/api\/products\?page=\$\{page\}&limit=24/);
assert.match(listPage, /productDesignsHref\(product\.id, \{ orderId \}\)/);
assert.doesNotMatch(listPage, /<form|<TextField/, "Products must not expose unsupported search or filter controls");

assert.match(detailPage, /requirePagePermission\("products", "read"\)/);
assert.match(detailPage, /GALLERY_LIMIT = 24/);
assert.match(detailPage, /\/api\/products\/\$\{encodeURIComponent\(id\)\}\/designs/);
assert.match(detailPage, /\/api\/designs\/\$\{encodeURIComponent\(design\.designId\)\}/);
assert.match(detailPage, /\.catch\(\(\) => null\)/, "one failed SVG request must degrade only its tile");
assert.match(detailPage, /partitionCatalogDesigns/);
assert.match(detailPage, /title="Ready to configure"/);
assert.match(detailPage, /title="Reference previews"/);
assert.match(detailPage, /normalizeSvgForPreview/);
assert.match(detailPage, /mode === "custom" \? "Customise this layout"/);
assert.match(detailPage, /mode: "standard"/);
assert.match(detailPage, /mode: "custom"/);
assert.match(detailPage, /can\(user, "quotes", "view"\)/);
assert.doesNotMatch(detailPage, /@\/components\/ui|@\/components\/design-card/, "V2 Products must use the V2 kit");

console.log("V2 Products contract checks passed (paged product browsing, per-tile SVG degradation, reference separation, task-mode entry, context preservation)." );
