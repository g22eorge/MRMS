-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PAYABLE_DUE';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'OPERATIONS_MANAGER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkflowReason" ADD VALUE 'CLIENT_APPROVED';
ALTER TYPE "WorkflowReason" ADD VALUE 'CLIENT_APPROVED_PARTS_PENDING';
ALTER TYPE "WorkflowReason" ADD VALUE 'CLIENT_APPROVED_AWAITING_DEVICE';

-- DropIndex
DROP INDEX "DocumentSequence_orgId_type_year_key";

-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN     "ledgerCode" TEXT;

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "DocumentSequence" ADD COLUMN     "month" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Part" ADD COLUMN     "shortDescription" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "name" TEXT;

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "supplierId" TEXT,
    "frequency" TEXT NOT NULL,
    "nextDueAt" TIMESTAMP(3) NOT NULL,
    "lastIssuedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoIssue" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpensePayment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "amount" DECIMAL(18,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpensePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringExpense_orgId_isActive_nextDueAt_idx" ON "RecurringExpense"("orgId", "isActive", "nextDueAt");

-- CreateIndex
CREATE INDEX "RecurringExpense_supplierId_idx" ON "RecurringExpense"("supplierId");

-- CreateIndex
CREATE INDEX "ExpensePayment_orgId_paidAt_idx" ON "ExpensePayment"("orgId", "paidAt");

-- CreateIndex
CREATE INDEX "ExpensePayment_expenseId_idx" ON "ExpensePayment"("expenseId");

-- CreateIndex
CREATE INDEX "BankAccount_orgId_ledgerCode_idx" ON "BankAccount"("orgId", "ledgerCode");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSequence_orgId_type_year_month_key" ON "DocumentSequence"("orgId", "type", "year", "month");

-- CreateIndex
CREATE INDEX "Expense_orgId_dueAt_idx" ON "Expense"("orgId", "dueAt");

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: rows already settled carry their full amount, so a paid expense
-- does not read as owing the moment paidAmount exists. Prisma's diff cannot
-- infer this — it came from the SQLite migration this one replaces.
UPDATE "Expense" SET "paidAmount" = "amount" WHERE "paidAt" IS NOT NULL;
