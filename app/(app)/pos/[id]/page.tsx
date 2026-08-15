import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import type { PaymentMethod } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { formatMoney, normalizeCurrency, roundMoney, toBaseAmount } from "@/lib/currency";
import { formatEATDateTime } from "@/lib/date-eat";
import { prisma, ensureMoneySchema } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { assertOrgCanMutate } from "@/lib/org-write";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { DataTable } from "@/components/ui/DataTable";
import { Button, buttonClasses } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RecordActionBar } from "@/components/record/RecordActionBar";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { DocumentShareMenuSection } from "@/components/documents/DocumentShareMenuSection";
import { shareSaleReceiptDocument } from "@/lib/notifications/share-document";
import { RecordSummaryRail, type SummaryRow } from "@/components/record/RecordSummaryRail";
import { RecordPreviewButton } from "@/components/record/RecordPreviewButton";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { nextDocumentNumber, createReceiptForPayment } from "@/lib/commercial/document-workflow";
import { syncSalePaymentState } from "@/lib/commercial/payment-sync";
import { postRefund } from "@/lib/accounting/post";
import { findRecentDuplicate } from "@/lib/dedup";
import { computeVat } from "@/lib/commercial/vat";

const METHODS: PaymentMethod[] = ["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CARD", "OTHER"];

/**
 * Send the cashier back to the sale with an error banner instead of silently
 * no-op'ing a rejected POS action (short stock, over-refund, closed sale, …).
 * `redirect` throws, so this returns `never` and short-circuits the action.
 */
function posReject(saleId: string, message: string): never {
  redirect(`/pos/${saleId}?error=${encodeURIComponent(message)}`);
}

async function recalcSaleTotals(
  tx: Prisma.TransactionClient,
  saleId: string,
  orgId: string,
  overrideTaxApplicable?: boolean,
) {
  const itemsAgg = await tx.saleItem.aggregate({ where: { saleId }, _sum: { lineTotal: true } });
  const subtotal = itemsAgg._sum.lineTotal ?? 0;
  const current = await tx.sale.findUnique({ where: { id: saleId }, select: { discountAmount: true, currency: true, taxApplicable: true } });
  const currency = normalizeCurrency(current?.currency, "UGX");
  // VAT config: read the three fields we need on the SAME transaction connection
  // with a minimal SELECT. Do NOT use getDocumentBrandingSettings() here — it runs
  // ensureRawTable() (CREATE/ALTER TABLE DDL) which, issued while this libSQL write
  // transaction is open, can deadlock checkout on cold start. Falls back to safe
  // defaults (VAT off, exclusive, 18%) if the row/columns aren't present.
  let vatDefaultApplicable = false;
  let vatRatePercent = 18;
  let vatInclusive = false;
  try {
    const rows = await tx.$queryRaw<Array<{ vatDefaultApplicable: unknown; vatRatePercent: unknown; vatInclusive: unknown }>>`
      SELECT "vatDefaultApplicable", "vatRatePercent", "vatInclusive"
      FROM "DocumentBrandingSettings"
      WHERE id = ${orgId} OR orgId = ${orgId} OR id = 'singleton'
      ORDER BY CASE WHEN id = ${orgId} OR orgId = ${orgId} THEN 0 ELSE 1 END
      LIMIT 1`;
    const row = rows?.[0];
    if (row) {
      vatDefaultApplicable = Boolean(row.vatDefaultApplicable);
      const rate = Number(row.vatRatePercent);
      if (Number.isFinite(rate)) vatRatePercent = rate;
      vatInclusive = Boolean(row.vatInclusive);
    }
  } catch {
    // Drifted DB (missing table/column) — safe defaults keep checkout working.
  }
  const taxApplicable = overrideTaxApplicable ?? current?.taxApplicable ?? vatDefaultApplicable;
  const discountAmount = Math.max(0, Math.min(current?.discountAmount ?? 0, subtotal));
  const taxable = Math.max(0, subtotal - discountAmount);
  const raw = computeVat(taxable, {
    applicable: taxApplicable,
    ratePercent: vatRatePercent,
    inclusive: vatInclusive,
  });
  // Round to the currency's minor unit so zero-decimal (UGX) totals stay payable.
  const vatAmount = roundMoney(raw.vatAmount, currency);
  const totalAmount = roundMoney(raw.totalAmount, currency);

  await tx.sale.update({
    where: { id: saleId },
    data: {
      subtotal,
      discountAmount,
      vatAmount,
      taxApplicable,
      totalAmount,
    },
  });
  await syncSalePaymentState(tx, { orgId, saleId });
}

