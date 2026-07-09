// Admin catalog pricing (U5). Server-guarded; fetches the system list and the
// full priced dump for the selected system, then hands them to the editor.

import Link from "next/link";
import { serverApiGet } from "@/lib/server-api";
import { requirePagePermission } from "@/lib/authz";
import type { CatalogDump, SystemSummary } from "@/lib/types";
import CatalogEditor from "./catalog-editor";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ system?: string }>;
}) {
  await requirePagePermission("catalog", "view");

  const systems = await serverApiGet<SystemSummary[]>("/api/systems");
  const selected = (await searchParams).system || systems[0]?.systemId;

  let dump: CatalogDump | null = null;
  if (selected) {
    dump = await serverApiGet<CatalogDump>(`/api/catalog/${selected}`);
  }

  return (
    <div>
      <Link href="/admin" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950">
        <Icon name="arrowLeft" className="h-4 w-4" />
        Admin
      </Link>
      <PageHeader
        eyebrow="Admin catalog"
        title="Catalog pricing"
        description="Maintain supplier cost, sales price, weight, colour uplifts, glass variants, and CSV imports for the selected profile system."
        meta={dump ? <Badge tone="purple">{dump.name}</Badge> : undefined}
      />
      {dump ? (
        <CatalogEditor systems={systems} dump={dump} />
      ) : (
        <EmptyState icon="catalog" title="No profile systems found" description="Catalog pricing appears after at least one profile system is available." />
      )}
    </div>
  );
}
