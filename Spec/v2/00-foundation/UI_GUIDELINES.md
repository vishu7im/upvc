# UI GUIDELINES

> **Phase 3 design-system contract — owner approved 2026-08-07.**
>
> These rules apply only below a `[data-v2]` root. They turn the ratified principles in
> `DESIGN_PRINCIPLES.md` into values and decisions that Phase 4 can enforce. V1 and the fabrication
> engine remain unchanged.

## 1. How to use this document

For a V2 screen, apply the decisions in this order:

1. Choose a reading, detail, or wide content frame under **U-7**.
2. Choose exactly one collection pattern under **U-9**.
3. Use default density unless the route is on the **U-10** allowlist.
4. Use the type, spacing, target, radius, elevation, and colour tokens; do not invent values.
5. Give every control one state from **U-8** and every screen one primary action.
6. Apply the responsive rule and then run the checks attached to the relevant decisions.

That order is the reproducibility contract: two implementers given the same content should choose
the same frame, collection pattern, density, tokens, and state treatment. If the rules do not yield
one answer, add a decision here before adding an exception in a component.

The normative token source is [`web/app/v2.css`](../../../web/app/v2.css). The approval specimen is
[`design-system/specimen.html`](../design-system/specimen.html), and the measured colour evidence is
[`design-system/contrast-report.md`](../design-system/contrast-report.md).

## 2. Decision register

| ID | Decision | Status | Owner |
|---|---|---|---|
| U-1 | 16 px body and labels; 14 px only for non-essential metadata; minor-third headings | Decided | V2 design-system owner |
| U-2 | 4 px spacing base with the fixed rhythm below | Decided | V2 design-system owner |
| U-3 | 48 px default controls; 44 px approved admin controls; never below 44 px | Decided | V2 component-library owner |
| U-4 | One neutral ramp, one blue accent, success/warning/error only | Decided | V2 design-system owner |
| U-5 | One 10 px radius plus a pill/circle exception | Decided | V2 design-system owner |
| U-6 | Four elevations, selectable only by `data-v2-elevation` | Decided | V2 component-library owner |
| U-7 | 760/1080/1280 px frames and 12/8/4-column responsive grid | Decided | V2 shell owner |
| U-8 | Default/changed/attention/error state grammar | Decided | V2 component-library owner |
| U-9 | Deterministic table/list/card selection | Decided | V2 screen owner |
| U-10 | No density toggle; admin density is route-and-component allowlisted | Decided | Catalog-pricing owner |
| U-11 | New V2 icon set with explicit at-rest limits | Decided | V2 component-library owner |
| U-12 | Dark mode deferred until after M13 | Deferred | Product owner after parity sign-off |
| U-13 | 120/180/240 ms purposeful motion with reduced-motion support | Decided | V2 component-library owner |
| U-14 | `--v2-*` tokens and `[data-v2]` selectors in one isolated sheet | Decided | V2 shell owner |
| U-15 | Screen-print styling remains isolated from engine documents | Decided | Engine/document owner |

Only U-12 is deferred. Its reason and exit condition are specified below; the light palette is
complete and testable without it.

---

## U-1 · Type scale

**Decision.** Use a 16 px body with a minor-third (1.2) heading scale. Labels, instructions, table
cells, inputs, buttons, navigation, errors, and status text are at least 16 px. The 14 px metadata
style is permitted only for dates, IDs, counts, and supplementary context whose omission would not
block a task. It is never used for a control label, price, dimension, warning, or error.

| Role | Size / line height | Weight | Use |
|---|---:|---:|---|
| Metadata | 14 / 20 px | 400–600 | non-essential date, ID, count, provenance |
| Body | 16 / 24 px | 400–600 | default copy, labels, controls, tables |
| Lead | 19.2 / 28 px | 400–600 | one-line page context |
| Heading | 23.04 / 30 px | 600 | card or section heading |
| Title | 27.65 / 34 px | 700 | page title |
| Display | 33.18 / 40 px | 700 | exceptional task-entry heading only |

Use sentence case. Replace V1's 11 px uppercase micro-label with a 16 px, 600-weight sentence-case
label. Keep body lines at or below 72 characters. Do not tighten letter spacing to simulate a
smaller label.