export default async function SalePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { user, orgId, org } = await requireOrgSession();
  if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const errorMessage = (await searchParams)?.error?.trim() || null;

  let dbNeedsFix = false;
  let sale: {
    id: string;
    saleNumber: string;
    status: string;
    billingMode: "CASH" | "INVOICE";
    invoiceNumber: string | null;
    invoicedAt: Date | null;
    currency: string | null;
    subtotal: number;
    discountAmount: number;
    vatAmount: number;
    taxApplicable: boolean;
    totalAmount: number;
    paidAmount: number;
    paidAt: Date | null;
    createdAt: Date;
    notes: string | null;
    branchId: string | null;
    branch: { name: string } | null;
    client: { fullName: string; phone: string | null; email: string | null } | null;
    items: Array<{ id: string; partId: string | null; description: string; quantity: number; unitPrice: number; lineTotal: number }>;
    payments: Array<{ id: string; amount: number; method: PaymentMethod; reference: string | null; receivedAt: Date; currency: string | null }>;
    _count: { payments: number; creditNotes: number; refunds: number };
  } | null = null;

  let creditNotes: Array<{
    id: string;
    creditNoteNumber: string;
    currency: string;
    totalAmount: number;
    issuedAt: Date;
    reason: string | null;
    itemsReceivedBackAt: Date | null;
    itemsReceivedBackNote: string | null;
    items: Array<{ id: string; description: string; quantity: number; unitPrice: number; lineTotal: number; partId: string | null }>;
  }> = [];

  let refunds: Array<{
    id: string;
    amount: number;
    currency: string;
    exchangeRateToBase: number | null;
    method: PaymentMethod;
    reference: string | null;
    refundedAt: Date;
    creditNoteId: string | null;
  }> = [];

  const deliveryNotes: never[] = [];

  try {
    sale = await prisma.sale.findFirst({
      where: { id, orgId },
      select: {
        id: true,
        saleNumber: true,
        status: true,
        billingMode: true,
        invoiceNumber: true,
        invoicedAt: true,
        currency: true,
        subtotal: true,
        discountAmount: true,
        vatAmount: true,
        taxApplicable: true,
        totalAmount: true,
        paidAmount: true,
        paidAt: true,
        createdAt: true,
        notes: true,
        branchId: true,
        branch: { select: { name: true } },
        client: { select: { fullName: true, phone: true, email: true } },
        items: { select: { id: true, partId: true, description: true, quantity: true, unitPrice: true, lineTotal: true }, orderBy: { createdAt: "asc" } },
        payments: { select: { id: true, amount: true, method: true, reference: true, receivedAt: true, currency: true }, orderBy: { receivedAt: "desc" } },
        _count: { select: { payments: true, creditNotes: true, refunds: true } },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("no such table") && msg.includes("Sale")) dbNeedsFix = true;
    sale = null;
  }

  if (!sale) {
    if (dbNeedsFix) redirect("/pos"); // schema not yet migrated — redirect to list
    notFound(); // sale doesn't exist in this org
  }

  const saleCurrency = normalizeCurrency(sale.currency, org.baseCurrency);
  const branches = await prisma.branch.findMany({
    where: { orgId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true },
  }).catch(() => []);

  // Credit notes / refunds are optional features; keep page working if tables are missing.
  try {
    creditNotes = await prisma.creditNote.findMany({
      where: { orgId, saleId: sale.id },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        creditNoteNumber: true,
        currency: true,
        totalAmount: true,
        issuedAt: true,
        reason: true,
        itemsReceivedBackAt: true,
        itemsReceivedBackNote: true,
        items: { select: { id: true, description: true, quantity: true, unitPrice: true, lineTotal: true, partId: true }, orderBy: { createdAt: "asc" } },
      },
    });
  } catch {
    creditNotes = [];
  }

  try {
    refunds = await prisma.refund.findMany({
      where: { orgId, saleId: sale.id },
      orderBy: { refundedAt: "desc" },
      select: {
        id: true,
        amount: true,
        currency: true,
        exchangeRateToBase: true,
        method: true,
        reference: true,
        refundedAt: true,
        creditNoteId: true,
      },
    });
  } catch {
    refunds = [];
  }

  const parts = await prisma.part.findMany({
    where: { orgId, isActive: true },
    orderBy: [{ name: "asc" }],
    select: { id: true, sku: true, name: true, qtyOnHand: true },
    take: 300,
  }).catch(() => []);

  async function updateSaleAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const saleId = String(formData.get("saleId") ?? "").trim();
    const branchId = String(formData.get("branchId") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim();
    if (!saleId) return;

    if (branchId) {
      const branch = await prisma.branch.findFirst({ where: { id: branchId, orgId, isActive: true }, select: { id: true } });
      if (!branch) return;
    }

    await prisma.sale.updateMany({
      where: { id: saleId, orgId },
      data: { branchId, notes: notes || null },
    });
    await writeSystemAuditEvent({ orgId, actorUserId: user.id, entityType: "Sale", entityId: saleId, action: "POS_SALE_UPDATED", summary: "POS sale metadata updated" });

    revalidatePath(`/pos/${saleId}`);
    revalidatePath("/pos");
  }

  async function deleteSaleAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (user.role !== "ADMIN") redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const saleId = String(formData.get("saleId") ?? "").trim();
    if (!saleId) return;

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, orgId },
      select: {
        id: true,
        status: true,
        invoicedAt: true,
        items: { select: { partId: true, quantity: true, description: true } },
        payments: { select: { id: true }, take: 1 },
        creditNotes: { select: { id: true }, take: 1 },
        refunds: { select: { id: true }, take: 1 },
      },
    });
    if (!sale || sale.status !== "OPEN" || sale.invoicedAt || sale.payments.length || sale.creditNotes.length || sale.refunds.length) return;

    await prisma.$transaction(async (tx) => {
      for (const item of sale.items) {
        if (!item.partId) continue;
        const part = await tx.part.findFirst({ where: { id: item.partId, orgId }, select: { id: true, qtyOnHand: true } });
        if (!part) continue;
        await tx.part.update({ where: { id: part.id }, data: { qtyOnHand: part.qtyOnHand + Math.abs(item.quantity) } });
        await tx.partStockTransaction.create({
          data: {
            partId: part.id,
            saleId: sale.id,
            type: "IN",
            quantity: Math.abs(item.quantity),
            reason: `POS sale deleted (${item.description})`,
            createdById: user.id,
          },
        });
      }
      await tx.sale.deleteMany({ where: { id: sale.id, orgId } });
    });
    await writeSystemAuditEvent({ orgId, actorUserId: user.id, entityType: "Sale", entityId: sale.id, action: "POS_SALE_DELETED", summary: "Open POS sale deleted" });

    revalidatePath("/pos");
    redirect("/pos");
  }

  async function updateItemAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const saleId = String(formData.get("saleId") ?? "").trim();
    const itemId = String(formData.get("itemId") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const quantity = Math.max(1, Math.floor(Number(String(formData.get("quantity") ?? "1").trim())));
    const unitPrice = Number(String(formData.get("unitPrice") ?? "0").trim());
    if (!saleId || !itemId || !description || !Number.isFinite(quantity) || !Number.isFinite(unitPrice) || unitPrice < 0) return;

    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({ where: { id: saleId, orgId }, select: { id: true, status: true } });
      if (!sale || sale.status !== "OPEN") return;

      const item = await tx.saleItem.findFirst({ where: { id: itemId, saleId }, select: { id: true, partId: true, quantity: true } });
      if (!item) return;

      const delta = quantity - item.quantity;
      if (item.partId && delta !== 0) {
        const part = await tx.part.findFirst({ where: { id: item.partId, orgId }, select: { id: true, qtyOnHand: true } });
        if (!part) return;
        const nextQty = part.qtyOnHand - delta;
        if (nextQty < 0) posReject(saleId, "Not enough stock for that quantity.");
        await tx.part.update({ where: { id: part.id }, data: { qtyOnHand: nextQty } });
        await tx.partStockTransaction.create({
          data: {
            partId: part.id,
            saleId,
            type: delta > 0 ? "OUT" : "IN",
            quantity: Math.abs(delta),
            reason: `POS sale item updated (${description})`,
            createdById: user.id,
          },
        });
      }

      await tx.saleItem.update({ where: { id: item.id }, data: { description, quantity, unitPrice, lineTotal: quantity * unitPrice } });
      await recalcSaleTotals(tx, saleId, orgId);
    });
    await writeSystemAuditEvent({ orgId, actorUserId: user.id, entityType: "SaleItem", entityId: itemId, action: "POS_ITEM_UPDATED", summary: "POS sale item updated" });

    revalidatePath(`/pos/${saleId}`);
  }

  async function deleteItemAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const saleId = String(formData.get("saleId") ?? "").trim();
    const itemId = String(formData.get("itemId") ?? "").trim();
    if (!saleId || !itemId) return;

    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({ where: { id: saleId, orgId }, select: { id: true, status: true } });
      if (!sale || sale.status !== "OPEN") return;

      const item = await tx.saleItem.findFirst({ where: { id: itemId, saleId }, select: { id: true, partId: true, quantity: true, description: true } });
      if (!item) return;

      if (item.partId) {
        const part = await tx.part.findFirst({ where: { id: item.partId, orgId }, select: { id: true, qtyOnHand: true } });
        if (part) {
          await tx.part.update({ where: { id: part.id }, data: { qtyOnHand: part.qtyOnHand + Math.abs(item.quantity) } });
          await tx.partStockTransaction.create({
            data: {
              partId: part.id,
              saleId,
              type: "IN",
              quantity: Math.abs(item.quantity),
              reason: `POS sale item deleted (${item.description})`,
              createdById: user.id,
            },
          });
        }
      }

      await tx.saleItem.delete({ where: { id: item.id } });
      await recalcSaleTotals(tx, saleId, orgId);
    });
    await writeSystemAuditEvent({ orgId, actorUserId: user.id, entityType: "SaleItem", entityId: itemId, action: "POS_ITEM_DELETED", summary: "POS sale item deleted" });

    revalidatePath(`/pos/${saleId}`);
  }

  async function addItemAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const saleId = String(formData.get("saleId") ?? "").trim();
    const partId = String(formData.get("partId") ?? "").trim() || null;
    const description = String(formData.get("description") ?? "").trim();
    const qty = Number(String(formData.get("quantity") ?? "1").trim());
    // Price is optional when a product is chosen — it defaults to the product's
    // selling price (falling back to cost). A custom item still needs a price.
    const priceRaw = String(formData.get("unitPrice") ?? "").trim();
    const priceProvided = priceRaw !== "";
    let unitPrice = priceProvided ? Number(priceRaw) : 0;

    if (!saleId) return;
    if (!partId && !description) posReject(saleId, "Choose a product or enter an item description.");
    if (!Number.isFinite(qty) || qty <= 0) posReject(saleId, "Enter a valid quantity.");
    if (priceProvided && (!Number.isFinite(unitPrice) || unitPrice < 0)) posReject(saleId, "Enter a valid unit price.");
    if (!priceProvided && !partId) posReject(saleId, "Enter a unit price for a custom item.");

    const existingSale = await prisma.sale.findFirst({ where: { id: saleId, orgId }, select: { id: true, status: true } });
    if (!existingSale || existingSale.status !== "OPEN") posReject(saleId, "This sale is no longer open, so items can't be added.");

    await prisma.$transaction(async (tx) => {
      let resolvedDescription = description;
      let resolvedPartId: string | null = null;

      if (partId) {
        const part = await tx.part.findFirst({ where: { id: partId, orgId, isActive: true }, select: { id: true, sku: true, name: true, qtyOnHand: true, sellingPrice: true, unitCost: true } });
        if (!part) posReject(saleId, "That product was not found or is inactive.");
        if (part.qtyOnHand - Math.abs(qty) < 0) posReject(saleId, `Not enough stock — only ${part.qtyOnHand} of ${part.name} on hand.`);

        resolvedPartId = part.id;
        resolvedDescription = part.name;
        if (!priceProvided) unitPrice = part.sellingPrice ?? part.unitCost ?? 0;

        await tx.part.update({ where: { id: part.id }, data: { qtyOnHand: part.qtyOnHand - Math.abs(qty) } });
        await tx.partStockTransaction.create({
          data: {
            partId: part.id,
            saleId,
            type: "OUT",
            quantity: Math.abs(qty),
            reason: `POS sale item (${resolvedDescription})`,
          },
        });
      }

      await tx.saleItem.create({
        data: { saleId, partId: resolvedPartId, description: resolvedDescription, quantity: qty, unitPrice, lineTotal: unitPrice * qty },
      });

      await recalcSaleTotals(tx, saleId, orgId);
    });

    revalidatePath(`/pos/${saleId}`);
  }

  // Flip VAT on/off for this specific sale (overrides the org default per-sale).
  async function toggleSaleVatAction(formData: FormData) {
    "use server";
    const { user, orgId } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const saleId = String(formData.get("saleId") ?? "").trim();
    const next = String(formData.get("next") ?? "") === "true";
    if (!saleId) return;

    const existingSale = await prisma.sale.findFirst({ where: { id: saleId, orgId }, select: { id: true, status: true } });
    if (!existingSale || existingSale.status !== "OPEN") return;

    await prisma.$transaction(async (tx) => {
      await recalcSaleTotals(tx, saleId, orgId, next);
    });

    revalidatePath(`/pos/${saleId}`);
  }

  async function addPaymentAction(formData: FormData) {
    "use server";
    const { user, orgId, session, org } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "PAYMENT" });

    const saleId = String(formData.get("saleId") ?? "").trim();
    const rawAmount = String(formData.get("amount") ?? "").trim();
    const method = String(formData.get("method") ?? "CASH").trim();
    const reference = String(formData.get("reference") ?? "").trim();
    if (!saleId) return;

    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) posReject(saleId, "Enter a valid payment amount.");

    const existingSale = await prisma.sale.findFirst({ where: { id: saleId, orgId }, select: { id: true, totalAmount: true, status: true, currency: true, clientId: true } });
    if (!existingSale || existingSale.status === "VOID") posReject(saleId, "This sale is void — no payment can be recorded.");

    const saleCurrency = normalizeCurrency(existingSale.currency, org.baseCurrency);
    if (saleCurrency !== org.baseCurrency) {
      // POS currently assumes sale totals and payments are in org base currency.
      // Surface this instead of silently dropping the payment (money received but
      // never recorded). When enabling non-base POS currencies, collect the FX rate.
      posReject(saleId, `This sale is in ${saleCurrency}. Payments are only supported in the base currency (${org.baseCurrency}) for now.`);
    }

    const safeMethod: PaymentMethod = METHODS.includes(method as PaymentMethod)
      ? (method as PaymentMethod)
      : "OTHER" as PaymentMethod;

    // Receipt + C5 ledger post run inside the txn; ensure their schema exists first.
    await ensureMoneySchema();

    await prisma.$transaction(async (tx) => {
      // Double-submit guard: an identical till payment landed seconds ago — reuse
      // it instead of recording the same money twice.
      const dupPayment = await findRecentDuplicate(tx.payment, {
        orgId,
        saleId,
        amount,
        method: safeMethod,
        kind: "PAYMENT",
      });
      if (dupPayment) return;
      const payment = await tx.payment.create({
        data: {
          orgId,
          saleId,
          invoiceId: null,
          currency: saleCurrency,
          exchangeRateToBase: null,
          amount,
          method: safeMethod,
          reference: reference || null,
          createdById: session.user.id,
        },
        select: { id: true },
      });

      // Generate a receipt for the sale payment — same as invoice payments do.
      // Previously POS payments created no Receipt record, so till sales had no
      // receipt document (inconsistent with the invoice flow).
      await createReceiptForPayment(tx, {
        orgId,
        paymentId: payment.id,
        saleId,
        clientId: existingSale.clientId,
        amount,
        currency: saleCurrency,
        issuedById: session.user.id,
      });

      await syncSalePaymentState(tx, { orgId, saleId });
    });

    revalidatePath(`/pos/${saleId}`);
    revalidatePath("/reports");
  }

  async function createCreditNoteAction(formData: FormData) {
    "use server";
    const { user, orgId, org, session } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS"].includes(user.role))) redirect("/dashboard");
    // Expired workspaces are read-only except for payment entry.
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const saleId = String(formData.get("saleId") ?? "").trim();
    if (!saleId) return;

    const reason = String(formData.get("reason") ?? "").trim() || null;

    const existingSale = await prisma.sale.findFirst({
      where: { id: saleId, orgId },
      select: { id: true, status: true, saleNumber: true, currency: true, totalAmount: true },
    });
    // A partially-returned sale can still receive further credit notes (up to the
    // cumulative cap below); only OPEN/VOID/fully-RETURNED sales are excluded.
    if (!existingSale || !["PAID", "PARTIALLY_RETURNED"].includes(existingSale.status)) return;

    const items = await prisma.saleItem.findMany({
      where: { saleId },
      select: { id: true, description: true, quantity: true, unitPrice: true, lineTotal: true, partId: true },
      orderBy: { createdAt: "asc" },
    });

    const picked: Array<{ saleItemId: string; description: string; quantity: number; unitPrice: number; lineTotal: number; partId: string | null }> = [];
    for (const it of items) {
      const raw = String(formData.get(`returnQty:${it.id}`) ?? "").trim();
      if (!raw) continue;
      const qty = Math.max(0, Math.floor(Number(raw)));
      if (!Number.isFinite(qty) || qty <= 0) continue;
      if (qty > it.quantity) continue;
      picked.push({
        saleItemId: it.id,
        description: it.description,
        quantity: qty,
        unitPrice: it.unitPrice,
        lineTotal: it.unitPrice * qty,
        partId: it.partId,
      });
    }
    if (picked.length === 0) posReject(saleId, "Select at least one item to return.");

    const currency = normalizeCurrency(existingSale.currency, org.baseCurrency);
    const totalAmount = picked.reduce((sum, p) => sum + p.lineTotal, 0);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) posReject(saleId, "The selected items have no returnable value.");

    // Cumulative-return cap: total value across all credit notes for this sale
    // must never exceed what was sold (prevents unlimited over-refund).
    const priorCredited = await prisma.creditNote.aggregate({
      where: { orgId, saleId },
      _sum: { totalAmount: true },
    });
    if ((priorCredited._sum.totalAmount ?? 0) + totalAmount > existingSale.totalAmount) posReject(saleId, "This return exceeds the value of the sale.");

    const result = await prisma.$transaction(async (tx) => {
      // Double-submit guard: an identical credit note for this sale landed seconds ago.
      const dupCn = await findRecentDuplicate(tx.creditNote, { orgId, saleId, totalAmount });
      if (dupCn) return { id: dupCn.id, creditNoteNumber: dupCn.creditNoteNumber, deduped: true };

      const creditNoteNumber = await nextDocumentNumber(tx, "CN", "creditNote", orgId);

      const created = await tx.creditNote.create({
        data: {
          orgId,
          saleId,
          creditNoteNumber,
          currency,
          totalAmount,
          reason,
          createdById: session.user.id,
        },
        select: { id: true },
      });

      await tx.creditNoteItem.createMany({
        data: picked.map((p) => ({
          creditNoteId: created.id,
          partId: p.partId,
          description: p.description,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          lineTotal: p.lineTotal,
        })),
      });

      // M10: reflect the return on the sale (PARTIALLY_RETURNED / RETURNED).
      await syncSalePaymentState(tx, { orgId, saleId });

      return { id: created.id, creditNoteNumber, deduped: false };
    });

    if (!result.deduped) {
      await writeSystemAuditEvent({
        orgId,
        actorUserId: user.id,
        entityType: "CreditNote",
        entityId: result.id,
        action: "CREDIT_NOTE_CREATED",
        summary: `Credit note ${result.creditNoteNumber} for sale ${existingSale.saleNumber} (${formatMoney(totalAmount, currency)})`,
      });
    }

    revalidatePath(`/pos/${saleId}`);
  }

  async function markItemsReceivedBackAction(formData: FormData) {
    "use server";
    const { user, orgId, session, org } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS"].includes(user.role))) redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const saleId = String(formData.get("saleId") ?? "").trim();
    const creditNoteId = String(formData.get("creditNoteId") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim() || null;
    if (!saleId || !creditNoteId) return;

    const creditNote = await prisma.creditNote.findFirst({
      where: { id: creditNoteId, orgId, saleId },
      select: { id: true, creditNoteNumber: true, itemsReceivedBackAt: true },
    });
    if (!creditNote || creditNote.itemsReceivedBackAt) return;

    await prisma.$transaction(async (tx) => {
      const items = await tx.creditNoteItem.findMany({ where: { creditNoteId }, select: { partId: true, quantity: true, description: true } });

      for (const it of items) {
        if (!it.partId) continue;
        const part = await tx.part.findFirst({ where: { id: it.partId, orgId, isActive: true }, select: { id: true, qtyOnHand: true, sku: true, name: true } });
        if (!part) continue;
        await tx.part.update({ where: { id: part.id }, data: { qtyOnHand: part.qtyOnHand + Math.abs(it.quantity) } });
        await tx.partStockTransaction.create({
          data: {
            partId: part.id,
            saleId,
            type: "IN",
            quantity: Math.abs(it.quantity),
            reason: `Return (${creditNote.creditNoteNumber}) ${it.description || part.name}`,
            createdById: session.user.id,
          },
        });
      }

      await tx.creditNote.update({
        where: { id: creditNoteId },
        data: {
          itemsReceivedBackAt: new Date(),
          itemsReceivedBackById: session.user.id,
          itemsReceivedBackNote: note,
        },
      });
    });

    await writeSystemAuditEvent({
      orgId,
      actorUserId: user.id,
      entityType: "CreditNote",
      entityId: creditNoteId,
      action: "CREDIT_NOTE_ITEMS_RECEIVED_BACK",
      summary: `Returned stock received back for credit note ${creditNote.creditNoteNumber}`,
    });

    revalidatePath(`/pos/${saleId}`);
  }

  async function createRefundAction(formData: FormData) {
    "use server";
    const { user, orgId, org, session } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS"].includes(user.role))) redirect("/dashboard");
    // Expired workspaces are read-only except for payment entry.
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const saleId = String(formData.get("saleId") ?? "").trim();
    const creditNoteId = String(formData.get("creditNoteId") ?? "").trim();
    const rawAmount = String(formData.get("amount") ?? "").trim();
    const rawRate = String(formData.get("exchangeRateToBase") ?? "").trim();
    const method = String(formData.get("method") ?? "CASH").trim();
    const reference = String(formData.get("reference") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    if (!saleId || !creditNoteId) return;

    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) posReject(saleId, "Enter a valid refund amount.");

    const existingSale = await prisma.sale.findFirst({ where: { id: saleId, orgId }, select: { id: true, status: true } });
    // A credit note can be refunded whether the sale is PAID or already flipped
    // to a returned state by an earlier credit note (M10).
    if (!existingSale || !["PAID", "PARTIALLY_RETURNED", "RETURNED"].includes(existingSale.status)) posReject(saleId, "This sale isn't in a state that can be refunded.");

    const creditNote = await prisma.creditNote.findFirst({
      where: { id: creditNoteId, orgId, saleId },
      select: { id: true, currency: true, totalAmount: true },
    });
    if (!creditNote) posReject(saleId, "The related credit note was not found.");

    const refundedAgg = await prisma.refund.aggregate({ where: { orgId, creditNoteId: creditNote.id }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } }));
    const refundedSoFar = refundedAgg._sum.amount ?? 0;
    const refundable = Math.max(0, creditNote.totalAmount - refundedSoFar);
    if (amount > refundable) posReject(saleId, `Refund exceeds the refundable amount (${formatMoney(refundable, normalizeCurrency(creditNote.currency, org.baseCurrency))}).`);

    const safeMethod: PaymentMethod = METHODS.includes(method as PaymentMethod)
      ? (method as PaymentMethod)
      : "OTHER" as PaymentMethod;

    const currency = normalizeCurrency(creditNote.currency, org.baseCurrency);
    const exchangeRateToBase = currency === org.baseCurrency ? null : (rawRate ? Number(rawRate) : null);
    if (currency !== org.baseCurrency) {
      if (!exchangeRateToBase || !Number.isFinite(exchangeRateToBase) || exchangeRateToBase <= 0) posReject(saleId, "Enter a valid exchange rate for this foreign-currency refund.");
    }

    // Double-submit guard: an identical refund against this credit note landed
    // seconds ago — don't pay it out twice.
    const dupRefund = await findRecentDuplicate(prisma.refund, {
      orgId,
      saleId,
      creditNoteId: creditNote.id,
      amount,
      method: safeMethod,
    });
    if (dupRefund) {
      revalidatePath(`/pos/${saleId}`);
      return;
    }

    // Refund write + C5 ledger post + sale paid-state recompute must be atomic;
    // ensure the ledger/FX schema exists before opening the txn.
    await ensureMoneySchema();
    const refund = await prisma.$transaction(async (tx) => {
      const created = await tx.refund.create({
        data: {
          orgId,
          saleId,
          invoiceId: null,
          creditNoteId: creditNote.id,
          currency,
          exchangeRateToBase,
          amount,
          method: safeMethod,
          reference: reference || null,
          createdById: session.user.id,
          note: note || null,
        },
        select: { id: true },
      });
      // Reduce the sale's collected amount by the refund (was never recomputed,
      // leaving sale.paidAmount overstated after a POS refund).
      await syncSalePaymentState(tx, { orgId, saleId });
      // C5: cash-basis ledger post — reverse revenue, pay out cash. Every other
      // refund path posts this; the POS path previously skipped it, so the ledger
      // and cash reports overstated cash after a till refund. Post the base value.
      const baseRefund = currency === org.baseCurrency
        ? amount
        : toBaseAmount({ amount, currency, baseCurrency: org.baseCurrency, exchangeRateToBase });
      await postRefund(tx, {
        orgId,
        userId: session.user.id,
        amount: baseRefund,
        reference: `refund:${created.id}`,
        description: `Refund on sale ${saleId} (credit note ${creditNote.id})`,
      });
      return created;
    });

    await writeSystemAuditEvent({
      orgId,
      actorUserId: user.id,
      entityType: "Refund",
      entityId: refund.id,
      action: "REFUND_CREATED",
      summary: `Refund ${formatMoney(amount, currency)} for sale ${saleId} against credit note ${creditNoteId}`,
    });

    revalidatePath(`/pos/${saleId}`);
    revalidatePath("/reports");
    revalidatePath("/dashboard");
  }

  const balance = Math.max(0, sale.totalAmount - sale.paidAmount);
  const canDeleteSale = user.role === "ADMIN" && sale.status === "OPEN" && !sale.invoicedAt && sale._count.payments === 0 && sale._count.creditNotes === 0 && sale._count.refunds === 0;

  const isOpen = sale.status === "OPEN";
  const refundedTotal = refunds.reduce((sum, r) => sum + r.amount, 0);

  // Share the sale receipt PDF with the customer through the outbox (WhatsApp/email).
  async function shareSaleReceiptWhatsAppAction(formData: FormData) {
    "use server";
    const { user, orgId } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) redirect("/dashboard");
    const saleId = String(formData.get("saleId") ?? "").trim();
    if (saleId) await shareSaleReceiptDocument({ orgId, saleId, channel: "whatsapp" });
    revalidatePath(`/pos/${saleId}`);
  }
  async function shareSaleReceiptEmailAction(formData: FormData) {
    "use server";
    const { user, orgId } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) redirect("/dashboard");
    const saleId = String(formData.get("saleId") ?? "").trim();
    if (saleId) await shareSaleReceiptDocument({ orgId, saleId, channel: "email" });
    revalidatePath(`/pos/${saleId}`);
  }

  // One control scale for the whole page — same language as the clients workspace.
  const field =
    "w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none transition placeholder:text-[var(--ink-muted)]/60 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15";
  const fieldOnStrong =
    "w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[0.8125rem] outline-none transition placeholder:text-[var(--ink-muted)]/60 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15";
  const cellInput =
    "w-full min-w-0 rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50";
  const cardLabel = "text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70";
  const barClass = "border-b border-[var(--line)] bg-[var(--panel-strong)]/40 p-3";
  const iconBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)]";
  const iconBtnDanger =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/20 text-[var(--ink-muted)]/40 transition hover:border-red-400/40 hover:text-red-500";

  return (
    <div className="space-y-4 pb-24 lg:pb-8">
      {errorMessage ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {errorMessage}
        </div>
      ) : null}
      <RecordActionBar
        backHref="/pos"
        eyebrow="Point of Sale · Sale"
        title={sale.saleNumber}
        status={{ label: sale.status, tone: sale.status === "PAID" ? "success" : sale.status === "VOID" ? "danger" : "warning" }}
        secondary={
          <>
            <RecordPreviewButton variant="button" label="Preview" pdfUrl={`/api/sales/${sale.id}/receipt`} title={`Receipt ${sale.saleNumber}`} />
            <Button href={`/api/sales/${sale.id}/receipt`} external target="_blank" rel="noreferrer" variant="secondary" size="sm">
              Receipt PDF
            </Button>
            {canDeleteSale ? (
              <form action={deleteSaleAction}>
                <input type="hidden" name="saleId" value={sale.id} />
                <ConfirmSubmitButton message="Delete this open POS sale? Stock will be restored." className={buttonClasses("danger", "sm")}>
                  Delete
                </ConfirmSubmitButton>
              </form>
            ) : null}
          </>
        }
        overflow={
          sale.client && sale.items.length > 0 ? (
            <RowActionsMenu label="Share receipt">
              <DocumentShareMenuSection
                hiddenFieldName="saleId"
                hiddenFieldValue={sale.id}
                recipientPhone={sale.client.phone}
                recipientEmail={sale.client.email}
                whatsAppAction={shareSaleReceiptWhatsAppAction}
                emailAction={shareSaleReceiptEmailAction}
                whatsAppLabel="Send receipt via WhatsApp"
                emailLabel="Email receipt"
              />
            </RowActionsMenu>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          {/* -- Sale settings -- */}
          <section className="dc-card overflow-hidden">
            <form action={updateSaleAction} className="grid gap-2 p-3 md:grid-cols-[200px_minmax(0,1fr)_auto]">
              <input type="hidden" name="saleId" value={sale.id} />
              <select name="branchId" defaultValue={sale.branchId ?? ""} aria-label="Branch" className={field}>
                <option value="">No branch</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <input name="notes" defaultValue={sale.notes ?? ""} placeholder="Sale note" className={field} />
              <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">Save</SubmitButton>
            </form>
          </section>

      {/* -- Items -- */}
      <section className="dc-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
          <p className={cardLabel}>Items</p>
          <p className="text-[0.75rem] text-[var(--ink-muted)]">
            {sale.items.length} {sale.items.length === 1 ? "line" : "lines"} &middot; {formatMoney(sale.subtotal, saleCurrency)}
          </p>
        </div>

        {isOpen ? (
          <form action={addItemAction} className={`grid gap-2 md:grid-cols-[1.3fr_1.7fr_72px_120px_auto] ${barClass}`}>
            <input type="hidden" name="saleId" value={sale.id} />
            <select name="partId" defaultValue="" aria-label="Part" title="Optional: pick a part to deduct stock" className={field}>
              <option value="">Custom item</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.qtyOnHand})
                </option>
              ))}
            </select>
            <input name="description" placeholder="Description" className={field} />
            <input name="quantity" placeholder="Qty" defaultValue={1} inputMode="numeric" aria-label="Quantity" className={field} required />
            <input name="unitPrice" placeholder="Price (auto)" inputMode="decimal" aria-label="Unit price" className={field} />
            <SubmitButton size="sm" className="px-4" pendingLabel="Adding…">Add</SubmitButton>
          </form>
        ) : null}

        <DataTable
          frameless
          dense
          rows={sale.items}
          getRowKey={(it) => it.id}
          empty="No items yet."
          columns={[
            {
              key: "item",
              header: "Item",
              cell: (it) =>
                isOpen ? (
                  <input form={`edit-item-${it.id}`} name="description" defaultValue={it.description} aria-label="Description" className={cellInput} />
                ) : it.description,
            },
            {
              key: "qty",
              header: "Qty",
              className: "w-20 whitespace-nowrap tabular-nums",
              cell: (it) =>
                isOpen ? (
                  <input form={`edit-item-${it.id}`} name="quantity" defaultValue={it.quantity} inputMode="numeric" aria-label="Quantity" className={cellInput} />
                ) : it.quantity,
            },
            {
              key: "price",
              header: "Price",
              className: "w-32 whitespace-nowrap tabular-nums",
              cell: (it) =>
                isOpen ? (
                  <input form={`edit-item-${it.id}`} name="unitPrice" defaultValue={it.unitPrice} inputMode="decimal" aria-label="Unit price" className={cellInput} />
                ) : formatMoney(it.unitPrice, saleCurrency),
            },
            {
              key: "total",
              header: "Total",
              className: "whitespace-nowrap font-semibold tabular-nums",
              cell: (it) => formatMoney(it.lineTotal, saleCurrency),
            },
          ]}
          actions={
            isOpen
              ? (it) => (
                  <div className="flex items-center justify-end gap-1.5">
                    <form id={`edit-item-${it.id}`} action={updateItemAction}>
                      <input type="hidden" name="saleId" value={sale.id} />
                      <input type="hidden" name="itemId" value={it.id} />
                      <button type="submit" title="Save line" className={iconBtn}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                    </form>
                    <form action={deleteItemAction}>
                      <input type="hidden" name="saleId" value={sale.id} />
                      <input type="hidden" name="itemId" value={it.id} />
                      <ConfirmSubmitButton
                        message="Delete this POS line item? Stock will be restored if linked to inventory."
                        title="Delete line"
                        className={iconBtnDanger}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                )
              : undefined
          }
        />

        {isOpen ? (
          <details className="group border-t border-[var(--line)] bg-[var(--panel-strong)]/40">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 hover:bg-[var(--panel-strong)]/60 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2 text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">
                <span className="transition-transform group-open:rotate-90" aria-hidden="true">&rsaquo;</span> Adjust
              </span>
              <span className="text-[0.75rem] text-[var(--ink-muted)]">
                {sale.discountAmount > 0 ? <>&minus;{formatMoney(sale.discountAmount, saleCurrency)} &middot; </> : null}
                VAT {formatMoney(sale.vatAmount, saleCurrency)} &middot; Total {formatMoney(sale.totalAmount, saleCurrency)}
              </span>
            </summary>
            <form
              action={async (formData: FormData) => {
                "use server";
                const { user, orgId } = await requireOrgSession();
                if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) redirect("/dashboard");
                const saleId = String(formData.get("saleId") ?? "").trim();
                const raw = String(formData.get("discountAmount") ?? "").trim();
                if (!saleId) return;
                const discountAmount = Math.max(0, Number(raw || "0"));
                if (!Number.isFinite(discountAmount)) posReject(saleId, "Enter a valid discount amount.");

                const existingSale = await prisma.sale.findFirst({ where: { id: saleId, orgId }, select: { id: true, status: true } });
                if (!existingSale || existingSale.status !== "OPEN") posReject(saleId, "This sale is no longer open.");

                await prisma.$transaction(async (tx) => {
                  const itemsAgg = await tx.saleItem.aggregate({ where: { saleId }, _sum: { lineTotal: true } });
                  const subtotal = itemsAgg._sum.lineTotal ?? 0;
                  const capped = Math.max(0, Math.min(discountAmount, subtotal));
                  await tx.sale.update({ where: { id: saleId }, data: { discountAmount: capped } });
                  await recalcSaleTotals(tx, saleId, orgId);
                });

                revalidatePath(`/pos/${saleId}`);
              }}
              className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-3 py-2.5"
            >
              <input type="hidden" name="saleId" value={sale.id} />
              <span className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Discount</span>
              <input
                name="discountAmount"
                inputMode="decimal"
                defaultValue={sale.discountAmount}
                placeholder="0"
                aria-label="Discount amount"
                className={`${field} w-32 flex-none`}
              />
              <SubmitButton variant="secondary" size="sm" pendingLabel="Applying…">Apply</SubmitButton>
            </form>
            <form
              action={toggleSaleVatAction}
              className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-3 py-2.5"
            >
              <input type="hidden" name="saleId" value={sale.id} />
              <input type="hidden" name="next" value={sale.taxApplicable ? "false" : "true"} />
              <span className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">VAT</span>
              <SubmitButton variant="secondary" size="sm" pendingLabel="Updating…">
                {sale.taxApplicable ? "Turn VAT off" : "Turn VAT on"}
              </SubmitButton>
              <span className="ml-auto text-[0.75rem] text-[var(--ink-muted)]">
                {sale.taxApplicable ? "Charged on this sale" : "Not charged on this sale"}
              </span>
            </form>
          </details>
        ) : null}
      </section>

      {/* -- Payments -- */}
      <section className="dc-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
          <p className={cardLabel}>Payments</p>
          <p className="text-[0.75rem] text-[var(--ink-muted)]">
            {sale.payments.length} recorded &middot;{" "}
            {balance > 0
              ? <span className="font-semibold text-amber-600 dark:text-amber-400">{formatMoney(balance, saleCurrency)} due</span>
              : <span className="font-semibold text-emerald-600 dark:text-emerald-400">cleared</span>}
          </p>
        </div>

        {sale.status !== "VOID" && balance > 0 ? (
          <form action={addPaymentAction} className={`grid gap-2 md:grid-cols-[140px_170px_minmax(0,1fr)_auto] ${barClass}`}>
            <input type="hidden" name="saleId" value={sale.id} />
            <input name="amount" inputMode="decimal" placeholder="Amount" aria-label="Amount" className={field} required />
            <select name="method" defaultValue={"CASH" as PaymentMethod} aria-label="Payment method" className={field}>
              {METHODS.map((m) => (
                <option key={m} value={m}>{m.replaceAll("_", " ")}</option>
              ))}
            </select>
            <input name="reference" placeholder="Ref (optional)" className={field} />
            <SubmitButton size="sm" className="px-4" pendingLabel="Adding…">Add</SubmitButton>
          </form>
        ) : null}

        <DataTable
          frameless
          dense
          rows={sale.payments}
          getRowKey={(p) => p.id}
          empty="No payments yet."
          columns={[
            { key: "date", header: "Date", className: "whitespace-nowrap text-[0.75rem] text-[var(--ink-muted)]", cell: (p) => formatEATDateTime(p.receivedAt) },
            { key: "method", header: "Method", cell: (p) => p.method.replaceAll("_", " ") },
            { key: "ref", header: "Ref", className: "text-[0.75rem] text-[var(--ink-muted)]", cell: (p) => p.reference ?? <span className="opacity-30">&mdash;</span> },
            { key: "amount", header: "Amount", className: "whitespace-nowrap font-semibold tabular-nums", cell: (p) => formatMoney(p.amount, normalizeCurrency(p.currency, saleCurrency)) },
          ]}
        />
      </section>

      {/* -- Return / Refund: only surfaced once the sale is paid -- */}
      {["PAID", "PARTIALLY_RETURNED"].includes(sale.status) ? (
      <details
        open={creditNotes.length > 0 || refunds.length > 0}
        className="dc-card overflow-hidden"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 hover:bg-[var(--panel-strong)]/30 [&::-webkit-details-marker]:hidden">
          <p className={cardLabel}>Return / Refund</p>
          <span className="text-[0.75rem] text-[var(--ink-muted)]">
            {creditNotes.length > 0 || refundedTotal > 0
              ? `${creditNotes.length} credit ${creditNotes.length === 1 ? "note" : "notes"}${refundedTotal > 0 ? ` · ${formatMoney(refundedTotal, saleCurrency)} refunded` : ""}`
              : "Issue a credit note or refund"}
          </span>
        </summary>

        <div className="space-y-3 border-t border-[var(--line)] p-3">
            {/* Issue credit note */}
            <form action={createCreditNoteAction} className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel-strong)]/40">
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2">
                <p className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Issue Credit Note</p>
                <input type="hidden" name="saleId" value={sale.id} />
                <input name="reason" placeholder="Reason (optional)" className={`${fieldOnStrong} ml-auto max-w-xs`} />
                <SubmitButton size="sm" pendingLabel="Creating…">Create</SubmitButton>
              </div>
              <DataTable
                frameless
                dense
                rows={sale.items}
                getRowKey={(it) => it.id}
                empty="No items on this sale."
                columns={[
                  { key: "item", header: "Item", cell: (it) => it.description },
                  { key: "sold", header: "Sold", className: "w-20 whitespace-nowrap tabular-nums text-[var(--ink-muted)]", cell: (it) => it.quantity },
                  {
                    key: "returnQty",
                    header: "Return qty",
                    className: "w-28",
                    cell: (it) => (
                      <input name={`returnQty:${it.id}`} defaultValue={0} inputMode="numeric" aria-label={`Return quantity for ${it.description}`} className={cellInput} />
                    ),
                  },
                ]}
              />
            </form>

            {/* Refund */}
            <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel-strong)]/40">
              <div className="border-b border-[var(--line)] px-3 py-2">
                <p className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                  Refund <span className="normal-case tracking-normal opacity-70">(requires a credit note)</span>
                </p>
              </div>
              {creditNotes.length === 0 ? (
                <p className="px-3 py-2.5 text-[0.8125rem] text-[var(--ink-muted)]">Create a credit note first.</p>
              ) : (
                <form action={createRefundAction} className="grid gap-2 p-3 md:grid-cols-[210px_130px_170px_minmax(0,1fr)_auto]">
                  <input type="hidden" name="saleId" value={sale.id} />
                  <select name="creditNoteId" defaultValue={creditNotes[0]?.id} aria-label="Credit note" className={fieldOnStrong}>
                    {creditNotes.map((cn) => (
                      <option key={cn.id} value={cn.id}>
                        {cn.creditNoteNumber} &middot; {formatMoney(cn.totalAmount, normalizeCurrency(cn.currency, saleCurrency))}
                      </option>
                    ))}
                  </select>
                  <input name="amount" inputMode="decimal" placeholder="Amount" aria-label="Refund amount" className={fieldOnStrong} required />
                  <input
                    name="exchangeRateToBase"
                    inputMode="decimal"
                    placeholder={`Rate to ${org.baseCurrency}`}
                    title={`Only required when currency differs from ${org.baseCurrency}`}
                    className={fieldOnStrong}
                  />
                  <input name="reference" placeholder="Ref (optional)" className={fieldOnStrong} />
                  <ConfirmSubmitButton
                    message="Pay out this refund? Money leaves the till and this cannot be undone."
                    confirmLabel="Pay refund"
                    className={buttonClasses("danger", "sm", { className: "px-4" })}
                  >
                    Refund
                  </ConfirmSubmitButton>
                </form>
              )}
            </div>

            {/* Credit notes */}
            <div className="overflow-hidden rounded-lg border border-[var(--line)]">
              <div className="border-b border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
                <p className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Credit Notes</p>
              </div>
              <div className="space-y-2 bg-[var(--panel)] p-3">
                {creditNotes.length === 0 ? (
                  <p className="text-[0.8125rem] text-[var(--ink-muted)]">No credit notes yet.</p>
                ) : creditNotes.map((cn) => (
                  <div key={cn.id} className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel-strong)]/40">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
                      <div className="min-w-0">
                        <p className="mono text-[0.8125rem] font-bold text-[var(--ink)]">{cn.creditNoteNumber}</p>
                        <p className="text-[0.75rem] text-[var(--ink-muted)]">
                          {formatEATDateTime(cn.issuedAt)}
                          {cn.reason ? ` · ${cn.reason}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge tone={cn.itemsReceivedBackAt ? "success" : "warning"} dot>
                          {cn.itemsReceivedBackAt ? "Stock received" : "Awaiting stock"}
                        </StatusBadge>
                        <p className="text-[0.8125rem] font-bold tabular-nums whitespace-nowrap text-[var(--ink)]">
                          {formatMoney(cn.totalAmount, normalizeCurrency(cn.currency, saleCurrency))}
                        </p>
                      </div>
                    </div>

                    {cn.items.length ? (
                      <DataTable
                        frameless
                        dense
                        rows={cn.items}
                        getRowKey={(it) => it.id}
                        columns={[
                          { key: "item", header: "Item", cell: (it) => it.description },
                          { key: "qty", header: "Qty", className: "w-20 whitespace-nowrap tabular-nums text-[var(--ink-muted)]", cell: (it) => it.quantity },
                          { key: "total", header: "Total", className: "whitespace-nowrap tabular-nums", cell: (it) => formatMoney(it.lineTotal, normalizeCurrency(cn.currency, saleCurrency)) },
                        ]}
                      />
                    ) : null}

                    {!cn.itemsReceivedBackAt ? (
                      <form action={markItemsReceivedBackAction} className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-3 py-2">
                        <input type="hidden" name="saleId" value={sale.id} />
                        <input type="hidden" name="creditNoteId" value={cn.id} />
                        <input name="note" placeholder="Stock received note (optional)" className={`${fieldOnStrong} min-w-[200px] flex-1`} />
                        <Button type="submit" variant="secondary" size="sm">Mark items received</Button>
                      </form>
                    ) : cn.itemsReceivedBackNote ? (
                      <p className="border-t border-[var(--line)] px-3 py-2 text-[0.75rem] text-[var(--ink-muted)]">Note: {cn.itemsReceivedBackNote}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {/* Refunds */}
            <div className="overflow-hidden rounded-lg border border-[var(--line)]">
              <div className="border-b border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
                <p className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Refunds</p>
              </div>
              <DataTable
                frameless
                dense
                rows={refunds}
                getRowKey={(r) => r.id}
                empty="No refunds yet."
                columns={[
                  { key: "date", header: "Date", className: "whitespace-nowrap text-[0.75rem] text-[var(--ink-muted)]", cell: (r) => formatEATDateTime(r.refundedAt) },
                  {
                    key: "creditNote",
                    header: "Credit note",
                    className: "mono text-[0.75rem] text-[var(--ink-muted)]",
                    cell: (r) => (r.creditNoteId ? (creditNotes.find((c) => c.id === r.creditNoteId)?.creditNoteNumber ?? "—") : "—"),
                  },
                  { key: "method", header: "Method", cell: (r) => r.method.replaceAll("_", " ") },
                  { key: "ref", header: "Ref", className: "text-[0.75rem] text-[var(--ink-muted)]", cell: (r) => r.reference ?? <span className="opacity-30">&mdash;</span> },
                  { key: "amount", header: "Amount", className: "whitespace-nowrap font-semibold tabular-nums", cell: (r) => formatMoney(r.amount, normalizeCurrency(r.currency, saleCurrency)) },
                ]}
              />
            </div>
        </div>
      </details>
      ) : null}
        </div>

        <RecordSummaryRail
          headline={balance > 0
            ? { label: "Balance due", value: formatMoney(balance, saleCurrency), tone: "warn" }
            : { label: "Total", value: formatMoney(sale.totalAmount, saleCurrency), tone: "good" }}
          rows={[
            { label: "Subtotal", value: formatMoney(sale.subtotal, saleCurrency) },
            ...(sale.discountAmount > 0 ? [{ label: "Discount", value: `−${formatMoney(sale.discountAmount, saleCurrency)}` }] : []),
            { label: sale.taxApplicable ? "VAT" : "VAT (off)", value: sale.vatAmount > 0 ? formatMoney(sale.vatAmount, saleCurrency) : "—" },
            { label: "Total", value: formatMoney(sale.totalAmount, saleCurrency) },
            { label: "Paid", value: formatMoney(sale.paidAmount, saleCurrency) },
            { label: "Balance", value: balance > 0 ? formatMoney(balance, saleCurrency) : "Cleared" },
            ...(refundedTotal > 0 ? [{ label: "Refunded", value: formatMoney(refundedTotal, saleCurrency) }] : []),
            { label: "Items", value: sale.items.length },
            { label: "Branch", value: sale.branch?.name ?? "No branch" },
            { label: "Created", value: formatEATDateTime(sale.createdAt) },
            ...(sale.paidAt ? [{ label: "Paid at", value: formatEATDateTime(sale.paidAt) }] : []),
            ...(sale.invoiceNumber ? [{ label: "Invoice", value: sale.invoiceNumber }] : []),
          ] as SummaryRow[]}
          party={{ title: "Customer", name: sale.client?.fullName ?? "Walk-in" }}
        />
      </div>
    </div>
  );
}
