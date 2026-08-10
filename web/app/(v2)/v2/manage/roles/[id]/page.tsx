import { requirePagePermission } from "@/lib/authz";
import { RouteScaffold } from "../../../_components/route-scaffold";

export default async function V2RolePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("roles", "read");
  const { id } = await params;
  return (
    <RouteScaffold
      description="Edit role metadata and its modules-by-actions permission grid."
      phase={7}
      title="Role permissions"
      v1Href={`/admin/roles/${encodeURIComponent(id)}`}
    />
  );
}
