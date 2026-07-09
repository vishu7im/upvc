// Admin hub (U5). Server-guarded: non-admins are bounced to the dashboard
// even via direct URL — the nav hides the link, the route enforces the role.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server-api";
import { can } from "@/lib/permissions";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";

export const dynamic = "force-dynamic";

const CARDS = [
  {
    href: "/admin/users",
    module: "users",
    title: "Users",
    desc: "Invite users, assign roles, activate/deactivate accounts, and reset passwords.",
    icon: "user",
  },
  {
    href: "/admin/roles",
    module: "roles",
    title: "Roles & permissions",
    desc: "Define roles and edit their module × action permission grid.",
    icon: "admin",
  },
  {
    href: "/admin/settings",
    module: "settings",
    title: "Settings & branding",
    desc: "Currency, tax, markup, wastage, labour — plus company name, address, accent colour, and logo.",
    icon: "settings",
  },
  {
    href: "/admin/catalog",
    module: "catalog",
    title: "Catalog pricing",
    desc: "Enter supplier cost/price/weight per part, manage colours & glass variants, or bulk-import via CSV.",
    icon: "catalog",
  },
] satisfies Array<{ href: string; module: string; title: string; desc: string; icon: IconName }>;

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");

  const cards = CARDS.filter((c) => can(user, c.module, "view"));

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Admin console"
        description="Configure commercial settings, brand identity, supplier pricing, and catalog data used by the quote engine."
        meta={<Badge tone="purple">Admin access</Badge>}
      />
      {cards.length === 0 ? (
        <EmptyState icon="admin" title="No admin sections available" description="Your role doesn't grant access to any administration module." />
      ) : (
      <div className="grid gap-5 lg:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group rounded-lg border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#4442e3]/50 hover:shadow-[0_18px_38px_rgba(15,23,42,0.08)]"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-md bg-[#e7e6ff] text-[#4442e3]">
                <Icon name={c.icon} className="h-6 w-6" />
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition group-hover:border-[#4442e3] group-hover:text-[#4442e3]">
                <Icon name="chevronRight" className="h-4 w-4" />
              </span>
            </div>
            <h2 className="mt-6 text-xl font-bold text-slate-950">{c.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{c.desc}</p>
          </Link>
        ))}
      </div>
      )}
      <Card className="mt-6 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">System health</h2>
            <p className="mt-1 text-sm text-slate-500">Pricing changes are applied through the existing engine catalog APIs.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">Production API</Badge>
            <Badge tone="green">Catalog loader</Badge>
            <Badge tone="slate">BFF secured</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
