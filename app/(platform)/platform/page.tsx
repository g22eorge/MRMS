import { prisma } from "@/lib/prisma";
import { getTotalRevenue, getMonthlyRevenue } from "@/lib/billing-events";
import { formatMoney } from "@/lib/currency";
import type { OrgModule } from "@prisma/client";

import { MODULE_LABELS, MODULE_MIN_PLAN, recommendPlanForModules } from "@/lib/module-catalog";
import { EIS_ORG_ID } from "@/lib/org";
import { getEffectivePlanPrices } from "@/lib/plan-prices";
import { OrgTable } from "./OrgTable";
import type { OrgRow } from "./OrgTable";
import { PlatformOverview } from "./PlatformOverview";
import type { AttentionItem } from "./PlatformOverview";

export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  const [rawOrgs, totalRevenue, monthRevenue, planPrices, recentOrgIds, grants, errorsToday] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, slug: true, plan: true, billingStatus: true,
        trialEndsAt: true, planRenewsAt: true, isActive: true, createdAt: true, deletionRequestedAt: true,
        _count: { select: { users: true, jobs: true } },
      },
    }).catch(() =>
      prisma.organization.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, slug: true, isActive: true, createdAt: true, _count: { select: { users: true, jobs: true } } },
      }).then((rows) => rows.map((r) => ({ ...r, plan: "STARTER" as const, billingStatus: "TRIALING" as const, trialEndsAt: null, planRenewsAt: null })))
    ),
    getTotalRevenue(),
    getMonthlyRevenue(),
    getEffectivePlanPrices().catch(() => ({} as Record<string, number>)),
    // Organisations with a session touched in the last seven days. Null when
    // the query fails, so the figure reads as unknown rather than as zero.
    prisma.$queryRaw<Array<{ orgId: string }>>`
      SELECT DISTINCT u."orgId" AS "orgId"
      FROM "Session" s
      JOIN "User" u ON u."id" = s."userId"
      WHERE s."updatedAt" >= ${new Date(Date.now() - 7 * 86_400_000)} AND u."orgId" IS NOT NULL
    `.then((rows) => rows.map((row) => row.orgId)).catch(() => null),
    prisma.orgModuleGrant.findMany({ select: { orgId: true, module: true } }).catch(() => []),
    prisma.errorEvent.aggregate({ where: { lastSeenAt: { gte: new Date(Date.now() - 86_400_000) } }, _sum: { count: true } })
      .then((r) => r._sum.count ?? 0).catch(() => 0),
  ]);

  // Serialise dates so the client component receives plain objects
  const orgs: OrgRow[] = rawOrgs.map((o) => ({
    ...o,
    trialEndsAt: o.trialEndsAt ?? null,
    planRenewsAt: o.planRenewsAt ?? null,
  }));

  // ── Derived stats ────────────────────────────────────────────────────────────
  // Everything on this page that counts or warns is about organisations that
  // are still switched on. A deactivated one keeps whatever billing status it
  // had, so it used to raise a "past due" alert nobody could act on and be
  // counted among paying customers. The table below still receives every
  // organisation and lists the deactivated ones under their own tab.
  const liveOrgs = orgs.filter((o) => o.isActive);
  const deactivatedOrgs = orgs.length - liveOrgs.length;
  const totalUsers  = liveOrgs.reduce((s, o) => s + o._count.users, 0);

  const now = Date.now();
  const DAY = 86_400_000;
  const trialEnd = (o: OrgRow) => (o.trialEndsAt ? new Date(o.trialEndsAt).getTime() : null);
  const daysBetween = (from: number, to: number) => Math.max(1, Math.ceil(Math.abs(to - from) / DAY));

  // Money. Recurring is what the plans of paying organisations add up to at
  // the prices in force; collected is what has actually been received.
  // The operator's own organisation is on Enterprise permanently and pays
  // nothing, so it is not a customer: it is left out of recurring revenue, the
  // paying count and the past-due list. It still counts as an organisation, a
  // plan and a source of activity everywhere else on the page.
  const customers = liveOrgs.filter((o) => o.id !== EIS_ORG_ID);
  const paying = customers.filter((o) => o.billingStatus === "ACTIVE");
  const pastDueOrgs = customers.filter((o) => o.billingStatus === "PAST_DUE");
  const priceOf = (plan: string) => planPrices[plan] ?? 0;
  const mrr = paying.reduce((sum, o) => sum + priceOf(o.plan), 0);
  const atRiskMrr = pastDueOrgs.reduce((sum, o) => sum + priceOf(o.plan), 0);

  // Trials: running, about to end, and ended without anyone deciding.
  const trialing = liveOrgs.filter((o) => o.billingStatus === "TRIALING");
  const trialsExpired = trialing.filter((o) => { const end = trialEnd(o); return end !== null && end <= now; });
  const trialsRunning = trialing.filter((o) => { const end = trialEnd(o); return end === null || end > now; });
  const trialsEndingSoon = trialsRunning.filter((o) => { const end = trialEnd(o); return end !== null && end - now < 7 * DAY; });

  const attention: AttentionItem[] = [
    ...pastDueOrgs.map((o) => ({
      id: o.id, name: o.name, rank: 0 as const, reason: "Past due",
      detail: `${o.plan.charAt(0)}${o.plan.slice(1).toLowerCase()} plan · ${formatMoney(priceOf(o.plan))} a month`,
    })),
    ...trialsExpired.map((o) => ({
      id: o.id, name: o.name, rank: 1 as const, reason: "Trial ended",
      detail: `${daysBetween(trialEnd(o) as number, now)} days ago, not converted or closed`,
    })),
    ...trialsEndingSoon.map((o) => ({
      id: o.id, name: o.name, rank: 2 as const, reason: "Trial ending",
      detail: `in ${daysBetween(now, trialEnd(o) as number)} days`,
    })),
  ];

  // An organisation whose modules need a higher plan than the one it is on.
  // Nothing stops the two drifting apart (a plan changed here, or modules
  // carried over from an earlier arrangement), and until now nothing said so.
  const PLAN_RANK = ["STARTER", "STANDARD", "GROWTH", "PREMIUM", "ENTERPRISE"];
  const modulesByOrg = new Map<string, OrgModule[]>();
  for (const grant of grants) modulesByOrg.set(grant.orgId, [...(modulesByOrg.get(grant.orgId) ?? []), grant.module]);
  const planLabel = (plan: string) => `${plan.charAt(0)}${plan.slice(1).toLowerCase()}`;
  for (const o of customers) {
    const modules = modulesByOrg.get(o.id) ?? [];
    const needed = recommendPlanForModules(modules);
    if (PLAN_RANK.indexOf(needed) <= PLAN_RANK.indexOf(o.plan)) continue;
    const above = modules.filter((m) => PLAN_RANK.indexOf(MODULE_MIN_PLAN[m]) > PLAN_RANK.indexOf(o.plan));
    attention.push({
      id: o.id, name: o.name, rank: 2, reason: "Plan below modules",
      detail: `On ${planLabel(o.plan)}; ${above.map((m) => MODULE_LABELS[m]).join(", ")} ${above.length === 1 ? "needs" : "need"} ${planLabel(needed)}`,
    });
  }

  // A workspace whose administrator asked for deletion. It is switched off,
  // so it is not among the live organisations above, but the 30 days the
  // privacy policy gives are running.
  for (const raw of rawOrgs) {
    const requested = "deletionRequestedAt" in raw ? (raw.deletionRequestedAt as Date | null) : null;
    if (!requested) continue;
    const daysLeft = 30 - Math.floor((now - new Date(requested).getTime()) / DAY);
    attention.push({
      id: raw.id, name: raw.name, rank: daysLeft <= 7 ? 0 : 1, reason: "Deletion requested",
      detail: daysLeft > 0 ? `Delete within ${daysLeft} ${daysLeft === 1 ? "day" : "days"}, or reactivate to cancel` : "The 30 days have passed",
    });
  }

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const newThisMonth = liveOrgs.filter((o) => new Date(o.createdAt).getTime() >= startOfMonth).length;
  const liveIds = new Set(liveOrgs.map((o) => o.id));
  const signedInThisWeek = recentOrgIds === null ? null : recentOrgIds.filter((id) => liveIds.has(id)).length;
  const planMix = (["STARTER", "STANDARD", "GROWTH", "PREMIUM", "ENTERPRISE"] as const).map((plan) => ({
    plan,
    count: liveOrgs.filter((o) => o.plan === plan).length,
  }));

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-xl font-bold text-[var(--ink)]">Platform</h1>
        <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
          {liveOrgs.length} active {liveOrgs.length === 1 ? "organisation" : "organisations"}
          {deactivatedOrgs > 0 ? ` · ${deactivatedOrgs} deactivated` : ""}
        </p>
      </div>

      <PlatformOverview
        attention={attention}
        mrr={mrr}
        payingCount={paying.length}
        atRiskMrr={atRiskMrr}
        collectedThisMonth={monthRevenue}
        collectedAllTime={totalRevenue}
        trialsRunning={trialsRunning.length}
        trialsEndingSoon={trialsEndingSoon.length}
        trialsExpired={trialsExpired.length}
        signedInThisWeek={signedInThisWeek}
        activeOrgCount={liveOrgs.length}
        totalUsers={totalUsers}
        newThisMonth={newThisMonth}
        planMix={planMix}
        errorsToday={errorsToday}
      />

      {/* ── Org table (client component — search, filter, inline actions) ── */}
      <OrgTable orgs={orgs} />

    </div>
  );
}
