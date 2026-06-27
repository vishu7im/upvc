// =====================================================================
// BFF login — the only place a JWT crosses into the browser tier, and it is
// written straight into an httpOnly cookie (never returned to client JS).
//
// POST /api/auth/login { email, password }
//   → forwards to Express /api/auth/login
//   → on 200: sets httpOnly `token` cookie, returns { user } only
//   → on failure: relays the upstream status + error message
// =====================================================================

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const EXPRESS_API_BASE = process.env.EXPRESS_API_BASE ?? "http://localhost:3005";
const TOKEN_COOKIE = "token";
// Matches the API's default JWT_EXPIRES_IN ("12h"); cookie outlives a session.
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 12;

export async function POST(req: NextRequest): Promise<Response> {
  const body = await req.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${EXPRESS_API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { error: `Engine API unreachable at ${EXPRESS_API_BASE}` },
      { status: 502 },
    );
  }

  const data = (await upstream.json().catch(() => null)) as
    | { token: string; user: unknown }
    | { error: string }
    | null;

  if (!upstream.ok || !data || !("token" in data)) {
    const message = (data && "error" in data && data.error) || "Login failed";
    return Response.json({ error: message }, { status: upstream.status || 401 });
  }

  (await cookies()).set(TOKEN_COOKIE, data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_MAX_AGE_SECONDS,
  });

  return Response.json({ user: data.user });
}