**Why.** The V1 audit measured 14 px body text and repeated 11 px uppercase labels at 834 px. That
is the largest readability gap for the 35–65 target user and directly violates P6.

**Reviewer check.** At 834 and 1280 px, inspect computed styles for every label, control, table cell,
instruction, warning, and error: `font-size >= 16px`. Any 14 px text must pass the omission test
above. Search V2 code for arbitrary `font-size`, `text-xs`, `text-sm`, and pixel/rem type values;
only the six type tokens may set size.

## U-2 · Spacing scale

**Decision.** Use a 4 px base. The available steps are 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64,
and 80 px. Apply this fixed rhythm:

| Relationship | Space |
|---|---:|
| Icon to its text | 8 px |
| Label to control / title to context | 8 px |
| Related controls | 12 px |
| Fields in a form | 20 px |
| Card padding | 24 px desktop, 20 px at 768–1023 px, 16 px below 768 px |
| Card-to-card / grid gutter | 24 px desktop, 20 px tablet, 16 px mobile |
| Section heading to content | 24 px |
| Section to section | 40 px |
| Page heading to first section | 40 px |

Margins belong to layout primitives, not leaf controls. A screen may use less space only through the
approved admin density in U-10, never by introducing another step.

**Why.** One small scale creates Notion-like breathing room without arbitrary one-off gaps and lets
the responsive system reduce spacing predictably.

**Reviewer check.** Inspect every padding, margin, gap, inset, and translate used for layout. It must
resolve to a `--v2-space-*` token. Card padding and section gaps must match the table at 1280, 834,
and 767 px. Pixel values are permitted only for borders, focus width, and non-layout rendering.

## U-3 · Control and row sizing

**Decision.** Default form controls and text buttons are 48 px high. The compact admin variant is
44 px. Icon-only controls have a visible or transparent 44 × 44 px hit area. Default repeated rows
are at least 56 px; approved admin rows are 44 px. Width may grow but neither dimension of a target
may fall below 44 px.

Small visual marks such as checkboxes may be 20–24 px only when their label expands the combined
click target to at least 44 × 44 px. Adjacent targets keep at least 8 px separation.

**Why.** V1 falls to 32 px. The 48 px default is comfortable for a standing operator; the 44 px
floor preserves useful density without weakening P6.

**Reviewer check.** At 834 and 1280 px, measure each rendered interactive element with
`getBoundingClientRect()`. Both dimensions must be at least 44 px, except a full-width row/link whose
height alone must be at least 44 px. Default controls must be 48 px and default rows 56 px. Verify
label clicks activate any smaller visible checkbox/radio.

## U-4 · Colour system

**Decision.** Use only the palette in `v2.css`:

- one neutral ramp: neutral 0, 50, 100, 200, 300, 400, 500, 600, 700, 800, and 950;
- one blue accent family: soft, base, and hover;
- exactly three semantic hues: success, warning, and error, each with one soft surface.

Neutral carries hierarchy. Accent identifies the primary action, focus, links, selection, and a
changed value. Success confirms completion; warning means attention is needed before continuing;
error means invalid, failed, or blocked. Semantic colour is never decorative and is always paired
with text or another non-colour cue. There is no separate information hue: informational content
uses neutral, and changed/selected content uses accent.

The tested pairs and ratios are in `design-system/contrast-report.md`. Normal text requires 4.5:1;
large text and non-text UI boundaries require 3:1. Engine SVG colours are outside this screen-UI
palette and must not be overridden.

**Why.** V1 mixes two neutral systems and many decorative hues. A smaller palette restores meaning
and makes contrast finite enough to verify exhaustively.

**Reviewer check.** Search V2 component and route code for hex, rgb, hsl, Tailwind palette names,
and CSS colour keywords. There must be no colour literal outside `v2.css` and the static specimen.
Every semantic use must include visible text or an icon with an accessible name. Re-run
`node Spec/v2/design-system/contrast-check.mjs`; it must exit zero.

## U-5 · Radius

**Decision.** Use 10 px for controls, cards, menus, banners, drawers, and table containers. Use
`999px` only for a true pill whose width is content-driven or for a circle with equal width and
height. Nested surfaces do not add a second radius merely for decoration.

