import { notFound, redirect } from "next/navigation";
import { LeadStatus } from "@prisma/client";

import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { formatEATDate, formatEATDateTime } from "@/lib/date-eat";
import { formatMoney, getAppCurrency } from "@/lib/currency";
import { Button, buttonClasses } from "@/components/ui/Button";
import { DisclosureProvider, DisclosureTrigger, DisclosurePanel, DisclosureClose } from "@/components/shared/DisclosureRegion";
import { toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import { RecordActionBar } from "@/components/record/RecordActionBar";
import { RecordSummaryRail } from "@/components/record/RecordSummaryRail";
import { updateLeadStatus, addLeadActivity, updateLeadDetails } from "../../actions";

import { SubmitButton } from "@/components/ui/SubmitButton";
const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL_SENT: "Proposal Sent",
  WON: "Won",
  LOST: "Lost",
  STALE: "Stale",
};

const LEAD_STATUS_TONES: Record<string, BadgeTone> = {
  NEW:           "info",
  CONTACTED:     "purple",
  QUALIFIED:     "warning",
  PROPOSAL_SENT: "orange",
  WON:           "success",
  LOST:          "danger",
  STALE:         "neutral",
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  CALL: "Call",
  NOTE: "Note",
  EMAIL: "Email",
  MEETING: "Meeting",
  STATUS_CHANGE: "Status Change",
};

