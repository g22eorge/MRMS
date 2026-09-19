-- Bank sub-ledger link: which cash channel (1010/1020/1030) a bank account tracks.
ALTER TABLE "BankAccount" ADD COLUMN "ledgerCode" TEXT;
CREATE INDEX "BankAccount_orgId_ledgerCode_idx" ON "BankAccount"("orgId", "ledgerCode");
