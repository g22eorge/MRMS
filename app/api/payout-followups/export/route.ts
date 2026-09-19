import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { resolveTechCost } from "@/lib/billing";
import { getTechnicianPayoutTotalsByJobIds } from "@/lib/payouts";
import { filterSupportedJobStatuses } from "@/lib/job-status-server";
import { clientDisplayName } from "@/lib/client-name";
import { icontains } from "@/lib/db/search";
import type { JobStatus, InvoiceStatus, SupplierBillStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const TERMINAL = filterSupportedJobStatuses(["READY_FOR_PICKUP", "COMPLETED", "DELIVERED"]) as JobStatus[];
const UNPAID_BILL_STATUSES = ["POSTED", "PART_PAID"] as SupplierBillStatus[];
const MAX_ROWS = 2000;

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

function date(value: Date | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function download(name: string, body: string) {
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
    },
  });
}

const bucketOf = (age: number) => (age <= 0 ? "current" : age <= 30 ? "d30" : age <= 60 ? "d60" : "d61");

export async function GET(request: NextRequest) {
  const { user, orgId } = await requireOrgSession();
  const canSeeRepairs = can.approveInvoices(user) || can.reviewExternalBills(user);
  const canSeeInvoices = can.approveInvoices(user);
  const canSeeBills = can.approveInvoices(user) || can.runFinancialReports(user);
  const canSeeExpenses = can.viewFinancials(user);
  if (!canSeeRepairs && !canSeeInvoices && !canSeeBills && !canSeeExpenses) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const section = params.get("section") ?? "invoices";
  const q = (params.get("q") ?? "").trim() || undefined;
  const tech = (params.get("tech") ?? "").trim() || undefined;
  const bucket = (params.get("bucket") ?? "").trim() || undefined;
  const today = new Date().toISOString().slice(0, 10);

  if (section === "invoices" && canSeeInvoices) {
    const rows = await prisma.invoice.findMany({
      where: {
        orgId,
        status: { in: ["ISSUED"] as InvoiceStatus[] },
        ...(q ? { OR: [{ invoiceNumber: icontains(q) }, { client: { OR: [{ fullName: icontains(q) }, { organization: icontains(q) }] } }, { subject: icontains(q) }] } : {}),
      },
      orderBy: [{ dueDate: "asc" }, { issuedAt: "desc" }],
      take: MAX_ROWS,
      select: { invoiceNumber: true, invoiceType: true, subject: true, totalAmount: true, paidAmount: true, dueDate: true, issuedAt: true, client: { select: { fullName: true, organization: true, phone: true } } },
    });
    return download(
      `invoice-collections-${today}.csv`,
      csv(
        ["invoiceNumber", "type", "client", "phone", "subject", "total", "paid", "balance", "dueDate", "issuedAt"],
        rows.map((r) => [r.invoiceNumber, r.invoiceType, clientDisplayName(r.client, ""), r.client?.phone ?? "", r.subject ?? "", r.totalAmount, r.paidAmount, r.totalAmount - r.paidAmount, date(r.dueDate), date(r.issuedAt)]),
      ),
    );
  }

  if (section === "repairs" && canSeeRepairs) {
    const rows = await prisma.job.findMany({
      where: {
        orgId, clientBill: { gt: 0 }, clientPaid: false, status: { in: TERMINAL }, invoice: { is: null },
        ...(q ? { OR: [{ jobNumber: icontains(q) }, { client: { OR: [{ fullName: icontains(q) }, { organization: icontains(q) }] } }] } : {}),
        ...(tech ? { assignedToId: tech } : {}),
      },
      orderBy: [{ deliveredAt: "desc" }, { completedAt: "desc" }, { updatedAt: "desc" }],
      take: MAX_ROWS,
      select: { jobNumber: true, status: true, clientBill: true, completedAt: true, deliveredAt: true, client: { select: { fullName: true, organization: true, phone: true } }, assignedTo: { select: { name: true } } },
    });
    return download(
      `repair-collections-${today}.csv`,
      csv(
        ["jobNumber", "status", "client", "phone", "technician", "clientBill", "doneAt"],
        rows.map((r) => [r.jobNumber, r.status, clientDisplayName(r.client, ""), r.client?.phone ?? "", r.assignedTo?.name ?? "", r.clientBill ?? 0, date(r.deliveredAt ?? r.completedAt)]),
      ),
    );
  }

  if (section === "bills" && canSeeBills) {
    const rows = await prisma.supplierBill.findMany({
      where: {
        orgId, status: { in: UNPAID_BILL_STATUSES },
        ...(q ? { OR: [{ billNumber: icontains(q) }, { supplier: { name: icontains(q) } }] } : {}),
      },
      orderBy: [{ dueAt: "asc" }, { issuedAt: "desc" }],
      take: MAX_ROWS,
      select: { billNumber: true, status: true, totalAmount: true, paidAmount: true, currency: true, dueAt: true, issuedAt: true, supplier: { select: { name: true } } },
    });
    return download(
      `supplier-bills-payable-${today}.csv`,
      csv(
        ["billNumber", "supplier", "status", "total", "paid", "balance", "currency", "dueDate", "issuedAt"],
        rows.map((r) => [r.billNumber, r.supplier.name, r.status, r.totalAmount, r.paidAmount, r.totalAmount - r.paidAmount, r.currency, date(r.dueAt), date(r.issuedAt)]),
      ),
    );
  }

  if (section === "tech" && canSeeRepairs) {
    const rows = await prisma.job.findMany({
      where: {
        orgId, repairPath: "EXTERNAL", externalPaid: false, status: { in: TERMINAL },
        ...(q ? { OR: [{ jobNumber: icontains(q) }, { assignedTo: { is: { name: icontains(q) } } }] } : {}),
        ...(tech ? { assignedToId: tech } : {}),
      },
      orderBy: [{ deliveredAt: "desc" }, { completedAt: "desc" }, { updatedAt: "desc" }],
      take: MAX_ROWS,
      select: { id: true, jobNumber: true, status: true, externalTechFee: true, externalTechBill: true, completedAt: true, deliveredAt: true, assignedTo: { select: { name: true } } },
    });
    const totals = await getTechnicianPayoutTotalsByJobIds(rows.map((j) => j.id));
    return download(
      `tech-payouts-pending-${today}.csv`,
      csv(
        ["jobNumber", "technician", "status", "payoutDue", "paid", "remaining", "doneAt"],
        rows.map((r) => {
          const due = resolveTechCost(r.externalTechFee, r.externalTechBill);
          const paid = totals.get(r.id)?.paidAmount ?? 0;
          return [r.jobNumber, r.assignedTo?.name ?? "", r.status, due, paid, Math.max(0, due - paid), date(r.deliveredAt ?? r.completedAt)];
        }),
      ),
    );
  }

  if (section === "payables" && (canSeeBills || canSeeRepairs || canSeeExpenses)) {
    const [bills, expenses, jobs] = await Promise.all([
      canSeeBills ? prisma.supplierBill.findMany({
        where: {
          orgId, status: { in: UNPAID_BILL_STATUSES },
          ...(q ? { OR: [{ billNumber: icontains(q) }, { supplier: { name: icontains(q) } }] } : {}),
        },
        orderBy: [{ dueAt: "asc" }],
        take: MAX_ROWS,
        select: { billNumber: true, status: true, totalAmount: true, paidAmount: true, currency: true, dueAt: true, supplier: { select: { name: true } } },
      }) : Promise.resolve([]),
      canSeeExpenses ? prisma.expense.findMany({
        where: {
          orgId, paidAt: null,
          ...(q ? { OR: [{ description: icontains(q) }, { expenseNumber: icontains(q) }, { supplier: { name: icontains(q) } }] } : {}),
        },
        orderBy: { createdAt: "asc" },
        take: MAX_ROWS,
        select: { expenseNumber: true, description: true, amount: true, paidAmount: true, currency: true, createdAt: true, dueAt: true, supplier: { select: { name: true } } },
      }) : Promise.resolve([]),
      canSeeRepairs ? prisma.job.findMany({
        where: {
          orgId, repairPath: "EXTERNAL", externalPaid: false, status: { in: TERMINAL },
          ...(q ? { OR: [{ jobNumber: icontains(q) }, { assignedTo: { is: { name: icontains(q) } } }] } : {}),
        },
        orderBy: [{ deliveredAt: "asc" }],
        take: MAX_ROWS,
        select: { id: true, jobNumber: true, externalTechFee: true, externalTechBill: true, completedAt: true, deliveredAt: true, updatedAt: true, assignedTo: { select: { name: true } } },
      }) : Promise.resolve([]),
    ]);
    const techTotals = await getTechnicianPayoutTotalsByJobIds(jobs.map((j) => j.id));
    const DAY = 86_400_000;
    const ageOf = (d: Date | null | undefined) => (d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / DAY)) : 0);
    const overdueOf = (d: Date | null | undefined) => {
      if (!d) return null;
      const diff = Math.floor((Date.now() - new Date(d).getTime()) / DAY);
      return diff > 0 ? diff : null;
    };
    type Row = [string, string, string, string, number, string, string, string];
    const out: Row[] = [
      ...bills.map((b): Row => {
        const overdue = overdueOf(b.dueAt);
        return ["Bill", b.supplier.name, b.billNumber, b.status, b.totalAmount - b.paidAmount, b.currency, overdue != null ? `${overdue}d overdue` : "Current", date(b.dueAt)];
      }),
      ...expenses.map((e): Row => {
        const overdue = overdueOf(e.dueAt);
        const age = overdue ?? ageOf(e.createdAt);
        return ["Expense", e.supplier?.name ?? "Unlinked payee", e.expenseNumber, e.paidAmount > 0 ? `${e.description} (part paid)` : e.description, Math.max(0, e.amount - e.paidAmount), e.currency, overdue != null ? `${overdue}d overdue` : `${age}d owed`, date(e.dueAt)];
      }),
      ...jobs.map((j): Row => {
        const due = resolveTechCost(j.externalTechFee, j.externalTechBill);
        const paid = techTotals.get(j.id)?.paidAmount ?? 0;
        const age = ageOf(j.deliveredAt ?? j.completedAt ?? j.updatedAt);
        return ["Tech payout", j.assignedTo?.name ?? "Unassigned", j.jobNumber, "", Math.max(0, due - paid), "", `${age}d owed`, date(j.deliveredAt ?? j.completedAt)];
      }),
    ];
    const wanted = bucket && bucket !== "all" ? bucket : null;
    // Bucket by the same maturity rule as the hub tab; oldest first.
    const aged: Array<{ row: Row; age: number }> = [];
    let i = 0;
    for (; i < bills.length; i += 1) aged.push({ row: out[i] as Row, age: overdueOf(bills[i]?.dueAt) ?? 0 });
    for (const e of expenses) { aged.push({ row: out[i++] as Row, age: overdueOf(e.dueAt) ?? ageOf(e.createdAt) }); }
    for (const j of jobs) { aged.push({ row: out[i++] as Row, age: ageOf(j.deliveredAt ?? j.completedAt ?? j.updatedAt) }); }
    const kept = wanted && wanted !== "all"
      ? aged.filter(({ age }) => bucketOf(age) === wanted).map(({ row }) => row)
      : aged.sort((a, b) => b.age - a.age).map(({ row }) => row);
    return download(
      `payables-${today}.csv`,
      csv(
        ["type", "creditor", "ref", "detail", "balance", "currency", "maturity", "dueDate"],
        kept,
      ),
    );
  }

  return NextResponse.json({ error: "Unknown section" }, { status: 400 });
}
