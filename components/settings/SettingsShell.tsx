"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { PageHeader } from "@/components/ui/PageHeader";

export type SettingsNavItem = {
  href: string;
  label: string;
  description?: string;
  badge?: string;
  icon?: React.ReactNode;
};

export type SettingsNavGroup = {
  title: string;
  items: SettingsNavItem[];
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsShell({
  groups,
  children,
}: {
  groups: SettingsNavGroup[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const activeItem = useMemo(() => {
    let best: SettingsNavItem | null = null;
    for (const item of flatItems) {
      if (!isActive(pathname, item.href)) continue;
      if (!best || item.href.length > best.href.length) best = item;
    }
    return best;
  }, [flatItems, pathname]);

  return (
    <section className="space-y-4">
      {/* Shared app-wide header so the settings title matches every other hub. */}
      <PageHeader
        eyebrow="Settings"
        title={activeItem?.label ?? "Overview"}
        description={activeItem?.description}
      />

      {/* Mobile: a single compact horizontally-scrollable pill row (grouping
          collapses to the flat pill list). */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden">
        {flatItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold transition ${
                active
                  ? "bg-[var(--accent)] text-black"
                  : "text-[var(--ink-muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--ink)]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Desktop: a grouped left-hand nav rail beside the content. */}
      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6">
        <aside className="hidden lg:block">
          <nav className="space-y-5">
            {groups.map((group) => (
              <div key={group.title} className="space-y-1.5">
                <p className="px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                  {group.title}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[0.8125rem] font-semibold transition ${
                          active
                            ? "bg-[var(--accent)] text-black"
                            : "text-[var(--ink-muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--ink)]"
                        }`}
                      >
                        {item.icon ? (
                          <span className="shrink-0 opacity-90">{item.icon}</span>
                        ) : null}
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
