# UX Design Language — The Designer

> Our own design language for the new Designer module. We adopt the reference system's *concepts*
> (component scoping, schematic view, split modes, grouped options) but NOT its UI. This file is
> the single source for layout, interaction patterns, and visual rules; every UI phase references
> it instead of restating it. Stack: Next.js App Router + Tailwind v4 (existing `web/` app,
> existing shared primitives in `web/components/ui.tsx`, icons in `web/components/icons.tsx`).

## 1. What we deliberately do differently from the reference

| Reference (Quotila/BM-Touch) pain | Our answer |
|---|---|
| Long vertical accordion of dropdowns; every option a same-weight row | **Progressive disclosure**: defaults hidden behind group summaries; only *changed* + *required-unanswered* options surface prominently |
| Modal-ish "Edit measurements" vs "Customise product" vs "Edit components" as separate sequential modes | **One persistent workspace**, three inspector tabs — no mode traps, the canvas never disappears |
| Component editing requires entering a special mode, then clicking | **Always-on canvas selection**: hover highlights, click selects and scopes the inspector; Esc/click-empty deselects back to item scope |
| No search; 22-choice handle dropdowns | **Option search (⌘K / visible search box)** filtering across all groups by option/choice name |
| Numeric-only feedback of invalidity (`invalidSpec` flag) | **Issue list with deep links**: each issue names the option/component, click focuses it and highlights the component on canvas |
| Selected values only visible when a group is expanded | **Summary chips** on collapsed group headers + a running **spec summary sidebar** in review step |
| GUID-driven, copy-unfriendly | Duplicate-item and copy-spec-between-items are first-class actions |

## 2. Workspace layout (desktop ≥1024px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Header: item name/family · size chip · price (live) · Issues(n) ·        │
│         [Add to order] [Save]                                            │
├───────────────┬──────────────────────────────────────────────────────────┤
│ Inspector     │  Canvas                                                  │
│ (380px col)   │   • view switch: External | Internal | Schematic | 3D    │
│               │   • zoom-to-fit SVG preview (existing renderSvg output)  │
│ Tabs:         │   • hover = component outline + name tooltip             │
│  Measurements │   • click = select component (scope inspector)          │
│  Options      │   • drag divider handles = resize spans (existing        │
│  Structure    │     window-designer.tsx drag pattern, reused)            │
│               │   • selection breadcrumb: Item ▸ Sash 2 ▸ Glass          │
│ (scope pill   │                                                          │
│  at top shows │                                                          │
│  current      │                                                          │
│  selection)   │                                                          │
└───────────────┴──────────────────────────────────────────────────────────┘
```

- **Inspector · Measurements**: overall dims (validated inline against descriptor min/max), split
  mode segmented control (By dimensions / Equal split / Equal glass), per-span mm inputs generated
  from topology (editing one recomputes ratios), distance-from-floor, location.
- **Inspector · Options**: option groups from the schema. Collapsed header = name + summary chip
  of non-default values (e.g. "Anthracite · 3 changes"). Search box pinned on top. Scope pill
  ("Whole item" / "Sash 2") controls which scope selections write to; component-scoped options
  render an apply-scope toggle ("This sash / All sashes") per `applyScopes`.
- **Inspector · Structure**: the instant actions (`display:"action"` options) for the current
  selection + the topology-edit history list (each entry removable = undo of that structural
  change).
- **Canvas selection model**: single selection; the selected component drives (a) inspector scope,
  (b) a subtle fill highlight on canvas (our accent at 20% opacity — NOT the reference's opaque
  yellow which hides the component's actual colour).

## 3. Screen flow

```
/designer?family=…&design=…[&orderId=…]        the workspace above
Gallery → "Design in studio" on a quotable DesignCard (parallel to the existing "Configure →"
          which keeps pointing at legacy /quote)
Order detail (draft) → "Add item" → gallery with orderId carried through (existing U4 pattern)
[Add to order] → POST line item → back to order detail (or stay+toast if no orderId: creates draft)
```

No separate "review" page: the header price + issues panel are always live; confirm stays on the
order page (existing flow).

## 4. Visual language

- **Foundation**: existing app shell (top nav, zinc/neutral palette, existing `ui.tsx` buttons/
  inputs/badges). The Designer must feel like a native part of the current app, not a themed
  embed.
- **Canvas**: light neutral background (`zinc-50` dark-aware), generous whitespace, the window SVG
  is the hero. Dimension lines/labels in a muted accent, live-updating.
- **Option controls**: `segmented` for ≤4 choices; `select` for longer lists; `select-image` as a
  grid popover (image/swatch + label, filter chips on top); `toggle` as a switch; `action` as a
  bordered button with icon. All keyboard-operable.
- **State encoding**: default values render muted; user-changed values render emphasised (medium
  weight + accent dot + per-option "reset to default"). Required-unanswered = amber outline.
  Error-issue = red outline. This tri-state (default / changed / attention) is the core visual
  grammar of the inspector.
- **Density**: compact rows (~40px), group virtualisation once a family exceeds ~150 visible
  options (design target: hundreds of options without jank).

## 5. Responsiveness

- **≥1024px**: side-by-side as drawn.
- **768–1023px**: inspector collapses to an overlay sheet from the left, canvas full-width;
  header condenses to price + issues + primary action.
- **<768px (view-mostly)**: canvas + read-only spec summary + price; editing dimensions/options
  possible via full-screen sheets, component selection via tap. Structural editing (drag handles)
  is desktop/tablet-first; mobile gets stepper inputs for spans instead of drag.

## 6. Performance & feedback patterns

- Live resolve: 350ms debounce on `POST /api/line-items/resolve` (matches the existing `/quote`
  configurator's proven pattern); optimistic UI for selections (values apply instantly, price/
  preview update on response; response older than the latest edit is discarded).
- Skeletons for canvas/options on first load (existing `loading.tsx` conventions); resolve
  failures show a non-blocking banner with retry, never wipe the current preview.
- All destructive/structural actions (remove divider, convert component with children) confirm
  inline (popover confirm, not modal) and are undoable via the Structure tab history.

## 7. Accessibility

- Every canvas interaction has a non-pointer equivalent: component list (Structure tab) mirrors
  canvas selection; spans editable numerically; view switch is a tablist.
- Focus-visible rings throughout; option grids are roving-tabindex listboxes; issues panel is an
  `aria-live=polite` region. Colour choices always pair swatch with text label.

## 8. Empty/edge states

- Non-quotable family/design: full designer works, price area shows "Preview only" badge
  (descriptor `engine.quotable:false`), Add-to-order disabled with reason.
- Engine down / resolve 5xx: banner + last-good preview retained.
- Zero-price parts (unpriced catalog): price renders with an "incomplete pricing" tooltip listing
  £0 lines (auditability; golden rule forbids hiding them).
