// =====================================================================
// Protected app shell. Every route in the (app) group requires auth: we
// resolve the current user server-side and redirect to /login if absent.
// The user is passed to the top nav (which gates admin-only links by role).
// =====================================================================

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server-api";
import { PermissionsProvider } from "@/lib/permissions-provider";
import Nav from "./nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // A forced password change blocks the whole app until it's done.
  if (user.mustChangePassword) redirect("/change-password");

  return (
    <PermissionsProvider user={user}>
      <Nav user={user}>{children}</Nav>
    </PermissionsProvider>
  );
}
