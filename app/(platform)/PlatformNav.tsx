"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PLATFORM_ROUTES } from "@/lib/platform/routes";

const NAV = [
  { href: PLATFORM_ROUTES.home, label: "Organisations", exact: true },
  { href: PLATFORM_ROUTES.payments, label: "Payments" },
  { href: PLATFORM_ROUTES.announcements, label: "Announcements" },
  { href: PLATFORM_ROUTES.audit, label: "Audit Log" },
  { href: PLATFORM_ROUTES.settings, label: "Settings" },
];

export function PlatformNav() {
  const path = usePathname();
  return (
    <nav className="flex items-center gap-0.5">
      {NAV.map((n) => {
        const active = n.exact ? path === n.href : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`relative px-3.5 py-3 text-xs font-semibold transition-colors border-b-2 ${
              active
                ? "border-[var(--gold)] text-[var(--ink)]"
                : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--line)]"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
