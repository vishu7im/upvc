# COMPONENT LIBRARY

> **Phase 4 component contract — owner-approved, 2026-08-07.**
>
> The implementation is `web/components/v2/**`. It consumes only the V2 token sheet, V2 helpers,
> React/Next primitives, and the approved seam. It never imports V1 UI, routes, icons, toast, or
> backend code.

## 1. Apply this contract

1. Pick the screen frame and collection pattern using `UI_GUIDELINES.md` U-7/U-9.
2. Compose the screen from the layout primitives here; do not create route-local spacing wrappers.
3. Give each server-backed region an explicit ready/loading/empty/error `ContentStatus`.
4. Give each answerable field exactly one `ControlStateProps` branch from `state.tsx`.
5. Supply data, destinations, labels, and handlers. Components never infer permissions or domain
   behaviour.
6. If a needed visual cannot be expressed through these finite props, change this contract and its
   evidence before adding a local class or inline style.

The public entry point is `web/components/v2/index.ts`. Consumers should normally import from it.

## 2. C-1…C-9 decision register

| ID | Decision | Status |
|---|---|---|
| **C-1** | Ship the layout/action/feedback/field/card/table/shell/drawer/toast kit below. Defer Wizard and Modal; gate Timeline; leave the family descriptor renderer to M8 | Decided |
| **C-2** | Generalise the Designer's state and field contracts now, not its family-specific renderer | Decided |
| **C-3** | `DataTable` columns are data; search/sort are server-owned URLs/forms; no client-side data copy | Decided |
| **C-4** | Do not ship a Wizard. Phase 2 specifies one workspace with disclosure, not a fixed linear sequence | Decided |
| **C-5** | The answer-state discriminated union and all `data-v2-state*` output live only in `state.tsx` | Decided |
| **C-6** | Fork both icons and toast: retain the useful behaviour, not V1 styling/imports | Decided |
| **C-7** | Enforce sizing/elevation through component-owned classes and finite variants; expose no `className`, `style`, raw size, shadow, or radius prop | Decided |
| **C-8** | Components live in `web/components/v2/**`; view-only helpers live in `web/lib/v2/**`; seam-only layering is mandatory | Decided |
| **C-9** | Use the composition rules in §6; no nested cards, nested drawers, or page-level stacks of competing elevation | Decided |

### C-1 · What ships now

**Ships in M4:** `PageFrame`, `PageHeading`, `Section`, `Stack`, `Cluster`, `Grid`; `Button`,
`ButtonLink`, `IconButton`, the isolated `V2Icon` set; `Alert`, `EmptyState`, `ErrorState`,
`Skeleton`, `LoadingState`, `ContentState`; `ControlStateBoundary`, `TextField`, `SelectField`,
`TextAreaField`, `CheckboxField`; `Card`, `MetricCard`, `StatusChip`; `DataTable`; `Sidebar`,
`Header`; `Drawer`; `ToastProvider`, `ToastViewport`, and `useToast`.

**Does not ship:**

- **Wizard:** Phase 2 asks for Standard/Custom disclosure inside one configure workspace. It does
  not prove a forced sequence; a smart form/workspace is the right model.
- **Modal:** Phase 2 proves no blocking-dialog need and V1 deliberately prefers inline confirms.
- **Timeline:** G-3 remains open; the backend has Draft/Confirmed only. A timeline would invent
  production state.
- **Family option renderer:** M4 generalises the state/field mechanics. M8 maps the API's display
  descriptors to them when the wrapped configurator is built, without hardcoded option keys.

### C-2 and C-5 · One non-bypassable state grammar

`ControlStateProps` is a discriminated union:

```ts
{ state?: "default" }
{ state: "changed"; stateMessage?: string; onReset: () => void }
{ state: "attention" | "error"; stateMessage: string }
```

The union makes reset mandatory for Changed and a specific message mandatory for Attention/Error.
`ControlStateBoundary` supplies the visible state name, state surface/border, association ID, and
Reset action. Only `web/components/v2/state.tsx` may render `data-v2-state` or
`data-v2-state-label`; `npm run check:v2` rejects another source.

This is the reusable lesson from the Designer's `option-row.tsx`. The API-driven display mapper
remains family work; the state rules no longer do.

### C-3 · DataTable stays server-owned

