# DECISIONS — architecture decision record

> Living document. One entry per choice a future reader would otherwise re-litigate.
> Status: **Accepted** · **Proposed** (needs owner sign-off) · **Superseded** · **Rejected**.

---

## D-001 · V2 planning lives in `Spec/v2/`, not `/spec/v2`

**Date** 2026-08-07 · **Status** Accepted · **Phase** 0

**Context.** The brief said "Inside `/spec` create `/spec/v2`". The repository already has a
capital-S `Spec/` folder holding four completed workstreams (`00-architecture`, `01-windows-module`,
`02-manual-migration`, `03-doors-module`) plus `questions.md` (Q1–Q35). Linux treats `spec/` and
`Spec/` as different directories.

**Decision.** Use `Spec/v2/`.

**Why.** Creating a lowercase sibling would produce two near-identical planning roots, split the
project's institutional memory, and break every existing cross-reference. The brief's intent —
"keep all V2 planning in one folder under the spec directory" — is fully satisfied.

**Consequences.** All V2 documents live at `Spec/v2/*.md` and may reference `Spec/00-architecture/`
etc. directly. If the owner prefers lowercase, renaming the whole `Spec/` tree is the correct move —
not adding a second one.

---

## D-002 · V2 lives as a route group inside `web/`, not a separate app

**Date** 2026-08-07 · **Status** ✅ **Accepted — owner approved 2026-08-07 (Option A)** · **Phase** 0

**Context.** V2 needs its own shell, routes and design system without touching V1. Two options:
(A) a route group inside the existing Next app; (B) a separate `web-v2/` Next app.

**Decision.** Option A.

**Why.** V1's reuse assets all live inside `web/`: the BFF proxy, `lib/api.ts` (410 LOC, ~45 typed
functions), `lib/types.ts` (700 LOC), `permissions.ts`/`authz.ts`, and — most importantly —
`window-designer.tsx` (1,160 LOC) and `window-3d.tsx` (505 LOC). Option B forces either duplicating
~2,400 LOC or extracting a shared package first, which directly contradicts the brief's "never
reinvent already working logic". Option B's only real gain is style isolation, which Option A buys
with a namespaced token sheet.

**Consequences.**

- V2 at `web/app/(v2)/`, V1 frozen at `web/app/(app)/`, seam shared.
- V2 tokens: `web/app/v2.css`, all `--v2-*`, scoped under a `data-v2` root. `globals.css` untouched.
- V2 never imports `components/ui.tsx`, `components/icons.tsx` (pending C-6) or `app/(app)/**`.
- A CI diff check enforces the V1 freeze — the mitigation for A's one real risk.
- One build, one container, one deploy.

**Reversible?** Moderately. Extracting to a separate app later is mechanical if the layering rules
in `00-foundation/ARCHITECTURE.md` §2.3 are obeyed. Obeying them is therefore mandatory, not stylistic.

**Alternatives rejected.** B — see the comparison table in `00-foundation/ARCHITECTURE.md` §2.2.

---

## D-003 · V2 adds no backend code

**Date** 2026-08-07 · **Status** Accepted · **Phase** 0

**Context.** The brief: reuse backend, APIs, auth, permissions, business logic, calculations,
validations, SVG rendering, product/pricing/quotation engines, order workflow, database.

**Decision.** Target **0 lines changed under `src/` and `prisma/`** for all presentation work. If V2
needs an endpoint or field that does not exist, work **stops**, the need is logged in `BACKLOG.md`,
and it is approved as a separate change — never written inline while building a screen.

**Why.** The engine is calibrated against real production jobs and guarded by 1,568 assertions. A
UI project that quietly edits it will break fabrication accuracy, and nobody will know which change
did it.

**Consequences.** `npm run validate` staying at **1,568 passed, 0 failed** is a merge gate, and
`git diff --stat <freeze> -- src prisma` must be empty.

**Current baseline.** D-023 supersedes the numeric/backend-snapshot portion after the owner
identified a separate catalog change set as intentional. D-019 remains the V1 baseline, with the
single content-pinned owner companion recorded by D-023.

**Known exception.** `src/rbac/registry.ts#MODULES` is **data**. Adding a module (e.g. for the
Designer, **B-1**) produces a nav entry, a permission surface and a role-grid row automatically.
That is a data addition, proposed and approved on its own, not a V2 code change.

---

## D-004 · Observations are recorded as facts; judgement belongs to Phase 1

**Date** 2026-08-07 · **Status** Accepted · **Phase** 0

**Context.** Discovery surfaced ~40 UX problems. It was tempting to rank and solve them immediately.

