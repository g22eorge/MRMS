"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type HubTab = {
  href: string;
  label: string;
  /** Match this href exactly (for a hub's landing/"home" tab). */
  exact?: boolean;
};

/**
 * HubTabs — the generic tab-pill hub nav shared by modules whose sub-pages are
 * top-level routes rather than nested under one segment (so a layout can't wrap
 * them). Rendered inline at the top of each page via the ListPageLayout
 * `topBar` slot. Same pill treatment as the Finance/Documents shells.
 */
export function HubTabs({ items }: { items: HubTab[] }) {
  const pathname = usePathname();
  const activeHref =
    // Prefer the most specific (longest) matching href so /a/b beats /a.
    items
      .filter((t) => (t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`)))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="flex gap-1.5 overflow-x-auto border-b border-[var(--line)] pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const selected = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold transition ${
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