Columns are an ordered data array. A sortable heading receives a complete `href` and accessible
label; search receives a real GET `action`, label, parameter and default query. The component does
not sort, filter, paginate, fetch, or cache records. That preserves the server's scoped result set.

Every body cell links to the supplied row destination for pointer convenience. Only the first is in
the tab/accessibility tree; all duplicates use `tabIndex=-1` and `aria-hidden`. The required
`getRowLabel` gives the one reachable link a complete spoken summary. Each row therefore has one
keyboard destination, not one duplicate per column.

### C-6 · Icons and notifications are forked

U-11 requires a new V2 icon language, so `icons.tsx` contains a deliberately small, current-colour
set. V2 does not import `web/components/icons.tsx`. Toast preserves V1's useful non-blocking/live-
region behaviour but is rebuilt against V2 tones, sizing, focus and elevation; it does not import
`web/components/toast.tsx`.

### C-7 and C-8 · Finite styling and layering

- No public prop accepts `className`, `style`, pixels, colour, shadow, radius, control height, or
  arbitrary elevation.
- Button variants are Primary/Secondary/Ghost/Danger; Card elevation is Flat/Raised; Drawer and
  Toast own elevation 2. Modal elevation 3 is absent because Modal is absent.
- Default controls/rows resolve to 48/56 px. Only an approved ancestor
  `data-v2-density="admin"` can switch the token values to 44/44 px.
- All component selectors live in `web/app/v2.css`, are `[data-v2]` scoped, and consume
  `--v2-*` tokens.
- `components/v2/**` may import another V2 component, `lib/v2/**`, the shared seam, React, or Next.
  It may not import V1 components/routes, `src/`, or backend/database code.

`web/lib/v2/present.ts` currently contains only display fallback/initial helpers. It calculates no
price, dimension, limit, permission, or fabrication value.

## 3. Public component APIs

### 3.1 Layout

| Export | Required / finite props | Use | Do not use |
|---|---|---|---|
| `PageFrame` | `width: reading \| detail \| wide` | One content frame per screen; U-7 chooses it | Nested inside Card/Drawer |
| `PageHeading` | `title`; optional `eyebrow`, `description`, `actions` | One screen heading and its one primary action | As a card heading |
| `Section` | `children`; optional `title`, `description`, `actions` | Major page region; owns the 40 px section rhythm | To add arbitrary gaps |
| `Stack` | `gap: related \| form \| card \| section` | Vertical relationships from U-2 | Route-local margin utilities |
| `Cluster` | children only | Wrapping action/status row | Dense data layout |
| `Grid` | `columns: auto \| two \| three` | Responsive peer surfaces | Table column alignment |

Layout primitives do not load data, so empty/loading/error are not meaningful states. Their
children own those states. Native landmarks and heading levels provide the accessibility contract.

### 3.2 Actions and icons

| Export | Required / finite props | States and contract |
|---|---|---|
| `Button` | label; variant; optional icon; `loading` + `loadingLabel`; native button semantics excluding styling props | Ready/loading/disabled. Failure is rendered in the affected region, never hidden in the button |
| `ButtonLink` | label, working `href`, non-danger variant, optional icon/download | Destination is mandatory, so a link cannot be visually live and functionally dead. `/api/*` destinations are never prefetched because HTML/PDF endpoints are user actions, not app-page data |
| `IconButton` | `label`, `tooltip`, `icon`; native handlers excluding styling props | Always 44 × 44 px; accessible name and visible browser tooltip are mandatory |
| `V2Icon` | finite `V2IconName` | Decorative inside labelled controls; `aria-hidden`, `currentColor`, 24 px |

An empty action is invalid rather than a state. Loading applies only to Button; errors belong in
Alert/ErrorState or the bound field. This keeps the cause and recovery readable.

### 3.3 Feedback and async content

| Export | API | Accessibility / state behaviour |
|---|---|---|
| `Alert` | `title`, body, `tone: neutral \| success \| warning \| error` | Text + icon + tone; error uses `role=alert`, others `role=status` |
| `EmptyState` | title, description, optional working action | Honest absence plus one next step; no decorative dead CTA |
| `ErrorState` | specific title/description and required recovery action | `role=alert`; recovery is a real link or handler |
| `Skeleton` | `shape: text \| block \| row \| circle` | Static and `aria-hidden`; never shimmers |
| `LoadingState` | label, 1–5 rows | `aria-busy`, labelled status, static Skeleton children |
| `ContentState` | discriminated ready/loading/empty/error union | The common state switch used by Card/MetricCard |

