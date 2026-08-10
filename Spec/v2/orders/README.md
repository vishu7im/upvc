# V2-M7 Orders evidence

The evidence harness walks the built, authenticated V2 Orders module against the local API without
submitting any mutation. It captures the list plus every available draft/confirmed order subroute
at 1280×900 and 834×1112, then opens (but does not submit) the confirmed-order reopen drawer.

`capture-orders.mjs` requires a short-lived `V2_CAPTURE_TOKEN`; the token is used only as an
httpOnly browser cookie and is never written to the screenshots or metrics. It checks:

- HTTP 200 and a real V2 surface for every route;
- 16 px V2 body text and no page-level horizontal overflow;
- real header order search and at most one primary action per screen;
- one keyboard destination per order-table row;
- four order tabs, no split item lists, and all seven confirmed documents under the approved
  Office / Production / Dispatch groups;
- explicit document deletion and regeneration copy in the reopen drawer.

The generated `screens/orders-metrics.json` is the machine-readable result. PNG files beside it are
the owner-review captures.
