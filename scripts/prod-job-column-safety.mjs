#!/usr/bin/env node
import { createClient } from "@libsql/client";

const url =
  process.env.TURSO_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "file:./prisma/dev.db";

const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient(
  authToken
    ? {
        url,
        authToken,
      }
    : { url },
);

const requiredColumns = [
  { name: "deviceType", ddl: 'TEXT DEFAULT \'OTHER\'' },
  { name: "brand", ddl: 'TEXT DEFAULT \'Unknown\'' },
  { name: "model", ddl: 'TEXT DEFAULT \'Unknown\'' },
  { name: "serialOrImei", ddl: "TEXT" },
  { name: "accessories", ddl: "TEXT" },
  { name: "physicalNotes", ddl: "TEXT" },
  { name: "clientApproved", ddl: "INTEGER" },
  { name: "approvalDate", ddl: "DATETIME" },
  { name: "quotedAt", ddl: "DATETIME" },
  { name: "repairTimeline", ddl: "TEXT" },
  { name: "clientPaid", ddl: "INTEGER NOT NULL DEFAULT 0" },
  { name: "clientPaidAt", ddl: "DATETIME" },
  { name: "clientPaidById", ddl: "TEXT" },
  { name: "clientPaymentRef", ddl: "TEXT" },
  { name: "invoiceNumber", ddl: "TEXT" },
  { name: "invoiceIssuedAt", ddl: "DATETIME" },
  { name: "serviceType", ddl: "TEXT DEFAULT 'HARDWARE'" },
  { name: "communicationStatus", ddl: "TEXT DEFAULT 'NONE'" },
  // Phase 4c — warranty coverage shown in the portal
  { name: "warrantyMonths", ddl: "INTEGER" },
  { name: "warrantyExpiresAt", ddl: "DATETIME" },
];

// Additive columns on tables other than Job (recent commercial/portal work).
const extraColumns = {
  // M6 — stock ledger enrichment (org scope, location, valuation, source doc)
  PartStockTransaction: [
    { name: "orgId", ddl: "TEXT" },
    { name: "locationId", ddl: "TEXT" },
    { name: "unitCost", ddl: "REAL" },
    { name: "sourceType", ddl: "TEXT" },
    { name: "sourceId", ddl: "TEXT" },
  ],
  // Phase 4b — portal linkage on public/portal repair requests
  RepairRequest: [
    { name: "clientId", ddl: "TEXT" },
    { name: "submittedByPortalUserId", ddl: "TEXT" },
  ],
  // Phase 4c — assessment report client visibility
  DiagnosisReport: [
    { name: "visibility", ddl: "TEXT NOT NULL DEFAULT 'INTERNAL'" },
  ],
};

const extraIndexes = [
  'CREATE INDEX IF NOT EXISTS "PartStockTransaction_orgId_createdAt_idx" ON "PartStockTransaction"("orgId", "createdAt")',
  'CREATE INDEX IF NOT EXISTS "RepairRequest_clientId_idx" ON "RepairRequest"("clientId")',
  'CREATE INDEX IF NOT EXISTS "DiagnosisReport_orgId_jobId_createdAt_idx" ON "DiagnosisReport"("orgId", "jobId", "createdAt")',
];

