import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { ExternalTechJobView } from "@/components/jobs/ExternalTechJobView";
import { JobDetailTabs } from "@/components/jobs/JobDetailTabs";
import { SendAssessmentButton } from "@/components/jobs/SendAssessmentButton";
import { MoveJobPanel } from "@/components/jobs/MoveJobPanel";
import { staffReplyRepairMessageAction } from "./portal-message-actions";
import { generateAssessmentAction, updateAssessmentAction, publishAssessmentAction, deleteAssessmentAction, setWarrantyAction } from "./assessment-actions";
import { getClientBill, getExternalTechBill } from "@/lib/billing";
import { canViewJobDocumentTimeline } from "@/lib/documents/routes";
import { loadJobDocumentTimeline } from "@/lib/jobs/job-document-timeline";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string; returnLabel?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { returnTo, returnLabel, tab } = await searchParams;
  const { session, user, orgId, org } = await requireOrgSession();
  const safeReturnTo =
    returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : "/jobs";

  const canOverseeExternal = user.permissions.includes("can_view_external_updates") || user.permissions.includes("can_view_external_quotes");
  const canAccessAllForPricing = can.approveInvoices(user);
  const where =
    user.role === "TECHNICIAN_EXTERNAL" || (user.role === "TECHNICIAN_INTERNAL" && !canOverseeExternal && !canAccessAllForPricing)
      ? { id, orgId, assignedToId: session.user.id }
      : { id, orgId };

  if (user.role === "TECHNICIAN_EXTERNAL") {
    const job = await prisma.job.findFirst({
      where,
      select: {
        id: true,
        jobNumber: true,
        status: true,
        updatedAt: true,
        clientApproved: true,
        approvalDate: true,
        deviceType: true,
        brand: true,
        model: true,
        serialOrImei: true,
        accessories: true,
        externalDiagnosis: true,
        partsNeeded: true,
        externalTechBill: true,
        repairTimeline: true,
        timelineMinMinutes: true,
        timelineMaxMinutes: true,
        timelineConfidence: true,
        timelineNote: true,
      },
    });

    if (!job) {
      notFound();
    }

    return (
      <ExternalTechJobView
        job={{
          id: job.id,
          jobNumber: job.jobNumber,
          status: job.status,
          updatedAt: job.updatedAt.toISOString(),
          clientApproved: job.clientApproved,
          approvalDate: job.approvalDate ? job.approvalDate.toISOString() : null,
          deviceType: job.deviceType,
          brand: job.brand,
          model: job.model,
          serialOrImei: job.serialOrImei,
          accessories: job.accessories,
          externalDiagnosis: job.externalDiagnosis,
          partsNeeded: job.partsNeeded,
          externalTechBill: getExternalTechBill(job),
          repairTimeline: job.repairTimeline,
          timelineMinMinutes: job.timelineMinMinutes ?? null,
          timelineMaxMinutes: job.timelineMaxMinutes ?? null,
          timelineConfidence: job.timelineConfidence ?? null,
          timelineNote: job.timelineNote ?? null,
        }}
        returnTo={safeReturnTo}
      />
    );
  }

  const supportsOneTimeExternal = Boolean(
    Prisma.dmmf.datamodel.models
      .find((model) => model.name === "Job")
      ?.fields.some((field) => field.name === "oneTimeExternalAssignment"),
  );

  const canSeeMessages = ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role);

  const includeBase = {
    client: true,
    assignedTo: true,
    photos: true,
    auditLogs: {
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" as const },
    },
  } as const;

  const includeWithOneTime = supportsOneTimeExternal
    ? ({ ...includeBase, oneTimeExternalAssignment: true } as const)
    : includeBase;

  const job = await prisma.job
    .findFirst({ where, include: includeWithOneTime })
    .catch(() => prisma.job.findFirst({ where, include: includeBase }));

  if (!job) {
    notFound();
  }

  const clientPayments = can.viewFinancials(user)
    ? await prisma.invoice.findUnique({
        where: { jobId: job.id },
        select: {
          payments: {
            select: {
              id: true,
              amount: true,
              kind: true,
              method: true,
              reference: true,
              note: true,
              receivedAt: true,
              createdBy: { select: { name: true } },
            },
            orderBy: { receivedAt: "desc" },
          },
        },
      }).then((invoice) => invoice?.payments ?? []).catch(() => [])
    : [];
  const technicianPayouts = can.reviewExternalBills(user) || user.role === "ADMIN"
    ? await prisma.technicianPayout.findMany({
        where: { orgId, jobId: job.id },
        select: {
          id: true,
          amount: true,
          method: true,
          reference: true,
          note: true,
          paidAt: true,
          recordedBy: { select: { name: true } },
        },
        orderBy: { paidAt: "desc" },
      }).catch(() => [])
    : [];

  const technicians =
    can.assignJobs(user)
      ? await prisma.user.findMany({
          where: {
            orgId,
            isActive: true,
            role: { in: [Role.TECHNICIAN_INTERNAL, Role.TECHNICIAN_EXTERNAL] },
          },
          select: { id: true, name: true, role: true },
          orderBy: [{ role: "asc" }, { name: "asc" }],
        })
      : [];

  const jobWithBilling = {
    ...job,
    externalTechBill: getExternalTechBill(job),
    clientBill: getClientBill(job),
  };

  if (!("oneTimeExternalAssignment" in jobWithBilling)) {
    (jobWithBilling as typeof jobWithBilling & { oneTimeExternalAssignment?: null }).oneTimeExternalAssignment = null;
  }

  // Device history: show other jobs for the same device when available.
  // We avoid exposing any client info here; this is only rendered for non-external roles.
  let deviceHistory: Array<{
    id: string;
    jobNumber: string;
    status: typeof job.status;
    receivedAt: Date;
    completedAt: Date | null;
    updatedAt: Date;
  }> = [];

  try {
    const deviceId = (job as typeof job & { deviceId?: string | null }).deviceId ?? null;
    const serialOrImei = (job as typeof job & { serialOrImei?: string | null }).serialOrImei ?? null;

    if (deviceId) {
      deviceHistory = await prisma.job.findMany({
        where: { deviceId, id: { not: job.id } },
        orderBy: { receivedAt: "desc" },
        take: 10,
        select: { id: true, jobNumber: true, status: true, receivedAt: true, completedAt: true, updatedAt: true },
      });
    } else if (serialOrImei) {
      deviceHistory = await prisma.job.findMany({
        where: { clientId: job.clientId, serialOrImei, id: { not: job.id } },
        orderBy: { receivedAt: "desc" },
        take: 10,
        select: { id: true, jobNumber: true, status: true, receivedAt: true, completedAt: true, updatedAt: true },
      });
    }
  } catch {
    deviceHistory = [];
  }

  type OutboundRow = {
    id: string; to: string; body: string; type: string;
    sentAt: Date | null; createdAt: Date; providerDeliveryStatus: string | null;
  };
  type InboundRow = {
    id: string; from: string; body: string | null; mediaType: string | null;
    mediaCaption: string | null; timestamp: Date; isRead: boolean;
  };

  let outboundMessages: OutboundRow[] = [];
  let inboundMessages: InboundRow[] = [];

  if (canSeeMessages) {
    const msgSelect = {
      id: true, to: true, body: true, type: true,
      sentAt: true, createdAt: true, providerDeliveryStatus: true,
    } as const;

    // Messages linked directly to the job
    const [jobOutbound, linkedRequest] = await Promise.all([
      prisma.outboundMessage.findMany({
        where: { jobId: job.id },
        orderBy: { createdAt: "asc" },
        select: msgSelect,
      }),
      prisma.repairRequest.findFirst({
        where: { linkedJobId: job.id },
        select: { id: true },
      }).catch(() => null),
    ]);

    // Messages sent during the repair request phase (before job creation)
    const requestOutbound = linkedRequest
      ? await prisma.outboundMessage.findMany({
          where: { repairRequestId: linkedRequest.id },
          orderBy: { createdAt: "asc" },
          select: msgSelect,
        })
      : [];

    // Deduplicate by id and sort chronologically
    const seen = new Set<string>();
    outboundMessages = [...jobOutbound, ...requestOutbound]
      .filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    inboundMessages = await prisma.inboundMessage.findMany({
      where: { jobId: job.id },
      orderBy: { timestamp: "asc" },
      select: {
        id: true, from: true, body: true, mediaType: true,
        mediaCaption: true, timestamp: true, isRead: true,
      },
    }).catch(() => []);
  }

  const documentTimeline = canViewJobDocumentTimeline(user)
    ? await loadJobDocumentTimeline({
        orgId,
        jobId: job.id,
        jobNumber: job.jobNumber,
        receivedAt: job.receivedAt,
      }).catch(() => [])
    : [];

  const portalMessages = await prisma.repairMessage.findMany({
    where: { orgId, jobId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, authorType: true, authorName: true, body: true, createdAt: true },
  }).catch(() => []);

  const [assessments, warrantyInfo] = await Promise.all([
    prisma.diagnosisReport.findMany({
      where: { orgId, jobId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, visibility: true, summary: true, findings: true, recommendedWork: true, riskNotes: true },
    }).catch(() => []),
    prisma.job.findFirst({ where: { id, orgId }, select: { warrantyMonths: true, warrantyExpiresAt: true, diagnosisNotes: true, externalDiagnosis: true, recommendedRepair: true, workDone: true } }),
  ]);
  // The assessment report needs diagnosis + repair details first (parts optional).
  // Each may live in more than one field depending on the workflow.
  const canAssess =
    Boolean(((warrantyInfo?.diagnosisNotes ?? "") + (warrantyInfo?.externalDiagnosis ?? "")).trim())
    && Boolean(((warrantyInfo?.recommendedRepair ?? "") + (warrantyInfo?.workDone ?? "")).trim());
  const ta = "w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50";

  // ADMIN/OPS can move this job to a different client account (e.g. sort a
  // C-Care job that belongs to IMC but was booked under IHK).
  const canMoveJob = ["ADMIN", "OPS"].includes(user.role);
  const moveCandidates = canMoveJob
    ? await prisma.client.findMany({
        where: { orgId, id: { not: job.clientId } },
        select: { id: true, fullName: true, phone: true, organization: true },
        orderBy: [{ organization: "asc" }, { fullName: "asc" }],
        take: 500,
      }).catch(() => [])
    : [];

  const movePanel = canMoveJob && moveCandidates.length > 0 ? (
    <div className="flex justify-end">
      <MoveJobPanel jobId={job.id} currentClientName={job.client?.fullName ?? "this account"} candidates={moveCandidates} />
    </div>
  ) : null;

  // Client portal thread — visible to staff; two-way with the customer's portal.
  const portalPanel = portalMessages.length > 0 ? (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
      <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Client Portal Messages</p>
      <ul className="mb-3 space-y-2">
        {portalMessages.map((m) => {
          const staff = m.authorType === "STAFF";
          return (
            <li key={m.id} className={`flex flex-col ${staff ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[0.8125rem] ${staff ? "bg-[var(--accent)]/15 text-[var(--ink)]" : "bg-[var(--panel-strong)] text-[var(--ink)]"}`}>{m.body}</div>
              <span className="mt-0.5 text-[0.6875rem] text-[var(--ink-muted)]">{staff ? m.authorName : `${m.authorName} (client)`} · {m.createdAt.toISOString().slice(0, 10)}</span>
            </li>
          );
        })}
      </ul>
      <form action={staffReplyRepairMessageAction} className="flex gap-2">
        <input type="hidden" name="jobId" value={id} />
        <input name="body" required maxLength={4000} placeholder="Reply to the client…" className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50" />
        <button type="submit" className="btn-premium rounded-lg px-3 py-2 text-[0.8125rem] text-white">Reply</button>
      </form>
    </div>
  ) : null;

  // Assessment report (AI-drafted, staff-reviewed) + warranty — surfaced to the client portal.
  const assessmentPanel = (
    <div className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.75rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Assessment Report</p>
          <div className="flex items-center gap-2">
            {assessments.length > 0 && canAssess ? (
              <a href={`/api/jobs/${id}/assessment-pdf`} target="_blank" rel="noopener" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.75rem] font-semibold hover:bg-[var(--panel-strong)]">↓ Download PDF</a>
            ) : null}
            {assessments.some((r) => r.visibility !== "INTERNAL") && canAssess && (job.client?.phone || job.client?.email) ? (
              <SendAssessmentButton jobId={id} hasPhone={Boolean(job.client?.phone)} hasEmail={Boolean(job.client?.email)} />
            ) : null}
            {canAssess ? (
              <form action={generateAssessmentAction}>
                <input type="hidden" name="jobId" value={id} />
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1.5 text-[0.75rem] font-semibold text-[var(--accent)]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden><path d="M12 3l1.6 4.9L18.5 9.5l-4.9 1.6L12 16l-1.6-4.9L5.5 9.5l4.9-1.6L12 3Z"/></svg>Generate AI draft</button>
              </form>
            ) : (
              <button type="button" disabled title="Add the diagnosis and repair details first" className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.75rem] font-semibold text-[var(--ink-muted)] opacity-60"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden><path d="M12 3l1.6 4.9L18.5 9.5l-4.9 1.6L12 16l-1.6-4.9L5.5 9.5l4.9-1.6L12 3Z"/></svg>Generate AI draft</button>
            )}
          </div>
        </div>
        {!canAssess ? (
          <p className="text-[0.8125rem] text-[var(--ink-muted)]">Complete the <span className="font-semibold">diagnosis</span> and <span className="font-semibold">repair details</span> first (parts optional). The report can then be generated and downloaded.</p>
        ) : assessments.length === 0 ? (
          <p className="text-[0.8125rem] text-[var(--ink-muted)]">No assessment yet. Generate an AI draft (or a blank report if AI is off), edit it, then publish it to the client.</p>
        ) : (
          assessments.map((r) => {
            const visible = r.visibility !== "INTERNAL";
            return (
              <div key={r.id} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)]/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-bold ${visible ? "bg-emerald-500/15 text-emerald-600" : "bg-[var(--panel-strong)] text-[var(--ink-muted)]"}`}>{visible ? "Visible to client" : "Internal draft"}</span>
                  <div className="flex gap-2">
                    <form action={publishAssessmentAction}>
                      <input type="hidden" name="reportId" value={r.id} />
                      <input type="hidden" name="jobId" value={id} />
                      <input type="hidden" name="visible" value={String(!visible)} />
                      <button type="submit" className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[0.75rem] font-semibold hover:bg-[var(--panel-strong)]">{visible ? "Unpublish" : "Publish to client"}</button>
                    </form>
                    <form action={deleteAssessmentAction}>
                      <input type="hidden" name="reportId" value={r.id} />
                      <input type="hidden" name="jobId" value={id} />
                      <button type="submit" className="rounded-lg border border-red-400/40 px-2.5 py-1 text-[0.75rem] font-semibold text-red-500 hover:bg-red-500/10">Delete</button>
                    </form>
                  </div>
                </div>
                <form action={updateAssessmentAction} className="space-y-2">
                  <input type="hidden" name="reportId" value={r.id} />
                  <input type="hidden" name="jobId" value={id} />
                  <input name="summary" defaultValue={r.summary} placeholder="Summary" className={ta} />
                  <textarea name="findings" defaultValue={r.findings ?? ""} rows={2} placeholder="Inspection findings" className={ta} />
                  <textarea name="recommendedWork" defaultValue={r.recommendedWork ?? ""} rows={2} placeholder="Recommended / completed work" className={ta} />
                  <textarea name="riskNotes" defaultValue={r.riskNotes ?? ""} rows={2} placeholder="Notes / recommendations" className={ta} />
                  <button type="submit" className="btn-premium rounded-lg px-3 py-1.5 text-[0.75rem] text-white">Save report</button>
                </form>
              </div>
            );
          })
        )}

        <div className="border-t border-[var(--line)] pt-3">
          <p className="mb-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Warranty</p>
          <p className="mb-2 text-[0.8125rem] text-[var(--ink-muted)]">
            {warrantyInfo?.warrantyExpiresAt
              ? `Covered for ${warrantyInfo.warrantyMonths} month${warrantyInfo.warrantyMonths === 1 ? "" : "s"} — until ${warrantyInfo.warrantyExpiresAt.toISOString().slice(0, 10)}.`
              : "No warranty set."}
          </p>
          <form action={setWarrantyAction} className="flex items-center gap-2">
            <input type="hidden" name="jobId" value={id} />
            <input name="months" type="number" min={0} max={60} defaultValue={warrantyInfo?.warrantyMonths ?? 0} className="w-24 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]" />
            <span className="text-[0.8125rem] text-[var(--ink-muted)]">months</span>
            <button type="submit" className="btn-premium rounded-lg px-3 py-1.5 text-[0.75rem] text-white">Set warranty</button>
          </form>
        </div>
      </div>
  );

  return (
    <JobDetailTabs
      role={user.role}
      permissions={user.permissions}
      orgBaseCurrency={org.baseCurrency}
      supportedCurrencies={org.supportedCurrencies}
      job={{ ...jobWithBilling, outboundMessages, inboundMessages, clientPayments, technicianPayouts }}
      technicians={technicians}
      deviceHistory={deviceHistory}
      returnTo={safeReturnTo}
      returnLabel={returnLabel}
      initialTab={tab}
      documentTimeline={documentTimeline}
      assessmentSlot={assessmentPanel}
      moveSlot={movePanel}
      portalSlot={portalPanel}
    />
  );
}
