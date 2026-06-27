# web/ — uPVC Fabrication UI (Next.js)

Phase 2 frontend for the uPVC fabrication ERP. **Next.js (App Router, TypeScript, Tailwind v4).**
The Express engine API in the repo root (`src/*`) stays the single backend/engine host — this app
is the **UI plus a thin BFF (backend-for-frontend) proxy**. Built as sub-milestones **U0–U6**
(see the root `CLAUDE.md` roadmap). Done so far: **U0** (scaffold + API seam), **U1** (auth +
app shell), **U2** (products + design gallery), **U3** (quote configurator with glass/colour
selection + live preview), **U4** (orders → confirm → documents/PDF), **U5** (admin console:
settings/branding/logo + catalog pricing editor + CSV import), and **U6** polish
(loading/error/not-found).

## Run

```bash
# 1. Engine API (repo root) — needs Postgres; see root CLAUDE.md:
npm run prisma:migrate && npm run db:seed && npm start   # http://localhost:3005

# 2. This app:
cd web
npm install
npm run dev        # http://localhost:3000
```

Open http://localhost:3000 — you'll be redirected to `/login`. Sign in with the seeded admin
(`admin@local` / `admin123` by default) to reach the dashboard. Configure the backend URL via
`EXPRESS_API_BASE` (`.env.local`).

## The BFF / cookie model

- The browser only ever calls **same-origin** Next routes (`/api/...`). `app/api/[...path]/route.ts`
  forwards each to `EXPRESS_API_BASE/api/...`, injecting `Authorization: Bearer <jwt>` from an
  **httpOnly `token` cookie** — so the token never touches client JS and there's no browser CORS.
- `app/api/auth/login` is the only place the JWT enters the browser tier: it forwards credentials to
  the engine, stores the returned token in the httpOnly cookie, and returns only `{ user }`.
  `app/api/auth/logout` clears the cookie.
- **Client Components** use `lib/api.ts` (calls the BFF proxy). **Server Components / Route Handlers**
  use `lib/server-api.ts` (calls the engine directly, attaching the cookie's JWT).

## Layout

```
app/
  layout.tsx                  root shell (html/body)
  not-found.tsx               global 404 (U6)
  login/                      login page + "use client" form → BFF login
  (app)/                      protected route group
    layout.tsx                server-side auth guard → /login; renders nav
    nav.tsx                   top nav: user, logout, admin-gated links
    loading.tsx, error.tsx    skeleton + error boundary (U6)
    page.tsx                  dashboard
    products/                 list + [id] design gallery (U2)
    quote/                    configurator page + client (U3)
    orders/                   list + [id] detail + actions (U4)
    admin/                    hub + settings/ + catalog/ (U5, role-guarded)
  api/
    [...path]/route.ts        generic BFF proxy → Express (JSON/HTML/PDF/raw)
    auth/login|logout/        set / clear the httpOnly token cookie
components/
  placeholder.tsx, pager.tsx, design-card.tsx
lib/
  api.ts                      client-safe API helpers (BFF): auth, quote, orders, admin
  server-api.ts               server-only helpers (direct to engine) + getCurrentUser()
  types.ts                    shared response shapes
  format.ts                   money / date / document-label formatters
```
