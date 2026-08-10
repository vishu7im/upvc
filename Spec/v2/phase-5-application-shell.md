# Phase 5 — Application Shell

**Status:** ✅ **owner-approved 2026-08-07** · Phase 6 authorised

## Goal

Stand up the V2 shell and the routing that lets V1 and V2 coexist: the version chooser at `/`, the
V2 layout (sidebar, header, breadcrumbs, notifications, profile), and a version switcher that never
loses the session. **First phase that touches routing.**

## Context-in-a-box

Read first: `00-foundation/ARCHITECTURE.md` §2.2–2.6 (isolation, layering, the switcher),
`00-foundation/ROUTE_MAPPING.md` (finalised in phase 2), `00-foundation/COMPONENT_LIBRARY.md`
(the kit — Sidebar and Header were built in phase 4 and are **composed** here, not written here).

**The structure (D-002, Option A — owner approved 2026-08-07):**

```
web/app/
  version-chooser/      ← chooser implementation; `web/proxy.ts` rewrites public `/` here (D-021)
  v1/                   ← `/v1` reuses the frozen V1 dashboard/layout (D-021)
  layout.tsx            ← shared root; imports globals.css + inert-until-[data-v2] v2.css
  (app)/…               ← V1, FROZEN
  (v2)/…                ← V2 shell + routes
  api/…                 ← the seam, SHARED, unchanged
  v2.css                ← V2 tokens (phase 3)
```

**How auth works today** — reuse all of it, change none of it:

- `POST /api/auth/login` → the Next route sets an **httpOnly `token` cookie**; the token never
  reaches client JS.
- `web/app/(app)/layout.tsx` calls `getCurrentUser()` → redirects to `/login` when null, and to
  `/change-password` when `mustChangePassword`. **V2's layout must do the same three things.**
- `GET /api/auth/me` → `{ user, role, isSuperAdmin, incomingApprovals, permissions, nav }`.
- `can(user, module, action)` (`web/lib/permissions.ts`) is the one isomorphic predicate.
- `requirePagePermission(module, action)` (`web/lib/authz.ts`) is the server-side page guard. V1
  uses it on **admin routes only** — which is why a user lacking `orders:read` reaches `/orders` and
  meets an API error instead of a redirect (**X-9**). **Every V2 route uses it.**

**Two things V1's shell does that V2 must not repeat:** the header search has no handler and no form
(**O-1**), and both header CTAs dead-end (**O-2**, **O-3**). **P2 makes shipping a dead control a
merge blocker.**

## Deliverables

1. **`/` version chooser.** Two clear destinations, one line explaining what V2 is, and a
   **remembered preference** in a plain (non-httpOnly) `ui-version` cookie — it is a display choice,
   not a credential, so it must not touch the auth cookie.
2. **V1 route preservation.** Per phase 2's decision (**B-4**; phase 0 recommended *alias*):
   `/orders/abc123` and every other V1 URL keeps working. **A legacy bookmark must never 404.**
3. **V2 layout** `web/app/(v2)/layout.tsx` — `getCurrentUser()` guard (login / change-password /
   render), `PermissionsProvider`, the `data-v2` root that scopes `v2.css`, and the shell.
4. **V2 sidebar** — composed from the phase-4 component, rendering **`user.nav`** (P12). Grouping
   and labelling per phase 2's navigation model.
5. **V2 header** — breadcrumbs, notifications (`incomingApprovals` already arrives on `/api/auth/me`),
   user profile, the version switcher, and **search: implemented per decision B-2, or absent.**
6. **Version switcher** — present in both shells, preserving the route where `00-foundation/ROUTE_MAPPING.md`
   defines an equivalent, otherwise landing on that shell's home. Never 404s. Never re-authenticates.
7. **Route scaffolding** for phases 6–7: `(v2)/` pages that render a proper "coming in phase N"
   state — reachable, permission-guarded, and never a 404 or a broken link.
8. **Freeze enforcement** — the CI check wired in phase 4 must be green throughout.

## Implementation checklist

- [x] Confirm the freeze commit SHA in `DECISIONS.md`; confirm the freeze CI check is green
      **before** starting
- [x] Create `web/app/(v2)/layout.tsx` with the three-way guard (login / change-password / render)
- [x] Wire `v2.css` under a `data-v2` root; **verify `globals.css` is byte-identical**
- [x] Move V1's dashboard off `/` per phase 2's URL decision, **without changing any V1 page file** —
      routing only
- [x] Build `/` version chooser + the `ui-version` cookie
- [x] Compose the V2 sidebar from `user.nav`; the contract test removes supplied grants and the rail
      shrinks with no mapping edit
- [x] Compose the V2 header; omit search until M7 can render real scoped results (D-022)
- [x] Build the version switcher both ways; deep-link mappings and safe targets are contract-tested
- [x] Scaffold every `(v2)` route from `00-foundation/ROUTE_MAPPING.md` with
      `requirePagePermission`; Account uses the authenticated layout/page guard because Phase 2
      explicitly defines it as an identity action, not a permission module (closes X-9)
- [x] Verify every V1 route still resolves and renders unchanged
- [x] Run the standing verification stack
- [x] Update `CHECKLIST.md`, `MILESTONES.md`, `CHANGELOG.md`, `DECISIONS.md`

## Acceptance criteria

- [x] `/` offers V1 and V2, and remembers the choice
- [x] **Every V1 route is reachable and behaves exactly as before** — all 18 resolve; frozen bytes
      are unchanged
- [x] Switch targets preserve mapped deep links, never 404, and the switch endpoint never reads or
      writes the auth cookie
- [x] The V2 sidebar renders from `user.nav` alone — demonstrated by changing supplied grant-shaped
      nav data and seeing the nav change with no code edit
- [x] Every `(v2)` route is guarded server-side; Account is session-guarded by design
- [x] **Zero dead controls** in the V2 shell (P2)
- [x] `web/app/globals.css`, `web/components/ui.tsx`, `web/app/(app)/**` untouched
- [x] Standing stack green:

```bash
npx tsc --noEmit
npm run validate                                   # 1,568 passed, 0 failed
cd web && npm run build && npm run lint
git diff --stat <freeze> -- 'web/app/(app)' 'web/components/ui.tsx' 'web/app/globals.css'   # empty
git diff --stat <freeze> -- src prisma                                                       # empty
```

- [x] **The owner switches V1 ↔ V2 repeatedly, mid-task, without losing their session** — the
      acceptance test that matters
- [x] **Owner approves phase 5** before phase 6 begins (2026-08-07: “start next phase now”)

## Out of scope

Screen content (phases 6–7) · the dashboard (phase 6) · any backend change · touching V1 page files.
Moving V1 **routing** is permitted and necessary; editing a V1 **page** is not.

## Risks and their mitigations

| Risk | Mitigation |
|---|---|
| Moving V1 off `/` breaks a bookmark | Phase 2's B-4 decision; walk all 18 routes as an acceptance step |
| `v2.css` leaks into V1 | `data-v2` scoping + a visual check of every V1 screen |
| The root `layout.tsx` is shared and must import both stylesheets | Keep `globals.css` unconditional; scope `v2.css`. **Root layout is the only shared file this phase edits — diff it carefully** |
| A V2 route shadows a V1 route | Route table review; the freeze diff will not catch this, so walk it manually |

## Gates

✅ Phase 4 approved; freeze check green before and after implementation.
✅ B-2 was resolved by D-011. D-022 keeps Search orders absent until M7 owns a real result view,
rather than sending a V2 search into a scaffold or switching interfaces unexpectedly.
✅ Owner accepted Phase 5 and authorised Phase 6 with “start next phase now”.
