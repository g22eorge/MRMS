import Link from "next/link";
import { redirect } from "next/navigation";

import { requirePortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  generateComplaintNumber,
  COMPLAINT_CATEGORIES,
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUS_STYLES,
  COMPLAINT_CHANNEL_WEB,
} from "@/lib/complaints";
import type { ComplaintCategory } from "@prisma/client";

export const dynamic = "force-dynamic";

const CATEGORIES = COMPLAINT_CATEGORIES as unknown as ComplaintCategory[];

// A portal client is already authenticated and their repairs are known, so —
// unlike the public /feedback form — they don't type or verify a job number.
// They pick from their own repairs (or file a general complaint), and we scope
// everything to their org + client. Any job id in the form is re-verified
// server-side against this client before it's trusted.
export default async function PortalComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; submitted?: string; error?: string }>;
}) {
  const { portalUser, client, org, accessibleClients } = await requirePortalSession();
  const sp = await searchParams;
  const preselectJobId = typeof sp.ref === "string" ? sp.ref : "";
  const submitted = typeof sp.submitted === "string" ? sp.submitted : null;
  const error = typeof sp.error === "string" ? sp.error : null;

  const scope = { orgId: org.id, clientId: client.id };
  const [jobs, complaints] = await Promise.all([
    prisma.job.findMany({
      where: scope,
      orderBy: { receivedAt: "desc" },
      take: 100,
      select: { id: true, jobNumber: true, brand: true, model: true },
    }),
    // Their complaints on this shop — scoped by tenant (orgId) + their phone.
    prisma.complaint.findMany({
      where: { orgId: org.id, clientPhone: client.phone },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true, complaintNumber: true, status: true, category: true,
        description: true, createdAt: true, job: { select: { jobNumber: true } },
      },
    }),
  ]);

  const companyName = client.organization || client.fullName;

  async function submitPortalComplaintAction(formData: FormData) {
    "use server";
    const { client: c, org: o } = await requirePortalSession();
    const jobId = String(formData.get("jobId") ?? "").trim() || null;
    const categoryRaw = String(formData.get("category") ?? "OTHER").trim();
    const description = String(formData.get("description") ?? "").trim();
    const expectedResolution = String(formData.get("expectedResolution") ?? "").trim();

    if (!description) redirect("/portal/complaints?error=Please+describe+the+issue.");

    // Never trust the submitted job id — re-verify it belongs to THIS client.
    let safeJobId: string | null = null;
    if (jobId) {
      const job = await prisma.job.findFirst({
        where: { id: jobId, orgId: o.id, clientId: c.id },
        select: { id: true },
      });
      safeJobId = job?.id ?? null;
    }

    const category = CATEGORIES.includes(categoryRaw as ComplaintCategory)
      ? (categoryRaw as ComplaintCategory)
      : ("OTHER" as ComplaintCategory);
    const complaintNumber = await generateComplaintNumber(o.id);

    await prisma.complaint.create({
      data: {
        orgId: o.id,
        complaintNumber,
        category,
        channel: COMPLAINT_CHANNEL_WEB,
        jobId: safeJobId,
        clientName: c.fullName,
        clientPhone: c.phone,
        clientEmail: c.email || null,
        description,
        expectedResolution: expectedResolution || null,
      },
    });

    redirect(`/portal/complaints?submitted=${encodeURIComponent(complaintNumber)}`);
  }

  const fieldCls =
    "w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.8125rem] text-[var(--ink)] outline-none focus:border-[var(--accent)]/50";
  const labelCls = "mb-1 block text-[0.75rem] font-semibold text-[var(--ink-muted)]";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PortalHeader orgName={org.name} userName={portalUser.name} role={portalUser.role} company={companyName} active="complaints" accounts={accessibleClients} activeClientId={client.id} />

      <div className="mb-3">
        <h1 className="text-lg font-black text-[var(--ink)]">Complaints &amp; feedback</h1>
        <p className="text-[0.8125rem] text-[var(--ink-muted)]">Report an issue with a repair or our service — {org.name}&rsquo;s team will follow up.</p>
      </div>

      {submitted ? (
        <div className="mb-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-[0.8125rem] text-emerald-700 dark:text-emerald-300">
          Complaint <span className="mono font-semibold">{submitted}</span> received — we&rsquo;ll acknowledge it shortly. Track its progress below.
        </div>
      ) : null}
      {error ? (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-[0.8125rem] text-red-600 dark:text-red-400">{error}</div>
      ) : null}

      {/* Raise a complaint */}
      <div className="dc-card p-4">
        <p className="mb-3 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Raise a complaint</p>
        <form action={submitPortalComplaintAction} className="space-y-3">
          <div>
            <label className={labelCls} htmlFor="jobId">Which repair? <span className="font-normal">(optional)</span></label>
            <select id="jobId" name="jobId" defaultValue={preselectJobId} className={fieldCls}>
              <option value="">General — not about a specific repair</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.jobNumber}{[j.brand, j.model].filter(Boolean).length ? ` — ${[j.brand, j.model].filter(Boolean).join(" ")}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="category">Category</label>
            <select id="category" name="category" defaultValue="OTHER" className={fieldCls}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{COMPLAINT_CATEGORY_LABELS[c] ?? c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="description">What went wrong? <span className="text-[var(--accent)]">*</span></label>
            <textarea id="description" name="description" required rows={4} placeholder="Tell us what happened…" className={fieldCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="expectedResolution">What would put it right? <span className="font-normal">(optional)</span></label>
            <input id="expectedResolution" name="expectedResolution" placeholder="e.g. a re-do, a refund, a call back" className={fieldCls} />
          </div>
          <div className="flex justify-end">
            <SubmitButton bare pendingLabel="Submitting…" className="btn-premium rounded-lg px-4 py-2 text-[0.8125rem] text-white disabled:opacity-60">
              Submit complaint
            </SubmitButton>
          </div>
        </form>
      </div>

      {/* Their complaints */}
      <div className="mt-5">
        <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Your complaints</p>
        {complaints.length === 0 ? (
          <div className="dc-card px-4 py-8 text-center text-[0.8125rem] text-[var(--ink-muted)]">No complaints on record. We hope it stays that way.</div>
        ) : (
          <div className="dc-card divide-y divide-[var(--line)] overflow-hidden">
            {complaints.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[0.8125rem] font-semibold text-[var(--ink)]">{c.complaintNumber}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${COMPLAINT_STATUS_STYLES[c.status] ?? "bg-[var(--panel-strong)] text-[var(--ink-muted)]"}`}>
                      {COMPLAINT_STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </div>
                  <span className="text-[0.75rem] text-[var(--ink-muted)]">{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="mt-1 text-[0.75rem] text-[var(--ink-muted)]">
                  {COMPLAINT_CATEGORY_LABELS[c.category] ?? c.category}
                  {c.job ? <> · <Link href={`/portal/repairs`} className="text-[var(--accent)] hover:underline">{c.job.jobNumber}</Link></> : null}
                </p>
                <p className="mt-1 line-clamp-2 text-[0.8125rem] text-[var(--ink)]">{c.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
