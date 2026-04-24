"use client";

import Link from "next/link";
import { Role } from "@prisma/client";
import { usePathname } from "next/navigation";

import { can } from "@/lib/permissions";

type NavGroup = "work" | "finance" | "admin" | "personal";

const nav = [
  { href: "/dashboard", label: "Dashboard", group: "work", roles: "all" },
  { href: "/jobs", label: "Jobs", group: "work", roles: "all" },
  { href: "/intake", label: "Requests", group: "work", roles: ["ADMIN", "OPS", "INTAKE", "TECHNICIAN_INTERNAL"] },
  { href: "/technicians", label: "Technicians", group: "work", roles: "all" },
  { href: "/clients", label: "Clients", group: "work", roles: ["ADMIN", "OPS", "INTAKE"] },
  { href: "/reports", label: "Reports", group: "finance", roles: ["ADMIN", "OPS"] },
  { href: "/payout-followups", label: "Payout Follow-up", group: "finance", roles: ["ADMIN", "OPS"] },
  { href: "/technicians/payouts", label: "Payouts", group: "finance", roles: ["TECHNICIAN_EXTERNAL"] },
  { href: "/settings/users", label: "Users", group: "admin", roles: ["ADMIN"] },
  { href: "/settings/branding", label: "Branding", group: "admin", roles: ["ADMIN"] },
  { href: "/settings/profile", label: "Profile", group: "personal", roles: "all" },
  { href: "/settings/notifications", label: "Notifications", group: "personal", roles: "all" },
] as const;

const groupLabel: Record<NavGroup, string> = {
  work: "Main",
  finance: "Finance",
  admin: "Admin",
  personal: "Account",
};

const roleOrder: Partial<Record<Role, readonly string[]>> = {
  ADMIN: [
    "/dashboard",
    "/jobs",
    "/intake",
    "/clients",
    "/technicians",
    "/reports",
    "/payout-followups",
    "/settings/users",
    "/settings/branding",
    "/settings/profile",
    "/settings/notifications",
  ],
  OPS: ["/dashboard", "/jobs", "/intake", "/clients", "/technicians", "/reports", "/payout-followups", "/settings/profile", "/settings/notifications"],
  TECHNICIAN_INTERNAL: ["/dashboard", "/jobs", "/intake", "/technicians", "/settings/profile", "/settings/notifications"],
  TECHNICIAN_EXTERNAL: ["/dashboard", "/jobs", "/technicians/payouts", "/technicians", "/settings/profile", "/settings/notifications"],
  INTAKE: ["/dashboard", "/jobs", "/intake", "/clients", "/technicians", "/settings/profile", "/settings/notifications"],
};

const roleGroupOrder: Partial<Record<Role, readonly NavGroup[]>> = {
  ADMIN: ["work", "finance", "admin", "personal"],
  OPS: ["work", "finance", "personal"],
  TECHNICIAN_INTERNAL: ["work", "personal"],
  TECHNICIAN_EXTERNAL: ["work", "finance", "personal"],
  INTAKE: ["work", "personal"],
};

function isVisible(role: Role, rule: "all" | readonly string[]) {
  return rule === "all" ? true : rule.includes(role);
}

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

