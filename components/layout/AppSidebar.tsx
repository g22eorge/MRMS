"use client";

import Link from "next/link";
import { Role } from "@prisma/client";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavGroup = "work" | "finance" | "admin" | "personal";

const nav = [
  { href: "/dashboard", label: "Dashboard", group: "work", roles: "all" },
  { href: "/jobs", label: "Jobs", group: "work", roles: "all" },
  { href: "/technicians", label: "Tech", group: "work", roles: "all" },
  { href: "/clients", label: "Clients", group: "work", roles: ["ADMIN", "OPS"] },
  { href: "/reports", label: "Reports", group: "finance", roles: ["ADMIN", "OPS"] },
  { href: "/technicians/payouts", label: "Payouts", group: "finance", roles: ["TECHNICIAN_EXTERNAL"] },
  { href: "/settings/users", label: "Users", group: "admin", roles: ["ADMIN"] },
  { href: "/settings/branding", label: "Branding", group: "admin", roles: ["ADMIN"] },
  { href: "/settings/profile", label: "Profile", group: "personal", roles: "all" },
] as const;

const groupLabel: Record<NavGroup, string> = {
  work: "Work",
  finance: "Finance",
  admin: "Admin",
  personal: "Personal",
};

const roleOrder: Partial<Record<Role, readonly string[]>> = {
  ADMIN: [
    "/dashboard",
    "/jobs",
    "/clients",
    "/technicians",
    "/reports",
    "/settings/users",
    "/settings/branding",
    "/settings/profile",
  ],
  OPS: ["/dashboard", "/jobs", "/clients", "/technicians", "/reports", "/settings/profile"],
  TECHNICIAN_INTERNAL: ["/dashboard", "/jobs", "/technicians", "/settings/profile"],
  TECHNICIAN_EXTERNAL: ["/dashboard", "/jobs", "/technicians/payouts", "/settings/profile"],
};

const roleGroupOrder: Partial<Record<Role, readonly NavGroup[]>> = {
  ADMIN: ["work", "finance", "admin", "personal"],
  OPS: ["work", "finance", "personal"],
  TECHNICIAN_INTERNAL: ["work", "personal"],
  TECHNICIAN_EXTERNAL: ["work", "finance", "personal"],
};

function isVisible(role: Role, rule: "all" | readonly string[]) {
  return rule === "all" ? true : rule.includes(role);
}

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

function mobileLabel(label: string) {
  if (label === "Dashboard") return "Home";
  if (label === "Clients") return "Client";
  if (label === "Reports") return "Report";
  if (label === "Billing Jobs") return "Jobs";
  if (label === "Approval Jobs") return "Approvals";
  if (label === "My Queue") return "Queue";
  if (label === "My Jobs") return "Jobs";
  if (label === "Work Orders") return "Jobs";
  if (label === "My Payouts") return "Payouts";
  if (label === "Work Queue") return "Queue";
  if (label === "Technician Board") return "Board";
  if (label === "Overview") return "Home";
  if (label === "Profile") return "Me";
  return label;
}

