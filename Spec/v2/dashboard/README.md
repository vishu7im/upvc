# Phase 6 dashboard evidence

The HTML files in this folder render the production `DashboardHome`, V2 shell primitives and the
same permission/scope helpers as `/v2`. Their endpoint-shaped data is deterministic evidence only;
the harness does not bypass authentication or claim to be a live database session. The real page
loads its figures through `serverApiGet` and `loadDashboardData`.

Variants:

- `organisation-scope.html` — ALL order scope, management navigation and two incoming approvals
- `personal-scope.html` — OWN order scope and Work navigation only
- `empty.html` — OWN scope with exact draft and confirmed counts both zero

Regenerate and measure:

```bash
cd web && node --import tsx scripts/render-v2-dashboard.tsx
cd .. && node Spec/v2/dashboard/capture-dashboard.mjs
```

`screens/dashboard-metrics.json` records both 1280×900 and 834×1112 passes. Each state has no
page-level horizontal overflow, 16 px body text, its title/description/action above the fold and
exactly one visible primary action. The empty state has zero metric cards and zero trend rows.
