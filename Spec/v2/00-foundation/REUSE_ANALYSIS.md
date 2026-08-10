# REUSE ANALYSIS — every V1 asset, classified

> Phase 0 deliverable. Verified against the tree on 2026-08-07.
> The brief's hardest constraint: **"Always reuse existing implementation before writing anything
> new."** This document is how that constraint is enforced — before any V2 file is written, its
> intended job must be checked against this table.

## Classification

| Class | Meaning | Rule |
|---|---|---|
| **🟩 REUSE** | V2 imports it unchanged | Editing it is a bug |
| **🟦 REUSE + WRAP** | V2 imports it and adds an *optional* prop / thin adapter | Existing behaviour must stay byte-identical (V1 depends on it) |
| **🟨 REBUILD (UI only)** | V2 writes its own version; the *logic* it wraps stays in the API | Must not re-implement any calculation |
| **🟥 FROZEN** | V1-only; V2 never imports, never edits | CI-checked |
| **⬛ OUT OF SCOPE** | Backend/tooling — V2 has no business here | Zero lines changed |

---

## 1 · Backend — ⬛ OUT OF SCOPE, 100%

**Target: 0 lines changed under `src/` for all presentation work.**

| Path | LOC | Why V2 never touches it |
|---|---|---|
| `src/engine/*` | ~5,400 | Pure fabrication maths, calibrated against production jobs, 1,568 assertions |
| `src/designer/*` | ~3,600 | Pure resolve pipeline; V2 consumes `ResolvedLineItem` |
| `src/catalog/*` | ~40,000 | The single data seam + generated topologies |
| `src/api/*` | ~5,000 | 75 endpoints already cover V2's needs (see `API_REUSE.md`) |
| `src/services/*` | ~400 | The only S3/Puppeteer code |
| `src/rbac/*` | ~250 | Modules/actions/roles as pure data |
| `src/validation/*` | ~2,900 | The safety net; its number must not move |
| `prisma/*` | ~1,500 | 35 models, 25 migrations — **V2 needs no schema change** |

**The tripwire:** D-023 accepts the owner's separate catalog snapshots at **1,575 passed, 0 failed**.
If validation, the backend digest or the one pinned V1 admin-editor companion moves again during V2
work, the boundary has moved and work stops. The original 1,568 baseline remains the historical
D-019 value.

*The one legitimate exception*: `src/rbac/registry.ts#MODULES` is **data**, and adding a module
(e.g. giving `/designer` one — see O-5) is a data change that automatically produces a nav entry, a
permission surface and a role-grid row. If Phase 2 concludes the Designer needs a module, that is a
**one-entry data addition, proposed in `../BACKLOG.md` and approved separately** — not a V2 code change.

---

## 2 · The seam — 🟩 REUSE, verbatim

These 9 files are why V2 is cheap. **~1,400 LOC that V2 gets for free.**

| File | LOC | What V2 gets |
|---|---|---|
| `app/api/[...path]/route.ts` | 73 | The BFF proxy: cookie → bearer, verbatim status/body/content-type, PDF streaming, `?download=1` |
| `app/api/auth/login/route.ts` | 58 | Login + httpOnly cookie set |
| `app/api/auth/logout/route.ts` | ~20 | Cookie clear |
| `app/api/auth/change-password/route.ts` | 62 | Password change + cookie re-set after `tokenVersion` bump |
| `lib/api.ts` | 410 | **~45 typed client functions** covering orders, line items, quotes, users, roles, approvals, catalog, settings |
| `lib/server-api.ts` | 61 | `serverApiGet` + `getCurrentUser` |
| `lib/types.ts` | 700 | Every response shape, already restated for Next's bundler |
| `lib/permissions.ts` | ~25 | `can()` / `scopeOf()` — the one isomorphic predicate |
| `lib/authz.ts` | ~25 | `requirePagePermission()` server guard |
| `lib/permissions-provider.tsx` | ~30 | Client-side permission context |
| `lib/format.ts` | ~30 | `money()` / `dateShort()` |

**These files are shared, not V1's.** V2 imports them directly. If V2 needs a client function
`lib/api.ts` lacks, adding one is fine — it is additive and both shells benefit.

