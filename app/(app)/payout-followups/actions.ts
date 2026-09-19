"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { postTechnicianPayout, postSupplierPayment } from "@/lib/accounting/post";
import { resolveTechCost } from "@/lib/billing";
import { formatMoney, getAppCurrency, toBaseAmount } from "@/lib/currency";
import { can } from "@/lib/permissions";
import { prisma, ensureMoneySchema } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { createReceiptForPayment } from "@/lib/commercial/document-workflow";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { syncInvoicePaymentState } from "@/lib/commercial/payment-sync";
import { parsePaymentMethod } from "@/lib/constants/payment-methods";
import { recordExpensePayment } from "@/lib/commercial/expense-payments";
import { getTechnicianPayoutTotalsByJobIds } from "@/lib/payouts";
import { findRecentDuplicate } from "@/lib/dedup";
import { flash } from "@/lib/flash";

// ── Mark external tech payout as paid ───────────────────────────────────────

export async function markExternalTechPaid(formData: FormData) {
  const { user, orgId, org } = await requireOrgSession();
  if (!can.reviewExternalBills({ role: user.role, permissions: user.permissions ?? [] }) && user.role !== "ADMIN") return;

  // assertOrgCanMutate check
  const { assertOrgCanMutate } = await import("@/lib/org-write");
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

  const jobId = String(formData.get("jobId") ?? "").trim();
  if (!jobId) return;

  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId },
    select: { id: true, externalTechFee: true, externalTechBill: true },
  });
  if (!job) return;

  const payoutDue = resolveTechCost(job.externalTechFee, job.externalTechBill);
  const existingPayouts = await prisma.technicianPayout
    .findMany({ where: { orgId, jobId: job.id }, select: { amount: true } })
    .catch(() => []);
  const alreadyPaid = existingPayouts.reduce((sum, payout) => sum + payout.amount, 0);
  const remaining = Math.max(0, payoutDue - alreadyPaid);

  // Ledger post inside the txn depends on the C5 accounting tables.
  await ensureMoneySchema();
  await prisma.$transaction(async (tx) => {
    if (remaining > 0) {
      const payout = await tx.technicianPayout.create({
        data: {
          orgId,
          jobId: job.id,
          amount: remaining,
          method: "CASH",
          note: "Marked paid from finance payout follow-up",
          recordedById: user.id,
        },
        select: { id: true },
      }).catch(() => null);

      // Cash-basis ledger: debit the expense, credit Cash (idempotent on payout id).
      if (payout) {
        await postTechnicianPayout(tx, {
          orgId,
          userId: user.id,
          amount: remaining,
          method: "CASH",
          reference: `techpay:${payout.id}`,
          description: "Technician payout (finance follow-up)",
        });
      }
    }

    await tx.job.updateMany({
      where: { id: jobId, orgId },
      data: {
        externalPaid: true,
        externalPaidAt: new Date(),
        externalPaidById: user.id,
      },
    });

    await tx.auditLog.create({
      data: {
        orgId,
        jobId,
        userId: user.id,
        action: "EXTERNAL_TECH_PAYOUT_MARKED",
        detail: JSON.stringify({ markedAt: new Date().toISOString(), amount: remaining, payoutDue, alreadyPaid }),
      },
    }).catch(() => {});
  });

  revalidatePath("/payout-followups");
  revalidatePath("/payables");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/technicians/payouts");
  revalidatePath("/dashboard");
}

// ── Receive client payment against an invoice ───────────────────────────────

