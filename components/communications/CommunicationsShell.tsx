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
    <section className="space-y-4">
      <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="border-b border-[var(--line)] px-4 py-4 sm:px-5">
          <p className="text-lg font-black text-[var(--ink)]">Communications</p>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            Outbox delivery, templates, WhatsApp config, and status policies.
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
          {active?.description ?? "Manage customer messaging operations."}
        </div>
      </div>
      {children}
    </section>
  );
}