function navIcon(href: string) {
  if (href === "/dashboard") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M3 10.5 10 4l7 6.5V17a1 1 0 0 1-1 1h-4.5v-4h-3v4H4a1 1 0 0 1-1-1v-6.5Z" />
      </svg>
    );
  }
  if (href === "/jobs") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M4 3h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 3v2h8V6H6Zm0 4v2h8v-2H6Z" />
      </svg>
    );
  }
  if (href === "/technicians/payouts") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.8 3.3v1.1c1.4.2 2.3 1 2.5 2.2h-1.8c-.1-.4-.4-.7-1-.8v2.1c1.8.4 2.9 1 2.9 2.6 0 1.3-1 2.3-2.9 2.5V16H9.3v-1.1c-1.5-.2-2.5-1.1-2.7-2.4h1.8c.1.5.5.9 1 .9v-2.2c-1.8-.4-2.8-1.1-2.8-2.5 0-1.3 1-2.2 2.8-2.4V5.3h1.4Z" />
      </svg>
    );
  }
  if (href === "/clients") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0 2c-3.4 0-6.2 1.7-7 4.2a.6.6 0 0 0 .6.8h12.8a.6.6 0 0 0 .6-.8C16.2 13.7 13.4 12 10 12Z" />
      </svg>
    );
  }
  if (href === "/reports") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M4 16h12v1H3V3h1v13Zm2-2V9h2v5H6Zm4 0V6h2v8h-2Zm4 0v-3h2v3h-2Z" />
      </svg>
    );
  }
  if (href === "/technicians") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M7 2h6l.8 2H17v2h-1l-1.1 8.3A2 2 0 0 1 12.9 16H7.1a2 2 0 0 1-2-1.7L4 6H3V4h3.2L7 2Zm1.2 2-.3 1h4.2l-.3-1H8.2Z" />
      </svg>
    );
  }
  if (href === "/settings/users") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M10 2.8a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6ZM4 15.2c0-2 2.7-3.6 6-3.6s6 1.6 6 3.6V17H4v-1.8Z" />
      </svg>
    );
  }
  if (href === "/settings/branding") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M3 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4Zm2 .5v10h10v-10H5Zm1.5 7.5h7v1h-7v-1Zm0-2.5h7v1h-7v-1Zm0-2.5h4v1h-4V7Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4.2a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Zm1.2 8.2H8.8v-1.2h1v-3H8.8V9h2.4v4.2h1v1.2Z" />
    </svg>
  );
}

function roleLabel(role: Role, href: string, label: string) {
  if (role === "TECHNICIAN_EXTERNAL") {
    if (href === "/dashboard") return "Overview";
    if (href === "/jobs") return "Work Orders";
    if (href === "/technicians/payouts") return "My Payouts";
    if (href === "/settings/profile") return "Profile";
  }
  if (role === "TECHNICIAN_INTERNAL") {
    if (href === "/jobs") return "Work Queue";
    if (href === "/technicians") return "Technician Board";
  }
  if (role === "OPS") {
    if (href === "/jobs") return "Operations";
    if (href === "/reports") return "Finance";
  }
  if (role === "ADMIN") {
    if (href === "/jobs") return "Operations";
    if (href === "/technicians") return "Technician Board";
  }
  return label;
}

function orderedNavForRole(role: Role) {
  const visible = nav.filter((item) => isVisible(role, item.roles));
  const ordered = roleOrder[role] ?? visible.map((item) => item.href);
  const ranking = new Map(ordered.map((href, index) => [href, index]));
  return [...visible].sort((a, b) => (ranking.get(a.href) ?? 99) - (ranking.get(b.href) ?? 99));
}

function groupedNavForRole(role: Role) {
  const ordered = orderedNavForRole(role);
  const groups = roleGroupOrder[role] ?? ["work", "personal"];
  return groups
    .map((group) => ({
      group,
      items: ordered.filter((item) => item.group === group),
    }))
    .filter((section) => section.items.length > 0);
}

