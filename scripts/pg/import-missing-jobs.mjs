import { createClient } from "@libsql/client";
import { PrismaClient } from "@prisma/client";
import path from "node:path";

const dumpPath = process.argv[2];
if (!dumpPath) {
  console.error("usage: node scripts/pg/import-missing-jobs.mjs <sqlite-db-path>");
  process.exit(2);
}
const resolved = path.resolve(process.cwd(), dumpPath);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(2);
}

const sqlite = createClient({ url: `file:${resolved}` });
const prisma = new PrismaClient({ log: ["error"] });

const pgJobIds = await prisma.$queryRawUnsafe(`SELECT id FROM "Job"`);
const pgIds = new Set(pgJobIds.map((r) => r.id));

const sqliteJobs = await sqlite.execute("SELECT * FROM Job");
const missingJobs = sqliteJobs.rows.filter((j) => !pgIds.has(j.id));

console.log(`SQLite jobs: ${sqliteJobs.rows.length}, Postgres jobs: ${pgIds.length}, missing: ${missingJobs.length}`);

if (missingJobs.length === 0) {
  console.log("No missing jobs to import.");
  await prisma.$disconnect();
  process.exit(0);
}

// Dependencies
const clientIds = [...new Set(missingJobs.map((j) => j.clientId).filter(Boolean))];
const userIds = [...new Set(missingJobs.map((j) => j.createdById).filter(Boolean))];
const orgIds = [...new Set(missingJobs.map((j) => j.orgId).filter(Boolean))];

const placeholders = (n) => Array.from({ length: n }, () => "?").join(",");

const sqliteClients = clientIds.length
  ? await sqlite.execute(`SELECT * FROM Client WHERE id IN (${placeholders(clientIds.length)})`, clientIds)
  : { rows: [] };
const sqliteUsers = userIds.length
  ? await sqlite.execute(`SELECT * FROM "User" WHERE id IN (${placeholders(userIds.length)})`, userIds)
  : { rows: [] };
const sqliteOrgs = orgIds.length
  ? await sqlite.execute(`SELECT * FROM Organization WHERE id IN (${placeholders(orgIds.length)})`, orgIds)
  : { rows: [] };

const clientsById = new Map(sqliteClients.rows.map((c) => [c.id, c]));
const usersById = new Map(sqliteUsers.rows.map((u) => [u.id, u]));
const orgsById = new Map(sqliteOrgs.rows.map((o) => [o.id, o]));

const pgClients = await prisma.client.findMany({ select: { id: true } });
const pgClientIds = new Set(pgClients.map((r) => r.id));
const pgUsers = await prisma.user.findMany({ select: { id: true } });
const pgUserIds = new Set(pgUsers.map((r) => r.id));
const pgOrgs = await prisma.organization.findMany({ select: { id: true } });
const pgOrgIds = new Set(pgOrgs.map((r) => r.id));

// Organizations
const missingOrgs = orgIds.filter((id) => !pgOrgIds.has(id));
for (const orgId of missingOrgs) {
  const o = orgsById.get(orgId);
  if (!o) continue;
  await prisma.organization.create({
    data: {
      id: o.id,
      name: o.name,
      slug: o.slug,
      plan: o.plan,
      isActive: o.isActive === 1,
      billingStatus: o.billingStatus,
      flwCustomerId: o.flwCustomerId ?? undefined,
      flwSubscriptionId: o.flwSubscriptionId ?? undefined,
      flwPlanId: o.flwPlanId ?? undefined,
      trialEndsAt: o.trialEndsAt ? new Date(o.trialEndsAt) : undefined,
      planRenewsAt: o.planRenewsAt ? new Date(o.planRenewsAt) : undefined,
      planCancelledAt: o.planCancelledAt ? new Date(o.planCancelledAt) : undefined,
      aiModel: o.aiModel ?? undefined,
      baseCurrency: o.baseCurrency,
      supportedCurrencies: o.supportedCurrencies,
      trackingLinksEnabled: o.trackingLinksEnabled === 1,
      createdAt: new Date(o.createdAt),
      updatedAt: new Date(o.updatedAt),
    },
  });
  pgOrgIds.add(orgId);
  console.log(`  org: ${o.name} (${orgId})`);
}

// Users
const missingUsers = userIds.filter((id) => !pgUserIds.has(id));
for (const userId of missingUsers) {
  const u = usersById.get(userId);
  if (!u) continue;
  await prisma.user.create({
    data: {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone ?? undefined,
      emailVerified: u.emailVerified === 1,
      image: u.image ?? undefined,
      role: u.role,
      isActive: u.isActive === 1,
      accessMode: u.accessMode ?? undefined,
      departmentId: undefined,
      techType: u.techType ?? undefined,
      employeeId: u.employeeId ?? undefined,
      specializations: u.specializations ?? undefined,
      orgId: u.orgId,
      branchId: undefined,
      createdAt: new Date(u.createdAt),
      updatedAt: new Date(u.updatedAt),
    },
  });
  pgUserIds.add(userId);
  console.log(`  user: ${u.name} (${userId})`);
}

