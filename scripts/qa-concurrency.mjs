#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const seedJob = await prisma.job.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!seedJob) {
    console.error("FAIL: no job found for concurrency test; seed data first.");
    process.exit(1);
  }

  const auditUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!auditUser) {
    console.error("FAIL: no ADMIN user found for audit writes.");
    process.exit(1);
  }

  const marker = `qa-concurrency-${Date.now()}`;

  await Promise.all([
    prisma.job.update({
      where: { id: seedJob.id },
      data: { technicianNotes: `Concurrent update A ${marker}` },
    }),
    prisma.job.update({
      where: { id: seedJob.id },
      data: { technicianNotes: `Concurrent update B ${marker}` },
    }),
    prisma.auditLog.create({
      data: {
        jobId: seedJob.id,
        userId: auditUser.id,
        action: "QA_CONCURRENCY_A",
        detail: marker,
      },
    }),
    prisma.auditLog.create({
      data: {
        jobId: seedJob.id,
        userId: auditUser.id,
        action: "QA_CONCURRENCY_B",
        detail: marker,
      },
    }),
  ]);

  const logs = await prisma.auditLog.findMany({
    where: {
      jobId: seedJob.id,
      action: { in: ["QA_CONCURRENCY_A", "QA_CONCURRENCY_B"] },
      detail: marker,
    },
  });

  if (logs.length !== 2) {
    console.error("FAIL: expected 2 concurrency audit entries, got", logs.length);
    process.exit(1);
  }

  console.log("OK: concurrency sanity check passed.");
} catch (error) {
  console.error("FAIL:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
