/**
 * MobileHomeDashboard — Moniepoint / Revolut Business-style mobile home.
 *
 * ONE primary metric front-and-centre (total revenue today — repairs + POS).
 * Secondary strip: 3 live counts (Active | Due | Ready).
 * Needs-attention list only when something is urgent.
 * Quick actions = big icon + one word only.
 */
import Link from "next/link";

type MobileQuickAction = {
  href: string;
  label: string;
  bg: string;
  icon: React.ReactNode;
};

export type MobileHomeProps = {
  userName: string;
  orgName: string;

  // Today
  receivedToday: number;
  completedToday: number;
  cashTodayValue: number;       // from invoice payments
  cashYesterdayValue: number;
  salesTodayValue: number;      // from POS
  revenueTodayValue: number;    // cashToday + salesToday

  // Status counts
  inRepairCount: number;
  readyForPickupCount: number;
  awaitingApprovalCount: number;
  receivedCount: number;
  activeJobsCount?: number;

  // Urgency
  overdueCount: number;
  completedUnpaidCount: number;

  // Month / financial
  revenueMtd: number;
  outstandingValue: number;

  currency: string;
  quickActions?: MobileQuickAction[];
  recentJobs?: { id: string; device: string; statusLabel: string; dot: string; ago: string }[];
};

