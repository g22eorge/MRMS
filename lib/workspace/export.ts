import { prisma } from "@/lib/prisma";

/**
 * Everything a business has put into its workspace, as plain rows.
 *
 * The privacy policy says the data belongs to the customer. This is how they
 * take it with them: every table that carries their orgId, plus the line-item
 * tables that hang off those, read straight from the database so a table added
 * later is included without anyone remembering to list it here.
 *
 * Left out on purpose: sign-in credentials and sessions, integration tokens,
 * and internal logs that are not the customer's records.
 */
const NEVER = new Set([
  "Account", "Session", "Verification", "PortalSession", "RateLimit", "OrgWhatsAppConfig",
  "Notification", "NotificationPreferences", "AiPromptLog", "SystemAuditEvent", "ErrorEvent",
  "OutboundMessage", "InboundMessage", "BillingEvent", "UserInvite",
]);

/** Columns removed wherever they appear. */
const SECRET_COLUMNS = new Set(["passwordHash", "password", "accessToken", "refreshToken", "idToken", "token", "atApiKey"]);

/** Line-item tables without their own orgId: [table, foreign key, parent]. */
const CHILDREN: Array<[string, string, string]> = [
  ["InvoiceLine", "invoiceId", "Invoice"],
  ["QuotationItem", "quotationId", "Quotation"],
  ["SaleItem", "saleId", "Sale"],
  ["CreditNoteItem", "creditNoteId", "CreditNote"],
  ["DeliveryNoteItem", "deliveryNoteId", "DeliveryNote"],
  ["PurchaseOrderItem", "purchaseOrderId", "PurchaseOrder"],
  ["GoodsReceivedItem", "goodsReceivedId", "GoodsReceived"],
  ["JournalLine", "journalEntryId", "JournalEntry"],
  ["StockTransferItem", "stockTransferId", "StockTransfer"],
  ["SupplierBillItem", "supplierBillId", "SupplierBill"],
  ["LeadActivity", "leadId", "Lead"],
];

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

function scrub(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (SECRET_COLUMNS.has(key)) continue;
      out[key] = typeof value === "bigint" ? Number(value) : value;
    }
    return out;
  });
}

export async function exportWorkspace(orgId: string) {
  const columns = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  `;
  const byTable = new Map<string, Set<string>>();
  for (const { table_name, column_name } of columns) {
    if (!byTable.has(table_name)) byTable.set(table_name, new Set());
    byTable.get(table_name)?.add(column_name);
  }

  const tables: Record<string, Array<Record<string, unknown>>> = {};
  const scoped = [...byTable.entries()]
    .filter(([name, cols]) => cols.has("orgId") && !NEVER.has(name) && !name.startsWith("_"))
    .map(([name]) => name)
    .sort();

  for (const name of scoped) {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM ${q(name)} WHERE "orgId" = $1`,
      orgId,
    );
    if (rows.length > 0) tables[name] = scrub(rows);
  }

  for (const [child, fk, parent] of CHILDREN) {
    const cols = byTable.get(child);
    if (!cols || !cols.has(fk) || cols.has("orgId") || !byTable.get(parent)?.has("orgId")) continue;
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT c.* FROM ${q(child)} c JOIN ${q(parent)} p ON p."id" = c.${q(fk)} WHERE p."orgId" = $1`,
      orgId,
    );
    if (rows.length > 0) tables[child] = scrub(rows);
  }

  const organisation = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, slug: true, plan: true, createdAt: true },
  });

  return {
    exportedAt: new Date().toISOString(),
    organisation,
    counts: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length])),
    tables,
  };
}
