# Phase 1 audit evidence

This folder is the reproducible evidence bundle for the 2026-08-07 V1 UX audit. It contains
**54 core captures** (18 screens × 3 widths), 4 alternate-state captures, 3 Customer-role checks,
and 3 supplemental bottom-of-page captures for the unusually tall catalog. Total: **64 PNGs**.

## Method

- The real Next.js UI and Express API were run locally against the already-seeded configured
  database (516 designs, 9 orders at audit start). Prisma reported all 25 migrations applied.
- Screens were captured in Chromium at 1280×900, 1920×1080, and 834×1112. `localhost` was used so
  Next.js client hydration matched the configured development origin.
- An Admin and a Customer-role throwaway account were used. The Customer check recorded its four
  permitted navigation items and the redirect from `/admin` to `/`. Both audit accounts were
  removed after capture.
- `controlsAtRest` and `controlsTotal` count visible `a[href]`, `button`, `input`, `select`, and
  `textarea` elements inside `main`. “At rest” means intersecting the initial viewport. Table row
  links count individually. `scrollScreens` is document height divided by viewport height.
- Flow timing is one instrumented evaluator run at 1280×900. It includes configured-network and
  render time and is not a human-study average. Clicks are split between navigation and task
  actions; form interactions and scroll depth are separate.
- To protect the shared owner data, controls that create, update, confirm, reopen, or delete were
  inspected and counted but not submitted. Navigation, forms, previews, drawers, modals, document
  viewing, role filtering, empty states, and an injected quote-engine error were exercised live.

## Files

| File | Purpose |
|---|---|
| `audit-metadata.json` | Load time, control count, terms, scroll, overflow, paths, and role results |
| `flow-walks.json` | Step-by-step F1–F8 measurements and safety notes |
| `capture.mjs` | Core screen/state/role capture harness |
| `capture-role-check.mjs` | Isolated Customer `/admin` redirect capture |
| `walk-flows.mjs` | Read-only flow walkthrough harness |
| `screens/*.png` | The 64 visual evidence files |

The scripts require `AUDIT_ADMIN_EMAIL`, `AUDIT_CUSTOMER_EMAIL`, and `AUDIT_PASSWORD` as applicable;
the completed audit deliberately retains no credentials. `AUDIT_CHROME` can override the Chromium
path. Seed-record IDs are an audit-snapshot detail and may need refreshing before a later rerun.

## Coverage

Core screens: login, forced-password change, dashboard, products, product detail, quote, Designer,
orders, confirmed order detail, account, admin hub, settings, catalog, discounts, users, user detail,
roles, and role detail. Alternate states: empty quote, empty Designer, draft order, and injected quote
error. Customer checks: dashboard, orders, and attempted admin access.

The catalog exceeds the full-page capture threshold (16,000 px), so each width has a top image and
a `-bottom.png` supplement. No core screen had page-level horizontal overflow at any measured width;
that does not make dense tables finger-friendly, because their internal controls remain small.