**Why.** V1's interchangeable 6/8/12 px values create visual noise without conveying hierarchy.
One radius makes different components feel related.

**Reviewer check.** Search V2 code for `border-radius` and radius utility classes. Every result must
resolve to `--v2-radius` or `--v2-radius-round`; each round use must be demonstrably a pill/circle.

## U-6 · Elevation

**Decision.** Keep exactly four levels:

| Level | Meaning |
|---|---|
| 0 | page regions, tables, and nested wells |
| 1 | standard cards, raised interactive cards, and sticky bars |
| 2 | menus, popovers, and overlay sheets |
| 3 | modal dialogs only |

Components select them through `data-v2-elevation="0|1|2|3"`. Phase 4 owns the mapping. Component
CSS, route CSS, inline styles, and utility classes may not declare `box-shadow`.

**Why.** V1 defined a scale but allowed inline shadows to bypass it. A data-attribute API makes the
finite choices searchable and reviewable.

**Reviewer check.** Search all V2 files except `v2.css` for `box-shadow`, `drop-shadow`, and shadow
utilities; the result must be empty. Search `data-v2-elevation` values; only 0–3 are valid, and a
level must match the meaning in the table.

## U-7 · Content width, grid, and responsive behaviour

**Decision.** Choose the narrowest frame that holds the content:

| Frame | Maximum width | Required use |
|---|---:|---|
| Reading | 760 px | prose, settings subsection, confirmation |
| Detail | 1080 px | forms, order detail, configuration inspector |
| Wide | 1280 px | a genuine 5–6-column comparison table or canvas workspace |

The layout grid is 12 columns at ≥1024 px, 8 columns at 768–1023 px, and 4 columns below 768 px.
Page gutters are 32, 20, and 16 px respectively. The Designer keeps its existing contract:
side-by-side canvas/inspector at ≥1024, overlay inspector at 768–1023, and view-mostly below 768.

A 5–6-column table uses the wide frame and a focusable local horizontal scroll region. The page
itself must never scroll horizontally. Columns have declared roles: one flexible identity column,
fixed-width status/date/number columns, and at most one actions column. Prices and quantities align
right; headings align with their cells. At 834 px, do not shrink type or targets to force fit.

**Why.** The 1500 px V1 content area makes tables harder to scan, while the Designer already has a
proven responsive model. Local overflow preserves useful column relationships on tablet.

**Reviewer check.** At 1280 px, verify the selected frame's computed maximum width. At 834 px,
verify the page has `scrollWidth === clientWidth`, the six-column table's own scroll region may have
`scrollWidth > clientWidth`, and type/targets retain U-1/U-3 sizes. Check grid/gutter token values at
1024, 834, and 767 px.

## U-8 · State grammar

**Decision.** Every answerable control or row has exactly one base state:

| State | Meaning | Visual and content requirements |
|---|---|---|
| `default` | saved/current, no intervention | neutral border and surface; current value visible |
| `changed` | differs from saved/current | accent border + soft surface, “Changed” text, reset action |
| `attention` | valid so far but required before progress | warning border + soft surface, instruction saying what is needed |
| `error` | invalid, failed, or blocked | error border + soft surface, specific cause and recovery action |

Use `data-v2-state` as the visual hook and render a text label through `data-v2-state-label`.
Success is not a fifth editable state; it is a transient confirmation or completed workflow status.
Selection and hover are interaction conditions, not data states. When several issues exist, the
summary links to and focuses the first affected control. Errors remain until fixed or explicitly
dismissed where dismissal is safe. Changed controls always provide reset.

This extends the Designer's existing default/changed/needs-attention grammar and preserves its
issue deep-link pattern. Do not blank a last-good preview after a resolve error.

**Why.** One grammar reduces re-learning and prevents colour-only state. It also carries forward a
working V1 mechanic instead of inventing a competing one.

**Reviewer check.** Exercise every applicable state in the specimen/test story. Each must differ by
text plus border/surface, not colour alone. Changed must expose reset; attention must name the
missing action; error must name cause and recovery and be programmatically associated using
`aria-describedby` or an error summary link. Verify keyboard focus follows an issue link.

## U-9 · Table, list, or card

**Decision.** Use this first-match rule:

