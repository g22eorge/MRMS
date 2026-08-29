export const dynamic = "force-dynamic";

import Link from "next/link";
import { JobStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";


import { can } from "@/lib/permissions";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { DisclosureProvider, DisclosureTrigger, DisclosurePanel, DisclosureClose } from "@/components/shared/DisclosureRegion";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/StatCards";
import { PAGE_SIZE, parsePage, parsePageSize, paginationView, pageHrefBuilder, sizeHrefBuilder } from "@/lib/pagination";
import { orgDb } from "@/lib/db";
import { sanitizeOptionalText, sanitizeText } from "@/lib/sanitize";
import { getCurrentUserRole } from "@/lib/session";
import { formatEATDate } from "@/lib/date-eat";
import { assertOrgCanMutate } from "@/lib/org-write";
import { requireOrgSession } from "@/lib/org-context";
import { clientContactName, clientDisplayName } from "@/lib/client-name";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import {
  formatPhoneDisplay,
  normalizePhoneForStorage,
  phoneLookupVariants,
  phoneTelHref,
  phoneWhatsAppHref,
} from "@/lib/phone";

import { flash } from "@/lib/flash";
import { icontains } from "@/lib/db/search";
const createClientSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the client's name"),
  phone: z.string().min(3),
  // Validated, because this address is what "Send email" and every emailed
  // document go to. An unchecked string here fails silently at delivery time,
  // long after whoever typed it has moved on.
  email: z.string().email().optional().or(z.literal("")),
  organization: z.string().optional(),
  address: z.string().optional(),
});

