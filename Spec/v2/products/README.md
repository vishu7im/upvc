# V2-M9 Products evidence

The evidence harness walks the built, authenticated V2 Products list and live product-layout
galleries against the local API without submitting any mutation. It captures the list plus
Standard, Custom and reference-only gallery treatments at 1280×900 and 834×1112, then verifies one
live Standard and one live Custom destination in the configure workspace.

`capture-products.mjs` signs into the local evidence installation using `V2_CAPTURE_EMAIL` and
`V2_CAPTURE_PASSWORD`, or the local `.env` admin values when the explicit variables are absent.
Credentials and the resulting httpOnly cookie are never written to screenshots or metrics. The
harness checks:

- HTTP 200, a visible V2 title, 16 px root text, and no page-level horizontal overflow;
- product pagination with exactly one destination per product card;
- one Standard/Custom task choice for the gallery and exactly one matching action per configurable
  layout card;
- reference-only layouts remain visually separate and have no action;
- every design tile has either its live SVG or its own isolated “No preview available” state;
- no unsupported catalog search, family, size, or opening-type control is presented.

The generated `screens/products-metrics.json` is the machine-readable result for all 11 states.
The eight PNG files beside it are the owner-review captures.
