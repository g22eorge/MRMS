
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ExpenseCategory, PaymentMethod } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { getCurrentUserRole } from "@/lib/session";

import { can } from "@/lib/permissions";
import { orgDb } from "@/lib/db";
import { orgTagFor, maxNumberSequence, composeOrgNumber } from "@/lib/commercial/org-number";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { prisma, ensureMoneySchema } from "@/lib/prisma";
import { findRecentDuplicate } from "@/lib/dedup";
import { postExpensePayment } from "@/lib/accounting/post";
import { formatMoneyCompact } from "@/lib/currency";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { RowActionsMenu, MenuDestructiveRow } from "@/components/shared/RowActionsMenu";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/StatCards";
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";

export const dynamic = "force-dynamic";

const CATEGORIES: ExpenseCategory[] = [
  "RENT", "UTILITIES", "SALARIES", "SUPPLIES", "MARKETING",
  "TRAVEL", "EQUIPMENT", "MAINTENANCE", "TAXES", "OTHER",
];
const METHODS: PaymentMethod[] = ["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CARD", "OTHER"];

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  RENT: "Rent",
  UTILITIES: "Utilities",
  SALARIES: "Salaries",
  SUPPLIES: "Supplies",
  MARKETING: "Marketing",
  TRAVEL: "Travel",
  EQUIPMENT: "Equipment",
  MAINTENANCE: "Maintenance",
  TAXES: "Taxes",
  OTHER: "Other",
};

