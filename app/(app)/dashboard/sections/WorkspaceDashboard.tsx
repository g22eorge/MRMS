import Link from "next/link";

import type { Role } from "@prisma/client";

import { buildSidebarModel } from "@/lib/nav/sidebar-model";

import { SalesPosDashboard } from "./SalesPosDashboard";

/**
 * The dashboard for a staff role in a business that has not chosen the repair
 * module.
 *
 * Operations, front desk, manager and the technician roles each have a
 * dashboard built from repair jobs: queues, pickups, payouts. A shop running
 * point of sale and inventory has none of that, and those pages would show a
 * wall of zeros with links that the module gate bounces. This shows what the
 * person can actually open instead, taken from the same model the menus use so
 * the two cannot disagree.
 *
 * No money figures: these roles' own dashboards differ in what they may see,
 * and a neutral page must not become the widest of them.
 */
export async function WorkspaceDashboard({
  userId,
  userName,
  role,
  permissions,
  enabledModules,
}: {
  userId: string;
  userName: string;
  role: Role;
  permissions: string[];
  enabledModules: Set<string>;
}) {
  const model = buildSidebarModel(role, permissions, enabledModules);
  const places = [...model.pinned, ...model.sections.flatMap((section) => section.items)].filter(
    (item) => item.href !== "/dashboard",
  );
  const showPos = places.some((item) => item.href === "/pos");
  const firstName = userName.split(" ")[0];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[1.25rem] font-bold tracking-[-0.02em] text-[var(--ink)]">Welcome, {firstName}</h2>
        <p className="mt-0.5 text-[0.8125rem] text-[var(--ink-muted)]">Here is what you can work on.</p>
      </div>

      {showPos ? <SalesPosDashboard userId={userId} /> : null}

      {places.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {places.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3.5 text-[0.875rem] font-semibold text-[var(--ink)] transition hover:bg-[var(--panel-strong)]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--ink-muted)]">
          Nothing has been switched on for your role yet. Ask an administrator.
        </p>
      )}
    </div>
  );
}
