# Phase 1 findings — V1 UX audit

**Status:** ✅ **owner approved 2026-08-07** · Phase 2 authorised

## Executive Summary

V1 is functionally broad and its fabrication canvas is strong, but common work is made harder by
the shell and information architecture around it. The audit's highest-scoring finding is not visual
polish: the most prominent controls make promises they do not keep. Global search is inert, Create
order opens a list, and both quote CTAs open an empty state. A standard quote took **5 navigation
clicks and 5 screen visits** by the promoted header path versus **4 and 4** through Products.

The second cluster is scale. The live database exposed 516 designs. A product page fetched 24 SVGs
one by one and took **12.0 s** in the 1280 capture; the catalog took **25.9 s**, loaded **1,127
interactive controls**, and occupied **20.4 viewports**. At 834 px there was no page-level horizontal
overflow, but stacked journeys became longer while the controls remained mostly 40 px high and text
remained 14 px or smaller. That is technically responsive, not factory-usable.

The audit also corrects one Phase 0 claim. Designer is not completely absent from navigation: the
dashboard has a Designer shortcut. The shortcut opens bare `/designer`, however, which cannot start
without a family/design and sends the user back to Products. Designer still has no sidebar/RBAC
module; its only functional entry is a secondary gallery-card action.

All 14 draft design principles are **confirmed by evidence**; none is struck. The seven prior mockups
are directionally aligned with a clearer, more visual product, but several introduce unimplemented
production states, metrics, exports, and management actions. They are intent references, not a
functional specification. Phase 2 should optimise against the ranked evidence below while preserving
V1 parity and the frozen backend.

## Audit scope and confidence

- Real Next.js UI + Express API; configured seeded database with 516 designs and 9 orders at audit
  start; all 25 Prisma migrations applied.
- Admin and Customer-role views; 18 core screens at 1280, 1920, and 834; 4 alternate states and 3
  Customer-role checks. **64 PNG files** including three catalog bottom supplements.
- One instrumented 1280×900 evaluator walkthrough of F1–F8. Durations include network/render time
  and are evidence of this run, not a usability-study average.
- Shared owner data was treated read-only. Destructive/commit actions were inspected and counted but
  not submitted. This limits confidence about post-submit feedback but not about discoverability,
  pre-submit decisions, wording, page density, or navigation.
- Raw evidence and the objective control-count method are documented in [`audit/README.md`](audit/README.md),
  [`audit-metadata.json`](audit/audit-metadata.json), and [`flow-walks.json`](audit/flow-walks.json).

## Measured V1 flows

Clicks are `navigation + task action`; form interactions and scroll are separate. “Counted” means a
visible enabled commit control was included without writing to shared data.

| Flow | Measured clicks | Screen visits | Form interactions | Scroll (screens) | Run time | What happened |
|---|---:|---:|---:|---:|---:|---|
| F1 header | **5 + 0** | 5 | 4 | 0 recorded | 25.2 s | Quick quote dead-ended at empty `/quote`, then backtracked through Products |
| F1 sidebar | **4 + 0** | 4 | 4 | 0 recorded | 23.8 s | Products avoided the empty-state detour |
| F2 | **1 + 0** | 1 | 2 | — | included in F1 | Customer/quantity plus counted Create order |
| F3 | **3 + 0** | 3 | 1 | — | 23.3 s | Products → product → Design in studio; dashboard shortcut separately dead-ended |
| F4 | **2 + 1** | 1 task screen | 0 | 0.6 | 18.0 s | Six commercial decisions; Save pricing counted |
| F5 | **2 + 2** | 2 | 0 | 1.6 | 14.4 s | Confirm counted; Cutting List found among seven cards and viewed live |
| F6 | **4 + 3** | 3 | 0 | — | 27.1 s | Reopen modal, edit route, Update and re-confirm; commits counted |
| F7 | **1 + 1** | 1 | 0 | 0.2 | 16.3 s | Seeded system preselected; first-row Save counted after catalog load |
| F8 | **1 + 2** | 1 | 4 | — | 13.8 s | Inline Invite user and existing-role assignment; Create user counted |

The header hypothesis is confirmed: the promoted F1 path is one click and one screen longer. Timing
varied with live service latency, so click/screen counts are the durable baseline.

## Top 10 pain points

### 1. The shell's most prominent controls are dead or misleading — score 64

