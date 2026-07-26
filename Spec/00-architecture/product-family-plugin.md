# Product Family Plugin Contract

> How a product family (windows today; doors, partitions, sliding, bay/bow tomorrow) plugs into the
> Designer platform **without UI redesign**. Self-contained; read `overview.md` §5 for vocabulary.

## 1. The contract in one sentence

A family = **one `ProductFamilyDescriptor` JSON** (+ its option definitions, see
`option-schema.md`) + **an engine capability it maps onto**. The designer UI, the resolver, the
line-item store, and the basket are all family-agnostic and render/behave purely from the
descriptor.

## 2. `ProductFamilyDescriptor` schema

Stored in DB (`product_family` table, JSONB payload — see `data-model.md`), seeded from
TypeScript/JSON source files (repo convention: hardcoded catalog files are the seed source of
truth). Served by the catalog loader and `GET /api/families`.

```jsonc
{
  "familyKey": "casement-window",            // stable slug, referenced by line items
  "name": "Casement Window",
  "status": "active",                        // active | hidden | deprecated
  "systemIds": ["sunnyplast-70"],            // profile systems this family supports
  "designSource": {                          // where starting topologies come from
    "mode": "design-gallery",                // design-gallery | fixed-topology | blank-canvas
    "productIds": ["<catalog product uuid>"] // gallery products offering starting designs
  },

  // ---- Dimensions the measurements panel renders ------------------------
  "dimensions": [
    { "key": "widthMm",  "label": "Overall width",  "unit": "mm", "required": true,
      "min": 400, "max": 3000, "defaultFrom": "design" },   // design defaults (design.defaultWidthMm)
    { "key": "heightMm", "label": "Overall height", "unit": "mm", "required": true,
      "min": 400, "max": 2500, "defaultFrom": "design" },
    { "key": "distanceFromFloorMm", "label": "Distance from floor", "unit": "mm",
      "required": false, "min": 0, "max": 9999, "informational": true } // docs-only, no engine effect
  ],
  // Span dimensions (per-divider widths/heights) are NOT listed here — they are derived from the
  // line item's topology at runtime (n dividers ⇒ n+1 spans) and rendered generically.

  "splitModes": ["byDimensions", "equalSplit", "equalGlass"],  // which split-position modes the UI offers
  // byDimensions → splitRatios from user mm input; equalSplit → equal daylight; equalGlass →
  // iterative solve so finished GLASS widths match (see phase-4 spec; flag: needs engine iteration)

  // ---- Component model --------------------------------------------------
  "componentTypes": [
    // What the click-to-select canvas can address, and what the option system can scope to.
    { "type": "frame-edge", "sides": ["top","bottom","left","right"] },
    { "type": "transom" }, { "type": "mullion" },
    { "type": "sash", "kinds": ["top-hung-left","top-hung-right","left-hung","right-hung","fixed"] },
    { "type": "glass" }, { "type": "panel" },
    { "type": "cill" }, { "type": "addon", "sides": ["top","bottom","left","right"] }
  ],
  "componentConversions": [
    // Component Type switcher (reference UI: Glass / Sash / Flat panel)
    { "from": "glass", "to": ["sash", "panel"] },
    { "from": "sash",  "to": ["glass", "panel"] },
    { "from": "panel", "to": ["glass", "sash"] }
  ],

  // ---- Topology capabilities (what instant actions are legal) ----------
  "topology": {
    "guillotineSplits": true,      // add transom / add mullion
    "midrails": true,              // add midrail inside a sash (engine: CellSpec.midrails)
    "slidingPanels": false,        // sliding family only
    "maxNestingDepth": 3
  },

  // ---- Option groups this family shows (defined in option-schema.md) ---
  "optionGroupKeys": [
    "profile-ancillary", "hardware", "glazing", "general", "placement"
  ],

  // ---- Views the preview canvas offers ----------------------------------
  "viewModes": ["external", "internal", "schematic", "3d"],

  // ---- Engine adapter ----------------------------------------------------
  "engine": {
    "adapter": "cellnode",         // cellnode (casement/door/french) | sliding | future adapters
    "quotable": true               // false ⇒ configurable + previewable but not priceable/orderable
  },

  // ---- Constraint hooks (family-level validation, JSON rules) -----------
  "constraints": [
    // Evaluated by the resolver against the draft line item; failures become Issues.
    // Rule DSL defined in option-schema.md §6.
    { "id": "max-sash-width", "severity": "error",
      "when": { "componentType": "sash" },
      "assert": { "lte": ["component.widthMm", 715] },
      "message": "Side-hung sash exceeds 715 mm maximum width",
      "source": "HAWDIO printed p70 size-limitation table" }
  ]
}
```

### Schema rules

- Everything above is **declarative data**. If a new family needs a *behaviour* the platform lacks
  (e.g. a new geometry kind), that behaviour is added as a new **engine adapter or topology
  capability flag**, then becomes available to all families declaratively.
- `defaultFrom: "design"` reuses the existing `design.defaultWidthMm/defaultHeightMm` columns.
- Constraints must carry a `source` citation when they encode a fabrication rule (golden rule).

## 3. Engine adapters

An adapter maps the family-agnostic line item onto a concrete engine path. Only two exist at first,
both thin, in `src/designer/adapters/`:

| Adapter | Families | Maps to |
|---|---|---|
| `cellnode` | casement-window, entrance-door, french-door | existing `Design.topology` (`CellNode` tree) + `solve()`; topology edits → tree transforms; spans → `splitRatios` |
| `sliding` | sliding-patio | existing `kind:"sliding"` node + panel boundaries (`root.b{i}` splitRatios) |

An adapter implements one pure interface:

```ts
interface EngineAdapter {
  // Build the engine QuoteInput from a resolved line item (pure).
  toQuoteInput(item: ResolvedLineItem, ctx: CatalogSnapshot): QuoteInput;
  // Apply a topology edit (add-transom, convert-component, …) to the item's working topology.
  applyEdit(topology: CellNode, edit: TopologyEdit): CellNode;      // returns a NEW tree (immutably)
  // Enumerate addressable components with stable ids + hit-test rects for the canvas.
  listComponents(geometry: QuoteGeometry): ComponentRef[];
}
```

`ComponentRef` = `{ componentId, type, label, rect, path }` where `componentId` is **derived from
topology position** (e.g. `cell:0.1/sash`, `edge:top`, `divider:0.h`) so it survives re-solves and
serialization — never a random uuid (the reference system's GUID-per-component approach breaks
copy/re-quote flows; ours must not).

## 4. What adding a NEW family costs (the acceptance bar)

Phase 7 (`01-windows-module/phase-7-extensibility-proof.md`) proves this contract by registering
`entrance-door` as a second family. The bar it must meet — and the bar every future family must
meet:

| Artifact | New code? |
|---|---|
| `product_family` descriptor row (seeded) | JSON only |
| Option groups/options/choices for the family | JSON only |
| Engine adapter | **Only if** no existing adapter fits (doors: reuse `cellnode` — zero code) |
| Designer UI | **Zero changes** |
| Line-item store/API/basket | **Zero changes** |

If executing a future-family task appears to require designer-UI edits, the descriptor schema is
missing a concept — extend the schema (a platform change, this folder), don't special-case the UI.

## 5. Non-goals

- The descriptor does not describe *fabrication math* — that stays in the engine + catalog
  (deductions, weld allowances, hardware rules), calibrated per the golden rule.
- No plugin marketplace/dynamic code loading. "Plugin" means data-driven registration, in-repo.