function navIcon(href: string) {
  if (href === "/dashboard") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M2.5 9.5 10 3l7.5 6.5V17a.75.75 0 0 1-.75.75h-4.5v-4h-4.5v4h-4.5A.75.75 0 0 1 2.5 17V9.5Z" />
      </svg>
    );
  }
  if (href === "/jobs") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M6 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.414A2 2 0 0 0 15.414 6L12 2.586A2 2 0 0 0 10.586 2H6Zm2 5a1 1 0 0 0 0 2h4a1 1 0 1 0 0-2H8Zm-1 4a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2H8Z" clipRule="evenodd" />
      </svg>
    );
  }
  if (href === "/intake") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M2 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4l-3 3V5Zm10 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm7 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" clipRule="evenodd" />
      </svg>
    );
  }
  if (href === "/technicians/payouts") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M10.75 10.818v2.614A3.13 3.13 0 0 0 11.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 0 0-1.138-.432ZM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 0 0-.35.13c-.14.065-.27.143-.386.233-.377.292-.514.627-.514.909 0 .184.058.39.33.576Z" />
        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-6a.75.75 0 0 1 .75.75v.316a3.78 3.78 0 0 1 1.653.713c.426.33.744.74.925 1.2a.75.75 0 0 1-1.395.55 1.35 1.35 0 0 0-.428-.507 2.276 2.276 0 0 0-.755-.36V8.5c.558.157 1.072.443 1.482.8.542.47.87 1.096.87 1.7 0 .604-.328 1.23-.87 1.7a4.841 4.841 0 0 1-1.482.8V14a.75.75 0 0 1-1.5 0v-.311a4.5 4.5 0 0 1-1.681-.845.75.75 0 1 1 .914-1.198c.382.29.813.487 1.267.551V9.5a3.702 3.702 0 0 1-1.29-.645 2.193 2.193 0 0 1-.798-1.678c0-.845.467-1.58 1.129-2.066A3.947 3.947 0 0 1 9.25 4.81V4.75A.75.75 0 0 1 10 4Z" clipRule="evenodd" />
      </svg>
    );
  }
  if (href === "/clients") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.153c.176.463-.039.964-.51 1.16A8.46 8.46 0 0 1 14.5 16Z" />
      </svg>
    );
  }
  if (href === "/reports") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 3 0v-13A1.5 1.5 0 0 0 15.5 2ZM9.5 6A1.5 1.5 0 0 0 8 7.5v9a1.5 1.5 0 0 0 3 0v-9A1.5 1.5 0 0 0 9.5 6ZM3.5 10A1.5 1.5 0 0 0 2 11.5v5a1.5 1.5 0 0 0 3 0v-5A1.5 1.5 0 0 0 3.5 10Z" />
      </svg>
    );
  }
  if (href === "/technicians") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.49 15.326a.78.78 0 0 1-.358-.442 3 3 0 0 1 4.308-3.516 6.484 6.484 0 0 0-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 0 1-2.07-.655ZM16.44 15.98a4.97 4.97 0 0 0 2.07-.654.78.78 0 0 0 .357-.442 3 3 0 0 0-4.308-3.517 6.484 6.484 0 0 1 1.907 3.96 2.32 2.32 0 0 1-.026.654ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5.304 16.19a.844.844 0 0 1-.277-.71 5 5 0 0 1 9.947 0 .843.843 0 0 1-.277.71A6.975 6.975 0 0 1 10 18a6.974 6.974 0 0 1-4.696-1.81Z" />
      </svg>
    );
  }
  if (href === "/settings/users") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M11 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM2.046 15.253c-.18.01-.34-.092-.382-.266a6.5 6.5 0 0 1 11.672 0c-.042.174-.202.276-.382.266a34.816 34.816 0 0 0-10.908 0ZM16.75 9.5a.75.75 0 0 0-1.5 0v1.25H14a.75.75 0 0 0 0 1.5h1.25V13.5a.75.75 0 0 0 1.5 0v-1.25H18a.75.75 0 0 0 0-1.5h-1.25V9.5Z" />
      </svg>
    );
  }
  if (href === "/settings/branding") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M4 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4Zm5.5 8.5v3.25a.75.75 0 0 1-1.5 0V10.5H5.75a.75.75 0 0 1 0-1.5h2.25V6.75a.75.75 0 0 1 1.5 0V9h2.25a.75.75 0 0 1 0 1.5H9.5Z" clipRule="evenodd" />
      </svg>
    );
  }
  // profile / notifications / fallback
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-5.5-2.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM10 12a5.99 5.99 0 0 0-4.793 2.39A6.483 6.483 0 0 0 10 16.5a6.483 6.483 0 0 0 4.793-2.11A5.99 5.99 0 0 0 10 12Z" clipRule="evenodd" />
    </svg>
  );
}