**What / who / frequency:** Search, Create order, Quick quote, and New quote affect almost every role
on every session. **Evidence:** [dashboard](audit/screens/03-dashboard-1280.png),
[`nav.tsx:111–166`](../../web/app/(app)/nav.tsx), and
[empty quote](audit/screens/state-quote-empty-1280.png) with
[`configurator.tsx:233–245`](../../web/app/(app)/quote/configurator.tsx). **Cost:** F1 adds an empty
screen and backtrack (5 clicks/5 visits versus 4/4); global search can end in task abandonment
because it produces no result at all. IDs: O-1…O-4, X-3.

### 2. The product cannot represent production progress — score 48

**What / who / frequency:** Managers and production staff cannot tell whether a confirmed order is
cut, glazed, or dispatched. Every live order remains one of two commercial states. **Evidence:**
[orders](audit/screens/08-orders-1280.png) and [`schema.prisma:543–556`](../../prisma/schema.prisma).
The production-control mockup shows the unmet intent. **Cost:** the workflow task cannot be completed
in V1 or V2 without a separately approved capability; any production timeline would be invented.
IDs: O-23, G-3.

### 3. Quoting starts from a 516-design catalog, not from the user's task — score 48

**What / who / frequency:** Sales and quotation operators must choose a product and design before
stating the window they need. This occurs in F1–F3. **Evidence:**
[product gallery](audit/screens/05-product-detail-1280.png), F1/F3 recorded walks, and
[`products/[id]/page.tsx:122–163`](../../web/app/(app)/products/[id]/page.tsx). **Cost:** up to 24
choices per page, no family/size/opening filter, 4.8 screens of content, and a 12.0 s measured load.
IDs: O-10, O-13, X-6, G-2.

### 4. Density and target size are wrong for hands, tablets, and older eyes — score 48

**What / who / frequency:** Almost every role meets 40 px controls, 14 px body text, 11 px labels,
and high-density tables; factory users are specifically exposed. **Evidence:**
[quote at 834](audit/screens/06-quote-834.png), [catalog at 834](audit/screens/13-admin-catalog-834.png),
and [`ui.tsx:9–33`](../../web/components/ui.tsx). **Cost:** the quote becomes 2.5 screens, product
detail 5.6, and catalog 19.5 at tablet width; touch precision and scanning effort rise even without
global overflow. IDs: X-8, O-9, O-30.

### 5. Trade vocabulary is unexplained — score 48

**What / who / frequency:** New salespeople and office users meet Chamber, Cill, Joints, BOM, DMO,
Planner List, Transom, Mullion, and Weld allowance without plain-word context. It spans quote,
Designer, order documents, settings, and catalog. **Evidence:** [quote](audit/screens/06-quote-1280.png),
[order documents](audit/screens/09-order-detail-1280.png), and
[`configurator.tsx:293–399`](../../web/app/(app)/quote/configurator.tsx). **Cost:** 5 detected trade
terms on quote, 4 on order detail, and 5 on catalog; every unfamiliar term creates a stop/guess/ask
decision. IDs: O-14, X-5.

### 6. Every role receives essentially the same information density — score 48

**What / who / frequency:** A Customer or production operator traverses the same dashboard/order
shapes as an administrator, with only navigation filtered. **Evidence:**
[Customer dashboard](audit/screens/customer-dashboard-1280.png),
[Customer orders](audit/screens/customer-orders-1280.png), and
[`registry.ts:108–114`](../../src/rbac/registry.ts). **Cost:** low-frequency technical and catalog
information competes with the role's next task on every session. IDs: O-6…O-9, X-7.

### 7. Two configurators compete, while Designer's shortcut cannot start — score 36

**What / who / frequency:** Quote and Designer sit on the same design card without explaining which
one to use. Designer has the better interaction grammar but no permission module or functional shell
entry. **Evidence:** [Designer](audit/screens/07-designer-1280.png),
[empty Designer](audit/screens/state-designer-empty-1280.png),
[`registry.ts:45–58`](../../src/rbac/registry.ts), and F3. **Cost:** a user trying the dashboard
shortcut must backtrack; a gallery card demands an unexplained mode choice. Corrected finding: a
dashboard shortcut does exist, but is non-functional for starting work. IDs: O-5, O-11, O-19…O-21,
X-1, X-2, X-4.

### 8. The customer-facing total is split across quote and order — score 36

