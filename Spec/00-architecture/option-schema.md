# Option System Schema (JSON-Driven)

> The single most important Task-1 artifact: the JSON schema for option groups, options, choices,
> scoping, filters, visibility, instant actions, and validation. The designer UI renders this
> schema generically; product families supply instances of it. Self-contained.

## 1. Concepts (learned from the reference, redesigned for us)

The reference system (`collections/windows/jobitem.json`, a BM-Touch line item) encodes a window as
41 "specification" entries. We adopt its proven concepts and drop its weaknesses:

| Reference concept | We keep? | Our redesign |
|---|---|---|
| Option groups with order + collapsed state | ✅ | `OptionGroup`, plus icon + description for discoverability |
| `displayType` 1/2 (image vs plain dropdown) | ✅ | explicit enum: `select`, `select-image`, `segmented`, `toggle`, `number`, `text`, `action` |
| `components[]` scope per option | ✅ | scoping is on the **selection**, not duplicated per-option-instance (the reference repeats the whole "Sash Type" option once per sash — we define it once with `scope: "component"`) |
| `filters[]` (chips: White / Standard Colour) | ✅ | `OptionDef.filters` + `choice.filterKeys[]` (a choice may match several) |
| apply-scope rules ("This Frame" / "All Frames") | ✅ | `applyScopes` on the option; selection stores which was used |
| `optionSetByType:2` + `instantSelectionOptionItemId` (Add transom…) | ✅ | first-class `action` display type with a typed `TopologyEdit` payload |
| `mustBeSelected`, validation regex/maxLength | ✅ | `required` + `validation` |
| `visibilityTypeId` (opaque int) | ✅ concept | transparent JSON **rule DSL** (§6) |
| `omitFromSummary/Reports` | ✅ | `presentation.omitFromSummary/omitFromDocuments` |
| GUID soup (every option/choice/component a uuid) | ❌ | stable human-readable keys (`hardware.handle`, `choice:handle-white-inline`) |
| Options duplicated per component instance | ❌ | one definition + runtime scoping |
| Server-opaque semantics (int enums) | ❌ | self-describing JSON |

## 2. Entities & storage

Three entities, stored in DB, seeded from source JSON (repo convention: seed files are the source
of truth), loaded by the catalog loader into memory, served read-only to the UI:

```
option_group (1) ──< option_def (1) ──< option_choice
```

See `data-model.md` for tables. TypeScript types live in `src/designer/option-types.ts` (new).

## 3. `OptionGroup`

```jsonc
{
  "key": "hardware",
  "name": "Hardware",
  "order": 2,
  "icon": "handle",                  // designer icon slug (web/components/icons.tsx)
  "defaultCollapsed": true,
  "scope": "mixed"                   // item | component | mixed — drives which inspector tab shows it
}
```

## 4. `OptionDef`

```jsonc
{
  "key": "hardware.handle",
  "groupKey": "hardware",
  "name": "Handle",
  "order": 20,
  "display": "select-image",         // select | select-image | segmented | toggle | number | text | action
  "required": false,                 // required + unanswered ⇒ Issue(severity=error) at confirm
  "scope": {
    "level": "component",            // item | component
    "componentTypes": ["sash"],      // which component types it appears on (component level only)
    "applyScopes": ["this", "all-of-type"]  // UI offers "This sash" / "All sashes"; default first
  },
  "filters": [                        // optional chip row above the choice list
    { "key": "white", "label": "White" },
    { "key": "standard-colour", "label": "Standard Colour" }
  ],
  "visibility": { "eq": ["item.family", "casement-window"] },   // rule DSL §6; absent = always
  "validation": { "min": 0, "max": 9999, "regex": null, "maxLength": null },  // by display type
  "presentation": { "omitFromSummary": false, "omitFromDocuments": false,
                    "helpText": "Espagnolette handle fitted to each opening sash." },
  "pricing": { "mode": "catalog" }   // catalog (choice.partKey drives price) | none (cosmetic/informational)
}
```

## 5. `OptionChoice`

```jsonc
{
  "key": "handle-white-inline",
  "optionKey": "hardware.handle",
  "label": "White Inline Handle",
  "order": 1,
  "isDefault": false,
  "filterKeys": ["white"],
  "image": { "kind": "catalog-asset", "ref": "assets/hardware/handle-white-inline.png" },
  "swatchHex": null,                 // colour choices render a swatch instead of an image
  "partKey": "hw-handle-inline-white",  // catalog hardware/part key → pricing + BOM (golden rule:
                                        //   price lives in the catalog, NEVER inline here)
  "engineEffect": {                  // how the resolver maps this choice into QuoteInput / BOM
    "kind": "hardware-substitution", // hardware-substitution | glass-key | colour-key | cill-key |
                                     // profile-substitution | bom-line | none | topology-edit
    "params": { "slot": "handle" }
  },
  "visibility": null                 // choices can also be rule-gated (e.g. colour availability)
}
```

`engineEffect.kind` is the **closed enum the resolver understands**. Adding a new kind is a platform
change (code); adding options/choices within existing kinds is pure data. Initial kinds map 1:1 to
capabilities the engine already has (glassKey, colourKey/colourKeyOutside, cillKey, hardware map,
per-part substitutions via Custom-mode overrides, plain BOM add-lines) — phase 1 lists the exact
set with the engine touch-points.