function hero(v: number, currency: string) {
  if (v >= 1_000_000) return `${currency} ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${currency} ${(v / 1_000).toFixed(1)}K`;
  return `${currency} ${v.toLocaleString()}`;
}
function compact(v: number, currency: string) {
  if (v >= 1_000_000) return `${currency} ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${currency} ${Math.round(v / 1_000)}K`;
  return `${currency} ${v.toLocaleString()}`;
}
function pct(cur: number, prev: number) {
  if (prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

export function MobileHomeDashboard(p: MobileHomeProps) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  const firstName = p.userName.split(" ")[0];
  const revPct = pct(p.revenueTodayValue, p.cashYesterdayValue);
  const activeJobs = p.activeJobsCount ?? (p.receivedCount + p.inRepairCount + p.awaitingApprovalCount);
  const quickActions = p.quickActions ?? [];

  return (
    <div className="lg:hidden -mx-4 px-4 space-y-4 pb-4">

      {/* ── Greeting ──────────────────────────────────────────────── */}
      <div className="pt-1">
        <p className="text-[1.3125rem] font-black text-[var(--ink)] leading-tight">
          Good {greeting}, {firstName}
        </p>
        <p className="mt-0.5 text-[0.75rem] text-[var(--ink-muted)]">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          {" · "}<span className="font-semibold text-[var(--accent)]">{p.orgName}</span>
        </p>
      </div>

      {/* ── Hero: total revenue today (repairs + POS) ─────────────── */}
      <div className="rounded-xl bg-[var(--panel)] px-5 py-4 text-center">
        <p className="text-[0.75rem] font-medium text-[var(--ink-muted)]">
          Revenue Today
        </p>
        <p className="mt-1 text-[1.75rem] font-black leading-none tracking-tight text-[var(--ink)]">
          {hero(p.revenueTodayValue, p.currency)}
        </p>
        {/* Gradient underline */}
        <div className="mx-auto mt-2 h-[3px] w-24 rounded-full bg-gradient-to-r from-[var(--accent)] to-emerald-400 opacity-80" aria-hidden />
        {/* Breakdown chips */}
        <div className="mt-3 flex items-center justify-center gap-3">
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[0.75rem] font-bold text-emerald-500">
            Repairs {compact(p.cashTodayValue, p.currency)}
          </span>
          {p.salesTodayValue > 0 && (
            <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-0.5 text-[0.75rem] font-bold text-[var(--accent)]">
              Sales {compact(p.salesTodayValue, p.currency)}
            </span>
          )}
        </div>
        {revPct !== null && (
          <p className={`mt-2 text-[0.75rem] font-bold ${revPct >= 0 ? "text-emerald-500" : "text-red-400"}`}>
            {revPct >= 0 ? "↑" : "↓"} {Math.abs(revPct)}% vs yesterday
          </p>
        )}
      </div>

      {/* ── Secondary strip: Active | Due | Ready ─────────────────── */}
      <div className="grid grid-cols-3 divide-x divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <Link href="/jobs" className="flex flex-col items-center gap-0.5 py-4 active:bg-[var(--panel-strong)]">
          <span className={`text-[1.375rem] font-black leading-none ${activeJobs > 0 ? "text-sky-400" : "text-[var(--ink-muted)]/25"}`}>
            {activeJobs}
          </span>
          <span className="text-[0.8125rem] font-semibold text-[var(--ink-muted)]">Active</span>
        </Link>
        <Link href="/documents/invoices?status=ISSUED" className="flex flex-col items-center gap-0.5 py-4 active:bg-[var(--panel-strong)]">
          <span className={`text-[1.125rem] font-black leading-none ${p.outstandingValue > 0 ? "text-amber-400" : "text-[var(--ink-muted)]/25"}`}>
            {compact(p.outstandingValue, p.currency)}
          </span>
          <span className="text-[0.8125rem] font-semibold text-[var(--ink-muted)]">Due</span>
        </Link>
        <Link href="/jobs?status=READY_FOR_PICKUP" className="flex flex-col items-center gap-0.5 py-4 active:bg-[var(--panel-strong)]">
          <span className={`text-[1.375rem] font-black leading-none ${p.readyForPickupCount > 0 ? "text-[var(--accent)]" : "text-[var(--ink-muted)]/25"}`}>
            {p.readyForPickupCount}
          </span>
          <span className="text-[0.8125rem] font-semibold text-[var(--ink-muted)]">Ready</span>
        </Link>
      </div>

      {/* ── Needs action — 3 hero numbers, colour-coded by urgency ──── */}
      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="border-b border-[var(--line)] px-4 py-2.5">
          <p className="text-sm font-semibold text-[var(--ink)]">Needs action</p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-[var(--line)]">
          {/* Awaiting approval */}
          <Link href="/jobs?status=AWAITING_APPROVAL"
            className={`flex flex-col items-center gap-1 px-2 py-4 text-center transition active:bg-[var(--panel-strong)] ${p.awaitingApprovalCount > 0 ? "bg-[var(--accent)]/6" : ""}`}>
            <p className={`text-[1.625rem] font-black leading-none tabular-nums ${p.awaitingApprovalCount > 0 ? "text-[var(--accent)]" : "text-[var(--ink-muted)]/30"}`}>
              {p.awaitingApprovalCount}
            </p>
            <p className="mt-1 whitespace-pre-line text-[0.75rem] leading-tight text-[var(--ink-muted)]">{"Awaiting\napproval"}</p>
          </Link>
          {/* Ready for pickup */}
          <Link href="/jobs?status=READY_FOR_PICKUP"
            className={`flex flex-col items-center gap-1 px-2 py-4 text-center transition active:bg-[var(--panel-strong)] ${p.readyForPickupCount > 0 ? "bg-emerald-500/6" : ""}`}>
            <p className={`text-[1.625rem] font-black leading-none tabular-nums ${p.readyForPickupCount > 0 ? "text-emerald-500" : "text-[var(--ink-muted)]/30"}`}>
              {p.readyForPickupCount}
            </p>
            <p className="mt-1 whitespace-pre-line text-[0.75rem] leading-tight text-[var(--ink-muted)]">{"Ready for\npickup"}</p>
          </Link>
          {/* Overdue */}
          <Link href="/jobs?overdue=1"
            className={`flex flex-col items-center gap-1 px-2 py-4 text-center transition active:bg-[var(--panel-strong)] ${p.overdueCount > 0 ? "bg-red-500/6" : ""}`}>
            <p className={`text-[1.625rem] font-black leading-none tabular-nums ${p.overdueCount > 0 ? "text-red-500" : "text-[var(--ink-muted)]/30"}`}>
              {p.overdueCount}
            </p>
            <p className="mt-1 text-[0.75rem] leading-tight text-[var(--ink-muted)]">Overdue</p>
          </Link>
        </div>
        {/* Money alert — a tinted bar, no arrow (the whole row taps through) */}
        {(p.completedUnpaidCount > 0) && (
          <Link href="/jobs?status=COMPLETED"
            className="flex items-center gap-2.5 border-t border-[var(--line)] bg-red-500/6 px-4 py-2.5 active:bg-red-500/12">
            <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-red-500/15 px-1.5 text-[0.75rem] font-black tabular-nums text-red-400">
              {p.completedUnpaidCount}
            </span>
            <span className="text-[0.8125rem] font-medium text-[var(--ink)]">completed &amp; unpaid — collect payment</span>
          </Link>
        )}
      </div>

      {/* ── Quick actions ─────────────────────────────────────────── */}
      {quickActions.length > 0 ? (
        <div className="grid grid-cols-4 gap-3">
          {quickActions.map((a) => (
          <Link key={a.href} href={a.href} className="flex flex-col items-center gap-2">
            <span className={`flex h-14 w-14 items-center justify-center rounded-xl ${a.bg}`}>
              {a.icon}
            </span>
            <span className="text-[0.6875rem] font-semibold text-[var(--ink-muted)]">{a.label}</span>
          </Link>
          ))}
        </div>
      ) : null}

      {/* ── Recent activity — last few jobs, each taps through ────────── */}
      {(p.recentJobs?.length ?? 0) > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] px-4 py-2.5">
            <p className="text-sm font-semibold text-[var(--ink)]">Recent</p>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {p.recentJobs!.map((j) => (
              <Link key={j.id} href={`/jobs/${j.id}`}
                className="flex items-center gap-3 px-4 py-3 active:bg-[var(--panel-strong)]">
                <span className={`h-2 w-2 shrink-0 rounded-full ${j.dot}`} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-[var(--ink)]">{j.device}</span>
                <span className="shrink-0 text-[0.75rem] text-[var(--ink-muted)]">{j.statusLabel}</span>
                <span className="shrink-0 text-[0.75rem] tabular-nums text-[var(--ink-muted)]/60">{j.ago}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

    </div>
  );
}