**What / who / frequency:** Sales configures engineering price in quote, then moves to order detail
for fitting, survey, delivery, discount, tax, and final ledger. **Evidence:**
[quote](audit/screens/06-quote-1280.png), [draft order](audit/screens/state-order-draft-1280.png),
and [`orders/[id]/page.tsx:318–355`](../../web/app/(app)/orders/[id]/page.tsx). **Cost:** F4 adds a
separate task screen, six decisions, three task clicks, and 18.0 s before the customer total is known.
IDs: O-18, O-25, O-26.

### 9. Live-data fan-out makes key choice screens slow — score 32

**What / who / frequency:** Every quote-via-gallery waits for a list plus one full request per visible
design; the catalog renders hundreds of row editors. **Evidence:**
[`products/[id]/page.tsx:76–90`](../../web/app/(app)/products/[id]/page.tsx),
[catalog top](audit/screens/13-admin-catalog-1280.png),
[catalog bottom](audit/screens/13-admin-catalog-1280-bottom.png), and metadata. **Cost:** product
detail measured 12.0 s; catalog 25.9 s and 1,127 controls. IDs: G-1, O-30.

### 10. Confirmed-order output and correction carry a large mental model — score 24

**What / who / frequency:** Seven equally weighted document cards give no role cue; correcting a
confirmed order removes and later regenerates all seven. **Evidence:**
[confirmed order at 834](audit/screens/09-order-detail-834.png),
[`orders/[id]/page.tsx:370–404`](../../web/app/(app)/orders/[id]/page.tsx), and
[`order-actions.tsx:169–193`](../../web/app/(app)/orders/[id]/order-actions.tsx). **Cost:** F5 requires
scanning and 1.6 screens; F6 requires 7 clicks across 3 screens and took 27.1 s. IDs: O-27, O-28.

## Cognitive-load baseline by screen

Control and scroll figures are measured at 1280×900. Decisions are evaluator counts of independent
choices required before the screen's primary task; `N+` means the number varies with rows/content.
“Densities” counts materially distinct presentation modes; “competing” counts simultaneously loaded
interactive elements other than the primary action.

| # | Screen | Controls rest / total | Decisions before primary | Unexplained terms | Densities | Competing | Scroll screens |
|---:|---|---:|---:|---|---:|---:|---:|
| 1 | Login | 3 / 3 | 2 | — | 1 | 2 | 1.0 |
| 2 | Change password | 4 / 4 | 3 | — | 1 | 3 | 1.0 |
| 3 | Dashboard | 6 / 12 | 5 | profile system | 3 | 11 | 1.5 |
| 4 | Products | 7 / 7 | 5 | product/system IDs | 1 | 6 | 1.2 |
| 5 | Product detail | 10 / 54 | 26 | quotable, system/design IDs | 2 | 53 | 4.8 |
| 6 | Quote | 13 / 16 | 10 | BOM, chamber, cill, joints, profile system | 5 | 15 | 1.8 |
| 7 | Designer | 24 / 24 | 6 | transom, mullion | 3 | 23 | 1.0 |
| 8 | Orders | 69 / 69 | 3 + choose row | draft/confirmed | 2 | 68 | 1.1 |
| 9 | Order detail | 4 / 24 | 3 + choose document | BOM, DMO, planner list, work planner | 5 | 23 | 2.7 |
| 10 | Account | 1 / 1 | 1 | peer consent | 2 | 0 | 1.0 |
| 11 | Admin hub | 5 / 5 | 5 | — | 1 | 4 | 1.1 |
| 12 | Settings | 15 / 16 | 9 | weld allowance | 2 | 15 | 1.1 |
| 13 | Catalog | 24 / **1,127** | find row + 4 values | chamber, cill, transom, mullion, profile system | 6 | 1,126 | **20.4** |
| 14 | Discounts | 8 / 8 | 6 | live/scheduled/expired | 2 | 7 | 1.0 |
| 15 | Users | 7 / 7 | 4 | activate/deactivate, peer consent | 2 | 6 | 1.0 |
| 16 | User detail | 12 / 12 | 4 | role scope | 3 | 11 | 1.0 |
| 17 | Roles | 6 / 6 | 2 | system role | 2 | 5 | 1.0 |
| 18 | Role detail | 25 / 62 | 50 matrix cells | view/read/create/update/delete, Own/All | 1 | 61 | 1.7 |

## Ranking rubric and evidence index

Each item scores **frequency × severity × affected users** (maximum 64):

