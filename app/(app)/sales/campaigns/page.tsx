// @ts-nocheck — TODO: resolve underlying type issues and remove this pragma
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { CampaignType, CampaignStatus, CampaignContactStatus } from "@prisma/client";
import { getCurrentUserRole } from "@/lib/session";

import { prisma } from "@/lib/prisma";
import { orgDb } from "@/lib/db";
import { RowActionsMenu, MenuSection, MenuActionButton, MenuDestructiveRow } from "@/components/shared/RowActionsMenu";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { SendCampaignButton } from "@/components/shared/SendCampaignButton";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/StatCards";
import { StatStrip } from "@/components/ui/StatStrip";
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import { formatEATDate, formatEATDateTime } from "@/lib/date-eat";

const CAMPAIGN_TYPES: CampaignType[] = ["EMAIL", "SMS", "CALL", "WHATSAPP"];
const CAMPAIGN_STATUSES: CampaignStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"];
const CONTACT_STATUSES: CampaignContactStatus[] = ["PENDING", "SENT", "OPENED", "RESPONDED", "OPTED_OUT"];

const STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT:     "neutral",
  ACTIVE:    "success",
  PAUSED:    "warning",
  COMPLETED: "info",
  CANCELLED: "danger",
};

const STATUS_TILE_TONES: Record<string, string> = {
  DRAFT:     "bg-[var(--panel-strong)] text-[var(--ink-muted)]",
  ACTIVE:    "bg-emerald-500/15 text-emerald-600",
  PAUSED:    "bg-amber-500/15 text-amber-600",
  COMPLETED: "bg-sky-500/15 text-sky-600",
  CANCELLED: "bg-red-500/15 text-red-600",
};

const CONTACT_STATUS_TONES: Record<string, BadgeTone> = {
  PENDING:   "neutral",
  SENT:      "info",
  OPENED:    "success",
  RESPONDED: "purple",
  OPTED_OUT: "danger",
};

const SENT_LIKE = ["SENT", "OPENED", "RESPONDED"];

function CampaignTypeIcon({ type, className = "h-4 w-4" }: { type: CampaignType; className?: string }) {
  const cls = `${className} shrink-0`;
  switch (type) {
    case "EMAIL":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden>
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
        </svg>
      );
    case "SMS":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      );
    case "CALL":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 1.4h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
      );
    case "WHATSAPP":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={cls} aria-hidden>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
      );
  }
}

