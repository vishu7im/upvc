"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, Header, Sidebar } from "@/components/v2";
import { logout } from "@/lib/api";
import { can } from "@/lib/permissions";
import { activeNavigationPath, buildV2Navigation, breadcrumbsForV2 } from "@/lib/v2/navigation";
import { versionPreferenceHref, versionSwitchTarget } from "@/lib/v2/routes";
import type { AuthUser } from "@/lib/types";

export default function V2Shell({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const sections = useMemo(() => buildV2Navigation(user.nav), [user.nav]);
  const v1Target = versionSwitchTarget("v1", pathname, searchParams);
  const orderSearch = can(user, "orders", "read") ? {
    action: "/v2/orders",
    label: "Search orders",
    placeholder: "Search orders",
    parameter: "q",
    defaultValue: pathname === "/v2/orders" ? searchParams.get("q") ?? undefined : undefined,
  } : undefined;

  async function onSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div
      className="v2-app-shell"
      data-v2-collapsed={collapsed || undefined}
      data-v2-mobile-open={mobileOpen || undefined}
    >
      {mobileOpen ? (
        <button
          aria-label="Close navigation"
          className="v2-shell-scrim"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      ) : null}
      <Sidebar
        activeHref={activeNavigationPath(pathname)}
        brand={{ name: "FabricatorOS", descriptor: "uPVC fabrication" }}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        onNavigate={() => setMobileOpen(false)}
        sections={sections}
        versionLink={{ label: "Switch to V1", href: versionPreferenceHref("v1", v1Target) }}
      />
      <div className="v2-shell-main">
        <Header
          breadcrumbs={breadcrumbsForV2(pathname)}
          menuControl={{ label: "Open navigation", onSelect: () => setMobileOpen(true) }}
          notifications={{
            count: user.incomingApprovals,
            href: "/v2/account",
            label: "Account approvals",
          }}
          profile={{
            context: user.role?.name ?? "User",
            href: "/v2/account",
            label: "Open account",
            name: user.name || user.email,
          }}
          search={orderSearch}
          trailing={
            <Button loading={signingOut} loadingLabel="Signing out" onClick={onSignOut} variant="ghost">
              Sign out
            </Button>
          }
        />
        <div className="v2-shell-content">{children}</div>
      </div>
    </div>
  );
}
