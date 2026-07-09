import { redirect } from "next/navigation";
import { getCurrentUser, serverApiGet } from "@/lib/server-api";
import type { ApprovalsInbox } from "@/lib/types";
import { Badge, ButtonLink, Card, PageHeader, SectionHeader } from "@/components/ui";
import ApprovalsPanel from "./approvals-panel";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const approvals = await serverApiGet<ApprovalsInbox>("/api/approvals");

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title={user.name}
        description={user.email}
        meta={<Badge tone={user.isSuperAdmin ? "purple" : "blue"}>{user.role?.name ?? "User"}</Badge>}
        actions={<ButtonLink href="/change-password" variant="secondary" icon="settings">Change password</ButtonLink>}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.65fr)_minmax(0,1.35fr)]">
        <Card className="h-fit">
          <SectionHeader title="Profile" />
          <dl className="divide-y divide-slate-100 px-5">
            <div className="py-4">
              <dt className="text-xs font-semibold uppercase text-slate-500">Name</dt>
              <dd className="mt-1 text-sm font-medium text-slate-950">{user.name}</dd>
            </div>
            <div className="py-4">
              <dt className="text-xs font-semibold uppercase text-slate-500">Email</dt>
              <dd className="mt-1 break-all text-sm font-medium text-slate-950">{user.email}</dd>
            </div>
            <div className="py-4">
              <dt className="text-xs font-semibold uppercase text-slate-500">Role</dt>
              <dd className="mt-1 text-sm font-medium text-slate-950">{user.role?.name ?? "No role"}</dd>
            </div>
          </dl>
        </Card>

        <ApprovalsPanel initial={approvals} isSuperAdmin={user.isSuperAdmin} />
      </div>
    </div>
  );
}
