// =====================================================================
// Public login page. Server Component: if already authenticated, bounce to
// the dashboard; otherwise render the client login form. The form posts to
// the BFF (/api/auth/login), which sets the httpOnly token cookie.
// =====================================================================

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server-api";
import LoginForm from "./login-form";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="grid min-h-screen bg-[#f6f8fb] lg:grid-cols-[1fr_520px]">
      <section className="relative hidden overflow-hidden border-r border-slate-200 bg-[#0f172a] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-20">
          <div className="industrial-grid h-full w-full" />
        </div>
        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white text-[#0f172a]">
            <Icon name="spark" className="h-6 w-6" />
          </div>
          <p className="mt-6 text-sm font-semibold uppercase text-blue-100">Fab ERP</p>
          <h1 className="mt-3 max-w-xl text-5xl font-bold leading-tight">
            Precision quoting and order control for uPVC fabrication.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
            Configure designs, price materials, manage draft orders, and generate production documents from one secure manufacturing workspace.
          </p>
        </div>
        <div className="relative grid grid-cols-3 gap-3">
          {[
            ["Live quotes", "350 ms"],
            ["Catalog rows", "Pricing"],
            ["Documents", "7 packs"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-white/10 bg-white/[0.08] p-4 backdrop-blur">
              <p className="text-xs uppercase text-slate-400">{label}</p>
              <p className="mt-2 text-xl font-bold">{value}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#0f172a] text-white">
              <Icon name="spark" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-950">Fab ERP</p>
              <p className="text-xs uppercase text-slate-500">uPVC Fabrication</p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-semibold uppercase text-[#4442e3]">Secure workspace</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-950">Sign in</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Use your fabrication account to continue.</p>
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  );
}
