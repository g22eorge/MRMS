import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { requireOrgSession } from "@/lib/org-context";
import { clientDisplayName } from "@/lib/client-name";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";
import { TablePagination } from "@/components/ui/DataTable";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const STATUS_TABS = [
  { key: "open", label: "Open", status: "OPEN" },
  { key: "resolved", label: "Resolved", status: "RESOLVED" },
  { key: "rejected", label: "Rejected", status: "REJECTED" },
  { key: "all", label: "All", status: null },
] as const;

function chipClass(status: string) {
  if (status === "RESOLVED") return "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400";
  if (status === "REJECTED") return "bg-red-500/12 text-red-600 dark:text-red-400";
  return "bg-amber-500/12 text-amber-700 dark:text-amber-400";
}

const fmt = (d: Date) => d.toISOString().slice(0, 10);

/** Days a claim has been open, for the ones nobody has settled. */
function ageDays(from: Date) {
  return Math.floor((Date.now() - from.getTime()) / 86_400_000);
}

/**
 * Warranty claims across the workspace.
 *
 * Claims were previously reachable only through the job they were raised
 * against, so "what is outstanding this month" had no answer. This is that
 * answer: open claims first, oldest at the top, since an unsettled warranty
 * claim is a customer waiting.
 */
export default async function WarrantyClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { user, orgId } = await requireOrgSession();

  // Settling is a manager's call, and this page exists to settle from.
  if (!can.approveWork(user)) redirect("/dashboard");

  const filters = await searchParams;
  const tab = STATUS_TABS.find((t) => t.key === filters.tab) ?? STATUS_TABS[0];
  const page = parsePage(filters.page);

  const where = { orgId, ...(tab.status ? { status: tab.status } : {}) };

  const [claims, total, counts] = await Promise.all([
    prisma.warrantyClaim.findMany({
      where,
      // Oldest first while open — the one waiting longest needs attention
      // first. Closed lists read newest first, as history normally does.
      orderBy: tab.status === "OPEN" ? { openedAt: "asc" } : { openedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, status: true, reason: true, resolution: true,
        openedAt: true, closedAt: true,
        originalJob: {
          select: {
            id: true, jobNumber: true, brand: true, model: true,
            warrantyExpiresAt: true,
            client: { select: { fullName: true, organization: true } },
          },
        },
        warrantyJob: { select: { id: true, jobNumber: true } },
      },
    }),
    prisma.warrantyClaim.count({ where }),
    prisma.warrantyClaim.groupBy({ by: ["status"], where: { orgId }, _count: true }),
  ]);

  const countFor = (status: string | null) =>
    status === null
      ? counts.reduce((s, c) => s + c._count, 0)
      : (counts.find((c) => c.status === status)?._count ?? 0);

  const view = paginationView(page, total, PAGE_SIZE);
  const hrefFor = pageHrefBuilder("/warranty", { tab: tab.key });

  return (
    <ListPageLayout
      header={{
        eyebrow: "Service",
        title: "Warranty claims",
        description: "Repairs customers have brought back, and how each was settled.",
      }}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => {
          const n = countFor(t.status);
          const active = t.key === tab.key;
          return (
            <Link
              key={t.key}
              href={`/warranty?tab=${t.key}`}
              className={`inline-flex h-11 shrink-0 items-center justify-center rounded-full px-3.5 text-[0.75rem] font-bold transition ${
                active
                  ? "bg-[var(--accent)] text-black"
                  : "border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)]"
              }`}
            >
              {t.label}{n > 0 && !active ? ` ${n}` : ""}
            </Link>
          );
        })}
      </div>

      {claims.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-10 text-center">
          <p className="text-sm font-medium text-[var(--ink)]">
            {tab.status === "OPEN" ? "No open warranty claims." : "Nothing here yet."}
          </p>
          <p className="mt-1 text-[0.8125rem] text-[var(--ink-muted)]">
            Claims are raised from the repair a customer brings back, on its Assessment tab.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {claims.map((claim) => {
            const job = claim.originalJob;
            const device = [job?.brand, job?.model].filter((v) => v && v !== "Unknown").join(" ");
            const lapsed = job?.warrantyExpiresAt ? job.warrantyExpiresAt < claim.openedAt : false;
            const age = ageDays(claim.openedAt);
            return (
              <li key={claim.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase ${chipClass(claim.status)}`}>
                    {claim.status}
                  </span>
                  {job ? (
                    <Link href={`/jobs/${job.id}`} className="text-[0.8125rem] font-bold text-[var(--accent)] underline">
                      {job.jobNumber}
                    </Link>
                  ) : null}
                  {device ? <span className="text-[0.8125rem] font-semibold text-[var(--ink)]">{device}</span> : null}
                  {claim.status === "OPEN" && age > 0 ? (
                    <span className={`text-[0.75rem] font-bold tabular-nums ${age >= 7 ? "text-red-500" : "text-[var(--ink-muted)]"}`}>
                      {age}d open
                    </span>
                  ) : null}
                  {lapsed ? (
                    <span className="rounded bg-[var(--panel-strong)] px-1.5 py-0.5 text-[0.6875rem] font-semibold text-[var(--ink-muted)]">
                      raised after cover ended
                    </span>
                  ) : null}
                </div>

                <p className="mt-1.5 text-[0.8125rem] text-[var(--ink)]">{claim.reason}</p>

                <p className="mt-1 text-[0.75rem] text-[var(--ink-muted)]">
                  {job?.client ? clientDisplayName(job.client, "No client") : "No client"}
                  {" · opened "}{fmt(claim.openedAt)}
                  {claim.closedAt ? ` · closed ${fmt(claim.closedAt)}` : ""}
                </p>

                {claim.resolution ? (
                  <p className="mt-1 text-[0.8125rem] text-[var(--ink-muted)]">
                    <span className="font-semibold">Outcome:</span> {claim.resolution}
                  </p>
                ) : null}

                {claim.warrantyJob ? (
                  <p className="mt-1 text-[0.8125rem]">
                    <span className="text-[var(--ink-muted)]">Repaired under warranty on </span>
                    <Link href={`/jobs/${claim.warrantyJob.id}`} className="font-semibold text-[var(--accent)] underline">
                      {claim.warrantyJob.jobNumber}
                    </Link>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {view.totalPages > 1 ? (
        <div className="mt-3">
          <TablePagination
            page={view.page}
            totalPages={view.totalPages}
            rangeStart={view.rangeStart}
            rangeEnd={view.rangeEnd}
            total={total}
            hrefForPage={hrefFor}
            unit="claims"
          />
        </div>
      ) : null}
    </ListPageLayout>
  );
}
