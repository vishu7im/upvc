import { requirePagePermission } from "@/lib/authz";
import { RouteScaffold } from "../../../_components/route-scaffold";

export default async function V2CompanySettingsPage() {
  await requirePagePermission("settings", "view");
  return (
    <RouteScaffold
      description="Company identity and branding are separated from financial defaults in V2."
      phase={7}
      title="Company & branding"
      v1Href="/admin/settings"
    />
  );
}
