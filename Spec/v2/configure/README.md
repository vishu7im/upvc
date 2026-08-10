# V2-M8 Quote / configure evidence

The evidence harness walks the built, authenticated V2 Quote/configure flow against the local API
without submitting any order mutation. It captures the task-first family and layout choices plus the
Standard and Custom workspace at 1280×900 and 834×1112.

`capture-configure.mjs` requires a short-lived `V2_CAPTURE_TOKEN`; the token is used only as an
httpOnly browser cookie and is never written to screenshots or metrics. The harness checks:

- HTTP 200, a visible V2 title, 16 px root text, and no page-level horizontal overflow;
- family-first entry and family-scoped quotable layout choices;
- one workspace, two inspector tabs, and a settled server resolver preview;
- two Standard views plus joint-overlay activation when compatible;
- four working Custom views, product-option disclosure, component selection, and local structural
  action/Undo when the selected family exposes one;
- the issue drawer without saving, adding, replacing, repricing, or confirming an order.

The generated `screens/configure-metrics.json` is the machine-readable result. PNG files beside it
are the owner-review captures.
