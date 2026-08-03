
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { JournalEntryStatus } from "@prisma/client";
import { getCurrentUserRole } from "@/lib/session";

import { orgDb } from "@/lib/db";
import { maxNumberSequence } from "@/lib/commercial/org-number";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { formatMoney, formatMoneyCompact } from "@/lib/currency";
import { RowActionsMenu, MenuSection, MenuDestructiveRow } from "@/components/shared/RowActionsMenu";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { can } from "@/lib/permissions";
import { NewJournalEntryForm } from "@/components/finance/NewJournalEntryForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/StatCards";
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { PageEmptyState } from "@/components/page-state/PageEmptyState";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const STATUSES: JournalEntryStatus[] = ["DRAFT", "POSTED", "VOID"];

const STATUS_TONES: Record<JournalEntryStatus, BadgeTone> = {
  DRAFT:  "warning",
  POSTED: "success",
  VOID:   "neutral",
};

export const dynamic = "force-dynamic";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { user } = await getCurrentUserRole();
  if (!can.viewFinancials(user)) redirect("/dashboard");
  if (!user.orgId) redirect("/dashboard");
  const db = orgDb(user.orgId);

  const sp = await searchParams;
  const now    = new Date();
  const year   = parseInt(sp.year  ?? String(now.getFullYear()));
  const month  = parseInt(sp.month ?? "0"); // 0 = all months
  const statusFilter = sp.status ?? "all";
  const searchQ = (sp.q ?? "").trim();
  const currency = "UGX";
  const page = parsePage(sp.page);

  // ── Date ranges ───────────────────────────────────────────────────────────
  const periodFilter =
    month > 0
      ? { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0, 23, 59, 59) }
      : { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) };

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const ytdStart       = new Date(now.getFullYear(), 0, 1);

  // ── Server actions ────────────────────────────────────────────────────────
  async function createEntry(fd: FormData) {
    "use server";
    const { user: _u } = await getCurrentUserRole();
    if (!_u.orgId) return;
    const db = orgDb(_u.orgId);

    const description = (fd.get("description") as string)?.trim();
    const dateStr     = fd.get("date") as string;
    const reference   = ((fd.get("reference") as string) || "").trim() || null;

    if (!description || !dateStr) return;

    const lines: { accountId: string; debit: number; credit: number; description: string }[] = [];
    for (let i = 0; i < 10; i++) {
      const accountId = ((fd.get(`lines[${i}][accountId]`) as string) || "").trim();
      if (!accountId) continue;
      const debit  = parseFloat((fd.get(`lines[${i}][debit]`)  as string) || "0") || 0;
      const credit = parseFloat((fd.get(`lines[${i}][credit]`) as string) || "0") || 0;
      const desc   = ((fd.get(`lines[${i}][description]`) as string) || "").trim();
      if (debit > 0 || credit > 0) lines.push({ accountId, debit, credit, description: desc });
    }
    if (lines.length < 2) return { error: "At least 2 lines are required." };

    const totalDebit  = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01)
      return { error: `Entry is not balanced — debits ${totalDebit.toFixed(2)} ≠ credits ${totalCredit.toFixed(2)}.` };

    // Per-year sequence (was a lifetime count, so year-stamped numbers desynced).
    const entryYear   = new Date(dateStr).getFullYear();
    const inner       = `JE-${entryYear}-`;
    const existingNumbers = await db.journalEntry.findMany({ where: { entryNumber: { contains: inner } }, select: { entryNumber: true } });
    const entryNumber = `${inner}${String(maxNumberSequence(inner, existingNumbers.map((e) => e.entryNumber)) + 1).padStart(4, "0")}`;

    const entry = await db.journalEntry.create({
      data: {
        orgId: _u.orgId,
        entryNumber,
        date: new Date(dateStr),
        description,
        reference,
        status: "DRAFT",
        totalAmount: totalDebit,
        createdById: _u.id,
        lines: { create: lines },
      },
      select: { id: true },
    });
    await writeSystemAuditEvent({
      orgId: _u.orgId,
      actorUserId: _u.id,
      entityType: "JournalEntry",
      entityId: entry.id,
      action: "JOURNAL_ENTRY_CREATED",
      summary: `${entryNumber} — ${description} (${totalDebit.toLocaleString()})`,
    });
    revalidatePath("/finance/journal");
    return { ok: true };
  }

  async function postEntry(fd: FormData) {
    "use server";
    const { user: _u } = await getCurrentUserRole();
    if (!_u.orgId) return;
    const _db = orgDb(_u.orgId);
    const id = fd.get("id") as string;
    const entry = await _db.journalEntry.findFirst({ where: { id, status: "DRAFT" } });
    if (!entry) return;
    await _db.journalEntry.update({ where: { id }, data: { status: "POSTED", postedAt: new Date() } });
    await writeSystemAuditEvent({
      orgId: _u.orgId,
      actorUserId: _u.id,
      entityType: "JournalEntry",
      entityId: id,
      action: "JOURNAL_ENTRY_POSTED",
      summary: `${entry.entryNumber} posted`,
    });
    revalidatePath("/finance/journal");
  }

  async function voidEntry(fd: FormData) {
    "use server";
    const { user: _u } = await getCurrentUserRole();
    if (!_u.orgId) return;
    const _db = orgDb(_u.orgId);
    const id = fd.get("id") as string;
    const entry = await _db.journalEntry.findFirst({ where: { id, status: "POSTED" } });
    if (!entry) return;
    await _db.journalEntry.update({ where: { id }, data: { status: "VOID" } });
    revalidatePath("/finance/journal");
  }

  async function deleteEntry(fd: FormData) {
    "use server";
    const { user: _u } = await getCurrentUserRole();
    if (!_u.orgId) return;
    const _db = orgDb(_u.orgId);
    const id = fd.get("id") as string;
    const entry = await _db.journalEntry.findFirst({ where: { id, status: "DRAFT" } });
    if (!entry) return;
    await _db.journalEntry.delete({ where: { id } });
    revalidatePath("/finance/journal");
  }

  // ── Data fetch ────────────────────────────────────────────────────────────
  const searchWhere = searchQ
    ? {
        OR: [
          { description: { contains: searchQ } },
          { reference:   { contains: searchQ } },
          { entryNumber: { contains: searchQ } },
        ],
      }
    : {};

  const entriesWhere = {
    ...(statusFilter !== "all" ? { status: statusFilter as JournalEntryStatus } : {}),
    date: periodFilter,
    ...searchWhere,
  };

  const [
    entries,
    total,
    filteredPostedStats,
    accounts,
    thisMonthStats,
    lastMonthStats,
    ytdStats,
    draftCount,
    voidCount,
  ] = await Promise.all([
    db.journalEntry.findMany({
      where: entriesWhere,
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        lines: {
          include: { account: { select: { code: true, name: true } } },
          orderBy: { debit: "desc" },
        },
      },
    }),
    db.journalEntry.count({ where: entriesWhere }),
    // Whole-dataset "posted total" for the filtered view (simple, non-converted
    // sum → SQL aggregate); stays correct after the list is paginated.
    db.journalEntry.aggregate({
      where: { AND: [entriesWhere, { status: "POSTED" }] },
      _sum: { totalAmount: true },
    }),
    db.chartOfAccount.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    db.journalEntry.aggregate({
      where: { status: "POSTED", date: { gte: thisMonthStart } },
      _sum: { totalAmount: true },
      _count: true,
    }),
    db.journalEntry.aggregate({
      where: { status: "POSTED", date: { gte: lastMonthStart, lte: lastMonthEnd } },
      _sum: { totalAmount: true },
      _count: true,
    }),
    db.journalEntry.aggregate({
      where: { status: "POSTED", date: { gte: ytdStart } },
      _sum: { totalAmount: true },
      _count: true,
    }),
    db.journalEntry.count({ where: { status: "DRAFT" } }),
    db.journalEntry.count({ where: { status: "VOID" } }),
  ]);

  // ── KPI computations ──────────────────────────────────────────────────────
  const thisMonthAmt = thisMonthStats._sum.totalAmount ?? 0;
  const lastMonthAmt = lastMonthStats._sum.totalAmount ?? 0;
  const ytdAmt       = ytdStats._sum.totalAmount ?? 0;
  const ytdCount     = ytdStats._count;
  const avgEntryAmt  = ytdCount > 0 ? ytdAmt / ytdCount : 0;

  const momChange =
    lastMonthAmt > 0
      ? ((thisMonthAmt - lastMonthAmt) / lastMonthAmt) * 100
      : null;

  // Period label
  const periodLabel =
    month > 0
      ? `${MONTHS[month - 1]} ${year}`
      : `Year ${year}`;

  const availableYears = [now.getFullYear() - 1, now.getFullYear()];

  // Filtered summary — whole-dataset posted total (not just the current page)
  const filteredTotal = filteredPostedStats._sum.totalAmount ?? 0;

  const pageView = paginationView(page, total);
  const journalHref = pageHrefBuilder("/finance/journal", {
    month: month > 0 ? String(month) : "",
    year: String(year),
    status: statusFilter !== "all" ? statusFilter : "",
    q: searchQ,
  });

  return (
    <div className="space-y-4">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="Finance"
        title="Journal Entries"
        description="Double-entry ledger — every entry's debits must equal its credits"
        actions={
          <>
            <Link
              href="/finance/accounts"
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] hover:bg-[var(--panel-strong)]"
            >
              Chart of Accounts
            </Link>
            <Link
              href="/finance/reports/pl"
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] hover:bg-[var(--panel-strong)]"
            >
              P&amp;L →
            </Link>
          </>
        }
      />

      <StatCards columns={4} cards={[
          {
            label: "Posted This Month",
            value: formatMoneyCompact(thisMonthAmt, currency),
            sub: `${thisMonthStats._count} entr${thisMonthStats._count === 1 ? "y" : "ies"}${
              momChange !== null
                ? ` · ${momChange >= 0 ? "+" : ""}${momChange.toFixed(1)}% vs last mo.`
                : ""
            }`,
          },
          {
            label: "YTD Posted",
            value: formatMoneyCompact(ytdAmt, currency),
            sub: `${ytdCount} posted entr${ytdCount === 1 ? "y" : "ies"} in ${now.getFullYear()}`,
          },
          {
            label: "Drafts Pending",
            value: draftCount,
            valueClass: draftCount > 0 ? "text-amber-600" : undefined,
            sub: draftCount > 0 ? "Need review & posting" : "All entries posted",
          },
          {
            label: "Avg Entry (YTD)",
            value: formatMoneyCompact(avgEntryAmt, currency),
            sub: `${voidCount} voided entr${voidCount === 1 ? "y" : "ies"} this year`,
          },
        ]} />

      {/* ── NEW ENTRY FORM ─────────────────────────────────────────────────── */}
      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] p-6 text-center text-sm text-[var(--ink-muted)]">
          Set up your{" "}
          <Link href="/finance/accounts" className="text-[var(--accent)] underline">
            chart of accounts
          </Link>{" "}
          before recording journal entries.
        </div>
      ) : (
        <details className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <summary className="cursor-pointer list-none px-4 py-2.5 text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--panel-strong)]/40 group-open:border-b group-open:border-[var(--line)]">
            + New Journal Entry
          </summary>
          <NewJournalEntryForm accounts={accounts} createEntry={createEntry} />
        </details>
      )}

      {/* ── FILTERS ────────────────────────────────────────────────────────── */}
      <form method="GET" className="hidden lg:flex flex-wrap items-center gap-2">
        <select
          name="month"
          defaultValue={month}
          className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[13px]"
        >
          <option value="0">All months</option>
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          name="year"
          defaultValue={year}
          className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[13px]"
        >
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={statusFilter}
          className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[13px]"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search description, reference…"
          className="min-w-[180px] flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[13px]"
        />
        <button
          type="submit"
          className="btn-premium-secondary rounded-lg px-4 py-2 text-sm font-semibold"
        >
          Filter
        </button>
        {(month > 0 || statusFilter !== "all" || searchQ) && (
          <Link
            href="/finance/journal"
            className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink-muted)] hover:bg-[var(--panel)]"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Period summary bar */}
      {total > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg bg-[var(--panel-strong)]/50 px-4 py-2.5">
          <span className="text-xs text-[var(--ink-muted)]">
            <span className="font-semibold text-[var(--ink)]">{total}</span>{" "}
            {statusFilter === "all" ? "entries" : statusFilter.toLowerCase() + " entries"}{" "}
            in <span className="font-semibold">{periodLabel}</span>
          </span>
          {filteredTotal > 0 && (
            <span className="text-xs text-[var(--ink-muted)]">
              Posted total:{" "}
              <span className="font-semibold text-emerald-600">
                {formatMoney(filteredTotal, currency)}
              </span>
            </span>
          )}
          {draftCount > 0 && statusFilter !== "POSTED" && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0" aria-hidden><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              {draftCount} draft{draftCount !== 1 ? "s" : ""} awaiting posting
            </span>
          )}
        </div>
      )}

      {/* ── ENTRIES LIST ───────────────────────────────────────────────────── */}
      {total === 0 ? (
        <PageEmptyState
          title="No journal entries found for this period."
          description={
            searchQ
              ? "Try a different search term or clear the filter."
              : "Adjust the filters above or create a new entry."
          }
        />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const lineDebit  = entry.lines.reduce((s, l) => s + l.debit,  0);
            const lineCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
            const balanced   = Math.abs(lineDebit - lineCredit) < 0.01;
            return (
              <div
                key={entry.id}
                className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]"
              >
                {/* ── Entry header row ─────────────────────────── */}
                <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--panel)]/50 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="mono text-xs font-bold text-[var(--accent)]">
                      {entry.entryNumber}
                    </span>
                    <StatusBadge tone={toneFor(STATUS_TONES, entry.status)} dot>
                      {entry.status}
                    </StatusBadge>
                    {!balanced && (
                      <StatusBadge tone="danger" dot>UNBALANCED</StatusBadge>
                    )}
                    <span className="text-xs text-[var(--ink-muted)]">
                      {new Date(entry.date).toLocaleDateString("en-UG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold tabular-nums text-[var(--ink)]">
                      {formatMoney(entry.totalAmount, currency)}
                    </p>
                    <RowActionsMenu label="Entry actions">
                      <MenuSection label="Actions" />
                      {entry.status === "DRAFT" && (
                        <form action={postEntry}>
                          <input type="hidden" name="id" value={entry.id} />
                          <button
                            type="submit"
                            className="w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--panel)]"
                          >
                            ✓ Post Entry
                          </button>
                        </form>
                      )}
                      {entry.status === "POSTED" && (
                        <form action={voidEntry}>
                          <input type="hidden" name="id" value={entry.id} />
                          <button
                            type="submit"
                            className="w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--panel)]"
                          >
                            Void Entry
                          </button>
                        </form>
                      )}
                      {entry.status === "DRAFT" && (
                        <MenuDestructiveRow>
                          <form action={deleteEntry}>
                            <input type="hidden" name="id" value={entry.id} />
                            <ConfirmSubmitButton
                              message="Delete this draft entry? This cannot be undone."
                              className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400"
                            >
                              Delete Draft
                            </ConfirmSubmitButton>
                          </form>
                        </MenuDestructiveRow>
                      )}
                    </RowActionsMenu>
                  </div>
                </div>

                {/* ── Description + reference ──────────────────── */}
                <div className="flex items-baseline gap-3 px-4 py-2.5">
                  <p className="text-sm font-medium text-[var(--ink)]">{entry.description}</p>
                  {entry.reference && (
                    <span className="rounded bg-[var(--panel-strong)] px-1.5 py-0.5 mono text-[13px] text-[var(--ink-muted)]">
                      {entry.reference}
                    </span>
                  )}
                </div>

                {/* ── Lines table ──────────────────────────────── */}
                <div className="px-4 pb-3.5">
                  <DataTable
                    frameless
                    dense
                    rows={entry.lines}
                    getRowKey={(line) => line.id}
                    columns={[
                      {
                        key: "account",
                        header: "Account",
                        cell: (line) => (
                          <>
                            <span className="mono text-[var(--accent)]">{line.account.code}</span>
                            <span className="ml-1.5 text-[var(--ink-muted)]">{line.account.name}</span>
                          </>
                        ),
                      },
                      {
                        key: "memo",
                        header: "Memo",
                        className: "max-w-[200px] truncate text-[var(--ink-muted)]",
                        cell: (line) => line.description || "—",
                      },
                      {
                        key: "debit",
                        header: "Debit",
                        align: "right",
                        className: "font-medium text-[var(--ink)] whitespace-nowrap tabular-nums",
                        cell: (line) => (line.debit > 0 ? formatMoney(line.debit, currency) : ""),
                      },
                      {
                        key: "credit",
                        header: "Credit",
                        align: "right",
                        className: "text-[var(--ink-muted)] whitespace-nowrap tabular-nums",
                        cell: (line) => (line.credit > 0 ? formatMoney(line.credit, currency) : ""),
                      },
                    ]}
                    tableFooter={
                      <>
                        <tr>
                          <td colSpan={2} className="px-3 py-2 text-[12px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
                            Totals
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-[var(--ink)]">
                            {formatMoney(lineDebit, currency)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-[var(--ink-muted)]">
                            {formatMoney(lineCredit, currency)}
                          </td>
                        </tr>
                        {!balanced && (
                          <tr>
                            <td colSpan={4} className="px-3 pb-2 text-right text-[12px] font-semibold text-red-500">
                              Imbalance: {formatMoney(Math.abs(lineDebit - lineCredit), currency)}
                            </td>
                          </tr>
                        )}
                      </>
                    }
                  />
                </div>
              </div>
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
        unit="entries"
        hrefForPage={journalHref}
      />

      {/* ── QUICK LINKS ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
        <Link
          href="/finance/accounts"
          className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] hover:bg-[var(--panel)]"
        >
          Chart of Accounts
        </Link>
        <Link
          href="/finance/reports/pl"
          className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] hover:bg-[var(--panel)]"
        >
          P&amp;L Report
        </Link>
        <Link
          href="/finance/reports/balance-sheet"
          className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] hover:bg-[var(--panel)]"
        >
          Balance Sheet
        </Link>
        <Link
          href="/finance/bank"
          className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] hover:bg-[var(--panel)]"
        >
          Bank Accounts
        </Link>
        <Link
          href="/finance/expenses"
          className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] hover:bg-[var(--panel)]"
        >
          Expenses
        </Link>
      </div>
    </div>
  );
}
