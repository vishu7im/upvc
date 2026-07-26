# Line Item Schema

> The persisted JSON contract for one configured product in an order, and the stateless resolve
> API around it. Self-contained; vocabulary in `overview.md` §5, option semantics in
> `option-schema.md`.

## 1. Design goals

- **One JSON document captures user intent completely**: family, starting design, dimensions,
  topology edits, scoped selections. Re-running the resolver on it must be deterministic.
- **Computed state is cached, never authoritative**: price, issues, glass sizes are derived; the
  document can always be re-resolved (e.g. after a catalog price change) — mirrors the repo's
  existing confirm-time snapshot pattern (confirmed orders freeze; drafts re-resolve).
- **Forward-compatible**: unknown future fields must not break old readers → top-level
  `schemaVersion`, additive evolution only.
- Improves on the reference (`jobitem.json`): no GUID coupling, no duplicated per-component option
  instances, intent separated from cache.

## 2. `LineItemDraft` (user intent — what the UI edits)

```jsonc
{
  "schemaVersion": 1,
  "familyKey": "casement-window",
  "systemId": "sunnyplast-70",
  "designId": "<catalog design id>",     // starting topology (null for blank-canvas families)
  "quantity": 1,
  "location": "Kitchen rear",            // free text (+ suggestion list), printed on documents

  "dimensions": {                        // keys from the family descriptor's dimension list
    "widthMm": 1200,
    "heightMm": 1200,
    "distanceFromFloorMm": 0
  },

  "splitMode": "byDimensions",           // byDimensions | equalSplit | equalGlass
  "splitRatios": { "root": 0.333, "root.b1": 0.5 },   // EXISTING engine format, reused verbatim
                                         // (byDimensions UI converts mm spans ⇄ ratios)

  "topologyEdits": [                     // ordered list; applied to the design topology by the
    {                                    // family's engine adapter before solving
      "id": "e1",                        // local id so UI can undo/remove a specific edit
      "op": "split",                     // split | add-midrail | convert-component | remove-divider
      "target": "cell:0.1",              // componentId (stable topology path — see plugin spec §3)
      "params": { "axis": "vertical", "position": "equal" }
    },
    { "id": "e2", "op": "convert-component", "target": "cell:0.1.0",
      "params": { "to": "sash", "kind": "left-hung" } }
  ],

  "selections": [                        // scoped option answers (semantics: option-schema.md §7)
    { "optionKey": "glazing.glass-type", "choiceKey": "glass-4-20-4-lowe" },              // item-level
    { "optionKey": "glazing.glass-type", "choiceKey": "glass-obscure", "scope": "cell:0.0/glass" },
    { "optionKey": "profile.colour-external", "choiceKey": "colour-anthracite" },
    { "optionKey": "hardware.handle", "choiceKey": "handle-white-inline",
      "scope": "sash:*", "appliedVia": "all-of-type" },   // "All sashes" apply-scope
    { "optionKey": "placement.location", "value": "Kitchen rear" }   // text/number options use value
  ]
}
```

Rules:

- `selections` is a **flat list**; uniqueness key = `(optionKey, scope)`. Setting again replaces.
- `scope` values: absent (item), a `componentId`, or `<type>:*` (recorded when the user chose an
  "all of type" apply-scope — kept expanded-at-resolve so components added later inherit it).
- `topologyEdits` reference componentIds valid **at the time of the edit**; the adapter applies
  them in order and re-derives ids after each (documented in adapter contract). The UI never
  hand-writes these — it records what the user clicked.

## 3. `ResolvedLineItem` (computed — returned by the resolver, cached on the row)

```jsonc
{
  "resolvedAt": "2026-07-25T12:00:00Z",
  "catalogVersion": "<loadCatalog timestamp>",   // provenance of prices used
  "issues": [
    { "severity": "error", "kind": "missing-selection", "optionKey": "hardware.handle",
      "scope": "cell:0.1/sash", "message": "Handle not selected for sash 2" },
    { "severity": "error", "kind": "dimension-out-of-range", "dimensionKey": "widthMm",
      "message": "Width 3400 exceeds family maximum 3000" },
    { "severity": "warning", "kind": "constraint", "constraintId": "max-sash-weight",
      "message": "Sash weight 36.2 kg exceeds 34 kg top-hung limit",
      "source": "HAWDIO printed p70" }
  ],
  "invalidDimensions": false,            // rollups mirroring the reference flags; true ⇒ blocks
  "invalidSpec": true,                   //   confirm (NOT preview)
  "pricing": { /* engine PricingResult verbatim: lines, totals, colour uplifts */ },
  "summary": {                           // cheap render data for lists/basket rows
    "sizeLabel": "1200 x 1200",
    "colourLabel": "White (in) / Anthracite (out)",
    "leafCount": 3,
    "glassSizes": [ { "componentId": "cell:0.0/glass", "wMm": 430, "hMm": 630 } ]
  },
  "geometrySvg": { "external": "<svg…>", "schematic": "<svg…>" }   // optional, size-gated; UI can
                                         // also fetch views separately (phase-5)
}
```

## 4. Resolve pipeline (pure, in `src/designer/`)

```
LineItemDraft
  → validate dimensions against descriptor            (Issues)
  → adapter.applyEdit × topologyEdits                 (working CellNode topology)
  → resolve selections (option-schema §7)             (effective values + Issues)
  → map engineEffects → QuoteInput                    (glassKey/colour/cill/overrides/hardware…)
  → solve(quoteInput)                                 (existing pure engine — UNCHANGED entrypoint)
  → evaluate family constraints on solved geometry    (Issues; e.g. sash size/weight limits)
  → assemble ResolvedLineItem
```

Everything above is synchronous + pure (catalog passed in, no I/O) → trivially unit-testable and
usable both server-side (API) and — if ever needed — client-side.

## 5. API

| Route | Purpose |
|---|---|
| `POST /api/line-items/resolve` | **Stateless**: body = `LineItemDraft`, returns `ResolvedLineItem`. Powers the live designer (debounced, like `/api/quote` today). Public like `/api/quote`. |
| `POST /api/orders/:id/line-items` | Persist a draft (+ server-side resolve; rejects `severity:error` issues? **No** — drafts may carry errors; confirm rejects). Auth’d. |
| `PUT /api/orders/:id/line-items/:itemId` | Replace the draft (re-resolve, re-cache). |
| `DELETE /api/orders/:id/line-items/:itemId` | Remove. |
| `POST /api/orders/:id/confirm` | EXTENDED: for designer line items, re-resolve each; any `error` issue ⇒ 422 with the issues; else snapshot documents (existing 7-doc flow). |

Existing `/api/orders/:id/items` (legacy `/quote` items) stays untouched; both item kinds may
coexist in one order (see `data-model.md` §3 for the storage split).

## 6. Lifecycle & immutability

- **Draft order**: line items re-resolve freely; cached `ResolvedLineItem` refreshes on write and
  on catalog changes (lazily — cache carries `catalogVersion`; stale ⇒ re-resolve on read).
- **Confirmed order**: existing repo invariant — immutable snapshot. The draft JSON, resolved
  JSON, and documents freeze. Price changes never retro-apply.
- **Duplicate line item** = copy the `LineItemDraft` verbatim (stable keys make this safe — the
  reference system's GUID-bound spec cannot do this cleanly; ours must, it's a headline UX win).
