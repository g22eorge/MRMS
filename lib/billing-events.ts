import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

/**
 * Subscription billing events from the payment provider.
 *
 * `BillingEvent` is now a real model rather than a table this module created on
 * demand, so all access goes through Prisma. Two behaviours are deliberate:
 *
 *  - Organisation names are fetched in a second query rather than by a join.
 *    The production table carries no foreign key to Organization and inventing
 *    one would also invent cascade semantics for financial history.
 *  - The month boundary is computed in JS. The previous SQL used SQLite's
 *    `date('now', 'start of month')`, which does not exist in Postgres.
 */

export interface BillingEvent {
  id: string;
  orgId: string;
  orgName?: string;
  event: string;
  amount: number;
  currency: string;
  status: string;
  /** Pesapal confirmation_code — stored in the legacy flwTxId column. */
  confirmationCode: string | null;
  txRef: string | null;
  plan: string | null;
  createdAt: Date;
}

/** Only completed charges count as revenue. */
const REVENUE_WHERE = { status: "successful", event: "charge.completed" } as const;

export async function recordBillingEvent(params: {
  orgId: string;
  event: string;
  amount: number;
  currency: string;
  status: string;
  confirmationCode?: string | null;
  txRef?: string | null;
  plan?: string | null;
  /** If provided, ensures repeated webhook deliveries don't duplicate events. */
  idempotencyKey?: string | null;
}): Promise<void> {
  const id = params.idempotencyKey
    ? createHash("sha256").update(params.idempotencyKey).digest("hex").slice(0, 32)
    : randomUUID().replace(/-/g, "");

  // The id doubles as the idempotency key, so a redelivered webhook is a no-op
  // rather than a duplicate charge record.
  await prisma.billingEvent.upsert({
    where: { id },
    create: {
      id,
      orgId: params.orgId,
      event: params.event,
      amount: params.amount,
      currency: params.currency,
      status: params.status,
      flwTxId: params.confirmationCode ?? null,
      txRef: params.txRef ?? null,
      plan: params.plan ?? null,
    },
    update: {},
  });
}

type BillingEventRow = {
  id: string;
  orgId: string;
  event: string;
  amount: number;
  currency: string;
  status: string;
  flwTxId: string | null;
  txRef: string | null;
  plan: string | null;
  createdAt: Date;
};

async function withOrgNames(rows: BillingEventRow[]): Promise<BillingEvent[]> {
  const orgIds = [...new Set(rows.map((r) => r.orgId))];
  const orgs = orgIds.length
    ? await prisma.organization.findMany({
        where: { id: { in: orgIds } },
        select: { id: true, name: true },
      })
    : [];
  const names = new Map(orgs.map((o) => [o.id, o.name]));

  return rows.map((r) => ({
    id: r.id,
    orgId: r.orgId,
    orgName: names.get(r.orgId),
    event: r.event,
    amount: Number(r.amount),
    currency: r.currency,
    status: r.status,
    confirmationCode: r.flwTxId,
    txRef: r.txRef,
    plan: r.plan,
    createdAt: r.createdAt,
  }));
}

export async function getRecentBillingEvents(limit = 100): Promise<BillingEvent[]> {
  try {
    const rows = await prisma.billingEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return withOrgNames(rows);
  } catch {
    return [];
  }
}

export async function getBillingEventsByOrg(orgId: string): Promise<BillingEvent[]> {
  try {
    const rows = await prisma.billingEvent.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return withOrgNames(rows);
  } catch {
    return [];
  }
}

export async function getTotalRevenue(): Promise<number> {
  try {
    const agg = await prisma.billingEvent.aggregate({
      where: REVENUE_WHERE,
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  } catch {
    return 0;
  }
}

export async function getMonthlyRevenue(): Promise<number> {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const agg = await prisma.billingEvent.aggregate({
      where: { ...REVENUE_WHERE, createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  } catch {
    return 0;
  }
}
