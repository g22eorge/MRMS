-- Payables maturity: Expense.dueAt plus the RecurringExpense schedule table.
-- SQLite stores enums as TEXT, so the new PAYABLE_DUE NotificationType value
-- needs no DDL here (Postgres baseline covers its own ENUM).
ALTER TABLE "Expense" ADD COLUMN "dueAt" DATETIME;

CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "supplierId" TEXT,
    "frequency" TEXT NOT NULL,
    "nextDueAt" DATETIME NOT NULL,
    "lastIssuedAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoIssue" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecurringExpense_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringExpense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecurringExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Expense_orgId_dueAt_idx" ON "Expense"("orgId", "dueAt");
CREATE INDEX "RecurringExpense_orgId_isActive_nextDueAt_idx" ON "RecurringExpense"("orgId", "isActive", "nextDueAt");
CREATE INDEX "RecurringExpense_supplierId_idx" ON "RecurringExpense"("supplierId");
