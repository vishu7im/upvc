// /admin/roles (Phase 4). Server-guarded by `roles.view`; lists roles with user
// counts and passes can()-derived flags to the client manager.

import Link from "next/link";
import { serverApiGet } from "@/lib/server-api";
import { requirePagePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import type { Paginated, RoleSummary } from "@/lib/types";
import { Badge, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import RolesManager from "./roles-manager";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  const user = await requirePagePermission("roles", "view");
  const roles = await serverApiGet<Paginated<RoleSummary>>("/api/roles?limit=100");

  const perms = {
    create: can(user, "roles", "create"),
    update: can(user, "roles", "update"),
    delete: can(user, "roles", "delete"),
  };

  return (
    <div>
      <Link href="/admin" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950">
        <Icon name="arrowLeft" className="h-4 w-4" />
        Admin
      </Link>
      <PageHeader
        eyebrow="Administration"
        title="Roles & permissions"
        description="Define roles and edit their module × action permission grid. System roles are protected."
        meta={<Badge tone="purple">{roles.pagination.total} roles</Badge>}
      />
      <RolesManager roles={roles.data} perms={perms} />
    </div>
  );
}