export async function receiveInvoicePaymentAction(formData: FormData) {
  const { user, orgId, org } = await requireOrgSession();
  if (!(can.viewFinancials({ role: user.role, permissions: user.permissions ?? [] }) || ["ADMIN", "OPS"].includes(user.role))) return;

  const { assertOrgCanMutate } = await import("@/lib/org-write");
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  const amountRaw = Number(String(formData.get("amount") ?? "").trim());
  const methodRaw = String(formData.get("method") ?? "CASH").trim();
  const reference = String(formData.get("reference") ?? "").trim();

  if (!invoiceId) return;
  if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
    redirect(`/payout-followups?error=${encodeURIComponent("Enter a payment amount greater than zero.")}`);
  }
  const method = parsePaymentMethod(methodRaw, "OTHER");

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, orgId },
    select: { id: true, totalAmount: true, paidAmount: true, jobId: true, clientId: true, status: true },
  });
  if (!invoice || invoice.status === "VOID") return;
  if ((invoice.paidAmount ?? 0) + amountRaw > invoice.totalAmount) {
    const left = Math.max(0, invoice.totalAmount - (invoice.paidAmount ?? 0));
    redirect(`/payout-followups?error=${encodeURIComponent(`That is more than the outstanding balance of ${formatMoney(left, getAppCurrency())}.`)}`);
  }

  const currency = getAppCurrency();
  const baseCurrency = org.baseCurrency;

  // Payment + receipt + ledger post run inside the txn; ensure schema first.
  await ensureMoneySchema();
  await prisma.$transaction(async (tx) => {
    // Inside the transaction, so the second of two racing requests sees the
    // first one's committed row rather than writing a second payment against
    // the same invoice.
    const dup = await findRecentDuplicate(tx.payment, {
      orgId, invoiceId: invoice.id, amount: amountRaw, method, createdById: user.id,
    });
    if (dup) return;

    const payment = await tx.payment.create({
      data: { invoiceId: invoice.id, currency, amount: amountRaw, method, reference: reference || null, createdById: user.id, orgId },
    });
    await createReceiptForPayment(tx, { orgId, paymentId: payment.id, invoiceId: invoice.id, clientId: invoice.clientId, amount: amountRaw, currency, issuedById: user.id, method });
    await syncInvoicePaymentState(tx, {
      orgId,
      invoiceId: invoice.id,
      baseCurrency,
      actorUserId: user.id,
      clientPaymentRef: reference || null,
    });
  });

  revalidatePath("/payout-followups");
  revalidatePath("/documents/invoices");
  redirect(flash("/payout-followups", "Invoice payment received"));
}

// ── Pay a supplier bill (bills tab + payables union) ────────────────────────
// Balance cap, dedupe, status, ledger and audit in one transaction. A hidden
// `section` field routes error banners back to the originating tab.

