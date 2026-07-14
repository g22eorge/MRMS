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
      <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="border-b border-[var(--line)] px-4 py-4 sm:px-5">
          <p className="text-lg font-black text-[var(--ink)]">Documents</p>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            Quotes, invoices, receipts, and the full paperwork lifecycle.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-[var(--line)] px-3 py-3 sm:px-4">
          {items.map((item) => {
            const selected = active?.key === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
                  selected
                    ? "bg-[var(--accent)] text-black"
                    : "border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="hidden border-b border-[var(--line)] px-4 py-2 text-xs text-[var(--ink-muted)] sm:block sm:px-5">
          {active?.description ?? "Browse and manage customer documents."}
        </div>
      </div>
      {children}
    </section>
  );
}
