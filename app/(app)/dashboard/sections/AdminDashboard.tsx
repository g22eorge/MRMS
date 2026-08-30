import Link from "next/link";
import React from "react";

import { MobileHomeDashboard } from "@/components/mobile/MobileHomeDashboard";
import { COMMUNICATIONS_ROUTES } from "@/lib/communications/routes";
import { formatMoneyCompact } from "@/lib/currency";
import { routeLabel } from "@/lib/nav/registry";
import { can } from "@/lib/permissions";

import { loadAdminDashboardData } from "./admin-data";
import { Card, CardHead, SectionHead, type PermissionUser } from "./shared";

/** ── Admin dashboard ───────────────────────────────────────────────────── */

export async function AdminDashboard({
  userName,
  orgId,
  permissionUser,
}: {
  userName: string;
  orgId: string | null;
  permissionUser: PermissionUser;
}) {
  const data = await loadAdminDashboardData(orgId);
  const {
    currency, orgName, enabledModules, today, recentJobs,
    receivedToday, completedToday,
    intakePendingCount, cashTodayValue, cashYesterdayValue, salesTodayValue,
    expensesTodayValue,
    revenueTodayValue,
    outstandingValue, outstandingCount, completedUnpaidCount, jobsNeedingActionCount, awaitingApprovalCount,
    overdueJobsCount, inRepairCount, readyForPickupCount, jobsNoClientUpdateCount,
    failedOutboxCount, statusCount, statusData, conversionRate,
    repairsMtd, productsMtd, corporateMtd, totalMtd, revenueTrend,
    totalBankBalance, payablesValue, expensesValue, technicianPayoutsDue,
    leadCountMap, lowStockItems, outOfStockCount, techLeaderboard,
  } = data;

  // Mobile has no floating FAB — New Job is the primary tile here (and in the
  // Jobs list header). The rest are the secondary money shortcuts.
  const quickActions = [
    can.createJob(permissionUser) && enabledModules.has("JOBS") && {
      href: "/jobs/new",
      label: routeLabel("/jobs/new"),
      bg: "bg-[var(--accent)]",
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    },
    can.viewFinancials(permissionUser) && enabledModules.has("INVOICING") && {
      href: "/documents/receipts",
      label: routeLabel("/documents/receipts"),
      bg: "bg-[var(--panel-strong)]",
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
    },
    can.openPosSession(permissionUser) && enabledModules.has("POS") && {
      href: "/pos",
      label: routeLabel("/pos"),
      bg: "bg-[var(--panel-strong)]",
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
    },
    can.viewFinancials(permissionUser) && enabledModules.has("INVOICING") && {
      href: "/documents/invoices",
      label: routeLabel("/documents/invoices"),
      bg: "bg-[var(--panel-strong)]",
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    },
  ].filter(Boolean) as React.ComponentProps<typeof MobileHomeDashboard>["quickActions"];

  // ── Desktop derivations ──────────────────────────────────────────────
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dateLine = `${DOW[today.getDay()]}, ${today.getDate()} ${MON[today.getMonth()]}${orgName ? ` · ${orgName}` : ""}`;

  // Jobs actually in play — same definition the mobile home screen uses, so the
  // two dashboards can never disagree about what "Active" means.
  const activeJobsCount = (statusCount.get("RECEIVED") ?? 0) + inRepairCount + awaitingApprovalCount;

  const canCreateJob = can.createJob(permissionUser) && enabledModules.has("JOBS");

  // Needs-action items, severity-ordered (critical → warning → info)
  const needs = [
    { label: "Overdue jobs", sub: "Long in the queue", count: overdueJobsCount, sev: "crit", href: "/jobs?overdue=1" },
    { label: "Failed messages", sub: "WhatsApp / email", count: failedOutboxCount, sev: "crit", href: COMMUNICATIONS_ROUTES.outbox },
    { label: "Completed & unpaid", sub: "Awaiting payment", count: completedUnpaidCount, sev: "warn", href: "/jobs?status=COMPLETED" },
    { label: "Awaiting approval", sub: "Quotes pending", count: awaitingApprovalCount, sev: "warn", href: "/jobs?status=AWAITING_APPROVAL" },
    { label: "No client update", sub: "Active, never contacted", count: jobsNoClientUpdateCount, sev: "warn", href: "/jobs" },
    { label: "Ready — nudge pickup", sub: "No collection yet", count: readyForPickupCount, sev: "info", href: "/jobs?status=READY_FOR_PICKUP" },
    { label: "Intake queue", sub: "Pending front desk", count: intakePendingCount, sev: "info", href: "/intake" },
  ] as const;
  // Not a sum of the rows above. Five of them are job queries that overlap by
  // construction — one job awaiting approval, eight days old and never
  // contacted satisfies three at once — so adding them counted the same work
  // several times over. jobsNeedingActionCount is those five as a single
  // distinct query; failed messages and the intake queue are different tables
  // and cannot double up with jobs or each other.
  const needsOpen = jobsNeedingActionCount + failedOutboxCount + intakePendingCount;
  // Rows with nothing to do sink to the bottom (stable sort keeps the
  // severity order above), so the eye lands on real work first instead of a
  // wall of zeros. The top row then carries a "Start here" cue — on a busy
  // morning "49 open" alone gives a new user no idea where to begin.
  const needsSorted = [...needs].sort((a, b) => (a.count === 0 ? 1 : 0) - (b.count === 0 ? 1 : 0));
  const startHereLabel = needsSorted.find((n) => n.count > 0)?.label ?? null;
  const sevMark: Record<string, string> = { crit: "bg-[var(--dc-crit)]", warn: "bg-[var(--dc-warn)]", info: "bg-[var(--dc-line)]" };
  const sevTone = (sev: string, count: number) =>
    count === 0 ? "text-[var(--dc-ink-3)]" : sev === "crit" ? "text-[var(--dc-crit)]" : sev === "warn" ? "text-[var(--dc-warn)]" : "text-[var(--dc-ink)]";

  // Cash channels
  const channels = [
    { label: "Repairs", value: repairsMtd, href: "/jobs?status=COMPLETED" },
    { label: "Products", value: productsMtd, href: "/pos" },
    { label: "Corporate", value: corporateMtd, href: "/documents/invoices" },
  ] as const;

  // Financial position rows
  const position = [
    { label: "Receivables", sub: `${outstandingCount} open`, value: outstandingValue, tone: outstandingValue > 0 ? "text-[var(--dc-warn)]" : "text-[var(--dc-ink)]", href: "/documents/invoices?status=ISSUED" },
    { label: "Expenses this month", sub: null as string | null, value: expensesValue, tone: "text-[var(--dc-ink)]", href: "/finance/expenses" },
    { label: "Payables", sub: "to suppliers", value: payablesValue, tone: payablesValue > 0 ? "text-[var(--dc-crit)]" : "text-[var(--dc-ink)]", href: "/inventory/supplier-bills?status=POSTED" },
    { label: "Tech payouts due", sub: technicianPayoutsDue > 0 ? "pending" : "all clear", value: technicianPayoutsDue, tone: technicianPayoutsDue > 0 ? "text-[var(--dc-warn)]" : "text-[var(--dc-ink)]", href: "/jobs?repairPath=EXTERNAL" },
    { label: "Bank + cash balance", sub: "across accounts", value: totalBankBalance, tone: "text-[var(--dc-good)]", href: "/finance/bank" },
  ] as const;

  // Revenue sparkline (YTD monthly)
  const rev = revenueTrend.length ? revenueTrend : [{ key: "", revenue: 0, margin: 0 }];
  const maxRev = Math.max(...rev.map((m) => m.revenue), 1);
  const coords = rev.map((m, i) => {
    const x = rev.length === 1 ? 0 : Math.round((i / (rev.length - 1)) * 3000) / 10;
    const y = Math.round((44 - (m.revenue / maxRev) * 34) * 10) / 10;
    return [x, y] as const;
  });
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c[0]},${c[1]}`).join(" ");
  const areaPath = `${linePath} L300,48 L0,48 Z`;
  const lastPt = coords[coords.length - 1];
  const ytdRevenue = rev.reduce((s, m) => s + (m.revenue || 0), 0);
  const ytdMargin = rev.reduce((s, m) => s + (m.margin || 0), 0);
  const marginPct = ytdRevenue > 0 ? Math.round(ytdMargin / ytdRevenue * 100) : 0;

  // Sales funnel snapshot
  const funnel = [
    { label: "New", value: leadCountMap.get("NEW") ?? 0 },
    { label: "Qualified", value: leadCountMap.get("QUALIFIED") ?? 0 },
    { label: "Proposal", value: leadCountMap.get("PROPOSAL_SENT") ?? 0 },
  ] as const;
  const wonCount = leadCountMap.get("WON") ?? 0;
  const lostCount = leadCountMap.get("LOST") ?? 0;

  const hotStages = new Set(["AWAITING_APPROVAL", "READY_FOR_PICKUP"]);

  return (
    <div className="space-y-5">

      {/* ── Mobile home screen (unchanged, hidden on desktop) ── */}
      <MobileHomeDashboard
        userName={userName}
        orgName={orgName ?? "Duuka ProMax"}
        receivedToday={receivedToday}
        completedToday={completedToday}
        inRepairCount={inRepairCount}
        readyForPickupCount={readyForPickupCount}
        awaitingApprovalCount={awaitingApprovalCount}
        receivedCount={statusCount.get("RECEIVED") ?? 0}
        overdueCount={overdueJobsCount}
        completedUnpaidCount={completedUnpaidCount}
        cashTodayValue={cashTodayValue}
        cashYesterdayValue={cashYesterdayValue}
        salesTodayValue={salesTodayValue}
        revenueTodayValue={revenueTodayValue}
        outstandingValue={outstandingValue}
        revenueMtd={totalMtd}
        currency={currency}
        quickActions={quickActions}
        recentJobs={recentJobs}
      />

      {/* ════════ Desktop dashboard — calm layout (hidden on mobile) ════════ */}
      <div className="dash-cal hidden lg:flex lg:flex-col lg:gap-6">

        {/* Greeting */}
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-[1.25rem] font-bold tracking-[-0.02em] text-[var(--dc-ink)]">{greeting}, {userName}</h2>
            <p className="mt-0.5 text-[0.78125rem] text-[var(--dc-ink-2)]">{dateLine}</p>
          </div>
          {canCreateJob ? (
            <Link href="/jobs/new" className="dc-btn ml-auto inline-flex items-center gap-1.5 rounded-[10px] px-[15px] py-[9px] text-[0.78125rem] font-semibold">
              + {routeLabel("/jobs/new")}
            </Link>
          ) : null}
        </div>

        {/* ── Today: ONE hero number + three live counts ──────────────
            Mirrors the mobile home screen. The old four-equal-KPI row read
            "0 · 0 · 0" first thing in the morning while the pipeline below
            showed dozens of jobs, so the app looked empty; leading with
            revenue-today and pairing it with Active/Due/Ready removes that
            contradiction and gives one obvious "how am I doing?" figure. */}
        <section>
          <SectionHead title="Today" />
          <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-4">
            <Link href="/documents/receipts" className="dc-card dc-lift block px-6 py-5">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.03em] text-[var(--dc-ink-3)]">Revenue today</p>
              <p className="mt-2 text-[2.5rem] font-bold leading-none tracking-[-0.03em] tabular-nums text-[var(--dc-accent-2)]">
                {formatMoneyCompact(revenueTodayValue, currency)}
              </p>
              <p className="mt-2.5 text-[0.71875rem] text-[var(--dc-ink-3)]">
                Repairs {formatMoneyCompact(cashTodayValue, currency)} · Products {formatMoneyCompact(salesTodayValue, currency)}
                {expensesTodayValue > 0 ? <> · <span className="text-[var(--dc-crit)]">{formatMoneyCompact(expensesTodayValue, currency)} out</span></> : null}
              </p>
            </Link>

            {([
              {
                k: "Active", v: String(activeJobsCount), href: "/jobs",
                tone: activeJobsCount > 0 ? "text-sky-400" : "text-[var(--dc-ink-3)]",
                foot: `${receivedToday} in · ${completedToday} done today`,
              },
              {
                k: "Due", v: formatMoneyCompact(outstandingValue, currency), href: "/documents/invoices?status=ISSUED",
                tone: outstandingValue > 0 ? "text-[var(--dc-warn)]" : "text-[var(--dc-ink-3)]",
                foot: `${completedUnpaidCount} completed & unpaid`,
              },
              {
                k: "Ready", v: String(readyForPickupCount), href: "/jobs?status=READY_FOR_PICKUP",
                tone: readyForPickupCount > 0 ? "text-[var(--dc-accent-2)]" : "text-[var(--dc-ink-3)]",
                foot: "awaiting pickup",
              },
            ] as const).map((kpi) => (
              <Link key={kpi.k} href={kpi.href} className="dc-card dc-lift block px-5 py-[18px]">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.03em] text-[var(--dc-ink-3)]">{kpi.k}</p>
                <p className={`mt-1.5 text-[1.875rem] font-bold leading-none tracking-[-0.025em] tabular-nums ${kpi.tone}`}>{kpi.v}</p>
                <p className="mt-1.5 text-[0.71875rem] text-[var(--dc-ink-3)]">{kpi.foot}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Repair pipeline: one quiet line ──
            The note was "% conversion", which reads as a sales metric; it is
            actually completed ÷ received for the month (see admin-data.ts). */}
        <section>
          <SectionHead
            title="Repair pipeline"
            href="/jobs"
            hrefLabel={`${routeLabel("/jobs")} →`}
            note={conversionRate > 0 ? <span className="text-[0.6875rem] text-[var(--dc-ink-3)]">· {conversionRate}% completed this month</span> : undefined}
          />
          <Card className="grid grid-cols-8 gap-1 p-2">
            {statusData.map((s) => {
              const hot = hotStages.has(s.key);
              return (
                <Link key={s.key} href={`/jobs?status=${s.key}`} className="flex flex-col items-center gap-1 rounded-xl py-3.5 text-center transition hover:bg-[var(--dc-panel-2)]">
                  <p className={`text-[1.1875rem] font-bold leading-none tabular-nums ${s.value === 0 ? "text-[var(--dc-ink-3)]" : hot ? "text-[var(--dc-accent-2)]" : "text-[var(--dc-ink)]"}`}>{s.value}</p>
                  <p className="text-[0.65625rem] text-[var(--dc-ink-3)]">{s.name}</p>
                </Link>
              );
            })}
          </Card>
        </section>

        {/* ── Three calm zones ── */}
        <div className="grid grid-cols-3 items-start gap-4">

          {/* Zone 1 — Needs action */}
          <Card className="p-5">
            <CardHead
              title="Needs action"
              href="/jobs"
              hrefLabel={`${routeLabel("/jobs")} →`}
              note={<span className={`text-[0.65625rem] font-semibold ${needsOpen > 0 ? "text-[var(--dc-warn)]" : "text-[var(--dc-good)]"}`}>{needsOpen > 0 ? `${needsOpen} open` : "all clear"}</span>}
            />
            <div className="space-y-0.5">
              {needsSorted.map((n) => (
                <Link
                  key={n.label}
                  href={n.href}
                  className={`flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-[var(--dc-panel-2)] ${n.count === 0 ? "opacity-45" : ""}`}
                >
                  <span className={`h-9 w-[3px] shrink-0 rounded-full ${n.count === 0 ? "bg-[var(--dc-line)]" : sevMark[n.sev]}`} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[0.8125rem] text-[var(--dc-ink)]">
                      {n.label}
                      {n.label === startHereLabel ? (
                        <span className="rounded-full bg-[var(--dc-accent)]/15 px-1.5 py-px text-[0.625rem] font-semibold uppercase tracking-[0.04em] text-[var(--dc-accent-2)]">
                          Start here
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[0.6875rem] text-[var(--dc-ink-3)]">{n.count === 0 ? "Nothing pending" : n.sub}</p>
                  </div>
                  <p className={`ml-auto text-[0.9375rem] font-bold tabular-nums ${sevTone(n.sev, n.count)}`}>{n.count}</p>
                </Link>
              ))}
            </div>
          </Card>

          {/* Zone 2 — Money */}
          <div className="space-y-4">
            <Card className="p-5">
              <CardHead title="Cash this month" href="/finance" hrefLabel="Finance →" />
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.03em] text-[var(--dc-ink-3)]">Collected</p>
              <p className="mt-1 text-[1.6875rem] font-bold leading-none tracking-[-0.025em] tabular-nums text-[var(--dc-accent-2)]">{formatMoneyCompact(totalMtd, currency)}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {channels.map((c) => (
                  <Link key={c.label} href={c.href} className="rounded-[11px] bg-[var(--dc-panel-2)] px-3 py-2.5 transition hover:opacity-80">
                    <p className="text-[0.65625rem] text-[var(--dc-ink-3)]">{c.label}</p>
                    <p className="mt-0.5 text-[0.875rem] font-bold tabular-nums text-[var(--dc-ink)]">{formatMoneyCompact(c.value, currency)}</p>
                  </Link>
                ))}
              </div>
            </Card>
            <Card className="p-5">
              <CardHead title="Position" href="/reports" hrefLabel={`${routeLabel("/reports")} →`} />
              <div className="space-y-0.5">
                {position.map((p) => (
                  <Link key={p.label} href={p.href} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-[var(--dc-panel-2)]">
                    <div className="min-w-0">
                      <p className="text-[0.78125rem] text-[var(--dc-ink)]">{p.label}</p>
                      {p.sub ? <p className="text-[0.6875rem] text-[var(--dc-ink-3)]">{p.sub}</p> : null}
                    </div>
                    <p className={`ml-auto text-[0.875rem] font-bold tabular-nums ${p.tone}`}>{formatMoneyCompact(p.value, currency)}</p>
                  </Link>
                ))}
              </div>
            </Card>
          </div>

          {/* Zone 3 — Operations */}
          <div className="space-y-4">
            <Card className="p-5">
              <CardHead
                title="Revenue trend"
                href="/reports"
                hrefLabel={`${routeLabel("/reports")} →`}
                note={<span className="text-[0.65625rem] text-[var(--dc-ink-3)]">margin {marginPct}%</span>}
              />
              <div className="flex items-baseline gap-2">
                <span className="text-[1.375rem] font-bold tracking-[-0.02em] tabular-nums text-[var(--dc-ink)]">{formatMoneyCompact(ytdRevenue, currency)}</span>
                <span className="text-[0.71875rem] text-[var(--dc-ink-3)]">year to date</span>
              </div>
              {ytdRevenue > 0 ? (
                <svg className="mt-2.5 block h-12 w-full" viewBox="0 0 300 48" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="admin-rev-grad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="var(--dc-accent)" stopOpacity="0.24" />
                      <stop offset="1" stopColor="var(--dc-accent)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={areaPath} fill="url(#admin-rev-grad)" />
                  <path d={linePath} fill="none" stroke="var(--dc-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  <circle cx={lastPt[0]} cy={lastPt[1]} r="3" fill="var(--dc-accent)" />
                </svg>
              ) : (
                <p className="mt-3 rounded-lg bg-[var(--dc-panel-2)] px-3 py-2 text-[0.75rem] text-[var(--dc-ink-3)]">No revenue yet this year.</p>
              )}
            </Card>

            <Card className="p-5">
              <CardHead title="Sales & stock" href="/sales/leads" hrefLabel={`${routeLabel("/sales/leads")} →`} />
              <div className="flex items-center">
                {funnel.map((f, i) => (
                  <React.Fragment key={f.label}>
                    <Link href="/sales/leads" className="flex flex-1 flex-col items-center rounded-lg py-1.5 transition hover:bg-[var(--dc-panel-2)]">
                      <span className="text-[1.0625rem] font-bold tabular-nums text-[var(--dc-ink)]">{f.value}</span>
                      <span className="text-[0.625rem] text-[var(--dc-ink-3)]">{f.label}</span>
                    </Link>
                    {i < funnel.length - 1 ? <span className="px-1 text-[var(--dc-ink-3)]">›</span> : null}
                  </React.Fragment>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-4 border-t border-[var(--dc-line)] pt-3 text-[0.75rem] text-[var(--dc-ink-2)]">
                <Link href="/sales/leads?status=WON" className="transition hover:opacity-80"><b className="font-bold text-[var(--dc-good)]">{wonCount}</b> won</Link>
                <Link href="/sales/leads?status=LOST" className="transition hover:opacity-80"><b className="font-bold text-[var(--dc-crit)]">{lostCount}</b> lost</Link>
                <Link href="/inventory?filter=low" className="ml-auto transition hover:opacity-80">
                  Low stock <b className={`font-bold ${lowStockItems.length > 0 ? "text-[var(--dc-warn)]" : "text-[var(--dc-ink)]"}`}>{lowStockItems.length}</b>
                  {" · "}out <b className={`font-bold ${outOfStockCount > 0 ? "text-[var(--dc-crit)]" : "text-[var(--dc-ink)]"}`}>{outOfStockCount}</b>
                </Link>
              </div>
            </Card>

            <Card className="p-5">
              <CardHead title="Top technicians" href="/technicians" hrefLabel="Leaderboard →" />
              {techLeaderboard.length === 0 ? (
                <p className="rounded-lg bg-[var(--dc-panel-2)] px-3 py-2 text-[0.75rem] text-[var(--dc-ink-3)]">No completed jobs this month.</p>
              ) : (
                <div className="space-y-0.5">
                  {techLeaderboard.slice(0, 4).map((tech, i) => {
                    const avg = tech.count > 0 ? `${(tech.totalDays / tech.count).toFixed(1)}d avg` : null;
                    return (
                      <div key={tech.name} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                        <span className="w-4 text-center text-[0.75rem] font-bold text-[var(--dc-ink-3)]">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="truncate text-[0.78125rem] font-semibold text-[var(--dc-ink)]">{tech.name}</p>
                          {avg ? <p className="text-[0.65625rem] text-[var(--dc-ink-3)]">{avg}</p> : null}
                        </div>
                        <p className="ml-auto text-[0.8125rem] font-bold tabular-nums text-[var(--dc-ink)]">{tech.count} <span className="text-[0.65625rem] font-normal text-[var(--dc-ink-3)]">done</span></p>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
