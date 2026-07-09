// /admin/roles/[id] (Phase 4). Server-guarded by `roles.update`; loads the
// role's full grid, the module/action catalogue, and passes the ACTOR's own
// permissions so the editor can disable cells the actor doesn't hold (a client
// mirror of assertGrantable — the server still enforces).

import Link from "next/link";
import { notFound } from "next/navigation";
import { serverApiGet } from "@/lib/server-api";
import { requirePagePermission } from "@/lib/authz";
import { ApiError } from "@/lib/api";
import type { MetaPermissions, RoleDetail } from "@/lib/types";
import { Badge, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import GridEditor from "./grid-editor";
import RoleHeaderEditor from "./role-header-editor";

export const dynamic = "force-dynamic";

export default async function RolePermissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePagePermission("roles", "update");
  const { id } = await params;

  let role: RoleDetail;
  try {
    role = await serverApiGet<RoleDetail>(`/api/roles/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const meta = await serverApiGet<MetaPermissions>("/api/meta/permissions");

  return (
    <div>
      <Link href="/admin/roles" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950">
        <Icon name="arrowLeft" className="h-4 w-4" />
        Roles
      </Link>
      <PageHeader
        eyebrow="Role permissions"
        title={role.name}
        description={role.description ?? "Toggle each module's actions and its data scope. Cells you can't grant are disabled."}
        meta={role.isSystem ? <Badge tone="blue">System role</Badge> : <Badge tone="slate">Custom role</Badge>}
        actions={(!role.isSystem || user.isSuperAdmin) ? <RoleHeaderEditor role={role} /> : undefined}
      />
      <GridEditor
        roleId={role.id}
        modules={meta.modules}
        actions={meta.actions}
        initial={role.permissions}
        actor={{ isSuperAdmin: user.isSuperAdmin, permissions: user.permissions }}
      />
    </div>
  );
}