export async function paySupplierBillAction(formData: FormData) {
  const { user, orgId, org } = await requireOrgSession();
  if (!(can.approveInvoices(user) || can.runFinancialReports(user))) redirect("/dashboard");

  const { assertOrgCanMutate } = await import("@/lib/org-write");
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "PAYMENT" });

  const sectionRaw = String(formData.get("section") ?? "bills").trim();
  const section = sectionRaw === "payables" ? "payables" : "bills";
  const back = `/payables?section=${section}`;
  const fail = (message: string): never => redirect(`${back}&error=${encodeURIComponent(message)}`);

  const billId = String(formData.get("billId") ?? "").trim();
  const amountRaw = Number(String(formData.get("amount") ?? "").trim());
  const methodRaw = String(formData.get("method") ?? "CASH").trim();
  const reference = String(formData.get("reference") ?? "").trim() || null;
  if (!billId) return;
  if (!Number.isFinite(amountRaw) || amountRaw <= 0) fail("Enter a payment amount greater than zero.");
  const method = parsePaymentMethod(methodRaw, "OTHER");

  await ensureMoneySchema();
  const paid = await prisma.$transaction(async (tx) => {
    const bill = await tx.supplierBill.findFirst({
      where: { id: billId, orgId, status: { not: "CANCELLED" } },
      select: { id: true, totalAmount: true, paidAmount: true, currency: true, exchangeRateToBase: true },
    });
    if (!bill) return null;
    const balance = bill.totalAmount - bill.paidAmount;
    if (amountRaw > balance) return { over: balance } as const;
    const dup = await findRecentDuplicate(tx.supplierPayment, { orgId, billId, amount: amountRaw });
    if (dup) return { deduped: true } as const;
    const nextPaid = bill.paidAmount + amountRaw;
    const payment = await tx.supplierPayment.create({
      data: {
        orgId, billId, currency: bill.currency || org.baseCurrency,
        amount: amountRaw, method, reference, createdById: user.id,
      },
      select: { id: true, paidAt: true },
    });
    await tx.supplierBill.update({
      where: { id: billId },
      data: {
        paidAmount: nextPaid,
        status: nextPaid <= 0 ? "POSTED" : nextPaid >= bill.totalAmount ? "PAID" : "PART_PAID",
      },
    });
    await postSupplierPayment(tx, {
      orgId,
      userId: user.id,
      amount: toBaseAmount({ amount: amountRaw, currency: bill.currency || org.baseCurrency, baseCurrency: org.baseCurrency, exchangeRateToBase: bill.exchangeRateToBase ?? null }),
      method,
      date: payment.paidAt ?? undefined,
      reference: `supplier-pay:${payment.id}`,
      description: `Supplier payment on bill ${billId} (payables)`,
    });
    return { ok: true } as const;
  });

  if (paid && "over" in paid) {
    fail(`That is more than the outstanding balance of ${formatMoney(paid.over ?? 0, getAppCurrency())}.`);
  }
  if (paid && "ok" in paid) {
    await writeSystemAuditEvent({
      orgId,
      actorUserId: user.id,
      entityType: "SupplierBill",
      entityId: billId,
      action: "SUPPLIER_PAYMENT_RECORDED",
      summary: `Supplier payment on bill ${billId} (payables)`,
    });
  }

  revalidatePath("/payables");
  revalidatePath("/payout-followups");
  revalidatePath("/inventory/supplier-bills");
}

// ── Mark an expense paid (payables union) ────────────────────────────────────
// PaidAt guard in-txn, idempotent ledger post; lands back on Payables.

export async function payExpenseAction(formData: FormData) {
  const { user, orgId, org } = await requireOrgSession();
  if (!can.viewFinancials(user)) redirect("/dashboard");

  const { assertOrgCanMutate } = await import("@/lib/org-write");
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "PAYMENT" });

  const back = "/payables?section=payables";
  const fail = (message: string): never => redirect(`${back}&error=${encodeURIComponent(message)}`);

  const expenseId = String(formData.get("expenseId") ?? "").trim();
  if (!expenseId) return;
  const methodRaw = String(formData.get("method") ?? "").trim();
  const amountRaw = Number(String(formData.get("amount") ?? "").trim());
  const paidAtRaw = String(formData.get("paidAt") ?? "").trim();
  const paidAt = paidAtRaw ? new Date(`${paidAtRaw}T12:00:00.000Z`) : new Date();
  if (Number.isNaN(paidAt.getTime())) fail("Enter a valid payment date.");

  await ensureMoneySchema();
  await prisma.$transaction(async (tx) => {
    await recordExpensePayment(tx, {
      orgId,
      userId: user.id,
      expenseId,
      amount: amountRaw,
      method: methodRaw || null,
      paidAt,
    });
  }).catch((error: unknown) => {
    if (error instanceof Error && "digest" in error) throw error;
    fail(error instanceof Error ? error.message : "Could not record the payment.");
  });

  revalidatePath("/payables");
  revalidatePath("/payout-followups");
  revalidatePath("/finance/expenses");
}

// ── Pay a whole maturity bucket at once (Payables tab) ───────────────────────
// Recomputes the same union the tab shows (open bills, open expenses, tech
// dues), filters to the requested bucket, and settles every row: bills
// capped at balance, expenses and tech dues in full. Each row commits in its
// own transaction so one failure can't block the rest; the summary names
// what cleared and what needs a look. Capped per run for safety.
const BULK_BUCKETS = ["current", "d30", "d60", "d61"] as const;
const BULK_MAX_ROWS = 50;

