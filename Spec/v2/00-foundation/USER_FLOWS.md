# USER FLOWS

> Phase 0 deliverable (**as-is** flows), corrected by the Phase 1 live audit on 2026-08-07. The
> **to-be** flows are Phase 2's output and are stubbed at the bottom.
>
> **Measured method:** one instrumented evaluator walked the real Next.js + Express stack in
> Chromium at 1280×900 against the configured seeded database (516 designs, 9 orders at audit
> start), using Admin and Customer-role accounts. Clicks are split into navigation and task actions;
> form interactions and scroll are counted separately. Durations include configured-network and
> render time and are evidence of this run, not a human-study average. Commit/destructive controls
> were counted but not submitted against the shared owner database. Raw steps: `../audit/flow-walks.json`.

## The eight tasks that matter

Chosen because each is done daily by at least one of the six user types in `VISION.md`.

| # | Task | Who | Navigation + action clicks | Screen visits | Forms | Run time | Notes |
|---|---|---|---:|---:|---:|---:|---|
| F1 | Quote a standard window | Sales, quotation op | **5 + 0 header** / **4 + 0 Products** | 5 / 4 | 4 | 25.2 / 23.8 s | promoted path adds the empty-quote detour |
| F2 | Turn a quote into an order | Sales | **1 + 0** | 1 | 2 | included in F1 | counted Create order; no shared-data write |
| F3 | Configure a non-standard unit (studio) | Quotation op | **3 + 0** | 3 | 1 | 23.3 s | functional route is product card; dashboard shortcut dead-ends |
| F4 | Add commercial extras + discount | Sales, office | **2 + 1** | 1 task screen | 0 | 18.0 s | 0.6-screen scroll; Save counted |
| F5 | Confirm an order and print a cutting list | Manager | **2 + 2** | 2 | 0 | 14.4 s | 1.6-screen scan; Confirm counted, document viewed live |
| F6 | Correct a confirmed order | Office | **4 + 3** | 3 | 0 | 27.1 s | Reopen/update/re-confirm counted, not submitted |
| F7 | Update a supplier price | Admin/owner | **1 + 1** | 1 | 0 | 16.3 s | seeded system preselected; row Save counted |
| F8 | Add a user and give them access | Admin/owner | **1 + 2** | 1 | 4 | 13.8 s | existing role assigned inline; Create counted |

The durable baseline is click/screen count. Timings are single-run service observations and should
not be treated as first-time-human averages.

---

## F1 · Quote a standard window → order

