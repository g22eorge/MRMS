// Idempotent: ensure every job carries at least one audit entry (real jobs get a
// JOB_CREATED log on intake; some fixtures/imports don't). Safe to re-run.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const jobs = await prisma.job.findMany({
    where: { auditLogs: { none: {} } },
    select: { id: true, jobNumber: true, orgId: true, createdById: true },
  });
  if (jobs.length === 0) {
    console.log("OK: all jobs already have an audit log.");
    return;
  }
  for (const job of jobs) {
    await prisma.auditLog.create({
      data: {
        jobId: job.id,
        orgId: job.orgId,
        userId: job.createdById,
        action: "JOB_CREATED",
        detail: JSON.stringify({ backfilled: true, jobNumber: job.jobNumber }),
      },
    });
  }
  console.log(`Backfilled JOB_CREATED audit logs for ${jobs.length} job(s): ${jobs.map((j) => j.jobNumber).join(", ")}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