**Decision.** Phase 0 records **what is true, with evidence** (O-1…O-31, X-1…X-9, G-1…G-5). Ranking
is Phase 1's deliverable; remedies are Phase 2's.

**Why.** The brief mandates approval per phase. Ranking without walking the running app would put
unmeasured opinion into a document that later phases treat as settled. Two of the click counts in
`00-foundation/USER_FLOWS.md` are already flagged as code-derived rather than measured for exactly this reason.

**Consequences.** `00-foundation/SCREEN_INVENTORY.md` states no preferences. `00-foundation/DESIGN_PRINCIPLES.md` is explicitly
a **draft** that Phase 1 may strike from.

---

## D-005 · Nothing is removed; things are deferred, grouped or hidden-until-needed

**Date** 2026-08-07 · **Status** Accepted · **Phase** 0

**Context.** "Never remove functionality. Only simplify user interaction." But V1 exposes things
operators should not routinely see (supplier costs, weld allowances, part codes, permission
matrices).

**Decision.** V2 may reorder, group, defer and hide behind explicit "advanced" surfaces. It may not
delete a capability. Where something is hidden, the permission that governed it still governs it,
and it is reachable in a documented number of clicks.

**Why.** Deleting looks like simplification and is actually a regression that surfaces three months
later on a factory floor at 6 a.m.

**Consequences.** Phase 2 produces a **functional-parity map** (every V1 capability → its V2 home),
and every Phase 7+ module closes against it. Removing a navigational *duplicate* (e.g. the `/admin`
hub, **O-29**, whose every tile is already a sidebar link) is not removing functionality — but it
still has to appear on the parity map with its new home.

---

## D-006 · V2 keeps V1's proven interaction mechanics

**Date** 2026-08-07 · **Status** Accepted · **Phase** 0

**Context.** V1's screens contain fixes that were each earned the hard way: the 350 ms debounce with
a sequence counter discarding superseded responses; never wiping the last-good preview on a failed
resolve; first-load toast suppression; whole-cell click targets with exactly one keyboard-reachable
link per row; per-tile SVG degradation in the gallery; rendering confirm's 422 payload;
`pending_approval` as a second legitimate outcome of user deletion.

**Decision.** These are **requirements**, listed in `00-foundation/REUSE_ANALYSIS.md` §6, and each Phase 7+ module
ticks off the ones it inherits.

**Why.** A rebuild that loses them is not a simplification, it is a regression with a nicer font.

---

## D-007 · The fabrication canvas is wrapped, never rewritten

**Date** 2026-08-07 · **Status** Accepted · **Phase** 0

**Context.** `window-designer.tsx` (1,160 LOC) implements drag-to-resize spans, editable dimension
pills, biggest-first hit-testing, mirrored hit-testing for the internal elevation, selection
highlighting, and a sliding-panel branch. `window-3d.tsx` (505 LOC) is the three.js massing view.

**Decision.** V2 imports both. New capabilities arrive as **optional props that are no-ops when
omitted** — the pattern the codebase already uses (`components`, `selectedComponentId`,
`onSelectComponent`, `mirrored` all landed this way). Existing behaviour stays byte-identical
because `/quote` depends on it.

**Why.** This is the highest-value, highest-risk code in the frontend. Rewriting it would be the
most likely source of a visible regression in the whole project, and it would gain nothing: the
canvas is not what users find confusing.

---

## D-008 · V2 uses a Work / Manage rail plus a task-shaped Home

**Date** 2026-08-07 · **Status** Accepted — owner approved 2026-08-07 · **Phase** 2

**Decision.** Select candidate B from `phase-2-information-architecture.md`: every rail item starts
as a row in `GET /api/auth/me → nav[]`; V2 transforms its destination/label and groups it as Work or
Manage. Unknown future rows fall back to their working V1 path with a visible V1 marker. Home chooses
one primary action from effective permissions, not a role name; if no meaningful action is granted,
it shows no CTA rather than linking Home to itself.

**Why.** It fixes task entry and role density without turning the UI into a task-only hub that hides
low-frequency parity capabilities. The fallback stops the presentation adapter becoming a second
permission registry.

---

## D-009 · Q-A — two task entries, one configurator workspace

**Date** 2026-08-07 · **Status** Accepted — owner approved 2026-08-07 · **Phase** 2

**Decision.** `/v2/configure?mode=standard` and `?mode=custom` are two disclosure states of one
workspace. Standard keeps the simpler quoting path; Custom discloses component editing, four views,
structural actions and undo. Both consume the family/design contracts and
`POST /api/line-items/resolve`. V1 `/quote` and `/designer` both remain.

