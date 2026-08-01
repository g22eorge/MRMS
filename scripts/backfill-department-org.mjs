// Backfill Department.orgId for legacy departments created before the column
// existed (M15). Assigns every department with a null orgId to a target org.
//
// Usage:
//   DATABASE_URL=... node scripts/backfill-department-org.mjs <orgId>          # apply
//   DATABASE_URL=... node scripts/backfill-department-org.mjs <orgId> --dry-run
//
// For the single-tenant care deployment, pass the care org id — all existing
// departments belong to it. Multi-tenant deployments should backfill per org
// (or leave legacy nulls, which the app still shows transitionally).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const orgId = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!orgId) {
  console.error("Usage: node scripts/backfill-department-org.mjs <orgId> [--dry-run]");
  process.exit(1);
}

const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true } });
if (!org) {
  console.error(`Organization ${orgId} not found.`);
  process.exit(1);
}

const legacy = await prisma.department.findMany({ where: { orgId: null }, select: { id: true, name: true, code: true } });
console.log(`${legacy.length} department(s) with no orgId → org "${org.name}" (${org.id})`);
for (const d of legacy) console.log(`  - ${d.code} ${d.name}`);

if (dryRun) {
  console.log("Dry run — no changes written.");
} else {
  const result = await prisma.department.updateMany({ where: { orgId: null }, data: { orgId } });
  console.log(`Updated ${result.count} department(s).`);
}

await prisma.$disconnect();
