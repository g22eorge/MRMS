PRAGMA foreign_keys=OFF;
BEGIN;
-- ── Client: notnull=True fk=retarget
CREATE TABLE "Client__mig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "organization" TEXT,
    "notes" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "address" TEXT,
    CONSTRAINT "Client_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "Client__mig" ("id", "fullName", "phone", "email", "organization", "notes", "orgId", "createdAt", "updatedAt", "address") SELECT "id", "fullName", "phone", "email", "organization", "notes", "orgId", "createdAt", "updatedAt", "address" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "Client__mig" RENAME TO "Client";
CREATE INDEX "Client_orgId_idx" ON "Client"("orgId");
CREATE UNIQUE INDEX "Client_phone_orgId_key" ON "Client"("phone", "orgId");
-- ── Device: notnull=True fk=retarget
CREATE TABLE "Device__mig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialOrImei" TEXT,
    "accessories" TEXT,
    "physicalNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Device_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Device_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "Device__mig" ("id", "clientId", "orgId", "deviceType", "brand", "model", "serialOrImei", "accessories", "physicalNotes", "createdAt", "updatedAt") SELECT "id", "clientId", "orgId", "deviceType", "brand", "model", "serialOrImei", "accessories", "physicalNotes", "createdAt", "updatedAt" FROM "Device";