### `action` display type (instant actions)

```jsonc
{
  "key": "structure.add-transom",
  "groupKey": "structure",
  "name": "Add transom",
  "display": "action",
  "scope": { "level": "component", "componentTypes": ["glass", "panel"] },
  "action": {                        // typed TopologyEdit template
    "op": "split",                   // split | add-midrail | convert-component | remove-divider
    "params": { "axis": "horizontal", "position": "equal" }   // or "at-ratio" with user input
  }
}
```

Actions never set a value; executing one appends a `TopologyEdit` to the line item (see
`line-item-schema.md` §4) and triggers a re-resolve. Remove/undo = removing the edit from the list.

## 6. Visibility & constraint rule DSL

One small JSON predicate language shared by option visibility, choice visibility, and family
constraints (`product-family-plugin.md` §2). Deliberately minimal — no loops, no arithmetic beyond
comparison, totally serializable:

```jsonc
{ "all": [ ... ] }   { "any": [ ... ] }   { "not": { ... } }
{ "eq":  [lhs, rhs] } { "neq": [...] } { "lt": [...] } { "lte": [...] } { "gt": [...] } { "gte": [...] }
{ "in":  [lhs, [v1, v2]] }
{ "selected": ["<optionKey>", "<choiceKey>"] }        // another selection's current value
{ "exists": ["<optionKey>"] }
```

**Operand paths** (strings resolved against an evaluation context the resolver builds):
`item.family`, `item.system`, `item.widthMm`, `item.heightMm`, `component.type`,
`component.kind`, `component.widthMm`, `component.heightMm`, `component.areaM2`,
`selection.<optionKey>` (choiceKey or raw value).

Evaluator: one pure function `evalRule(rule, ctx): boolean` in `src/designer/rules.ts`, unit-tested
exhaustively (it gates fabrication constraints — wrong evaluation = wrong windows). Unknown
operators/paths throw (fail-loud), never silently return false.

## 7. Resolution semantics (how selections become answers)

For each option, for each component in its scope (or the item):

1. **Effective value** = the most specific applicable selection:
   scoped-to-this-component > scoped-via-"all-of-type" > item-level > `isDefault` choice > unset.
2. Unset + `required` ⇒ `Issue{severity:"error", kind:"missing-selection"}` — blocks confirm, not
   preview (matches reference `invalidSpec` behaviour; issues carry option/component refs so UI
   can deep-link).
3. Hidden-by-visibility options are skipped entirely (no issue even if required).
4. Every effective value maps through `engineEffect` into the growing `QuoteInput`/BOM delta.
   Conflicts (two selections writing the same slot on the same component) are impossible by
   construction of rule 1 — the resolver asserts this invariant.

## 8. Worked example (window seed extract)

The initial windows-family seed (phase 1) reproduces the reference inventory in OUR schema. Extract:

| Group | Option (scope) | Display | Choices (source) |
|---|---|---|---|
| profile-ancillary | Colour external / internal (item) | select-image + swatch | catalog `ColourOption`s (existing M5 entity — choices GENERATED from catalog, not duplicated) |
| profile-ancillary | Frame profile per side (component: frame-edge) | select | catalog frame parts |
| profile-ancillary | Cill (item) | select | existing cill parts + "No cill" |
| profile-ancillary | Add-on per side (component: frame-edge) | select | add-on profiles (catalog additions — phase 1 seeds "none" only until parts exist) |
| profile-ancillary | Bead (item) | select | bead-28 / bead-32 |
| profile-ancillary | Sash type (component: sash) | segmented | 5 casement kinds (existing SashKind) |
| hardware | Locking / Handle / Hinge (component: sash) | select(-image) | catalog hardware |
| hardware | Ventilator (component: frame-edge, sash) | select | catalog hardware + "none" |
| glazing | Glass type (component: glass; applyScopes this/all) | select | catalog glass rows |
| glazing | Glazing method (item) | segmented | glazed / unglazed (BOM effect: omit glass lines) |
| structure | Add transom / mullion / midrail (component: glass) | action | TopologyEdit templates |
| structure | Component type (component: glass, sash, panel) | segmented | conversions per descriptor |
| general | Drainage (item) | segmented | concealed / face / none (documents-only note until calibrated) |
| placement | Location (item) | text+suggest | suggestion list + free text, maxLength 50 |

Golden-rule note: options whose engine/BOM effect is **not yet calibrated** (drainage machining,
add-ons) are seeded with `pricing.mode:"none"` + `presentation.helpText` flagging them as
recorded-on-documents-only. They appear, persist, and print — they just don't fabricate until
calibrated. `questions.md` Q7 tracks them.

## 9. Admin surface

Extend the existing admin catalog pattern (`src/api/catalog.ts` + `/admin/catalog`): CRUD for
groups/options/choices (zod-validated, `loadCatalog()` after write — same refresh mechanism as
pricing edits). JSON import/export of a family's full option set for backup/reuse. Phase-1 scope:
read + edit existing; creating NEW options via admin UI is stretch (seed files cover creation).