function mobilePrimaryForRole(role: Role, items: ReturnType<typeof orderedNavForRole>) {
  const preferred: Partial<Record<Role, readonly string[]>> = {
    ADMIN: ["/dashboard", "/jobs", "/reports"],
    OPS: ["/dashboard", "/jobs", "/reports"],
    TECHNICIAN_INTERNAL: ["/dashboard", "/jobs", "/technicians"],
    TECHNICIAN_EXTERNAL: ["/dashboard", "/jobs", "/technicians/payouts"],
  };

  const wanted = preferred[role] ?? items.map((item) => item.href).slice(0, 3);
  return wanted
    .map((href) => items.find((item) => item.href === href))
    .filter((item): item is (typeof items)[number] => Boolean(item));
}

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const visibleNav = orderedNavForRole(role);
  const groupedNav = groupedNavForRole(role);
  const mobilePrimary = mobilePrimaryForRole(role, visibleNav);
  const mobileMore = visibleNav.filter((item) => !mobilePrimary.some((primary) => primary.href === item.href));
  const moreActive = mobileMore.some((item) => isActive(pathname, item.href));

  return (
    <>
      <aside className="glass hidden border-r border-[var(--line)] lg:flex lg:h-screen lg:w-72 lg:flex-col">
        <div className="border-b border-[var(--line)] px-5 py-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">Eagle Info</p>
          <p className="text-base font-semibold">Repair Command Center</p>
        </div>
        <nav className="flex flex-col gap-3 p-4">
          {groupedNav.map((section) => (
            <div key={section.group} className="space-y-1.5">
              <p className="px-2 text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">{groupLabel[section.group]}</p>
              {section.items.map((item) => {
                const label = roleLabel(role, item.href, item.label);
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block w-full rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 ${
                      active
                        ? "panel-shadow border border-[var(--brand)] bg-[var(--panel-strong)] text-[var(--ink)]"
                        : "text-[var(--ink)] hover:bg-[var(--panel)]"
                    }`}
                  >
                      <span className="flex items-center gap-2">
                      <span className="nav-icon-premium sidebar-nav-icon">{navIcon(item.href)}</span>
                      <span>{label}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <nav className="mobile-bottom-nav glass fixed bottom-0 left-0 right-0 z-40 flex items-center gap-1 border-t border-[var(--line)] px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-10px_22px_rgba(15,23,33,0.12)] lg:hidden">
        {mobilePrimary.map((item) => {
          const label = roleLabel(role, item.href, item.label);
          const active = isActive(pathname, item.href);
          return (
          <Link
            key={item.href}
            href={item.href}
              className={`flex min-w-0 flex-1 items-center justify-center rounded-lg px-2 py-2.5 text-xs font-medium focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1 ${
                active
                  ? "bg-[var(--brand)] text-white"
                  : "bg-[var(--panel-strong)] text-[var(--ink-muted)]"
              }`}
            >
            <span className="flex items-center gap-1.5 truncate">
              <span className="nav-icon-premium sidebar-nav-icon h-5 w-5 rounded-md">{navIcon(item.href)}</span>
              <span className="truncate">{mobileLabel(label)}</span>
            </span>
          </Link>
          );
        })}
        {mobileMore.length > 0 ? (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex min-w-0 flex-1 items-center justify-center rounded-lg px-2 py-2.5 text-xs font-medium ${
              moreActive
                ? "bg-[var(--brand)] text-white"
                : "bg-[var(--panel-strong)] text-[var(--ink-muted)]"
            }`}
          >
            <span className="truncate">More</span>
          </button>
        ) : null}
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-[var(--line)] bg-white p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">More</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-md border border-[var(--line)] px-2 py-1 text-xs"
              >
                Close
              </button>
            </div>
            <div className="grid gap-2">
              {groupedNav
                .map((section) => ({
                  group: section.group,
                  items: section.items.filter((item) => mobileMore.some((mobileItem) => mobileItem.href === item.href)),
                }))
                .filter((section) => section.items.length > 0)
                .map((section) => (
                  <div key={`mobile-more-${section.group}`} className="space-y-1.5">
                    <p className="px-1 text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">{groupLabel[section.group]}</p>
                    {section.items.map((item) => {
                      const label = roleLabel(role, item.href, item.label);
                      const active = isActive(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          className={`block w-full rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 ${
                            active
                              ? "border border-[var(--brand)] bg-[var(--panel-strong)] text-[var(--ink)]"
                              : "text-[var(--ink)] hover:bg-[var(--panel-strong)]"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="nav-icon-premium sidebar-nav-icon">{navIcon(item.href)}</span>
                            <span>{label}</span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