**Why.** Users choose an operator task rather than two unexplained product names, while V2 gains one
interaction language and removes no capability.

---

## D-010 · B-1 — Designer stays under the existing Quotes permission

**Date** 2026-08-07 · **Status** Accepted — owner approved 2026-08-07 · **Phase** 2

**Decision.** Do not add a Designer RBAC module. Custom design is a mode inside the Quote destination
and is guarded by the existing `quotes` permission.

**Why.** Standard and custom are two disclosures of the same quoting workflow. A separate module
would require registry/sync changes, a grant decision for every custom role, and a second permission
concept for one workspace. The selected option closes discoverability with zero backend/data change.

**Consequence.** Designer cannot be permissioned separately from Standard quoting in V2. That is an
accepted tradeoff, not an accidental omission.

---

## D-011 · B-2 — header search searches orders only

**Date** 2026-08-07 · **Status** Accepted — owner approved 2026-08-07 · **Phase** 2

**Decision.** Show **Search orders** only when `orders.read` is granted, backed by
`GET /api/orders?q=`. Do not label it global and do not search products/designs.

**Why.** It turns V1's most prominent dead control into an honest working capability without
requiring G-5. Users without Orders permission see no search control rather than a dead promise.

---

## D-012 · O-27 — group all seven documents by user purpose

**Date** 2026-08-07 · **Status** Accepted — owner approved 2026-08-07 · **Phase** 2

**Decision.** Group Price Summary and Work Order under Office; Cutting List, BOM, Work Planner and
Planner List under Production; DMO under Dispatch. Every document keeps HTML preview, PDF download
and Normal/Welded variants where present.

**Why.** The hierarchy answers “which output do I need?” while retaining all seven outputs.

---

## D-013 · O-26 — customer price lives inside the configure workspace

**Date** 2026-08-07 · **Status** Accepted — owner approved 2026-08-07 · **Phase** 2

**Decision.** An intentional **Review customer price** action creates a draft if needed, saves the
line item, and reveals fitting/survey/delivery/discount/tax in the same workspace. V2 displays only
the `basket` returned after existing order/commercial writes; before that it shows the resolver's
engineering price only.

**Why.** Sales sees the customer-facing total without a screen change, while the UI never invents
order-level money and abandoned edits do not automatically create drafts.

---

## D-014 · O-24 — one conceptual line-item list

**Date** 2026-08-07 · **Status** Accepted — owner approved 2026-08-07 · **Phase** 2

**Decision.** Render legacy `items[]` and `designerItems[]` in one Items view. Preserve origin only
as edit-routing metadata so legacy rows use the draft converter/replacement endpoint and Designer
rows use their direct update endpoint.

**Why.** The backend already exposes the data needed to unify presentation; storage history is not a
useful organising principle for an operator.

---

## D-015 · B-4 — V1 keeps its canonical URLs; `/v1/*` is an alias

**Date** 2026-08-07 · **Status** Accepted — owner approved 2026-08-07 · **Phase** 2

**Decision.** Existing routes continue to serve V1 directly, except `/`, which D-002 already
reserves for the version chooser. V2 lives under `/v2/*`; `/v1/*` aliases V1, including `/v1` for
the V1 dashboard. Remembered preference does not redirect legacy bookmarks during coexistence.

**Why.** `/orders/abc123` continues to work exactly as it does today, switching remains reversible,
and no V1 behaviour outside the already-approved root chooser changes. Redirect strategy is
reconsidered only at M13.

---

## D-016 · G-4 — Customers remains permission-only

**Date** 2026-08-07 · **Status** Accepted — owner approved 2026-08-07 · **Phase** 2

**Decision.** Keep `customers.navPath = null`, render no link and create no V2 Customers page.

**Why.** V1 has no page or customer API. Adding one would be a new product capability and would
violate D-003. The permission row remains available for future separately approved work.

---

## D-017 · O-29 — the duplicate Admin hub has no V2 page

**Date** 2026-08-07 · **Status** Accepted — owner approved 2026-08-07 · **Phase** 2

**Decision.** Do not create `/v2/admin`. The five capabilities remain as permission-derived Manage
rows. Switching from V1 `/admin` lands on V2 Home with the Manage rail visible.

**Why.** Removing a duplicate navigation page removes no function and saves an otherwise empty
intermediate click.

---

## D-018 · V2 uses one isolated, enforceable visual system

**Date** 2026-08-07 · **Status** Accepted — owner approved 2026-08-07 · **Phase** 3

