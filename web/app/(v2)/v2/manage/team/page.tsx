import { requirePagePermission } from "@/lib/authz";
import { RouteScaffold } from "../../_components/route-scaffold";

export default async function V2TeamPage() {
  await requirePagePermission("users", "view");
  return (
    <RouteScaffold
      description="Manage users, role assignments, access state, resets, and deletion outcomes."
      phase={7}
      title="Team"
      v1Href="/admin/users"
    />
  );
}
