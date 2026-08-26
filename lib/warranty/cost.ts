import { prisma } from "@/lib/prisma";

/**
 * What it costs to honour warranty claims.
 *
 * The cost of a claim is whatever the follow-up repair consumed, because that
 * repair is the thing you did for free. Three components, all recorded already:
 *
 *   parts     — reservations consumed on the warranty job, at the cost snapshot
 *               taken when they left the shelf, not today's price
 *   payouts   — technician payouts recorded against that job
 *   external  — the external technician's fee, where the work went outside
 *
 * Only RESOLVED claims with a linked repair are counted. A resolved claim with
 * no repair attached cost nothing traceable, and an open one is not settled yet.
 *
 * `billedAnyway` is the check on the rest: a warranty repair that charged the
 * customer is either a part-charge you meant to make or a claim someone honoured
 * on paper and billed in practice. Either way it belongs in the total's footnote
 * rather than silently inside it.
 */

export type WarrantyCostSummary = {
  claimsHonoured: number;
  partsCost: number;
  payoutCost: number;
  externalCost: number;
  totalCost: number;
  averagePerClaim: number;
  /** Warranty repairs that still billed the customer, and what they billed. */
  billedAnyway: { count: number; amount: number };
};

export const WARRANTY_COST_PERIODS = {
  "30d": { label: "Last 30 days", days: 30 },
  "90d": { label: "Last 90 days", days: 90 },
  "12m": { label: "Last 12 months", days: 365 },
  all: { label: "All time", days: null },
} as const;

export type WarrantyCostPeriod = keyof typeof WARRANTY_COST_PERIODS;

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function warrantyCostSummary(
  orgId: string,
  period: WarrantyCostPeriod = "90d",
  now: Date = new Date(),
): Promise<WarrantyCostSummary> {
  const days = WARRANTY_COST_PERIODS[period]?.days ?? null;
  const since = days === null ? null : new Date(now.getTime() - days * 86_400_000);

  // Honoured claims are dated by when they were settled, not raised — the cost
  // lands in the period you agreed to bear it.
  const claims = await prisma.warrantyClaim.findMany({
    where: {
      orgId,
      status: "RESOLVED",
      warrantyJobId: { not: null },
      ...(since ? { closedAt: { gte: since } } : {}),
    },
    select: { warrantyJobId: true },
  });

  const jobIds = claims.map((c) => c.warrantyJobId).filter((id): id is string => Boolean(id));
  const empty: WarrantyCostSummary = {
    claimsHonoured: 0, partsCost: 0, payoutCost: 0, externalCost: 0,
    totalCost: 0, averagePerClaim: 0, billedAnyway: { count: 0, amount: 0 },
  };
  if (jobIds.length === 0) return empty;

  const [reservations, payouts, jobs] = await Promise.all([
    // PartReservation carries no orgId of its own; scope through the job.
    prisma.partReservation.findMany({
      where: { jobId: { in: jobIds }, status: "CONSUMED", job: { orgId } },
      select: { quantity: true, unitCostSnapshot: true },
    }),
    prisma.technicianPayout.aggregate({
      where: { orgId, jobId: { in: jobIds } },
      _sum: { amount: true },
    }),
    prisma.job.findMany({
      where: { id: { in: jobIds }, orgId },
      select: { externalTechFee: true, clientBill: true },
    }),
  ]);

  return computeWarrantyCost({
    claimsHonoured: jobIds.length,
    reservations,
    payoutTotal: payouts._sum.amount ?? 0,
    jobs,
  });
}

/**
 * The arithmetic, separated from the queries so it can be tested directly.
 * Money maths that only runs behind a database is money maths nobody checks.
 */
export function computeWarrantyCost(input: {
  claimsHonoured: number;
  reservations: Array<{ quantity: number; unitCostSnapshot: number | null }>;
  payoutTotal: number;
  jobs: Array<{ externalTechFee: number | null; clientBill: number | null }>;
}): WarrantyCostSummary {
  const { claimsHonoured, reservations, payoutTotal, jobs } = input;
  if (claimsHonoured <= 0) {
    return {
      claimsHonoured: 0, partsCost: 0, payoutCost: 0, externalCost: 0,
      totalCost: 0, averagePerClaim: 0, billedAnyway: { count: 0, amount: 0 },
    };
  }

  const partsCost = reservations.reduce(
    (sum, r) => sum + r.quantity * (r.unitCostSnapshot ?? 0),
    0,
  );
  const externalCost = jobs.reduce((sum, j) => sum + (j.externalTechFee ?? 0), 0);
  const billed = jobs.filter((j) => (j.clientBill ?? 0) > 0);
  const totalCost = partsCost + payoutTotal + externalCost;

  return {
    claimsHonoured,
    partsCost: round2(partsCost),
    payoutCost: round2(payoutTotal),
    externalCost: round2(externalCost),
    totalCost: round2(totalCost),
    averagePerClaim: round2(totalCost / claimsHonoured),
    billedAnyway: {
      count: billed.length,
      amount: round2(billed.reduce((s, j) => s + (j.clientBill ?? 0), 0)),
    },
  };
}