**Decision.** Adopt U-1…U-15 in `00-foundation/UI_GUIDELINES.md`: 16 px body/labels, 48 px default
and 44 px admin controls, a 4 px spacing base, one neutral ramp, one blue accent, success/warning/
error only, one 10 px radius, four attribute-selected elevation levels, 760/1080/1280 px content
frames, a default/changed/attention/error grammar, deterministic table/list/card selection, and a
route-allowlisted admin density. Phase 4 authors an isolated V2 icon set. Motion is limited to
120/180/240 ms. All tokens are `--v2-*` under `[data-v2]` in `web/app/v2.css`; screen print rules
cannot target engine documents or SVG internals.

Dark mode is the sole deferral. The product owner revisits it after M13 parity sign-off and real
workshop-lighting observation; V2 is explicitly light-only until then.

**Why.** Phase 1 confirmed the P6/P7/P11 gaps: V1's 11–14 px text, 32–40 px targets, competing
neutral/semantic systems and locally bypassed shadows. A finite token/attribute API makes the Phase
4 kit mechanically reviewable instead of relying on taste or convention.

**Evidence.** The static approval specimen was browser-rendered at 1280 and 834 px. At 834 px the
page has no horizontal overflow, the six-column table contains its own overflow, text remains 16 px,
controls remain 48/44 px and rows remain 44 px. All 22 declared colour pairs pass WCAG AA; the
tightest text ratio is 4.63:1 and the tightest non-text ratio is 3.07:1.

**Consequences.** Phase 4 exposes finite component props for state, elevation, size and density and
adds static enforcement against raw colours/shadows/radii/type sizes. Exceptions require a new ADR.
V1 and the engine palettes remain untouched.

---

## D-019 · Freeze V1 and backend at commit `1a9c18a`

**Date** 2026-08-07 · **Status** Accepted · **Phase** 4

**Decision.** The Phase 4 safety baseline is commit
`1a9c18a5b7e8ca3295bd8f97880b1179352a8d08`. `npm run check:v2` compares
`web/app/(app)/**`, `web/components/ui.tsx`, `web/app/globals.css`, `src/`, and `prisma/` against
that commit and also rejects untracked additions inside those paths.

**Why.** The V2 route-group choice shares one repository with V1. A named immutable baseline makes
“V1 stays unchanged” and “no backend code” mechanical gates instead of review conventions.

**Consequences.** The check is wired before the first component. Changing a frozen path requires a
separate accepted decision and baseline review; Phase 4 cannot silently move the freeze forward.

---

## D-020 · V2 components expose finite presentation APIs

**Date** 2026-08-07 · **Status** Accepted — owner approved 2026-08-07 · **Phase** 4

**Decision.** Adopt C-1…C-9 in `00-foundation/COMPONENT_LIBRARY.md`. Ship the V2 layout,
action, feedback, field, card, table, shell, Drawer, and Toast families now. Generalise the
Designer's answer-state grammar, while leaving its API-descriptor renderer to the configurator
module. DataTable receives columns and server URLs as data and never sorts/filters a client copy.
Fork V2 icons and toast. Expose no styling escape hatch; use the composition rules in the component
contract.

Do not ship Wizard or Modal because Phase 2 proves neither need. Do not ship Timeline while G-3
has no production-state contract.

**Why.** The finite APIs turn U-1…U-15 into the easiest implementation path. The deferrals prevent
presentation components from forcing a workflow or inventing backend state.

**Evidence.** The gallery is rendered from the real React exports at 1280 and 834 px. Browser
measurements show 16 px body/labels, 48 px controls, 56 px rows, a 3 px focus ring, one reachable
destination per table row, locally contained tablet table overflow, and a 44 × 48 px Drawer close
target. `npm run check:v2` enforces the frozen paths, seam boundary, no hardcoded option/module/role
data, no raw styling escape, and one state-grammar source.

**Consequences.** Phase 5 composes Sidebar/Header rather than restyling them. A new variant or
composition exception requires an accepted component-contract change. Wizard, Modal, and Timeline
remain absent unless later evidence/gates explicitly authorise them.

---

## D-021 · Preserve the frozen root dashboard through routing composition

**Date** 2026-08-07 · **Status** Accepted · **Phase** 5

**Decision.** Keep `web/app/(app)/page.tsx` and its layout byte-identical. `web/proxy.ts` rewrites
the public `/` request to `web/app/version-chooser/page.tsx`; the browser URL remains `/`.
`web/app/v1/page.tsx` and its layout re-export the frozen V1 implementation for the V1 Home alias,
and `/v1/*` is internally rewritten to the corresponding canonical V1 path. The shared root layout
imports `v2.css`, whose selectors remain inert unless a `data-v2` root is present, and mounts the
additive legacy-shell switcher outside the frozen V1 route group.