// New tables (created if missing). PortalUser must precede PortalSession (FK).
const requiredTables = [
  {
    name: "DiagnosisReport",
    create: `
      CREATE TABLE IF NOT EXISTS "DiagnosisReport" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "orgId" TEXT NOT NULL,
        "jobId" TEXT NOT NULL,
        "authorId" TEXT,
        "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
        "summary" TEXT NOT NULL,
        "findings" TEXT,
        "recommendedWork" TEXT,
        "riskNotes" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    indexes: [
      'CREATE INDEX IF NOT EXISTS "DiagnosisReport_orgId_jobId_createdAt_idx" ON "DiagnosisReport"("orgId", "jobId", "createdAt")',
    ],
  },
  {
    name: "SystemAnnouncement",
    create: `
      CREATE TABLE IF NOT EXISTS "SystemAnnouncement" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "title" TEXT NOT NULL,
        "body" TEXT NOT NULL,
        "level" TEXT NOT NULL DEFAULT 'INFO',
        "isActive" INTEGER NOT NULL DEFAULT 1,
        "startsAt" DATETIME,
        "endsAt" DATETIME,
        "createdById" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    indexes: [
      'CREATE INDEX IF NOT EXISTS "SystemAnnouncement_isActive_startsAt_endsAt_idx" ON "SystemAnnouncement"("isActive", "startsAt", "endsAt")',
    ],
  },
  {
    name: "PortalUser",
    create: `
      CREATE TABLE IF NOT EXISTS "PortalUser" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "orgId" TEXT NOT NULL,
        "clientId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "phone" TEXT,
        "department" TEXT,
        "position" TEXT,
        "role" TEXT NOT NULL DEFAULT 'IT_OFFICER',
        "passwordHash" TEXT,
        "isActive" INTEGER NOT NULL DEFAULT 1,
        "lastLoginAt" DATETIME,
        "createdById" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`,
    indexes: [
      'CREATE UNIQUE INDEX IF NOT EXISTS "PortalUser_orgId_email_key" ON "PortalUser"("orgId", "email")',
      'CREATE INDEX IF NOT EXISTS "PortalUser_clientId_idx" ON "PortalUser"("clientId")',
      'CREATE INDEX IF NOT EXISTS "PortalUser_orgId_idx" ON "PortalUser"("orgId")',
    ],
  },
  {
    name: "PortalSession",
    create: `
      CREATE TABLE IF NOT EXISTS "PortalSession" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "token" TEXT NOT NULL,
        "portalUserId" TEXT NOT NULL,
        "expiresAt" DATETIME NOT NULL,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("portalUserId") REFERENCES "PortalUser"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`,
    indexes: [
      'CREATE UNIQUE INDEX IF NOT EXISTS "PortalSession_token_key" ON "PortalSession"("token")',
      'CREATE INDEX IF NOT EXISTS "PortalSession_portalUserId_idx" ON "PortalSession"("portalUserId")',
    ],
  },
  {
    name: "RepairMessage",
    create: `
      CREATE TABLE IF NOT EXISTS "RepairMessage" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "orgId" TEXT NOT NULL,
        "jobId" TEXT NOT NULL,
        "clientId" TEXT,
        "authorType" TEXT NOT NULL,
        "authorId" TEXT,
        "authorName" TEXT NOT NULL,
        "body" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    indexes: [
      'CREATE INDEX IF NOT EXISTS "RepairMessage_jobId_createdAt_idx" ON "RepairMessage"("jobId", "createdAt")',
      'CREATE INDEX IF NOT EXISTS "RepairMessage_orgId_jobId_idx" ON "RepairMessage"("orgId", "jobId")',
    ],
  },
];

async function getColumns(tableName) {
  const result = await client.execute(`PRAGMA table_info('${tableName}')`);
  return new Set(result.rows.map((row) => String(row.name)));
}

async function tableExists(name) {
  const result = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [name],
  });
  return result.rows.length > 0;
}

async function ensureColumns() {
  const existing = await getColumns("Job");
  const applied = [];

  for (const column of requiredColumns) {
    if (existing.has(column.name)) continue;
    await client.execute(`ALTER TABLE "Job" ADD COLUMN "${column.name}" ${column.ddl}`);
    applied.push(column.name);
  }

  return applied;
}

async function ensureExtraColumns() {
  const applied = [];
  for (const [table, columns] of Object.entries(extraColumns)) {
    if (!(await tableExists(table))) continue;
    const existing = await getColumns(table);
    for (const column of columns) {
      if (existing.has(column.name)) continue;
      await client.execute(`ALTER TABLE "${table}" ADD COLUMN "${column.name}" ${column.ddl}`);
      applied.push(`${table}.${column.name}`);
    }
  }
  return applied;
}

async function ensureTables() {
  const created = [];
  for (const table of requiredTables) {
    if (await tableExists(table.name)) continue;
    await client.execute(table.create);
    for (const idx of table.indexes) await client.execute(idx);
    created.push(table.name);
  }
  return created;
}

async function ensureExtraIndexes() {
  for (const idx of extraIndexes) {
    try {
      await client.execute(idx);
    } catch {
      // Index target table may not exist yet on a very old snapshot — ignore.
    }
  }
}

async function normalizeData() {
  const statements = [
    "UPDATE \"Job\" SET \"brand\" = 'Unknown' WHERE \"brand\" IS NULL OR TRIM(\"brand\") = ''",
    "UPDATE \"Job\" SET \"model\" = 'Unknown' WHERE \"model\" IS NULL OR TRIM(\"model\") = ''",
    "UPDATE \"Job\" SET \"deviceType\" = 'OTHER' WHERE \"deviceType\" IS NULL OR TRIM(\"deviceType\") = ''",
    "UPDATE \"Job\" SET \"clientPaid\" = 0 WHERE \"clientPaid\" IS NULL",
    "UPDATE \"Job\" SET \"status\" = 'IN_REPAIR' WHERE \"status\" NOT IN ('RECEIVED','DIAGNOSING','PENDING_EXTERNAL_ASSIGNMENT','ASSIGNED_ONE_TIME_EXTERNAL','IN_EXTERNAL_REPAIR','WAITING_FOR_PARTS','RETURNED_FROM_EXTERNAL','AWAITING_APPROVAL','IN_REPAIR','READY_FOR_PICKUP','COMPLETED','DELIVERED','CLOSED')",
    "UPDATE \"Job\" SET \"repairPath\" = NULL WHERE \"repairPath\" IS NOT NULL AND \"repairPath\" NOT IN ('IN_HOUSE','EXTERNAL')",
    "UPDATE \"Job\" SET \"serviceType\" = 'HARDWARE' WHERE \"serviceType\" IS NULL OR \"serviceType\" NOT IN ('HARDWARE','SOFTWARE','BOTH')",
    "UPDATE \"Job\" SET \"communicationStatus\" = 'NONE' WHERE \"communicationStatus\" IS NULL OR \"communicationStatus\" NOT IN ('NONE','NEEDED','SENT','REPLIED')",
  ];

  for (const statement of statements) {
    await client.execute(statement);
  }
}

try {
  const appliedColumns = await ensureColumns();
  const appliedExtraColumns = await ensureExtraColumns();
  const createdTables = await ensureTables();
  await ensureExtraIndexes();
  await normalizeData();
  const finalColumns = Array.from(await getColumns("Job")).sort();

  console.log(
    JSON.stringify(
      {
        ok: true,
        databaseUrl: url,
        appliedColumns,
        appliedExtraColumns,
        createdTables,
        jobColumns: finalColumns,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
} finally {
  client.close();
}
