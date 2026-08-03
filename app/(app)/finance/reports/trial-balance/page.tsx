import { StatCards } from "@/components/ui/StatCards";
import { PrintReportButton } from "@/components/reports/PrintReportButton";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrgSession } from "@/lib/org-context";

import { prisma } from "@/lib/prisma";
import { formatMoney, formatMoneyCompact } from "@/lib/currency";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
type TrialRow = { code: string; name: string; type: AccountType; debit: number; credit: number };

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { user, orgId, org } = await requireOrgSession();
  if (!can.viewFinancials(user)) redirect("/dashboard");

  const sp = await searchParams;
  const currency = org.baseCurrency;
  const now = new Date();
  const year = parseInt(sp.year ?? String(now.getFullYear()));
  const month = parseInt(sp.month ?? String(now.getMonth() + 1));

  // Trial balance is a cumulative snapshot of all posted activity up to a date.
  const asOf = new Date(year, month, 0, 23, 59, 59);

  // Org-scoped (avoid the C3-class cross-tenant leak the finance reports had).
  const lines = await prisma.journalLine.findMany({
    where: { journalEntry: { orgId, status: "POSTED", date: { lte: asOf } } },
    include: { account: { select: { code: true, name: true, type: true } } },
  });

  // Net each account, then place its balance in the natural column.
  const byAccount = new Map<string, { code: string; name: string; type: AccountType; net: number }>();
  for (const l of lines) {
    const net = l.debit - l.credit;
    const existing = byAccount.get(l.accountId);
    if (existing) existing.net += net;
    else byAccount.set(l.accountId, { code: l.account.code, name: l.account.name, type: l.account.type as AccountType, net });
  }

  const rows: TrialRow[] = [...byAccount.values()]
    .filter((a) => Math.abs(a.net) >= 0.01)
    .map((a) => ({
      code: a.code,
      name: a.name,
      type: a.type,
      debit: a.net > 0 ? a.net : 0,
      credit: a.net < 0 ? -a.net : 0,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const difference = totalDebit - totalCredit;
  const balanced = Math.abs(difference) < 0.01;
  const hasData = rows.length > 0;

  return (
    <div className="print-area space-y-4">
      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <p className="text-[12px] uppercase tracking-[0.16em] text-[var(--ink-muted)]">Finance · Reports</p>
            <p className="text-[13px] font-bold text-[var(--ink)]">Trial Balance</p>
            <p className="text-[13px] text-[var(--ink-muted)]">As of {MONTHS[month - 1]} {year}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PrintReportButton />
            <Link
              href={`/finance/reports/pl?year=${year}&month=${month}`}
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--panel-strong)]"
            >
              ← P&amp;L
            </Link>
            <Link
              href={`/finance/reports/balance-sheet?year=${year}&month=${month}`}
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--panel-strong)]"
            >
              Balance Sheet
            </Link>
            <Link
              href="/finance/accounts"
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--panel-strong)]"
            >
              Chart of Accounts
            </Link>
          </div>
        </div>
      </div>

      {/* ── PERIOD SELECTOR ──────────────────────────────────────────────── */}
      <form method="GET" className="no-print flex items-center gap-2">
        <select name="month" defaultValue={month} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[13px]">
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select name="year" defaultValue={year} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[13px]">
          {[year - 2, year - 1, year, year + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black">
          View
        </button>
      </form>

      {!hasData ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] py-14 text-center">
          <p className="text-sm text-[var(--ink-muted)]">No posted accounting entries up to this date.</p>
        </div>
      ) : (
        <>
          {!balanced && (
            <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              Trial balance does not balance — debits and credits differ by {formatMoney(Math.abs(difference), currency)}. A journal entry is missing a line or is itself unbalanced.
            </div>
          )}

          <StatCards
            columns={4}
            cards={[
              { key: "debits", label: "Total debits", value: formatMoneyCompact(totalDebit, currency), sub: "cumulative to date", tone: "accent" },
              { key: "credits", label: "Total credits", value: formatMoneyCompact(totalCredit, currency), sub: "cumulative to date", tone: "accent" },
              {
                key: "difference",
                label: "Difference",
                value: `${difference < 0 ? "−" : ""}${formatMoneyCompact(Math.abs(difference), currency)}`,
                sub: "debits − credits",
                tone: balanced ? "good" : "crit",
                muted: balanced,
              },
              { key: "accounts", label: "Accounts", value: String(rows.length), sub: "with a balance", tone: "neutral" },
            ]}
          />

          {/* ── LEDGER TABLE ─────────────────────────────────────────────── */}
          <div className="panel-shadow overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-[12px] uppercase tracking-wide text-[var(--ink-muted)]">
                  <th className="px-4 py-2.5 text-left font-bold">Account</th>
                  <th className="px-4 py-2.5 text-left font-bold">Type</th>
                  <th className="px-4 py-2.5 text-right font-bold">Debit</th>
                  <th className="px-4 py-2.5 text-right font-bold">Credit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code} className="border-b border-[var(--line)]/60 last:border-0 odd:bg-[var(--bg)]/40">
                    <td className="px-4 py-2.5">
                      <span className="mr-2 mono text-xs text-[var(--accent)]">{r.code}</span>
                      <span className="text-[var(--ink)]">{r.name}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-[var(--ink-muted)]">{r.type}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.debit ? formatMoney(r.debit, currency) : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.credit ? formatMoney(r.credit, currency) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--line)] font-bold">
                  <td className="px-4 py-3" colSpan={2}>Totals</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totalDebit, currency)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totalCredit, currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── BALANCE CHECK ────────────────────────────────────────────── */}
          <div
            className={`overflow-hidden rounded-xl border px-5 py-4 ${
              balanced ? "border-emerald-500/30 bg-emerald-500/8" : "border-red-300/40 bg-red-500/10"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-bold text-[var(--ink)]">Total Debits = Total Credits</p>
                <p className="text-[13px] text-[var(--ink-muted)]">
                  {formatMoney(totalDebit, currency)} = {formatMoney(totalCredit, currency)}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                  balanced ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-red-500/20 text-red-600 dark:text-red-400"
                }`}
              >
                {balanced ? "Balanced" : "Out of balance"}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
