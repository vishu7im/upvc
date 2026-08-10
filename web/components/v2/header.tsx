import Link from "next/link";
import type { ReactNode } from "react";
import { initials } from "@/lib/v2/present";
import { ButtonLink, IconButton } from "./button";
import { V2Icon } from "./icons";

export interface HeaderSearch {
  action: string;
  label: string;
  placeholder: string;
  parameter?: string;
  defaultValue?: string;
}

export interface HeaderProps {
  breadcrumbs?: ReadonlyArray<{ label: string; href?: string }>;
  search?: HeaderSearch;
  primaryAction?: { label: string; href: string };
  notifications?: { label: string; href: string; count: number };
  profile: { label: string; href: string; name: string; context?: string };
  menuControl?: { label: string; onSelect: () => void };
  trailing?: ReactNode;
}

export function Header({
  breadcrumbs,
  search,
  primaryAction,
  notifications,
  profile,
  menuControl,
  trailing,
}: HeaderProps) {
  return (
    <header className="v2-header" data-v2-elevation="1">
      <div className="v2-header-leading">
        {menuControl ? <IconButton icon="menu" label={menuControl.label} onClick={menuControl.onSelect} tooltip={menuControl.label} /> : null}
        {breadcrumbs?.length ? (
          <nav aria-label="Breadcrumb">
            <ol>
              {breadcrumbs.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`}>
                  {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
      </div>
      {search ? (
        <form action={search.action} className="v2-header-search" method="get" role="search">
          <label className="v2-visually-hidden" htmlFor="v2-header-search">{search.label}</label>
          <V2Icon name="search" />
          <input
            defaultValue={search.defaultValue}
            id="v2-header-search"
            name={search.parameter ?? "q"}
            placeholder={search.placeholder}
            type="search"
          />
        </form>
      ) : null}
      <div className="v2-header-actions">
        {primaryAction ? <ButtonLink href={primaryAction.href}>{primaryAction.label}</ButtonLink> : null}
        {notifications ? (
          <Link aria-label={`${notifications.label}: ${notifications.count}`} className="v2-notification-link" href={notifications.href}>
            <V2Icon name="bell" />
            {notifications.count > 0 ? <span>{notifications.count > 99 ? "99+" : notifications.count}</span> : null}
          </Link>
        ) : null}
        {trailing}
        <Link aria-label={profile.label} className="v2-profile-link" href={profile.href}>
          <span aria-hidden="true">{initials(profile.name)}</span>
          <span><strong>{profile.name}</strong>{profile.context ? <small>{profile.context}</small> : null}</span>
        </Link>
      </div>
    </header>
  );
}
