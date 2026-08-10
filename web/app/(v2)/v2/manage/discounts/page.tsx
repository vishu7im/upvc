import { requirePagePermission } from "@/lib/authz";
import { RouteScaffold } from "../../_components/route-scaffold";

export default async function V2DiscountsPage() {
  await requirePagePermission("discounts", "view");
  return (
    <RouteScaffold
      description="Create, edit, and retire the discount codes applied by the existing order basket."
      phase={7}
      title="Discounts"
      v1Href="/admin/discounts"
    />
  );
}