- **Frequency:** 1 rare/quarterly · 2 periodic · 3 recurring · 4 every relevant core task/session.
- **Severity:** 1 cosmetic · 2 recoverable friction · 3 material delay/confidence loss/backtrack ·
  4 misleading, blocking, or task cannot be completed.
- **Affected users:** 1 specialist role · 2 two role groups · 3 several roles · 4 almost everyone.

Evidence codes keep the 45-row register readable:

| Code | Reproducible evidence |
|---|---|
| E1 | [Dashboard shell](audit/screens/03-dashboard-1280.png) + [`nav.tsx:111–193`](../../web/app/(app)/nav.tsx) |
| E2 | [Empty quote](audit/screens/state-quote-empty-1280.png) + F1 in [`flow-walks.json`](audit/flow-walks.json) + [`configurator.tsx:233–245`](../../web/app/(app)/quote/configurator.tsx) |
| E3 | [Product detail](audit/screens/05-product-detail-1280.png) + [`products/[id]/page.tsx:76–163`](../../web/app/(app)/products/[id]/page.tsx) + metadata |
| E4 | [Quote 834](audit/screens/06-quote-834.png) + [`configurator.tsx:293–399`](../../web/app/(app)/quote/configurator.tsx) |
| E5 | [Designer](audit/screens/07-designer-1280.png) + [empty state](audit/screens/state-designer-empty-1280.png) + F3 + [`registry.ts:45–58`](../../src/rbac/registry.ts) |
| E6 | [Orders](audit/screens/08-orders-1280.png) + [`schema.prisma:543–556`](../../prisma/schema.prisma) |
| E7 | [Draft order](audit/screens/state-order-draft-1280.png) + [confirmed order](audit/screens/09-order-detail-1280.png) + F4/F5 |
| E8 | [Order detail 834](audit/screens/09-order-detail-834.png) + F6 + [`order-actions.tsx:169–193`](../../web/app/(app)/orders/[id]/order-actions.tsx) |
| E9 | [Account](audit/screens/10-account-1280.png) + [Admin hub](audit/screens/11-admin-1280.png) + E1 |
| E10 | [Settings](audit/screens/12-admin-settings-1280.png) + `web/app/(app)/admin/settings/page.tsx:1–174` |
| E11 | [Catalog top](audit/screens/13-admin-catalog-1280.png) + [bottom](audit/screens/13-admin-catalog-1280-bottom.png) + [`catalog-editor.tsx:40–120`](../../web/app/(app)/admin/catalog/catalog-editor.tsx) + metadata |
| E12 | [Role matrix](audit/screens/18-admin-role-detail-1280.png) + `web/app/(app)/admin/roles/[id]/grid-editor.tsx:140–202` |
| E13 | [Customer dashboard](audit/screens/customer-dashboard-1280.png) + [admin redirect](audit/screens/customer-admin-attempt-1280.png) + [`registry.ts:108–114`](../../src/rbac/registry.ts) |
| E14 | [Injected quote error](audit/screens/state-quote-error-1280.png) + [`audit-metadata.json`](audit/audit-metadata.json) |
| E15 | 834 screen set + [`ui.tsx:9–33`](../../web/components/ui.tsx) + [`nav.tsx:192–193`](../../web/app/(app)/nav.tsx) |
| E16 | Seven `web/DESIGN/*/screen.png` files reviewed with their adjacent `code.html` |
| E17 | F1–F8 recorded steps and timings in [`flow-walks.json`](audit/flow-walks.json) |

## Ranked observation register

“Confirmed” means reproduced live or verified in current source. X-9 is source-confirmed but was not
reproduced with the two seeded roles: Customer had orders permission and was correctly redirected
away from admin. O-5/O-19 are **corrected**, not rejected.