type SearchParams = {
  statusError?: string;
  activityError?: string;
  editError?: string;
};

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const filters = await searchParams;
  const { user, orgId } = await requireOrgSession();

  if (!can.createLeads(user) && !can.viewAllSales(user)) {
    redirect("/dashboard");
  }

  const lead = await prisma.lead.findFirst({
    where: { id, orgId },
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      activities: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      quotations: {
        select: { id: true, quoteNumber: true, status: true, totalAmount: true, currency: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  }).catch(() => null);

  if (!lead) notFound();
  if (!can.viewAllSales(user) && lead.assignedToId !== user.id && lead.createdById !== user.id) redirect("/sales");

  const canEdit = can.createLeads(user);
  const currency = getAppCurrency();

  const orgUsers = can.viewAllSales(user)
    ? await prisma.user.findMany({
        where: { orgId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }).catch(() => [])
    : [];

  async function updateStatusAction(formData: FormData) {
    "use server";
    const status = String(formData.get("status") ?? "") as LeadStatus;
    const note = String(formData.get("note") ?? "") || undefined;
    const validStatuses: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "WON", "LOST", "STALE"];
    if (!validStatuses.includes(status)) {
      redirect(`/sales/leads/${id}?statusError=${encodeURIComponent("Invalid status")}`);
    }
    try {
      await updateLeadStatus(id, status, note);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update status";
      redirect(`/sales/leads/${id}?statusError=${encodeURIComponent(msg)}`);
    }
  }

  async function updateLeadDetailsAction(formData: FormData) {
    "use server";
    try {
      await updateLeadDetails(id, {
        fullName: String(formData.get("fullName") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        email: String(formData.get("email") ?? ""),
        organization: String(formData.get("organization") ?? ""),
        interest: String(formData.get("interest") ?? ""),
        source: String(formData.get("source") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        estimatedValue: Number(formData.get("estimatedValue") || 0) || undefined,
        followUpAt: String(formData.get("followUpAt") ?? ""),
        assignedToId: String(formData.get("assignedToId") ?? "") || undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update lead";
      redirect(`/sales/leads/${id}?editError=${encodeURIComponent(msg)}`);
    }
    redirect(`/sales/leads/${id}`);
  }

  async function addActivityAction(formData: FormData) {
    "use server";
    const type = String(formData.get("type") ?? "NOTE");
    const note = String(formData.get("note") ?? "");
    if (!note.trim()) {
      redirect(`/sales/leads/${id}?activityError=${encodeURIComponent("Note is required")}`);
    }
    try {
      await addLeadActivity(id, { type, note });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add activity";
      redirect(`/sales/leads/${id}?activityError=${encodeURIComponent(msg)}`);
    }
    redirect(`/sales/leads/${id}`);
  }

  const isTerminal = ["WON", "LOST", "STALE"].includes(lead.status);
  const isOverdue = lead.followUpAt != null && lead.followUpAt <= new Date() && !isTerminal;
  const quotedTotal = lead.quotations.reduce((sum, q) => sum + q.totalAmount, 0);

  const field =
    "w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none transition placeholder:text-[var(--ink-muted)]/60 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15";
  const cardLabel = "text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70";
  const errorBox = "mb-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400";

  return (
    <DisclosureProvider defaultOpen={Boolean(filters.editError)}>
    <div className="space-y-4 pb-24 lg:pb-8">
      <RecordActionBar
        backHref="/sales"
        eyebrow="Sales · Lead"
        title={lead.fullName}
        status={{ label: LEAD_STATUS_LABELS[lead.status], tone: toneFor(LEAD_STATUS_TONES, lead.status) }}
        secondary={
          <>
            {can.createQuotations(user) ? (
              <Button href={`/sales/quotations/new?leadId=${lead.id}`} variant="secondary" size="sm">New Quotation</Button>
            ) : null}
            {canEdit ? (
              <DisclosureTrigger
                className={buttonClasses("secondary", "sm")}
                openClassName={buttonClasses("ghost", "sm")}
                label="Edit"
                openLabel="Close"
              />
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          {/* ── Stage update ── */}
          {canEdit ? (
            <section className="dc-card overflow-hidden">
              <div className="border-b border-[var(--line)] px-4 py-2.5"><p className={cardLabel}>Stage</p></div>
              <form action={updateStatusAction} className="p-3">
                {filters.statusError ? <p className={errorBox}>{filters.statusError}</p> : null}
                <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)_auto]">
                  <select name="status" defaultValue={lead.status} aria-label="Stage" className={field}>
                    {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => (
                      <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <input name="note" placeholder="Optional note" className={field} />
                  <SubmitButton variant="secondary" size="sm">Update Stage</SubmitButton>
                </div>
              </form>
            </section>
          ) : null}

          {/* ── Edit details (opened from the action bar) ── */}
          {canEdit ? (
            <DisclosurePanel>
            <section className="dc-card overflow-hidden">
              <div className="border-b border-[var(--line)] px-4 py-2.5">
                <p className={cardLabel}>Edit Lead</p>
              </div>
              <form action={updateLeadDetailsAction} className="p-3">
                {filters.editError ? <p className={errorBox}>{filters.editError}</p> : null}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <input name="fullName" required defaultValue={lead.fullName} placeholder="Full name *" aria-label="Full name" className={field} />
                  <input name="phone" required defaultValue={lead.phone} placeholder="Phone *" aria-label="Phone" className={field} />
                  <input name="email" type="email" defaultValue={lead.email ?? ""} placeholder="Email" aria-label="Email" className={field} />
                  <input name="organization" defaultValue={lead.organization ?? ""} placeholder="Organization" aria-label="Organization" className={field} />
                  <select name="source" defaultValue={lead.source} aria-label="Source" className={field}>
                    <option value="WALK_IN">Walk-in</option>
                    <option value="REFERRAL">Referral</option>
                    <option value="PHONE">Phone</option>
                    <option value="SOCIAL_MEDIA">Social media</option>
                    <option value="WEBSITE">Website</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <input name="estimatedValue" type="number" min="0" step="1" defaultValue={lead.estimatedValue ?? ""} placeholder={`Est. value (${currency})`} aria-label="Estimated value" className={field} />
                  <input name="followUpAt" type="date" defaultValue={lead.followUpAt ? lead.followUpAt.toISOString().slice(0, 10) : ""} aria-label="Follow-up date" className={field} />
                  {orgUsers.length > 0 ? (
                    <select name="assignedToId" defaultValue={lead.assignedToId ?? ""} aria-label="Assigned to" className={field}>
                      <option value="">Unassigned</option>
                      {orgUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  ) : null}
                  <input name="interest" defaultValue={lead.interest ?? ""} placeholder="Interest / product" aria-label="Interest" className={field} />
                  <textarea name="notes" rows={2} defaultValue={lead.notes ?? ""} placeholder="Notes" aria-label="Notes" className={`${field} sm:col-span-2 lg:col-span-3`} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <SubmitButton size="sm" className="px-4 font-bold">Save Lead</SubmitButton>
                  <DisclosureClose className="text-xs font-medium text-[var(--ink-muted)] underline-offset-2 hover:underline">Cancel</DisclosureClose>
                </div>
              </form>
            </section>
            </DisclosurePanel>
          ) : null}

          {/* ── Interest / Notes ── */}
          {lead.interest || lead.notes ? (
            <section className="dc-card overflow-hidden">
              <div className="space-y-1 px-4 py-3 text-[0.8125rem]">
                {lead.interest ? (
                  <p className="text-[var(--ink-muted)]"><span className="font-semibold text-[var(--ink)]">Interest</span> · {lead.interest}</p>
                ) : null}
                {lead.notes ? (
                  <p className="text-[var(--ink-muted)] [overflow-wrap:anywhere]"><span className="font-semibold text-[var(--ink)]">Notes</span> · {lead.notes}</p>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* ── Activity ── */}
          <section className="dc-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
              <p className={cardLabel}>Activity</p>
              <p className="text-[0.75rem] text-[var(--ink-muted)]">
                {lead.activities.length} entr{lead.activities.length === 1 ? "y" : "ies"}
              </p>
            </div>

            {canEdit ? (
              <form action={addActivityAction} className="border-b border-[var(--line)] bg-[var(--panel-strong)]/40 p-3">
                {filters.activityError ? <p className={errorBox}>{filters.activityError}</p> : null}
                <div className="grid gap-2 md:grid-cols-[140px_minmax(0,1fr)_auto]">
                  <select name="type" aria-label="Activity type" className={field}>
                    <option value="NOTE">Note</option>
                    <option value="CALL">Call</option>
                    <option value="EMAIL">Email</option>
                    <option value="MEETING">Meeting</option>
                  </select>
                  <input name="note" required placeholder="Activity note" className={field} />
                  <SubmitButton variant="secondary" size="sm">Add</SubmitButton>
                </div>
              </form>
            ) : null}

            {lead.activities.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-[var(--ink-muted)]">No activity yet</p>
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {lead.activities.map((activity) => (
                  <div key={activity.id} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[0.8125rem] font-semibold text-[var(--ink)]">
                        {ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type}
                        <span className="ml-1.5 font-normal text-[var(--ink-muted)]">{activity.user.name}</span>
                      </p>
                      <p className="shrink-0 text-[0.75rem] text-[var(--ink-muted)]/60">{formatEATDateTime(activity.createdAt)}</p>
                    </div>
                    {activity.note ? <p className="mt-0.5 text-[0.8125rem] text-[var(--ink-muted)] [overflow-wrap:anywhere]">{activity.note}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Summary rail ── */}
        <RecordSummaryRail
          headline={{ label: "Estimated Value", value: lead.estimatedValue != null ? formatMoney(lead.estimatedValue, currency) : "—" }}
          rows={[
            { label: "Quoted", value: quotedTotal > 0 ? formatMoney(quotedTotal, currency) : "—" },
            {
              label: "Follow-up",
              value: (
                <span className={isOverdue ? "text-amber-600" : undefined}>
                  {lead.followUpAt ? formatEATDate(lead.followUpAt) : "None"}{isOverdue ? " · overdue" : ""}
                </span>
              ),
            },
            { label: "Activities", value: lead.activities.length },
            { label: "Source", value: lead.source.replace(/_/g, " ").toLowerCase() },
            { label: "Assigned", value: lead.assignedTo?.name ?? "Unassigned" },
            { label: "Created", value: `${formatEATDate(lead.createdAt)}${lead.createdBy?.name ? ` · ${lead.createdBy.name}` : ""}` },
          ]}
          party={{ title: "Lead contact", name: lead.fullName, org: lead.organization, lines: [lead.phone, lead.email] }}
          related={lead.quotations.map((q) => ({
            label: q.quoteNumber,
            href: `/sales/quotations/${q.id}`,
            sub: `${formatMoney(q.totalAmount, q.currency)} · ${q.status}`,
          }))}
        />
      </div>
    </div>
    </DisclosureProvider>
  );
}
