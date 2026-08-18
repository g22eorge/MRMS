import Link from "next/link";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { SearchToggle } from "@/components/shared/SearchToggle";
import { JobStatusBadge, statusStripClass } from "@/components/jobs/JobStatusBadge";
import { UI_JOB_STATUSES, JobStatus, normalizeJobStatus } from "@/lib/job-status";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/currency";
import { getClientStatement } from "@/lib/commercial/statements";
import { shareStatementDocument } from "@/lib/notifications/share-document";
import { createPortalUserAction, togglePortalUserAction, linkPortalUserToClientAction, unlinkPortalUserFromClientAction } from "./portal-actions";
import { MergeClientPanel } from "@/components/clients/MergeClientPanel";
import { ClientProfileCard } from "@/components/clients/ClientProfileCard";
import { sanitizeOptionalText, sanitizeText } from "@/lib/sanitize";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import { formatEATDate, formatEATDateTime } from "@/lib/date-eat";
import { formatPhoneDisplay } from "@/lib/phone";
import { RecordActionBar } from "@/components/record/RecordActionBar";
import { RecordSummaryRail, type SummaryRow } from "@/components/record/RecordSummaryRail";

const updateClientSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(4, "Enter a valid phone number"),
  email: z.string().optional(),
  organization: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export type UpdateClientState = { ok: boolean; error: string | null };

const addNoteSchema = z.object({
  body: z.string().min(2),
});