export async function payBucketAction(formData: FormData) {
  const { user, orgId, org } = await requireOrgSession();
  if (!(can.approveInvoices(user) || can.runFinancialReports(user))) redirect("/dashboard");

  const { assertOrgCanMutate } = await import("@/lib/org-write");
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "PAYMENT" });

  const bucketRaw = String(formData.get("bucket") ?? "").trim();
  const bucket = (BULK_BUCKETS as readonly string[]).includes(bucketRaw) ? bucketRaw : null;
  if (!bucket) redirect("/payables?error=" + encodeURIComponent("Pick a maturity bucket first."));
  const methodRaw = String(formData.get("method") ?? "CASH").trim();
  const method = parsePaymentMethod(methodRaw, "OTHER");
  const back = `/payables?section=payables&bucket=${bucket}`;
  const fail = (message: string): never => redirect(`${back}&error=${encodeURIComponent(message)}`);

  const DAY = 86_400_000;
  const now = Date.now();
  const ageOf = (d: Date | null | undefined) => (d ? Math.max(0, Math.floor((now - new Date(d).getTime()) / DAY)) : 0);
  const overdueOf = (d: Date | null | undefined) => {
    if (!d) return null;
    const diff = Math.floor((now - new Date(d).getTime()) / DAY);
    return diff > 0 ? diff : null;
  };
  const bucketOf = (age: number) => (age <= 0 ? "current" : age <= 30 ? "d30" : age <= 60 ? "d60" : "d61");

  await ensureMoneySchema();
  const [bills, expenses, techJobs] = await Promise.all([
    prisma.supplierBill.findMany({
      where: { orgId, status: { in: ["POSTED", "PART_PAID"] } },
      orderBy: { dueAt: "asc" },
      take: BULK_MAX_ROWS,
      select: { id: true, totalAmount: true, paidAmount: true, currency: true, dueAt: true },
    }),
    prisma.expense.findMany({
      where: { orgId, paidAt: null },
      orderBy: { createdAt: "asc" },
      take: BULK_MAX_ROWS,
      select: { id: true, amount: true, paidAmount: true, dueAt: true, createdAt: true },
    }),
    prisma.job.findMany({
      where: { orgId, repairPath: "EXTERNAL", externalPaid: false, status: { in: ["READY_FOR_PICKUP", "COMPLETED", "DELIVERED"] } },
      orderBy: { updatedAt: "asc" },
      take: BULK_MAX_ROWS,
      select: { id: true, jobNumber: true, externalTechFee: true, externalTechBill: true, completedAt: true, deliveredAt: true, updatedAt: true },
    }),
  ]);
  const techTotals = await getTechnicianPayoutTotalsByJobIds(techJobs.map((j) => j.id));

  type DueRow =
    | { kind: "BILL"; id: string; amount: number; age: number }
    | { kind: "EXPENSE"; id: string; amount: number; age: number }
    | { kind: "TECH"; id: string; amount: number; age: number };
  const due: DueRow[] = [
    ...bills.map((b): DueRow => {
      const overdue = overdueOf(b.dueAt);
      return {
        kind: "BILL", id: b.id,
        amount: Math.max(0, b.totalAmount - b.paidAmount),
        // Bills without a due date count as current, like the tab.
        age: overdue ?? 0,
      };
    }),
  ];
  for (const e of expenses) {
    const overdue = overdueOf(e.dueAt);
    due.push({
      kind: "EXPENSE", id: e.id,
      amount: Math.max(0, e.amount - e.paidAmount),
      age: overdue ?? ageOf(e.createdAt),
    });
  }
  for (const j of techJobs) {
    const paid = techTotals.get(j.id)?.paidAmount ?? 0;
    due.push({
      kind: "TECH", id: j.id,
      amount: Math.max(0, resolveTechCost(j.externalTechFee, j.externalTechBill) - paid),
      age: ageOf(j.deliveredAt ?? j.completedAt ?? j.updatedAt),
    });
  }
  const targets = due.filter((r) => r.amount > 0 && bucketOf(r.age) === bucket).slice(0, BULK_MAX_ROWS);
  if (targets.length === 0) fail("Nothing payable in that bucket right now.");

  let cleared = 0;
  const skipped: string[] = [];
  const today = new Date();
  for (const t of targets) {
    try {
      if (t.kind === "BILL") {
        await prisma.$transaction(async (tx) => {
          const bill = await tx.supplierBill.findFirst({
            where: { id: t.id, orgId, status: { not: "CANCELLED" } },
            select: { id: true, totalAmount: true, paidAmount: true, currency: true, exchangeRateToBase: true },
          });
          if (!bill) throw new Error("Bill gone.");
          const balance = bill.totalAmount - bill.paidAmount;
          if (!(balance > 0)) return;
          const pay = Math.min(balance, t.amount);
          const { postSupplierPayment } = await import("@/lib/accounting/post");
          const payment = await tx.supplierPayment.create({
            data: { orgId, billId: bill.id, currency: bill.currency || org.baseCurrency, amount: pay, method, createdById: user.id },
            select: { id: true, paidAt: true },
          });
          const nextPaid = bill.paidAmount + pay;
          await tx.supplierBill.update({
            where: { id: bill.id },
            data: { paidAmount: nextPaid, status: nextPaid >= bill.totalAmount ? "PAID" : "PART_PAID" },
          });
          await postSupplierPayment(tx, {
            orgId, userId: user.id, amount: pay, method,
            date: payment.paidAt ?? undefined,
            reference: `supplier-pay:${payment.id}`,
            description: `Supplier payment on bill ${bill.id} (bulk)`,
          });
        });
      } else if (t.kind === "EXPENSE") {
        await prisma.$transaction(async (tx) => {
          const { recordExpensePayment } = await import("@/lib/commercial/expense-payments");
          await recordExpensePayment(tx, {
            orgId, userId: user.id, expenseId: t.id, amount: t.amount, method, paidAt: today,
          });
        });
      } else {
        const job = await prisma.job.findFirst({
          where: { id: t.id, orgId },
          select: { id: true, jobNumber: true, externalTechFee: true, externalTechBill: true },
        });
        if (!job) throw new Error("Job gone.");
        const due = resolveTechCost(job.externalTechFee, job.externalTechBill);
        const paid = (await getTechnicianPayoutTotalsByJobIds([job.id])).get(job.id)?.paidAmount ?? 0;
        const remaining = Math.max(0, due - paid);
        if (!(remaining > 0)) continue;
        await prisma.$transaction(async (tx) => {
          const { postTechnicianPayout } = await import("@/lib/accounting/post");
          const payout = await tx.technicianPayout.create({
            data: { orgId, jobId: job.id, amount: remaining, method: "CASH", note: "Bulk pay from Payables", recordedById: user.id },
            select: { id: true },
          });
          await postTechnicianPayout(tx, {
            orgId, userId: user.id, amount: remaining, method: "CASH",
            reference: `techpay:${payout.id}`,
            description: `Technician payout ${job.jobNumber} (bulk)`,
          });
          await tx.job.updateMany({
            where: { id: job.id, orgId },
            data: { externalPaid: true, externalPaidAt: new Date(), externalPaidById: user.id },
          });
        });
      }
      cleared += 1;
    } catch (error) {
      if (error instanceof Error && "digest" in error) throw error;
      skipped.push(t.id);
    }
  }

  await writeSystemAuditEvent({
    orgId,
    actorUserId: user.id,
    entityType: "BulkPay",
    entityId: `${bucket}:${Date.now()}`,
    action: "BULK_PAY_BUCKET",
    summary: `Bulk-paid ${cleared} item(s) in ${bucket} bucket; skipped ${skipped.length}`,
  }).catch(() => {});

  revalidatePath("/payables");
  redirect(flash(back, cleared > 0
    ? `Paid ${cleared} item${cleared !== 1 ? "s" : ""}${skipped.length > 0 ? `, ${skipped.length} skipped` : ""}`
    : "Nothing cleared — rows changed while paying."));
}
