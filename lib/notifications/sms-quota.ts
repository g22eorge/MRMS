import { prisma } from "@/lib/prisma";
import { OrgPlan } from "@prisma/client";

export const SMS_PLAN_QUOTAS: Record<OrgPlan, number> = {
  STARTER:    200,
  STANDARD:   500,
  GROWTH:    1000,
  PREMIUM:   3000,
  ENTERPRISE: 5000,
};

/**
 * SmsUsage is a model now. It used to be created here at runtime with
 * `CREATE TABLE IF NOT EXISTS` and addressed through raw SQL, which put a
 * live table outside migrations, the drift report and /api/admin/db-health —
 * and the unquoted column names meant Postgres folded them to lowercase, so the
 * one query that selected them by name read back `undefined` for every row.
 */
function thisMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export async function getSmsUsage(orgId: string, year?: number, month?: number): Promise<number> {
  const period = thisMonth();
  const y = year ?? period.year;
  const m = month ?? period.month;
  try {
    const row = await prisma.smsUsage.findUnique({
      where: { orgId_year_month: { orgId, year: y, month: m } },
      select: { count: true },
    });
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

export async function incrementSmsUsage(orgId: string): Promise<void> {
  const { year, month } = thisMonth();
  await prisma.smsUsage.upsert({
    where: { orgId_year_month: { orgId, year, month } },
    create: { orgId, year, month, count: 1 },
    update: { count: { increment: 1 } },
  });
}

export interface SmsQuota {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  plan: string;
  percentUsed: number;
}

export async function checkSmsQuota(orgId: string): Promise<SmsQuota> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true },
    });
    const plan = (org?.plan ?? "STARTER") as OrgPlan;
    const limit = SMS_PLAN_QUOTAS[plan] ?? 200;
    const used = await getSmsUsage(orgId);
    const remaining = Math.max(0, limit - used);
    return {
      allowed: used < limit,
      used,
      limit,
      remaining,
      plan,
      percentUsed: limit > 0 ? Math.round((used / limit) * 100) : 0,
    };
  } catch {
    return { allowed: true, used: 0, limit: 200, remaining: 200, plan: "STARTER", percentUsed: 0 };
  }
}

export async function getAllOrgsSmsBudgetThisMonth(): Promise<
  Array<{ orgId: string; orgName: string; plan: string; count: number; limit: number }>
> {
  try {
    const { year, month } = thisMonth();
    const rows = await prisma.smsUsage.findMany({
      where: { year, month },
      orderBy: { count: "desc" },
    });
    if (!rows.length) return [];
    const orgs = await prisma.organization.findMany({
      where: { id: { in: rows.map((r) => r.orgId) } },
      select: { id: true, name: true, plan: true },
    });
    const byId = new Map(orgs.map((o) => [o.id, o]));
    return rows.map((r) => {
      const org = byId.get(r.orgId);
      const plan = org?.plan ?? "STARTER";
      return {
        orgId: r.orgId,
        orgName: org?.name ?? "Unknown",
        plan,
        count: r.count,
        limit: SMS_PLAN_QUOTAS[plan as OrgPlan] ?? 200,
      };
    });
  } catch {
    return [];
  }
}
