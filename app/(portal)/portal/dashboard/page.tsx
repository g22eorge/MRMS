import type { JobStatus } from "@prisma/client";
import Link from "next/link";

import { requirePortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { PortalHeader } from "@/components/portal/PortalHeader";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  ORG_ADMIN: "Organization Administrator",
  IT_OFFICER: "IT Officer",
  MEMBER: "Member",
};

// Repair statuses that count as "active" for the portal summary.
const ACTIVE_STATUSES: JobStatus[] = ["RECEIVED", "DIAGNOSING", "REFERRED", "AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"];

export default async function PortalDashboardPage() {
  const { portalUser, client, org, accessibleClients } = await requirePortalSession();

  // Every query is scoped to THIS portal user's org (tenant) AND client
  // (their corporate account) — a portal login can never see another
  // customer's or another shop's repairs.
  const scope = { orgId: org.id, clientId: client.id };
  const [total, active, ready, recent] = await Promise.all([
    prisma.job.count({ where: scope }),
    prisma.job.count({ where: { ...scope, status: { in: ACTIVE_STATUSES } } }),
    prisma.job.count({ where: { ...scope, status: "READY_FOR_PICKUP" } }),
    prisma.job.findMany({
      where: scope,
      orderBy: { receivedAt: "desc" },
      take: 8,
      select: { id: true, jobNumber: true, status: true, brand: true, model: true, receivedAt: true },
    }),
  ]);

  const companyName = client.organization || client.fullName;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <PortalHeader orgName={org.name} userName={portalUser.name} role={portalUser.role} company={companyName} active="dashboard" accounts={accessibleClients} activeClientId={client.id} />
      <div>
        <h1 className="text-xl font-black text-[var(--ink)]">Welcome, {portalUser.name}</h1>
        <p className="text-[13px] text-[var(--ink-muted)]">{companyName} · {ROLE_LABEL[portalUser.role] ?? portalUser.role}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total repairs", value: total },
          { label: "In progress", value: active },
          { label: "Ready for collection", value: ready },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
            <p className="text-2xl font-black tabular-nums text-[var(--ink)]">{s.value}</p>
            <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent repairs */}
      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="border-b border-[var(--line)] px-4 py-2.5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Recent repairs</p>
        </div>
        {recent.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-[var(--ink-muted)]">No repairs on record yet.</p>
        ) : (
          <ul>
            {recent.map((job) => (
              <li key={job.id} className="border-b border-[var(--line)]/60 text-[13px] last:border-0">
                <Link href={`/portal/repairs/${job.id}`} className="flex items-center justify-between px-4 py-2.5 transition hover:bg-[var(--panel-strong)]/40">
                  <div>
                    <span className="mono font-semibold text-[var(--ink)]">{job.jobNumber}</span>
                    <span className="ml-2 text-[var(--ink-muted)]">{[job.brand, job.model].filter(Boolean).join(" ") || "Device"}</span>
                  </div>
                  <span className="rounded-full bg-[var(--panel-strong)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--ink-muted)]">
                    {job.status.replaceAll("_", " ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-[11px] text-[var(--ink-muted)]">
        You are viewing repairs for {companyName} only. Internal workshop details are not shown here.
      </p>
    </div>
  );
}
