#!/usr/bin/env node
/**
 * Lightweight tenant scoping smoke test for scopedDb/orgDb.
 * Complements tests/e2e/tenant-isolation.spec.ts at the ORM layer.
 */
import { PrismaClient } from "@prisma/client";

import { scopedDb } from "../lib/db";

const prisma = new PrismaClient();

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`OK: ${message}`);
}

try {
  const suffix = Date.now();
  const orgA = await prisma.organization.create({
    data: { name: `QA Scope A ${suffix}`, slug: `qa-scope-a-${suffix}` },
  });
  const orgB = await prisma.organization.create({
    data: { name: `QA Scope B ${suffix}`, slug: `qa-scope-b-${suffix}` },
  });

  const clientB = await prisma.client.create({
    data: {
      orgId: orgB.id,
      fullName: "QA Scoped Secret Client",
      phone: `0802999${String(suffix).slice(-4)}`,
    },
  });

  const dbA = scopedDb(orgA.id);
  const leaked = await dbA.client.findUnique({ where: { id: clientB.id }, select: { id: true } });
  if (leaked) {
    fail("scopedDb allowed cross-org findUnique access");
  } else {
    ok("scopedDb blocked cross-org findUnique access");
  }

  const visible = await dbA.client.findMany({
    where: { id: clientB.id },
    select: { id: true },
  });
  if (visible.length > 0) {
    fail("scopedDb findMany leaked another org's client");
  } else {
    ok("scopedDb findMany stayed org-local");
  }

  // Client.orgId is required with onDelete: Cascade, so removing the orgs takes
  // their clients with them — no need to delete clientB first, and no orphan is
  // left behind if this teardown is interrupted.
  await prisma.organization.delete({ where: { id: orgA.id } });
  await prisma.organization.delete({ where: { id: orgB.id } });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
