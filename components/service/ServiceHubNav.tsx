"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SERVICE_ROUTES, SERVICE_NAV } from "@/lib/service/routes";

function isActive(pathname: string, href: string) {
  // Overview must not stay lit on the sub-module routes.
  if (href === SERVICE_ROUTES.home) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Service hub tab bar — the same tab-pill nav rendered at the top of every
 * service page (Overview / Field / Technicians / Complaints) so the module
 * reads as one hub (like the Finance/Documents shells). The sub-modules are
 * top-level routes, so this is dropped inline per page rather than via layout.
 */
export function ServiceHubNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1.5 border-b border-[var(--line)] pb-3">
      {SERVICE_NAV.map((item) => {
        const selected = isActive(pathname, item.href);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
              selected
                ? "bg-[var(--accent)] text-black"
                : "text-[var(--ink-muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--ink)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
