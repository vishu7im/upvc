"use client";

import Link from "next/link";
import { initials } from "@/lib/v2/present";
import { IconButton } from "./button";

export interface SidebarItem {
  id: string;
  label: string;
  href: string;
  marker?: string;
}

export interface SidebarSection {
  id: string;
  label: string;
  items: ReadonlyArray<SidebarItem>;
}

export interface SidebarProps {
  brand: { name: string; descriptor: string };
  sections: ReadonlyArray<SidebarSection>;
  activeHref: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onNavigate?: () => void;
  versionLink?: { label: string; href: string };
}

export function Sidebar({
  brand,
  sections,
  activeHref,
  collapsed = false,
  onCollapsedChange,
  onNavigate,
  versionLink,
}: SidebarProps) {
  const activeItemHref = sections
    .flatMap((section) => section.items)
    .filter((item) => {
      const pathname = item.href.split("?")[0];
      return activeHref === pathname || activeHref.startsWith(`${pathname}/`);
    })
    .sort((left, right) => right.href.length - left.href.length)[0]?.href;

  return (
    <aside aria-label="Primary" className="v2-sidebar" data-v2-collapsed={collapsed || undefined}>
      <div className="v2-sidebar-brand">
        <span aria-hidden="true">{initials(brand.name)}</span>
        {!collapsed ? <div><strong>{brand.name}</strong><small>{brand.descriptor}</small></div> : null}
        {onCollapsedChange ? (
          <IconButton
            icon="menu"
            label={collapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={() => onCollapsedChange(!collapsed)}
            tooltip={collapsed ? "Expand navigation" : "Collapse navigation"}
          />
        ) : null}
      </div>
      <nav>
        {sections.map((section) => (
          <section aria-labelledby={`v2-nav-${section.id}`} key={section.id}>
            <h2 className={collapsed ? "v2-visually-hidden" : undefined} id={`v2-nav-${section.id}`}>{section.label}</h2>
            <ul>
              {section.items.map((item) => {
                const active = item.href === activeItemHref;
                return (
                  <li key={item.id}>
                    <Link
                      aria-current={active ? "page" : undefined}
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                    >
                      {collapsed ? <span aria-hidden="true">{initials(item.label)}</span> : <span>{item.label}</span>}
                      {!collapsed && item.marker ? <small>{item.marker}</small> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
      {versionLink ? <Link className="v2-version-link" href={versionLink.href}>{collapsed ? initials(versionLink.label) : versionLink.label}</Link> : null}
    </aside>
  );
}
