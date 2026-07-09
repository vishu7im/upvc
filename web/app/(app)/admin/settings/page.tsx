// Admin settings (U5). Server-guarded; fetches the current settings and hands
// them to the client form.

import Link from "next/link";
import { serverApiGet } from "@/lib/server-api";
import { requirePagePermission } from "@/lib/authz";
import type { SettingsResponse } from "@/lib/types";
import SettingsForm from "./settings-form";
import { Badge, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requirePagePermission("settings", "view");

  const settings = await serverApiGet<SettingsResponse>("/api/settings");

  return (
    <div>
      <Link href="/admin" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950">
        <Icon name="arrowLeft" className="h-4 w-4" />
        Admin
      </Link>
      <PageHeader
        eyebrow="Admin settings"
        title="Settings and branding"
        description="Manage commercial defaults and document branding used by quotes, orders, and generated production packs."
        meta={<Badge tone="purple">{settings.currency}</Badge>}
      />
      <SettingsForm initial={settings} />
    </div>
  );
}
