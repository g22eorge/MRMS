"use client";

import Link from "next/link";
import { Role } from "@prisma/client";
import { usePathname } from "next/navigation";
import { useState } from "react";

const nav = [
  { href: "/dashboard", label: "Dashboard", roles: "all" },
  { href: "/jobs", label: "Jobs", roles: "all" },
  { href: "/technicians/payouts", label: "Payouts", roles: ["TECHNICIAN_EXTERNAL"] },
  { href: "/clients", label: "Clients", roles: ["ADMIN", "OPS", "ACCOUNTS"] },
  { href: "/technicians", label: "Tech", roles: "all" },
  { href: "/reports", label: "Reports", roles: ["ADMIN", "ACCOUNTS"] },
  { href: "/settings/users", label: "Users", roles: ["ADMIN"] },
  { href: "/settings/profile", label: "Profile", roles: "all" },
] as const;

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
  if (label === "My Payouts") return "Payouts";
  if (label === "Overview") return "Home";
  if (label === "Profile") return "Me";
  return label;
}

function roleLabel(role: Role, href: string, label: string) {
  if (role === "TECHNICIAN_EXTERNAL") {
    if (href === "/dashboard") return "Overview";
    if (href === "/jobs") return "My Jobs";
    if (href === "/technicians/payouts") return "My Payouts";
  }
  if (role === "TECHNICIAN_INTERNAL") {
    if (href === "/jobs") return "My Queue";
  }
  if (role === "ACCOUNTS") {
    if (href === "/jobs") return "Billing Jobs";
    if (href === "/reports") return "Finance";
  }
  if (role === "OPS") {
    if (href === "/jobs") return "Approval Jobs";
  }
  return label;
}

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const visibleNav =
    role === "TECHNICIAN_EXTERNAL"
      ? nav.filter((item) => ["/dashboard", "/jobs", "/technicians/payouts", "/settings/profile"].includes(item.href))
      : nav.filter((item) => isVisible(role, item.roles));
  const mobilePrimary = visibleNav.slice(0, 4);
  const mobileMore = visibleNav.slice(4);

  return (
    <>
      <aside className="glass hidden border-r border-[var(--line)] md:flex md:h-screen md:w-72 md:flex-col">
        <div className="border-b border-[var(--line)] px-5 py-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">Eagle Info</p>
          <p className="text-base font-semibold">Repair Command Center</p>
        </div>
        <nav className="flex flex-col gap-2 p-4">
          {visibleNav.map((item) => {
            const label = roleLabel(role, item.href, item.label);
            return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                isActive(pathname, item.href)
                  ? "panel-shadow bg-[var(--brand)] text-white"
                  : "text-[var(--ink)] hover:bg-[var(--panel)]"
              }`}
            >
              {label}
            </Link>
            );
          })}
        </nav>
      </aside>

      <nav className="glass fixed bottom-0 left-0 right-0 z-40 flex items-center gap-1 border-t border-[var(--line)] px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 md:hidden">
        {mobilePrimary.map((item) => {
          const label = roleLabel(role, item.href, item.label);
          return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-w-0 flex-1 items-center justify-center rounded-md px-2 py-2.5 text-xs font-medium ${
              isActive(pathname, item.href)
                ? "bg-[var(--brand)] text-white"
                : "text-[var(--ink-muted)]"
            }`}
          >
            <span className="truncate">{mobileLabel(label)}</span>
          </Link>
          );
        })}
        {mobileMore.length > 0 ? (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex min-w-0 flex-1 items-center justify-center rounded-md px-2 py-2.5 text-xs font-medium text-[var(--ink-muted)]"
          >
            <span className="truncate">More</span>
          </button>
        ) : null}
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40 md:hidden" onClick={() => setMoreOpen(false)}>
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
              {mobileMore.map((item) => {
                const label = roleLabel(role, item.href, item.label);
                return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    isActive(pathname, item.href)
                      ? "bg-[var(--brand)] text-white"
                      : "text-[var(--ink)] hover:bg-[var(--panel-strong)]"
                  }`}
                >
                  {label}
                </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
