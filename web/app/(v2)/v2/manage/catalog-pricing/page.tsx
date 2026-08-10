import { requirePagePermission } from "@/lib/authz";
import { RouteScaffold } from "../../_components/route-scaffold";

export default async function V2CatalogPricingPage() {
  await requirePagePermission("catalog", "view");
  return (
    <RouteScaffold
      description="The dense supplier and catalog pricing editor remains an admin workspace."
      phase={7}
      title="Catalog pricing"
      v1Href="/admin/catalog"
    />
  );
}
