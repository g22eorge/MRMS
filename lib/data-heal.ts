import { PrismaClient } from "@prisma/client";

type RunDataHealOptions = {
  dryRun?: boolean;
  actorUserId?: string;
  limit?: number;
};

export async function runDataHeal(prisma: PrismaClient, options: RunDataHealOptions = {}) {
  const dryRun = options.dryRun === true;
  const limit = options.limit ?? 250;

  // 1) Normalize legacy statuses (external workflow reduction)
  // - assignment -> REFERRED
  // - external-progress -> IN_REPAIR
  if (!dryRun) {
    try {
      await prisma.job.updateMany({
        where: { status: { in: ["PENDING_EXTERNAL_ASSIGNMENT", "ASSIGNED_ONE_TIME_EXTERNAL"] } },
        data: { status: "REFERRED" },
      });
      await prisma.job.updateMany({
        where: { status: { in: ["IN_EXTERNAL_REPAIR", "WAITING_FOR_PARTS", "RETURNED_FROM_EXTERNAL"] } },
        data: { status: "IN_REPAIR" },
      });
    } catch {
      // If the DB is behind schema (no REFERRED yet), skip silently.
    }
  }

  const jobsWithoutAudit = await prisma.job.findMany({
    where: { auditLogs: { none: {} } },
    select: {
      id: true,
      jobNumber: true,
      orgId: true,
      createdById: true,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  let auditLogsCreated = 0;
  if (!dryRun) {
    for (const job of jobsWithoutAudit) {
      await prisma.auditLog.create({
        data: {
          orgId: job.orgId,
          jobId: job.id,
          userId: job.createdById,
          action: "JOB_CREATED",
          detail: JSON.stringify({
            source: "data-heal",
            backfilled: true,
            reason: "missing initial audit log",
          }),
        },
      });
      auditLogsCreated += 1;
    }
  }

  const candidates = await prisma.job.findMany({
    where: {
      OR: [{ brand: "Unknown" }, { model: "Unknown" }, { deviceType: "OTHER" }],
    },
    include: {
      device: {
        select: {
          brand: true,
          model: true,
          deviceType: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  // Stock-ledger hygiene: older PartStockTransaction rows predate the nullable
  // orgId column (and a few write paths used to omit it), leaving movements
  // unscoped. Derive orgId from the owning Part — the authoritative parent — so
  // org-scoped ledger queries see a complete picture. Idempotent; safe to repeat.
  // (Mirrors scripts/backfill-stock-txn-org.ts, but runnable in production via
  // the admin data-heal endpoint, where the Turso env exists.)
  // NB: runs BEFORE the no-job-candidates early return below, otherwise it would
  // be skipped on any org whose jobs need no device-field healing.
  let stockTxnOrgIdFixed = 0;
  let stockTxnMissingOrgId = 0;
  try {
    const unscoped = await prisma.partStockTransaction.findMany({
      where: { orgId: null },
      select: { id: true, partId: true },
      take: limit,
    });
    stockTxnMissingOrgId = unscoped.length;

    if (!dryRun && unscoped.length > 0) {
      const partOrg = new Map<string, string | null>();
      for (const row of unscoped) {
        if (!partOrg.has(row.partId)) {
          const part = await prisma.part.findUnique({
            where: { id: row.partId },
            select: { orgId: true },
          });
          partOrg.set(row.partId, part?.orgId ?? null);
        }
        const orgId = partOrg.get(row.partId);
        if (!orgId) continue; // orphan or org-less part — leave it for inspection
        await prisma.partStockTransaction.update({ where: { id: row.id }, data: { orgId } });
        stockTxnOrgIdFixed++;
      }
    }
  } catch {
    // Legacy deployments whose Prisma client predates the column: skip silently.
  }

  if (candidates.length === 0) {
    return {
      ok: true,
      dryRun,
      checked: 0,
      fixed: 0,
      pending: 0,
      auditLogsCreated,
      jobsMissingAuditLogs: dryRun ? jobsWithoutAudit.length : 0,
      stockTxnMissingOrgId,
      stockTxnOrgIdFixed,
      changes: [],
    };
  }

  const jobIds = candidates.map((job) => job.id);
  const linkedRequests = await prisma.repairRequest.findMany({
    where: { linkedJobId: { in: jobIds } },
    select: {
      linkedJobId: true,
      brand: true,
      model: true,
      deviceType: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const requestByJobId = new Map<string, (typeof linkedRequests)[number]>();
  for (const req of linkedRequests) {
    if (!req.linkedJobId) continue;
    if (!requestByJobId.has(req.linkedJobId)) {
      requestByJobId.set(req.linkedJobId, req);
    }
  }

  const actorUserId =
    options.actorUserId
    ?? (await prisma.user.findFirst({ where: { role: "ADMIN", isActive: true }, select: { id: true } }))?.id
    ?? null;

  const changes: Array<{
    id: string;
    jobNumber: string;
    from: { brand: string; model: string; deviceType: string };
    to: { brand: string; model: string; deviceType: string };
  }> = [];

  for (const job of candidates) {
    const req = requestByJobId.get(job.id);
    const deviceBrand = job.device?.brand?.trim() || null;
    const reqBrand = req?.brand?.trim() || null;
    const deviceModel = job.device?.model?.trim() || null;
    const reqModel = req?.model?.trim() || null;
    const deviceType = job.device?.deviceType;
    const reqType = req?.deviceType;

    const nextBrand = job.brand === "Unknown" ? (deviceBrand || reqBrand || job.brand) : job.brand;
    const nextModel = job.model === "Unknown" ? (deviceModel || reqModel || job.model) : job.model;
    const nextDeviceType =
      job.deviceType === "OTHER"
        ? (deviceType && deviceType !== "OTHER" ? deviceType : reqType && reqType !== "OTHER" ? reqType : job.deviceType)
        : job.deviceType;

    const changed = nextBrand !== job.brand || nextModel !== job.model || nextDeviceType !== job.deviceType;
    if (!changed) continue;

    changes.push({
      id: job.id,
      jobNumber: job.jobNumber,
      from: { brand: job.brand, model: job.model, deviceType: job.deviceType },
      to: { brand: nextBrand, model: nextModel, deviceType: nextDeviceType },
    });

    if (dryRun) continue;

    await prisma.job.update({
      where: { id: job.id },
      data: { brand: nextBrand, model: nextModel, deviceType: nextDeviceType },
    });

    if (actorUserId) {
      await prisma.auditLog.create({
        data: {
          jobId: job.id,
          userId: actorUserId,
          action: "DATA_HEAL_JOB_DEVICE_FIELDS",
          detail: JSON.stringify({
            from: { brand: job.brand, model: job.model, deviceType: job.deviceType },
            to: { brand: nextBrand, model: nextModel, deviceType: nextDeviceType },
            source: "data-heal",
          }),
        },
      });
    }
  }

  const pending = await prisma.job.count({
    where: { OR: [{ brand: "Unknown" }, { model: "Unknown" }, { deviceType: "OTHER" }] },
  });

  return {
    ok: true,
    dryRun,
    checked: candidates.length,
    fixed: changes.length,
    pending,
    auditLogsCreated,
    jobsMissingAuditLogs: dryRun ? jobsWithoutAudit.length : 0,
    stockTxnMissingOrgId,
    stockTxnOrgIdFixed,
    changes: changes.slice(0, 50),
  };
}