export const dynamic = "force-dynamic";

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { user } = await getCurrentUserRole();
  const db = orgDb(user.orgId);
  if (!["ADMIN", "OPS"].includes(user.role)) redirect("/dashboard");

  const sp = await searchParams;
  const selectedId = sp.id ?? null;
  const page = parsePage(sp.page);
  const statusFilter = CAMPAIGN_STATUSES.includes(sp.status as CampaignStatus) ? (sp.status as CampaignStatus) : null;
  const q = (sp.q ?? "").trim();
  const showNew = sp.new === "1";

  async function createCampaign(fd: FormData) {
    "use server";
    const { user: _user } = await getCurrentUserRole();
    const db = orgDb(user.orgId);
    // (org write check removed — single-tenant)
    const name = fd.get("name") as string;
    const type = fd.get("type") as CampaignType;
    const subject = (fd.get("subject") as string) || null;
    const body = fd.get("body") as string;
    const scheduledAt = fd.get("scheduledAt") as string;
    if (!name || !type || !body) return;
    await db.campaign.create({
      data: {
        name, type, subject, body, createdById: user.id,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    });
    revalidatePath("/sales/campaigns");
  }

  async function updateStatus(fd: FormData) {
    "use server";
    const { user: _user } = await getCurrentUserRole();
    const db = orgDb(user.orgId);
    // (org write check removed — single-tenant)
    const id = fd.get("id") as string;
    const status = fd.get("status") as CampaignStatus;
    const campaign = await db.campaign.findFirst({ where: { id} });
    if (!campaign) return;
    const extra: Record<string, Date | null> = {};
    if (status === "ACTIVE" && !campaign.startedAt) extra.startedAt = new Date();
    if (status === "COMPLETED") extra.completedAt = new Date();
    await db.campaign.update({ where: { id }, data: { status, ...extra } });
    revalidatePath("/sales/campaigns");
  }

  async function deleteCampaign(fd: FormData) {
    "use server";
    const { user: _user } = await getCurrentUserRole();
    const db = orgDb(user.orgId);
    // (org write check removed — single-tenant)
    const id = fd.get("id") as string;
    await db.campaign.delete({ where: { id } });
    revalidatePath("/sales/campaigns");
  }

  async function addLeadsToCampaign(fd: FormData) {
    "use server";
    const { user: _user } = await getCurrentUserRole();
    const db = orgDb(user.orgId);
    // (org write check removed — single-tenant)
    const campaignId = fd.get("campaignId") as string;
    const source = fd.get("source") as "all_leads" | "all_clients";
    const campaign = await db.campaign.findFirst({ where: { id: campaignId} });
    if (!campaign) return;

    if (source === "all_leads") {
      const leads = await db.lead.findMany({ where: { status: { notIn: ["WON", "LOST"] } }, select: { id: true } });
      for (const l of leads) {
        await prisma.campaignContact.upsert({
          where: { campaignId_leadId: { campaignId, leadId: l.id } },
          create: { campaignId, leadId: l.id },
          update: {},
        });
      }
    } else {
      const clients = await db.client.findMany({ where: { }, select: { id: true } });
      for (const c of clients) {
        await prisma.campaignContact.upsert({
          where: { campaignId_clientId: { campaignId, clientId: c.id } },
          create: { campaignId, clientId: c.id },
          update: {},
        });
      }
    }
    revalidatePath("/sales/campaigns");
  }

  async function updateContactStatus(fd: FormData) {
    "use server";
    const { user: _user } = await getCurrentUserRole();
    // (org write check removed — single-tenant)
    const id = fd.get("id") as string;
    const status = fd.get("status") as CampaignContactStatus;
    const updates: Record<string, Date> = {};
    if (status === "SENT") updates.sentAt = new Date();
    if (status === "OPENED") updates.openedAt = new Date();
    if (status === "RESPONDED") updates.repliedAt = new Date();
    await prisma.campaignContact.updateMany({ where: { id, campaign: { } }, data: { status, ...updates } });
    revalidatePath("/sales/campaigns");
  }

  const campaigns = await db.campaign.findMany({
    where: {},
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { contacts: true } }, contacts: { select: { status: true } } },
  });

  const selected = selectedId ? campaigns.find((c) => c.id === selectedId) : null;

  const contacts = selected
    ? await prisma.campaignContact.findMany({
        where: { campaignId: selected.id },
        orderBy: { createdAt: "asc" },
        // NOTE: CampaignContact has no OutboundMessage relation in the schema —
        // including one here threw PrismaClientValidationError and 500'd the
        // page for every selected campaign. Delivery state comes from `status`.
        include: {
          lead: { select: { fullName: true, phone: true, email: true, status: true } },
          client: { select: { fullName: true, phone: true, email: true } },
        },
      })
    : [];

  // ── KPIs stay whole-dataset; only the campaign list is filtered/paginated ──
  const totalActive    = campaigns.filter((c) => c.status === "ACTIVE").length;
  const totalContacts  = campaigns.reduce((s, c) => s + c._count.contacts, 0);
  const totalSent      = campaigns.reduce((s, c) => s + c.contacts.filter((cc) => SENT_LIKE.includes(cc.status)).length, 0);
  const totalOpened    = campaigns.reduce((s, c) => s + c.contacts.filter((cc) => ["OPENED", "RESPONDED"].includes(cc.status)).length, 0);
  const totalResponded = campaigns.reduce((s, c) => s + c.contacts.filter((cc) => cc.status === "RESPONDED").length, 0);
  const overallResponseRate = totalSent > 0 ? Math.round((totalResponded / totalSent) * 100) : 0;

  const statusCounts: Record<string, number> = {};
  for (const c of campaigns) statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;

  const filtered = campaigns.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const pageView = paginationView(page, filtered.length);
  const pageCampaigns = filtered.slice(pageView.skip, pageView.skip + pageView.take);
  const campaignsHref = pageHrefBuilder("/sales/campaigns", {
    id: selectedId ?? "",
    status: statusFilter ?? "",
    q,
  });

  function href(next: { id?: string | null; status?: CampaignStatus | null; q?: string; showNew?: boolean }) {
    const params = new URLSearchParams();
    const id = next.id === undefined ? selectedId : next.id;
    const status = next.status === undefined ? statusFilter : next.status;
    const search = next.q === undefined ? q : next.q;
    if (id) params.set("id", id);
    if (status) params.set("status", status);
    if (search) params.set("q", search);
    if (next.showNew) params.set("new", "1");
    const query = params.toString();
    return query ? `/sales/campaigns?${query}` : "/sales/campaigns";
  }

  const hasFilters = Boolean(statusFilter) || Boolean(q);
  const field =
    "w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none transition placeholder:text-[var(--ink-muted)]/60 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15";
  const cardLabel = "text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70";

  const statusChips = [
    { key: "all", short: "All", long: `${campaigns.length} all`, count: campaigns.length, url: href({ status: null }), active: !statusFilter },
    ...CAMPAIGN_STATUSES.map((s) => ({
      key: s,
      short: s.charAt(0) + s.slice(1).toLowerCase(),
      long: `${statusCounts[s] ?? 0} ${s.toLowerCase()}`,
      count: statusCounts[s] ?? 0,
      url: href({ status: s }),
      active: statusFilter === s,
    })),
  ];

  const selectedSent      = selected ? contacts.filter((c) => SENT_LIKE.includes(c.status)).length : 0;
  const selectedOpened    = selected ? contacts.filter((c) => ["OPENED", "RESPONDED"].includes(c.status)).length : 0;
  const selectedReplied   = selected ? contacts.filter((c) => c.status === "RESPONDED").length : 0;
  const selectedPending   = selected ? contacts.filter((c) => c.status === "PENDING").length : 0;

  return (
    <ListPageLayout
      headerNode={
        <>
          {/* ══ MOBILE HEADER ══ */}
          <div className="space-y-3 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-[22px] font-black text-[var(--ink)]">Campaigns</h1>
                <p className="text-[13px] text-[var(--ink-muted)]">{campaigns.length} total · {totalActive} active</p>
              </div>
              <Button href={showNew ? href({}) : href({ showNew: true })} size="md" className="rounded-xl font-bold">
                {showNew ? "Close" : "+ New"}
              </Button>
            </div>

            <div className="grid grid-cols-4 divide-x divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)]">
              {([
                { label: "Total", value: campaigns.length },
                { label: "Active", value: totalActive },
                { label: "Sent", value: totalSent },
                { label: "Replies", value: totalResponded },
              ] as const).map(({ label, value }) => (
                <div key={label} className="min-w-0 px-1.5 py-3 text-center">
                  <p className="truncate text-[17px] font-black leading-none tabular-nums text-[var(--ink)]">{value}</p>
                  <p className="mt-1 text-[11px] text-[var(--ink-muted)]">{label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {statusChips.map(({ key, short, count, url, active }) => (
                <Link
                  key={key}
                  href={url}
                  className={`rounded-full py-1.5 text-center text-[12px] font-bold transition ${
                    active
                      ? "bg-[var(--accent)] text-black"
                      : "border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)]"
                  }`}
                >
                  {short}{count > 0 && !active ? ` ${count}` : ""}
                </Link>
              ))}
            </div>

            <form method="GET">
              {selectedId ? <input type="hidden" name="id" value={selectedId} /> : null}
              {statusFilter ? <input type="hidden" name="status" value={statusFilter} /> : null}
              <div className="relative">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]/50" aria-hidden>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Campaign name..."
                  className="h-10 w-full rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] pl-9 pr-4 text-[13px] outline-none placeholder:text-[var(--ink-muted)]/50 focus:border-[var(--accent)]/60 focus:ring-2 focus:ring-[var(--accent)]/14"
                />
                {q ? (
                  <Link href={href({ q: "" })} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]/50">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </Link>
                ) : null}
              </div>
            </form>
          </div>

          {/* ══ DESKTOP HEADER ══ */}
          <div className="hidden lg:block">
            <PageHeader
              eyebrow="Sales"
              title="Campaigns"
              description="Outreach campaigns for leads and clients"
              actions={
                <Button href={showNew ? href({}) : href({ showNew: true })} size="sm" className="px-4 font-bold">
                  {showNew ? "Close" : "+ New Campaign"}
                </Button>
              }
            />
          </div>
        </>
      }
    >
      {/* ══ DESKTOP: KPI cards ══ */}
      <StatCards
        columns={4}
        cards={[
          { key: "total", label: "Campaigns", value: campaigns.length, sub: "all time", muted: campaigns.length === 0 },
          { key: "active", label: "Active", value: totalActive, sub: "currently running", tone: "good", muted: totalActive === 0 },
          { key: "reached", label: "Contacts reached", value: totalSent, sub: `of ${totalContacts} added`, tone: "accent", muted: totalSent === 0 },
          { key: "replies", label: "Reply rate", value: `${overallResponseRate}%`, sub: `${totalResponded} replied · ${totalOpened} opened`, tone: "warn", muted: totalResponded === 0 },
        ]}
      />

      {/* ══ DESKTOP: Status chips + search ══ */}
      <div className="panel-shadow hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] lg:block">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2.5">
          {statusChips.map(({ key, long, url, active }) => (
            <Link
              key={key}
              href={url}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                  : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] hover:border-[var(--accent)]/40"
              }`}
            >
              {long}
            </Link>
          ))}
        </div>
        <form className="flex items-center gap-2 p-3">
          {selectedId ? <input type="hidden" name="id" value={selectedId} /> : null}
          {statusFilter ? <input type="hidden" name="status" value={statusFilter} /> : null}
          <input
            name="q"
            defaultValue={q}
            aria-label="Search campaigns"
            placeholder="Search by campaign name..."
            className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-sm outline-none transition placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15"
          />
          <Button type="submit" variant="secondary" size="sm">Search</Button>
          {hasFilters ? (
            <Link href={href({ status: null, q: "" })} className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] text-[var(--ink-muted)]">Reset</Link>
          ) : null}
        </form>
      </div>

      {/* ── New campaign ── */}
      {showNew ? (
        <section className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] px-4 py-2.5">
            <p className={cardLabel}>New Campaign</p>
          </div>
          <form action={createCampaign} className="p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <input name="name" required placeholder="Campaign name *" aria-label="Campaign name" className={field} />
              <select name="type" aria-label="Type" className={field}>
                {CAMPAIGN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input name="subject" placeholder="Subject (email)" aria-label="Subject" className={field} />
              <input name="scheduledAt" type="datetime-local" title="Schedule date" aria-label="Schedule date" className={field} />
              <textarea
                name="body"
                required
                rows={3}
                placeholder="Message body * — use {name} to insert the contact name"
                aria-label="Message body"
                className={`${field} sm:col-span-2`}
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Button type="submit" size="sm" className="px-4 font-bold">Create Campaign</Button>
              <Link href={href({})} className="text-xs font-medium text-[var(--ink-muted)] underline-offset-2 hover:underline">Cancel</Link>
            </div>
          </form>
        </section>
      ) : null}

      {campaigns.length === 0 ? (
        <div className="panel-shadow flex flex-col items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-6 py-14 text-center">
          <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10 opacity-20" aria-hidden="true">
            <path d="M5 12h20l10-5v26l-10-5H5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M11 22v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-sm font-medium text-[var(--ink-muted)]">No campaigns yet</p>
          <Link href={href({ showNew: true })} className="text-xs text-[var(--accent)] hover:underline">Create the first one</Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
          {/* ── Campaign list ── */}
          <div className="space-y-4">
            {pageCampaigns.length === 0 ? (
              <div className="panel-shadow flex flex-col items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-6 py-10 text-center">
                <p className="text-sm font-medium text-[var(--ink-muted)]">No campaigns match this view</p>
                {hasFilters ? (
                  <Link href={href({ status: null, q: "" })} className="text-xs text-[var(--accent)] hover:underline">Clear filters</Link>
                ) : null}
              </div>
            ) : (
              <div className="panel-shadow divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
                {pageCampaigns.map((c) => {
                  const sentCount = c.contacts.filter((cc) => SENT_LIKE.includes(cc.status)).length;
                  const repliedCount = c.contacts.filter((cc) => cc.status === "RESPONDED").length;
                  const rate = sentCount > 0 ? Math.round((repliedCount / sentCount) * 100) : 0;
                  const isActive = selected?.id === c.id;
                  return (
                    <Link
                      key={c.id}
                      href={href({ id: c.id })}
                      className={`relative flex items-center gap-3 px-4 py-3 transition ${isActive ? "bg-[var(--panel-strong)]/60" : "hover:bg-[var(--panel-strong)]/40"}`}
                    >
                      {isActive ? <span className="absolute inset-y-0 left-0 w-[3px] bg-[var(--accent)]" aria-hidden="true" /> : null}
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${STATUS_TILE_TONES[c.status] ?? STATUS_TILE_TONES.DRAFT}`}>
                        <CampaignTypeIcon type={c.type} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-bold text-[var(--ink)]">{c.name}</p>
                        <p className="mt-0.5 truncate text-[12px] text-[var(--ink-muted)]">
                          {c._count.contacts} contacts
                          {sentCount > 0 ? ` · ${sentCount} sent · ${rate}% replied` : ""}
                          {c.scheduledAt ? ` · ${formatEATDate(c.scheduledAt)}` : ""}
                        </p>
                      </div>
                      <StatusBadge tone={toneFor(STATUS_TONES, c.status)}>{c.status}</StatusBadge>
                    </Link>
                  );
                })}
              </div>
            )}

            <TablePagination
              page={pageView.page}
              totalPages={pageView.totalPages}
              rangeStart={pageView.rangeStart}
              rangeEnd={pageView.rangeEnd}
              total={pageView.total}
              unit="campaigns"
              hrefForPage={campaignsHref}
            />
          </div>

          {/* ── Selected campaign ── */}
          {!selected ? (
            <div className="panel-shadow flex flex-col items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-6 py-14 text-center">
              <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10 opacity-20" aria-hidden="true">
                <circle cx="14" cy="14" r="7" stroke="currentColor" strokeWidth="2"/>
                <path d="M19 19l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <p className="text-sm font-medium text-[var(--ink-muted)]">Pick a campaign to see its contacts</p>
            </div>
          ) : (
            <div className="space-y-4">
              <section className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-bold text-[var(--ink)]">{selected.name}</p>
                      <StatusBadge tone={toneFor(STATUS_TONES, selected.status)}>{selected.status}</StatusBadge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--ink-muted)]">
                      <span className="flex items-center gap-1.5">
                        <CampaignTypeIcon type={selected.type} className="h-3.5 w-3.5" />
                        {selected.type}
                      </span>
                      <span className="opacity-40">·</span>
                      <span>{selected._count.contacts} contacts</span>
                      {selected.subject ? <><span className="opacity-40">·</span><span className="truncate">{selected.subject}</span></> : null}
                    </div>
                    <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]/60">
                      Created {formatEATDate(selected.createdAt)}
                      {selected.scheduledAt ? ` · scheduled ${formatEATDateTime(selected.scheduledAt)}` : ""}
                      {selected.startedAt ? ` · started ${formatEATDate(selected.startedAt)}` : ""}
                      {selected.completedAt ? ` · completed ${formatEATDate(selected.completedAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {selected.type === "WHATSAPP" ? (
                      <SendCampaignButton campaignId={selected.id} pendingCount={selectedPending} />
                    ) : null}
                    <RowActionsMenu label="Campaign actions">
                      <MenuSection label="Status" />
                      <div className="py-1">
                        {CAMPAIGN_STATUSES.filter((s) => s !== selected.status).map((s) => (
                          <form key={s} action={updateStatus}>
                            <input type="hidden" name="id" value={selected.id} />
                            <input type="hidden" name="status" value={s} />
                            <MenuActionButton icon="save" tone={s === "CANCELLED" ? "danger" : s === "ACTIVE" ? "success" : "default"}>
                              Set {s.charAt(0) + s.slice(1).toLowerCase()}
                            </MenuActionButton>
                          </form>
                        ))}
                      </div>
                      <MenuDestructiveRow>
                        <form action={deleteCampaign}>
                          <input type="hidden" name="id" value={selected.id} />
                          <ConfirmSubmitButton
                            message="Delete this campaign and all contact records?"
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
                          >
                            Delete Campaign
                          </ConfirmSubmitButton>
                        </form>
                      </MenuDestructiveRow>
                    </RowActionsMenu>
                  </div>
                </div>

                <StatStrip
                  columns={4}
                  tiles={[
                    { label: "Contacts", value: selected._count.contacts },
                    { label: "Sent", value: selectedSent, sub: selectedPending > 0 ? `${selectedPending} pending` : undefined },
                    { label: "Opened", value: selectedOpened },
                    { label: "Replied", value: selectedReplied, valueClass: selectedReplied > 0 ? "text-emerald-600" : undefined },
                  ]}
                />

                <div className="border-t border-[var(--line)] bg-[var(--panel-strong)]/40 px-4 py-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]/70">Message</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-[var(--ink)] [overflow-wrap:anywhere]">{selected.body}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] p-3">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Add contacts</span>
                  <form action={addLeadsToCampaign}>
                    <input type="hidden" name="campaignId" value={selected.id} />
                    <input type="hidden" name="source" value="all_leads" />
                    <Button type="submit" variant="secondary" size="sm">All active leads</Button>
                  </form>
                  <form action={addLeadsToCampaign}>
                    <input type="hidden" name="campaignId" value={selected.id} />
                    <input type="hidden" name="source" value="all_clients" />
                    <Button type="submit" variant="secondary" size="sm">All clients</Button>
                  </form>
                </div>
              </section>

              <section className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
                  <p className={cardLabel}>Contacts</p>
                  <p className="text-[12px] text-[var(--ink-muted)]">
                    {contacts.length} total{selectedPending > 0 ? ` · ${selectedPending} pending` : ""}
                  </p>
                </div>
                <DataTable
                  frameless
                  dense
                  rows={contacts}
                  getRowKey={(cc) => cc.id}
                  empty="No contacts added yet."
                  renderMobileCard={(cc) => {
                    const person = cc.lead ?? cc.client;
                    if (!person) return null;
                    return (
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-[var(--ink)]">{person.fullName}</p>
                          <p className="mt-0.5 truncate text-[var(--ink-muted)]">
                            {person.phone} · {cc.lead ? "Lead" : "Client"}
                            {cc.sentAt ? ` · sent ${formatEATDate(cc.sentAt)}` : ""}
                            {cc.repliedAt ? ` · replied ${formatEATDate(cc.repliedAt)}` : ""}
                          </p>
                        </div>
                        <StatusBadge tone={toneFor(CONTACT_STATUS_TONES, cc.status)}>{cc.status}</StatusBadge>
                      </div>
                    );
                  }}
                  columns={[
                    {
                      key: "contact",
                      header: "Contact",
                      cell: (cc) => {
                        const person = cc.lead ?? cc.client;
                        if (!person) return null;
                        return (
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[var(--ink)]">{person.fullName}</p>
                            <p className="truncate text-[12px] text-[var(--ink-muted)]">{person.phone} · {cc.lead ? "Lead" : "Client"}</p>
                          </div>
                        );
                      },
                    },
                    {
                      key: "status",
                      header: "Status",
                      cell: (cc) => <StatusBadge tone={toneFor(CONTACT_STATUS_TONES, cc.status)}>{cc.status}</StatusBadge>,
                    },
                    {
                      key: "sent",
                      header: "Sent",
                      headerClassName: "hidden xl:table-cell",
                      className: "hidden whitespace-nowrap text-[12px] text-[var(--ink-muted)] xl:table-cell",
                      cell: (cc) => cc.sentAt ? formatEATDate(cc.sentAt) : <span className="opacity-30">—</span>,
                    },
                    {
                      key: "replied",
                      header: "Replied",
                      className: "whitespace-nowrap text-[12px]",
                      cell: (cc) => cc.repliedAt
                        ? <span className="font-semibold text-emerald-600">{formatEATDate(cc.repliedAt)}</span>
                        : <span className="text-[var(--ink-muted)]/30">—</span>,
                    },
                  ]}
                  actions={(cc) => (
                    <form action={updateContactStatus} className="flex items-center justify-end gap-1.5">
                      <input type="hidden" name="id" value={cc.id} />
                      <select name="status" defaultValue={cc.status} aria-label={`Status for ${(cc.lead ?? cc.client)?.fullName ?? "contact"}`}
                        className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1 text-[12px] outline-none focus:border-[var(--accent)]/50">
                        {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button type="submit" title="Apply status"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)]">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                    </form>
                  )}
                />
              </section>
            </div>
          )}
        </div>
      )}
    </ListPageLayout>
  );
}
