"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { COMMUNICATIONS_ROUTES, type CommunicationsNavKey } from "@/lib/communications/routes";

type NavItem = {
  key: CommunicationsNavKey;
  href: string;
  label: string;
  description: string;
};

function isActive(pathname: string, href: string, key: CommunicationsNavKey, hash: string) {
  if (key === "policies" && pathname === COMMUNICATIONS_ROUTES.templates && hash === "#policies") {
    return true;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CommunicationsShell({
  items,
  children,
}: {
  items: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);

  const active =
    items.find((item) => isActive(pathname, item.href, item.key, hash)) ??
    (pathname.startsWith(COMMUNICATIONS_ROUTES.home) ? items[0] : null);

  return (
    <section className="space-y-5">
      {/* Single section header: active page title + description, then tab pills. */}
      <header className="space-y-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h1 className="truncate text-xl font-bold tracking-tight text-[var(--ink)]">
              {active?.label ?? "Communications"}
            </h1>
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]/60">
              Comms
            </span>
          </div>
          <p className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
            {active?.description ?? "Outbox delivery, templates, WhatsApp config, and status policies."}
          </p>
        </div>
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
      </header>
      {children}
    </section>
  );
}
