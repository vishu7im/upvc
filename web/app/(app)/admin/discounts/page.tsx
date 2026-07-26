// Discount codes (D6). Server-guarded like every other admin page; the list is
// fetched here and handed to the client editor, which owns all mutations.

import Link from "next/link";
import { serverApiGet } from "@/lib/server-api";
import { requirePagePermission } from "@/lib/authz";
import type { DiscountCodeRow } from "@/lib/types";
import DiscountsEditor from "./discounts-editor";
import { Badge, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function AdminDiscountsPage() {
  await requirePagePermission("discounts", "view");

  const codes = await serverApiGet<DiscountCodeRow[]>("/api/discounts");
  const live = codes.filter((c) => c.active).length;

  return (
    <div>
      <Link href="/admin" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950">
        <Icon name="arrowLeft" className="h-4 w-4" />
        Admin
      </Link>
      <PageHeader
        eyebrow="Commercial"
        title="Discount codes"
        description="Percentage or fixed-amount codes applied to an order's items subtotal, before extras and VAT. A code is validated when it is applied to an order, so deactivating one takes effect immediately."
        meta={
          <>
            <Badge tone="purple">{codes.length} codes</Badge>
            <Badge tone={live > 0 ? "green" : "slate"}>{live} active</Badge>
          </>
        }
      />
      <DiscountsEditor initial={codes} />
    </div>
  );
}