⚠️ **`lib/api.ts` and `lib/types.ts` are the only shared files V2 may extend.** Any edit must be
purely additive; changing an existing signature breaks V1.

---

## 3 · Domain widgets — 🟦 REUSE + WRAP

**1,665 LOC of hard-won canvas code that V2 must not rewrite.**

| File | LOC | Status |
|---|---|---|
| `components/window-designer.tsx` | 1,160 | The elevation canvas: drag-to-resize spans, dimension leaders with editable pills, component hit-testing (biggest-first), mirrored hit-testing for the internal view, selection highlight, sliding-panel branch |
| `components/window-3d.tsx` | 505 | three.js massing view, lazy `ssr:false` |
| `lib/svg-preview.ts` | ~40 | `normalizeSvgForPreview` |
| `lib/svg-download.ts` | 79 | Client-side SVG/PNG export |
| `lib/designer-draft.ts` | 520 | Draft reducer helpers, `effectiveAnswer` (mirrors `select.ts`'s precedence ladder), `fixForIssue`, `withChosenPart`, `pruneSelections` |

**`window-designer.tsx` has an established extension pattern the whole codebase uses**: new
capabilities arrive as **optional props** that are no-ops when omitted (`components`,
`selectedComponentId`, `onSelectComponent`, `mirrored` were all added this way). V2 extends it the
same way. **It must stay byte-identical for V1's call sites** — `/quote` passes none of these props
and must keep behaving exactly as it does.

Rewriting this canvas would be the single most expensive and most likely-to-regress thing V2 could
do. It is explicitly forbidden.

---

## 4 · Designer UI — 🟨 REBUILD the shell, 🟩 REUSE the logic

`components/designer/*` — 2,822 LOC.

| File | LOC | Class | Note |
|---|---|---|---|
| `workspace.tsx` | 914 | 🟦 **Study, then re-shell** | Holds the single `useReducer` over `LineItemDraft`, the 350 ms debounce with stale-response discard, the view switch + per-view cache, selection state. **The reducer and the resolve loop are the valuable part** and should be extracted/reused rather than re-derived |
| `options.tsx` | 625 | 🟨 Rebuild | Scope-aware schema-driven option rendering. **Already the best UX in the app** (O-21) — V2 should generalise its grammar, not discard it |
| `controls/index.tsx` | 392 | 🟨 Rebuild | Display-driven primitives (`segmented`/`select`/`select-image`/`toggle`/`number`/`text`/`action`) |
| `controls/option-row.tsx` | 131 | 🟨 Rebuild | The tri-state grammar lives here, in ONE place |
| `structure.tsx` | 310 | 🟨 Rebuild | Tree, instant actions, undo history — the a11y contract |
| `measurements.tsx` | 304 | 🟨 Rebuild | Descriptor-driven dimensions + generated span inputs |
| `canvas.tsx` | 150 | 🟨 Rebuild | Thin wrapper around `window-designer.tsx` |

**The rule that must survive the rebuild: no option key appears anywhere under `web/`.** V1 holds
this invariant (verified by grep at D3, D4, D8 and the 2026-08-05 divider-picker change) and it is
what makes seeding a new option free. V2 keeps it, and Phase 4 should add the same grep as a check.

---

## 5 · Design system — 🟨 REBUILD (V2 authors its own)

| File | LOC | Class | Reasoning |
|---|---|---|---|
| `components/ui.tsx` | 260 | 🟥 FROZEN for V1 · V2 writes `components/v2/*` | 12 primitives (Button, ButtonLink, Card, PageHeader, SectionHeader, Badge, Alert, EmptyState, MetricCard, FieldLabel, + table/field class constants). Tuned for density: 40 px controls, 11 px uppercase micro-labels, `max-w-[1500px]`. **V2's users need the opposite** |
| `components/icons.tsx` | 259 | 🟦 Likely reusable | An inline SVG sprite. Reusing it costs nothing; Phase 4 decides whether V2's icon language differs |
| `components/toast.tsx` | 102 | 🟦 Likely reusable | Small and behaviour-only |
| `components/pager.tsx` | ~35 | 🟨 Rebuild | Link-based pagination; V2's list pattern may differ |
| `components/design-card.tsx` | 120 | 🟨 Rebuild | Carries the two-competing-actions problem (O-11) |
| `components/placeholder.tsx` | ~20 | 🟥 Drop | A U1 stub; nothing in V2 needs it |
| `app/globals.css` | 194 | 🟥 FROZEN · V2 adds `app/v2.css` | V1 tokens stay; V2 namespaces `--v2-*` (see `ARCHITECTURE.md` §2.2) |

**Why rebuild rather than restyle:** `ui.tsx` is *good* — one elevation scale, one label treatment,
one focus ring. It is simply calibrated for a different user. Restyling it in place would change V1,
which is forbidden. Rebuilding costs ~300 LOC and buys total freedom.

---

## 6 · Screens — 🟨 REBUILD (all 18)

Every route under `app/(app)/`, `app/login`, `app/change-password` — **~4,900 LOC**.

V2 rebuilds these because rebuilding *is* the project. But **rebuild means re-composing existing
calls, not re-deriving behaviour.** Each V1 page is the specification for its V2 replacement: it
already knows which endpoints to call, in what order, with what error handling.

**Behaviours V2 must carry over** (each was a deliberate fix; losing one is a regression):

| Behaviour | Where V1 does it |
|---|---|
| 350 ms debounce + sequence counter discarding superseded responses | `configurator.tsx`, `workspace.tsx` |
| A failed resolve never wipes the last-good preview | both |
| First-load toast suppression (`settledOnceRef`) | `configurator.tsx` |
| Whole-cell click targets with **one** keyboard-reachable link per row | `orders/page.tsx` |
| Gallery SVG fetch degrades per-tile, never fails the page | `products/[id]/page.tsx` |
| Confirm's **422 payload** names which item blocked and why | `order-actions.tsx` |
| `DELETE /api/users/:id` may return `pending_approval` | `users-manager.tsx` |
| Server-side search + status filter as plain GET links (no client JS) | `orders/page.tsx` |
| Dirty-tracking before save on the catalog editor | `catalog-editor.tsx` |
| Colour/cill persist on an order item; **glass does not** | `configurator.tsx` |

Phase 7+ ticks these off per module.

---

## 7 · Reference material — READ, don't import

| Path | Use |
|---|---|
| `web/DESIGN/*/` | 7 mockups (`code.html` + `screen.png`) — the owner's own visual taste, incl. a **production-control screen that was never built** |
| `Spec/00-architecture/ux-design-language.md` | The Designer's design language. **Already contains much of V2's thesis** (progressive disclosure, always-on selection, tri-state grammar, issue deep-links). Phase 3 should start from it, not from scratch |
| `docs/rbac/PLAN.md` | 61 KB. Why nav and permissions are data |
| `docs/architecture/*.pdf` | Generated architecture doc |
| `CLAUDE.md` | 152 KB. The definitive record of every calibration and decision |

---

## Scorecard

| Class | Files | Approx. LOC | V2 cost |
|---|---|---|---|
| ⬛ Out of scope (backend) | ~96 | 61,468 | **0** |
| 🟩 Reuse verbatim (seam) | 11 | ~1,400 | **0** |
| 🟦 Reuse + wrap (canvas, 3D, draft helpers, icons, toast) | 7 | ~2,400 | ~50 LOC of optional props |
| 🟨 Rebuild — design system | 5 | ~700 | ~400 LOC |
| 🟨 Rebuild — designer shell | 7 | ~2,800 | reuses the reducer + resolve loop |
| 🟨 Rebuild — screens | 18 routes | ~4,900 | the actual project |
| 🟥 Frozen | `app/(app)/**`, `ui.tsx`, `globals.css` | — | CI-checked |

**~65,000 of ~75,000 LOC in this repository are reused untouched.** V2 is a presentation layer, and
this table is the proof that it stays one.

## The check, before writing any V2 file

1. Does an API already return this? → `API_REUSE.md`
2. Does a shared lib already do this? → §2
3. Does a domain widget already draw this? → §3
4. Is V1's version the spec for it? → §6
5. Only then write new code — and if it computes a price, a size or a permission, **stop**: that
   belongs to the backend.
