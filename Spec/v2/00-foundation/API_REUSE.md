# API REUSE — the complete backend surface V2 consumes

> Phase 0 deliverable. Enumerated from `src/api/*.ts` on 2026-08-07.
> **75 endpoints across 19 routers.** V2 adds none without an entry in `../BACKLOG.md` and approval.

## The contract

- V2 talks to **exactly one thing**: the same-origin BFF proxy at `/api/*`, which forwards to
  Express with the bearer injected from the httpOnly cookie. No new client, no new base URL.
- **Status, body and content-type pass through verbatim** — JSON, HTML documents and PDF streams
  all already work through this seam.
- `?download=1` on a `…/pdf` path makes the proxy set `Content-Disposition: attachment`.
- Errors arrive as `ApiError { status, message, payload }`. `payload` matters: **confirm returns
  422 with the per-item issues that blocked it**, and V2 must render those, not a generic failure.

## Legend

**Reuse** — V2 calls it as-is. **Shape** — the response has everything V2's screen needs.
**Gap** — V2's intended screen needs data this endpoint does not return; resolution goes to
`../BACKLOG.md` before any code is written.

---

## Public / stateless (13)

| Method | Path | Returns | V2 use |
|---|---|---|---|
| GET | `/api/systems` | profile systems | system pickers, dashboard "engine online" |
| GET | `/api/systems/:id/options` | chambers, glass, colours (+hex, texture), cills, defaultColourKey | every configurator selector; **carries no cost data** |
| GET | `/api/designs` | quotable engine designs | — (gallery uses the product route) |
| POST | `/api/quote` | full `QuoteOutput` + `limitIssues[]` | simple/express quoting path |
| POST | `/api/quote/document` | one document as HTML | quote-time document preview |
| GET | `/api/families` | family descriptors | **the basis of a task-shaped entry point** |
| GET | `/api/families/:key` | descriptor + full option system | studio inspector |
| PATCH | `/api/families/option-groups/:key` | — | admin option presentation (`catalog.update`) |
| PATCH | `/api/families/options/:key` | — | as above |
| PATCH | `/api/families/choices/:key` | — | as above |
| POST | `/api/line-items/resolve` | `ResolvedLineItem` | **the studio's live preview**; accepts `views[]` and `style` as request-only options |
| GET | `/api/branding/logo` | image stream | header/document branding |
| GET | `/api/catalog/assets/hardware/:partKey` | image (upload, else generated glyph) | **every hardware choice already has a picture** — V2 must use it |

> `POST /api/quote` and `POST /api/line-items/resolve` are the two engines of the UI. Both are
> public, stateless, and safe to call on every keystroke behind the 350 ms debounce.

## Auth (3)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login` | via the Next route that sets the httpOnly cookie — **not** the catch-all |
| GET | `/api/auth/me` | `{ user, role, isSuperAdmin, incomingApprovals, permissions, nav }` |
| POST | `/api/auth/change-password` | bumps `tokenVersion`; the Next route re-sets the cookie |

**`nav` is the navigation, as data.** V2 renders its own navigation *from this* — it must not
hardcode a menu, or permissions and the menu will drift.

## Products & designs (4)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/products?page&limit` | paginated |
| GET | `/api/products/:id` | |
| GET | `/api/products/:id/designs?page&limit` | **omits `imageSvg`** (large); `quotable:false` flagged |
| GET | `/api/designs/:id` | full record incl. `imageSvg`, `quotable`, default W×H |

**Gap G-1** — a gallery page costs `1 + N` requests: V1 fetches the page, then `Promise.all`s each
design for its SVG. Any V2 gallery inherits that. Options: keep it (it works, and degrades
gracefully per-tile), or request a `?includeSvg=1` list parameter. **Logged, not decided.**

**Gap G-2** — designs are filterable only by product and page. No filter by family, size range or
opening type. A task-shaped entry point ("I need a casement window") likely wants one.
**Logged, not decided.**

