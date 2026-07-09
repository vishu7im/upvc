// =====================================================================
// The single UI authorization predicate (PLAN §5.6). Pure + isomorphic —
// safe to call in Server Components, Client Components, nav rendering, and
// button gating. Mirrors the server's hasPermission: Super Admin ⇒ true,
// else the module's granted actions must include `action`.
// =====================================================================

import type { AuthUser } from "./types";

export function can(user: AuthUser | null, module: string, action: string): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return user.permissions[module]?.actions.includes(action) ?? false;
}

/** Data scope the user holds for a module ("OWN" | "ALL"); undefined if none. */
export function scopeOf(user: AuthUser | null, module: string): string | undefined {
  if (!user) return undefined;
  if (user.isSuperAdmin) return "ALL";
  return user.permissions[module]?.scope;
}
