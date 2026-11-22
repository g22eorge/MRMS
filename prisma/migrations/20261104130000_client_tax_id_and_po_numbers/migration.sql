-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "taxId" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "poNumber" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "poNumber" TEXT;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "poNumber" TEXT;