1. **Table** — users compare three or more repeated records across three or more shared attributes,
   sort/filter the set, or scan aligned numbers.
2. **List** — each record has one identity, no more than two supporting values, and one next action;
   cross-row comparison is not the task.
3. **Card** — a visual preview is needed to identify the item, or the item represents an artifact
   with materially different actions (for example, documents grouped by recipient).
4. **Definition layout** — one object's fields on a detail screen; never a two-column “table” with
   only one record.

Do not show the same collection as both cards and a table on one screen. A table has one
keyboard-reachable row destination, not one duplicate link per cell. Secondary row actions live in
one labelled menu when there are more than two.

**Why.** V1 uses both tables and cards for equivalent content and puts two item tables on one order.
The selection rule ties representation to the user's task.

**Reviewer check.** State which numbered rule selected the pattern in the screen PR. Count shared
attributes and supporting values. Reject duplicate representations and tables used for a single
object. Keyboard-test that each linked row contributes one primary destination to the tab order.

## U-10 · Density

**Decision.** There is no user-facing compact-mode toggle. Default density applies everywhere
except these two allowlisted structures:

- the catalog-pricing grid; and
- the role permission matrix.

Those structures may set `data-v2-density="admin"`, producing 44 px controls and rows with 16 px
text. The catalog-pricing screen shows one profile/category group at a time and makes CSV import the
bulk path; it does not solve density by rendering six full tables together. All other components use
`data-v2-density="default"` and 48/56 px sizing.

**Why.** Phase 2 gave catalog pricing its own workspace. A global density preference would make
every component branch while preserving the real problem: hundreds of rows competing on one page.

**Reviewer check.** Search for `data-v2-density="admin"`; every result must be inside the pricing
grid or role permission matrix. Measure its text at 16 px and targets at 44 px. Confirm only one
pricing group is expanded/visible at a time and that no density toggle appears in preferences.

## U-11 · Iconography

**Decision.** Phase 4 authors a small V2 icon set; V2 never imports V1's
`web/components/icons.tsx`. Icons are 20–24 px inside a 44 px target and use `currentColor`. Prefer
text for navigation and actions. Icon-only buttons are allowed only for universally recognised,
repeated spatial actions such as close; they require an accessible name and tooltip.

At rest, the shell may show at most four action glyphs and a content region at most six glyph
instances. Status tables use text chips, not per-row decorative icons. Navigation rows do not each
receive an icon. A preview/drawing may contain domain graphics; those do not count as UI icons.

**Why.** V1 puts dashboard, metric, quick-action, navigation, and row icons together until none
signals priority. A new isolated set also preserves the Architecture rule that V2 imports V1 only
through approved seams.

**Reviewer check.** Search V2 imports for `components/icons`; there must be no result. Count visible
glyph instances at rest against the limits. Inspect every icon-only button for a ≥44 px target,
accessible name, tooltip, and keyboard focus. Reject decorative table/status glyphs.

## U-12 · Dark mode

**Decision.** Deferred until after M13 parity sign-off. The product owner owns the follow-up and may
schedule it only after observing the app in real workshop lighting. V2 declares
`color-scheme: light`; no dark tokens or `prefers-color-scheme` branch are authored now.

**Why.** V1 has no dark mode, the primary environment is a brightly lit factory floor, and a second
palette would double the contrast/state/visual QA surface before parity is proven. Deferral removes
no V1 capability.

**Reviewer check.** Search V2 CSS for `prefers-color-scheme`, dark selectors/classes, and dark colour
tokens; there must be no result. Revisit this decision as a named product-owner item after M13.

## U-13 · Motion

**Decision.** Motion explains a relationship or acknowledges an action; it never decorates idle
content. Use 120 ms for hover/focus feedback, 180 ms for small disclosure, and 240 ms for a drawer
or overlay. Animate only opacity and transform. Toasts may enter once and must remain long enough to
read. Loading uses a static skeleton or progress text, not a perpetual shimmer.

No motion may delay input, convey the only state change, or animate the engineering drawing. Under
`prefers-reduced-motion: reduce`, transitions/animations become effectively immediate and smooth
scrolling is disabled.

**Why.** V1 applies transitions broadly. Three purposeful durations make behaviour predictable and
keep a workshop UI calm.

