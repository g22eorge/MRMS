export const dynamic = "force-dynamic";

import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrgSession } from "@/lib/org-context";

type Tile = { label: string; href: string; icon: string; color: string; description: string };

// Only the destinations that are NOT already sidebar shortcuts live here — the
// hub complements the sidebar rather than repeating it. Stock counts, suppliers,
// supplier bills and the procurement desk are one click away in the sidebar.
const GROUPS: { label: string; tiles: Tile[] }[] = [
  {
    label: "Locations & Movement",
    tiles: [
      {
        label: "Locations",
        href: "/inventory/locations",
        icon: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z|M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
        color: "text-blue-500",
        description: "Warehouses, shelves, and storage areas",
      },
      {
        label: "Transfers",
        href: "/inventory/transfers",
        icon: "M5 12h14|M12 5l7 7-7 7",
        color: "text-[var(--accent)]",
        description: "Move stock between locations",
      },
      {
        label: "Goods Received",
        href: "/inventory/goods-received",
        icon: "M5 8h14M5 8a2 2 0 1 0-4 0v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8m-4 0V6a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2",
        color: "text-teal-500",
        description: "Record incoming stock deliveries",
      },
    ],
  },
];

function NavIcon({ d, color }: { d: string; color: string }) {
  const paths = d.split("|");
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={color} aria-hidden="true">
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

export default async function StockOpsPage() {
  const { user } = await requireOrgSession();
  if (!["ADMIN", "MANAGER", "TECH_MANAGER", "OPS"].includes(user.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-4 pb-24 lg:pb-8">

      <PageHeader
        eyebrow="Stock &amp; Supply"
        title="Stock Operations"
        description="Locations, transfers, and incoming deliveries"
        actions={<Button href="/inventory" variant="secondary" size="sm">Inventory items →</Button>}
      />

      {/* Grouped tiles */}
      <div className="space-y-5">
        {GROUPS.map((group) => (
          <section key={group.label}>
            <h2 className="mb-2.5 px-0.5 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
              {group.label}
            </h2>
            {/* Mobile */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:hidden">
              {group.tiles.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="dc-card flex items-center gap-3 px-4 py-3.5 transition active:opacity-75"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--panel-strong)]">
                    <NavIcon d={item.icon} color={item.color} />
                  </span>
                  <div>
                    <p className="text-[0.8125rem] font-semibold text-[var(--ink)]">{item.label}</p>
                    <p className="text-[0.75rem] text-[var(--ink-muted)]">{item.description}</p>
                  </div>
                </Link>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden gap-3 lg:grid lg:grid-cols-4">
              {group.tiles.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="dc-card flex flex-col gap-3 px-4 py-4 transition hover:shadow-[var(--dc-shadow-hover)]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--panel-strong)]">
                    <NavIcon d={item.icon} color={item.color} />
                  </span>
                  <div>
                    <p className="text-[0.8125rem] font-semibold text-[var(--ink)]">{item.label}</p>
                    <p className="mt-0.5 text-[0.75rem] text-[var(--ink-muted)]">{item.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

    </div>
  );
}
