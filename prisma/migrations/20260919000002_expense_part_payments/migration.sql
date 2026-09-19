-- Expense part-payments: paidAmount tracking plus the ExpensePayment table.
-- Backfills paidAmount in full for already-paid rows so balances read right.
ALTER TABLE "Expense" ADD COLUMN "paidAmount" REAL NOT NULL DEFAULT 0;
UPDATE "Expense" SET "paidAmount" = "amount" WHERE "paidAt" IS NOT NULL;

CREATE TABLE "ExpensePayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "amount" REAL NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpensePayment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExpensePayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExpensePayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Expense_orgId_paidAmount_idx" ON "Expense"("orgId", "paidAmount");
CREATE INDEX "ExpensePayment_orgId_paidAt_idx" ON "ExpensePayment"("orgId", "paidAt");
CREATE INDEX "ExpensePayment_expenseId_idx" ON "ExpensePayment"("expenseId");
