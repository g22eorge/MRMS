"use client";

import Link from "next/link";
import { Role } from "@prisma/client";
import { usePathname } from "next/navigation";

type QuickAction = {
  href: string;
  label: string;
};

function roleActions(role: Role): QuickAction[] {
  if (role === "ADMIN") {
    return [
      { href: "/jobs/new", label: "New Job" },
      { href: "/clients", label: "Clients" },
      { href: "/reports", label: "Reports" },
    ];
  }
  if (role === "OPS") {
    return [
      { href: "/jobs/new", label: "New Job" },
      { href: "/clients", label: "Clients" },
      { href: "/reports", label: "Reports" },
    ];
  }
  if (role === "TECHNICIAN_EXTERNAL") {
    return [
      { href: "/jobs", label: "Work Orders" },
      { href: "/technicians/payouts", label: "Payouts" },
      { href: "/dashboard", label: "Overview" },
    ];
  }
  return [
    { href: "/jobs", label: "Work Queue" },
    { href: "/technicians", label: "Tech Board" },
    { href: "/dashboard", label: "Overview" },
  ];
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileQuickActions({ role }: { role: Role }) {
  const pathname = usePathname();
  const actions = roleActions(role);

  return (
    <div className="mobile-quick-actions glass grid grid-cols-3 gap-2 rounded-xl border border-[var(--line)] px-2 py-2 md:hidden">
      {actions.map((action) => {
        const active = isActive(pathname, action.href);
        return (
          <Link
            key={action.href}
            href={action.href}
            className={`min-w-0 rounded-lg border px-2 py-2 text-center text-[11px] font-semibold tracking-[0.08em] ${
              active
                ? "border-transparent bg-[var(--brand)] text-white"
                : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)]"
            }`}
          >
            {action.label}
          </Link>
        );
      })}
    </div>
  );
}