function orderedNavForRole(role: Role, permissions: string[]) {
  if (role === "OPS") {
    const opsLinks = nav.filter((item) =>
      ["/dashboard", "/jobs", "/intake", "/clients", "/technicians", "/reports", "/payout-followups", "/settings/profile", "/settings/notifications"].includes(item.href)
    );
    return opsLinks;
  }

  const visible = nav.filter((item) => isVisible(role, item.roles));
  const permissionUser = { role, permissions };
  if (can.viewClientInfo(permissionUser) && !visible.some((item) => item.href === "/intake")) {
    visible.push(nav.find((item) => item.href === "/intake")!);
  }
  if (can.viewClientInfo(permissionUser) && !visible.some((item) => item.href === "/clients")) {
    visible.push(nav.find((item) => item.href === "/clients")!);
  }
  if (can.viewAccountsSummary(permissionUser) && !visible.some((item) => item.href === "/reports")) {
    visible.push(nav.find((item) => item.href === "/reports")!);
  }
  const ordered = roleOrder[role] ?? visible.map((item) => item.href);
  const ranking = new Map(ordered.map((href, index) => [href, index]));
  return [...visible].sort((a, b) => (ranking.get(a.href) ?? 99) - (ranking.get(b.href) ?? 99));
}

function groupedNavForRole(role: Role, permissions: string[]) {
  const ordered = orderedNavForRole(role, permissions);
  const groups = roleGroupOrder[role] ?? ["work", "personal"];
  return groups
    .map((group) => ({
      group,
      items: ordered.filter((item) => item.group === group),
    }))
    .filter((section) => section.items.length > 0);
}

export function AppSidebar({ role, permissions = [] }: { role: Role; permissions?: string[] }) {
  const pathname = usePathname();
  const groupedNav = groupedNavForRole(role, permissions);

  return (
    <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col bg-[var(--sidebar-bg)] border-r border-[var(--line)]">
      {/* ── Brand ── */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[var(--line)]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] shadow-sm">
          {/* Eagle mark */}
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="M12 3L4 7.5V12.5C4 16.09 7.58 19.43 12 21C16.42 19.43 20 16.09 20 12.5V7.5L12 3Z" fill="#D4AF37" opacity="0.9" />
            <path d="M9 12L11 14L15 10" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold tracking-tight text-[var(--ink)] leading-none">Eagle Info</p>
          <p className="text-[10px] font-semibold text-[var(--accent)] tracking-wide mt-0.5">Repair Manager</p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
        {groupedNav.map((section, si) => (
          <div key={section.group}>
            <p className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/60">
              {groupLabel[section.group]}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:ring-offset-1 ${
                      active
                        ? "bg-[var(--accent-muted)] text-[var(--ink)]"
                        : "text-[var(--ink-muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {/* Left accent indicator */}
                    <span
                      className={`flex h-4 w-0.5 shrink-0 rounded-full transition-all ${
                        active ? "bg-[var(--accent)]" : "bg-transparent group-hover:bg-[var(--line)]"
                      }`}
                    />
                    {/* Icon */}
                    <span
                      className={`flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-md transition-colors [&_svg]:h-3.5 [&_svg]:w-3.5 ${
                        active
                          ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                          : "bg-[var(--panel-strong)] text-[var(--ink-muted)] group-hover:bg-[var(--line)] group-hover:text-[var(--ink)]"
                      }`}
                    >
                      {navIcon(item.href)}
                    </span>
                    {/* Label */}
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
            {/* Divider between groups (not after last) */}
            {si < groupedNav.length - 1 && (
              <div className="mt-4 border-t border-[var(--line)]" />
            )}
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div className="border-t border-[var(--line)] px-5 py-3">
        <p className="text-[10px] text-[var(--ink-muted)]/50 tracking-wide">Eagle Info Solutions</p>
      </div>
    </aside>
  );
}
