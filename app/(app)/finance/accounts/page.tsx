
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { AccountType } from "@prisma/client";
import { getCurrentUserRole } from "@/lib/session";

import { prisma } from "@/lib/prisma";
import { orgDb } from "@/lib/db";
import { canAccessAccountantFinance } from "@/lib/finance/routes";
import { formatMoneyCompact } from "@/lib/currency";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { RowActionsMenu, MenuSection, MenuDestructiveRow } from "@/components/shared/RowActionsMenu";
import { can } from "@/lib/permissions";
import { DEFAULT_COA } from "@/lib/default-coa";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/StatCards";
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import { PageEmptyState } from "@/components/page-state/PageEmptyState";
import { assertOrgCanMutate } from "@/lib/org-write";
import { requireOrgSession } from "@/lib/org-context";
import { FormErrorBanner } from "@/components/ui/FormErrorBanner";

import { SubmitButton } from "@/components/ui/SubmitButton";
const ACCOUNT_TYPES: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

// Plain-English names so a non-accountant can pick the right type.
const TYPE_LABELS: Record<AccountType, string> = {
  ASSET: "Asset — things you own",
  LIABILITY: "Liability — money you owe",
  EQUITY: "Equity — owner's stake",
  REVENUE: "Revenue — money coming in",
  EXPENSE: "Expense — money going out",
};

const TYPE_TONES: Record<AccountType, BadgeTone> = {
  ASSET:     "info",
  LIABILITY: "danger",
  EQUITY:    "purple",
  REVENUE:   "success",
  EXPENSE:   "warning",
};

const TYPE_HEADER: Record<AccountType, string> = {
  ASSET:     "bg-blue-500/10 text-blue-600",
  LIABILITY: "bg-red-500/10 text-red-600",
  EQUITY:    "bg-[var(--accent)]/10 text-[var(--accent)]",
  REVENUE:   "bg-emerald-500/10 text-emerald-600",
  EXPENSE:   "bg-amber-500/10 text-amber-600",
};

export const dynamic = "force-dynamic";