### 3.4 Fields

`TextField`, `SelectField`, `TextAreaField`, and `CheckboxField` require a visible 16 px label and
accept `hint`, `required`, and the finite `ControlStateProps`. Text accepts an optional unit suffix;
the suffix is also included in the accessible label. Input/select/textarea attributes are allowed
except styling and size escape hatches.

- Hints and non-default state messages are joined in `aria-describedby`.
- Error sets `aria-invalid`; native `required` remains present.
- Checkbox's visible mark is 24 px, but its label produces a ≥44 px combined target.
- Changed always has Reset; Attention tells what is needed; Error states cause and recovery.
- An empty string is a field value, not an async empty state. Loading/error for a form region use
  `ContentState` around the field group.

### 3.5 Cards and status

| Export | API | Use / state contract |
|---|---|---|
| `Card` | optional title/description/actions; `elevation: flat \| raised`; `ContentStatus` | One coherent concern; built-in ready/loading/empty/error |
| `MetricCard` | label, server-returned value, optional context/icon; `ContentStatus` | One traceable metric; built-in ready/loading/empty/error; never computes it |
| `StatusChip` | label; neutral/success/warning/error tone | Server-returned status with visible text + dot + border/surface, never colour-only |

StatusChip has no async states because it is a leaf value; its owning Card/Table region supplies
loading/empty/error. It never maps domain values to tones—the caller passes both the server label
and chosen semantic tone.

### 3.6 DataTable

```ts
DataTable<Row>({
  caption,
  columns: Array<{ id; header; cell; role?; sort?: { href; direction?; label } }>,
  rows,
  getRowKey,
  getRowHref,
  getRowLabel,
  search?: { action; label; placeholder; parameter?; defaultValue? },
  state?: ContentStatus,
  empty: { title; description }
})
```

Use it only when U-9 rule 1 selects Table. It owns ready/loading/empty/error, local labelled
horizontal scrolling, server GET search/sort hooks, numeric alignment, fixed role widths, and one
keyboard row destination. It deliberately has no client-sort prop, raw column-width prop,
`renderActions` escape hatch, or data-fetch callback.

Do not use it for one object's definition list, a two-value list, image-led artifacts, or an
editable permission/pricing grid. The last two approved admin grids get dedicated M11/M12
compositions under `data-v2-density="admin"`.

### 3.7 Shell parts

`Sidebar` receives `brand`, already permission-filtered/transformed `sections[]`, `activeHref`,
optional controlled collapse/navigation callbacks, and an optional working version link. Items are
supplied data (`id`, `label`, `href`, optional marker); the component contains no menu, module,
role, permission, or icon mapping. An unknown item is therefore renderable without component work.

`Header` receives optional breadcrumbs, optional **real** GET search, optional working primary
action/notifications, required profile destination, and optional menu handler. Omitting Search
renders no search. This is how D-011 stays honest: Phase 5 decides permission and supplies the
order-search contract; Header never guesses it.

Shell loading/auth/error belongs to the Phase 5 layout boundary. Sidebar/Header are presentation
of an already-established session, so duplicating whole-app async states inside each would create
conflicting chrome. Empty navigation is valid and renders an empty `<nav>`; profile remains.

### 3.8 Drawer and notifications

`Drawer` requires controlled `open`, title, children and `onClose`; description/footer are
optional. It owns dialog naming, `aria-modal`, Escape, focus entry/trap/return, backdrop close,
scroll containment and elevation 2. It preserves page context; it never nests another Drawer.
Closed is its empty state. Loading/error/empty content is composed inside with `ContentState`.

`ToastProvider` owns a finite list and exposes `showToast`/`dismissToast` through `useToast`.
Neutral/Success/Warning auto-dismiss after six seconds; Error persists until dismissed. Every
toast has visible title, optional description, semantic live role, icon + text + surface, and a
44 px labelled dismiss control. Zero toasts is its valid empty state; Toast is not used as the sole
error or the only confirmation of a state change.