**Reviewer check.** Search V2 CSS for `transition`, `animation`, and duration values. Every instance
must use a `--v2-duration-*` token, animate opacity/transform only, and have a functional reason in
its component story. Emulate reduced motion and verify no task/state information disappears.

## U-14 · Token namespace and isolation

**Decision.** All V2 custom properties live in `web/app/v2.css`, begin `--v2-`, and are declared
under `[data-v2]`. Every selector in that file includes `[data-v2]`. Only the future V2 route-group
layout imports it. V2 components consume semantic aliases where available; they do not read V1
variables, Tailwind palette values, or document/engine styles.

`web/app/globals.css`, `web/components/ui.tsx`, and `web/app/(app)/**` are frozen. V2 screens may
change a design-system value only by updating the shared token and its contrast/specimen evidence,
not by locally overriding it.

**Why.** This is D-002's additive isolation contract. V1 stays available and byte-stable while V2
is built route by route.

**Reviewer check.** Verify every custom property in `v2.css` matches `--v2-*`, every selector is
rooted at `[data-v2]`, and only the V2 layout imports the sheet. Search V2 code for V1 custom
properties and palette utilities. Confirm `git diff` is empty for the three frozen paths.

## U-15 · Print and engine-document safety

**Decision.** V2 screen print rules may hide screen-only chrome and normalise the V2 page, but they
remain `[data-v2]`-scoped in `v2.css`. They must not declare `@page`, target an iframe/SVG/document
root, or style HTML produced by `src/engine/documents.ts`. Engine documents continue to carry their
own `STYLE` and the work-order-only `extraCss` seam. V2 styles the frame around an SVG, never the
SVG's internal palette or geometry.

**Why.** Document output is calibrated and byte-asserted, including whitespace. Screen CSS leaking
into a quote, work order, or SVG would be a functional fabrication regression, not cosmetic drift.

**Reviewer check.** Search `v2.css` for `@page`, iframe/document selectors, and SVG descendant
selectors; there must be no result. Confirm `git diff -- src prisma` is empty. Run the full
`npm run validate` suite and retain the exact document assertions.

---

## 3. Cross-cutting accessibility contract

The U decisions are necessary but not sufficient. Every Phase 4 component and later screen must
also satisfy all of the following:

- native semantic elements first; ARIA augments rather than replaces them;
- visible 3 px focus rings with 2 px offset on every interactive element;
- logical tab order and one primary keyboard destination per repeated row;
- a text label for colour, status, swatch, and icon-only action;
- persistent instructions and errors, programmatically associated with their controls;
- no hover-only content or pointer-only path; the Designer's Structure view remains the
  non-pointer equivalent of canvas interactions;
- local scroll regions are keyboard-focusable and labelled; and
- forced-colour mode keeps focus and state boundaries visible.

**Reviewer check.** Complete keyboard-only use of the screen at 834 and 1280 px; run the project's
automated accessibility checks once Phase 4 adds them; inspect accessible names, error associations,
tab order, forced colours, and reduced motion. Any failure blocks the screen.

## 4. Phase 4 enforcement contract

The component library must make compliance easier than bypass:

- components expose finite props for size, state, elevation, and density instead of accepting raw
  style values;
- generated class names map to the tokens in `v2.css`;
- lint/static checks reject raw colours, shadows, radius values, arbitrary type sizes, and V1 icon
  imports inside V2;
- component examples render default, changed, attention, error, disabled, loading, and empty states
  where applicable; and
- the six-column specimen/table test remains part of visual review at 834 px.

Exceptions require a new accepted decision in `DECISIONS.md`; a local code comment is not an
exception process.

## 5. Phase 3 proof

- The specimen displays the complete type scale, palette, spacing steps, four elevation levels,
  focus treatment, four-state grammar, control sizes, and a realistic six-column order table.
- The automated contrast check covers every declared foreground/background pair; all pass WCAG AA.
- The 834 px capture keeps 16 px table text and 44 px admin rows and contains overflow within the
  table region.
- Phase 1 confirmed P1–P14. This document assigns the missing P6 numbers, specifies P7 once, and
  makes P11 finite and testable.

Owner approval closes Phase 3. Components and screens remain Phase 4+ work.
