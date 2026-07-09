import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";
import { requirePagePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { serverApiGet } from "@/lib/server-api";
import type { Paginated, RoleSummary, UserDetail } from "@/lib/types";
import { Badge, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import UserDetailManager from "./user-detail";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePagePermission("users", "read");
  const { id } = await params;

  let user: UserDetail;
  try {
    user = await serverApiGet<UserDetail>(`/api/users/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const roles = await serverApiGet<Paginated<RoleSummary>>("/api/roles?limit=100");
  const perms = {
    update: can(actor, "users", "update"),
    delete: can(actor, "users", "delete"),
  };

  return (
    <div>
      <Link href="/admin/users" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950">
        <Icon name="arrowLeft" className="h-4 w-4" />
        Users
      </Link>
      <PageHeader
        eyebrow="User account"
        title={user.name}
        description={user.email}
        meta={
          <>
            <Badge tone={user.isActive ? "green" : "red"}>{user.isActive ? "Active" : "Inactive"}</Badge>
            <Badge tone={user.role?.scope === "PLATFORM" ? "purple" : "blue"}>{user.role?.name ?? "No role"}</Badge>
          </>
        }
      />
      <UserDetailManager
        initialUser={user}
        roles={roles.data}
        currentUserId={actor.id}
        perms={perms}
      />
    </div>
  );
}
