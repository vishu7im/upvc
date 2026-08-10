import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server-api";
import { RouteScaffold } from "../_components/route-scaffold";

export default async function V2AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return (
    <RouteScaffold
      description="Profile identity and peer-consent deletion approvals stay available to every authenticated account."
      phase={7}
      title="Account"
      v1Href="/account"
    />
  );
}
