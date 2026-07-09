// =====================================================================
// Server-side page guard (PLAN §7.1). Replaces the duplicated inline
// `user.role !== "admin"` redirects: resolve the user, bounce to /login when
// absent, /change-password while a forced change is pending, and / when the
// user lacks the required module.action. Returns the user for the page to use.
// =====================================================================

import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./server-api";
import { can } from "./permissions";
import type { AuthUser } from "./types";

export async function requirePagePermission(
  module: string,
  action: string,
): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  if (!can(user, module, action)) redirect("/");
  return user;
}
