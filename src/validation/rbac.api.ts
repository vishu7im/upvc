// =====================================================================
// src/validation/rbac.api.ts — the RBAC integration safety net (PLAN §10).
//
// Unlike `npm run validate` (pure engine math, DB-free), this harness needs a
// LIVE server + DB: RBAC bugs are integration bugs (middleware + guards + DB
// together), so an HTTP-level matrix buys more real coverage than unit tests.
// Run it OUT of the default validate: `npm run validate:rbac`.
//
//   1. start the API:  npm start                (http://localhost:3005)
//   2. run:            npm run validate:rbac    (override RBAC_API_BASE if needed)
//
// It mints tokens directly with signToken (no passwords needed) and creates
// throwaway users/roles straight through Prisma, then DELETES every fixture it
// made (orders first — there is no DELETE-order route) so the DB is left clean.
// The real platform Super Admin is discovered, never modified.
//
// Assertions cover: the Phase-5 guard-map + orders data-scoping matrix, the
// Phase-3 users/roles invariants (PLATFORM hiding, anti-escalation, system/
// in-use role deletes), the reset-password forced-change gate, and the Phase-6
// audit trail (rows written for each RBAC mutation).
// =====================================================================

import { prisma } from "../db/client.ts";
import { signToken } from "../api/middleware/auth.ts";

const BASE = process.env.RBAC_API_BASE ?? "http://localhost:3005";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function chk(desc: string, expected: unknown, actual: unknown): void {
  if (String(expected) === String(actual)) {
    pass++;
  } else {
    fail++;
    const line = `FAIL ${desc}  expected=${expected} got=${actual}`;
    failures.push(line);
    console.error("  " + line);
  }
}

interface MintUser {
  id: string;
  email: string;
  name: string;
  roleId: string | null;
  tokenVersion: number;
}
const mint = (u: MintUser): string =>
  signToken({
    id: u.id,
    email: u.email,
    name: u.name,
    roleId: u.roleId,
    tokenVersion: u.tokenVersion,
  });