**The path a user will actually try first** (the header's own primary CTA):

```
/  →  header "Quick quote"          (1)
      /quote  →  EMPTY STATE: "Start from a quotable design"
      →  "Browse products"          (2)
      /products  →  product card    (3)
      /products/[id]  →  page through up to 24 designs/page (~516 total)
      →  "Configure →" on a quotable card   (4)
      /quote?designId=…&systemId=…&productId=…
      →  set Width, Height  [+ optionally Chamber, Glass, Colour in, Colour out, Cill]
      →  350 ms debounce → live SVG + price
      →  type Customer, set Qty
      →  "Create order"             (5)
      /orders/[id]
```

**Measured: 5 navigation clicks, 5 screen visits and 4 form interactions** on the header path.

**The shorter path exists but is not signposted**: sidebar → Products (1) → card (2) →
Configure (3) → Create order (4). It measured 4 screen visits and 4 form interactions.
**The prominent CTA is one click and one screen longer** (O-3).

Friction, verified:

- The task begins with *"choose one of ~516 designs"* before the user has said what they want (O-10).
- The first screen the CTA reaches is an **empty state that sends the user away** (O-3).
- Fabricator vocabulary is unexplained: Chamber, Cill, Joints, BOM (O-14, X-5).
- Glass chosen here **does not persist** onto the order item — disclosed in one line of small grey
  text (O-16).
- The final button changes its label and the fields above it depending on a URL parameter (O-17).

## F3 · Configure a non-standard unit (the studio)

```
/products  →  product  →  quotable card  →  "Design in studio"   (3)
/designer?family=…&design=…
```

**This is the app's most capable surface and it has no sidebar entry, no RBAC module, and no
explanation of when to prefer it over "Configure →"** (O-5, O-11, O-19, O-20). Phase 1 corrected
the Phase 0 claim that it had no navigation surface at all: the dashboard has a Designer quick
action, but it opens bare `/designer`, which cannot start without family/design query parameters and
sends the user back to Products. The product card remains the only functional entry.

## F4 · Add commercial extras and a discount

```
/orders  →  order row  →  scroll past summary cards, Line items, Designer line items
                        →  "Pricing & extras"                    (2 navigation)
   fitting type (segmented) · fitting price · survey price · delivery charge
   · discount code · tax override                                (5 inputs + 1 control)
   →  Save  →  totals ledger updates                             (+1 action)
```

The customer-facing total is assembled **here**, on a different screen from `/quote`, where the
price was configured (O-26). A salesperson on the phone cannot see the number the customer will pay
while they are choosing the window.

## F5 · Confirm and print a cutting list

```
/orders  →  (search works, server-side)  →  order  →  Confirm   (2 navigation + 1 action)
   ⚠ may 422 with per-item issues that must be fixed first
→  documents grid: 7 equal cards
→  find "Cutting List" → View                                   (+1 action)
```

Seven document types (`work_order`, `cutting_list`, `bom`, `price_summary`, `work_planner`, `dmo`,
`planner_list`) are presented as **seven identical cards**, with nothing indicating which one this
user's job needs (O-27). A production operator wants one of them; a manager wants a different one.

## F6 · Correct a confirmed order

```
/orders → order → Reopen modal → Reopen → edit item → Update → Re-confirm
```

**Measured: 4 navigation + 3 task-action clicks across 3 screen visits; 27.1 s.** The three
state-changing actions were counted but not submitted against shared data.

Reopen deletes the 7 documents and purges cached PDFs, then re-confirming regenerates them.
Correct and well-implemented — but it means **"confirmed" must be presented as reversible**, and V1
presents it as a terminal state (O-28).

## F7 · Update a supplier price

```
Sidebar Catalog (1) → select system when more than one exists → find the row among hundreds across
the profile/glass/gaskets/hardware/cills/colours groups → edit → Save (+1 action)
```

The seeded audit had one system, so selection required no click. The page still took 16.3 s to reach
the counted first-row Save. Alternative, already built: **CSV import** (`code,cost,price`) — one
upload updates everything and reports `unmatched[]`. It is one control among many (O-30).

## F8 · Add a user and grant access

```
Sidebar Users (1) → Invite user (+1 action) → fill 4 fields → assign an existing Role
   → Create user (+1 action)
   ⟶ if a new role is needed: Sidebar Roles → New role → the permission GRID
      (modules × 5 actions × OWN/ALL scope)                       (O-31)
```

The grid is correct and powerful, and it is the hardest thing in the app for a non-technical owner
to reason about. Note that `DELETE /api/users/:id` can return **`pending_approval`** rather than
success (peer-consent Super Admin deletion) — a single button with two legitimate outcomes.

---

## Patterns across all eight flows

| Pattern | Flows | Consequence |
|---|---|---|
| **Every flow starts by browsing a catalog** | F1, F2, F3 | The user must translate intent into a catalog choice unaided (X-6) |
| **The prominent CTA is not the shortest path** | F1 | The UI actively suggests the slower route (O-3) |
| **The best tool's shell shortcut cannot start** | F3 | It dead-ends; usable entry remains buried on a gallery card (X-4) |
| **Related decisions are split across screens** | F1 + F4 | Price is built in one place, priced in another (O-26) |
| **Outcome sets are flat and undifferentiated** | F5, F7 | 7 equal document cards; hundreds of equal catalog rows |
| **Vocabulary assumes fabrication training** | all | X-5 |
| **A single action can have two different outcomes** | F5 (confirm→422), F8 (delete→pending) | Success/failure is not binary and the UI must say so |

---

## To-be flows — Phase 2 target

**Finalised 2026-08-07, awaiting the Phase 2 owner gate.** The complete workflow rationale,
screen hierarchy and functional-parity map live in `../phase-2-information-architecture.md`.

Clicks remain `navigation + task actions`; family/layout choice and field entry are form
interactions. A target beats V1 when navigation or screen visits fall and total clicks do not rise.

| Flow | V1 measured | V2 target | V2 screens | Change |
|---|---:|---:|---:|---|
| F1 Quote a standard window | **5 + 0**, 5 screens | **1 + 1** | 2 | Home → task-first Standard workspace; no catalog/empty-state backtrack |
| F2 Turn quote into order | **1 + 0**, 1 screen | **0 + 1** | 1 | Intentional draft-on-review saves the item without leaving the workspace |
| F3 Configure a non-standard unit | **3 + 0**, 3 screens | **1 + 0** | 2 | Home → Custom disclosure in the same workspace |
| F4 Add commercial extras + discount | **2 + 1**, 1 task screen | **0 + 1** | 1 | Customer price is a workspace section backed by order `basket` |
| F5 Confirm and view cutting list | **2 + 2**, 2 screens | **1 + 2** | 2 | Direct scoped order entry; grouped Documents selected after confirm |
| F6 Correct a confirmed order | **4 + 3**, 3 screens | **1 + 3** | 2 | Reopen/edit/reconfirm within one order/workspace hierarchy |
| F7 Update a supplier price | **1 + 1**, 1 screen | **1 + 0** | 1 | One active catalog group; validated row commit on Enter/blur |
| F8 Add a user and grant access | **1 + 2**, 1 screen | **1 + 1** | 1 | Invite row available immediately on Team for `users.create` |

### Existing endpoint coverage

| Flow | Existing contract; no new endpoint |
|---|---|
| F1 | families → family → scoped product designs → design → line-items/resolve → orders/line-items |
| F2 | POST orders + POST order line-item |
| F3 | same family/design reads + line-items/resolve |
| F4 | PUT order commercials; display returned basket |
| F5 | GET order → POST confirm → GET documents/type |
| F6 | POST reopen → legacy item draft or Designer item → update/replace → POST confirm |
| F7 | GET catalog → existing group-row PUT |
| F8 | GET users/roles → POST user |

### Disclosure without removal

- Standard and Custom are two entry modes of one configure workspace; every `/quote` and
  `/designer` capability has a V2 home.
- All seven documents remain, grouped as Office, Production and Dispatch.
- Legacy and Designer line items remain editable through their correct endpoints but appear in one
  conceptual Items list.
- Catalog pricing retains all six groups, row creation, hardware images and CSV import while showing
  one group at a time.
- Customers and production state are not hidden features: they do not exist in V1 and remain
  explicit G-4/G-3 capability gaps.
