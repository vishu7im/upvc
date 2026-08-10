import { redirect } from "next/navigation";
import { ToastProvider } from "@/components/v2";
import { PermissionsProvider } from "@/lib/permissions-provider";
import { getCurrentUser } from "@/lib/server-api";
import V2Shell from "./v2-shell";

export const dynamic = "force-dynamic";

export default async function V2Layout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");

  return (
    <PermissionsProvider user={user}>
      <div className="v2-root" data-v2>
        <ToastProvider>
          <V2Shell user={user}>{children}</V2Shell>
        </ToastProvider>
      </div>
    </PermissionsProvider>
  );
}