| Rank | ID | Finding | F×S×A | Score | Status | Evidence |
|---:|---|---|---:|---:|---|---|
| 1 | O-1 | Global search is inert | 4×4×4 | **64** | Confirmed | E1 |
| 2 | X-3 | Dead/misleading controls occupy primary chrome | 4×4×4 | **64** | Confirmed | E1, E2 |
| 3 | O-3 | Quote CTAs open an empty state | 4×4×3 | **48** | Confirmed | E2, E17 |
| 4 | O-23 | Only draft/confirmed; no production status | 4×4×3 | **48** | Confirmed gap | E6, E16 |
| 5 | X-5 | Fabricator vocabulary is unexplained across tasks | 4×3×4 | **48** | Confirmed | E4, E7, E11 |
| 6 | X-6 | No task-shaped entry; quoting starts in catalog | 4×4×3 | **48** | Confirmed | E2, E3, E17 |
| 7 | X-7 | Information density is uniform across roles | 4×3×4 | **48** | Confirmed | E7, E11, E13 |
| 8 | X-8 | Type, controls, rows, and width target density over accessibility | 4×3×4 | **48** | Confirmed | E15 |
| 9 | G-3 | Production/workflow state is absent from data/API | 4×4×3 | **48** | Confirmed gap | E6, E16 |
| 10 | O-2 | Create order opens the order list | 4×3×3 | **36** | Confirmed | E1 |
| 11 | O-4 | Shell offers four competing ways to start work | 4×3×3 | **36** | Confirmed | E1 |
| 12 | O-8 | Dashboard has no single next step | 4×3×3 | **36** | Confirmed | E1 |
| 13 | O-10 | Gallery is mandatory entry to configurators | 3×4×3 | **36** | Confirmed | E3, E17 |
| 14 | O-14 | Quote uses unexplained trade vocabulary | 4×3×3 | **36** | Confirmed | E4 |
| 15 | O-26 | Commercial layer is separated from configuration | 3×4×3 | **36** | Confirmed | E4, E7, E17 |
| 16 | X-2 | Designer and the rest use different interaction languages | 3×4×3 | **36** | Confirmed | E4, E5 |
| 17 | O-7 | Infrastructure status is shown to every role | 4×2×4 | **32** | Confirmed | E1, E13 |
| 18 | O-11 | Gallery card presents two unexplained configurator actions | 4×4×2 | **32** | Confirmed | E3 |
| 19 | O-25 | Money is split across three order-detail surfaces | 4×4×2 | **32** | Confirmed | E7 |
| 20 | X-1 | Two overlapping configurators have no selection guidance | 4×4×2 | **32** | Confirmed | E3, E4, E5 |
| 21 | G-1 | Design gallery performs list + N SVG fetches | 4×4×2 | **32** | Confirmed gap | E3 |
| 22 | O-18 | Quote leads with engineering components, not full customer context | 3×3×3 | **27** | Confirmed | E4, E7 |
| 23 | O-6 | Dashboard metrics are not role-actionable business measures | 4×2×3 | **24** | Confirmed | E1, E13 |
| 24 | O-9 | Dashboard mixes three information densities | 4×2×3 | **24** | Confirmed | E1 |
| 25 | O-13 | Designs have pagination but no task-relevant filters | 3×4×2 | **24** | Confirmed | E3 |
| 26 | O-16 | Quote glass choice does not persist to the order item | 3×4×2 | **24** | Confirmed | E4, `configurator.tsx:538–596` |
| 27 | O-20 | Bare Designer cannot start without family/design | 3×4×2 | **24** | Confirmed | E5 |
| 28 | O-21 | Best progressive-disclosure grammar exists on one screen | 3×2×4 | **24** | Confirmed | E5 |
| 29 | O-24 | Order detail separates line items by implementation source | 3×4×2 | **24** | Confirmed | E7 |
| 30 | O-27 | Seven documents are equal cards without role cues | 3×4×2 | **24** | Confirmed | E7, E8, E17 |
| 31 | G-2 | API/UI cannot filter designs by family/size/opening type | 3×4×2 | **24** | Confirmed gap | E3 |
| 32 | G-5 | No endpoint supports promised cross-domain global search | 4×3×2 | **24** | Confirmed gap | E1 |
| 33 | O-5 | Designer has no sidebar/RBAC module; shell shortcut dead-ends | 3×3×2 | **18** | **Corrected** | E5 |
| 34 | O-19 | Designer's shell shortcut is visible but cannot start work | 3×3×2 | **18** | **Corrected** | E5, E17 |
| 35 | X-4 | Best feature is misleadingly discoverable | 3×3×2 | **18** | **Corrected** | E5 |
| 36 | G-4 | Customer model/module exists but no customers page | 2×3×3 | **18** | Confirmed gap | `registry.ts:45–58`; `prisma/schema.prisma:522–541` |
| 37 | O-17 | Add-to/Create-order meaning changes by URL context | 2×2×4 | **16** | Confirmed | E4 |
| 38 | O-28 | Reopen changes the mental model of confirmed | 2×4×2 | **16** | Confirmed | E8, E17 |
| 39 | O-22 | Items count merges two implementation types | 2×2×3 | **12** | Confirmed | E6, E7 |
| 40 | O-30 | Catalog is a 1,127-control, 20-screen editor | 3×4×1 | **12** | Confirmed | E11, E17 |
| 41 | X-9 | Non-admin page guards are incomplete | 2×3×2 | **12** | Source-confirmed; seeded roles did not reproduce | E13; `web/app/(app)/admin/layout.tsx:1–35` |
| 42 | O-12 | Preview-only designs consume gallery positions | 2×2×2 | **8** | Confirmed | E3 |
| 43 | O-31 | Role editor demands a technical permission matrix | 2×4×1 | **8** | Confirmed | E12 |
| 44 | O-15 | Internal design ID is shown as a badge | 2×1×2 | **4** | Confirmed | E4 |
| 45 | O-29 | Admin hub duplicates sidebar navigation | 2×1×2 | **4** | Confirmed | E9 |