**Why.** Next cannot own `/` from both the frozen `(app)/page.tsx` and a new `app/page.tsx`.
Deleting, moving, or editing the existing page would violate D-019. A routing rewrite delivers the
approved public URL contract while preserving every frozen V1 byte.

**Evidence.** The production route table includes `/`, `/version-chooser`, `/v1`, every canonical
V1 route, and all mapped V2 routes. The live 18-route V1 matrix and 15 `/v1/*` aliases resolve
through the original auth guard. The D-019 freeze diff is empty.

---

## D-022 · Keep V2 header search absent until the Orders screen is real

**Date** 2026-08-07 · **Status** Accepted · **Phase** 5

**Decision.** Do not render Header search in the Phase 5 shell. D-011 still defines the eventual
control as permission-gated **Search orders** using the existing scoped order query; it becomes
visible with the M7 Orders implementation.

**Why.** Phase 5 creates a route scaffold, not an order-results screen. Sending a query to that
scaffold would be dead; sending it to V1 would unexpectedly change interface. Omission is the only
P2-compliant Phase 5 state.

**Consequences.** Header renders no search markup today. M7 must implement D-011 with real scoped
results before supplying Header's search prop.

---

## D-023 · Accept the owner's concurrent catalog work as a content-pinned snapshot

**Date** 2026-08-10 · **Status** Accepted — owner approved 2026-08-10 · **Phase** 7 / M8 gate

**Context.** After M8's first green boundary run, a separate user-owned catalog change set appeared:
11 tracked files under `src/`/`prisma/`, one migration and its V1 admin-editor companion differed
from D-019, and validation moved from 1,568 to 1,575 passing assertions. M8 did not create or modify
that work. The companion editor writes the two new sliding-panel envelope fields exposed by the
backend change, so it is one coherent owner change even though that file lives under frozen V1.

**Decision.** Accept that catalog state as intentional, exactly as instructed: “backend changes are
mine ignore them and forward to next step”. Keep D-019 as the V1 baseline and make one explicit,
content-pinned exception for `web/app/(app)/admin/catalog/catalog-editor.tsx`; every other frozen V1
path remains compared to D-019. Until the owner work has its own commit, `npm run check:v2` hashes
every file under `src/` and `prisma/` against digest
`5fceec2d3f191b06d89f021de42175a010d730dc489dd1b18c96d0316b823338` and the companion editor
against digest `8cc51d2a154cced340946bd7e87aca34551f87caf70940239fc4073d7d32d8fd`.
The standing validation baseline is now **1,575 passed, 0 failed**.

**Why.** A working-tree snapshot honours the owner's unrelated changes without weakening the V2
boundary or pretending they came from M8. Any later backend or companion-editor edit changes a
digest and fails the aggregate gate; all other V1 paths remain mechanically pinned to D-019.

**Consequences.** M8's final repository gate is closed and M9 may proceed. Future V2 milestones
report zero backend and V1 changes relative to these accepted snapshots. When the owner change set
gains an immutable commit, a later accepted ADR may replace the digests with that commit.

---

## D-024 · M9 keeps G-1 and G-2 parked and resolves gallery intent in presentation

**Date** 2026-08-10 · **Status** Accepted · **Phase** 7 / M9

**Context.** The product gallery API omits SVGs from its paginated list, so a page costs one list
request plus one full-design request per tile (G-1). It also has no family, size or opening-type
filter (G-2). Closing either gap requires a backend contract, which D-003 forbids inside V2.

**Decision.** Keep the existing 1+N gallery contract and preserve independent per-tile failure
degradation. Add no fake filter controls. Family-first discovery stays in the M8 task path; the M9
Products route remains the complete browse path. At product level, choose Standard or Custom once,
then give each configurable card exactly one matching action. Render non-quotable records in a
separate, explicitly reference-only section with zero actions.

**Why.** This preserves every V1 catalog record and proven failure behaviour while removing O-11's
unexplained per-card competition and O-12's implication that reference records can start work. It
does not hide a missing backend feature behind client filtering.

**Consequences.** G-1 and G-2 remain open capability gaps in `BACKLOG.md`. A future aggregation or
filter contract requires its own approval; M9 does not pre-empt it.

---

## Decisions still to be made

| ID | Question | Owner phase | Blocks |
|---|---|---|---|
| **B-5** | Does V2 ever become the default landing? | Phase 8 (M13) | — |