// Clients
const missingClients = clientIds.filter((id) => !pgClientIds.has(id));
for (const clientId of missingClients) {
  const c = clientsById.get(clientId);
  if (!c) continue;
  await prisma.client.create({
    data: {
      id: c.id,
      fullName: c.fullName,
      phone: c.phone,
      email: c.email ?? undefined,
      organization: c.organization ?? undefined,
      notes: c.notes ?? undefined,
      orgId: c.orgId,
      address: c.address ?? undefined,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
    },
  });
  pgClientIds.add(clientId);
  console.log(`  client: ${c.fullName} (${clientId})`);
}

// Jobs
let imported = 0;
let failed = 0;

for (const j of missingJobs) {
  try {
    await prisma.job.create({
      data: {
        id: j.id,
        jobNumber: j.jobNumber,
        status: j.status,
        repairPath: j.repairPath ?? undefined,
        orgId: j.orgId,
        branchId: j.branchId ?? undefined,
        clientId: j.clientId,
        deviceId: undefined,
        createdById: j.createdById,
        assignedToId: undefined,
        deviceType: j.deviceType,
        brand: j.brand,
        model: j.model,
        serialOrImei: j.serialOrImei ?? undefined,
        accessories: j.accessories ?? undefined,
        physicalNotes: j.physicalNotes ?? undefined,
        serviceType: j.serviceType,
        softwareOsInstall: j.softwareOsInstall === 1,
        softwareDriversUpdates: j.softwareDriversUpdates === 1,
        softwareDataBackupRestore: j.softwareDataBackupRestore === 1,
        softwareAccountSetup: j.softwareAccountSetup === 1,
        softwarePerformanceTune: j.softwarePerformanceTune === 1,
        softwareThirdPartyApps: j.softwareThirdPartyApps === 1,
        softwareRequestedNotes: j.softwareRequestedNotes ?? undefined,
        softwareLicenseAttested: j.softwareLicenseAttested === 1,
        softwareInstallerSource: j.softwareInstallerSource ?? undefined,
        softwareInstallerSourceNote: j.softwareInstallerSourceNote ?? undefined,
        issueDescription: j.issueDescription,
        workflowReason: j.workflowReason,
        statusNote: j.statusNote ?? undefined,
        diagnosisNotes: j.diagnosisNotes ?? undefined,
        externalDiagnosis: j.externalDiagnosis ?? undefined,
        recommendedRepair: j.recommendedRepair ?? undefined,
        recommendationOption: j.recommendationOption ?? undefined,
        communicationStatus: j.communicationStatus,
        clientConversationNote: j.clientConversationNote ?? undefined,
        lastClientContactAt: j.lastClientContactAt ? new Date(j.lastClientContactAt) : undefined,
        partsNeeded: j.partsNeeded ?? undefined,
        externalTechBill: j.costEstimate ? String(j.costEstimate) : undefined,
        clientBill: j.finalCost ? String(j.finalCost) : undefined,
        vatApplicable: j.vatApplicable === 1,
        externalTechFee: j.externalTechFee ?? undefined,
        externalPaid: j.externalPaid === 1,
        externalPaidAt: j.externalPaidAt ? new Date(j.externalPaidAt) : undefined,
        externalPaidById: j.externalPaidById ?? undefined,
        externalPaymentRef: j.externalPaymentRef ?? undefined,
        clientApproved: j.clientApproved === 1,
        approvalDate: j.approvalDate ? new Date(j.approvalDate) : undefined,
        quotedAt: j.quotedAt ? new Date(j.quotedAt) : undefined,
        repairTimeline: j.repairTimeline ?? undefined,
        timelineMinMinutes: j.timelineMinMinutes ?? undefined,
        timelineMaxMinutes: j.timelineMaxMinutes ?? undefined,
        timelineConfidence: j.timelineConfidence ?? undefined,
        timelineNote: j.timelineNote ?? undefined,
        technicianNotes: j.technicianNotes ?? undefined,
        workDone: j.workDone ?? undefined,
        partsReplaced: j.partsReplaced ?? undefined,
        receivedAt: new Date(j.receivedAt),
        completedAt: j.completedAt ? new Date(j.completedAt) : undefined,
        closedAt: j.closedAt ? new Date(j.closedAt) : undefined,
        updatedAt: new Date(j.updatedAt),
        deliveredAt: j.deliveredAt ? new Date(j.deliveredAt) : undefined,
        deliveryMethod: j.deliveryMethod ?? undefined,
        deliveredTo: j.deliveredTo ?? undefined,
        invoiceNumber: j.invoiceNumber ?? undefined,
        invoiceIssuedAt: j.invoiceIssuedAt ? new Date(j.invoiceIssuedAt) : undefined,
        warrantyMonths: j.warrantyMonths ?? undefined,
        warrantyExpiresAt: j.warrantyExpiresAt ? new Date(j.warrantyExpiresAt) : undefined,
        quotationNumber: j.quotationNumber ?? undefined,
      },
    });
    imported++;
    console.log(`  job: ${j.jobNumber} (${j.id})`);
  } catch (e) {
    failed++;
    console.error(`  FAILED job ${j.jobNumber} (${j.id}): ${e.message}`);
  }
}

console.log(`\nDone. Imported: ${imported}, Failed: ${failed}`);
await prisma.$disconnect();