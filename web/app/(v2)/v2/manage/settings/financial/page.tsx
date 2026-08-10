import { requirePagePermission } from "@/lib/authz";
import { RouteScaffold } from "../../../_components/route-scaffold";

export default async function V2FinancialSettingsPage() {
  await requirePagePermission("settings", "view");
  return (
    <RouteScaffold
      description="Markup, wastage, VAT, and labour defaults remain one financial concern."
      phase={7}
      title="Financial defaults"
      v1Href="/admin/settings"
    />
  );
}
