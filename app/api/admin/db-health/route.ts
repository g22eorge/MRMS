import { NextResponse } from "next/server";

import { assertPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { introspectionDialect, listTables, tableColumns } from "@/lib/db/introspect";

export const dynamic = "force-dynamic";

const TABLES_TO_CHECK = [
  "User",
  "Session",
  "Account",
  "Verification",
  "UserPermission",
  "Client",
  "Device",
  "Job",
  "Photo",
  "AuditLog",
  "RepairRequest",
  "OutboundMessage",
  "Notification",
  "NotificationPreferences",
  "DocumentBrandingSettings",
  "StockTransfer",
  "StockTransferItem",
  "GoodsReceived",
  "GoodsReceivedItem",
  "SupplierBill",
  "SupplierBillItem",
  "SupplierPayment",
  "PurchaseRequest",
  "PurchaseRequestItem",
  "StockCount",
  "StockCountItem",
] as const;

  const JOB_COLUMNS_TO_CHECK = [
  "status",
  "deviceType",
  "brand",
  "model",
  "serialOrImei",
  "accessories",
  "physicalNotes",
  "clientApproved",
  "approvalDate",
  "quotedAt",
  "repairTimeline",
  "clientPaid",
  "clientPaidAt",
  "clientPaidById",
  "clientPaymentRef",
  "invoiceNumber",
  "invoiceIssuedAt",
  "deviceId",
  "serviceType",
  "softwareOsInstall",
  "softwareDriversUpdates",
  "softwareDataBackupRestore",
  "softwareAccountSetup",
  "softwarePerformanceTune",
  "softwareThirdPartyApps",
  "softwareRequestedNotes",
  "softwareLicenseAttested",
  "softwareInstallerSource",
  "softwareInstallerSourceNote",
  "deliveredAt",
  "deliveryMethod",
  "deliveredTo",
  "externalTechFee",
  "externalPaid",
  "externalPaidAt",
    "vatApplicable",
  ] as const;

const OUTBOX_COLUMNS_TO_CHECK = [
  "providerDeliveryStatus",
  "providerDeliveryAt",
  "providerDeliveryErrorCode",
  "providerDeliveryError",
] as const;

const INVOICE_COLUMNS_TO_CHECK = ["clientId", "invoiceType", "subject", "dueDate", "paidAmount"] as const;
const DELIVERY_NOTE_COLUMNS_TO_CHECK = ["saleId", "invoiceId", "createdById", "createdAt"] as const;
const SUPPLIER_BILL_COLUMNS_TO_CHECK = ["supplierRef", "poId", "grnId", "currency", "dueAt", "notes", "createdById", "paidAmount"] as const;
const SUPPLIER_BILL_ITEM_COLUMNS_TO_CHECK = ["lineTotal"] as const;
const SUPPLIER_PAYMENT_COLUMNS_TO_CHECK = ["currency", "createdById"] as const;

export async function GET() {
  const user = await assertPlatformAdmin();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 1) Tables
  const tableSet = await listTables();
  const tablesPresent = Object.fromEntries(TABLES_TO_CHECK.map((t) => [t, tableSet.has(t)]));

  // 2) Job columns
  let jobColumnsPresent: Record<string, boolean> | null = null;
  let jobColumnNames: string[] | null = null;
  {
    const colSet = await tableColumns("Job");
    // An empty set means the question could not be answered. Reporting that as
    // "every column missing" would be a false alarm on a healthy database, so
    // it stays null — the same shape the old catch produced.
    jobColumnNames = colSet.size ? [...colSet] : null;
    jobColumnsPresent = colSet.size
      ? Object.fromEntries(JOB_COLUMNS_TO_CHECK.map((c) => [c, colSet.has(c)]))
      : null;
  }

  // 3) Actual status values in DB (raw, to avoid enum parsing)
  let jobStatusCounts: Array<{ status: string; count: number }> | null = null;
  try {
    const rows = await prisma.$queryRaw<Array<{ status: string; count: number }>>`
      SELECT status as status, COUNT(*) as count FROM "Job" GROUP BY status ORDER BY count DESC
    `;
    jobStatusCounts = rows;
  } catch {
    jobStatusCounts = null;
  }

  // 4) Outbox columns
  let outboxColumnsPresent: Record<string, boolean> | null = null;
  {
    const colSet = await tableColumns("OutboundMessage");
    outboxColumnsPresent = colSet.size
      ? Object.fromEntries(OUTBOX_COLUMNS_TO_CHECK.map((c) => [c, colSet.has(c)]))
      : null;
  }

  const columnsFor = async <T extends readonly string[]>(table: string, columns: T) => {
    const colSet = await tableColumns(table);
    if (!colSet.size) return null;
    return Object.fromEntries(columns.map((c) => [c, colSet.has(c)]));
  };

  // Live check for the UNIQUE constraints most likely to be BLOCKED by legacy prod
  // data during a schema heal (see scripts/sync-schema-to-db.mjs Pass 2). Each query
  // counts the rows that violate the invariant; a non-zero count means the reconciler
  // can't create that UNIQUE index, so it stays unenforced. Read-only — resolving the
  // duplicates (which financial row is authoritative) is a human decision, not a
  // silent deploy-time delete. Any check that can't run (missing table/column) is null.
  const countViolation = async (label: string, sql: string): Promise<{ index: string; violatingRows: number } | { index: string; violatingRows: null }> => {
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ n: number | bigint }>>(sql);
      return { index: label, violatingRows: Number(rows[0]?.n ?? 0) };
    } catch {
      return { index: label, violatingRows: null };
    }
  };

  const uniqueConstraintRisks = await Promise.all([
    // Two+ invoices sharing one job → Invoice_jobId_key can't be created.
    countViolation(
      "Invoice_jobId_key",
      `SELECT COALESCE(SUM(c - 1), 0) AS n FROM (SELECT COUNT(*) AS c FROM "Invoice" WHERE "jobId" IS NOT NULL GROUP BY "jobId" HAVING c > 1)`,
    ),
    // Two+ receipts for one payment in an org → Receipt_orgId_paymentId_key can't be created.
    countViolation(
      "Receipt_orgId_paymentId_key",
      `SELECT COALESCE(SUM(c - 1), 0) AS n FROM (SELECT COUNT(*) AS c FROM "Receipt" GROUP BY "orgId", "paymentId" HAVING c > 1)`,
    ),
    // Duplicate non-empty invoice numbers → Invoice_invoiceNumber_key can't be created.
    countViolation(
      "Invoice_invoiceNumber_key",
      `SELECT COALESCE(SUM(c - 1), 0) AS n FROM (SELECT COUNT(*) AS c FROM "Invoice" WHERE "invoiceNumber" IS NOT NULL AND TRIM("invoiceNumber") <> '' GROUP BY "invoiceNumber" HAVING c > 1)`,
    ),
    // Empty-string Job.invoiceNumber duplicates (reconciler nulls these pre-index).
    countViolation(
      "Job_invoiceNumber_empty",
      `SELECT COUNT(*) AS n FROM "Job" WHERE "invoiceNumber" IS NOT NULL AND TRIM("invoiceNumber") = ''`,
    ),
    // More than one branding row per org (reconciler dedups these pre-index).
    countViolation(
      "DocumentBrandingSettings_orgId_dupes",
      `SELECT COALESCE(SUM(c - 1), 0) AS n FROM (SELECT COUNT(*) AS c FROM "DocumentBrandingSettings" GROUP BY "orgId" HAVING c > 1)`,
    ),
  ]);

  return NextResponse.json({
    ok: true,
    runtime: {
      mode: process.env.TURSO_DATABASE_URL
        ? "turso"
        : introspectionDialect() === "postgres"
          ? "postgres"
          : "sqlite",
      // Which dialect the checks above were asked in. Worth reporting: every
      // "missing" answer on this page is only as trustworthy as the dialect
      // that produced it.
      introspection: introspectionDialect(),
      hasTursoDatabaseUrl: Boolean(process.env.TURSO_DATABASE_URL),
      hasTursoAuthToken: Boolean(process.env.TURSO_AUTH_TOKEN),
      databaseUrlKind: process.env.DATABASE_URL?.startsWith("file:")
        ? "sqlite-file"
        : introspectionDialect() === "postgres"
          ? "postgres"
          : process.env.DATABASE_URL ? "other" : "unset",
    },
    tablesPresent,
    jobColumnsPresent,
    jobColumnNames,
    jobStatusCounts,
    uniqueConstraintRisks,
    outboxColumnsPresent,
    invoiceColumnsPresent: await columnsFor("Invoice", INVOICE_COLUMNS_TO_CHECK),
    deliveryNoteColumnsPresent: await columnsFor("DeliveryNote", DELIVERY_NOTE_COLUMNS_TO_CHECK),
    supplierBillColumnsPresent: await columnsFor("SupplierBill", SUPPLIER_BILL_COLUMNS_TO_CHECK),
    supplierBillItemColumnsPresent: await columnsFor("SupplierBillItem", SUPPLIER_BILL_ITEM_COLUMNS_TO_CHECK),
    supplierPaymentColumnsPresent: await columnsFor("SupplierPayment", SUPPLIER_PAYMENT_COLUMNS_TO_CHECK),
  });
}
