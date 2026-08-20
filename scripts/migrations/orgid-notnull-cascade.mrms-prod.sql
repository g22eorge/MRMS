PRAGMA foreign_keys=OFF;
BEGIN;
-- ── Client: notnull=False fk=add
CREATE TABLE "Client__mig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "organization" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
, "orgId" TEXT NOT NULL DEFAULT 'org_eis_01', "address" TEXT, FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
INSERT INTO "Client__mig" ("id", "fullName", "phone", "email", "organization", "notes", "createdAt", "updatedAt", "orgId", "address") SELECT "id", "fullName", "phone", "email", "organization", "notes", "createdAt", "updatedAt", "orgId", "address" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "Client__mig" RENAME TO "Client";
CREATE UNIQUE INDEX "Client_phone_key" ON "Client"("phone");
CREATE INDEX "Client_orgId_idx" ON "Client"("orgId");
CREATE UNIQUE INDEX "Client_phone_orgId_key" ON "Client"("phone", "orgId");
CREATE INDEX "Client_orgId_updatedAt_idx" ON "Client"("orgId", "updatedAt");
-- ── Device: notnull=True fk=add
CREATE TABLE "Device__mig" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "clientId" TEXT NOT NULL,
        "deviceType" TEXT NOT NULL,
        "brand" TEXT NOT NULL,
        "model" TEXT NOT NULL,
        "serialOrImei" TEXT,
        "accessories" TEXT,
        "physicalNotes" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "orgId" TEXT NOT NULL DEFAULT 'org_eis_01',
        FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
      , FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
