import { requirePagePermission } from "@/lib/authz";
import { RouteScaffold } from "../../../_components/route-scaffold";

export default async function V2TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("users", "read");
  const { id } = await params;
  return (
    <RouteScaffold
      description="Review one person's identity, status, role, and available account actions."
      phase={7}
      title="Team member"
      v1Href={`/admin/users/${encodeURIComponent(id)}`}
    />
  );
}