## Orders (17)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/orders` | create draft |
| GET | `/api/orders?page&limit&q&status` | **server-side search + status filter already exist** |
| GET | `/api/orders/:id` | items, `designerItems[]`, `basket`, `studioFamilyKey` per legacy item |
| PUT | `/api/orders/:id` | customer / reference (draft only) |
| DELETE | `/api/orders/:id` | `orders.delete`, scoped, cascades |
| POST | `/api/orders/:id/items` | legacy item; rejects non-quotable designs |
| DELETE | `/api/orders/:id/items/:itemId` | |
| GET | `/api/orders/:id/items/:itemId/draft` | **legacy → `LineItemDraft` converter**, read-only |
| POST | `/api/orders/:id/line-items[?replaces=]` | designer item; `replaces` swaps in one transaction |
| PUT | `/api/orders/:id/line-items/:itemId` | |
| DELETE | `/api/orders/:id/line-items/:itemId` | |
| PUT | `/api/orders/:id/commercials` | fitting/survey/delivery/discount/tax → fresh `BasketTotals` |
| POST | `/api/orders/:id/confirm` | generates 7 documents; **422 + issues** if a designer item blocks |
| POST | `/api/orders/:id/reopen` | back to draft; purges documents + cached PDFs; 409 if already draft |
| GET | `/api/orders/:id/documents` | list |
| GET | `/api/orders/:id/documents/:type` | HTML |
| GET | `/api/orders/:id/documents/:type/pdf` | lazy render → cached in object storage → streamed |

Document types: `work_order`, `cutting_list`, `bom`, `price_summary`, `work_planner`, `dmo`,
`planner_list`.

**Everything about money on an order comes from `basket`** — `src/designer/basket.ts` is the only
place order-level money is derived, and the API, the orders UI and the Price Summary all read it.
**V2 must not add, discount or tax anything itself.**

## Settings (3) · Catalog admin (12) · Discounts (4)

| Method | Path |
|---|---|
| GET / PUT | `/api/settings` · POST `/api/settings/logo` (raw `image/*`) |
| GET | `/api/catalog/:systemId` (full priced dump — **carries supplier cost**) |
| PUT | `…/parts/:kind/:partKey` · `…/glass|gaskets|hardware|cills/:partKey` |
| POST | `…/glass` · `…/cills` · `…/colours` · PUT `…/colours/:key` |
| POST | `…/import` (raw `text/csv`, header `code,cost,price`) |
| POST | `…/hardware/:partKey/image` (raw `image/*`, admin override of the glyph) |
| GET/POST/PUT/DELETE | `/api/discounts[/:code]` |

Every catalog write calls `loadCatalog()`, so in-memory pricing refreshes immediately. V2 gets that
for free and must not cache catalog prices client-side.

## Users (8) · Roles (6) · Meta (1) · Approvals (4)

| Method | Path |
|---|---|
| GET/POST | `/api/users` · GET/PATCH/DELETE `/api/users/:id` |
| POST | `/api/users/:id/{activate,deactivate,reset-password}` |
| GET/POST | `/api/roles` · GET/PATCH/DELETE `/api/roles/:id` · PUT `/api/roles/:id/permissions` |
| GET | `/api/meta/permissions` (modules × actions, for the grid editor) |
| GET | `/api/approvals` · POST `/api/approvals/:id/{approve,reject,cancel}` |

`DELETE /api/users/:id` returns **either** `{ok:true}` **or** `{status:"pending_approval", request}`
(peer-consent Super Admin deletion). V2 must handle both — a single "deleted" toast would lie.

---

## Endpoints V2 will lean on hardest

1. **`GET /api/auth/me`** → the whole navigation and every visibility decision.
2. **`POST /api/line-items/resolve`** → one live, stateless, family-agnostic configurator.
3. **`GET /api/families[/:key]`** → the option system as data; **no option key ever appears in UI
   code** (a rule V1 already holds and V2 must keep — it is what makes new options free).
4. **`GET /api/orders?q=&status=`** → real search, already server-side.
5. **`GET /api/catalog/assets/hardware/:partKey`** → pictures instead of dropdown text.

## Gaps register

| ID | Need | Status |
|---|---|---|
| **G-1** | Gallery costs 1+N requests for SVGs | Logged — may be acceptable |
| **G-2** | No design filtering by family / size / opening | Logged |
| **G-3** | No production/workflow status beyond draft/confirmed | Logged — **capability gap, not a UI gap** |
| **G-4** | No customers endpoint (`customers` RBAC module has no page) | Logged |
| **G-5** | No global search endpoint (orders search exists; products/designs do not) | Logged — relevant to the dead header search (O-1) |

**None of these may be closed by writing backend code during Phases 1–6.** They are inputs to the
Phase 2 IA decision and, if any is genuinely required, to a separate approved change.