INSERT INTO "Device__mig" ("id", "clientId", "deviceType", "brand", "model", "serialOrImei", "accessories", "physicalNotes", "createdAt", "updatedAt", "orgId") SELECT "id", "clientId", "deviceType", "brand", "model", "serialOrImei", "accessories", "physicalNotes", "createdAt", "updatedAt", "orgId" FROM "Device";
DROP TABLE "Device";
ALTER TABLE "Device__mig" RENAME TO "Device";
CREATE INDEX "Device_clientId_idx" ON "Device"("clientId");
CREATE INDEX "Device_serialOrImei_idx" ON "Device"("serialOrImei");
CREATE INDEX "Device_orgId_idx" ON "Device"("orgId");
-- ── Job: notnull=False fk=add
CREATE TABLE "Job__mig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "repairPath" TEXT,
    "clientId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "deviceType" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialOrImei" TEXT,
    "accessories" TEXT,
    "physicalNotes" TEXT,
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
    "closedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL, "deliveredAt" DATETIME, "deliveryMethod" TEXT, "deliveredTo" TEXT, "deviceId" TEXT, "serviceType" TEXT DEFAULT 'HARDWARE', "softwareOsInstall" INTEGER DEFAULT 0, "softwareDriversUpdates" INTEGER DEFAULT 0, "softwareDataBackupRestore" INTEGER DEFAULT 0, "softwareAccountSetup" INTEGER DEFAULT 0, "softwarePerformanceTune" INTEGER DEFAULT 0, "softwareThirdPartyApps" INTEGER DEFAULT 0, "softwareRequestedNotes" TEXT, "softwareLicenseAttested" INTEGER DEFAULT 0, "softwareInstallerSource" TEXT, "softwareInstallerSourceNote" TEXT, "clientPaid" INTEGER NOT NULL DEFAULT 0, "clientPaidAt" DATETIME, "clientPaidById" TEXT, "clientPaymentRef" TEXT, "invoiceNumber" TEXT, "invoiceIssuedAt" DATETIME, "orgId" TEXT NOT NULL DEFAULT 'org_eis_01', "branchId" TEXT, "warrantyMonths" INTEGER, "warrantyExpiresAt" DATETIME,
    CONSTRAINT "Job_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_externalPaidById_fkey" FOREIGN KEY ("externalPaidById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
, FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
INSERT INTO "Job__mig" ("id", "jobNumber", "status", "repairPath", "clientId", "createdById", "assignedToId", "deviceType", "brand", "model", "serialOrImei", "accessories", "physicalNotes", "issueDescription", "workflowReason", "statusNote", "diagnosisNotes", "externalDiagnosis", "recommendedRepair", "recommendationOption", "communicationStatus", "clientConversationNote", "lastClientContactAt", "partsNeeded", "costEstimate", "finalCost", "vatApplicable", "externalTechFee", "externalPaid", "externalPaidAt", "externalPaidById", "externalPaymentRef", "clientApproved", "approvalDate", "quotedAt", "repairTimeline", "timelineMinMinutes", "timelineMaxMinutes", "timelineConfidence", "timelineNote", "technicianNotes", "workDone", "partsReplaced", "receivedAt", "completedAt", "closedAt", "updatedAt", "deliveredAt", "deliveryMethod", "deliveredTo", "deviceId", "serviceType", "softwareOsInstall", "softwareDriversUpdates", "softwareDataBackupRestore", "softwareAccountSetup", "softwarePerformanceTune", "softwareThirdPartyApps", "softwareRequestedNotes", "softwareLicenseAttested", "softwareInstallerSource", "softwareInstallerSourceNote", "clientPaid", "clientPaidAt", "clientPaidById", "clientPaymentRef", "invoiceNumber", "invoiceIssuedAt", "orgId", "branchId", "warrantyMonths", "warrantyExpiresAt") SELECT "id", "jobNumber", "status", "repairPath", "clientId", "createdById", "assignedToId", "deviceType", "brand", "model", "serialOrImei", "accessories", "physicalNotes", "issueDescription", "workflowReason", "statusNote", "diagnosisNotes", "externalDiagnosis", "recommendedRepair", "recommendationOption", "communicationStatus", "clientConversationNote", "lastClientContactAt", "partsNeeded", "costEstimate", "finalCost", "vatApplicable", "externalTechFee", "externalPaid", "externalPaidAt", "externalPaidById", "externalPaymentRef", "clientApproved", "approvalDate", "quotedAt", "repairTimeline", "timelineMinMinutes", "timelineMaxMinutes", "timelineConfidence", "timelineNote", "technicianNotes", "workDone", "partsReplaced", "receivedAt", "completedAt", "closedAt", "updatedAt", "deliveredAt", "deliveryMethod", "deliveredTo", "deviceId", "serviceType", "softwareOsInstall", "softwareDriversUpdates", "softwareDataBackupRestore", "softwareAccountSetup", "softwarePerformanceTune", "softwareThirdPartyApps", "softwareRequestedNotes", "softwareLicenseAttested", "softwareInstallerSource", "softwareInstallerSourceNote", "clientPaid", "clientPaidAt", "clientPaidById", "clientPaymentRef", "invoiceNumber", "invoiceIssuedAt", "orgId", "branchId", "warrantyMonths", "warrantyExpiresAt" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "Job__mig" RENAME TO "Job";
CREATE UNIQUE INDEX "Job_jobNumber_key" ON "Job"("jobNumber");
CREATE INDEX "Job_deviceId_idx" ON "Job"("deviceId");
CREATE INDEX "Job_orgId_idx" ON "Job"("orgId");
CREATE INDEX Job_orgId_completedAt_idx ON Job(orgId, completedAt);
CREATE INDEX Job_orgId_receivedAt_idx ON Job(orgId, receivedAt);
CREATE INDEX Job_orgId_repairPath_status_idx ON Job(orgId, repairPath, status);
CREATE INDEX "Job_orgId_status_idx" ON "Job"("orgId", "status");
CREATE INDEX "Job_clientId_idx" ON "Job"("clientId");
CREATE INDEX "Job_createdById_idx" ON "Job"("createdById");
CREATE INDEX "Job_status_updatedAt_idx" ON "Job"("status", "updatedAt");
CREATE INDEX "Job_status_receivedAt_idx" ON "Job"("status", "receivedAt");
CREATE INDEX "Job_assignedToId_status_idx" ON "Job"("assignedToId", "status");
CREATE INDEX "Job_completedAt_idx" ON "Job"("completedAt");
CREATE INDEX "Job_repairPath_idx" ON "Job"("repairPath");
CREATE INDEX "Job_orgId_jobNumber_idx" ON "Job"("orgId", "jobNumber");
-- ── Part: notnull=False fk=add
CREATE TABLE "Part__mig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "unitCost" REAL,
    "qtyOnHand" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
, "orgId" TEXT NOT NULL DEFAULT 'org_eis_01', "qtyReserved" INTEGER NOT NULL DEFAULT 0, "sellingPrice" REAL, "category" TEXT, "description" TEXT, "taxable" BOOLEAN NOT NULL DEFAULT true, "taxRate" REAL, "baseUom" TEXT, "saleUom" TEXT, "purchaseUom" TEXT, "saleUomFactor" REAL, "purchaseUomFactor" REAL, FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
INSERT INTO "Part__mig" ("id", "sku", "name", "manufacturer", "unitCost", "qtyOnHand", "reorderLevel", "isActive", "createdAt", "updatedAt", "orgId", "qtyReserved", "sellingPrice", "category", "description", "taxable", "taxRate", "baseUom", "saleUom", "purchaseUom", "saleUomFactor", "purchaseUomFactor") SELECT "id", "sku", "name", "manufacturer", "unitCost", "qtyOnHand", "reorderLevel", "isActive", "createdAt", "updatedAt", "orgId", "qtyReserved", "sellingPrice", "category", "description", "taxable", "taxRate", "baseUom", "saleUom", "purchaseUom", "saleUomFactor", "purchaseUomFactor" FROM "Part";
DROP TABLE "Part";
ALTER TABLE "Part__mig" RENAME TO "Part";
CREATE UNIQUE INDEX "Part_sku_key" ON "Part"("sku");
CREATE INDEX "Part_isActive_idx" ON "Part"("isActive");
CREATE INDEX "Part_orgId_idx" ON "Part"("orgId");
CREATE INDEX "Part_orgId_isActive_idx" ON "Part"("orgId", "isActive");
CREATE UNIQUE INDEX "Part_sku_orgId_key" ON "Part"("sku", "orgId");
COMMIT;
PRAGMA foreign_keys=ON;
