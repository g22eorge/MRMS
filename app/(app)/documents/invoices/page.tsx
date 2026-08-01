// @ts-nocheck — TODO: resolve underlying type issues and remove this pragma
import Link from "next/link";
import { getCurrentUserRole } from "@/lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import type { DeliveryMethod, InvoiceStatus, InvoiceType, PaymentMethod } from "@prisma/client";
import { Prisma } from "@prisma/client";

import {
  formatMoney,
  formatMoneyCompact,
  isSupportedCurrency,
  normalizeCurrency,
  toBaseAmount,
} from "@/lib/currency";
import { canGenerateInvoiceForStatus } from "@/lib/documents";
import { JobStatus } from "@/lib/job-status";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { orgDb } from "@/lib/db";
import { getDocumentBrandingSettings } from "@/lib/document-branding";
import { sanitizeOptionalText, sanitizeText } from "@/lib/sanitize";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { RowActionsMenu, MenuSection, MenuDestructiveRow, MenuActionLink, MenuActionButton } from "@/components/shared/RowActionsMenu";
import { createReceiptForPayment, nextAvailableInvoiceNumber } from "@/lib/commercial/document-workflow";
import { syncInvoicePaymentState } from "@/lib/commercial/payment-sync";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { PAYMENT_METHODS, parsePaymentMethod } from "@/lib/constants/payment-methods";
import { formatEATDate, formatEATShortDate } from "@/lib/date-eat";
import { sendInvoiceViaWhatsAppAction } from "@/app/(app)/jobs/[id]/actions";
import {
  InvoiceOverdueReminderBulkButton,
  InvoiceOverdueReminderButton,
} from "@/components/documents/InvoiceOverdueReminderForms";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { BulkSelectionProvider } from "./BulkSelectionProvider";
import { BulkActionBar } from "./BulkActionBar";
import { RowCheckbox } from "./RowCheckbox";
import { InvoicePreviewProvider } from "./InvoicePreviewProvider";
import { PreviewButton } from "./PreviewButton";
import { InvoiceCreateDialog } from "./InvoiceCreateDialog";
import { InvoiceNewButton } from "./InvoiceNewButton";
import { parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";

const INVOICE_STATUSES: InvoiceStatus[] = ["DRAFT", "ISSUED", "PAID", "VOID"];
const INVOICE_TYPES: InvoiceType[] = ["REPAIR", "SERVICE", "MERCHANDISE", "CONTRACT", "OTHER"];
const DELIVERY_METHODS: DeliveryMethod[] = ["PICKUP", "DELIVERY", "COURIER"];

export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; q?: string; aging?: string; create?: string; collect?: string; pay?: string; error?: string; reminded?: string; remindedBulk?: string; reminderSkipped?: string; reminderFailed?: string; reminderError?: string; page?: string }>;
}) {
  const { user } = await getCurrentUserRole();
  const db = orgDb(user.orgId);
  const canCreateInvoice = can.createInvoices(user);
  const canManageInvoicePayments = "ADMIN" === user.role || "OPS" === user.role || can.approveInvoices(user);
  const canOverrideDiscount = can.overrideDiscount(user);
  if (!(canCreateInvoice || canManageInvoicePayments)) {
    redirect("/dashboard");
  }

  // Org base currency for the Collect Revenue section totals
  const orgRow = user.orgId
    ? await prisma.organization.findUnique({ where: { id: user.orgId }, select: { baseCurrency: true } }).catch(() => null)
    : null;
  const orgCurrency = normalizeCurrency(orgRow?.baseCurrency, "UGX");

  const params = await searchParams;
  const createMode  = params.create === "1"; // mobile "New Invoice" → show creation form
  const collectMode = params.collect === "1"; // mobile "Collect Revenue" button → show panel
  const payInvoiceId = (params.pay ?? "").trim(); // inline payment form for this invoice ID
  const typeFilter = params.type ?? "all";
  const statusFilter = params.status ?? "all";
  const agingFilter = params.aging ?? "all";
  const q = (params.q ?? "").trim();
  const page = parsePage(params.page);
  const errorParam = params.error ?? "";
  const remindedParam = params.reminded ?? "";
  const remindedBulkParam = params.remindedBulk ?? "";
  const reminderSkippedParam = params.reminderSkipped ?? "";
  const reminderFailedParam = params.reminderFailed ?? "";
  const reminderErrorParam = params.reminderError ?? "";

  let dbNeedsFix = false;

  // ── Server actions ───────────────────────────────────────────────────────────

  async function createStandaloneInvoiceAction(formData: FormData) {
    "use server";
    const { user } = await getCurrentUserRole();
    const orgId = user.orgId;
    const db = orgDb(orgId);
    if (!can.createInvoices(user)) redirect("/dashboard");

    const clientId = String(formData.get("clientId") ?? "").trim();
    const requestedNewClient = {
      fullName: sanitizeText(String(formData.get("newClientFullName") ?? "")),
      phone: sanitizeText(String(formData.get("newClientPhone") ?? "")),
      email: sanitizeOptionalText(formData.get("newClientEmail")),
      organization: sanitizeOptionalText(formData.get("newClientOrganization")),
      address: sanitizeOptionalText(formData.get("newClientAddress")),
    };
    const hasNewClient = Boolean(requestedNewClient.fullName || requestedNewClient.phone);
    const subject = String(formData.get("subject") ?? "").trim();
    const invoiceTypeRaw = String(formData.get("invoiceType") ?? "SERVICE").trim();
    const currency = normalizeCurrency(formData.get("currency"), orgCurrency);
    const dueDateRaw = String(formData.get("dueDate") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const taxApplicable = String(formData.get("taxApplicable") ?? "") === "1";
    const requestedTaxRate = Number(String(formData.get("taxRate") ?? "0").trim());
    const taxRate = taxApplicable ? Math.min(Math.max(Number.isFinite(requestedTaxRate) ? requestedTaxRate : 0, 0), 100) : 0;
    const taxLabel = sanitizeText(String(formData.get("taxLabel") ?? "Tax")).slice(0, 32) || "Tax";

    let rawItems: Array<{ partId?: string | null; description?: string; quantity?: number; unitPrice?: number; discount?: number }> = [];
    try {
      const parsed = JSON.parse(String(formData.get("items") ?? "[]"));
      if (Array.isArray(parsed)) rawItems = parsed;
    } catch {
      rawItems = [];
    }

    const items = rawItems.map((item) => {
      const partId = item.partId ? String(item.partId).trim() : null;
      const description = sanitizeText(String(item.description ?? ""));
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const requestedDiscount = Number(item.discount);
      const discountPercent = can.overrideDiscount(user)
        ? Math.min(Math.max(Number.isFinite(requestedDiscount) ? requestedDiscount : 0, 0), 100)
        : 0;
      const gross = quantity * unitPrice;
      const discountAmount = gross * (discountPercent / 100);
      const lineTotal = gross - discountAmount;
      return { partId, description, quantity, unitPrice, discountAmount, lineTotal };
    });

    if ((!clientId && !hasNewClient) || !items.length) {
      redirect("/documents/invoices?error=missing-fields");
    }
    if (hasNewClient && (requestedNewClient.fullName.length < 2 || requestedNewClient.phone.length < 3)) {
      redirect("/documents/invoices?error=missing-fields");
    }
    if (items.some((item) => !item.description || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) {
      redirect("/documents/invoices?error=missing-fields");
    }

    let resolvedClientId = clientId || null;
    if (resolvedClientId) {
      const client = await db.client.findFirst({ where: { id: resolvedClientId }, select: { id: true } });
      if (!client) redirect("/documents/invoices?error=client-not-found");
    }

    const partIds = [...new Set(items.map((item) => item.partId).filter((partId): partId is string => Boolean(partId)))];
    if (partIds.length) {
      const validParts = await prisma.part.findMany({ where: { id: { in: partIds }, orgId, isActive: true }, select: { id: true } });
      if (validParts.length !== partIds.length) redirect("/documents/invoices?error=missing-fields");
    }

    const invoiceType = INVOICE_TYPES.includes(invoiceTypeRaw as InvoiceType)
      ? (invoiceTypeRaw as InvoiceType)
      : ("SERVICE" as InvoiceType);
    const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const taxAmount = taxRate > 0 ? subtotal * (taxRate / 100) : 0;
    const totalAmount = subtotal + taxAmount;
    const invoiceSubject = sanitizeText(subject || items[0]?.description || "Invoice");

    const invoice = await prisma.$transaction(async (tx) => {
      if (hasNewClient) {
        const existingClient = await tx.client.findFirst({
          where: { phone: requestedNewClient.phone, orgId },
          select: { id: true, email: true, organization: true, address: true },
        });
        if (existingClient) {
          resolvedClientId = existingClient.id;
          const fillMissing: { email?: string | null; organization?: string | null; address?: string | null } = {};
          if (!existingClient.email && requestedNewClient.email) fillMissing.email = requestedNewClient.email;
          if (!existingClient.organization && requestedNewClient.organization) fillMissing.organization = requestedNewClient.organization;
          if (!existingClient.address && requestedNewClient.address) fillMissing.address = requestedNewClient.address;
          if (Object.keys(fillMissing).length) await tx.client.update({ where: { id: existingClient.id }, data: fillMissing });
        } else {
          const createdClient = await tx.client.create({
            data: {
              orgId,
              fullName: requestedNewClient.fullName,
              phone: requestedNewClient.phone,
              email: requestedNewClient.email,
              organization: requestedNewClient.organization,
              address: requestedNewClient.address,
            },
            select: { id: true },
          });
          resolvedClientId = createdClient.id;
        }
      }
      if (!resolvedClientId) throw new Error("client-not-found");
      const invoiceNumber = await nextAvailableInvoiceNumber(tx);
      const created = await tx.invoice.create({
        data: {
          orgId,
          clientId: resolvedClientId,
          invoiceType,
          subject: invoiceSubject,
          invoiceNumber,
          currency,
          status: "ISSUED" as InvoiceStatus,
          totalAmount,
          dueDate,
          notes: notes ? sanitizeText(notes) : null,
          lines: {
            create: items.map((item) => {
              const lineTax = taxAmount > 0 && subtotal > 0 ? taxAmount * (item.lineTotal / subtotal) : 0;
              return {
                orgId,
                sourceType: item.partId ? "Part" : "Custom",
                sourceId: item.partId,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountAmount: item.discountAmount,
                taxAmount: lineTax,
                lineTotal: item.lineTotal,
              };
            }),
          },
        },
      });

      // Decrement stock for part-linked (product) lines — this is a direct goods
      // sale. Repair invoices use sourceType "QuotationItem" and are consumed at
      // job completion instead, so this never double-counts.
      for (const item of items) {
        if (!item.partId) continue;
        await tx.part.update({ where: { id: item.partId }, data: { qtyOnHand: { decrement: item.quantity } } });
        await tx.partStockTransaction.create({
          data: {
            partId: item.partId,
            type: "OUT",
            quantity: item.quantity,
            reason: `Invoice ${invoiceNumber}: ${item.description}`.slice(0, 500),
            createdById: user.id,
          },
        });
      }

      return created;
    });
    await writeSystemAuditEvent({
      orgId,
      actorUserId: user.id,
      entityType: "Invoice",
      entityId: invoice.id,
      action: "INVOICE_CREATED",
      summary: `${invoice.invoiceNumber} created: ${invoiceSubject}${taxAmount > 0 ? ` with ${taxLabel} ${taxRate}%` : ""}`,
    });
    revalidatePath("/documents/invoices");
    redirect(`/documents/invoices?pay=${invoice.id}`);
  }

  async function addPaymentAction(formData: FormData) {
    "use server";
    const { user } = await getCurrentUserRole();
    const orgId = user.orgId;
    const db = orgDb(orgId);
    if (!("ADMIN" === user.role || "OPS" === user.role || can.approveInvoices(user))) return;

    const invoiceId = String(formData.get("invoiceId") ?? "").trim();
    // Strip commas / currency prefix so "50,000" or "UGX 50,000" parses correctly
    const rawAmount = String(formData.get("amount") ?? "").replace(/[^\d.]/g, "").trim();
    const method = String(formData.get("method") ?? "CASH").trim();
    const reference = String(formData.get("reference") ?? "").trim();
    const org = await prisma.organization.findUnique({ where: { id: orgId! }, select: { baseCurrency: true } });
    const baseCurrency = org?.baseCurrency ?? "UGX";
    const currency = normalizeCurrency(formData.get("currency"), baseCurrency);
    const exchangeRateToBaseRaw = String(formData.get("exchangeRateToBase") ?? "").trim();
    if (!invoiceId) return;

    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (!isSupportedCurrency(currency)) return;

    // For the base currency (UGX) no exchange rate needed — null means 1:1
    const isBaseCurrency = currency === baseCurrency;
    const exchangeRateToBase = isBaseCurrency
      ? null
      : exchangeRateToBaseRaw
        ? Number(exchangeRateToBaseRaw)
        : null;
    // Only require exchange rate for non-base currencies
    if (!isBaseCurrency) {
      if (!exchangeRateToBase || !Number.isFinite(exchangeRateToBase) || exchangeRateToBase <= 0)
        return;
    }

    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId },
      select: { id: true, totalAmount: true, paidAmount: true, jobId: true, clientId: true, status: true },
    });
    if (!invoice || invoice.status === "VOID") return;

    const existingPaid = invoice.paidAmount ?? 0;
    if (existingPaid + amount > invoice.totalAmount) return;

    const safeMethod = parsePaymentMethod(method, "OTHER");

    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          currency,
          exchangeRateToBase,
          amount,
          method: safeMethod,
          reference: reference || null,
          createdById: user.id,
          orgId,
        },
      });
      await createReceiptForPayment(tx, {
        orgId,
        paymentId: payment.id,
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        amount,
        currency,
        issuedById: user.id,
      });

      await syncInvoicePaymentState(tx, {
        orgId: orgId!,
        invoiceId: invoice.id,
        baseCurrency,
        actorUserId: user.id,
        clientPaymentRef: reference || null,
      });
    });

    revalidatePath("/documents/invoices");
    // Clear the ?pay= param by redirecting back to the clean URL
    redirect("/documents/invoices");
  }

  // Create an invoice record from a completed job, then redirect straight to
  // the inline payment form so the user can collect immediately in one flow.
  async function createAndCollectAction(formData: FormData) {
    "use server";
    const { user } = await getCurrentUserRole();
    const orgId = user.orgId;
    const db = orgDb(orgId);
    const canManagePayments = "ADMIN" === user.role || "OPS" === user.role || can.approveInvoices(user);
    if (!can.createInvoices(user) && !can.approveInvoices(user)) return;

    const jobId = String(formData.get("jobId") ?? "").trim();
    if (!jobId) return;

    const job = await db.job.findFirst({
      where: { id: jobId, ...(canManagePayments ? {} : { createdById: user.id }) },
      select: { id: true, jobNumber: true, clientId: true, clientBill: true, invoiceIssuedAt: true, invoiceNumber: true, status: true },
    });
    if (!job || !job.clientBill || job.clientBill <= 0) return;

    // If invoice already exists, go straight to collect. Some older rows may
    // have an Invoice without the matching job stamp, so repair that stamp.
    const existing = await db.invoice.findFirst({
      where: { jobId: job.id },
      select: { id: true, invoiceNumber: true, issuedAt: true },
    });
    if (existing) {
      if (!job.invoiceIssuedAt || !job.invoiceNumber) {
        await db.job.updateMany({
          where: { id: job.id },
          data: { invoiceIssuedAt: existing.issuedAt, invoiceNumber: existing.invoiceNumber },
        });
      }
      redirect(`/documents/invoices?pay=${existing.id}`);
    }

    // Create the invoice record
    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await nextAvailableInvoiceNumber(tx);
      const inv = await tx.invoice.create({
        data: {
          orgId,
          jobId: job.id,
          clientId: job.clientId,
          invoiceType: "REPAIR",
          invoiceNumber,
          subject: `Repair job ${job.jobNumber}`,
          currency: orgCurrency,
          status: "ISSUED",
          totalAmount: job.clientBill!,
          issuedAt: new Date(),
        },
      });
      // Stamp invoice details on the job
      await tx.job.update({
        where: { id: job.id },
        data: { invoiceIssuedAt: new Date(), invoiceNumber },
      });
      return inv;
    });

    await writeSystemAuditEvent({
      orgId, actorUserId: user.id, entityType: "Invoice", entityId: invoice.id,
      action: "INVOICE_CREATED", summary: `${invoice.invoiceNumber} created from ${job.jobNumber}`,
    });

    revalidatePath("/documents/invoices");
    // Redirect straight to the inline payment form
    redirect(`/documents/invoices?pay=${invoice.id}`);
  }

  async function updateInvoiceAction(formData: FormData) {
    "use server";
    const { user } = await getCurrentUserRole();
    const db = orgDb(user.orgId);
    if (!("ADMIN" === user.role || "OPS" === user.role || can.approveInvoices(user))) return;

    const invoiceId = String(formData.get("invoiceId") ?? "").trim();
    const statusRaw = String(formData.get("status") ?? "ISSUED").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const subject = String(formData.get("subject") ?? "").trim();
    if (!invoiceId) return;
    const status = INVOICE_STATUSES.includes(statusRaw as InvoiceStatus)
      ? (statusRaw as InvoiceStatus)
      : ("ISSUED" as InvoiceStatus);

    await db.invoice.updateMany({
      where: { id: invoiceId },
      data: { status, notes: notes || null, subject: subject || null },
    });
    revalidatePath("/documents/invoices");
  }

  async function deleteInvoiceAction(formData: FormData) {
    "use server";
    const { user } = await getCurrentUserRole();
    const db = orgDb(user.orgId);
    if (!("ADMIN" === user.role || can.approveInvoices(user))) return;

    const invoiceId = String(formData.get("invoiceId") ?? "").trim();
    if (!invoiceId) return;

    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId },
      select: {
        id: true,
        jobId: true,
        payments: { select: { id: true }, take: 1 },
        deliveryNotes: { select: { id: true }, take: 1 },
      },
    });
    if (!invoice || invoice.payments.length > 0 || invoice.deliveryNotes.length > 0) return;

    await prisma.$transaction(async (tx) => {
      await tx.invoice.deleteMany({ where: { id: invoice.id } });
      if (invoice.jobId) {
        await tx.job.updateMany({
          where: { id: invoice.jobId },
          data: { invoiceIssuedAt: null, invoiceNumber: null },
        });
      }
    });
    revalidatePath("/documents/invoices");
  }

  async function sendInvoiceWhatsAppFromRowAction(formData: FormData) {
    "use server";
    const jobId = String(formData.get("jobId") ?? "").trim();
    if (!jobId) return;
    await sendInvoiceViaWhatsAppAction(jobId);
    revalidatePath("/documents/invoices");
  }

  async function createDeliveryNoteAction(formData: FormData) {
    "use server";
    const { user } = await getCurrentUserRole();
    const db = orgDb(user.orgId);
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS"].includes(user.role))) redirect("/dashboard");

    const invoiceId = String(formData.get("invoiceId") ?? "").trim();
    const deliveredByName = String(formData.get("deliveredByName") ?? "").trim();
    const receivedByName = String(formData.get("receivedByName") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    const methodRaw = String(formData.get("deliveryMethod") ?? "").trim();
    if (!invoiceId || !deliveredByName || !receivedByName) return;

    const deliveryMethod = DELIVERY_METHODS.includes(methodRaw as DeliveryMethod)
      ? (methodRaw as DeliveryMethod)
      : null;
    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        paidAmount: true,
        totalAmount: true,
        subject: true,
        job: { select: { jobNumber: true, brand: true, model: true } },
      },
    });
    if (!invoice || invoice.paidAmount < invoice.totalAmount) return;

    await prisma.$transaction(async (tx) => {
      const deliveryNoteNumber = await nextDocumentNumber(tx, "DN", "deliveryNote");
      const desc = invoice.job
        ? `Repair handover for ${invoice.job.jobNumber} (${invoice.job.brand} ${invoice.job.model})`
        : (invoice.subject ?? invoice.invoiceNumber);
      await tx.deliveryNote.create({
        data: {
          invoiceId: invoice.id,
          orgId: user.orgId,
          deliveryNoteNumber,
          deliveryMethod,
          deliveredByName,
          receivedByName,
          note: note || null,
          createdById: user.id,
          items: { create: [{ description: desc, quantity: 1 }] },
        },
      });
    });
    revalidatePath("/documents/invoices");
    revalidatePath("/documents/delivery-notes");
  }

  // ── Data fetching ────────────────────────────────────────────────────────────

  const where: Prisma.InvoiceWhereInput = {};
  if (typeFilter !== "all") where.invoiceType = typeFilter as InvoiceType;
  if (statusFilter !== "all") where.status = statusFilter as InvoiceStatus;
  // Search in the DB, not in-memory over the top-150, so older invoices are findable.
  if (q) {
    where.OR = [
      { invoiceNumber: { contains: q } },
      { subject: { contains: q } },
      { job: { jobNumber: { contains: q } } },
      { job: { client: { fullName: { contains: q } } } },
      { client: { fullName: { contains: q } } },
    ];
  }

  type InvoiceRow = {
    id: string;
    invoiceNumber: string;
    invoiceType: string;
    subject: string | null;
    issuedAt: Date;
    dueDate: Date | null;
    currency: string | null;
    totalAmount: number;
    paidAmount: number;
    status: string;
    notes: string | null;
    job: { id: string; jobNumber: string; status: JobStatus; client: { fullName: string } } | null;
    client: { id: string; fullName: string } | null;
    payments: Array<{ id: string }>;
    deliveryNotes: Array<{ id: string }>;
  };

  let invoices: InvoiceRow[] = [];

  try {
    const raw = await db.invoice.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      take: 150,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceType: true,
        subject: true,
        issuedAt: true,
        dueDate: true,
        currency: true,
        totalAmount: true,
        paidAmount: true,
        status: true,
        notes: true,
        job: {
          select: {
            id: true,
            jobNumber: true,
            status: true,
            client: { select: { fullName: true } },
          },
        },
        client: { select: { id: true, fullName: true } },
        payments: { select: { id: true }, take: 1 },
        deliveryNotes: { select: { id: true }, take: 1 },
      },
    });
    invoices = raw.map((inv) => ({ ...inv, invoiceType: inv.invoiceType ?? "REPAIR" }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("no such table") && msg.includes("Invoice")) dbNeedsFix = true;
    invoices = [];
  }

  const now = new Date();
  // Compute aging for each outstanding invoice
  const withAging = invoices.map((inv) => {
    const balance = Math.max(0, inv.totalAmount - inv.paidAmount);
    const isPaid = balance <= 0 || inv.status === "PAID";
    const isVoid = inv.status === "VOID";
    let daysOverdue = 0;
    if (!isPaid && !isVoid) {
      const dueOrIssued = inv.dueDate ?? inv.issuedAt;
      daysOverdue = Math.floor((now.getTime() - dueOrIssued.getTime()) / 86400000);
    }
    return { ...inv, balance, isPaid, isVoid, daysOverdue };
  });

  // Apply aging filter
  const filtered = (() => {
    // Text search is applied in the DB query above (where.OR); only aging is JS.
    const base = withAging;
    if (agingFilter === "current") return base.filter((i) => !i.isVoid && !i.isPaid && i.daysOverdue <= 0);
    if (agingFilter === "1-30") return base.filter((i) => !i.isVoid && !i.isPaid && i.daysOverdue >= 1 && i.daysOverdue <= 30);
    if (agingFilter === "31-60") return base.filter((i) => !i.isVoid && !i.isPaid && i.daysOverdue >= 31 && i.daysOverdue <= 60);
    if (agingFilter === "61+") return base.filter((i) => !i.isVoid && !i.isPaid && i.daysOverdue >= 61);
    return base;
  })();

  // KPIs/aging/summaries stay computed from the full `filtered` array; only the
  // rendered list rows are paginated.
  const pageView = paginationView(page, filtered.length);
  const pageRows = filtered.slice(pageView.skip, pageView.skip + pageView.take);
  const invoicesHref = pageHrefBuilder("/documents/invoices", {
    type: typeFilter !== "all" ? typeFilter : "",
    status: statusFilter !== "all" ? statusFilter : "",
    aging: agingFilter !== "all" ? agingFilter : "",
    q,
  });

  const readyJobs = await db.job
    .findMany({
      where: {
        status: { in: ["READY_FOR_PICKUP", "COMPLETED", "CLOSED"] },
        invoiceIssuedAt: null,
        ...(canManageInvoicePayments ? {} : { createdById: user.id }),
      },
      orderBy: { completedAt: "asc" }, // oldest first — most urgent to collect
      take: 20,
      select: {
        id: true,
        jobNumber: true,
        status: true,
        brand: true,
        model: true,
        clientBill: true,
        completedAt: true,
        receivedAt: true,
        client: { select: { fullName: true, phone: true } },
      },
    })
    .catch(() => []);
  const readyJobsTotal = readyJobs.reduce((s, j) => s + (j.clientBill ?? 0), 0);

  const [clients, invoiceParts, invoiceTaxRates, branding] = await Promise.all([
    db.client
      .findMany({
        where: {},
        orderBy: { fullName: "asc" },
        take: 300,
        select: { id: true, fullName: true, phone: true, email: true, organization: true, address: true },
      })
      .catch(() => []),
    prisma.part.findMany({
      where: { orgId: user.orgId, isActive: true },
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, sku: true, name: true, unitCost: true, qtyOnHand: true },
    }).catch(() => []),
    prisma.taxRate.findMany({
      where: { orgId: user.orgId, isActive: true, appliesToSales: true },
      orderBy: [{ isDefault: "desc" }, { code: "asc" }],
      select: { id: true, name: true, code: true, rate: true, isDefault: true },
    }).catch(() => []),
    getDocumentBrandingSettings(user.orgId).catch(() => ({
      vatDefaultApplicable: false,
      vatRatePercent: 18,
      vatLabel: "VAT",
    })),
  ]);
  const defaultInvoiceTaxRate = invoiceTaxRates.find((rate) => rate.isDefault) ?? null;

  const leads = await db.lead
    .findMany({
      where: { orgId: user.orgId, status: { notIn: ["LOST", "STALE"] } },
      orderBy: { updatedAt: "desc" },
      take: 150,
      select: { id: true, fullName: true, phone: true, email: true, organization: true, interest: true },
    })
    .catch(() => []);

  const jobs = await db.job
    .findMany({
      where: { orgId: user.orgId, status: { notIn: ["CLOSED"] } },
      orderBy: { updatedAt: "desc" },
      take: 150,
      select: {
        id: true,
        jobNumber: true,
        brand: true,
        model: true,
        client: { select: { fullName: true, phone: true, address: true } },
      },
    })
    .catch(() => []);

  // ── Aging analysis ────────────────────────────────────────────────────────
  const outstanding = withAging.filter((i) => !i.isPaid && !i.isVoid);
  const agingBands = [
    {
      label: "Current",
      key: "current",
      items: outstanding.filter((i) => i.daysOverdue <= 0),
      color: "text-[var(--ink)]",
      bg: "bg-[var(--panel)]",
      border: "border-[var(--line)]",
    },
    {
      label: "1–30 days",
      key: "1-30",
      items: outstanding.filter((i) => i.daysOverdue >= 1 && i.daysOverdue <= 30),
      color: "text-amber-700",
      bg: "bg-amber-500/8",
      border: "border-amber-400/30",
    },
    {
      label: "31–60 days",
      key: "31-60",
      items: outstanding.filter((i) => i.daysOverdue >= 31 && i.daysOverdue <= 60),
      color: "text-orange-700",
      bg: "bg-orange-500/8",
      border: "border-orange-400/30",
    },
    {
      label: "61+ days",
      key: "61+",
      items: outstanding.filter((i) => i.daysOverdue >= 61),
      color: "text-red-700",
      bg: "bg-red-500/10",
      border: "border-red-400/30",
    },
  ];

  const totalBilled = invoices.filter((i) => i.status !== "VOID").reduce((s, i) => s + i.totalAmount, 0);
  const totalCollected = invoices.filter((i) => i.status !== "VOID").reduce((s, i) => s + i.paidAmount, 0);
  const totalOutstanding = outstanding.reduce((s, i) => s + i.balance, 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;
  const byType = INVOICE_TYPES.map((t) => ({
    type: t,
    count: invoices.filter((i) => i.invoiceType === t).length,
  })).filter((x) => x.count > 0);
  const criticalOverdue = [...agingBands[3].items, ...agingBands[2].items]
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, 5);

  const reminderReturnQuery = new URLSearchParams();
  if (typeFilter !== "all") reminderReturnQuery.set("type", typeFilter);
  if (statusFilter !== "all") reminderReturnQuery.set("status", statusFilter);
  if (agingFilter !== "all") reminderReturnQuery.set("aging", agingFilter);
  if (q) reminderReturnQuery.set("q", q);
  const reminderReturnTo = `/documents/invoices${reminderReturnQuery.toString() ? `?${reminderReturnQuery.toString()}` : ""}`;
  const reminderContext = {
    returnTo: reminderReturnTo,
    aging: agingFilter !== "all" ? agingFilter : undefined,
  };
  const bulkAgingBucket =
    agingFilter === "1-30" || agingFilter === "31-60" || agingFilter === "61+"
      ? agingFilter
      : null;
  const overdueInView = filtered.filter((i) => !i.isPaid && !i.isVoid && i.daysOverdue > 0);

  const invoiceTypeTones: Record<string, BadgeTone> = {
    REPAIR: "info",
    SERVICE: "violet",
    MERCHANDISE: "orange",
    CONTRACT: "teal",
    OTHER: "neutral",
  };
  const invoiceStatusTones: Record<string, BadgeTone> = {
    Paid: "success",
    Void: "danger",
    Draft: "neutral",
    Overdue: "danger",
    Outstanding: "warning",
  };

  return (
    <InvoicePreviewProvider>
    <section className="space-y-4">
      {errorParam && (
        <div className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-red-500" aria-hidden>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-[13px] font-medium text-red-700">
            {errorParam === "missing-fields" ? "Please fill in all required fields." : errorParam === "client-not-found" ? "Client not found." : "Something went wrong."}
          </p>
        </div>
      )}
      {remindedParam === "1" && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5">
          <p className="text-[13px] font-medium text-emerald-700">Payment reminder queued via outbox.</p>
        </div>
      )}
      {remindedBulkParam && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5">
          <p className="text-[13px] font-medium text-emerald-700">
            Reminders queued for {remindedBulkParam} invoice{Number(remindedBulkParam) === 1 ? "" : "s"}.
            {reminderSkippedParam ? ` Skipped ${reminderSkippedParam}.` : ""}
            {reminderFailedParam && Number(reminderFailedParam) > 0 ? ` Failed ${reminderFailedParam}.` : ""}
          </p>
        </div>
      )}
      {reminderErrorParam && (
        <div className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5">
          <p className="text-[13px] font-medium text-red-700">
            {reminderErrorParam === "forbidden" ? "You do not have permission to send invoice reminders." : decodeURIComponent(reminderErrorParam)}
          </p>
        </div>
      )}

      <PageHeader
        title="Invoices"
        eyebrow="Documents"
        actions={
                  canCreateInvoice && (
                    <InvoiceNewButton />
                  )
        }
      />

      {/* Search + Status toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
        <form method="GET" action="/documents/invoices" className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: "all", label: "All" },
              { key: "ISSUED", label: "Unpaid" },
              { key: "PAID", label: "Paid" },
              { key: "OVERDUE", label: "Overdue" },
            ].map((s) => (
              <button
                key={s.key}
                type="submit"
                name="status"
                value={s.key}
                className={`rounded-full px-3 py-1 text-[13px] font-semibold transition ${
                  statusFilter === s.key
                    ? "bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/40"
                    : "border border-transparent text-[var(--ink-muted)] hover:border-[var(--line)] hover:text-[var(--ink)]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="inv-search">Search invoices</label>
          <input
            id="inv-search"
            name="q"
            defaultValue={q}
            placeholder="#, customer, amount…"
            className="ml-auto h-8 w-56 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 text-[13px] outline-none focus:border-[var(--accent)]/50"
          />
        </form>
      </div>

      <div>
        {(filtered as any[]).length > 0 ? (
          <BulkSelectionProvider pageIds={filtered.map((r: any) => r.id)}>
            <BulkActionBar />
            {(() => {
              const INV_STATUS_TONES: Record<string, BadgeTone> = {
                ISSUED: "sky",
                PAID: "success",
                VOID: "danger",
                DRAFT: "neutral",
              };

              const rows = (filtered as any[]).map((inv) => {
                const clientName = inv.job?.client?.fullName ?? inv.client?.fullName ?? "—";
                const invoiceCurrency = normalizeCurrency(inv.currency ?? orgCurrency, "UGX");
                const isOverdue = !inv.isPaid && !inv.isVoid && inv.daysOverdue > 0;
                const statusLabel = inv.isPaid
                  ? "Paid"
                  : inv.status === "VOID"
                  ? "Void"
                  : inv.status === "DRAFT"
                  ? "Draft"
                  : isOverdue
                  ? "Overdue"
                  : "Outstanding";
                return {
                  id: inv.id,
                  invoiceNumber: inv.invoiceNumber,
                  client: clientName,
                  statusBadge: <StatusBadge tone={toneFor(INV_STATUS_TONES, statusLabel)}>{statusLabel}</StatusBadge>,
                  amount: formatMoney(inv.totalAmount, invoiceCurrency),
                  issued: inv.issuedAt ? formatEATDate(inv.issuedAt) : "—",
                  due: inv.dueDate ? formatEATDate(inv.dueDate) : "—",
                  balance: inv.isPaid
                    ? <StatusBadge tone="success">Cleared</StatusBadge>
                    : inv.status === "VOID"
                    ? <span className="text-[var(--ink-muted)]">—</span>
                    : <span className={`font-semibold ${isOverdue ? "text-red-600" : "text-amber-700"}`}>{formatMoney(inv.balance, invoiceCurrency)}</span>,
                };
              });

              const actions = (row: any) => (
                <RowActionsMenu label={`Invoice ${row.invoiceNumber}`}>
                  <MenuActionLink href={`/documents/invoices/${row.id}`} icon="open">View</MenuActionLink>
                  <PreviewButton invoiceId={row.id} />
                  <MenuActionLink href={`/documents/invoices/${row.id}?edit=1`} icon="save">Edit</MenuActionLink>
                  <MenuActionLink href={`/api/invoices/${row.id}/pdf`} external icon="download">Print / PDF</MenuActionLink>
{!row.isPaid && !row.isVoid ? (
                  <MenuActionLink href={`/documents/invoices/${row.id}?pay=1`} icon="payment" tone="success">
                    Collect Payment
                  </MenuActionLink>
                ) : null}

                  <MenuSection label="Send" />
                  <form action={`/api/invoices/${row.id}/send`} method="POST">
                    <MenuActionButton icon="open" type="submit">Send by Email</MenuActionButton>
                  </form>
                  <form action={`/api/invoices/${row.id}/whatsapp`} method="POST">
                    <MenuActionButton icon="whatsapp" tone="success" type="submit">Send by WhatsApp</MenuActionButton>
                  </form>
                  <MenuSection label="Danger zone" />
                  {row.isPaid ? (
                    <span className="px-3 py-1.5 text-[13px] text-[var(--ink-muted)]">Fully paid — no void</span>
                  ) : row.isVoid ? (
                    <span className="px-3 py-1.5 text-[13px] text-[var(--ink-muted)]">Voided</span>
) : (
                  <MenuActionLink href={`/documents/invoices/${row.id}`} icon="delete" tone="danger">
                    View to Void
                  </MenuActionLink>
                )}
                </RowActionsMenu>
              );

              return (
                <DataTable
                  rows={rows}
                  getRowKey={(r) => r.id}
                  empty="No invoices found."
                  columns={[
                    { key: "select", header: "", className: "w-8", cell: (row: any) => <RowCheckbox invoiceId={row.id} /> },
                    { key: "invoiceNumber", header: "Invoice #", className: "w-[150px]", cell: (row: any) => (
                      <Link href={`/documents/invoices/${row.id}`} className="mono font-semibold text-[var(--accent)] hover:underline truncate whitespace-nowrap">
                        {row.invoiceNumber}
                      </Link>
                    )},
                    { key: "client", header: "Client", className: "min-w-[200px]", cell: (row: any) => <span className="font-medium text-[var(--ink)] truncate">{row.client}</span> },
                    { key: "status", header: "Status", className: "w-[100px]", cell: (row: any) => row.statusBadge },
                    { key: "amount", header: "Amount", align: "right", className: "w-[110px]", cell: (row: any) => <span className="tabular-nums whitespace-nowrap">{row.amount}</span> },
                    { key: "issued", header: "Issued", className: "w-[100px]", cell: (row: any) => <span className="whitespace-nowrap">{row.issued}</span> },
                    { key: "due", header: "Due", className: "w-[100px]", cell: (row: any) => <span className="whitespace-nowrap">{row.due}</span> },
                    { key: "balance", header: "Balance", className: "w-[110px]", cell: (row: any) => row.balance },
                  ]}
                  actions={actions}
                />
              );
            })()}
          </BulkSelectionProvider>
        ) : (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-8 text-center text-[13px] text-[var(--ink-muted)]">
            No invoices found. Click <strong>+ New Invoice</strong> to create one.
          </div>
        )}

        <TablePagination
          page={pageView.page}
          totalPages={pageView.totalPages}
          rangeStart={pageView.rangeStart}
          rangeEnd={pageView.rangeEnd}
          total={pageView.total}
          unit="invoices"
          hrefForPage={invoicesHref}
        />
      </div>

</section>
<InvoiceCreateDialog
  currency={orgCurrency}
  canOverrideDiscount={canOverrideDiscount}
  clients={clients as any[]}
  leads={leads as any[]}
  jobs={jobs as any[]}
  parts={invoiceParts}
  taxRates={invoiceTaxRates}
  defaultTaxApplicable={branding.vatDefaultApplicable ?? false}
  defaultTaxRate={defaultInvoiceTaxRate?.rate ?? branding.vatRatePercent ?? 0}
  defaultTaxLabel={defaultInvoiceTaxRate?.code ?? branding.vatLabel ?? "Tax"}
  action={createStandaloneInvoiceAction}
/>
</InvoicePreviewProvider>
  );
}