const statusOptionLabel: Record<ReturnType<typeof normalizeJobStatus>, string> = {
  RECEIVED: "Received",
  DIAGNOSING: "Diagnosing",
  REFERRED: "Referred",
  AWAITING_APPROVAL: "Awaiting Approval",
  IN_REPAIR: "In Repair",
  READY_FOR_PICKUP: "Ready for Pickup",
  COMPLETED: "Completed",
  CLOSED: "Closed",
};

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { id } = await params;
  const filters = await searchParams;
  const { user, orgId, org } = await requireOrgSession();
  const canEdit = user.role === "ADMIN" || user.role === "OPS";
  const canSeeFinancials = can.viewFinancials(user);

  if (!can.viewClientInfo(user)) {
    redirect("/dashboard");
  }

  let notesFeatureAvailable = true;
  let clientData: Awaited<ReturnType<typeof prisma.client.findUnique>>;

  try {
    clientData = await prisma.client.findUnique({
      where: { id, orgId },
      include: {
        jobs: {
          where: {
            ...(filters.status ? { status: filters.status as JobStatus } : {}),
            ...(filters.q
              ? {
                  OR: [
                    { jobNumber: { contains: filters.q } },
                    { brand: { contains: filters.q } },
                    { model: { contains: filters.q } },
                  ],
                }
              : {}),
          },
          orderBy: { receivedAt: "desc" },
          take: 25,
        },
        notesEntries: {
          include: { author: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  } catch {
    notesFeatureAvailable = false;
    clientData = await prisma.client.findUnique({
      where: { id, orgId },
      include: {
        jobs: {
          where: {
            ...(filters.status ? { status: filters.status as JobStatus } : {}),
            ...(filters.q
              ? {
                  OR: [
                    { jobNumber: { contains: filters.q } },
                    { brand: { contains: filters.q } },
                    { model: { contains: filters.q } },
                  ],
                }
              : {}),
          },
          orderBy: { receivedAt: "desc" },
          take: 25,
        },
      },
    });
  }

  if (!clientData) {
    notFound();
  }

  type ClientDetail = Prisma.ClientGetPayload<{
    include: {
      jobs: true;
      notesEntries: { include: { author: { select: { name: true } } } };
    };
  }>;

  const client = {
    ...(clientData as ClientDetail),
    notesEntries: notesFeatureAvailable ? (clientData as ClientDetail).notesEntries : [],
  } as ClientDetail;

  // M20: statement of account (receivables) — only for finance-capable roles.
  const statement = canSeeFinancials ? await getClientStatement(orgId, id, org.baseCurrency) : null;

  // Portal access (Phase 4): corporate-client logins this shop has provisioned.
  const portalUsers = canEdit
    ? await prisma.portalUser.findMany({
        where: { orgId, clientId: id },
        select: {
          id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true,
          linkedClients: { select: { client: { select: { id: true, fullName: true, organization: true } } } },
        },
        orderBy: { createdAt: "asc" },
      }).catch(() => [])
    : [];

  // De-duplication: ADMINs can merge this client into another (moves every
  // linked record, then removes this one). Candidates = the org's other clients.
  const isAdmin = user.role === "ADMIN";
  const mergeCandidates = isAdmin
    ? await prisma.client.findMany({
        where: { orgId, id: { not: id } },
        select: { id: true, fullName: true, phone: true, organization: true },
        orderBy: [{ organization: "asc" }, { fullName: "asc" }],
        take: 500,
      }).catch(() => [])
    : [];

  async function updateClient(_prev: UpdateClientState, formData: FormData): Promise<UpdateClientState> {
    "use server";
    const { user: currentUser, orgId: updateOrgId, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: currentUser.role, userAccessMode: currentUser.accessMode, kind: "GENERAL" });
    if (!(currentUser.role === "ADMIN" || currentUser.role === "OPS")) {
      return { ok: false, error: "You do not have permission to edit clients." };
    }

    const parsed = updateClientSchema.safeParse({
      fullName: String(formData.get("fullName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      organization: String(formData.get("organization") ?? ""),
      address: String(formData.get("address") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the details and try again." };
    }

    try {
      await prisma.client.update({
        where: { id, orgId: updateOrgId },
        data: {
          fullName: sanitizeText(parsed.data.fullName),
          phone: sanitizeText(parsed.data.phone),
          email: sanitizeOptionalText(parsed.data.email),
          organization: sanitizeOptionalText(parsed.data.organization),
          address: sanitizeOptionalText(parsed.data.address),
          notes: sanitizeOptionalText(parsed.data.notes),
        },
      });
    } catch (err) {
      // phone is unique per org (phone_orgId) — surface a friendly conflict.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { ok: false, error: "Another client in your organisation already uses that phone number." };
      }
      throw err;
    }

    revalidatePath(`/clients/${id}`);
    return { ok: true, error: null };
  }

  async function sendStatementAction(formData: FormData) {
    "use server";
    const { user: currentUser, orgId: sendOrgId, org: sendOrg } = await requireOrgSession();
    // Chasing what you are owed stays available on a suspended workspace, same
    // rule as capturing a payment or sending an invoice.
    assertOrgCanMutate({ access: sendOrg.access, userRole: currentUser.role, userAccessMode: currentUser.accessMode, kind: "PAYMENT" });
    if (!can.viewFinancials(currentUser)) return;

    const channel = String(formData.get("channel") ?? "") === "email" ? "email" : "whatsapp";
    await shareStatementDocument({ orgId: sendOrgId, clientId: id, channel, baseCurrency: sendOrg.baseCurrency });
    revalidatePath(`/clients/${id}`);
  }

  async function addClientNote(formData: FormData) {
    "use server";
    const { session, user: currentUser, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: currentUser.role, userAccessMode: currentUser.accessMode, kind: "GENERAL" });
    if (!(currentUser.role === "ADMIN" || currentUser.role === "OPS")) {
      return;
    }

    const parsed = addNoteSchema.safeParse({
      body: String(formData.get("body") ?? ""),
    });
    if (!parsed.success) return;

    if (!notesFeatureAvailable) return;

    await prisma.clientNote.create({
      data: {
        clientId: id,
        authorId: session.user.id,
        body: sanitizeText(parsed.data.body),
      },
    });
    revalidatePath(`/clients/${id}`);
  }

  const DONE_STATUSES = ["COMPLETED", "CLOSED", "DELIVERED"];

  // Counted across every job of this client, not from `client.jobs` — that list
  // is capped at 25 and honours the page's status/search filters, so deriving
  // the summary from it understated a busy client and moved as you filtered.
  const [totalJobs, completedJobs] = await Promise.all([
    prisma.job.count({ where: { orgId, clientId: id } }),
    prisma.job.count({ where: { orgId, clientId: id, status: { in: DONE_STATUSES as JobStatus[] } } }),
  ]);
  const openJobs = totalJobs - completedJobs;
  const completionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

  // Work delivered but never billed. The statement only counts invoices and POS
  // sales, so a client whose finished jobs were never invoiced reads as
  // "Billed 0 / Outstanding 0" however much work was done for them. This
  // surfaces that gap without creating any document.
  //
  // Aggregated over every job of this client, not `client.jobs` — that list is
  // capped at 25 and honours the page's status/search filters, so a money total
  // derived from it would change as the user filters.
  // `clientBill` is the client-facing amount (DB column finalCost).
  const uninvoicedWork = canSeeFinancials
    ? (
        await prisma.job.aggregate({
          where: {
            orgId,
            clientId: id,
            status: { in: DONE_STATUSES as JobStatus[] },
            invoice: { is: null },
          },
          _sum: { clientBill: true },
        })
      )._sum.clientBill ?? 0
    : 0;

  // Likewise filter-independent: the most recent job touch for this client,
  // falling back to the client record itself when they have no jobs.
  const lastTouchedJob = await prisma.job.findFirst({
    where: { orgId, clientId: id },
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });
  const latestActivity = lastTouchedJob?.updatedAt ?? client.updatedAt;
  const hasHistoryFilters = Boolean(filters.q || filters.status);
  // Only worth a banner when the job list is filtered; otherwise the page speaks
  // for itself — no filler "client workspace" prose.
  const clientBrief = hasHistoryFilters
    ? "Showing filtered jobs. Clear the filters to see all of this client's repairs."
    : null;

  return (
    <div className="space-y-4">
      <RecordActionBar
        backHref="/clients"
        eyebrow="Clients"
        title={client.fullName}
        secondary={canEdit ? (
          <Link href="/jobs/new" className="btn-premium shrink-0 rounded-lg px-3 py-1.5 text-[0.75rem]">+ New Repair</Link>
        ) : undefined}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-5">
          {clientBrief ? (
            <div className="dc-card overflow-hidden">
              <div className="border-b border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3">
                <p className="text-sm text-[var(--ink)] [overflow-wrap:anywhere]">{clientBrief}</p>
              </div>
            </div>
          ) : null}

      <ClientProfileCard
        client={{
          fullName: client.fullName,
          phone: client.phone,
          email: client.email,
          organization: client.organization,
          address: client.address,
          notes: client.notes,
        }}
        canEdit={canEdit}
        action={updateClient}
      />

      {statement ? (
        <div className="dc-card px-3 py-2.5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Statement of Account</p>
              {/* Same document the customer downloads from the portal. */}
              <a
                href={`/api/clients/${id}/statement`}
                className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[0.75rem] font-semibold text-[var(--accent)] hover:bg-[var(--panel-strong)]"
              >
                PDF
              </a>
              {/* Sends a portal link, not an /api PDF path — those need a staff
                  session, so a customer clicking one only reaches a login page. */}
              {client.phone ? (
                <form action={sendStatementAction}>
                  <input type="hidden" name="channel" value="whatsapp" />
                  <button className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[0.75rem] font-semibold text-[var(--ink-muted)] hover:bg-[var(--panel-strong)]">
                    Send WhatsApp
                  </button>
                </form>
              ) : null}
              {client.email ? (
                <form action={sendStatementAction}>
                  <input type="hidden" name="channel" value="email" />
                  <button className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[0.75rem] font-semibold text-[var(--ink-muted)] hover:bg-[var(--panel-strong)]">
                    Send email
                  </button>
                </form>
              ) : null}
            </div>
            <div className="flex items-center gap-4 text-[0.8125rem]">
              <span className="text-[var(--ink-muted)]">Billed <span className="font-semibold text-[var(--ink)] tabular-nums">{formatMoney(statement.totals.billed, statement.currency)}</span></span>
              <span className="text-[var(--ink-muted)]">Paid <span className="font-semibold text-emerald-600 tabular-nums">{formatMoney(statement.totals.paid, statement.currency)}</span></span>
              <span className="text-[var(--ink-muted)]">Outstanding <span className={`font-black tabular-nums ${statement.totals.outstanding > 0 ? "text-red-500" : "text-emerald-600"}`}>{formatMoney(statement.totals.outstanding, statement.currency)}</span></span>
            </div>
          </div>
          {statement.lines.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No billed documents yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
              <table className="w-full min-w-[520px] text-[0.8125rem]">
                <thead>
                  <tr className="border-b border-[var(--line)] text-[0.6875rem] uppercase tracking-wide text-[var(--ink-muted)]">
                    <th className="px-3 py-2 text-left font-bold">Document</th>
                    <th className="px-3 py-2 text-left font-bold">Date</th>
                    <th className="px-3 py-2 text-right font-bold">Billed</th>
                    <th className="px-3 py-2 text-right font-bold">Paid</th>
                    <th className="px-3 py-2 text-right font-bold">Balance</th>
                    <th className="px-3 py-2 text-right font-bold">Running balance</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.lines.map((l) => (
                    <tr key={`${l.type}-${l.number}`} className="border-b border-[var(--line)]/60 last:border-0">
                      <td className="px-3 py-2">
                        <span className="mr-2 rounded bg-[var(--panel-strong)] px-1.5 py-0.5 text-[0.625rem] font-bold uppercase text-[var(--ink-muted)]">{l.type}</span>
                        <span className="mono text-[var(--ink)]">{l.number}</span>
                      </td>
                      <td className="px-3 py-2 text-[var(--ink-muted)]">{l.date.toISOString().slice(0, 10)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(l.billed, statement.currency)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{l.paid ? formatMoney(l.paid, statement.currency) : "—"}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${l.balance > 0 ? "text-red-500" : "text-[var(--ink-muted)]"}`}>{formatMoney(l.balance, statement.currency)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatMoney(l.running, statement.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {canEdit ? (
        <div className="dc-card px-3 py-2.5">
          <div className="mb-3">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Portal Access</p>
          </div>

          {portalUsers.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {portalUsers.map((pu) => (
                <div key={pu.id} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)]/40 px-3 py-2 text-[0.8125rem]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-[var(--ink)]">{pu.name}</span>
                      <span className="ml-1.5 text-[var(--ink-muted)]">· {pu.email} · {pu.role.replaceAll("_", " ")}</span>
                      {!pu.isActive && <span className="ml-1.5 rounded bg-red-500/10 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-red-500">revoked</span>}
                    </div>
                    <form action={togglePortalUserAction}>
                      <input type="hidden" name="portalUserId" value={pu.id} />
                      <input type="hidden" name="clientId" value={client.id} />
                      <button type="submit" className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[0.75rem] font-semibold hover:bg-[var(--panel-strong)]">
                        {pu.isActive ? "Revoke" : "Restore"}
                      </button>
                    </form>
                  </div>
                  {/* Multi-account: this login also manages these client accounts. */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--ink-muted)]/80">Also manages</span>
                    {pu.linkedClients.length === 0 ? (
                      <span className="text-[0.75rem] text-[var(--ink-muted)]">— this account only</span>
                    ) : (
                      pu.linkedClients.map((l) => (
                        <form key={l.client.id} action={unlinkPortalUserFromClientAction} className="inline-flex">
                          <input type="hidden" name="portalUserId" value={pu.id} />
                          <input type="hidden" name="clientId" value={l.client.id} />
                          <input type="hidden" name="fromClientId" value={client.id} />
                          <button type="submit" title="Remove this account" className="inline-flex items-center gap-1 rounded-full bg-[var(--panel)] px-2 py-0.5 text-[0.71875rem] font-semibold text-[var(--ink)] hover:bg-red-500/10">
                            {l.client.organization ? `${l.client.organization} — ${l.client.fullName}` : l.client.fullName} <span className="text-red-500">×</span>
                          </button>
                        </form>
                      ))
                    )}
                    {mergeCandidates.length > 0 ? (
                      <form action={linkPortalUserToClientAction} className="inline-flex items-center gap-1">
                        <input type="hidden" name="portalUserId" value={pu.id} />
                        <input type="hidden" name="fromClientId" value={client.id} />
                        <select name="clientId" defaultValue="" className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-1.5 py-0.5 text-[0.71875rem]">
                          <option value="" disabled>+ add account…</option>
                          {mergeCandidates.map((c) => (
                            <option key={c.id} value={c.id}>{c.organization ? `${c.organization} — ${c.fullName}` : c.fullName}</option>
                          ))}
                        </select>
                        <button type="submit" className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-0.5 text-[0.71875rem] font-semibold text-[var(--accent)]">Add</button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          <form action={createPortalUserAction} className="grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="clientId" value={client.id} />
            <input name="name" required placeholder="Full name" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50" />
            <input name="email" type="email" required placeholder="Email" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50" />
            <select name="role" defaultValue="IT_OFFICER" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]">
              <option value="IT_OFFICER">IT Officer</option>
              <option value="ORG_ADMIN">Organization Administrator</option>
              <option value="MEMBER">Member</option>
            </select>
            <input name="password" type="text" required minLength={8} placeholder="Temporary password (min 8)" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50" />
            <button type="submit" className="btn-premium rounded-lg px-3 py-1.5 text-[0.8125rem] text-white sm:col-span-2">Create portal login</button>
          </form>
        </div>
      ) : null}

      {isAdmin && mergeCandidates.length > 0 ? (
        <MergeClientPanel sourceId={client.id} sourceName={client.fullName} sourceEmail={client.email} candidates={mergeCandidates} />
      ) : null}

      <div className="dc-card px-3 py-2.5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Job History</p>
          <div className="flex items-center gap-2">
            {/* Status filter chips */}
            <div className="flex items-center gap-1">
              <Link
                href={`/clients/${id}`}
                className={`rounded-full border px-2.5 py-0.5 text-[0.8125rem] font-semibold transition ${!filters.status ? "border-[var(--accent)] bg-[var(--accent)] text-black" : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] hover:border-[var(--accent)]/30"}`}
              >
                All
              </Link>
              {UI_JOB_STATUSES.map((status) => (
                <Link
                  key={status}
                  href={`/clients/${id}?${new URLSearchParams({ ...(filters.q ? { q: filters.q } : {}), status }).toString()}`}
                  className={`hidden rounded-full border px-2.5 py-0.5 text-[0.8125rem] font-semibold transition sm:block ${filters.status === status ? "border-[var(--accent)] bg-[var(--accent)] text-black" : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] hover:border-[var(--accent)]/30"}`}
                >
                  {statusOptionLabel[status]}
                </Link>
              ))}
            </div>
            <SearchToggle
              basePath={`/clients/${id}`}
              defaultValue={filters.q}
              placeholder="Search job # or device"
              preserve={{ status: filters.status }}
            />
          </div>
        </div>

        {client.jobs.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No jobs match this filter.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            {client.jobs.map((job: ClientDetail["jobs"][number]) => {
              const strip = statusStripClass(job.status);
              const device = [job.brand, job.model].filter(v => v && v !== "Unknown").join(" ") || "Device";
              return (
                <div key={job.id} className="relative border-b border-[var(--line)] bg-[var(--panel)] last:border-b-0 transition-colors hover:bg-[var(--panel-strong)]/40">
                  <span className={`absolute inset-y-0 left-0 w-[5px] ${strip}`} aria-hidden="true" />
                  <Link href={`/jobs/${job.id}?returnTo=/clients/${client.id}&returnLabel=Client`} className="absolute inset-0 z-0" aria-label={`Open ${job.jobNumber}`} />
                  <div className="pointer-events-none relative z-10 px-4 py-3 pl-6">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="mono text-[0.75rem] font-medium tracking-wide text-[var(--ink-muted)]/50">{job.jobNumber}</span>
                      <svg viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-1.5 shrink-0 text-[var(--ink-muted)]/25" aria-hidden="true"><path d="M1 1l4 4-4 4"/></svg>
                    </div>
                    <p className="text-[0.9375rem] font-bold leading-snug tracking-tight text-[var(--ink)]">{device}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <JobStatusBadge status={job.status} />
                      <span className="text-[0.8125rem] text-[var(--ink-muted)]">· {formatEATDate(job.receivedAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--line)]/60">
        <div className="flex items-baseline gap-2 px-4 py-2.5">
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Client Notes</p>
          <span className="text-[0.6875rem] text-[var(--ink-muted)]/70">internal</span>
        </div>
        <form action={addClientNote} className="flex flex-col gap-2 p-4">
          <textarea name="body" required placeholder="Add note" className="min-h-24 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none transition focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/20" />
          <button type="submit" disabled={!notesFeatureAvailable} className="btn-premium self-start rounded-lg px-3 py-2 text-sm text-white disabled:opacity-60">Add Note</button>
        </form>

        <div className="space-y-2 px-4 pb-4">
          {!notesFeatureAvailable ? (
            <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">Notes timeline needs the latest DB migration — run <code className="mono">bunx prisma migrate dev</code> and restart.</p>
          ) : null}

          {client.notesEntries.length === 0 ? (
            <p className="text-[0.75rem] text-[var(--ink-muted)]">No notes yet.</p>
          ) : (
            client.notesEntries.map((note: ClientDetail["notesEntries"][number]) => (
              <div key={note.id} className="border-l-2 border-[var(--line)] pl-3 py-1">
                <p className="text-[0.8125rem] leading-relaxed text-[var(--ink)]/90">{note.body}</p>
                <p className="mt-1 text-[0.6875rem] text-[var(--ink-muted)]/80">
                  {note.author.name} · {formatEATDateTime(note.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
        </div>

        <RecordSummaryRail
          headline={statement
            ? { label: "Outstanding", value: formatMoney(statement.totals.outstanding, statement.currency), tone: statement.totals.outstanding > 0 ? "crit" : "good" }
            : { label: "Total jobs", value: String(totalJobs) }}
          rows={[
            { label: "Total jobs", value: totalJobs },
            { label: "Open", value: openJobs },
            { label: "Completed", value: completedJobs },
            { label: "Completion", value: `${completionRate.toFixed(0)}%` },
            ...(statement
              ? [
                  { label: "Billed", value: formatMoney(statement.totals.billed, statement.currency) },
                  { label: "Paid", value: formatMoney(statement.totals.paid, statement.currency) },
                  ...(uninvoicedWork > 0
                    ? [{ label: "Uninvoiced work", value: formatMoney(uninvoicedWork, statement.currency) }]
                    : []),
                ]
              : []),
            { label: "Joined", value: formatEATDate(client.createdAt) },
            { label: "Last activity", value: formatEATDate(latestActivity) },
          ] as SummaryRow[]}
          party={{ title: "Client", name: client.fullName, org: client.organization, lines: [formatPhoneDisplay(client.phone), client.email, client.address] }}
        />
      </div>
    </div>
  );
}
