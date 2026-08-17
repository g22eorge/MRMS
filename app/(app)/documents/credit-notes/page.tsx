import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { type PaymentMethod } from "@prisma/client";

import { formatMoney, formatMoneyCompact, normalizeCurrency, toBaseAmount } from "@/lib/currency";
import { can } from "@/lib/permissions";
import { prisma, ensureMoneySchema } from "@/lib/prisma";
import { findRecentDuplicate } from "@/lib/dedup";
import { requireOrgSession } from "@/lib/org-context";
import { requireModule, OrgModule } from "@/lib/module-access";
import { assertOrgCanMutate } from "@/lib/org-write";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { RowActionsMenu, MenuActionButton, MenuActionLink, MenuDestructiveRow, MenuSection } from "@/components/shared/RowActionsMenu";
import { DocumentPreviewButton } from "@/components/documents/DocumentPreviewButton";
import { nextDocumentNumber } from "@/lib/commercial/document-workflow";
import { syncSalePaymentState } from "@/lib/commercial/payment-sync";
import { postRefund } from "@/lib/accounting/post";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { shareCreditNoteDocument } from "@/lib/notifications/share-document";
import { notifyCreditNoteIssued, notifyRefundIssued } from "@/lib/notifications";
import { CreateCreditNoteDialog } from "./CreateCreditNoteDialog";
import { PAYMENT_METHODS, formatPaymentMethodLabel, parsePaymentMethod } from "@/lib/constants/payment-methods";
import { formatEATMediumDate } from "@/lib/date-eat";
import { DocumentFilterBar } from "@/components/documents";
import { DOCUMENT_PERIOD_OPTIONS_SHORT } from "@/lib/documents/period-filters";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default async function CreditNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; period?: string; page?: string }>;
}) {
  await requireModule(OrgModule.INVOICING);
  const { user, orgId, org } = await requireOrgSession();
  if (!can.viewFinancials(user) && !["ADMIN", "OPS", "MANAGER"].includes(user.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const filter = params.filter ?? "all";
  const periodFilter = params.period ?? "all";
  const page = parsePage(params.page);
  const nowCN = new Date();
  const cnThisMonthStart = new Date(nowCN.getFullYear(), nowCN.getMonth(), 1);
  const cnLastMonthStart = new Date(nowCN.getFullYear(), nowCN.getMonth() - 1, 1);
  const cnLastMonthEnd = new Date(nowCN.getFullYear(), nowCN.getMonth(), 0, 23, 59, 59);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // ── Server actions ───────────────────────────────────────────────────────────

  async function markItemsReceivedAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!can.viewFinancials(user) && !["ADMIN", "OPS"].includes(user.role)) return;
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "PAYMENT" });

    const creditNoteId = String(formData.get("creditNoteId") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    if (!creditNoteId) return;

    const cn = await prisma.creditNote.findFirst({ where: { id: creditNoteId, orgId }, select: { id: true, creditNoteNumber: true, saleId: true, itemsReceivedBackAt: true } });
    if (!cn || cn.itemsReceivedBackAt) return;

    await prisma.$transaction(async (tx) => {
      // Restore returned stock — the POS "received back" path did this but the
      // Documents path only stamped a timestamp, silently losing inventory (H5).
      const items = await tx.creditNoteItem.findMany({ where: { creditNoteId }, select: { partId: true, quantity: true, description: true, saleUomFactor: true } });
      for (const it of items) {
        if (!it.partId) continue;
        const part = await tx.part.findFirst({ where: { id: it.partId, orgId, isActive: true }, select: { id: true, sku: true, name: true } });
        if (!part) continue;
        const baseQty = Math.abs(it.quantity) * (it.saleUomFactor ?? 1);
        await tx.part.update({ where: { id: part.id }, data: { qtyOnHand: { increment: baseQty } } });
        await tx.partStockTransaction.create({
          data: {
            partId: part.id,
            orgId,
            saleId: cn.saleId,
            type: "IN",
            quantity: baseQty,
            reason: `Return (${cn.creditNoteNumber}) ${it.description || part.name}`,
            createdById: user.id,
          },
        });
      }
      await tx.creditNote.update({
        where: { id: creditNoteId },
        data: { itemsReceivedBackAt: new Date(), itemsReceivedBackById: user.id, itemsReceivedBackNote: note || null },
      });
    });
    await writeSystemAuditEvent({
      orgId,
      actorUserId: user.id,
      entityType: "CreditNote",
      entityId: creditNoteId,
      action: "CREDIT_NOTE_ITEMS_RECEIVED",
      summary: `Returned items marked received for credit note ${cn.creditNoteNumber}`,
    });
    revalidatePath("/documents/credit-notes");
    redirect("/documents/credit-notes");
  }

  async function issueRefundFromCreditNoteAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!["ADMIN", "OPS", "MANAGER"].includes(user.role)) return;
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "PAYMENT" });

    const creditNoteId = String(formData.get("creditNoteId") ?? "").trim();
    const amountRaw = Number(String(formData.get("amount") ?? "").trim());
    const methodRaw = String(formData.get("method") ?? "CASH").trim();
    const reference = String(formData.get("reference") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    if (!creditNoteId || !Number.isFinite(amountRaw) || amountRaw <= 0) return;

    const cn = await prisma.creditNote.findFirst({
      where: { id: creditNoteId, orgId },
      select: { id: true, saleId: true, totalAmount: true, currency: true, creditNoteNumber: true, refunds: { select: { amount: true } } },
    });
    if (!cn) return;

    const alreadyRefunded = cn.refunds.reduce((s, r) => s + r.amount, 0);
    if (alreadyRefunded + amountRaw > cn.totalAmount) return;

    const method = parsePaymentMethod(methodRaw, "CASH");

    // Capture the FX rate for a non-base credit note so the ledger post and the
    // sale's paid-state recompute both convert to base. Without it the refund
    // stored exchangeRateToBase:null, so a foreign refund posted its document
    // amount (e.g. 100 instead of ~380,000) and sumSalePaidAmount mis-netted it.
    const refundCurrency = normalizeCurrency(cn.currency, org.baseCurrency);
    const rawRate = String(formData.get("exchangeRateToBase") ?? "").replace(/,/g, "").trim();
    const exchangeRateToBase = refundCurrency === org.baseCurrency ? null : (rawRate ? Number(rawRate) : null);
    if (refundCurrency !== org.baseCurrency && (!exchangeRateToBase || !Number.isFinite(exchangeRateToBase) || exchangeRateToBase <= 0)) {
      return;
    }

    // Double-submit guard: an identical refund against this credit note landed
    // seconds ago — don't pay it out twice.
    const dupRefund = await findRecentDuplicate(prisma.refund, {
      orgId,
      saleId: cn.saleId,
      creditNoteId: cn.id,
      amount: amountRaw,
      method,
    });
    if (dupRefund) {
      revalidatePath("/documents/credit-notes");
      redirect("/documents/credit-notes");
    }

    // Refund write + ledger post run inside the txn; ensure schema first.
    await ensureMoneySchema();
    const refund = await prisma.$transaction(async (tx) => {
      const created = await tx.refund.create({
        data: {
          orgId,
          saleId: cn.saleId,
          creditNoteId: cn.id,
          currency: cn.currency,
          exchangeRateToBase,
          amount: amountRaw,
          method,
          reference: reference || null,
          note: note || null,
          createdById: user.id,
          refundedAt: new Date(),
        },
        select: { id: true },
      });
      // Reduce the sale's paid state so the refunded cash isn't still counted as
      // collected (was skipped, letting the refundable amount be double-drawn).
      if (cn.saleId) {
        await syncSalePaymentState(tx, { orgId, saleId: cn.saleId });
      }
      // C5: cash-basis ledger post — reverse revenue, pay out cash. This mirrors
      // the refunds page; without it, refunds issued from a credit note never hit
      // the ledger (cash would be overstated). Post the base value of a foreign refund.
      const baseRefund = refundCurrency === org.baseCurrency
        ? amountRaw
        : toBaseAmount({ amount: amountRaw, currency: refundCurrency, baseCurrency: org.baseCurrency, exchangeRateToBase });
      await postRefund(tx, {
        orgId,
        userId: user.id,
        amount: baseRefund,
        reference: `refund:${created.id}`,
        description: `Refund from credit note ${cn.creditNoteNumber}`,
      });
      return created;
    });
    await writeSystemAuditEvent({
      orgId,
      actorUserId: user.id,
      entityType: "Refund",
      entityId: refund.id,
      action: "REFUND_CREATED",
      summary: `Refund ${formatMoney(amountRaw, cn.currency)} from credit note ${cn.creditNoteNumber}`,
    });
    notifyRefundIssued({
      orgId,
      creditNoteNumber: cn.creditNoteNumber,
      clientName: `CN ${cn.creditNoteNumber}`,
      amount: amountRaw,
      actorName: user.name ?? user.email ?? "Unknown",
    }).catch(() => {});
    revalidatePath("/documents/credit-notes");
    revalidatePath("/documents/refunds");
    redirect("/documents/credit-notes");
  }

  async function shareCreditNoteWhatsAppAction(formData: FormData) {
    "use server";
    const { user, orgId } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "MANAGER"].includes(user.role))) return;

    const creditNoteId = String(formData.get("creditNoteId") ?? "").trim();
    if (!creditNoteId) return;
    await shareCreditNoteDocument({ orgId, creditNoteId, channel: "whatsapp" });
    revalidatePath("/documents/credit-notes");
    redirect("/documents/credit-notes");
  }

  async function shareCreditNoteEmailAction(formData: FormData) {
    "use server";
    const { user, orgId } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "MANAGER"].includes(user.role))) return;

    const creditNoteId = String(formData.get("creditNoteId") ?? "").trim();
    if (!creditNoteId) return;
    await shareCreditNoteDocument({ orgId, creditNoteId, channel: "email" });
    revalidatePath("/documents/credit-notes");
    redirect("/documents/credit-notes");
  }

  async function createCreditNoteAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!["ADMIN", "OPS", "MANAGER"].includes(user.role)) return;
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const saleId = String(formData.get("saleId") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();
    const itemIds = formData.getAll("itemId").map((value) => String(value)).filter(Boolean);
    if (!saleId || !reason) return;
    if (!itemIds.length) return;

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, orgId },
      select: {
        id: true,
        currency: true,
        saleNumber: true,
        items: {
          where: { id: { in: itemIds } },
          select: { id: true, partId: true, description: true, quantity: true, unitPrice: true, saleUomFactor: true },
        },
      },
    });
    if (!sale || sale.items.length === 0) return;

    const items = sale.items
      .map((item) => {
        const requestedQuantity = Number(String(formData.get(`quantity:${item.id}`) ?? item.quantity).trim());
        const quantity = Math.max(1, Math.min(item.quantity, Math.floor(Number.isFinite(requestedQuantity) ? requestedQuantity : item.quantity)));
        return {
          partId: item.partId,
          description: item.description,
          quantity,
          unitPrice: item.unitPrice,
          saleUomFactor: item.saleUomFactor,
        };
      })
      .filter((item) => item.quantity > 0);
    if (!items.length) return;

    const totalAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

    // Cumulative-return cap: existing credit notes for this sale plus this one
    // must not exceed the sale total (prevents unlimited over-refund).
    const saleTotal = await prisma.sale.findFirst({ where: { id: saleId, orgId }, select: { totalAmount: true } });
    const priorCredited = await prisma.creditNote.aggregate({ where: { orgId, saleId }, _sum: { totalAmount: true } });
    if (saleTotal && (priorCredited._sum.totalAmount ?? 0) + totalAmount > saleTotal.totalAmount) return;

    // Double-submit guard: an identical credit note for this sale landed seconds ago.
    const dupCn = await findRecentDuplicate(prisma.creditNote, { orgId, saleId, totalAmount });
    if (dupCn) {
      revalidatePath("/documents/credit-notes");
      redirect("/documents/credit-notes");
    }

    let creditNoteNumber = "";
    let creditNoteId = "";
    await prisma.$transaction(async (tx) => {
      creditNoteNumber = await nextDocumentNumber(tx, "CN", "creditNote", orgId);
      const created = await tx.creditNote.create({
        data: {
          orgId,
          saleId,
          creditNoteNumber,
          currency: sale.currency,
          totalAmount,
          reason,
          createdById: user.id,
          items: {
            create: items.map((i) => ({
              partId: i.partId,
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              lineTotal: i.quantity * i.unitPrice,
              saleUomFactor: i.saleUomFactor,
            })),
          },
        },
        select: { id: true },
      });
      creditNoteId = created.id;
      // M10: reflect the return on the sale (PARTIALLY_RETURNED / RETURNED).
      await syncSalePaymentState(tx, { orgId, saleId });
    });
    await writeSystemAuditEvent({
      orgId,
      actorUserId: user.id,
      entityType: "CreditNote",
      entityId: creditNoteId,
      action: "CREDIT_NOTE_CREATED",
      summary: `Credit note ${creditNoteNumber} for sale ${sale.saleNumber} (${formatMoney(totalAmount, sale.currency)})`,
    });
    notifyCreditNoteIssued({
      orgId,
      creditNoteNumber,
      clientName: `Sale ${sale.saleNumber}`,
      amount: totalAmount,
      actorName: user.name ?? user.email ?? "Unknown",
    }).catch(() => {});
    revalidatePath("/documents/credit-notes");
    redirect("/documents/credit-notes");
  }

  // One-click "Return & refund now": the common case where a customer brings an
  // item back, you put it on the shelf, and you hand the money over — previously
  // three separate submits (create CN → mark received → issue refund). This runs
  // all three in a single transaction: create the credit note, restock the
  // returned items, and issue the FULL refund. The granular actions above stay
  // for partial/staged returns (return now, refund later, etc.).
  async function returnAndRefundAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!["ADMIN", "OPS", "MANAGER"].includes(user.role)) return;
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "PAYMENT" });

    const saleId = String(formData.get("saleId") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();
    const itemIds = formData.getAll("itemId").map((value) => String(value)).filter(Boolean);
    const methodRaw = String(formData.get("method") ?? "CASH").trim();
    const reference = String(formData.get("reference") ?? "").trim();
    if (!saleId || !reason || !itemIds.length) return;

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, orgId },
      select: {
        id: true,
        currency: true,
        saleNumber: true,
        items: {
          where: { id: { in: itemIds } },
          select: { id: true, partId: true, description: true, quantity: true, unitPrice: true, saleUomFactor: true },
        },
      },
    });
    if (!sale || sale.items.length === 0) return;

    const items = sale.items
      .map((item) => {
        const requestedQuantity = Number(String(formData.get(`quantity:${item.id}`) ?? item.quantity).trim());
        const quantity = Math.max(1, Math.min(item.quantity, Math.floor(Number.isFinite(requestedQuantity) ? requestedQuantity : item.quantity)));
        return { partId: item.partId, description: item.description, quantity, unitPrice: item.unitPrice, saleUomFactor: item.saleUomFactor };
      })
      .filter((item) => item.quantity > 0);
    if (!items.length) return;

    const totalAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    if (totalAmount <= 0) return;

    // Same cumulative-return cap as createCreditNoteAction.
    const saleTotal = await prisma.sale.findFirst({ where: { id: saleId, orgId }, select: { totalAmount: true } });
    const priorCredited = await prisma.creditNote.aggregate({ where: { orgId, saleId }, _sum: { totalAmount: true } });
    if (saleTotal && (priorCredited._sum.totalAmount ?? 0) + totalAmount > saleTotal.totalAmount) return;

    // FX handling mirrors issueRefundFromCreditNoteAction — a foreign refund must
    // carry a rate so the ledger posts the base value, not the document amount.
    const refundCurrency = normalizeCurrency(sale.currency, org.baseCurrency);
    const rawRate = String(formData.get("exchangeRateToBase") ?? "").replace(/,/g, "").trim();
    const exchangeRateToBase = refundCurrency === org.baseCurrency ? null : (rawRate ? Number(rawRate) : null);
    if (refundCurrency !== org.baseCurrency && (!exchangeRateToBase || !Number.isFinite(exchangeRateToBase) || exchangeRateToBase <= 0)) return;

    const method = parsePaymentMethod(methodRaw, "CASH");

    // Double-submit guard: an identical credit note for this sale landed seconds ago.
    const dupCn = await findRecentDuplicate(prisma.creditNote, { orgId, saleId, totalAmount });
    if (dupCn) { revalidatePath("/documents/credit-notes"); redirect("/documents/credit-notes"); }

    await ensureMoneySchema();
    let creditNoteNumber = "";
    let creditNoteId = "";
    let refundId = "";
    await prisma.$transaction(async (tx) => {
      creditNoteNumber = await nextDocumentNumber(tx, "CN", "creditNote", orgId);
      const cn = await tx.creditNote.create({
        data: {
          orgId,
          saleId,
          creditNoteNumber,
          currency: sale.currency,
          totalAmount,
          reason,
          createdById: user.id,
          // Items come straight back onto the shelf in this flow.
          itemsReceivedBackAt: new Date(),
          itemsReceivedBackById: user.id,
          items: {
            create: items.map((i) => ({
              partId: i.partId,
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              lineTotal: i.quantity * i.unitPrice,
              saleUomFactor: i.saleUomFactor,
            })),
          },
        },
        select: { id: true },
      });
      creditNoteId = cn.id;

      // Restock the returned units (mirror markItemsReceivedAction).
      for (const it of items) {
        if (!it.partId) continue;
        const part = await tx.part.findFirst({ where: { id: it.partId, orgId, isActive: true }, select: { id: true, name: true } });
        if (!part) continue;
        const baseQty = Math.abs(it.quantity) * (it.saleUomFactor ?? 1);
        await tx.part.update({ where: { id: part.id }, data: { qtyOnHand: { increment: baseQty } } });
        await tx.partStockTransaction.create({
          data: { partId: part.id, orgId, saleId, type: "IN", quantity: baseQty, reason: `Return (${creditNoteNumber}) ${it.description || part.name}`, createdById: user.id },
        });
      }

      // Full refund of the credited amount (mirror issueRefundFromCreditNoteAction).
      const refund = await tx.refund.create({
        data: {
          orgId,
          saleId,
          creditNoteId,
          currency: sale.currency,
          exchangeRateToBase,
          amount: totalAmount,
          method,
          reference: reference || null,
          createdById: user.id,
          refundedAt: new Date(),
        },
        select: { id: true },
      });
      refundId = refund.id;

      // Recompute the sale's paid/return state once, after both writes land.
      await syncSalePaymentState(tx, { orgId, saleId });

      const baseRefund = refundCurrency === org.baseCurrency
        ? totalAmount
        : toBaseAmount({ amount: totalAmount, currency: refundCurrency, baseCurrency: org.baseCurrency, exchangeRateToBase });
      await postRefund(tx, {
        orgId,
        userId: user.id,
        amount: baseRefund,
        reference: `refund:${refund.id}`,
        description: `Refund from credit note ${creditNoteNumber}`,
      });
    });

    await writeSystemAuditEvent({ orgId, actorUserId: user.id, entityType: "CreditNote", entityId: creditNoteId, action: "CREDIT_NOTE_CREATED", summary: `Credit note ${creditNoteNumber} for sale ${sale.saleNumber} — returned & refunded (${formatMoney(totalAmount, sale.currency)})` });
    await writeSystemAuditEvent({ orgId, actorUserId: user.id, entityType: "Refund", entityId: refundId, action: "REFUND_CREATED", summary: `Refund ${formatMoney(totalAmount, sale.currency)} from credit note ${creditNoteNumber}` });
    notifyCreditNoteIssued({ orgId, creditNoteNumber, clientName: `Sale ${sale.saleNumber}`, amount: totalAmount, actorName: user.name ?? user.email ?? "Unknown" }).catch(() => {});
    notifyRefundIssued({ orgId, creditNoteNumber, clientName: `CN ${creditNoteNumber}`, amount: totalAmount, actorName: user.name ?? user.email ?? "Unknown" }).catch(() => {});
    revalidatePath("/documents/credit-notes");
    revalidatePath("/documents/refunds");
    redirect("/documents/credit-notes");
  }

  async function updateCreditNoteDateAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS"].includes(user.role))) redirect("/dashboard");
    const id = String(formData.get("creditNoteId") ?? "").trim();
    const issueDateRaw = String(formData.get("issueDate") ?? "").trim();
    if (!id || !issueDateRaw) return;
    await prisma.creditNote.updateMany({ where: { id, orgId }, data: { issuedAt: new Date(issueDateRaw) } });
    revalidatePath("/documents/credit-notes");
    redirect("/documents/credit-notes");
  }

  async function deleteCreditNoteAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
    if (user.role !== "ADMIN") return;

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return;

    const cn = await prisma.creditNote.findFirst({
      where: { id, orgId },
      select: { id: true, creditNoteNumber: true, totalAmount: true, currency: true, refunds: { select: { id: true } } },
    });
    if (!cn || cn.refunds.length > 0) return;

    await prisma.creditNote.delete({ where: { id } });
    await writeSystemAuditEvent({
      orgId,
      actorUserId: user.id,
      entityType: "CreditNote",
      entityId: id,
      action: "CREDIT_NOTE_DELETED",
      summary: `Credit note ${cn.creditNoteNumber} deleted (${formatMoney(cn.totalAmount, cn.currency)})`,
      before: { creditNoteNumber: cn.creditNoteNumber, totalAmount: cn.totalAmount },
    });
    revalidatePath("/documents/credit-notes");
    redirect("/documents/credit-notes");
  }

  // ── Data ─────────────────────────────────────────────────────────────────────

  const creditNotesWhere = {
    orgId,
    ...(filter === "pending" ? { itemsReceivedBackAt: null } : {}),
    ...(filter === "received" ? { itemsReceivedBackAt: { not: null } } : {}),
    ...(periodFilter === "this_month" ? { issuedAt: { gte: cnThisMonthStart } } : {}),
    ...(periodFilter === "last_month" ? { issuedAt: { gte: cnLastMonthStart, lte: cnLastMonthEnd } } : {}),
    ...(q
      ? {
          OR: [
            { creditNoteNumber: { contains: q } },
            { reason: { contains: q } },
            { sale: { saleNumber: { contains: q } } },
          ],
        }
      : {}),
  };

  const [creditNotesTotal, statsRows, creditNotes, eligibleSales] = await Promise.all([
    prisma.creditNote.count({ where: creditNotesWhere }).catch(() => 0),
    // Whole-dataset KPIs (value/pending/refunded) computed from every matching row.
    prisma.creditNote.findMany({
      where: creditNotesWhere,
      select: { totalAmount: true, itemsReceivedBackAt: true, refunds: { select: { amount: true } } },
    }).catch(() => []),
    prisma.creditNote.findMany({
      where: creditNotesWhere,
      include: {
        sale: { select: { saleNumber: true, client: { select: { fullName: true, phone: true, email: true } } } },
        items: { select: { description: true, quantity: true, unitPrice: true, lineTotal: true } },
        refunds: { select: { amount: true, method: true, refundedAt: true } },
        itemsReceivedBackBy: { select: { name: true } },
      },
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }).catch(() => []),
    prisma.sale.findMany({
      where: { orgId, status: { in: ["PAID", "PARTIALLY_RETURNED"] } },
      select: {
        id: true,
        saleNumber: true,
        totalAmount: true,
        currency: true,
        client: { select: { fullName: true } },
        items: { select: { id: true, description: true, quantity: true, unitPrice: true, lineTotal: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }).catch(() => []),
  ]);

  const totalValue = statsRows.reduce((s, cn) => s + cn.totalAmount, 0);
  const pendingReturn = statsRows.filter((cn) => !cn.itemsReceivedBackAt).length;
  const totalRefunded = statsRows.reduce((s, cn) => s + cn.refunds.reduce((r, rf) => r + rf.amount, 0), 0);
  const currency = org.baseCurrency;
  const pageView = paginationView(page, creditNotesTotal);
  const creditNotesHref = pageHrefBuilder("/documents/credit-notes", {
    q,
    filter: filter !== "all" ? filter : "",
    period: periodFilter !== "all" ? periodFilter : "",
  });

  const fmt = (d: Date | string | null) =>
    d ? formatEATMediumDate(d) : "—";

  type CreditNoteRow = (typeof creditNotes)[number];

  const creditNoteDerived = (cn: CreditNoteRow) => {
    const refundedTotal = cn.refunds.reduce((s, r) => s + r.amount, 0);
    const outstanding = cn.totalAmount - refundedTotal;
    const recipientPhone = cn.sale?.client?.phone ?? null;
    const recipientEmail = cn.sale?.client?.email ?? null;
    const creditNoteUrl = `${appUrl}/api/credit-notes/${cn.id}`;
    const creditNoteShareText = encodeURIComponent(`Your credit note is ready.\n\n${cn.creditNoteNumber}\nSale: ${cn.sale?.saleNumber ?? "-"}\nAmount: ${formatMoney(cn.totalAmount, cn.currency)}\nPDF: ${creditNoteUrl}`);
    const creditNoteWaPhone = recipientPhone?.replace(/\D/g, "").replace(/^0/, "256");
    return { refundedTotal, outstanding, recipientPhone, recipientEmail, creditNoteShareText, creditNoteWaPhone };
  };

  /** Shared overflow menu — used by both the mobile cards and the desktop table rows. */
  const creditNoteActionsMenu = (cn: CreditNoteRow) => {
    const { outstanding, recipientPhone, recipientEmail, creditNoteShareText, creditNoteWaPhone } = creditNoteDerived(cn);
    return (
      <RowActionsMenu label={`Credit note actions for ${cn.creditNoteNumber}`}>
        <div className="py-1 text-left">
          <MenuActionLink href={`/documents/credit-notes/${cn.id}`} icon="open">
            View credit note
          </MenuActionLink>
          <DocumentPreviewButton pdfUrl={`/api/credit-notes/${cn.id}`} title={`Credit note ${cn.creditNoteNumber}`} />
          <MenuActionLink href={`/api/credit-notes/${cn.id}`} external icon="quote" tone="accent">
            Download Credit Note PDF
          </MenuActionLink>
        </div>
        <MenuSection label="Share" />
        {recipientPhone ? (
          <form action={shareCreditNoteWhatsAppAction}>
            <input type="hidden" name="creditNoteId" value={cn.id} />
            <MenuActionButton icon="whatsapp" tone="success">Send via WhatsApp</MenuActionButton>
          </form>
        ) : (
          <span className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-[var(--ink-muted)]">WhatsApp unavailable</span>
        )}
        {recipientEmail ? (
          <form action={shareCreditNoteEmailAction}>
            <input type="hidden" name="creditNoteId" value={cn.id} />
            <MenuActionButton icon="open">Email credit note</MenuActionButton>
          </form>
        ) : (
          <span className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-[var(--ink-muted)]">Email unavailable</span>
        )}
        {creditNoteWaPhone ? (
          <MenuActionLink href={`https://wa.me/${creditNoteWaPhone}?text=${creditNoteShareText}`} external icon="whatsapp" tone="success">
            Open WhatsApp Link
          </MenuActionLink>
        ) : null}
        {!cn.itemsReceivedBackAt ? (
          <>
            <MenuSection label="Inventory Return" />
            <form action={markItemsReceivedAction} className="p-3">
              <input type="hidden" name="creditNoteId" value={cn.id} />
              <MenuActionButton icon="save" tone="success">Mark Items Received</MenuActionButton>
            </form>
          </>
        ) : null}
        {outstanding > 0 ? (
          <>
            <MenuSection label="Refund" />
            <div className="w-64 p-3">
              <form action={issueRefundFromCreditNoteAction} className="space-y-2">
                <input type="hidden" name="creditNoteId" value={cn.id} />
                <div>
                  <label className="mb-0.5 block text-[0.75rem] font-semibold uppercase text-[var(--ink-muted)]">Amount</label>
                  <input name="amount" type="number" step="0.01" max={outstanding} defaultValue={outstanding} className="w-full rounded border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1 text-sm text-[var(--ink)]" />
                  <p className="mt-0.5 text-[0.75rem] text-[var(--ink-muted)]">Max: {formatMoney(outstanding, cn.currency)}</p>
                </div>
                <div>
                  <label className="mb-0.5 block text-[0.75rem] font-semibold uppercase text-[var(--ink-muted)]">Method</label>
                  <select name="method" className="w-full rounded border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1 text-sm text-[var(--ink)]">
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{formatPaymentMethodLabel(m)}</option>)}
                  </select>
                </div>
                <input name="reference" placeholder="Reference (optional)" className="w-full rounded border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1 text-sm text-[var(--ink)]" />
                <SubmitButton bare pendingLabel="Issuing…" className="w-full rounded bg-[var(--accent)]/20 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/30 disabled:opacity-60">Issue Refund</SubmitButton>
              </form>
            </div>
          </>
        ) : null}
        <MenuSection label="Edit Credit Note" />
        <form action={updateCreditNoteDateAction} className="p-3">
          <input type="hidden" name="creditNoteId" value={cn.id} />
          <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Issue date
            <input name="issueDate" type="date" defaultValue={new Date(cn.issuedAt).toISOString().slice(0, 10)} className="mt-0.5 w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 outline-none focus:border-[var(--accent)]/50" />
          </label>
          <div className="mt-2"><MenuActionButton icon="save" tone="accent" className="bg-[var(--accent)]/8">Save issue date</MenuActionButton></div>
        </form>
        {user.role === "ADMIN" && cn.refunds.length === 0 ? (
          <MenuDestructiveRow>
            <form action={deleteCreditNoteAction}>
              <input type="hidden" name="id" value={cn.id} />
              <ConfirmSubmitButton
                message={`Delete credit note ${cn.creditNoteNumber}? This cannot be undone.`}
                confirmLabel="Delete"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-red-500/10 hover:text-red-700"
              >Delete Credit Note</ConfirmSubmitButton>
            </form>
          </MenuDestructiveRow>
        ) : null}
      </RowActionsMenu>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header + KPIs */}
      <PageHeader
        eyebrow="Documents"
        title="Credit Notes"
        description="For POS sale returns — credits the customer and restocks the items. To pay money back, use Refunds."
        actions={
          <>
            {pendingReturn > 0 && (
              <StatusBadge tone="warning">{pendingReturn} awaiting return</StatusBadge>
            )}
            {["ADMIN", "OPS", "MANAGER"].includes(user.role) && (
              <CreateCreditNoteDialog
                eligibleSales={eligibleSales}
                action={createCreditNoteAction}
                returnAndRefundAction={returnAndRefundAction}
                baseCurrency={org.baseCurrency}
                paymentMethods={PAYMENT_METHODS.map((m) => ({ value: m, label: formatPaymentMethodLabel(m) }))}
              />
            )}
          </>
        }
        kpis={[
          { label: "Total", value: creditNotesTotal, sub: "credit notes" },
          { label: "Total Value", value: formatMoneyCompact(totalValue, currency), sub: "issued" },
          { label: "Pending Return", value: pendingReturn, sub: "items not received back", valueClass: pendingReturn > 0 ? "text-amber-600" : undefined },
          { label: "Settled", value: creditNotesTotal - pendingReturn, sub: "items returned", valueClass: "text-emerald-600" },
        ]}
      />

      {/* Filters: period chips + return-state chips + search */}
      <DocumentFilterBar
        basePath="/documents/credit-notes"
        q={q}
        period={periodFilter}
        periodOptions={DOCUMENT_PERIOD_OPTIONS_SHORT}
        extraQuery={{ filter }}
        searchPlaceholder="Search credit note, sale, reason…"
      >
        <div className="flex gap-1">
          {(["all", "pending", "received"] as const).map((f) => (
            <Link
              key={f}
              href={`?filter=${f}${q ? `&q=${q}` : ""}${periodFilter !== "all" ? `&period=${periodFilter}` : ""}`}
              className={`rounded-full border px-3 py-1.5 text-[0.75rem] font-semibold transition ${filter === f ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--line)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
            >
              {f === "all" ? "All" : f === "pending" ? "Awaiting Return" : "Items Received"}
            </Link>
          ))}
        </div>
      </DocumentFilterBar>

      {/* Table */}
      <DataTable
        rows={creditNotes}
        getRowKey={(cn) => cn.id}
        empty={q || filter !== "all" ? "No credit notes match the filter." : "No credit notes yet. Create one from a completed sale."}
        renderMobileCard={(cn) => {
          const { refundedTotal } = creditNoteDerived(cn);
          return (
            <div className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="mono text-xs font-semibold text-[var(--ink)]">{cn.creditNoteNumber}</p>
                {cn.itemsReceivedBackAt ? (
                  <StatusBadge tone="success" className="shrink-0">Received</StatusBadge>
                ) : (
                  <StatusBadge tone="warning" className="shrink-0">Pending Return</StatusBadge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[var(--ink-muted)]">
                {cn.sale?.saleNumber && <span>Sale: <span className="mono text-[var(--accent)]">{cn.sale.saleNumber}</span></span>}
                <span>Client: <span className="text-[var(--ink)]">{cn.sale?.client?.fullName ?? "Walk-in"}</span></span>
              </div>
              <p className="mt-1 line-clamp-2 text-[var(--ink-muted)]">{cn.reason}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <span className="font-semibold tabular-nums text-[var(--ink)]">{formatMoney(cn.totalAmount, cn.currency)}</span>
                {refundedTotal > 0 && <span className="text-emerald-700">Refunded: <span className="tabular-nums">{formatMoney(refundedTotal, cn.currency)}</span></span>}
                <span className="text-[var(--ink-muted)]">Issued {fmt(cn.issuedAt)}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <a href={`/api/credit-notes/${cn.id}`} target="_blank" rel="noreferrer" className="rounded border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-0.5 text-[0.8125rem] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20">PDF</a>
                {creditNoteActionsMenu(cn)}
              </div>
            </div>
          );
        }}
        columns={[
          {
            key: "number",
            header: "Credit Note #",
            className: "mono font-semibold text-[var(--ink)]",
            cell: (cn) => cn.creditNoteNumber,
          },
          {
            key: "sale",
            header: "Sale",
            className: "text-[var(--ink-muted)]",
            cell: (cn) => cn.sale?.saleNumber ?? "—",
          },
          {
            key: "client",
            header: "Client",
            className: "text-[var(--ink)]",
            cell: (cn) => cn.sale?.client?.fullName ?? <span className="text-[var(--ink-muted)]">Walk-in</span>,
          },
          {
            key: "reason",
            header: "Reason",
            className: "max-w-[180px] truncate text-[var(--ink-muted)]",
            cell: (cn) => cn.reason,
          },
          {
            key: "value",
            header: "Value",
            align: "right",
            className: "whitespace-nowrap font-semibold tabular-nums text-[var(--ink)]",
            cell: (cn) => formatMoney(cn.totalAmount, cn.currency),
          },
          {
            key: "refunded",
            header: "Refunded",
            align: "right",
            className: "whitespace-nowrap tabular-nums text-emerald-700",
            cell: (cn) => {
              const { refundedTotal } = creditNoteDerived(cn);
              return refundedTotal > 0 ? formatMoney(refundedTotal, cn.currency) : "—";
            },
          },
          {
            key: "return",
            header: "Items Return",
            cell: (cn) =>
              cn.itemsReceivedBackAt ? (
                <StatusBadge tone="success">Received {fmt(cn.itemsReceivedBackAt)}</StatusBadge>
              ) : (
                <StatusBadge tone="warning">Pending</StatusBadge>
              ),
          },
          {
            key: "issued",
            header: "Issued",
            className: "text-[var(--ink-muted)]",
            cell: (cn) => fmt(cn.issuedAt),
          },
        ]}
        actions={(cn) => (
          <>
            <a href={`/api/credit-notes/${cn.id}`} target="_blank" rel="noreferrer" title="Download PDF" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] transition hover:bg-[var(--accent)]/20">
              PDF
            </a>
            {creditNoteActionsMenu(cn)}
          </>
        )}
      />

      <TablePagination
        page={pageView.page}
        totalPages={pageView.totalPages}
        rangeStart={pageView.rangeStart}
        rangeEnd={pageView.rangeEnd}
        total={pageView.total}
        unit="credit notes"
        hrefForPage={creditNotesHref}
      />
    </div>
  );
}
