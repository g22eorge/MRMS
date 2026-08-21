
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { BankTransactionType } from "@prisma/client";
import { getCurrentUserRole } from "@/lib/session";

import { prisma } from "@/lib/prisma";
import { orgDb } from "@/lib/db";
import { formatMoney, formatMoneyCompact } from "@/lib/currency";
import { RowActionsMenu, MenuDestructiveRow } from "@/components/shared/RowActionsMenu";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/StatCards";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";
import { PageEmptyState } from "@/components/page-state/PageEmptyState";
import { assertOrgCanMutate } from "@/lib/org-write";
import { requireOrgSession } from "@/lib/org-context";
import { FormErrorBanner } from "@/components/ui/FormErrorBanner";

export const dynamic = "force-dynamic";

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { user } = await getCurrentUserRole();
  if (!user.orgId) redirect("/dashboard");
  const orgId = user.orgId;
  const db = orgDb(orgId);
  if (!can.viewFinancials(user)) redirect("/dashboard");

  const sp = await searchParams;
  const selectedAccountId = sp.account ?? null;
  const q = sp.q?.trim() ?? "";
  const txperiod = sp.txperiod ?? "";
  const page = parsePage(sp.page);
  const currency = "UGX";

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  async function createBankAccount(fd: FormData) {
    "use server";
    const { user: actor, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: actor.role, userAccessMode: actor.accessMode, kind: "GENERAL" });
    const db = orgDb(user.orgId);
    const name = fd.get("name") as string;
    const bankName = fd.get("bankName") as string;
    const accountNumber = (fd.get("accountNumber") as string) || null;
    const openingBal = parseFloat(fd.get("openingBalance") as string) || 0;
    if (!name || !bankName) {
      redirect(`/finance/bank?error=${encodeURIComponent("Give the account a name and a bank name.")}`);
    }
    await db.bankAccount.create({
      data: { name, bankName, accountNumber, openingBalance: openingBal, currentBalance: openingBal, orgId },
    });
    revalidatePath("/finance/bank");
  }

  async function addTransaction(fd: FormData) {
    "use server";
    const { user: actor, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: actor.role, userAccessMode: actor.accessMode, kind: "GENERAL" });
    const db = orgDb(user.orgId);
    const bankAccountId = fd.get("bankAccountId") as string;
    const date = fd.get("date") as string;
    const description = fd.get("description") as string;
    const amount = parseFloat(fd.get("amount") as string) || 0;
    const type = fd.get("type") as BankTransactionType;
    const reference = (fd.get("reference") as string) || null;
    if (!bankAccountId) return;
    if (!date || !description || amount <= 0) {
      redirect(`/finance/bank?error=${encodeURIComponent("A transaction needs a date, a description and an amount greater than zero.")}`);
    }

    const balanceDelta = type === "CREDIT" ? amount : -amount;
    await prisma.$transaction([
      prisma.bankTransaction.create({
        data: { bankAccountId, date: new Date(date), description, amount, type, reference, orgId },
      }),
      db.bankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: { increment: balanceDelta } },
      }),
    ]);
    revalidatePath("/finance/bank");
  }

  async function reconcile(fd: FormData) {
    "use server";
    const { user, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
    const id = fd.get("id") as string;
    if (!user.orgId) return;
    // Verify org ownership before toggling — otherwise any staff could reconcile
    // another tenant's bank transaction by posting its id.
    const tx = await prisma.bankTransaction.findFirst({ where: { id, orgId: user.orgId } });
    if (!tx) return;
    await prisma.bankTransaction.update({
      where: { id },
      data: { reconciledAt: tx.reconciledAt ? null : new Date() },
    });
    revalidatePath("/finance/bank");
  }

  async function deleteBankAccount(fd: FormData) {
    "use server";
    const { user: actor, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: actor.role, userAccessMode: actor.accessMode, kind: "GENERAL" });
    const db = orgDb(user.orgId);
    const id = fd.get("id") as string;
    await db.bankAccount.delete({ where: { id } });
    revalidatePath("/finance/bank");
  }

  const [bankAccounts, globalMonthStats] = await Promise.all([
    db.bankAccount.findMany({
      where: {},
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { transactions: true } } },
    }),
    Promise.all([
      prisma.bankTransaction.aggregate({
        where: { type: "CREDIT", date: { gte: thisMonthStart } },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: null } })),
      prisma.bankTransaction.aggregate({
        where: { type: "DEBIT", date: { gte: thisMonthStart } },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: null } })),
    ]),
  ]);
  const [globalCreditsAgg, globalDebitsAgg] = globalMonthStats;
  const globalCreditsThisMonth = globalCreditsAgg._sum.amount ?? 0;
  const globalDebitsThisMonth = globalDebitsAgg._sum.amount ?? 0;

  const activeAccount = selectedAccountId
    ? bankAccounts.find((a) => a.id === selectedAccountId)
    : bankAccounts[0];

  const allTransactions = activeAccount
    ? await prisma.bankTransaction.findMany({
        where: { bankAccountId: activeAccount.id },
        orderBy: { date: "asc" },
      })
    : [];

  // Apply search + period filter
  const transactions = allTransactions.filter((t) => {
    if (q && !t.description.toLowerCase().includes(q.toLowerCase()) && !t.reference?.toLowerCase().includes(q.toLowerCase())) return false;
    if (txperiod === "month") return t.date >= thisMonthStart && t.date <= thisMonthEnd;
    if (txperiod === "last") return t.date >= lastMonthStart && t.date <= lastMonthEnd;
    return true;
  });

  // Compute running balance for each transaction (from oldest to newest)
  const openingBalance = activeAccount?.openingBalance ?? 0;
  const txWithBalance = allTransactions.reduce<Array<(typeof allTransactions)[number] & { runningBalance: number }>>((acc, tx) => {
    const previous = acc.at(-1)?.runningBalance ?? openingBalance;
    const delta = tx.type === "CREDIT" ? tx.amount : -tx.amount;
    acc.push({ ...tx, runningBalance: previous + delta });
    return acc;
  }, []);
  // Map for lookup by ID
  const balanceById = new Map(txWithBalance.map((t) => [t.id, t.runningBalance]));

  // Newest-first view of the filtered transactions + ledger totals
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const txCreditsTotal = transactions.filter((t) => t.type === "CREDIT").reduce((s, t) => s + t.amount, 0);
  const txDebitsTotal = transactions.filter((t) => t.type === "DEBIT").reduce((s, t) => s + t.amount, 0);

  // Paginate the displayed transactions; KPIs/totals above stay whole-dataset.
  const txPageView = paginationView(page, sortedTransactions.length);
  const pageTransactions = sortedTransactions.slice(txPageView.skip, txPageView.skip + txPageView.take);
  const bankHref = pageHrefBuilder("/finance/bank", {
    account: activeAccount?.id,
    q,
    txperiod: txperiod || "",
  });

  // Period analysis for active account
  const thisMonthTx = allTransactions.filter(
    (t) => t.date >= thisMonthStart && t.date <= thisMonthEnd,
  );
  const monthCredits = thisMonthTx.filter((t) => t.type === "CREDIT").reduce((s, t) => s + t.amount, 0);
  const monthDebits = thisMonthTx.filter((t) => t.type === "DEBIT").reduce((s, t) => s + t.amount, 0);
  const _monthNet = monthCredits - monthDebits;

  const unreconciledTx = allTransactions.filter((t) => !t.reconciledAt);
  const unreconciledAmount = unreconciledTx.reduce(
    (s, t) => s + (t.type === "CREDIT" ? t.amount : -t.amount),
    0,
  );

  const totalBalance = bankAccounts.filter((a) => a.isActive).reduce((s, a) => s + a.currentBalance, 0);

  return (
    <div className="space-y-4">
      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <FormErrorBanner message={sp.error} />
      <PageHeader
        eyebrow="Finance"
        title="Bank & cash"
        description="Track the money in your bank and cash accounts."
        actions={
          <Link
            href="/finance/accounts"
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] hover:bg-[var(--panel-strong)]"
          >
            Accounts
          </Link>
        }
      />

      <StatCards columns={4} cards={[
          {
            label: "Total Accounts",
            value: bankAccounts.filter((a) => a.isActive).length,
            sub: "active bank accounts",
          },
          {
            label: "Net Bank Position",
            value: `${totalBalance < 0 ? "−" : ""}${formatMoneyCompact(Math.abs(totalBalance), currency)}`,
            valueClass: totalBalance >= 0 ? undefined : "text-red-500",
            sub: "across all accounts",
          },
          {
            label: "Credits This Month",
            value: formatMoneyCompact(globalCreditsThisMonth, currency),
            valueClass: "text-emerald-600 dark:text-emerald-400",
            sub: "all accounts",
          },
          {
            label: "Debits This Month",
            value: formatMoneyCompact(globalDebitsThisMonth, currency),
            valueClass: "text-red-500",
            sub: "all accounts",
          },
        ]} />

      {/* ── ADD BANK ACCOUNT ─────────────────────────────────────────────── */}
      <details className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <summary className="cursor-pointer list-none px-4 py-2.5 text-[0.8125rem] font-semibold text-[var(--ink)] hover:bg-[var(--panel-strong)]/40 group-open:border-b group-open:border-[var(--line)]">
          + Add Bank Account
        </summary>
        <form
          action={createBankAccount}
          className="grid grid-cols-2 gap-4 border-t border-[var(--line)] p-5 sm:grid-cols-4"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink-muted)]">Account Name *</label>
            <input
              name="name"
              required
              placeholder="Main Operations"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink-muted)]">Bank Name *</label>
            <input
              name="bankName"
              required
              placeholder="Stanbic Bank"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink-muted)]">Account Number</label>
            <input
              name="accountNumber"
              placeholder="9030012345"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink-muted)]">Opening Balance</label>
            <input
              name="openingBalance"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]"
            />
          </div>
          <div className="flex justify-end sm:col-span-4">
            <button
              type="submit"
              className="btn-premium rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Create
            </button>
          </div>
        </form>
      </details>

      {bankAccounts.length === 0 ? (
        <PageEmptyState title="No bank accounts yet" description="Add your first bank account to start recording transactions." />
      ) : (
        <div className="grid grid-cols-12 gap-5">
          {/* ── ACCOUNT SIDEBAR ──────────────────────────────────────────── */}
          <div className="col-span-12 space-y-2 lg:col-span-3">
            {bankAccounts.map((acc) => {
              const acctMonthTx = allTransactions.filter(
                (t) => t.bankAccountId === acc.id && t.date >= thisMonthStart && t.date <= thisMonthEnd,
              );
              const acctMonthNet = acctMonthTx.reduce(
                (s, t) => s + (t.type === "CREDIT" ? t.amount : -t.amount),
                0,
              );
              return (
                <a
                  key={acc.id}
                  href={`/finance/bank?account=${acc.id}`}
                  className={`block rounded-xl border p-4 transition-colors ${
                    activeAccount?.id === acc.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/5"
                      : "border-[var(--line)] bg-[var(--panel)] hover:bg-[var(--panel-strong)]"
                  }`}
                >
                  <p className="text-sm font-semibold text-[var(--ink)]">{acc.name}</p>
                  <p className="text-xs text-[var(--ink-muted)]">{acc.bankName}</p>
                  {acc.accountNumber && (
                    <p className="mono text-xs text-[var(--ink-muted)]">{acc.accountNumber}</p>
                  )}
                  <p className="mt-2 text-base font-bold tabular-nums text-[var(--ink)]">
                    {formatMoney(acc.currentBalance, currency)}
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-[0.75rem] text-[var(--ink-muted)]">
                      {acc._count.transactions} tx
                    </p>
                    {acctMonthNet !== 0 && (
                      <p
                        className={`text-[0.75rem] font-semibold ${acctMonthNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}
                      >
                        {acctMonthNet >= 0 ? "+" : "−"}
                        {formatMoneyCompact(Math.abs(acctMonthNet), currency)} this month
                      </p>
                    )}
                  </div>
                </a>
              );
            })}
          </div>

          {/* ── TRANSACTIONS PANEL ───────────────────────────────────────── */}
          <div className="col-span-12 space-y-4 lg:col-span-9">
            {activeAccount && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-[var(--ink)]">{activeAccount.name}</h2>
                    <p className="text-sm text-[var(--ink-muted)]">
                      {activeAccount.bankName}
                      {activeAccount.accountNumber ? ` · ${activeAccount.accountNumber}` : ""}
                    </p>
                  </div>
                  <RowActionsMenu label="Account actions">
                    <MenuDestructiveRow>
                      <form action={deleteBankAccount}>
                        <input type="hidden" name="id" value={activeAccount.id} />
                        <ConfirmSubmitButton
                          message="Delete this bank account and all its transactions?"
                          className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400"
                        >
                          Delete Account
                        </ConfirmSubmitButton>
                      </form>
                    </MenuDestructiveRow>
                  </RowActionsMenu>
                </div>

                {/* Reconciliation status bar */}
                {allTransactions.length > 0 && (
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[0.8125rem] font-semibold text-[var(--ink)]">Checked off</p>
                      <p className="text-[0.8125rem] text-[var(--ink-muted)]">
                        {allTransactions.filter((t) => t.reconciledAt).length} of{" "}
                        {allTransactions.length} checked
                      </p>
                    </div>
                    {unreconciledTx.length > 0 && (
                      <p className="mt-1.5 text-[0.8125rem] text-amber-600 dark:text-amber-400">
                        {unreconciledTx.length} not checked yet ·{" "}
                        {formatMoneyCompact(Math.abs(unreconciledAmount), currency)}
                      </p>
                    )}
                  </div>
                )}

                {/* ── ADD TRANSACTION ─────────────────────────────────── */}
                <details className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
                  <summary className="cursor-pointer list-none px-4 py-2.5 text-[0.8125rem] font-semibold text-[var(--ink)] hover:bg-[var(--panel-strong)]/40 group-open:border-b group-open:border-[var(--line)]">
                    + Add Transaction
                  </summary>
                  <form
                    action={addTransaction}
                    className="grid grid-cols-2 gap-3 border-t border-[var(--line)] p-4"
                  >
                    <input type="hidden" name="bankAccountId" value={activeAccount.id} />
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--ink-muted)]">Date *</label>
                      <input
                        name="date"
                        type="date"
                        required
                        defaultValue={new Date().toISOString().slice(0, 10)}
                        className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--ink-muted)]">Type *</label>
                      <select
                        name="type"
                        className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]"
                      >
                        <option value="CREDIT">Credit (Money In)</option>
                        <option value="DEBIT">Debit (Money Out)</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--ink-muted)]">Description *</label>
                      <input
                        name="description"
                        required
                        placeholder="Payment received..."
                        className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--ink-muted)]">Amount *</label>
                      <input
                        name="amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        placeholder="0.00"
                        className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--ink-muted)]">Reference</label>
                      <input
                        name="reference"
                        placeholder="Cheque #, transfer ref..."
                        className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black"
                      >
                        Add
                      </button>
                    </div>
                  </form>
                </details>

                {/* ── SEARCH BAR ──────────────────────────────────────── */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Period chips */}
                  <div className="flex gap-1">
                    {(["All", "This month", "Last month"] as const).map((label) => {
                      const val = label === "All" ? "" : label === "This month" ? "month" : "last";
                      const active = (sp.txperiod ?? "") === val;
                      return (
                        <a key={label} href={`/finance/bank?account=${activeAccount.id}&txperiod=${val}`}
                          className={`rounded-full border px-2.5 py-1 text-[0.75rem] font-semibold transition ${active ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--ink)]"}`}>
                          {label}
                        </a>
                      );
                    })}
                  </div>
                  <form method="GET" className="flex gap-2 flex-1 min-w-0">
                    <input type="hidden" name="account" value={activeAccount.id} />
                    {sp.txperiod && <input type="hidden" name="txperiod" value={sp.txperiod} />}
                    <input name="q" defaultValue={q} placeholder="Search…"
                      className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm outline-none" />
                    <button type="submit" className="h-8 rounded-lg border border-[var(--line)] px-3 text-sm font-medium hover:bg-[var(--panel-strong)]">Search</button>
                    {q && <a href={`/finance/bank?account=${activeAccount.id}`} className="h-8 rounded-lg border border-[var(--line)] px-3 text-sm font-medium leading-8 hover:bg-[var(--panel-strong)]">Clear</a>}
                  </form>
                </div>

                {/* ── TRANSACTION TABLE ───────────────────────────────── */}
                <DataTable
                  rows={pageTransactions}
                  getRowKey={(tx) => tx.id}
                  empty={q ? "No transactions match your search." : "No transactions yet."}
                  rowClassName={(tx) => (tx.reconciledAt ? "opacity-60" : undefined)}
                  columns={[
                    {
                      key: "date",
                      header: "Date",
                      className: "whitespace-nowrap text-[0.75rem] text-[var(--ink-muted)]",
                      cell: (tx) =>
                        new Date(tx.date).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" }),
                    },
                    {
                      key: "description",
                      header: "Description",
                      cell: (tx) => (
                        <>
                          <p className="font-medium text-[var(--ink)]">{tx.description}</p>
                          {tx.reference && <p className="text-[0.75rem] text-[var(--ink-muted)]">{tx.reference}</p>}
                        </>
                      ),
                    },
                    {
                      key: "in",
                      header: "In",
                      align: "right",
                      headerClassName: "text-emerald-700 dark:text-emerald-400",
                      className: "font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap tabular-nums",
                      cell: (tx) => (tx.type === "CREDIT" ? formatMoney(tx.amount, currency) : ""),
                    },
                    {
                      key: "out",
                      header: "Out",
                      align: "right",
                      headerClassName: "text-red-700 dark:text-red-400",
                      className: "font-medium text-red-600 whitespace-nowrap tabular-nums",
                      cell: (tx) => (tx.type === "DEBIT" ? formatMoney(tx.amount, currency) : ""),
                    },
                    {
                      key: "balance",
                      header: "Balance",
                      align: "right",
                      className: "whitespace-nowrap tabular-nums",
                      cell: (tx) => {
                        const rb = balanceById.get(tx.id);
                        return (
                          <span className={`text-[0.75rem] font-semibold tabular-nums ${(rb ?? 0) >= 0 ? "text-[var(--ink)]" : "text-red-600"}`}>
                            {rb !== undefined ? `${rb < 0 ? "−" : ""}${formatMoney(Math.abs(rb), currency)}` : "—"}
                          </span>
                        );
                      },
                    },
                    {
                      key: "reconciled",
                      header: "Reconciled",
                      align: "center",
                      cell: (tx) =>
                        tx.reconciledAt ? (
                          <StatusBadge tone="success">✓ Done</StatusBadge>
                        ) : (
                          <StatusBadge tone="warning">Pending</StatusBadge>
                        ),
                    },
                  ]}
                  actions={(tx) => (
                    <form action={reconcile}>
                      <input type="hidden" name="id" value={tx.id} />
                      <button type="submit" className="text-[var(--accent)] hover:underline">
                        {tx.reconciledAt ? "Undo" : "Mark checked"}
                      </button>
                    </form>
                  )}
                  tableFooter={
                    <tr>
                      <td colSpan={2} className="px-4 py-2.5 text-[0.75rem] font-bold text-[var(--ink-muted)]">
                        {transactions.length} transactions{q ? " (filtered)" : ""}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatMoney(txCreditsTotal, currency)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums text-red-600">
                        {formatMoney(txDebitsTotal, currency)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums text-[var(--ink)]">
                        {formatMoney(activeAccount.currentBalance, currency)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  }
                  renderMobileCard={(tx, i) => {
                    const rb = balanceById.get(tx.id);
                    return (
                      <>
                        <div className={`px-4 py-3 ${tx.reconciledAt ? "opacity-60" : ""}`}>
                          <div className="mb-0.5 flex items-start justify-between gap-2">
                            <p className="font-medium text-[var(--ink)]">{tx.description}</p>
                            <span className={`shrink-0 font-bold tabular-nums ${tx.type ==="CREDIT" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"}`}>
                              {tx.type === "CREDIT" ? "+" : "−"}{formatMoney(tx.amount, currency)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-[0.8125rem] text-[var(--ink-muted)]">
                              <span>{new Date(tx.date).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" })}</span>
                              {tx.reference && <><span className="opacity-40">·</span><span>{tx.reference}</span></>}
                            </div>
                            <div className="flex items-center gap-2">
                              {rb !== undefined && (
                                <span className={`text-[0.8125rem] tabular-nums ${(rb ?? 0) >= 0 ? "text-[var(--ink-muted)]" : "text-red-600"}`}>
                                  bal {rb < 0 ? "−" : ""}{formatMoney(Math.abs(rb), currency)}
                                </span>
                              )}
                              <form action={reconcile}>
                                <input type="hidden" name="id" value={tx.id} />
                                <button type="submit" className="text-[0.8125rem] text-[var(--accent)] hover:underline">
                                  {tx.reconciledAt ? "Undo" : "Mark checked"}
                                </button>
                              </form>
                            </div>
                          </div>
                        </div>
                        {i === pageTransactions.length - 1 && (
                          <div className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--panel-strong)] px-4 py-2.5 text-xs font-semibold">
                            <span className="text-[var(--ink-muted)]">{transactions.length} transactions{q ? " (filtered)" : ""}</span>
                            <span className="text-[var(--ink)]">{formatMoney(activeAccount.currentBalance, currency)}</span>
                          </div>
                        )}
                      </>
                    );
                  }}
                />

                <TablePagination
                  page={txPageView.page}
                  totalPages={txPageView.totalPages}
                  rangeStart={txPageView.rangeStart}
                  rangeEnd={txPageView.rangeEnd}
                  total={txPageView.total}
                  unit="transactions"
                  hrefForPage={bankHref}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
