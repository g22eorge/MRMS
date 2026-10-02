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

  // Paid-in-full invoices stranded as ISSUED (balance 0, still listed as
  // collectable). Rewrites used to persist totals without recomputing paid
  // state; re-syncing flips them PAID and mirrors the job to paid.
  // Detection reads payment ROWS, not the stored paidAmount (which is exactly
  // what drifted) — then sync recomputes authoritatively.
  const stuckCandidates = await prisma.invoice.findMany({
    where: { status: "ISSUED" },
    select: { id: true, orgId: true, invoiceNumber: true, totalAmount: true, currency: true, exchangeRateToBase: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  const { toBaseAmount } = await import("@/lib/currency");
  const orgBase = new Map<string, string>();
  async function baseCurrencyOf(orgId: string | null) {
    if (!orgId) return "UGX";
    const hit = orgBase.get(orgId);
    if (hit) return hit;
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { baseCurrency: true } }).catch(() => null);
    const base = org?.baseCurrency ?? "UGX";
    orgBase.set(orgId, base);
    return base;
  }
  const stuckPayments = stuckCandidates.length > 0
    ? await prisma.payment.findMany({
        where: { invoiceId: { in: stuckCandidates.map((c) => c.id) } },
        select: { invoiceId: true, amount: true, currency: true, exchangeRateToBase: true, kind: true },
      })
    : [];
  const paymentsByInvoice = new Map<string, typeof stuckPayments>();
  for (const p of stuckPayments) {
    const key = p.invoiceId ?? "";
    const list = paymentsByInvoice.get(key) ?? [];
    list.push(p);
    paymentsByInvoice.set(key, list);
  }
  let invoicesResynced = 0;
  const resyncedNumbers: string[] = [];
  for (const inv of stuckCandidates) {
    const base = await baseCurrencyOf(inv.orgId);
    const totalBase = toBaseAmount({
      amount: inv.totalAmount, currency: inv.currency, baseCurrency: base, exchangeRateToBase: inv.exchangeRateToBase,
    });
    const paidBase = (paymentsByInvoice.get(inv.id) ?? []).reduce((sum, p) => {
      const signed = (p.kind === "REFUND" ? -1 : 1) * toBaseAmount({
        amount: p.amount, currency: p.currency, baseCurrency: base, exchangeRateToBase: p.exchangeRateToBase,
      });
      return sum + signed;
    }, 0);
    if (!(totalBase > 0 && paidBase >= totalBase)) continue;
    resyncedNumbers.push(inv.invoiceNumber);
    if (dryRun) continue;
    try {
      const { syncInvoicePaymentState } = await import("@/lib/commercial/payment-sync");
      await prisma.$transaction(async (tx) => {
        await syncInvoicePaymentState(tx, {
          orgId: inv.orgId,
          invoiceId: inv.id,
          baseCurrency: base,
        });
      });
      invoicesResynced += 1;
    } catch (error) {
      console.error(`[data-heal] resync invoice ${inv.invoiceNumber} failed:`, error);
    }
  }


  // Link legacy complaints to their client: rows predating the client link
  // match by phone, which leaks across shared/company lines. Link only when
  // exactly one client in the org holds the number — ambiguity keeps the
  // legacy phone match rather than misattributing.
  let complaintsLinked = 0;
  let complaintsAmbiguous = 0;
  try {
    const unlinked = await prisma.complaint.findMany({
      where: { clientId: null, clientPhone: { not: "" } },
      select: { id: true, orgId: true, clientPhone: true },
      take: limit,
    });
    const owners = new Map<string, string | null>();
    for (const row of unlinked) {
      const key = `${row.orgId}::${row.clientPhone}`;
      if (!owners.has(key)) {
        const matches = await prisma.client.findMany({
          where: { orgId: row.orgId, phone: row.clientPhone },
          select: { id: true },
          take: 2,
        });
        owners.set(key, matches.length === 1 ? matches[0].id : null);
        if (matches.length !== 1) complaintsAmbiguous += 1;
      }
      const ownerId = owners.get(key);
      if (!ownerId) continue;
      complaintsLinked += 1;
      if (dryRun) continue;
      await prisma.complaint.update({ where: { id: row.id }, data: { clientId: ownerId } });
    }
  } catch {
    // DB behind schema (no clientId column yet) — skip silently.
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
      invoicesResynced,
      resyncedInvoiceNumbers: resyncedNumbers.slice(0, 50),
      complaintsLinked: 0,
      complaintsAmbiguous: 0,
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
    invoicesResynced,
    resyncedInvoiceNumbers: resyncedNumbers.slice(0, 50),
    complaintsLinked,
    complaintsAmbiguous,
    changes: changes.slice(0, 50),
  };
}
