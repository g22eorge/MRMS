"use client";

import Link from "next/link";
import { Role } from "@prisma/client";
import { usePathname } from "next/navigation";

import { can } from "@/lib/permissions";
import { routeLabel } from "@/lib/nav/registry";

type QuickAction = {
  href: string;
  label: string;
};

// Labels come from the canonical route registry — one name per route.
const qa = (href: string): QuickAction => ({ href, label: routeLabel(href) });

function roleActions(role: Role, permissions: string[]): QuickAction[] {
  const permissionUser = { role, permissions };

  if (role === "ADMIN") {
    return [qa("/jobs/new"), qa("/intake"), qa("/reports")];
  }
  if (role === "OPS" || role === "FRONT_DESK" || role === "INTAKE") {
    return [qa("/jobs/new"), qa("/intake"), qa("/clients")];
  }
  if (role === "TECHNICIAN_INTERNAL" && can.viewClientInfo(permissionUser)) {
    // has can_intake
    return [qa("/jobs/new"), qa("/intake"), qa("/jobs")];
  }
  if (role === "TECHNICIAN_INTERNAL") {
    return [qa("/jobs"), qa("/technicians"), qa("/dashboard")];
  }
  if (role === "TECHNICIAN_EXTERNAL") {
    return [qa("/jobs"), qa("/technicians/payouts"), qa("/dashboard")];
  }
  return [qa("/jobs"), qa("/dashboard"), qa("/technicians")];
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileQuickActions({ role, permissions = [] }: { role: Role; permissions?: string[] }) {
  const pathname = usePathname();
  const actions = roleActions(role, permissions);

  return (
    <div className="mobile-quick-actions glass grid grid-cols-3 gap-2 rounded-xl border border-[var(--line)] px-2 py-2 lg:hidden">
      {actions.map((action) => {
        const active = isActive(pathname, action.href);
        return (
          <Link
            key={action.href}
            href={action.href}
            className={`min-w-0 rounded-lg border px-2 py-2 text-center text-[13px] font-semibold tracking-[0.08em] transition-colors ${
              active
                ? "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[#9A7A00]"
                : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] hover:border-[var(--accent)]/20 hover:text-[var(--ink)]"
            }`}
          >
            {action.label}
          </Link>
        );
      })}
    </div>
  );
}
