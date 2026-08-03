import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/session";

import { prisma } from "@/lib/prisma";
import { orgDb } from "@/lib/db";
import { formatMoney, formatMoneyCompact } from "@/lib/currency";
import { can } from "@/lib/permissions";
import { DataTable } from "@/components/ui/DataTable";
import { toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import { RecordActionBar } from "@/components/record/RecordActionBar";
import { RecordSummaryRail } from "@/components/record/RecordSummaryRail";

export const dynamic = "force-dynamic";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const TYPE_TONES: Record<string, BadgeTone> = {
  ASSET:     "info",
  LIABILITY: "danger",
  EQUITY:    "purple",
  REVENUE:   "success",
  EXPENSE:   "warning",
};

export default async function AccountLedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { user } = await getCurrentUserRole();
  const db = orgDb(user.orgId);
  if (!can.viewFinancials(user)) redirect("/dashboard");

  const { id } = await params;
  const sp = await searchParams;

  const now = new Date();
  const year  = parseInt(sp.year  ?? String(now.getFullYear()));
  const month = parseInt(sp.month ?? "0"); // 0 = all time

  const account = await db.chartOfAccount.findFirst({
    where: { id },
    include: { parent: { select: { code: true, name: true } } },
  });
  if (!account) notFound();

  // Date filter
  const dateFilter =
    month > 0
      ? { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0, 23, 59, 59) }
      : year !== now.getFullYear()
        ? { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) }
        : undefined;

  const lines = await prisma.journalLine.findMany({
    where: {
      accountId: id,
      journalEntry: {
        status: "POSTED",
        ...(dateFilter ? { date: dateFilter } : {}),
      },
    },
    include: {
      journalEntry: {
        select: {
          entryNumber: true,
          date: true,
          description: true,
          reference: true,
        },
      },
    },
    orderBy: { journalEntry: { date: "asc" } },
  });

  // Also fetch all-time lines for running balance from beginning
  const allLines = await prisma.journalLine.findMany({
    where: {
      accountId: id,
      journalEntry: { status: "POSTED" },
    },
    include: { journalEntry: { select: { date: true } } },
    orderBy: { journalEntry: { date: "asc" } },
  });

  const currency = "UGX";
  const isDebitNormal = account.type === "ASSET" || account.type === "EXPENSE";

  // Running balance from start up to filter start (opening balance for period)
  let openingBalance = 0;
  if (dateFilter?.gte) {
    for (const l of allLines) {
      if (l.journalEntry.date < dateFilter.gte) {
        openingBalance += isDebitNormal ? l.debit - l.credit : l.credit - l.debit;
      }
    }
  }

  // Build rows with running balance
  const rows = lines.reduce<Array<(typeof lines)[number] & { net: number; runningBalance: number }>>((acc, l) => {
    const previous = acc.at(-1)?.runningBalance ?? openingBalance;
    const net = isDebitNormal ? l.debit - l.credit : l.credit - l.debit;
    acc.push({
      ...l,
      net,
      runningBalance: previous + net,
    });
    return acc;
  }, []);

  const totalDebit  = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const closingBalance = openingBalance + rows.reduce((s, r) => s + r.net, 0);

  // All-time balance
  const allTimeBalance = allLines.reduce(
    (s, l) => s + (isDebitNormal ? l.debit - l.credit : l.credit - l.debit),
    0,
  );

  // Period label
  const periodLabel =
    month > 0
      ? `${MONTHS[month - 1]} ${year}`
      : year !== now.getFullYear()
        ? `Year ${year}`
        : "All Time";

  const availableYears = [now.getFullYear() - 1, now.getFullYear()];

  // Explicit ledger-row shape so the synthetic opening-balance row and the real
  // journal lines share one type. `journalEntry` is null only for the opening
  // row; `runningBalance` has a real home on the type instead of being attached
  // untyped.
  type LedgerRow = {
    id: string;
    journalEntry: { entryNumber: string; date: Date; description: string; reference: string | null } | null;
    description: string | null;
    debit: number;
    credit: number;
    net: number;
    runningBalance: number;
  };

  const openingRow: LedgerRow = {
    id: "__opening__",
    journalEntry: null,
    description: null,
    debit: 0,
    credit: 0,
    net: 0,
    runningBalance: openingBalance,
  };

  const ledgerRows: LedgerRow[] =
    lines.length === 0
      ? []
      : openingBalance !== 0
        ? [openingRow, ...rows]
        : rows;

  // Most-recent postings for the summary rail activity trail.
  const recentActivity = [...rows]
    .slice(-6)
    .reverse()
    .map((r) => ({
      label: `${r.journalEntry.entryNumber} · ${r.net < 0 ? "−" : "+"}${formatMoney(Math.abs(r.net), currency)}`,
      at: new Date(r.journalEntry.date).toLocaleDateString("en-UG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    }));

  return (
    <div className="space-y-4">
      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <RecordActionBar
        backHref="/finance/accounts"
        eyebrow="Finance · Account"
        title={`${account.code} · ${account.name}`}
        status={{ label: account.type, tone: toneFor(TYPE_TONES, account.type) }}
        secondary={
          <Link href="/finance/reports/pl" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] hover:bg-[var(--panel)]">
            P&L →
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
      {(account.parent || account.description) && (
        <p className="text-[13px] text-[var(--ink-muted)]">
          {account.parent ? <>under <span className="mono">{account.parent.code}</span> {account.parent.name}</> : null}
          {account.parent && account.description ? " · " : null}
          {account.description ?? ""}
        </p>
      )}

      {/* ── PERIOD SELECTOR ──────────────────────────────────────────────── */}
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
        <button
          type="submit"
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black"
        >
          Filter
        </button>
        {(month > 0 || year !== now.getFullYear()) && (
          <Link
            href={`/finance/accounts/${id}`}
            className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink-muted)] hover:bg-[var(--panel)]"
          >
            Clear
          </Link>
        )}
      </form>

      {/* ── KPI TILES ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
            All-Time Balance
          </p>
          <p className={`mt-1 text-lg font-bold tabular-nums ${allTimeBalance >= 0 ? "text-[var(--ink)]" : "text-red-500"}`}>
            {allTimeBalance < 0 ? "−" : ""}
            {formatMoneyCompact(Math.abs(allTimeBalance), currency)}
          </p>
          <p className="mt-1 text-[13px] text-[var(--ink-muted)]">{allLines.length} postings</p>
        </div>

        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
            {periodLabel} — Debits
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[var(--ink)]">
            {formatMoneyCompact(totalDebit, currency)}
          </p>
        </div>

        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
            {periodLabel} — Credits
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[var(--ink)]">
            {formatMoneyCompact(totalCredit, currency)}
          </p>
        </div>

        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Closing Balance</p>
          <p className={`mt-1 text-lg font-bold tabular-nums ${closingBalance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {closingBalance < 0 ? "−" : ""}
            {formatMoneyCompact(Math.abs(closingBalance), currency)}
          </p>
          <p className="mt-1 text-[13px] text-[var(--ink-muted)]">{lines.length} transactions</p>
        </div>
      </div>

      {/* ── LEDGER TABLE ─────────────────────────────────────────────────── */}
      <DataTable
        rows={ledgerRows}
        getRowKey={(row) => row.id}
        empty="No posted transactions for this period."
        rowClassName={(row) => (row.id === "__opening__" ? "bg-[var(--panel-strong)]/50" : undefined)}
        columns={[
          {
            key: "date",
            header: "Date",
            className: "whitespace-nowrap text-[12px] text-[var(--ink-muted)]",
            cell: (row) =>
              !row.journalEntry
                ? "—"
                : new Date(row.journalEntry.date).toLocaleDateString("en-UG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }),
          },
          {
            key: "entry",
            header: "Entry",
            cell: (row) =>
              !row.journalEntry ? null : (
                <span className="mono font-semibold text-[var(--accent)]">
                  {row.journalEntry.entryNumber}
                </span>
              ),
          },
          {
            key: "description",
            header: "Description",
            cell: (row) =>
              !row.journalEntry ? (
                <span className="italic text-[var(--ink-muted)]">Opening balance</span>
              ) : (
                <span className="font-medium text-[var(--ink)]">
                  {row.journalEntry.description}
                  {row.journalEntry.reference && (
                    <span className="ml-1.5 font-normal text-[var(--ink-muted)]">
                      · {row.journalEntry.reference}
                    </span>
                  )}
                </span>
              ),
          },
          {
            key: "memo",
            header: "Memo",
            headerClassName: "hidden md:table-cell",
            className: "hidden text-[12px] text-[var(--ink-muted)] md:table-cell",
            cell: (row) => (row.id === "__opening__" ? null : row.description || "—"),
          },
          {
            key: "debit",
            header: "Debit",
            align: "right",
            className: "tabular-nums whitespace-nowrap",
            cell: (row) =>
              row.id === "__opening__" ? null : row.debit > 0 ? (
                <span className="font-medium text-[var(--ink)]">{formatMoney(row.debit, currency)}</span>
              ) : (
                <span className="text-[var(--ink-muted)]">—</span>
              ),
          },
          {
            key: "credit",
            header: "Credit",
            align: "right",
            className: "tabular-nums whitespace-nowrap",
            cell: (row) =>
              row.id === "__opening__" ? null : row.credit > 0 ? (
                <span className="text-[var(--ink-muted)]">{formatMoney(row.credit, currency)}</span>
              ) : (
                <span className="text-[var(--ink-muted)]">—</span>
              ),
          },
          {
            key: "balance",
            header: "Balance",
            align: "right",
            className: "whitespace-nowrap tabular-nums",
            cell: (row) =>
              row.id === "__opening__" ? (
                <span className="font-semibold tabular-nums text-[var(--ink-muted)]">
                  {formatMoney(openingBalance, currency)}
                </span>
              ) : (
                <span
                  className={`text-[12px] font-semibold tabular-nums ${
                    row.runningBalance >= 0 ? "text-[var(--ink)]" : "text-red-600"
                  }`}
                >
                  {row.runningBalance < 0 ? "−" : ""}
                  {formatMoney(Math.abs(row.runningBalance), currency)}
                </span>
              ),
          },
        ]}
        tableFooter={
          <tr>
            <td colSpan={4} className="px-4 py-3 font-bold text-[var(--ink)]">Totals</td>
            <td className="px-4 py-3 text-right font-bold tabular-nums text-[var(--ink)]">
              {formatMoney(totalDebit, currency)}
            </td>
            <td className="px-4 py-3 text-right font-bold tabular-nums text-[var(--ink-muted)]">
              {formatMoney(totalCredit, currency)}
            </td>
            <td
              className={`px-4 py-3 text-right text-sm font-bold tabular-nums ${
                closingBalance >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {closingBalance < 0 ? "−" : ""}
              {formatMoney(Math.abs(closingBalance), currency)}
            </td>
          </tr>
        }
      />
        </div>

        <RecordSummaryRail
          headline={{
            label: "All-time balance",
            value: `${allTimeBalance < 0 ? "−" : ""}${formatMoney(Math.abs(allTimeBalance), currency)}`,
            tone: allTimeBalance >= 0 ? "good" : "crit",
          }}
          rows={[
            { label: "Code", value: <span className="mono">{account.code}</span> },
            { label: "Type", value: account.type },
            { label: "Normal balance", value: isDebitNormal ? "Debit" : "Credit" },
            { label: "Postings", value: allLines.length },
            ...(account.parent
              ? [{ label: "Parent", value: `${account.parent.code} · ${account.parent.name}` }]
              : []),
          ]}
          activity={recentActivity}
        />
      </div>
    </div>
  );
}
