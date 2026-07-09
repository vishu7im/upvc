// =====================================================================
// /change-password — forced-change screen (PLAN §5.5 / §7.3). Lives OUTSIDE
// the (app) group so the layout's mustChangePassword→here redirect can't loop.
// Authed users only; the (app) layout sends users here while the flag is set.
// =====================================================================

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server-api";
import { Alert, Card } from "@/components/ui";
import ChangePasswordForm from "./change-password-form";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8fb] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-950">Change your password</h1>
          <p className="mt-1 text-sm text-slate-500">Signed in as {user.email}</p>
        </div>
        <Card className="p-6">
          {user.mustChangePassword && (
            <div className="mb-5">
              <Alert tone="amber" title="A password change is required">
                Your password was set by an administrator. Choose a new one to continue.
              </Alert>
            </div>
          )}
          <ChangePasswordForm />
        </Card>
      </div>
    </main>
  );
}
