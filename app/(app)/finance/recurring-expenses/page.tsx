import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ExpenseCategory } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { assertOrgCanMutate } from "@/lib/org-write";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { RowActionsMenu, MenuDestructiveRow, MenuActionButton } from "@/components/shared/RowActionsMenu";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormErrorBanner } from "@/components/ui/FormErrorBanner";
import { issueRecurringExpense } from "@/lib/commercial/recurring-expenses";
import {
  RECURRING_FREQUENCIES,
  isRecurringFrequency,
  type RecurringFrequency,
} from "@/lib/commercial/recurring-schedule";

export const dynamic = "force-dynamic";

const CATEGORIES: ExpenseCategory[] = [
  "RENT", "UTILITIES", "SALARIES", "SUPPLIES", "MARKETING",
  "TRAVEL", "EQUIPMENT", "MAINTENANCE", "TAXES", "OTHER",
];

const FREQ_LABELS: Record<RecurringFrequency, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUAL: "Annual",
};

const fmt = (d: Date | null) =>
  d ? d.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" }) : "—";

const field =
  "input-base w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.75rem]";

export default async function RecurringExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const { user, orgId, org } = await requireOrgSession();
  if (!can.viewFinancials(user)) redirect("/dashboard");
  const canWrite = can.viewFinancials(user);
  const currency = org.baseCurrency ?? "UGX";

  const [templates, suppliers] = await Promise.all([
    prisma.recurringExpense.findMany({
      where: { orgId },
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: [{ isActive: "desc" }, { nextDueAt: "asc" }],
    }).catch(() => []),
    prisma.supplier.findMany({ where: { orgId }, select: { id: true, name: true }, orderBy: { name: "asc" } }).catch(() => []),
  ]);

  async function createTemplateAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!can.viewFinancials(user)) redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const fail = (message: string): never =>
      redirect(`/finance/recurring-expenses?error=${encodeURIComponent(message)}`);

    const description = String(formData.get("description") ?? "").trim();
    const amount = Number(String(formData.get("amount") ?? "").trim());
    const categoryRaw = String(formData.get("category") ?? "OTHER").trim();
    const supplierId = String(formData.get("supplierId") ?? "").trim() || null;
    const freqRaw = String(formData.get("frequency") ?? "MONTHLY").trim();
    const startRaw = String(formData.get("startDate") ?? "").trim();
    const autoIssue = formData.get("autoIssue") === "on";
    const notes = String(formData.get("notes") ?? "").trim() || null;

    if (!description) fail("Give the schedule a description (e.g. Shop rent).");
    if (!Number.isFinite(amount) || amount <= 0) fail("Enter an amount greater than zero.");
    if (!isRecurringFrequency(freqRaw)) fail("Pick a valid frequency.");
    const nextDueAt = startRaw ? new Date(`${startRaw}T12:00:00.000Z`) : new Date();
    if (Number.isNaN(nextDueAt.getTime())) fail("Enter a valid start date.");
    if (supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, orgId }, select: { id: true } });
      if (!supplier) fail("That supplier was not found.");
    }

    const created = await prisma.recurringExpense.create({
      data: {
        orgId,
        description,
        category: (CATEGORIES as readonly string[]).includes(categoryRaw) ? (categoryRaw as ExpenseCategory) : "OTHER",
        amount,
        currency: org.baseCurrency ?? "UGX",
        supplierId,
        frequency: freqRaw,
        nextDueAt,
        autoIssue,
        notes,
        createdById: user.id,
      },
      select: { id: true },
    });

    await writeSystemAuditEvent({
      orgId,
      actorUserId: user.id,
      entityType: "RecurringExpense",
      entityId: created.id,
      action: "RECURRING_EXPENSE_CREATED",
      summary: `${description} — ${freqRaw} from ${fmt(nextDueAt)}`,
    }).catch(() => {});

    revalidatePath("/finance/recurring-expenses");
  }

  async function toggleTemplateAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!can.viewFinancials(user)) redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return;
    const template = await prisma.recurringExpense.findFirst({ where: { id, orgId }, select: { id: true, isActive: true } });
    if (!template) return;
    await prisma.recurringExpense.updateMany({
      where: { id, orgId },
      data: { isActive: !template.isActive },
    });
    revalidatePath("/finance/recurring-expenses");
  }

  async function deleteTemplateAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (user.role !== "ADMIN") redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return;
    // Issued expenses stay on the books — only the schedule goes away.
    await prisma.recurringExpense.deleteMany({ where: { id, orgId } });
    revalidatePath("/finance/recurring-expenses");
  }

  async function issueNowAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!can.viewFinancials(user)) redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return;
    const result = await issueRecurringExpense(orgId, id, user.id);
    if (!result.issued && result.reason === "not-due") {
      redirect(`/finance/recurring-expenses?error=${encodeURIComponent("This schedule is not due yet.")}`);
    }
    revalidatePath("/finance/recurring-expenses");
    revalidatePath("/finance/expenses");
    revalidatePath("/payout-followups");
  }

  const now = new Date();

  return (
    <div className="space-y-4">
      <FormErrorBanner message={sp.error} />
      <PageHeader
        title="Recurring Expenses"
        description="Rent, retainers and subscriptions that raise themselves as owed — no retyping every month."
      />

      {/* ── New schedule ─────────────────────────────────────────────── */}
      {canWrite ? (
        <details className="dc-card overflow-hidden">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-[var(--ink)]">
            + New schedule
          </summary>
          <form action={createTemplateAction} className="grid gap-3 border-t border-[var(--line)] p-4 sm:grid-cols-2">
            <label className="block text-[0.8125rem] font-semibold text-[var(--ink-muted)] sm:col-span-2">
              Description <span className="text-red-500">*</span>
              <input name="description" required placeholder="e.g. Shop rent" className={`mt-1 ${field}`} />
            </label>
            <label className="block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
              Amount ({currency}) <span className="text-red-500">*</span>
              <input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" className={`mt-1 ${field}`} />
            </label>
            <label className="block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
              Frequency
              <select name="frequency" defaultValue="MONTHLY" className={`mt-1 ${field}`}>
                {RECURRING_FREQUENCIES.map((f) => <option key={f} value={f}>{FREQ_LABELS[f]}</option>)}
              </select>
            </label>
            <label className="block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
              Category
              <select name="category" defaultValue="RENT" className={`mt-1 ${field}`}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
              </select>
            </label>
            <label className="block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
              First due
              <input name="startDate" type="date" className={`mt-1 ${field}`} />
            </label>
            {suppliers.length > 0 ? (
              <label className="block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
                Supplier <span className="font-normal">(optional)</span>
                <select name="supplierId" className={`mt-1 ${field}`}>
                  <option value="">— none —</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            ) : null}
            <label className="block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
              Notes <span className="font-normal">(optional)</span>
              <input name="notes" placeholder="e.g. Paid to landlord by the 5th" className={`mt-1 ${field}`} />
            </label>
            <label className="flex items-center gap-2 text-[0.8125rem] font-medium text-[var(--ink)]">
              <input name="autoIssue" type="checkbox" defaultChecked className="h-4 w-4" />
              Raise automatically when due
            </label>
            <div className="sm:col-span-2">
              <SubmitButton bare className="btn-premium rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60">
                Save schedule
              </SubmitButton>
            </div>
          </form>
        </details>
      ) : null}

      {/* ── Schedules ────────────────────────────────────────────────── */}
      <div className="dc-card overflow-hidden">
        <DataTable
          frameless
          rows={templates}
          getRowKey={(t) => t.id}
          empty="No schedules yet — add rent, a retainer or a subscription above."
          columns={[
            {
              key: "what",
              header: "Schedule",
              cell: (t) => (
                <>
                  <p className="font-medium text-[var(--ink)]">{t.description}</p>
                  <p className="text-[var(--ink-muted)]">{t.supplier?.name ?? "No supplier"}{t.notes ? ` · ${t.notes}` : ""}</p>
                </>
              ),
            },
            {
              key: "amount",
              header: "Amount",
              className: "whitespace-nowrap tabular-nums",
              cell: (t) => <span className="font-semibold tabular-nums text-[var(--ink)]">{t.currency} {t.amount.toLocaleString()}</span>,
            },
            {
              key: "freq",
              header: "Repeats",
              cell: (t) => FREQ_LABELS[t.frequency as keyof typeof FREQ_LABELS] ?? t.frequency,
            },
            {
              key: "next",
              header: "Next due",
              cell: (t) => (
                t.nextDueAt <= now && t.isActive
                  ? <StatusBadge tone="danger">Due {fmt(t.nextDueAt)}</StatusBadge>
                  : <span className="text-[var(--ink-muted)]">{fmt(t.nextDueAt)}</span>
              ),
            },
            {
              key: "status",
              header: "Status",
              cell: (t) => (
                <StatusBadge tone={t.isActive ? (t.autoIssue ? "success" : "warning") : "neutral"}>
                  {!t.isActive ? "Paused" : t.autoIssue ? "Auto" : "Manual"}
                </StatusBadge>
              ),
            },
            {
              key: "last",
              header: "Last raised",
              className: "text-[var(--ink-muted)]",
              cell: (t) => fmt(t.lastIssuedAt),
            },
          ]}
          actions={(t) => (
            <RowActionsMenu label="Schedule actions">
              <form action={issueNowAction}>
                <input type="hidden" name="id" value={t.id} />
                <MenuActionButton icon="save" tone="accent">Raise now</MenuActionButton>
              </form>
              <form action={toggleTemplateAction}>
                <input type="hidden" name="id" value={t.id} />
                <MenuActionButton icon="close">{t.isActive ? "Pause" : "Resume"}</MenuActionButton>
              </form>
              {user.role === "ADMIN" ? (
                <MenuDestructiveRow>
                  <form action={deleteTemplateAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <ConfirmSubmitButton
                      message={`Delete the "${t.description}" schedule? Already-raised expenses stay on the books.`}
                      className="w-full text-left text-[0.75rem] text-red-600"
                    >
                      Delete
                    </ConfirmSubmitButton>
                  </form>
                </MenuDestructiveRow>
              ) : null}
            </RowActionsMenu>
          )}
          renderMobileCard={(t) => (
            <div className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-bold text-[var(--ink)]">{t.description}</p>
                <p className="mt-0.5 truncate text-[0.75rem] text-[var(--ink-muted)]">
                  {t.currency} {t.amount.toLocaleString()} · {FREQ_LABELS[t.frequency as keyof typeof FREQ_LABELS] ?? t.frequency} · next {fmt(t.nextDueAt)}
                </p>
                <p className="mt-1">
                  <StatusBadge tone={t.isActive ? (t.autoIssue ? "success" : "warning") : "neutral"}>
                    {!t.isActive ? "Paused" : t.autoIssue ? "Auto" : "Manual"}
                  </StatusBadge>
                </p>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