type SearchParams = {
  q?: string;
  segment?: string;
  page?: string;
  size?: string;
  createError?: string;
  error?: string;
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user } = await getCurrentUserRole();
  const db = orgDb(user.orgId);
  if (!can.viewClientInfo(user)) {
    redirect("/dashboard");
  }

  const filters = await searchParams;
  const page = parsePage(filters.page);
  const pageSize = parsePageSize(filters.size);
  const segment = filters.segment ?? "all";

  const where: Prisma.ClientWhereInput = {
    ...(filters.q
      ? {
          OR: [
            { fullName: icontains(filters.q) },
            { phone: icontains(filters.q) },
            { email: icontains(filters.q) },
            { organization: icontains(filters.q) },
            { address: icontains(filters.q) },
          ],
        }
      : {}),
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Build segment filter for the DB query
  const segmentWhere: Prisma.ClientWhereInput =
    segment === "active" ? { jobs: { some: {} } }
    : segment === "new"  ? { jobs: { none: {} } }
    : segment === "high" ? { jobs: { some: {} } } // further filtered below
    : {};

  const pagedWhere: Prisma.ClientWhereInput = { ...where, ...segmentWhere };

  const [matchingClients, total, totalClients, activeClients, newClients, withManyJobs, kpiNewThisMonth, kpiWithActiveJobs, kpiWithOrg] = await Promise.all([
    db.client.findMany({
      where: pagedWhere,
      include: { _count: { select: { jobs: true } } },
      orderBy: { updatedAt: "desc" },
      // The "Top" segment cannot be expressed in `where` — Prisma has no
      // comparison on a relation count — so it is narrowed to >= 3 jobs after
      // the query. Paginating first therefore filtered within a page: page one
      // showed whichever few of its twenty qualified, later pages could be
      // empty, and the footer counted every client with any job at all. For
      // that segment the slice is taken after the filter instead, below.
      ...(segment === "high" ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
    }),
    db.client.count({ where: pagedWhere }).catch(() => 0),
    db.client.count().catch(() => 0),
    db.client.count({ where: { jobs: { some: {} } } }).catch(() => 0),
    db.client.count({ where: { jobs: { none: {} } } }).catch(() => 0),
    db.client.count({ where: { jobs: { some: {} } } }).catch(() => 0), // approx for "high" tab badge
    // "New this month" = created this month AND no job history from before this month.
    // Guards against bulk-imported clients whose createdAt was set at import time
    // but who came with historical jobs (they aren't "new").
    db.client.count({
      where: {
        createdAt: { gte: monthStart },
        jobs: { none: { receivedAt: { lt: monthStart } } },
      },
    }).catch(() => 0),
    db.client.count({ where: { jobs: { some: { status: { notIn: [JobStatus.COMPLETED, JobStatus.CLOSED] } } } } }).catch(() => 0),
    db.client.count({ where: { organization: { not: null } } }).catch(() => 0),
  ]);

  type ClientRow = Prisma.ClientGetPayload<{
    include: { _count: { select: { jobs: true } } };
  }>;

  // For "high" segment: the DB returned all clients with jobs, now filter locally on the page only
  const filteredClients = segment === "high"
    ? (matchingClients as ClientRow[]).filter((c) => c._count.jobs >= 3)
    : (matchingClients as ClientRow[]);

  const pageView = paginationView(
    page,
    segment === "high" ? filteredClients.length : total,
    pageSize,
  );
  const clients =
    segment === "high"
      ? filteredClients.slice(pageView.skip, pageView.skip + pageView.take)
      : filteredClients;
  // kpiTotal is the same as totalClients (total count across all segments for the KPI bar)
  const kpiTotal = totalClients;

  async function createClientAction(formData: FormData) {
    "use server";

    const { user: currentUser, orgId: createOrgId, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: currentUser.role, userAccessMode: currentUser.accessMode, kind: "GENERAL" });
    if (!(currentUser.role === "ADMIN" || currentUser.role === "OPS")) return;

    const parsed = createClientSchema.safeParse({
      fullName: String(formData.get("fullName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      organization: String(formData.get("organization") ?? ""),
      address: String(formData.get("address") ?? ""),
    });

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = String(firstIssue?.path[0] ?? "input");
      const msg = field === "fullName" ? "Full name must be at least 2 characters"
        : field === "phone" ? "Phone number must be at least 3 characters"
        : field === "email" ? "Enter a valid email address, or leave it blank"
        : "Invalid input";
      redirect(`/clients?createError=${encodeURIComponent(msg)}`);
    }

    const normalizedPhone = normalizePhoneForStorage(sanitizeText(parsed.data.phone));
    const orgClient = orgDb(createOrgId);
    const existingByPhone = await orgClient.client.findFirst({
      where: { phone: { in: phoneLookupVariants(normalizedPhone) } },
      select: { id: true },
    });

    if (existingByPhone) {
      redirect(`/clients?createError=${encodeURIComponent("A client with this phone number already exists")}`);
    }

    await orgClient.client.create({
      data: {
        orgId: createOrgId,
        fullName: sanitizeText(parsed.data.fullName),
        phone: normalizedPhone,
        email: sanitizeOptionalText(parsed.data.email),
        organization: sanitizeOptionalText(parsed.data.organization),
        address: sanitizeOptionalText(parsed.data.address),
      },
    });

    revalidatePath("/clients");

    // Close the quick-create panel by returning to the base URL.
    redirect(flash("/clients", "Client created"));
  }

  async function deleteClientAction(formData: FormData) {
    "use server";

    const { user: currentUser, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: currentUser.role, userAccessMode: currentUser.accessMode, kind: "GENERAL" });
    const db = orgDb(user.orgId);
    if (currentUser.role !== "ADMIN") return;

    const id = String(formData.get("id") ?? "");
    if (!id) return;

    // Invoice, Sale, Quotation and Receipt all hold clientId as onDelete:
    // SetNull, so deleting a client does not remove its financial records — it
    // silently CUTS THEM LOOSE. That is exactly how this workspace ended up with
    // dozens of invoices belonging to nobody, which had to be traced back and
    // repaired by hand. Jobs were already checked; money never was.
    const existing = await db.client.findUnique({
      where: { id },
      select: {
        fullName: true,
        organization: true,
        _count: { select: { jobs: true, invoices: true, sales: true, quotations: true } },
      },
    });
    if (!existing) return;

    const blockers: string[] = [];
    if (existing._count.jobs > 0) blockers.push(`${existing._count.jobs} repair job${existing._count.jobs === 1 ? "" : "s"}`);
    if (existing._count.invoices > 0) blockers.push(`${existing._count.invoices} invoice${existing._count.invoices === 1 ? "" : "s"}`);
    if (existing._count.sales > 0) blockers.push(`${existing._count.sales} sale${existing._count.sales === 1 ? "" : "s"}`);
    if (existing._count.quotations > 0) blockers.push(`${existing._count.quotations} quotation${existing._count.quotations === 1 ? "" : "s"}`);

    if (blockers.length) {
      // Was a bare return: the row simply stayed and nobody was told why.
      const list = blockers.length === 1
        ? blockers[0]
        : `${blockers.slice(0, -1).join(", ")} and ${blockers[blockers.length - 1]}`;
      redirect(
        `/clients?error=${encodeURIComponent(
          `${clientDisplayName(existing)} still has ${list}, so deleting would leave those records with no customer attached. Merge this client into another one instead.`,
        )}`,
      );
    }

    await db.client.delete({ where: { id } });
    revalidatePath("/clients");
  }

  const preserved = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => typeof value === "string" && value.length > 0),
  ) as Record<string, string>;
  const hasClientFilters = Boolean(filters.q || segment !== "all");

  const preservedWithoutSegment = Object.fromEntries(
    Object.entries(preserved).filter(([key]) => key !== "segment" && key !== "page"),
  ) as Record<string, string>;
  function segmentHref(next: string) {
    const params = new URLSearchParams(preservedWithoutSegment);
    if (next && next !== "all") params.set("segment", next);
    const query = params.toString();
    return query ? `/clients?${query}` : "/clients";
  }

  const clientFilters = {
    q: filters.q,
    segment: segment !== "all" ? segment : "",
    size: pageSize !== PAGE_SIZE ? pageSize : "",
  };
  const clientsHref = pageHrefBuilder("/clients", clientFilters);
  const clientsSizeHref = sizeHrefBuilder("/clients", clientFilters);

  return (
    <DisclosureProvider defaultOpen={Boolean(filters.createError)}>
    <div className="space-y-4">

      {filters.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          {filters.error}
        </p>
      ) : null}

      {/* ══ MOBILE HEADER ══ */}
      <div className="lg:hidden space-y-3">
        {/* Title row + New Client CTA */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[1.375rem] font-black text-[var(--ink)]">Clients</h1>
            <p className="text-[0.8125rem] text-[var(--ink-muted)]">{kpiTotal} total</p>
          </div>
          {(user.role === "ADMIN" || user.role === "OPS") ? (
            <DisclosureTrigger
              className="btn-premium rounded-xl px-4 py-2 text-[0.8125rem] font-bold"
              label="+ New"
              openLabel="Close"
            />
          ) : null}
        </div>

        {/* Compact 4-number stat row */}
        <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-[var(--line)] divide-x divide-[var(--line)]">
          {([
            { label: "Total",   value: kpiTotal },
            { label: "New",     value: kpiNewThisMonth },
            { label: "Active",  value: kpiWithActiveJobs },
            { label: "Orgs",    value: kpiWithOrg },
          ] as const).map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center py-3">
              <p className="text-[1.375rem] font-black leading-none tabular-nums text-[var(--ink)]">{value}</p>
              <p className="mt-0.5 text-[0.6875rem] text-[var(--ink-muted)]">{label}</p>
            </div>
          ))}
        </div>

        {/* 4-chip segment filter — grid fills full width */}
        <div className="grid grid-cols-4 gap-1.5">
          {([
            { seg: "all",    label: "All",      count: totalClients },
            { seg: "active", label: "Active",   count: activeClients },
            { seg: "new",    label: "No job",   count: newClients },
            { seg: "high",   label: "Top",      count: withManyJobs },
          ] as const).map(({ seg, label, count }) => (
            <Link key={seg} href={segmentHref(seg)}
              className={`rounded-full py-1.5 text-center text-[0.75rem] font-bold transition ${
                segment === seg
                  ? "bg-[var(--accent)] text-black"
                  : "border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)]"
              }`}>
              {label}{count > 0 && segment !== seg ? ` ${count}` : ""}
            </Link>
          ))}
        </div>

        {/* Search — full width, no redundant button */}
        <form method="GET">
          {filters.segment ? <input type="hidden" name="segment" value={filters.segment} /> : null}
          <div className="relative">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]/50" aria-hidden>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Name, phone, email or address..."
              className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] pl-9 pr-4 text-[0.8125rem] outline-none placeholder:text-[var(--ink-muted)]/50 focus:border-[var(--accent)]/60 focus:ring-2 focus:ring-[var(--accent)]/14"
            />
            {filters.q && (
              <Link href="/clients" className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]/50">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </Link>
            )}
          </div>
        </form>
      </div>

      {/* ══ DESKTOP: header ══ */}
      <div className="hidden lg:block">
        <PageHeader eyebrow="Directory" title="Clients" />
      </div>

      {/* ══ DESKTOP: KPI cards ══ */}
      <StatCards
        columns={4}
        cards={[
          { key: "total",  label: "Total clients",   value: kpiTotal,          sub: "all time",              muted: kpiTotal === 0 },
          { key: "new",    label: "New this month",  value: kpiNewThisMonth,   sub: "first seen this month", tone: "good",   muted: kpiNewThisMonth === 0 },
          { key: "active", label: "With active jobs", value: kpiWithActiveJobs, sub: "open repairs",          tone: "accent", muted: kpiWithActiveJobs === 0 },
          { key: "orgs",   label: "Organisations",   value: kpiWithOrg,        sub: "with org name",         muted: kpiWithOrg === 0 },
        ]}
      />

      {/* ══ DESKTOP: Stat chips + New Client ══ */}
      <div className="dc-card hidden lg:flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {([
            { seg: "all",  label: `${totalClients} total`          },
            { seg: "active", label: `${activeClients} active`       },
            { seg: "new",  label: `${newClients} no job`            },
            { seg: "high", label: `${withManyJobs} high activity`   },
          ] as const).map(({ seg, label }) => (
            <Link key={seg} href={segmentHref(seg)}
              className={`rounded-full border px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
                segment === seg
                  ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                  : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] hover:border-[var(--accent)]/40"
              }`}>
              {label}
            </Link>
          ))}
        </div>
        {(user.role === "ADMIN" || user.role === "OPS") ? (
          <DisclosureTrigger
            className="btn-premium shrink-0 rounded-lg px-4 py-2.5 text-[0.75rem] font-bold"
            label="+ New Client"
            openLabel="Close"
          />
        ) : null}
      </div>

      {/* ══ DESKTOP: Filter panel ══ */}
      <div className="dc-card hidden lg:block">
        <form className="space-y-2.5 p-3">
          <div className="flex items-center gap-2">
            <input
              name="q"
              defaultValue={filters.q}
              aria-label="Search clients"
              placeholder="Search by name, phone, email, address..."
              className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-sm outline-none transition placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15"
            />
            <SubmitButton bare className="btn-premium-secondary shrink-0 rounded-lg px-3 py-1.5 text-[0.75rem] font-medium">Search</SubmitButton>
            {hasClientFilters ? (
              <Link href="/clients" className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.75rem] text-[var(--ink-muted)]">Reset</Link>
            ) : null}
          </div>
        </form>

        {/* Create-client form — revealed by the "+ New Client" CTA above (no separate quick-create reveal bar) */}
        {(user.role === "ADMIN" || user.role === "OPS") ? (
          <DisclosurePanel>
            <form action={createClientAction} className="border-t border-[var(--line)] px-3 pb-3 pt-3">
              {filters.createError ? (
                <p className="mb-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
                  {filters.createError}
                </p>
              ) : null}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {/*
                  These mirror createClientSchema — min 2, min 3, a real email —
                  so the browser refuses exactly what the server would refuse, and
                  says which field, at the field. The server action still validates
                  independently; it is its own entry point and this is not the
                  check, only the fast half of it.
                */}
                <input name="fullName" required minLength={2} placeholder="Full name *" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15" />
                <input name="phone" required minLength={3} placeholder="Phone *" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15" />
                <input name="email" type="email" placeholder="Email" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15" />
                <input name="organization" placeholder="Organization" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15" />
                <input name="address" placeholder="Address / location" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15 sm:col-span-2" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <SubmitButton bare className="btn-premium rounded-lg px-4 py-2.5 text-[0.8125rem] font-bold">
                  Create
                </SubmitButton>
                <DisclosureClose className="text-xs font-medium text-[var(--ink-muted)] underline-offset-2 hover:underline">
                  Cancel
                </DisclosureClose>
              </div>
            </form>
          </DisclosurePanel>
        ) : null}
      </div>

      {/* ── Clients table / cards ── */}
      {clients.length === 0 ? (
        <div className="dc-card flex flex-col items-center gap-2 px-6 py-14 text-center">
          <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10 opacity-20" aria-hidden="true">
            <circle cx="20" cy="14" r="7" stroke="currentColor" strokeWidth="2"/>
            <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-sm font-medium text-[var(--ink-muted)]">No clients match this view</p>
          {hasClientFilters ? (
            <Link href="/clients" className="text-xs text-[var(--accent)] hover:underline">Clear filters</Link>
          ) : null}
        </div>
      ) : (
        <div className="dc-card overflow-hidden">

          {/* ── Rows: shared DataTable (desktop table + mobile cards) ── */}
          <DataTable
            frameless
            rows={clients as ClientRow[]}
            getRowKey={(client) => client.id}
            renderMobileCard={(client) => (
              <div className="flex items-center gap-3 px-4 py-3">
                <Link href={`/clients/${client.id}`} className="shrink-0">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-black ${
                    client._count.jobs >= 3 ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                    : client._count.jobs > 0 ? "bg-sky-500/15 text-sky-600"
                    : "bg-[var(--panel-strong)] text-[var(--ink-muted)]"
                  }`}>
                    {clientDisplayName(client)[0]?.toUpperCase() ?? "?"}
                  </div>
                </Link>
                <Link href={`/clients/${client.id}`} className="min-w-0 flex-1 active:opacity-70">
                  <p className="truncate font-bold text-[var(--ink)]">{clientDisplayName(client)}</p>
                  <p className="mt-0.5 truncate text-[var(--ink-muted)]">
                    {formatPhoneDisplay(client.phone)}
                    {/* The organisation is the label above, so the sub-line
                        carries the contact instead of repeating it. */}
                    {clientContactName(client) ? <> · <span className="opacity-80">{clientContactName(client)}</span></> : null}
                    {client.address ? <> · <span className="opacity-80">{client.address}</span></> : null}
                    {client._count.jobs > 0
                      ? <> · <span className={client._count.jobs >= 3 ? "text-[var(--accent)] font-semibold" : ""}>{client._count.jobs} {client._count.jobs === 1 ? "job" : "jobs"}</span></>
                      : null}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-1.5">
                  <a href={phoneTelHref(client.phone) ?? `tel:${client.phone}`} aria-label={`Call ${clientDisplayName(client)}`}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] active:bg-[var(--panel-strong)]/60">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.09 9.5a19.79 19.79 0 01-3-8.72A2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
                  </a>
                  <a href={phoneWhatsAppHref(client.phone) ?? "#"} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${clientDisplayName(client)}`}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/8 text-emerald-600 active:bg-emerald-500/15">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </a>
                  {user.role === "ADMIN" && client._count.jobs === 0 ? (
                    <form action={deleteClientAction}>
                      <input type="hidden" name="id" value={client.id} />
                      <ConfirmSubmitButton
                        message={`Delete ${clientDisplayName(client)}? This cannot be undone.`}
                        confirmLabel="Delete client"
                        aria-label="Delete client"
 className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)]/50 active:text-red-500">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                </div>
              </div>
            )}
            columns={[
              {
                key: "client",
                header: "Client",
                cell: (client) => (
                  <div className="flex items-center gap-3">
                    <Link href={`/clients/${client.id}`} className="shrink-0">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-[0.8125rem] font-black ${
                        client._count.jobs >= 3
                          ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                          : client._count.jobs > 0
                            ? "bg-sky-500/15 text-sky-600"
                            : "bg-[var(--panel-strong)] text-[var(--ink-muted)]"
                      }`}>
                        {clientDisplayName(client)[0]?.toUpperCase() ?? "?"}
                      </div>
                    </Link>
                    <div className="min-w-0">
                      <Link href={`/clients/${client.id}`} className="block truncate font-semibold text-[var(--ink)] transition-colors hover:text-[var(--accent)]">
                        {clientDisplayName(client)}
                      </Link>
                      <p className="truncate text-[0.75rem] text-[var(--ink-muted)]">
                        {formatPhoneDisplay(client.phone)}
                        {clientContactName(client) ? <> · <span className="opacity-80">{clientContactName(client)}</span></> : null}
                        {client.address ? <> · <span className="opacity-80">{client.address}</span></> : null}
                      </p>
                    </div>
                  </div>
                ),
              },
              {
                key: "email",
                header: "Email",
                headerClassName: "hidden xl:table-cell",
                className: "hidden text-[0.75rem] text-[var(--ink-muted)] xl:table-cell",
                cell: (client) => client.email ?? <span className="opacity-30">—</span>,
              },
              {
                key: "jobs",
                header: "Jobs",
                cell: (client) =>
                  client._count.jobs > 0 ? (
                    <Link href={`/jobs?client=${client.id}`}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.75rem] font-semibold transition hover:opacity-80 ${
                        client._count.jobs >= 3
                          ? "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[#9A7A00]"
                          : "border-sky-400/30 bg-sky-500/10 text-sky-700 dark:text-sky-400"
                      }`}>
                      {client._count.jobs} {client._count.jobs === 1 ? "job" : "jobs"}
                    </Link>
                  ) : (
                    <span className="text-[0.75rem] text-[var(--ink-muted)]/40">—</span>
                  ),
              },
              {
                key: "joined",
                header: "Joined",
                headerClassName: "hidden xl:table-cell",
                className: "hidden whitespace-nowrap text-[0.75rem] text-[var(--ink-muted)] xl:table-cell",
                cell: (client) => formatEATDate(client.createdAt),
              },
            ]}
            actions={(client) => (
              <>
                <Link href={`/clients/${client.id}`} title="View profile"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </Link>
                <a href={phoneTelHref(client.phone) ?? `tel:${client.phone}`} title={`Call ${clientDisplayName(client)}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] transition hover:border-sky-400/40 hover:text-sky-600">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.09 9.5a19.79 19.79 0 01-3-8.72A2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
                </a>
                <a href={phoneWhatsAppHref(client.phone) ?? "#"} target="_blank" rel="noreferrer" title={`WhatsApp ${clientDisplayName(client)}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/8 text-emerald-600 transition hover:bg-emerald-500/15">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
                {user.role === "ADMIN" && client._count.jobs === 0 ? (
                  <form action={deleteClientAction} className="inline">
                    <input type="hidden" name="id" value={client.id} />
                    <ConfirmSubmitButton
                      message={`Delete ${clientDisplayName(client)}? This cannot be undone.`}
                      confirmLabel="Delete client"
                      title="Delete client"
 className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/20 text-[var(--ink-muted)]/40 transition hover:border-red-400/40 hover:text-red-500">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                    </ConfirmSubmitButton>
                  </form>
                ) : null}
              </>
            )}
          />

        </div>
      )}

      <TablePagination
        page={pageView.page}
        totalPages={pageView.totalPages}
        rangeStart={pageView.rangeStart}
        rangeEnd={pageView.rangeEnd}
        total={pageView.total}
        unit="clients"
        hrefForPage={clientsHref}
        pageSize={pageSize}
        hrefForSize={clientsSizeHref}
      />

    </div>
    </DisclosureProvider>
  );
}
