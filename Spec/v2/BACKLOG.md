# BACKLOG — parked items and owner questions

> Living document. Nothing here is scheduled. Items land here when they are **out of V2's scope
> (presentation only) but real**, or when they need an owner decision.
>
> **Rule:** if building a V2 screen requires something in this list, work **stops** and the item is
> raised — it is never quietly implemented while building a screen (**D-003**).

---

## A · Needs an owner decision

### B-1 · Does the Designer get an RBAC module?

**Phase 2 proposal (D-010): no.** Fold Standard and Custom disclosure under the existing `quotes`
module, so no registry/sync/grant change is required. Awaiting the Phase 2 owner gate.

**Found:** `/designer` has no sidebar entry and is governed by **no permission module** (O-5).
It is auth-guarded by the `(app)` layout only. A dashboard quick action points to bare `/designer`,
which cannot start without family/design query parameters and sends the user back to Products; the
only functional entry is "Design in studio" on a gallery card.

**Why it matters:** V2 renders navigation from `user.nav` (**P12**). Without a module, the studio
can never appear in a permission-filtered nav — so the app's most capable tool stays undiscoverable
no matter how well V2 is designed.

**Cost:** one entry in `src/rbac/registry.ts#MODULES`, e.g.
`{ slug: "designer", name: "Designer", navPath: "/designer", navIcon: "spark", category: "Sales", sortOrder: 32 }`,
then `npm run sync:permissions`. It automatically produces a nav entry, a permission surface and a
role-grid row. Admin picks it up via `ADMIN_GRANTS` (derived from `MODULES`); the Customer role
would need an explicit grant.

**Alternative:** fold the studio under the existing `quotes` module — no data change at all, but
then it cannot be permissioned separately from `/quote`.

**Decision needed by:** Phase 2. → `DECISIONS.md`

---

### B-2 · What does global search search?

**Phase 2 proposal (D-011): orders only.** Label the control **Search orders**, show it only with
`orders.read`, and use `GET /api/orders?q=`. Awaiting the Phase 2 owner gate; G-5 stays parked.

**Found:** the header search box is styled as the primary way to find things and **has no handler,
no form and no results** (O-1). Meanwhile `/orders` has real, server-side search (`?q=`).

**Options:** (a) V2 search covers orders only, reusing what exists; (b) it also covers products and
designs — which needs a backend endpoint (**G-5**); (c) it is removed until (b) is funded.

**P2 forbids shipping it dead.** (a) or (c) require no backend work.

**Decision needed by:** Phase 2.

---

### B-3 · One configurator or two? *(= Q-A)*

**Phase 2 proposal (D-009): two task entries, one workspace** with Standard and Custom disclosure.
Awaiting the Phase 2 owner gate.

---

### B-4 · Is the V1 URL space preserved or redirected?

`/orders/abc123` must not 404. Alias (V1 keeps its URLs) or redirect-to-preferred.
**Phase 2 proposal (D-015): alias now, redirect only if V2 becomes default.** Awaiting the Phase 2
owner gate; implementation belongs to Phase 5.

---

### B-5 · Does V2 ever become the default landing?

Explicitly **not** decided now. V1 stays available regardless (`00-foundation/VISION.md`). Revisit at **M13**.

---

## B · Capability gaps — real, and out of V2's scope

**V2 adds no features** (`00-foundation/VISION.md`). Each of these is a *product* decision for the owner,
separate from the V2 UX project.

| ID | Gap | Evidence | Note |
|---|---|---|---|
| **G-3** | **No production/workflow status.** Orders are `draft` or `confirmed` only — nothing records cut, glazed, dispatched | O-23 | Blocks a "Timeline" component (`00-foundation/COMPONENT_LIBRARY.md` Part B) and any shop-floor view. **A mockup already exists** at `web/DESIGN/production_control_fab_erp/` that was designed and never built |
| **G-4** | **No customers page.** The `customers` RBAC module exists with `navPath: null`; orders carry a free-text `customerName` and a `Customer` model exists | registry.ts, schema.prisma | Phase 2 proposes it stays permission-only (`D-016`); a page remains a separately approved new feature |
| **G-5** | **No global search endpoint** beyond orders | B-2 | |
| **G-2** | **No design filtering** by family, size range or opening type — only by product and page | O-13 | Remains parked after M9 (D-024); task-first family discovery is served separately by Configure |
| **G-1** | **Gallery costs 1+N requests**: list, then one fetch per design for its SVG | products/[id] | Accepted for M9 under D-024 with per-tile degradation; an aggregation parameter remains separate work |

---

## C · Technical debt observed (V1 — not V2's to fix)

Recorded so V2 does not inherit these patterns.

| Item | Detail |
|---|---|
| Accent hardcoded | `#4442e3` appears as a literal in the nav, dashboard, page headers, badges and metric cards, though `--blue` exists |
| Elevation scale bypassed | `--shadow-xs…lg` was introduced in D8 to end ad-hoc shadows; inline `shadow-[0_28px_70px_…]` remains in the nav and canvas frame |
| Two neutral ramps | Tailwind `slate-*` mixed with custom `--surface`/`--border`/`--muted` tokens |
| Global `!important` | `* { letter-spacing: 0 !important }` in `globals.css` |
| Dead component | `components/placeholder.tsx` — a U1 stub nothing uses |
| Cross-page import | `app/(app)/page.tsx` imports `StatusBadge` from `./orders/page` — a page importing from another page |
| `defaultCollapsed`/presentation drift | Owner-editable option presentation is preserved across reseeds by design; worth remembering when V2 renders option groups |

**None of these are V2's to fix**, because fixing them means editing V1 (**forbidden**). They are
listed as anti-patterns for the V2 kit to avoid.

---

## D · Ideas parked (not committed, not scheduled)

Recorded only so they are not silently re-invented. None is approved; none is a V2 deliverable.

| Idea | Origin |
|---|---|
| ~~Role-shaped home screens~~ → specified permission-first in Phase 2, D-008 | O-6, X-7 |
| ~~Documents grouped by who needs them~~ → specified in Phase 2, D-012 | O-27 |
| A glossary surface for trade terms, with plain-word-first labelling | X-5, P5 |
| Saved configurations / templates for repeat window types | F1 friction |
| Keyboard-first quoting for high-volume operators | `00-foundation/VISION.md` user table |
| Tablet-optimised shop-floor document view | `00-foundation/VISION.md` user table |

---

## Filing rules

**File here when:** V2 needs data an endpoint does not return · a capability does not exist ·
a decision belongs to the owner · a V1 pattern should not be inherited.

**Do not file here:** UX problems (→ `00-foundation/SCREEN_INVENTORY.md` observations, ranked in Phase 1) ·
design questions (→ `00-foundation/UI_GUIDELINES.md` U-n) · component questions (→ `00-foundation/COMPONENT_LIBRARY.md` C-n) ·
decisions already made (→ `DECISIONS.md`).
