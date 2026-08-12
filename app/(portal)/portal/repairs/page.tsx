import Link from "next/link";

import { requirePortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { PortalHeader } from "@/components/portal/PortalHeader";

export const dynamic = "force-dynamic";

export default async function PortalRepairsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; submitted?: string }>;
}) {
  const { portalUser, client, org, accessibleClients } = await requirePortalSession();
  const { q, submitted } = await searchParams;
  const query = (q ?? "").trim();

  // Requests submitted via the portal that staff haven't turned into a job yet.
  const pending = await prisma.repairRequest.findMany({
    where: { orgId: org.id, clientId: client.id, linkedJobId: null, requestStatus: { notIn: ["REJECTED", "CONVERTED_TO_JOB"] } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, requestNumber: true, brand: true, model: true, deviceType: true, createdAt: true },
  });

  // Scoped to this customer's org + client only.
  const jobs = await prisma.job.findMany({
    where: {
      orgId: org.id,
      clientId: client.id,
      ...(query
        ? {
            OR: [
              { jobNumber: { contains: query } },
              { brand: { contains: query } },
              { model: { contains: query } },
              { serialOrImei: { contains: query } },
            ],
          }
        : {}),
    },
    orderBy: { receivedAt: "desc" },
    take: 100,
    select: { id: true, jobNumber: true, status: true, brand: true, model: true, serialOrImei: true, receivedAt: true },
  });

  const companyName = client.organization || client.fullName;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PortalHeader orgName={org.name} userName={portalUser.name} role={portalUser.role} company={companyName} active="repairs" accounts={accessibleClients} activeClientId={client.id} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-black text-[var(--ink)]">Repairs</h1>
        <Link href="/portal/repairs/new" className="btn-premium rounded-lg px-3 py-1.5 text-[0.8125rem] text-white">
          + Submit a repair
        </Link>
      </div>

      {submitted ? (
        <div className="mb-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-[0.8125rem] text-emerald-700 dark:text-emerald-300">
          Request submitted — {org.name}&rsquo;s team will confirm and open your repair shortly.
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div className="mb-3 overflow-hidden rounded-xl border border-amber-400/30 bg-amber-500/5">
          <p className="border-b border-amber-400/20 px-4 py-2 text-[0.6875rem] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Awaiting review ({pending.length})</p>
          <ul>
            {pending.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-2.5 text-[0.8125rem]">
                <div>
                  <span className="mono font-semibold text-[var(--ink)]">{r.requestNumber}</span>
                  <span className="ml-2 text-[var(--ink-muted)]">{[r.brand, r.model].filter(Boolean).join(" ") || r.deviceType.replaceAll("_", " ")}</span>
                </div>
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-amber-700 dark:text-amber-300">Pending review</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form method="GET" className="mb-3">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by job number, device, or serial…"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50"
        />
      </form>

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        {jobs.length === 0 ? (
          <p className="px-4 py-10 text-center text-[0.8125rem] text-[var(--ink-muted)]">
            {query ? "No repairs match your search." : "No repairs on record yet."}
          </p>
        ) : (
          <ul>
            {jobs.map((job) => (
              <li key={job.id} className="border-b border-[var(--line)]/60 last:border-0">
                <Link href={`/portal/repairs/${job.id}`} className="flex items-center justify-between px-4 py-3 transition hover:bg-[var(--panel-strong)]/40">
                  <div className="min-w-0">
                    <span className="mono text-[0.8125rem] font-semibold text-[var(--ink)]">{job.jobNumber}</span>
                    <span className="ml-2 text-[0.8125rem] text-[var(--ink-muted)]">{[job.brand, job.model].filter(Boolean).join(" ") || "Device"}</span>
                    {job.serialOrImei ? <span className="ml-2 text-[0.6875rem] text-[var(--ink-muted)]">· {job.serialOrImei}</span> : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--panel-strong)] px-2.5 py-0.5 text-[0.6875rem] font-semibold text-[var(--ink-muted)]">
                    {job.status.replaceAll("_", " ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
