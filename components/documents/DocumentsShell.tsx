"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DOCUMENTS_ROUTES, type DocumentsNavKey } from "@/lib/documents/routes";

type NavItem = {
  key: DocumentsNavKey;
  href: string;
  label: string;
  description: string;
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DocumentsShell({
  items,
  children,
}: {
  items: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active =
    items.find((item) => isActive(pathname, item.href)) ??
    (pathname.startsWith(DOCUMENTS_ROUTES.home) ? items[0] : null);

  return (
    <section className="space-y-4">
      {/* Tab pills only — each page renders its own title header (no duplicate). */}
      <nav className="flex gap-1.5 overflow-x-auto border-b border-[var(--line)] pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const selected = active?.key === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={selected ? "page" : undefined}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
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
