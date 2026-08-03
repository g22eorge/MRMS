"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { FINANCE_ROUTES, type FinanceNavKey } from "@/lib/finance/routes";

type NavItem = { key: FinanceNavKey; href: string; label: string };

function isActive(pathname: string, href: string) {
  // The overview tab must not stay lit on every /finance/* sub-page.
  if (href === FINANCE_ROUTES.home) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Finance hub shell — one tabbed nav shared across every finance page, so the
 * hub reads as a single module (like Documents) rather than a set of separate
 * pages. Each page still renders its own title/content below the tabs.
 */
export function FinanceShell({ items, children }: { items: NavItem[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const active =
    items.find((item) => isActive(pathname, item.href)) ??
    (pathname.startsWith(FINANCE_ROUTES.home) ? items[0] : null);

  return (
    <section className="space-y-4">
      <nav className="flex flex-wrap gap-1.5 border-b border-[var(--line)] pb-3">
        {items.map((item) => {
          const selected = active?.key === item.key;
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
      {children}
    </section>
  );
}
