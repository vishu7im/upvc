import { requirePagePermission } from "@/lib/authz";
import { RouteScaffold } from "../../_components/route-scaffold";

export default async function V2RolesPage() {
  await requirePagePermission("roles", "view");
  return (
    <RouteScaffold
      description="Review and create role definitions before opening their permission grids."
      phase={7}
      title="Roles & access"
      v1Href="/admin/roles"
    />
  );
}