## Prior mockup review

| Mockup | Intended direction | Disagreement with shipped V1 / evidence constraint |
|---|---|---|
| `dashboard_fab_erp` | Operational command centre: revenue, production, approvals, quick work, calendar | V1 has no due/late/production state; several metrics and calendar concepts lack API evidence |
| `orders_fab_erp` | Stage-oriented Kanban from Draft through Delivered | Stages after Confirmed require G-3; V1 only stores draft/confirmed |
| `order_documents_fab_erp` | Explain documents by purpose and role instead of codes | Good intent, but mockup shows six cards and adds Bulk Export, New Document, version/status concepts absent from V1 |
| `products_fab_erp` | Photo-led, filterable product discovery with clearer comparison | Adds filters, U-value/security facts, export/register/product-management actions not present in V1/API |
| `quote_configurator_fab_erp` | Drawing-led composition, left configuration, right price/BOM, persistent actions | Closest to shipped capability and owner taste; still dense and includes option claims that must come only from existing endpoints |
| `administration_fab_erp` | Coherent administration sub-navigation and clearer sections | Adds system-health, exports, and row-creation actions beyond shipped functionality |
| `production_control_fab_erp` | Shop-floor machine/yield/waste workflow | Entirely unbuilt; contradicts current data model and is direct evidence for G-3, not approved V2 scope |

The mockups support the desire for visual hierarchy, purpose-led labels, and a dominant drawing.
They do not override the backend freeze or the no-new-features rule.

## P1–P14 verdicts

| Principle | Verdict | Evidence |
|---|---|---|
| P1 One primary action | **Confirmed** | Dashboard/shell expose many competing starts (E1; O-4/O-8) |
| P2 No dead controls | **Confirmed** | Search inert; Create order and quote CTAs mislead (E1/E2) |
| P3 Start from task | **Confirmed** | F1–F3 begin in the 516-design catalog (E3/E17) |
| P4 Progressive disclosure without removal | **Confirmed** | Designer proves it can reduce at-rest load while preserving options (E5/O-21) |
| P5 Plain words plus trade term | **Confirmed** | Terms detected across quote/order/catalog (E4/E7/E11) |
| P6 Sized for hand and eye | **Confirmed** | 834 journeys lengthen while 40 px/14 px/11 px controls persist (E15) |
| P7 One interaction language | **Confirmed** | Designer grammar is isolated from the other 17 screens (E4/E5) |
| P8 Drawing is the hero | **Confirmed** | Live quote/Designer drawing is the most immediate trusted feedback (E4/E5); mockups agree |
| P9 Explain outcomes | **Confirmed** | Reopen deletes/regenerates seven docs; quote error needs specific recovery (E8/E14) |
| P10 Money has one shape | **Confirmed** | Quote engineering price and order commercial ledger are split (E4/E7) |
| P11 Fewer colours, more meaning | **Confirmed** | Dashboard, documents, badges, and mockups use decoration and state colour simultaneously |
| P12 Permission-shaped | **Confirmed** | Customer nav/redirect work when driven by grants; X-9 shows the guard consistency requirement (E13) |
| P13 Frontend invents no fabrication | **Confirmed** | G-3 and mockup gaps demonstrate the risk; schema/API do not contain the proposed workflow state (E6/E16) |
| P14 V1 is never collateral damage | **Confirmed** | Phase 1 produced evidence/docs only; application and backend diffs are empty |

## Owner gate

**Approved 2026-08-07.** The owner's instruction “p2 now” accepted this evidence as the basis for
Phase 2. The audit remains the measured V1 baseline.