## 4. State coverage matrix

| Family | Ready | Loading | Empty | Error |
|---|---|---|---|---|
| Card / MetricCard / DataTable | Built in | Built in | Built in | Built in with recovery |
| Form region | Fields composed normally | `ContentState` around group | `ContentState` where meaningful | Field Error or region ErrorState |
| Sidebar / Header | Supplied authenticated data | Phase 5 layout boundary | Empty nav/search absent is valid | Phase 5 layout boundary |
| Drawer | Open | Compose LoadingState | Closed or compose EmptyState | Compose ErrorState |
| Toast | Visible list | Neutral progress message if needed | Zero messages | Persistent Error toast plus in-context error |
| Button / Chip / Icon / layout | Ready/disabled/value | Button has loading | Not a data owner | Owning region renders cause/recovery |

The documented N/A cells are intentional ownership boundaries, not missing visuals. Leaf controls
must not invent an “empty screen,” and shell pieces must not compete with the layout's auth/error
boundary.

## 5. Accessibility and keyboard contract

- Native controls/links/headings/landmarks first; ARIA supplies names and associations.
- Every interactive target is at least 44 px; default controls are 48 px.
- Focus-visible is the global 3 px token ring with 2 px offset.
- DataTable has one reachable row destination and a labelled, focusable local scroll region.
- Drawer handles focus entry, Tab/Shift+Tab containment, Escape, and focus return.
- State/semantic tone always includes words and a second visual cue; never colour only.
- Icons are hidden when decorative; an icon-only button cannot exist without label + tooltip.
- Skeleton is static, reduced motion remains supported, and no hover-only information exists.

## 6. C-9 composition rules

1. A screen owns one `PageFrame`, one `PageHeading`, then sibling `Section`s.
2. A Section may contain one collection or a Grid/Stack of peer concerns. It may not contain a
   Card whose only child is another Card.
3. Card contains fields, a definition block, one small list, or one coherent action set. A full
   DataTable is a Section-level collection, not a decorative Card inside another surface.
4. MetricCards may appear only as peer Grid children and never contain actions or another surface.
5. Sidebar and Header appear only in the shell composition. Routes supply data; neither is nested
   in Card/Drawer.
6. Drawer contains one detail/task composition. It cannot contain PageFrame, Sidebar, Header,
   another Drawer, or a competing overlay.
7. Alerts/Toasts do not wrap content. They explain the content region that owns cause and recovery.
8. A section has at most one raised container level. Seven equal raised panels on one detail page
   fail this rule; use Section hierarchy and flat nested wells instead.

## 7. Enforcement and approval evidence

`npm run check:v2` performs both Phase 4 CI gates and extra boundary checks:

- compares V1 plus `src/`/`prisma/` to freeze commit
  `1a9c18a5b7e8ca3295bd8f97880b1179352a8d08`;
- extracts module slugs/role names from the RBAC registry and option keys from catalog option data,
  then rejects exact hardcoded literals in `components/v2/**`;
- rejects V1/backend imports, public `className`/`style` escape props, inline styles, raw component
  colour/shadow declarations, and duplicate `data-v2-state*` implementations.

The approval gallery is rendered from the real React exports by
`web/scripts/render-v2-gallery.tsx` into `Spec/v2/component-library/gallery.html`. It is static
rather than a Next route because Phase 4 explicitly contains no product routing and Phase 5 owns
the first routes. The separate Drawer document and browser captures make the overlay reviewable.

Measured browser evidence at 1280/834 px is in `component-library/screens/gallery-metrics.json`:
16 px body/labels, 48 px controls, 56 px rows, 3 px focus, one reachable link per table row, no page
overflow, local table overflow at 834 px, and a 44 × 48 px Drawer close target.

## 8. Reviewer checklist

- [x] C-1…C-9 each yield one implementation answer
- [x] Every public component has props, states, accessibility, use, and non-use guidance
- [x] A gallery screen is assembled without inline styling or a token bypass
- [x] Every applicable ready/loading/empty/error state is rendered; N/A ownership is documented
- [x] Keyboard target/focus/table/Drawer contracts are measured
- [x] V1, backend, option/module/role, state-grammar, and import-boundary checks pass
- [x] Owner approves the component contract before Phase 5 (2026-08-07: “start next phase now”)
