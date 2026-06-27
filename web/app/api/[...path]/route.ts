// =====================================================================
// BFF generic proxy — forwards every /api/<path> from the browser to the
// Express engine API (EXPRESS_API_BASE), injecting the JWT (read from the
// httpOnly `token` cookie) as an Authorization: Bearer header server-side.
//
// The browser only ever talks to same-origin Next routes, so the token never
// reaches client JS and there is no browser CORS. The web app's /api/<path>
// maps 1:1 to Express /api/<path>.
//
// NB: explicit routes (app/api/auth/login, app/api/auth/logout) take
// precedence over this catch-all, so login/logout do their own cookie work.
// =====================================================================

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

// Reads cookies + forwards a live request — never statically cached.
export const dynamic = "force-dynamic";

const EXPRESS_API_BASE = process.env.EXPRESS_API_BASE ?? "http://localhost:3005";
const TOKEN_COOKIE = "token";

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;
  const target = `${EXPRESS_API_BASE}/api/${path.join("/")}${req.nextUrl.search}`;

  // Forward a minimal, safe header set + the bearer from the cookie.
  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (token) headers.set("authorization", `Bearer ${token}`);

  const method = req.method;
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, { method, headers, body, redirect: "manual", cache: "no-store" });
  } catch {
    return Response.json(
      { error: `Engine API unreachable at ${EXPRESS_API_BASE}` },
      { status: 502 },
    );
  }

  // Pass status + body through verbatim, preserving the upstream content type
  // (JSON, HTML documents, and PDF streams all flow through unchanged).
  const out = new Headers();
  for (const h of ["content-type", "content-disposition", "cache-control"]) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
