// =====================================================================
// BFF logout — clears the httpOnly `token` cookie. Web-only (no Express call).
// =====================================================================

import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  (await cookies()).delete("token");
  return Response.json({ ok: true });
}