export default async function ChartOfAccountsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const acctParams = searchParams ? await searchParams : {};
  const { user } = await getCurrentUserRole();
  if (!user.orgId) redirect("/dashboard");
  const orgId = user.orgId;
  const db = orgDb(orgId);
  if (!can.viewFinancials(user)) redirect("/dashboard");
  // Accountant-only surface — keep non-accountant finance roles (e.g. OPS) out,
  // matching the hidden nav tab.
  if (!canAccessAccountantFinance(user.role)) redirect("/finance");

  async function createAccount(fd: FormData) {
    "use server";
    const { user: actor, org } = await requireOrgSession();
    // Both gates the page applies, repeated where the write happens: a server
    // action runs without the render guard that redirected the user away, and
    // the chart of accounts is the shape every report is built on.
    if (!can.viewFinancials(actor) || !canAccessAccountantFinance(actor.role)) redirect("/finance");
    assertOrgCanMutate({ access: org.access, userRole: actor.role, userAccessMode: actor.accessMode, kind: "GENERAL" });
    const db = orgDb(user.orgId);
    const code = fd.get("code") as string;
    const name = fd.get("name") as string;
    const type = fd.get("type") as AccountType;
    const parentId = (fd.get("parentId") as string) || null;
    const description = (fd.get("description") as string) || null;
    if (!code || !name || !type) {
      redirect(`/finance/accounts?error=${encodeURIComponent("An account needs a code, a name and a type.")}`);
    }
    await db.chartOfAccount.create({
      data: { code: code.trim(), name: name.trim(), type, parentId, description, orgId },
    });
    revalidatePath("/finance/accounts");
  }

  async function toggleActive(fd: FormData) {
    "use server";
    const { user: actor, org } = await requireOrgSession();
    // Both gates the page applies, repeated where the write happens: a server
    // action runs without the render guard that redirected the user away, and
    // the chart of accounts is the shape every report is built on.
    if (!can.viewFinancials(actor) || !canAccessAccountantFinance(actor.role)) redirect("/finance");
    assertOrgCanMutate({ access: org.access, userRole: actor.role, userAccessMode: actor.accessMode, kind: "GENERAL" });
    const db = orgDb(user.orgId);
    const id = fd.get("id") as string;
    const acc = await db.chartOfAccount.findFirst({ where: { id } });
    if (!acc || acc.isSystem) return;
    await db.chartOfAccount.update({ where: { id }, data: { isActive: !acc.isActive } });
    revalidatePath("/finance/accounts");
  }

  async function deleteAccount(fd: FormData) {
    "use server";
    const { user: actor, org } = await requireOrgSession();
    // Both gates the page applies, repeated where the write happens: a server
    // action runs without the render guard that redirected the user away, and
    // the chart of accounts is the shape every report is built on.
    if (!can.viewFinancials(actor) || !canAccessAccountantFinance(actor.role)) redirect("/finance");
    assertOrgCanMutate({ access: org.access, userRole: actor.role, userAccessMode: actor.accessMode, kind: "GENERAL" });
    const db = orgDb(user.orgId);
    const id = fd.get("id") as string;
    const acc = await db.chartOfAccount.findFirst({ where: { id } });
    if (!acc || acc.isSystem) return;
    const hasLines = await prisma.journalLine.findFirst({ where: { accountId: id } });
    if (hasLines) return;
    await db.chartOfAccount.delete({ where: { id } });
    revalidatePath("/finance/accounts");
  }

  async function seedDefaults() {
    "use server";
    const { user: _u, org } = await requireOrgSession();
    if (!_u.orgId) return;
    assertOrgCanMutate({ access: org.access, userRole: _u.role, userAccessMode: _u.accessMode, kind: "GENERAL" });
    // Only ADMIN and MANAGER can seed default accounts
    if (!["ADMIN", "MANAGER"].includes(_u.role)) return;
    const seedOrgId = _u.orgId;
    const db = orgDb(seedOrgId);

    // Fetch codes that already exist so we can skip them
    const existing = await db.chartOfAccount.findMany({ select: { code: true } });
    const existingCodes = new Set(existing.map((a: { code: string }) => a.code));

    const toCreate = DEFAULT_COA.filter((a) => !existingCodes.has(a.code));
    if (toCreate.length === 0) return;

    await db.chartOfAccount.createMany({
      data: toCreate.map((a) => ({
        code:        a.code,
        name:        a.name,
        type:        a.type,
        description: a.description ?? null,
        isSystem:    false,
        isActive:    true,
        orgId:       seedOrgId,
      })),
    });
    revalidatePath("/finance/accounts");
  }

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [accounts, allTimeLines, thisMonthLines] = await Promise.all([
    db.chartOfAccount.findMany({
      where: {},
      orderBy: [{ type: "asc" }, { code: "asc" }],
      include: { parent: { select: { code: true, name: true } } },
    }),
    // All posted lines for running balance
    prisma.journalLine.findMany({
      where: { journalEntry: { orgId, status: "POSTED" } },
      select: { accountId: true, debit: true, credit: true },
    }),
    // This month's lines for activity
    prisma.journalLine.findMany({
      where: {
        journalEntry: {
          orgId,
          status: "POSTED",
          date: { gte: thisMonthStart, lte: thisMonthEnd },
        },
      },
      select: { accountId: true, debit: true, credit: true },
    }),
  ]);

  // Aggregate balance per account (all time)
  const balanceMap = new Map<string, number>();
  for (const l of allTimeLines) {
    const acc = accounts.find((a) => a.id === l.accountId);
    if (!acc) continue;
    const isDebitNormal = acc.type === "ASSET" || acc.type === "EXPENSE";
    const net = isDebitNormal ? l.debit - l.credit : l.credit - l.debit;
    balanceMap.set(l.accountId, (balanceMap.get(l.accountId) ?? 0) + net);
  }

  // Aggregate this month's net activity per account
  const monthlyMap = new Map<string, number>();
  for (const l of thisMonthLines) {
    const acc = accounts.find((a) => a.id === l.accountId);
    if (!acc) continue;
    const isDebitNormal = acc.type === "ASSET" || acc.type === "EXPENSE";
    const net = isDebitNormal ? l.debit - l.credit : l.credit - l.debit;
    monthlyMap.set(l.accountId, (monthlyMap.get(l.accountId) ?? 0) + net);
  }

  const currency = "UGX";

  const byType = ACCOUNT_TYPES.map((t) => ({
    type: t,
    items: accounts.filter((a) => a.type === t),
    totalBalance: accounts
      .filter((a) => a.type === t)
      .reduce((s, a) => s + (balanceMap.get(a.id) ?? 0), 0),
  }));

  const totals: Record<AccountType, number> = { ASSET: 0, LIABILITY: 0, EQUITY: 0, REVENUE: 0, EXPENSE: 0 };
  for (const t of ACCOUNT_TYPES) totals[t] = accounts.filter((a) => a.type === t).length;

  // Named so the same row actions render in the desktop table AND mobile card.
  const renderAccountActions = (acc: (typeof accounts)[number]) => {
    const balance = balanceMap.get(acc.id) ?? 0;
    const monthly = monthlyMap.get(acc.id) ?? 0;
    const hasActivity = balance !== 0 || monthly !== 0;
    return (
      <>
        {hasActivity && (
          <Link
            href={`/finance/accounts/${acc.id}`}
            className="rounded-lg border border-[var(--line)] px-2 py-1 font-medium text-[var(--ink-muted)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)]"
          >
            Ledger →
          </Link>
        )}
        {!acc.isSystem && (
          <RowActionsMenu label="Account actions">
            <MenuSection label="Actions" />
            <form action={toggleActive}>
              <input type="hidden" name="id" value={acc.id} />
              <SubmitButton bare className="w-full px-3 py-1.5 text-left hover:bg-[var(--panel)]">
                {acc.isActive ? "Deactivate" : "Activate"}
              </SubmitButton>
            </form>
            <MenuDestructiveRow>
              <form action={deleteAccount}>
                <input type="hidden" name="id" value={acc.id} />
                <ConfirmSubmitButton
                  message="Delete this account? Cannot be undone if it has no transactions."
                  className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-500/10 dark:text-red-400"
                >
                  Delete
                </ConfirmSubmitButton>
              </form>
            </MenuDestructiveRow>
          </RowActionsMenu>
        )}
      </>
    );
  };

  return (
    <div className="space-y-4">
      <FormErrorBanner message={acctParams.error} />
      <PageHeader
        eyebrow="Finance"
        title="Accounts"
        description="The categories your money flows through. Click any account to see its history."
        actions={
          <Link
            href="/finance/reports/pl"
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] hover:bg-[var(--panel-strong)]"
          >
            P&amp;L →
          </Link>
        }
      />

      <StatCards columns={4} cards={(
          [
            { type: "ASSET" as AccountType, label: "Total Assets", colorVal: "text-blue-600" },
            { type: "LIABILITY" as AccountType, label: "Total Liabilities", colorVal: "text-red-600" },
            { type: "EQUITY" as AccountType, label: "Total Equity", colorVal: "text-[var(--accent)]" },
            { type: "REVENUE" as AccountType, label: "Total Revenue", colorVal: "text-emerald-600" },
            { type: "EXPENSE" as AccountType, label: "Total Expenses", colorVal: "text-amber-700" },
          ] as const
        ).map(({ type, label, colorVal }) => {
          const bal = byType.find((b) => b.type === type)!.totalBalance;
          return {
            label,
            value: bal !== 0 ? formatMoneyCompact(Math.abs(bal), currency) : "—",
            valueClass: colorVal,
            sub: `${totals[type]} account${totals[type] !== 1 ? "s" : ""}`,
          };
        })} />

      {/* ── DEFAULT ACCOUNTS BANNER ─────────────────────────────────────── */}
      {accounts.length === 0 ? (
        <PageEmptyState
          variant="dashed"
          title="No accounts yet"
          description="Load the standard chart of accounts to get started instantly — 40 accounts covering assets, liabilities, equity, revenue, and expenses. You can edit or delete them afterwards."
          action={
            <form action={seedDefaults}>
              <SubmitButton bare className="btn-premium rounded-lg px-5 py-2.5 text-sm font-semibold">
                Load standard accounts
              </SubmitButton>
            </form>
          }
        />
      ) : (
        <form action={seedDefaults} className="flex justify-end">
          <SubmitButton bare title="Adds any missing standard accounts — existing codes are skipped"
 className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] hover:bg-[var(--panel-strong)]">
            + Load standard defaults
          </SubmitButton>
        </form>
      )}

      {/* ── CREATE FORM ──────────────────────────────────────────────────── */}
      <details className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <summary className="cursor-pointer list-none px-4 py-2.5 text-[0.8125rem] font-semibold text-[var(--ink)] hover:bg-[var(--panel-strong)]/40 group-open:border-b group-open:border-[var(--line)]">
          + Add Account
        </summary>
        <form
          action={createAccount}
          className="grid grid-cols-2 gap-4 border-t border-[var(--line)] p-5 sm:grid-cols-3"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink-muted)]">Code *</label>
            <input
              name="code"
              required
              placeholder="e.g. 1000"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink-muted)]">Name *</label>
            <input
              name="name"
              required
              placeholder="Cash & Bank"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink-muted)]">Type *</label>
            <select
              name="type"
              required
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink-muted)]">Parent account</label>
            <select
              name="parentId"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]"
            >
              <option value="">— None —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} {a.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[var(--ink-muted)]">Description</label>
            <input
              name="description"
              placeholder="Optional"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem]"
            />
          </div>
          <div className="flex justify-end sm:col-span-3">
            <SubmitButton bare className="btn-premium rounded-lg px-4 py-2 text-sm font-semibold">
              Create Account
            </SubmitButton>
          </div>
        </form>
      </details>

      {/* ── ACCOUNTS BY TYPE ─────────────────────────────────────────────── */}
      {byType.map(({ type, items, totalBalance }) => (
        <div key={type}>
          <div className={`mb-2 flex items-center justify-between rounded-lg px-3 py-2 ${TYPE_HEADER[type]}`}>
            <div className="flex items-center gap-2">
              <StatusBadge tone={toneFor(TYPE_TONES, type)}>{type}</StatusBadge>
              <span className="text-xs text-[var(--ink-muted)]">
                {items.length} account{items.length !== 1 ? "s" : ""}
              </span>
            </div>
            {totalBalance !== 0 && (
              <span className="text-sm font-bold tabular-nums">
                {formatMoneyCompact(Math.abs(totalBalance), currency)}
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--line)] px-4 py-3 text-sm text-[var(--ink-muted)]">
              No {type.toLowerCase()} accounts yet.
            </p>
          ) : (
            <DataTable
              rows={items}
              getRowKey={(acc) => acc.id}
              columns={[
                {
                  key: "code",
                  header: "Code",
                  cell: (acc) => (
                    <span className="mono font-semibold text-[var(--accent)]">
                      {acc.code}
                    </span>
                  ),
                },
                {
                  key: "name",
                  header: "Name",
                  cell: (acc) => {
                    const balance = balanceMap.get(acc.id) ?? 0;
                    const monthly = monthlyMap.get(acc.id) ?? 0;
                    const hasActivity = balance !== 0 || monthly !== 0;
                    return (
                      <>
                        {hasActivity ? (
                          <Link
                            href={`/finance/accounts/${acc.id}`}
                            className="font-medium text-[var(--ink)] hover:text-[var(--accent)] hover:underline"
                          >
                            {acc.name}
                          </Link>
                        ) : (
                          <span className="font-medium text-[var(--ink)]">{acc.name}</span>
                        )}
                        {acc.description && (
                          <p className="text-[var(--ink-muted)]">{acc.description}</p>
                        )}
                      </>
                    );
                  },
                },
                {
                  key: "parent",
                  header: "Parent",
                  headerClassName: "hidden md:table-cell",
                  className: "hidden text-[0.75rem] text-[var(--ink-muted)] md:table-cell",
                  cell: (acc) => (acc.parent ? `${acc.parent.code} ${acc.parent.name}` : "—"),
                },
                {
                  key: "balance",
                  header: "Balance",
                  align: "right",
                  className: "whitespace-nowrap tabular-nums",
                  cell: (acc) => {
                    const balance = balanceMap.get(acc.id) ?? 0;
                    return balance !== 0 ? (
                      <Link
                        href={`/finance/accounts/${acc.id}`}
                        className={`font-semibold tabular-nums hover:underline ${balance >= 0 ? "text-[var(--ink)]" : "text-red-600"}`}
                      >
                        {balance < 0 ? "−" : ""}
                        {formatMoneyCompact(Math.abs(balance), currency)}
                      </Link>
                    ) : (
                      <span className="text-[var(--ink-muted)]">—</span>
                    );
                  },
                },
                {
                  key: "month",
                  header: "This Month",
                  align: "right",
                  headerClassName: "hidden lg:table-cell",
                  className: "hidden lg:table-cell whitespace-nowrap tabular-nums",
                  cell: (acc) => {
                    const monthly = monthlyMap.get(acc.id) ?? 0;
                    return monthly !== 0 ? (
                      <span
                        className={`font-semibold tabular-nums ${monthly >= 0 ?"text-emerald-600" : "text-red-500"}`}
                      >
                        {monthly >= 0 ? "+" : "−"}
                        {formatMoneyCompact(Math.abs(monthly), currency)}
                      </span>
                    ) : (
                      <span className="text-[var(--ink-muted)]">—</span>
                    );
                  },
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (acc) =>
                    acc.isSystem ? (
                      <span className="text-[0.75rem] text-[var(--ink-muted)]">System</span>
                    ) : (
                      <StatusBadge tone={acc.isActive ? "success" : "neutral"}>
                        {acc.isActive ? "Active" : "Inactive"}
                      </StatusBadge>
                    ),
                },
              ]}
              actions={renderAccountActions}
              renderMobileCard={(acc) => {
                const balance = balanceMap.get(acc.id) ?? 0;
                const monthly = monthlyMap.get(acc.id) ?? 0;
                return (
                  <div className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate">
                        <span className="mono font-semibold text-[var(--accent)]">{acc.code}</span>
                        <span className="ml-2 font-medium text-[var(--ink)]">{acc.name}</span>
                      </p>
                      {acc.parent && <p className="mt-0.5 truncate text-[0.75rem] text-[var(--ink-muted)]">{acc.parent.code} {acc.parent.name}</p>}
                      <p className="mt-0.5 tabular-nums text-[0.75rem] text-[var(--ink-muted)]">
                        Balance {balance !== 0 ? `${balance < 0 ? "−" : ""}${formatMoneyCompact(Math.abs(balance), currency)}` : "—"}
                        {monthly !== 0 ? ` · ${monthly >= 0 ? "+" : "−"}${formatMoneyCompact(Math.abs(monthly), currency)} this month` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {acc.isSystem ? (
                        <span className="text-[0.75rem] text-[var(--ink-muted)]">System</span>
                      ) : (
                        <StatusBadge tone={acc.isActive ? "success" : "neutral"}>{acc.isActive ? "Active" : "Inactive"}</StatusBadge>
                      )}
                      <div className="flex items-center gap-1.5">{renderAccountActions(acc)}</div>
                    </div>
                  </div>
                );
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
