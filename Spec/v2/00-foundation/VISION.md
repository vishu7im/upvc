# VISION — FabricatorOS V2

> Phase 0 deliverable. Authored 2026-08-07 from the owner brief + verified repository discovery.

## The problem, stated precisely

V1 does everything a uPVC fabrication business needs. It quotes, configures, prices against real
supplier price lists, solves fabrication geometry calibrated against production jobs, produces
seven printable documents, exports PDFs, manages users, roles and permissions.

**None of that is the problem.**

The problem is that a 55-year-old factory manager who fabricates windows for a living opens the app
and cannot tell what to do next. The functionality is present and the path to it is not.

Discovery found concrete, measurable instances of exactly that (full evidence in
`SCREEN_INVENTORY.md`; ranking and remedies are Phase 1's job, not this document's):

- The application's most capable tool — the Designer studio, four product families, component-level
  editing, four elevation views — **has no sidebar entry or RBAC module**. A dashboard quick action
  exists, but it opens the studio without the required family/design and dead-ends back to Products;
  the only functional entry is a secondary link on a card inside a paginated product gallery.
- The two most prominent buttons in the header, "Create order" and "Quick quote", **both dead-end**:
  one navigates to a list rather than creating anything, the other lands on an empty state that
  instructs the user to go somewhere else and start again.
- The global search box in the header **is not wired to anything**. It has no handler, no form and
  no results. It is a control that looks like the primary way to find things and does nothing.
- **Two different configurators** (`/quote` and `/designer`) solve overlapping problems with
  different vocabulary, different controls and different capabilities, and nothing on screen
  explains which one a user should be in.
- The quote configurator presents **10 controls, 5 result panels and 2 preview modes on one screen**
  before the user has been told what they are building.

These are not cosmetic complaints. Each one costs a non-technical operator time, confidence, or the
task entirely.

## Who this is for

| User | What they actually do all day | What V2 owes them |
|---|---|---|
| **Factory owner** | Checks money and workload; rarely configures | One screen that answers "how are we doing" without interpretation |
| **Factory manager** | Turns confirmed orders into shop-floor paperwork | The document they need, found and printed, in ≤3 clicks |
| **Sales** | Turns a phone call into a priced quote | Quote a standard window without learning fabrication vocabulary |
| **Quotation operator** | Configures units all day, high volume | Speed and repeatability; keyboard-first; never re-enter what's known |
| **Production operator** | Reads cutting lists and work orders | Large type, printable, no navigation required |
| **Office staff** | Customers, references, admin | Obvious forms; no exposure to catalog or engine internals |

Shared traits, and they are the design constraint: **not technical, prefer large targets, need
obvious navigation, need a visible workflow, need fewer clicks and less thinking.** Several use the
app on a factory floor, standing, possibly on a tablet, possibly with gloves.

## What V2 is

A second frontend — modern, minimal, professional — over the identical backend.

**Apple** simplicity of choice · **Linear** consistency of interaction · **Stripe** polish of
surface · **Notion** generosity of spacing · **Figma** cleanliness of canvas. Applied to a factory,
not a startup: bigger targets, plainer words, fewer colours, less chrome.

Every screen answers three questions **before** the user has to think:

1. **What am I looking at?**
2. **What should I do next?**
3. **Can I finish this in a few clicks?**

## What V2 is not

- **Not a rewrite.** The engine, pricing, documents, database and permissions are untouched.
- **Not a feature release.** If a capability does not exist in V1, it does not appear in V2.
- **Not a replacement.** V1 stays live, complete, and one click away, indefinitely.
- **Not a redesign of the fabrication drawing.** `renderSvg` output is the product; V2 frames it.
- **Not a new API.** New endpoints only where V2 provably cannot be built without one, and every
  such case is logged in `../BACKLOG.md` for approval before it is written.

## What V2 deliberately keeps

Everything. Reordering, grouping, deferring and hiding-until-relevant are permitted. **Deleting a
capability is not.** Where V1 exposes something an operator should not routinely see (supplier cost
columns, weld allowances, option keys), V2 moves it behind an explicit "advanced" surface — it does
not remove it, and the permission that governed it still governs it.

## Success metric

> A factory operator completes common tasks with **fewer clicks, less scrolling, less confusion and
> more confidence**, while **100% of existing functionality is preserved**.

Made measurable, per task, against a V1 baseline that Phase 1 will record:

| Measure | How it is checked |
|---|---|
| **Clicks to complete** | Counted on the real app for each of the top 8 tasks (`USER_FLOWS.md`) |
| **Screens traversed** | Counted on the same runs |
| **Dead controls** | Must be **zero** in V2: every visible control does something or is not shown |
| **Time to first correct action** | Can a new user find the right starting point unaided? |
| **Functional parity** | Every V1 capability reachable in V2 — tracked as a line-by-line checklist |
| **Backend delta** | Lines changed under `src/` — target **0** for presentation work |
| **V1 integrity** | `web/app/(app)/**` byte-identical; `npm run validate` unchanged |

The last two are the ones that keep the project honest. If V2 is making us change the engine, V2 is
doing something it was told not to do.

## Non-goals for V2

- Mobile-first phone UI (tablet and desktop are the real factory devices; phone is view-only)
- Offline mode
- Multi-tenancy (the schema has `Organization` seeded; routing it is out of scope — see
  `docs/rbac/PLAN.md` §9)
- New product families, new profile systems, new calibration
- Changing any document's printed output
