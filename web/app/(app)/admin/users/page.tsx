// /admin/users (Phase 4). Server-guarded by `users.view`; fetches the current
// page of users + the assignable roles, and passes can()-derived action flags
// to the client manager (the server still enforces every mutation).

import Link from "next/link";
import { serverApiGet } from "@/lib/server-api";
import { requirePagePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import type { Paginated, RoleSummary, UserRow } from "@/lib/types";
import { Badge, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import Pager from "@/components/pager";
import UsersManager from "./users-manager";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const user = await requirePagePermission("users", "view");
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const search = (sp.search ?? "").trim();

  const qs = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) qs.set("search", search);

  const [users, roles] = await Promise.all([
    serverApiGet<Paginated<UserRow>>(`/api/users?${qs.toString()}`),
    serverApiGet<Paginated<RoleSummary>>("/api/roles?limit=100"),
  ]);

  const canCreate = can(user, "users", "create");

  return (
    <div>
      <Link href="/admin" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950">
        <Icon name="arrowLeft" className="h-4 w-4" />
        Admin
      </Link>
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Browse account status and activity, invite users, or open a profile to manage its details."
        meta={<Badge tone="purple">{users.pagination.total} total</Badge>}
      />
      <UsersManager
        users={users.data}
        roles={roles.data}
        search={search}
        canCreate={canCreate}
      />
      <Pager
        page={users.pagination.page}
        pages={users.pagination.pages}
        basePath="/admin/users"
        query={search ? { search } : undefined}
      />
    </div>
  );
}
