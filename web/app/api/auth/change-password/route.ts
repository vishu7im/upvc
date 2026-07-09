// =====================================================================
// BFF change-password — like login, this is a place a fresh JWT crosses into
// the browser tier and must be written straight into the httpOnly cookie
// (never returned to client JS). The API bumps tokenVersion on change, so the
// caller's OLD token would 401 on the next request; re-setting the cookie with
// the returned fresh token keeps the session alive.
//
// POST /api/auth/change-password { currentPassword, newPassword }
//   → forwards to Express (with the current bearer from the cookie)
//   → on 200: re-sets httpOnly `token` cookie, returns { user } only
//   → on failure: relays the upstream status + error
// =====================================================================

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const EXPRESS_API_BASE = process.env.EXPRESS_API_BASE ?? "http://localhost:3005";
const TOKEN_COOKIE = "token";
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 12;

export async function POST(req: NextRequest): Promise<Response> {
  const body = await req.text();
  const jar = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value;

  let upstream: Response;
  try {
    upstream = await fetch(`${EXPRESS_API_BASE}/api/auth/change-password`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body,
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: `Engine API unreachable at ${EXPRESS_API_BASE}` }, { status: 502 });
  }

  const data = (await upstream.json().catch(() => null)) as
    | { token: string; user: unknown }
    | { error: string }
    | null;

  if (!upstream.ok || !data || !("token" in data)) {
    const message = (data && "error" in data && data.error) || "Password change failed";
    return Response.json({ error: message }, { status: upstream.status || 400 });
  }

  jar.set(TOKEN_COOKIE, data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_MAX_AGE_SECONDS,
  });

  return Response.json({ user: data.user });
}