DROP TABLE "Device";
ALTER TABLE "Device__mig" RENAME TO "Device";
CREATE INDEX "Device_clientId_idx" ON "Device"("clientId");
CREATE INDEX "Device_orgId_idx" ON "Device"("orgId");
CREATE INDEX "Device_serialOrImei_idx" ON "Device"("serialOrImei");
-- ── Job: notnull=True fk=retarget
CREATE TABLE "Job__mig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "repairPath" TEXT,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "deviceId" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "deviceType" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialOrImei" TEXT,
    "accessories" TEXT,
    "physicalNotes" TEXT,
    "serviceType" TEXT NOT NULL DEFAULT 'HARDWARE',
    "softwareOsInstall" BOOLEAN NOT NULL DEFAULT false,
    "softwareDriversUpdates" BOOLEAN NOT NULL DEFAULT false,
    "softwareDataBackupRestore" BOOLEAN NOT NULL DEFAULT false,
    "softwareAccountSetup" BOOLEAN NOT NULL DEFAULT false,
    "softwarePerformanceTune" BOOLEAN NOT NULL DEFAULT false,
    "softwareThirdPartyApps" BOOLEAN NOT NULL DEFAULT false,
    "softwareRequestedNotes" TEXT,
    "softwareLicenseAttested" BOOLEAN NOT NULL DEFAULT false,
    "softwareInstallerSource" TEXT,
    "softwareInstallerSourceNote" TEXT,
    "issueDescription" TEXT NOT NULL,
    "workflowReason" TEXT NOT NULL DEFAULT 'NONE',
    "statusNote" TEXT,
    "diagnosisNotes" TEXT,
    "externalDiagnosis" TEXT,
    "recommendedRepair" TEXT,
    "recommendationOption" TEXT,
    "communicationStatus" TEXT NOT NULL DEFAULT 'NONE',
    "clientConversationNote" TEXT,
    "lastClientContactAt" DATETIME,
    "partsNeeded" TEXT,
    "costEstimate" REAL,
    "finalCost" REAL,
    "vatApplicable" BOOLEAN NOT NULL DEFAULT true,
    "externalTechFee" REAL,
    "externalPaid" BOOLEAN NOT NULL DEFAULT false,
    "externalPaidAt" DATETIME,
    "externalPaidById" TEXT,
    "externalPaymentRef" TEXT,
    "clientPaid" BOOLEAN NOT NULL DEFAULT false,
    "clientPaidAt" DATETIME,
    "clientPaidById" TEXT,
    "clientPaymentRef" TEXT,
    "invoiceNumber" TEXT,
    "invoiceIssuedAt" DATETIME,
    "clientApproved" BOOLEAN,
    "approvalDate" DATETIME,
    "quotedAt" DATETIME,
    "repairTimeline" TEXT,
    "timelineMinMinutes" INTEGER,
    "timelineMaxMinutes" INTEGER,
    "timelineConfidence" TEXT,
    "timelineNote" TEXT,
    "technicianNotes" TEXT,
    "workDone" TEXT,
    "partsReplaced" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "deliveredAt" DATETIME,
    "deliveryMethod" TEXT,
    "deliveredTo" TEXT,
    "closedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL, "branchId" TEXT, "warrantyMonths" INTEGER, "warrantyExpiresAt" DATETIME,
    CONSTRAINT "Job_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Job_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_externalPaidById_fkey" FOREIGN KEY ("externalPaidById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_clientPaidById_fkey" FOREIGN KEY ("clientPaidById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "Job__mig" ("id", "jobNumber", "status", "repairPath", "orgId", "clientId", "deviceId", "createdById", "assignedToId", "deviceType", "brand", "model", "serialOrImei", "accessories", "physicalNotes", "serviceType", "softwareOsInstall", "softwareDriversUpdates", "softwareDataBackupRestore", "softwareAccountSetup", "softwarePerformanceTune", "softwareThirdPartyApps", "softwareRequestedNotes", "softwareLicenseAttested", "softwareInstallerSource", "softwareInstallerSourceNote", "issueDescription", "workflowReason", "statusNote", "diagnosisNotes", "externalDiagnosis", "recommendedRepair", "recommendationOption", "communicationStatus", "clientConversationNote", "lastClientContactAt", "partsNeeded", "costEstimate", "finalCost", "vatApplicable", "externalTechFee", "externalPaid", "externalPaidAt", "externalPaidById", "externalPaymentRef", "clientPaid", "clientPaidAt", "clientPaidById", "clientPaymentRef", "invoiceNumber", "invoiceIssuedAt", "clientApproved", "approvalDate", "quotedAt", "repairTimeline", "timelineMinMinutes", "timelineMaxMinutes", "timelineConfidence", "timelineNote", "technicianNotes", "workDone", "partsReplaced", "receivedAt", "completedAt", "deliveredAt", "deliveryMethod", "deliveredTo", "closedAt", "updatedAt", "branchId", "warrantyMonths", "warrantyExpiresAt") SELECT "id", "jobNumber", "status", "repairPath", "orgId", "clientId", "deviceId", "createdById", "assignedToId", "deviceType", "brand", "model", "serialOrImei", "accessories", "physicalNotes", "serviceType", "softwareOsInstall", "softwareDriversUpdates", "softwareDataBackupRestore", "softwareAccountSetup", "softwarePerformanceTune", "softwareThirdPartyApps", "softwareRequestedNotes", "softwareLicenseAttested", "softwareInstallerSource", "softwareInstallerSourceNote", "issueDescription", "workflowReason", "statusNote", "diagnosisNotes", "externalDiagnosis", "recommendedRepair", "recommendationOption", "communicationStatus", "clientConversationNote", "lastClientContactAt", "partsNeeded", "costEstimate", "finalCost", "vatApplicable", "externalTechFee", "externalPaid", "externalPaidAt", "externalPaidById", "externalPaymentRef", "clientPaid", "clientPaidAt", "clientPaidById", "clientPaymentRef", "invoiceNumber", "invoiceIssuedAt", "clientApproved", "approvalDate", "quotedAt", "repairTimeline", "timelineMinMinutes", "timelineMaxMinutes", "timelineConfidence", "timelineNote", "technicianNotes", "workDone", "partsReplaced", "receivedAt", "completedAt", "deliveredAt", "deliveryMethod", "deliveredTo", "closedAt", "updatedAt", "branchId", "warrantyMonths", "warrantyExpiresAt" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "Job__mig" RENAME TO "Job";
CREATE UNIQUE INDEX "Job_jobNumber_key" ON "Job"("jobNumber");
CREATE UNIQUE INDEX "Job_invoiceNumber_key" ON "Job"("invoiceNumber");
CREATE INDEX "Job_orgId_idx" ON "Job"("orgId");
CREATE INDEX "Job_orgId_status_idx" ON "Job"("orgId", "status");
CREATE INDEX "Job_deviceId_idx" ON "Job"("deviceId");
CREATE INDEX "Job_clientId_idx" ON "Job"("clientId");
CREATE INDEX "Job_createdById_idx" ON "Job"("createdById");
CREATE INDEX "Job_status_updatedAt_idx" ON "Job"("status", "updatedAt");
CREATE INDEX "Job_status_receivedAt_idx" ON "Job"("status", "receivedAt");
CREATE INDEX "Job_assignedToId_status_idx" ON "Job"("assignedToId", "status");
CREATE INDEX "Job_completedAt_idx" ON "Job"("completedAt");
CREATE INDEX "Job_repairPath_idx" ON "Job"("repairPath");
CREATE INDEX "Job_branchId_idx" ON "Job"("branchId");
CREATE INDEX "Job_orgId_completedAt_idx" ON "Job"("orgId", "completedAt");
CREATE INDEX "Job_orgId_receivedAt_idx" ON "Job"("orgId", "receivedAt");
CREATE INDEX "Job_orgId_repairPath_status_idx" ON "Job"("orgId", "repairPath", "status");
CREATE INDEX "Job_orgId_jobNumber_idx" ON "Job"("orgId", "jobNumber");
-- ── Part: notnull=True fk=retarget
CREATE TABLE "Part__mig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "unitCost" REAL,
    "qtyOnHand" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "orgId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "qtyReserved" INTEGER NOT NULL DEFAULT 0, "sellingPrice" REAL, "category" TEXT, "description" TEXT, "taxable" BOOLEAN NOT NULL DEFAULT true, "taxRate" REAL, "baseUom" TEXT, "saleUom" TEXT, "purchaseUom" TEXT, "saleUomFactor" REAL, "purchaseUomFactor" REAL,
    CONSTRAINT "Part_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "Part__mig" ("id", "sku", "name", "manufacturer", "unitCost", "qtyOnHand", "reorderLevel", "isActive", "orgId", "createdAt", "updatedAt", "qtyReserved", "sellingPrice", "category", "description", "taxable", "taxRate", "baseUom", "saleUom", "purchaseUom", "saleUomFactor", "purchaseUomFactor") SELECT "id", "sku", "name", "manufacturer", "unitCost", "qtyOnHand", "reorderLevel", "isActive", "orgId", "createdAt", "updatedAt", "qtyReserved", "sellingPrice", "category", "description", "taxable", "taxRate", "baseUom", "saleUom", "purchaseUom", "saleUomFactor", "purchaseUomFactor" FROM "Part";
DROP TABLE "Part";
ALTER TABLE "Part__mig" RENAME TO "Part";
CREATE INDEX "Part_orgId_isActive_idx" ON "Part"("orgId", "isActive");
CREATE UNIQUE INDEX "Part_sku_orgId_key" ON "Part"("sku", "orgId");
CREATE INDEX "Part_orgId_idx" ON "Part"("orgId");
COMMIT;
PRAGMA foreign_keys=ON;