const CATEGORY_TONES: Record<ExpenseCategory, BadgeTone> = {
  RENT: "violet",
  UTILITIES: "sky",
  SALARIES: "success",
  SUPPLIES: "warning",
  MARKETING: "pink",
  TRAVEL: "orange",
  EQUIPMENT: "info",
  MAINTENANCE: "teal",
  TAXES: "danger",
  OTHER: "neutral",
};

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const fmt = (d: Date | null) =>
  d ? d.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" }) : "—";

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ExpensesPage({ searchParams }: Props) {
  const { user } = await getCurrentUserRole();
  const db = orgDb(user.orgId);
  if (!can.viewFinancials(user)) redirect("/dashboard");

  const sp = await searchParams;
  const catFilter = CATEGORIES.includes(sp.category as ExpenseCategory)
    ? (sp.category as ExpenseCategory)
    : undefined;
  const q = sp.q?.trim() ?? "";
  const periodFilter = (sp.period ?? "all") as "all" | "this_month" | "last_month" | "ytd";
  const page = parsePage(sp.page);

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();

  const ytdStart = new Date(thisYear, 0, 1);
  const prevYtdStart = new Date(thisYear - 1, 0, 1);
  const prevYtdEnd = new Date(thisYear - 1, thisMonth, now.getDate(), 23, 59, 59);
  const prevMonthStart = new Date(thisYear, thisMonth - 1, 1);
  const prevMonthEnd = new Date(thisYear, thisMonth, 0, 23, 59, 59);
  const _thisMonthStart = new Date(thisYear, thisMonth, 1);

  // 6-month trend window
  const trendStart = new Date(thisYear, thisMonth - 5, 1);

  const where: Prisma.ExpenseWhereInput = {
    ...(catFilter ? { category: catFilter } : {}),
    ...(q
      ? {
          OR: [
            { description: { contains: q } },
            { expenseNumber: { contains: q } },
            { reference: { contains: q } },
          ],
        }
      : {}),
  };

  const [expenses, statsRows, total, suppliers, trendExpenses, prevMonthExpenses, ytdExpenses, prevYtdExpenses] =
    await Promise.all([
      db.expense.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      // Whole-dataset KPIs: totalAmount, thisMonthAmount (paidAt ?? createdAt
      // fallback isn't SQL-aggregatable) and byCategory are computed in JS from
      // this slim, filter-scoped fetch so they don't reflect only the page.
      db.expense.findMany({
        where,
        select: { amount: true, paidAt: true, createdAt: true, category: true },
      }),
      db.expense.count({ where }),
      db.supplier
        .findMany({ where: {}, select: { id: true, name: true }, orderBy: { name: "asc" } })
        .catch(() => [] as { id: string; name: string }[]),
      // For 6-month trend chart (all categories, no filters)
      db.expense.findMany({
        where: { paidAt: { gte: trendStart } },
        select: { amount: true, paidAt: true, createdAt: true },
      }),
      db.expense.findMany({
        where: { paidAt: { gte: prevMonthStart, lte: prevMonthEnd } },
        select: { amount: true },
      }),
      db.expense.findMany({
        where: { paidAt: { gte: ytdStart } },
        select: { amount: true },
      }),
      db.expense.findMany({
        where: { paidAt: { gte: prevYtdStart, lte: prevYtdEnd } },
        select: { amount: true },
      }),
    ]);

  const currency = "UGX";
  const pageView = paginationView(page, total);

  const totalAmount = statsRows.reduce((sum, e) => sum + e.amount, 0);

  const thisMonthAmount = statsRows
    .filter((e) => {
      const d = e.paidAt ?? e.createdAt;
      return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
    })
    .reduce((sum, e) => sum + e.amount, 0);

  const prevMonthTotal = prevMonthExpenses.reduce((s, e) => s + e.amount, 0);
  const ytdTotal = ytdExpenses.reduce((s, e) => s + e.amount, 0);
  const prevYtdTotal = prevYtdExpenses.reduce((s, e) => s + e.amount, 0);
  const momDelta = thisMonthAmount - prevMonthTotal;
  const ytdDelta = ytdTotal - prevYtdTotal;

  // Build 6-month trend chart data
  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(thisYear, thisMonth - (5 - i), 1);
    return {
      key: `${MONTHS_SHORT[d.getMonth()]}${d.getFullYear() !== thisYear ? " '" + String(d.getFullYear()).slice(2) : ""}`,
      yr: d.getFullYear(),
      mo: d.getMonth(),
      amount: 0,
    };
  });
  for (const e of trendExpenses) {
    const d = e.paidAt ?? e.createdAt;
    const bucket = trendMonths.find((m) => m.yr === d.getFullYear() && m.mo === d.getMonth());
    if (bucket) bucket.amount += e.amount;
  }
  const trendData = trendMonths.map(({ key, amount }) => ({ key, amount }));

  // Category breakdown (from full filtered dataset, not just the current page)
  const byCategory = CATEGORIES.map((cat) => {
    const items = statsRows.filter((e) => e.category === cat);
    return {
      cat,
      total: items.reduce((s, e) => s + e.amount, 0),
      count: items.length,
    };
  }).filter((x) => x.count > 0);

  async function createExpenseAction(formData: FormData) {
    "use server";
    const { user } = await getCurrentUserRole();
    if (!user.orgId) redirect("/dashboard");
    const orgId = user.orgId;
    const db = orgDb(orgId);
    if (!can.viewFinancials(user)) redirect("/dashboard");

    const description = String(formData.get("description") ?? "").trim();
    const amountRaw = Number(String(formData.get("amount") ?? "").trim());
    const categoryRaw = String(formData.get("category") ?? "OTHER").trim();
    const methodRaw = String(formData.get("method") ?? "").trim();
    const currency = String(formData.get("currency") ?? "UGX").trim();
    const supplierId = String(formData.get("supplierId") ?? "").trim() || null;
    const reference = String(formData.get("reference") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const paidAtRaw = String(formData.get("paidAt") ?? "").trim();

    if (!description || !Number.isFinite(amountRaw) || amountRaw <= 0) return;

    const category = CATEGORIES.includes(categoryRaw as ExpenseCategory)
      ? (categoryRaw as ExpenseCategory)
      : ("OTHER" as ExpenseCategory);
    const method =
      methodRaw && METHODS.includes(methodRaw as PaymentMethod)
        ? (methodRaw as PaymentMethod)
        : null;
    const paidAt = paidAtRaw ? new Date(paidAtRaw) : null;

    // Double-submit guard: an identical expense landed seconds ago — reuse it
    // instead of recording (and paying out) the same money twice.
    const dupExpense = await findRecentDuplicate(db.expense, { orgId, description, amount: amountRaw, category });
    if (dupExpense) {
      revalidatePath("/finance/expenses");
      return;
    }

    const inner = `EXP-${new Date().getFullYear()}-`;
    const [tag, existingNumbers] = await Promise.all([
      orgTagFor(orgId),
      db.expense.findMany({ where: { expenseNumber: { contains: inner } }, select: { expenseNumber: true } }),
    ]);
    const expenseSeq = maxNumberSequence(inner, existingNumbers.map((e) => e.expenseNumber)) + 1;
    const expenseNumber = composeOrgNumber(tag, inner, expenseSeq);

    const expense = await db.expense.create({
      data: {
        expenseNumber,
        description,
        amount: amountRaw,
        currency,
        category,
        method: method ?? undefined,
        supplierId,
        reference,
        notes,
        paidAt,
        createdById: user.id,
        orgId,
      },
    });

    // C5: cash-basis ledger post — Dr Operating Expenses, Cr Cash. Idempotent
    // on the expense id, so a retry or backfill won't double-post.
    await ensureMoneySchema();
    await prisma.$transaction((tx) =>
      postExpensePayment(tx, {
        orgId,
        userId: user.id,
        amount: amountRaw,
        date: paidAt ?? undefined,
        reference: `expense:${expense.id}`,
        description: `Expense ${expenseNumber} — ${description}`,
      }),
    );

    await writeSystemAuditEvent({
      entityType: "Expense",
      entityId: expense.id,
      action: "EXPENSE_CREATED",
      summary: `${expenseNumber} — ${description} — ${currency} ${amountRaw.toLocaleString()}`,
      actorUserId: user.id,
    });

    revalidatePath("/finance/expenses");
  }

  async function deleteExpenseAction(formData: FormData) {
    "use server";
    const { user } = await getCurrentUserRole();
    const db = orgDb(user.orgId);
    if (!["ADMIN"].includes(user.role)) redirect("/dashboard");

    const expenseId = String(formData.get("expenseId") ?? "").trim();
    if (!expenseId) return;

    const expense = await db.expense.findFirst({
      where: { id: expenseId },
      select: { expenseNumber: true, description: true },
    });
    if (!expense) return;

    await db.expense.delete({ where: { id: expenseId } });

    await writeSystemAuditEvent({
      entityType: "Expense",
      entityId: expenseId,
      action: "EXPENSE_DELETED",
      summary: `Deleted ${expense.expenseNumber} — ${expense.description}`,
      actorUserId: user.id,
    });

    revalidatePath("/finance/expenses");
  }

  const canWrite = can.viewFinancials(user);
  const canDelete = ["ADMIN"].includes(user.role);

  // Named so the same actions menu renders in the desktop table AND mobile card.
  const renderExpenseActions = canDelete
    ? (expense: (typeof expenses)[number]) => (
        <RowActionsMenu label="Expense actions">
          <MenuDestructiveRow>
            <form action={deleteExpenseAction}>
              <input type="hidden" name="expenseId" value={expense.id} />
              <ConfirmSubmitButton
                message={`Delete expense ${expense.expenseNumber}? This cannot be undone.`}
                className="w-full text-left text-[0.75rem] text-red-600"
              >
                Delete
              </ConfirmSubmitButton>
            </form>
          </MenuDestructiveRow>
        </RowActionsMenu>
      )
    : undefined;

  const filterUrl = (params: Record<string, string | undefined>) => {
    const base = new URLSearchParams();
    const nextCat = params.category !== undefined ? params.category : catFilter;
    const nextQ = params.q !== undefined ? params.q : q;
    if (nextCat) base.set("category", nextCat);
    if (nextQ) base.set("q", nextQ);
    const s = base.toString();
    return `/finance/expenses${s ? `?${s}` : ""}`;
  };

  const topCategory =
    byCategory.length > 0 ? [...byCategory].sort((a, b) => b.total - a.total)[0] : null;

  const expensesHref = pageHrefBuilder("/finance/expenses", {
    category: catFilter ?? "",
    q,
    period: periodFilter !== "all" ? periodFilter : "",
  });

  return (
    <div className="space-y-4">
      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="Finance"
        title="Expenses"
        description={`${total} record${total !== 1 ? "s" : ""}`}
        actions={
          <>
            <Link
              href="/finance/reports/pl"
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] hover:bg-[var(--panel-strong)]"
            >
              P&L →
            </Link>
            <Link
              href={`/api/reports/export?type=expenses&month=${thisYear}-${String(thisMonth + 1).padStart(2, "0")}`}
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] hover:bg-[var(--panel-strong)]"
            >
              ↓ CSV
            </Link>
            {canWrite && (
          <details className="group relative">
            <summary className="btn-premium cursor-pointer list-none rounded-lg px-3 py-1.5 text-[0.75rem]">
              + Record Expense
            </summary>
            <div className="absolute right-0 top-full z-20 mt-2 w-96 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 shadow-xl">
              <p className="mb-3 text-[0.75rem] font-bold text-[var(--ink)]">Record Business Expense</p>
              <form action={createExpenseAction} className="space-y-3">
                <div>
                  <label className="mb-1 block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
                    Description *
                  </label>
                  <input
                    name="description"
                    required
                    placeholder="What was this expense for?"
                    className="input-base w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.75rem]"
                  />

                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
                      Amount *
                    </label>
                    <input
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      placeholder="0.00"
                      className="input-base w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.75rem]"
                    />
                  </div>
                  {/* Currency locked to org base — hidden field */}
                  <input type="hidden" name="currency" value="UGX" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
                      Category
                    </label>
                    <select
                      name="category"
                      className="input-base w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.75rem]"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
                      Payment Method
                    </label>
                    <select
                      name="method"
                      className="input-base w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.75rem]"
                    >
                      <option value="">— none —</option>
                      {METHODS.map((m) => (
                        <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Rarely-needed fields stay in the form (native <details> keeps
                    them in the DOM so they still submit) but collapse by default
                    so "rent, 500k, cash" is a three-field job. */}
                <details className="rounded-lg border border-[var(--line)]">
                  <summary className="cursor-pointer select-none px-3 py-2 text-[0.8125rem] font-semibold text-[var(--ink)]">
                    More details <span className="font-normal text-[var(--ink-muted)]">— optional</span>
                  </summary>
                  <div className="space-y-3 px-3 pb-3">
                    <div>
                      <label className="mb-1 block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
                        Date paid <span className="font-normal">(defaults to today)</span>
                      </label>
                      <input
                        name="paidAt"
                        type="date"
                        className="input-base w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.75rem]"
                      />
                    </div>
                    {suppliers.length > 0 && (
                      <div>
                        <label className="mb-1 block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
                          Supplier
                        </label>
                        <select
                          name="supplierId"
                          className="input-base w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.75rem]"
                        >
                          <option value="">— none —</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="mb-1 block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
                        Reference / Receipt #
                      </label>
                      <input
                        name="reference"
                        placeholder="Invoice or receipt number"
                        className="input-base w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.75rem]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">Notes</label>
                      <textarea
                        name="notes"
                        rows={2}
                        className="input-base w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.75rem]"
                      />
                    </div>
                  </div>
                </details>
                <SubmitButton bare pendingLabel="Saving…" className="btn-premium w-full rounded-lg py-2 text-[0.75rem] font-semibold disabled:opacity-60">
                  Save Expense
                </SubmitButton>
              </form>
            </div>
          </details>
            )}
          </>
        }
      />

      <StatCards columns={4} cards={[
          {
            label: "This Month",
            value: formatMoneyCompact(thisMonthAmount, currency),
            sub:
              prevMonthTotal > 0
                ? `${momDelta > 0 ? "+" : "−"}${formatMoneyCompact(Math.abs(momDelta), currency)} vs last month`
                : undefined,
          },
          {
            label: `YTD ${thisYear}`,
            value: formatMoneyCompact(ytdTotal, currency),
            sub:
              prevYtdTotal > 0
                ? `${ytdDelta > 0 ? "+" : "−"}${formatMoneyCompact(Math.abs(ytdDelta), currency)} vs ${thisYear - 1} YTD`
                : undefined,
          },
          {
            label: "Avg / Month",
            value:
              trendData.filter((d) => d.amount > 0).length > 0
                ? formatMoneyCompact(
                    trendData.reduce((s, d) => s + d.amount, 0) /
                      Math.max(1, trendData.filter((d) => d.amount > 0).length),
                    currency,
                  )
                : "—",
            sub: "Last 6 months",
          },
          {
            label: "Top Category",
            value: topCategory ? formatMoneyCompact(topCategory.total, currency) : "—",
            sub: topCategory ? CATEGORY_LABELS[topCategory.cat] : undefined,
          },
        ]} />

      {/* ── PERIOD CHIPS ─────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {([
          { label: "All time", value: "all" },
          { label: "This month", value: "this_month" },
          { label: "Last month", value: "last_month" },
          { label: "YTD", value: "ytd" },
        ] as const).map(({ label, value }) => (
          <Link key={value} href={filterUrl({ period: value === "all" ? "" : value })}
            className={`rounded-full border px-3 py-1.5 text-[0.75rem] font-semibold transition ${periodFilter === value ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--ink)]"}`}>
            {label}
          </Link>
        ))}
      </div>

      {/* ── FILTER BAR ───────────────────────────────────────────────────── */}
      <div className="panel-shadow flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-2.5">
        <form method="GET" action="/finance/expenses" className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {catFilter && <input type="hidden" name="category" value={catFilter} />}
          {periodFilter !== "all" && <input type="hidden" name="period" value={periodFilter} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search description, reference…"
            className="input-base h-8 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-[0.75rem] sm:min-w-[180px]"
          />
          <button type="submit" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.75rem] font-medium hover:bg-[var(--panel-strong)]">
            Search
          </button>
        </form>
        <div className="flex w-full min-w-0 gap-1 overflow-x-auto pb-1 sm:w-auto sm:flex-wrap sm:overflow-visible sm:pb-0">
          <Link
            href={filterUrl({ category: "" })}
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.8125rem] font-semibold transition sm:px-2.5 ${
              !catFilter
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                : "border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--accent)]/50"
            }`}
          >
            All
          </Link>
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={filterUrl({ category: catFilter === cat ? "" : cat })}
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.8125rem] font-semibold transition sm:px-2.5 ${
                catFilter === cat
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--accent)]/50"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </Link>
          ))}
        </div>
      </div>

      {/* ── EXPENSE TABLE ────────────────────────────────────────────────── */}
      <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <DataTable
          frameless
          rows={expenses}
          getRowKey={(expense) => expense.id}
          empty={q || catFilter ? "No expenses match your filters." : "No expenses recorded yet."}
          columns={[
            {
              key: "number",
              header: "Expense #",
              cell: (expense) => (
                <>
                  <p className="mono text-[0.75rem] font-bold text-[var(--ink)]">{expense.expenseNumber}</p>
                  <p className="text-[var(--ink-muted)]">{fmt(expense.createdAt)}</p>
                </>
              ),
            },
            {
              key: "description",
              header: "Description",
              cell: (expense) => (
                <>
                  <p className="font-medium text-[var(--ink)]">{expense.description}</p>
                  {expense.reference && (
                    <p className="text-[var(--ink-muted)]">Ref: {expense.reference}</p>
                  )}
                  {expense.notes && (
                    <p className="italic text-[var(--ink-muted)]">{expense.notes}</p>
                  )}
                </>
              ),
            },
            {
              key: "category",
              header: "Category",
              cell: (expense) => (
                <StatusBadge tone={toneFor(CATEGORY_TONES, expense.category)}>
                  {CATEGORY_LABELS[expense.category]}
                </StatusBadge>
              ),
            },
            {
              key: "supplier",
              header: "Supplier",
              headerClassName: "hidden md:table-cell",
              className: "hidden text-[0.75rem] text-[var(--ink-muted)] md:table-cell",
              cell: (expense) => expense.supplier?.name ?? "—",
            },
            {
              key: "method",
              header: "Method",
              headerClassName: "hidden lg:table-cell",
              className: "hidden text-[0.75rem] text-[var(--ink-muted)] lg:table-cell",
              cell: (expense) => (expense.method ? expense.method.replace(/_/g, " ") : "—"),
            },
            {
              key: "paid",
              header: "Paid",
              headerClassName: "hidden lg:table-cell",
              className: "hidden text-[0.75rem] text-[var(--ink-muted)] lg:table-cell",
              cell: (expense) => fmt(expense.paidAt),
            },
            {
              key: "amount",
              header: "Amount",
              align: "right",
              className: "whitespace-nowrap tabular-nums",
              cell: (expense) => (
                <span className="font-semibold tabular-nums text-[var(--ink)]">
                  {expense.currency} {expense.amount.toLocaleString()}
                </span>
              ),
            },
            {
              key: "by",
              header: "By",
              headerClassName: "hidden sm:table-cell",
              className: "hidden text-[var(--ink-muted)] sm:table-cell",
              cell: (expense) => expense.createdBy.name,
            },
          ]}
          actions={renderExpenseActions}
          renderMobileCard={(expense) => (
            <div className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="mono truncate font-bold text-[var(--ink)]">{expense.expenseNumber}</p>
                <p className="mt-0.5 truncate text-[var(--ink)]">{expense.description}</p>
                <p className="mt-0.5 truncate text-[0.75rem] text-[var(--ink-muted)]">{expense.supplier?.name ?? "No supplier"} · {fmt(expense.paidAt ?? expense.createdAt)}</p>
                <p className="mt-1 font-semibold tabular-nums text-[var(--ink)]">{expense.currency} {expense.amount.toLocaleString()}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <StatusBadge tone={toneFor(CATEGORY_TONES, expense.category)}>{CATEGORY_LABELS[expense.category]}</StatusBadge>
                {renderExpenseActions ? renderExpenseActions(expense) : null}
              </div>
            </div>
          )}
        />
        {total > 0 && (
          <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-2.5">
            <p className="text-[0.8125rem] text-[var(--ink-muted)]">
              {total} record{total !== 1 ? "s" : ""}
              {catFilter ? ` · ${CATEGORY_LABELS[catFilter]}` : ""}
            </p>
            <p className="text-[0.75rem] font-bold text-[var(--ink)]">
              Total: {currency} {totalAmount.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      <TablePagination
        page={pageView.page}
        totalPages={pageView.totalPages}
        rangeStart={pageView.rangeStart}
        rangeEnd={pageView.rangeEnd}
        total={pageView.total}
        unit="expenses"
        hrefForPage={expensesHref}
      />
    </div>
  );
}
