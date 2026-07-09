// =====================================================================
// Admin section guard (PLAN §7.3). Reachable if the user can VIEW any
// admin-surface module; individual pages guard their specific permission.
// Ends the per-page inline role-check duplication.
// =====================================================================

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server-api";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const ADMIN_MODULES = ["settings", "catalog", "users", "roles"];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  if (!ADMIN_MODULES.some((m) => can(user, m, "view"))) redirect("/");
  return <>{children}</>;
}