async function status(path: string, token: string, init: RequestInit = {}): Promise<number> {
  const r = await fetch(BASE + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  return r.status;
}
async function jsonGet(path: string, token: string): Promise<{ status: number; body: any }> {
  const r = await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function postJson(
  path: string,
  token: string,
  payload: unknown,
): Promise<{ status: number; body: any }> {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const jsonHeaders = { "Content-Type": "application/json" };

// A monotonic-ish suffix without Date.now/Math.random (unavailable in some
// harness contexts): high-resolution time is fine here (this is a Node script).
const TAG = `rbac-${process.pid}-${Math.trunc(process.hrtime()[1])}`;

async function main(): Promise<void> {
  // Fail fast if the server is down (clearer than a cascade of fetch errors).
  try {
    const ping = await fetch(BASE + "/api/systems");
    if (!ping.ok) throw new Error(String(ping.status));
  } catch (err) {
    console.error(`\nCannot reach the API at ${BASE} — start it with 'npm start' first.\n(${err})`);
    process.exit(2);
  }

  const org = await prisma.organization.findFirstOrThrow();
  const sa = await prisma.user.findFirstOrThrow({
    where: { roleRef: { is: { scope: "PLATFORM" } } },
  });
  const saRole = await prisma.role.findFirstOrThrow({ where: { scope: "PLATFORM" } });
  const adminRole = await prisma.role.findFirstOrThrow({ where: { slug: "admin", scope: "ORG" } });
  const customerRole = await prisma.role.findFirstOrThrow({
    where: { slug: "customer", scope: "ORG" },
  });

  // Module/action ids for building custom-role grids directly.
  const mods = new Map(
    (await prisma.module.findMany({ select: { id: true, slug: true } })).map((m) => [m.slug, m.id]),
  );
  const acts = new Map(
    (
      await prisma.permissionAction.findMany({ select: { id: true, slug: true } })
    ).map((a) => [a.slug, a.id]),
  );
  const grant = (moduleSlug: string, actionSlug: string, scope: "OWN" | "ALL") => ({
    moduleId: mods.get(moduleSlug)!,
    actionId: acts.get(actionSlug)!,
    scope,
  });

  // ---- throwaway roles ----------------------------------------------
  // auditor: orders read/view ALL, no create → can view every order, mutate none.
  const auditorRole = await prisma.role.create({
    data: {
      organizationId: org.id,
      slug: `${TAG}-auditor`,
      name: `${TAG} Auditor`,
      scope: "ORG",
      isSystem: false,
      permissions: { create: [grant("orders", "view", "ALL"), grant("orders", "read", "ALL")] },
    },
  });
  // limited: full roles admin BUT only orders read OWN → drives anti-escalation.
  const limitedRole = await prisma.role.create({
    data: {
      organizationId: org.id,
      slug: `${TAG}-limited`,
      name: `${TAG} Limited`,
      scope: "ORG",
      isSystem: false,
      permissions: {
        create: [
          grant("roles", "view", "ALL"),
          grant("roles", "read", "ALL"),
          grant("roles", "create", "ALL"),
          grant("roles", "update", "ALL"),
          grant("roles", "delete", "ALL"),
          grant("orders", "read", "OWN"),
        ],
      },
    },
  });
  // in-use role: a plain custom role we attach a user to (for the 409 delete test).
  const inUseRole = await prisma.role.create({
    data: {
      organizationId: org.id,
      slug: `${TAG}-inuse`,
      name: `${TAG} InUse`,
      scope: "ORG",
      isSystem: false,
      permissions: { create: [grant("dashboard", "view", "ALL")] },
    },
  });

  // ---- throwaway users ----------------------------------------------
  const bcrypt = await import("bcryptjs");
  const hash = await bcrypt.default.hash("x", 4);
  const mkUser = (email: string, roleId: string) =>
    prisma.user.create({
      data: {
        email,
        name: email,
        passwordHash: hash,
        roleId,
        organizationId: org.id,
        isActive: true,
        mustChangePassword: false,
        tokenVersion: 0,
      },
    });

  const orgAdmin = await mkUser(`${TAG}-admin@local`, adminRole.id);
  // A SECOND platform Super Admin so the last-SA guard can be exercised without
  // ever endangering the real one (the real SA stays active throughout).
  const saTwo = await mkUser(`${TAG}-sa2@local`, saRole.id);
  const cust = await mkUser(`${TAG}-cust@local`, customerRole.id);
  const cust2 = await mkUser(`${TAG}-cust2@local`, customerRole.id);
  const auditor = await mkUser(`${TAG}-aud@local`, auditorRole.id);
  const limited = await mkUser(`${TAG}-lim@local`, limitedRole.id);
  const inUseUser = await mkUser(`${TAG}-inuse@local`, inUseRole.id);

  const SA = mint(sa);
  const AD = mint(orgAdmin);
  const CT = mint(cust);
  const C2 = mint(cust2);
  const AU = mint(auditor);
  const LM = mint(limited);

  const createdOrderIds: string[] = [];
  const createdRoleIds: string[] = [auditorRole.id, limitedRole.id, inUseRole.id];
  const throwawayUserIds = [
    orgAdmin.id,
    saTwo.id,
    cust.id,
    cust2.id,
    auditor.id,
    limited.id,
    inUseUser.id,
  ];

  try {
    // === Phase 5: register removed ===================================
    chk(
      "POST /api/auth/register → 404 (removed)",
      404,
      await status("/api/auth/register", SA, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ email: "x@y.z", password: "abcdef12", name: "x" }),
      }),
    );

    // === Phase 5: settings / catalog guard map =======================
    chk("SA GET /api/settings → 200", 200, await status("/api/settings", SA));
    chk("customer GET /api/settings → 403", 403, await status("/api/settings", CT));
    chk(
      "customer PUT /api/settings → 403",
      403,
      await status("/api/settings", CT, {
        method: "PUT",
        headers: jsonHeaders,
        body: JSON.stringify({ currency: "GBP" }),
      }),
    );
    const sys = (await (await fetch(BASE + "/api/systems")).json())[0].systemId;
    chk("SA GET /api/catalog/:id → 200", 200, await status(`/api/catalog/${sys}`, SA));
    chk("customer GET /api/catalog/:id → 403", 403, await status(`/api/catalog/${sys}`, CT));

    // === Phase 5: orders data scoping ================================
    const co = await postJson("/api/orders", CT, { customerName: "CustCo" });
    chk("customer POST /api/orders → 201 (create OWN)", 201, co.status);
    const ordId = co.body?.id as string;
    if (ordId) createdOrderIds.push(ordId);

    const custList = await jsonGet("/api/orders?limit=500", CT);
    chk(
      "customer list contains own order",
      1,
      custList.body?.data?.filter((o: any) => o.id === ordId).length,
    );
    const saList = await jsonGet("/api/orders?limit=500", SA);
    chk(
      "SA list contains customer order (scope ALL)",
      1,
      saList.body?.data?.filter((o: any) => o.id === ordId).length,
    );
    chk("SA GET customer order detail → 200", 200, await status(`/api/orders/${ordId}`, SA));
    chk(
      "org-admin GET customer order detail → 200 (scope ALL)",
      200,
      await status(`/api/orders/${ordId}`, AD),
    );
    chk(
      "other customer GET first's order → 404 (scope OWN)",
      404,
      await status(`/api/orders/${ordId}`, C2),
    );
    const c2List = await jsonGet("/api/orders?limit=500", C2);
    chk(
      "other customer list excludes first's order",
      0,
      c2List.body?.data?.filter((o: any) => o.id === ordId).length,
    );

    // auditor: orders read ALL but NO create → view all, mutate none.
    chk("auditor GET /api/orders → 200 (read)", 200, await status("/api/orders?limit=5", AU));
    const audList = await jsonGet("/api/orders?limit=500", AU);
    chk(
      "auditor sees customer order (read ALL)",
      1,
      audList.body?.data?.filter((o: any) => o.id === ordId).length,
    );
    chk("auditor GET order detail → 200 (read ALL)", 200, await status(`/api/orders/${ordId}`, AU));
    chk(
      "auditor POST /api/orders → 403 (no create)",
      403,
      await status("/api/orders", AU, { method: "POST", headers: jsonHeaders, body: "{}" }),
    );
    chk(
      "auditor POST items → 403 (no create)",
      403,
      await status(`/api/orders/${ordId}/items`, AU, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ productId: "x", designId: "x", widthMm: 1000, heightMm: 1000 }),
      }),
    );
    chk(
      "auditor confirm → 403 (no create)",
      403,
      await status(`/api/orders/${ordId}/confirm`, AU, { method: "POST" }),
    );
    chk(
      "auditor DELETE item → 403 (no create)",
      403,
      await status(`/api/orders/${ordId}/items/nope`, AU, { method: "DELETE" }),
    );

    // === Phase 3: PLATFORM hiding (no existence leak) ================
    const adUsers = await jsonGet("/api/users?limit=500", AD);
    chk(
      "org-admin user list EXCLUDES the platform Super Admin",
      0,
      adUsers.body?.data?.filter((u: any) => u.id === sa.id).length,
    );
    chk(
      "org-admin GET /api/users/:saId → 404 (hidden PLATFORM)",
      404,
      await status(`/api/users/${sa.id}`, AD),
    );
    chk("SA GET /api/users/:saId → 200 (SA sees SA)", 200, await status(`/api/users/${sa.id}`, SA));
    const adRoles = await jsonGet("/api/roles?limit=500", AD);
    chk(
      "org-admin role list EXCLUDES the PLATFORM role",
      0,
      adRoles.body?.data?.filter((r: any) => r.id === saRole.id).length,
    );
    chk(
      "org-admin GET /api/roles/:saRoleId → 404 (hidden PLATFORM)",
      404,
      await status(`/api/roles/${saRole.id}`, AD),
    );

    // === Phase 3: assigning a PLATFORM role is a 404 (can't even see it) ===
    chk(
      "org-admin PATCH user → PLATFORM roleId → 404",
      404,
      await status(`/api/users/${cust.id}`, AD, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ roleId: saRole.id }),
      }),
    );

    // === Phase 3: anti-escalation (subset rule) via the `limited` actor ===
    // limited holds roles.* ALL but orders only read OWN, and no settings at all.
    chk(
      "limited create role granting orders.read OWN → 201 (subset ok)",
      201,
      (await postJson("/api/roles", LM, {
        name: `${TAG}-esc-ok`,
        permissions: [{ module: "orders", action: "read", scope: "OWN" }],
      }).then((r) => {
        if (r.body?.id) createdRoleIds.push(r.body.id);
        return r;
      })).status,
    );
    chk(
      "limited create role granting orders.read ALL → 403 (scope widen)",
      403,
      (await postJson("/api/roles", LM, {
        name: `${TAG}-esc-widen`,
        permissions: [{ module: "orders", action: "read", scope: "ALL" }],
      })).status,
    );
    chk(
      "limited create role granting settings.read → 403 (unheld tuple)",
      403,
      (await postJson("/api/roles", LM, {
        name: `${TAG}-esc-unheld`,
        permissions: [{ module: "settings", action: "read", scope: "ALL" }],
      })).status,
    );

    // === Phase 3: system + in-use role deletes ========================
    chk(
      "SA DELETE system role (customer) → 403",
      403,
      await status(`/api/roles/${customerRole.id}`, SA, { method: "DELETE" }),
    );
    const delInUse = await fetch(BASE + `/api/roles/${inUseRole.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${SA}` },
    });
    chk("SA DELETE in-use custom role → 409", 409, delInUse.status);
    const delInUseBody = await delInUse.json().catch(() => null);
    chk("in-use delete body carries userCount=1", 1, delInUseBody?.userCount);

    // === Phase 3: self-action guards ==================================
    chk(
      "org-admin self-deactivate → 403",
      403,
      await status(`/api/users/${orgAdmin.id}/deactivate`, AD, { method: "POST" }),
    );
    chk(
      "org-admin self-role-change → 403",
      403,
      await status(`/api/users/${orgAdmin.id}`, AD, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ roleId: customerRole.id }),
      }),
    );
    // Self password reset is blocked (it would bump your own tokenVersion and log
    // you out); own-account changes go through change-password instead.
    chk(
      "org-admin self reset-password → 403",
      403,
      await status(`/api/users/${orgAdmin.id}/reset-password`, AD, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ tempPassword: "whatever8" }),
      }),
    );

    // === Phase 3: last-active-Super-Admin guard (safe allow-path) =====
    // With TWO active Super Admins, deactivating one is allowed (200) — the
    // real SA remains. Deactivating the LAST would 409, but that can't be
    // reproduced against a live DB without endangering the real platform admin,
    // so we assert the guard permits the non-last case (and PLATFORM targets are
    // manageable by an SA).
    chk(
      "SA deactivate a non-last Super Admin → 200",
      200,
      await status(`/api/users/${saTwo.id}/deactivate`, SA, { method: "POST" }),
    );

    // === Phase 3/2: reset-password → forced-change gate ===============
    chk(
      "org-admin reset customer password → 200",
      200,
      await status(`/api/users/${cust.id}/reset-password`, AD, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ tempPassword: "temp1234" }),
      }),
    );
    // The old customer token is now stale (tokenVersion bumped by the reset).
    chk("customer old token after reset → 401", 401, await status("/api/orders", CT));
    // A fresh token (new tv) is valid but mustChangePassword now gates everything…
    const custAfter = await prisma.user.findUniqueOrThrow({ where: { id: cust.id } });
    const CTfresh = mint(custAfter);
    chk(
      "fresh customer token, normal route → 403 password_change_required",
      403,
      await status("/api/orders", CTfresh),
    );
    chk("fresh customer token, GET /me → 200 (exempt)", 200, await status("/api/auth/me", CTfresh));

    // === Phase 3: grid edit propagates on next request (no re-login) ===
    // Grant the auditor orders.create; its EXISTING token must then create.
    const putGrid = await fetch(BASE + `/api/roles/${auditorRole.id}/permissions`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${SA}`, ...jsonHeaders },
      body: JSON.stringify({
        permissions: [
          { module: "orders", action: "view", scope: "ALL" },
          { module: "orders", action: "read", scope: "ALL" },
          { module: "orders", action: "create", scope: "ALL" },
        ],
      }),
    });
    chk("SA PUT auditor grid (add create) → 200", 200, putGrid.status);
    const audCreate = await postJson("/api/orders", AU, { customerName: "AudCo" });
    chk("auditor SAME token can now create → 201 (grid propagated)", 201, audCreate.status);
    if (audCreate.body?.id) createdOrderIds.push(audCreate.body.id);

    // === Phase 6: audit trail written for RBAC mutations =============
    const auditFor = (action: string, targetId: string) =>
      prisma.auditLog.count({ where: { action, targetId } });
    chk("audit: user.reset_password logged", 1, await auditFor("user.reset_password", cust.id));
    chk(
      "audit: role.permissions.update logged",
      1,
      await auditFor("role.permissions.update", auditorRole.id),
    );
    // The role `limited` created via API above → a role.create row exists.
    const roleCreates = await prisma.auditLog.count({ where: { action: "role.create" } });
    chk("audit: at least one role.create row exists", true, roleCreates >= 1);
    // A user.create row is written when creating through the API. Create one now.
    const apiUser = await postJson("/api/users", SA, {
      email: `${TAG}-apiuser@example.com`, // zod .email() requires a dotted domain
      name: "API User",
      password: "initpass123",
      roleId: customerRole.id,
    });
    chk("SA POST /api/users → 201", 201, apiUser.status);
    if (apiUser.body?.id) {
      throwawayUserIds.push(apiUser.body.id);
      chk("audit: user.create logged", 1, await auditFor("user.create", apiUser.body.id));
    }
  } finally {
    // ---- cleanup (orders first — no DELETE-order route) -------------
    for (const id of createdOrderIds) {
      await prisma.orderItem.deleteMany({ where: { orderId: id } });
      await prisma.document.deleteMany({ where: { orderId: id } });
      await prisma.order.deleteMany({ where: { id } });
    }
    await prisma.user.deleteMany({ where: { id: { in: throwawayUserIds } } });
    // roles created via the API (esc-ok, plus fixtures) + the fixtures.
    const apiRoles = await prisma.role.findMany({
      where: { slug: { startsWith: TAG } },
      select: { id: true },
    });
    const allRoleIds = [...new Set([...createdRoleIds, ...apiRoles.map((r) => r.id)])];
    await prisma.rolePermission.deleteMany({ where: { roleId: { in: allRoleIds } } });
    await prisma.role.deleteMany({ where: { id: { in: allRoleIds } } });
    // Append-only audit rows for the throwaway targets/actors — clean for tidiness.
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { targetId: { in: [...throwawayUserIds, ...allRoleIds] } },
          { actorId: { in: throwawayUserIds } },
        ],
      },
    });

    console.log("\n==================================================");
    console.log(`RBAC API RESULTS:  ${pass} passed,  ${fail} failed`);
    console.log("==================================================");
    if (fail > 0) console.error("\nFailures:\n" + failures.map((f) => "  " + f).join("\n"));
    await prisma.$disconnect();
    process.exit(fail === 0 ? 0 : 1);
  }
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
