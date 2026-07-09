"use client";

// =====================================================================
// Top navigation for the protected shell (Client Component). Highlights the
// active section, shows the signed-in user, and handles logout (clears the
// httpOnly cookie via the BFF, then returns to /login). Admin-only links are
// gated by role — the server still guards admin routes independently.
// =====================================================================

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { logout } from "@/lib/api";
import type { AuthUser } from "@/lib/types";
import { navIcon } from "@/lib/nav-icons";
import { Icon } from "@/components/icons";
import { ButtonLink, cn } from "@/components/ui";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function Nav({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // The sidebar is DATA: server-filtered by the caller's `view` permission,
  // ordered by sortOrder (PLAN §6.4/§7.2). Only entries with a real path show.
  const links = user.nav
    .filter((n): n is typeof n & { path: string } => Boolean(n.path))
    .map((n) => ({ href: n.path, label: n.name, icon: navIcon(n.icon) }));

  async function onLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white/[0.92] shadow-[12px_0_35px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-all duration-300",
          collapsed ? "lg:w-24" : "lg:w-72",
          mobileOpen ? "w-72 translate-x-0" : "w-72 -translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-20 items-center gap-3 px-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#0f172a] text-white shadow-[0_10px_25px_rgba(15,23,42,0.16)]">
            <Icon name="spark" className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-950">Fab ERP</p>
              <p className="truncate text-xs font-semibold uppercase text-slate-500">uPVC Fabrication</p>
            </div>
          )}
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((v) => !v)}
            className="ml-auto hidden h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950 lg:flex"
          >
            <Icon name={collapsed ? "chevronRight" : "chevronLeft"} className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? link.label : undefined}
                className={cn(
                  "group flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition",
                  active
                    ? "bg-[#e7e6ff] text-[#4442e3] shadow-[0_8px_24px_rgba(68,66,227,0.13)]"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                  collapsed && "lg:justify-center lg:px-0",
                )}
              >
                <Icon
                  name={link.icon}
                  className={cn("h-5 w-5 shrink-0 transition", !active && "group-hover:scale-105")}
                />
                {!collapsed && <span>{link.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <ButtonLink
            href="/quote"
            icon="plus"
            className={cn("w-full", collapsed && "lg:px-0")}
            title={collapsed ? "New quote" : undefined}
          >
            {!collapsed && "New quote"}
          </ButtonLink>
          <div className={cn("mt-4 space-y-1", collapsed && "lg:flex lg:flex-col lg:items-center")}>
            <button
              type="button"
              onClick={onLogout}
              disabled={loggingOut}
              className={cn(
                "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-60",
                collapsed && "lg:w-10 lg:justify-center lg:px-0",
              )}
              title={collapsed ? "Sign out" : undefined}
            >
              <Icon name="logout" className="h-5 w-5" />
              {!collapsed && (loggingOut ? "Signing out..." : "Sign out")}
            </button>
          </div>
        </div>
      </aside>

      <div className={cn("min-h-screen transition-all duration-300", collapsed ? "lg:pl-24" : "lg:pl-72")}>
        <header className="sticky top-0 z-30 border-b border-white/[0.70] bg-white/[0.76] backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 lg:hidden"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <div className="relative hidden min-w-0 max-w-lg flex-1 sm:block">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                aria-label="Global search"
                placeholder="Search orders, quotes, catalog..."
                className="h-10 w-full rounded-md border border-slate-200 bg-slate-100/80 pl-10 pr-3 text-sm text-slate-700 transition focus:border-[#4442e3] focus:bg-white focus:ring-4 focus:ring-[#4442e3]/10"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <ButtonLink href="/orders" icon="plus" className="hidden sm:inline-flex">
                Create order
              </ButtonLink>
              <Link
                href="/quote"
                className="hidden h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 md:inline-flex"
              >
                Quick quote
              </Link>
              <Link
                href="/account"
                aria-label="Notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
              >
                <Icon name="bell" className="h-5 w-5" />
                {user.incomingApprovals > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {user.incomingApprovals > 9 ? "9+" : user.incomingApprovals}
                  </span>
                )}
              </Link>
              <Link href="/account" className="ml-1 hidden items-center gap-3 border-l border-slate-200 pl-4 sm:flex">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#0f172a] text-sm font-bold text-white">
                  {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden min-w-0 md:block">
                  <p className="truncate text-sm font-semibold text-slate-950">{user.name || user.email}</p>
                  <p className="text-xs uppercase text-slate-500">{user.role?.name ?? "User"}</p>
                </div>
              </Link>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1500px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
