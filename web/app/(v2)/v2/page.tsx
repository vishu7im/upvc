import { requirePagePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { serverApiGet } from "@/lib/server-api";
import { loadDashboardData } from "@/lib/v2/dashboard-data";
import {
  dashboardAudience,
  dashboardPrimaryAction,
} from "@/lib/v2/dashboard-model";
import { DashboardHome, type DashboardContent } from "./dashboard-view";

export const dynamic = "force-dynamic";

export default async function V2HomePage() {
  const user = await requirePagePermission("dashboard", "view");
  let content: DashboardContent = { status: "permission-limited" };

  if (can(user, "orders", "read")) {
    try {
      content = { status: "ready", data: await loadDashboardData(serverApiGet) };
    } catch {
      content = { status: "error" };
    }
  }

  return (
    <DashboardHome
      audience={dashboardAudience(user)}
      content={content}
      incomingApprovals={user.incomingApprovals}
      primaryAction={dashboardPrimaryAction(user)}
      userName={user.name}
    />
  );
}
