"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { UiVersion } from "@/lib/v2/routes";
import { versionPreferenceHref, versionSwitchTarget } from "@/lib/v2/routes";
import { ButtonLink } from "./button";
import { Card } from "./card";

export function VersionChooser({ preferred }: { preferred?: UiVersion }) {
  return (
    <div className="v2-version-options">
      <div data-v2-preferred={preferred === "v1" || undefined}>
        <Card
          description="The established interface, with all existing routes and workflows unchanged."
          elevation={preferred === "v1" ? "raised" : "flat"}
          title="FabricatorOS V1"
        >
          <div className="v2-version-option-content">
            {preferred === "v1" ? <p>Last used on this browser</p> : null}
            <ButtonLink href={versionPreferenceHref("v1", "/v1")} variant="secondary">
              Visit V1
            </ButtonLink>
          </div>
        </Card>
      </div>
      <div data-v2-preferred={preferred === "v2" || undefined}>
        <Card
          description="The clearer task-shaped interface, built over the same data, permissions, and fabrication engine."
          elevation={preferred === "v2" ? "raised" : "flat"}
          title="FabricatorOS V2"
        >
          <div className="v2-version-option-content">
            {preferred === "v2" ? <p>Last used on this browser</p> : null}
            <ButtonLink href={versionPreferenceHref("v2", "/v2")}>Visit V2</ButtonLink>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function LegacyVersionSwitcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (
    pathname === "/" ||
    pathname === "/version-chooser" ||
    pathname === "/login" ||
    pathname === "/change-password" ||
    pathname.startsWith("/v2") ||
    pathname.startsWith("/ui-version/")
  ) {
    return null;
  }

  const target = versionSwitchTarget("v2", pathname, searchParams);
  return (
    <div className="v2-legacy-switcher" data-v2>
      <Link href={versionPreferenceHref("v2", target)}>Switch to V2</Link>
    </div>
  );
}
