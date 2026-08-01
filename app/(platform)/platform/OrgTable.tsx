"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { setPlanAction, setBillingStatusAction } from "./actions";
import { PLATFORM_PLAN_TONE, PLATFORM_ROUTES, PLATFORM_STATUS_TONE } from "@/lib/platform/routes";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge, toneFor } from "@/components/ui/StatusBadge";

export type OrgRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  billingStatus: string;
  isActive: boolean;
  trialEndsAt: Date | null;
  planRenewsAt: Date | null;
  createdAt: Date;
  _count: { users: number; jobs: number };
};

function TrialBadge({ trialEndsAt }: { trialEndsAt: Date | null }) {
  if (!trialEndsAt) return <span className="text-[var(--ink-muted)]">—</span>;
  const days = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return <StatusBadge tone="danger">Expired</StatusBadge>;
  if (days <= 3) return <StatusBadge tone="danger">{days}d left</StatusBadge>;
  if (days <= 7) return <StatusBadge tone="warning">{days}d left</StatusBadge>;
  return <span className="text-[var(--ink-muted)]">{days}d left</span>;
}

function fmt(d: Date | null | string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" });
}

export function OrgTable({ orgs }: { orgs: OrgRow[] }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  const filtered = useMemo(() => {
    const lq = q.toLowerCase();
    return orgs.filter((org) => {
      if (lq && !org.name.toLowerCase().includes(lq) && !org.slug.toLowerCase().includes(lq)) return false;
      if (statusFilter !== "all" && org.billingStatus !== statusFilter) return false;
      if (planFilter !== "all" && org.plan !== planFilter) return false;
      return true;
    });
  }, [orgs, q, statusFilter, planFilter]);

  const hasFilter = q !== "" || statusFilter !== "all" || planFilter !== "all";

  return (
    <div className="space-y-3">
      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-muted)]" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd"/>
          </svg>
          <input
            type="search"
            placeholder="Search name or slug…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-52 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] pl-8 pr-3 py-1.5 text-sm text-[var(--ink)] placeholder-[var(--ink-muted)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--gold)]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-sm text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]"
        >
          <option value="all">All statuses</option>
          <option value="TRIALING">Trialing</option>
          <option value="ACTIVE">Active</option>
          <option value="PAST_DUE">Past Due</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-sm text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]"
        >
          <option value="all">All plans</option>
          <option value="STARTER">Starter</option>
          <option value="STANDARD">Standard</option>
          <option value="GROWTH">Growth</option>
          <option value="PREMIUM">Premium</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select>
        {hasFilter && (
          <button
            onClick={() => { setQ(""); setStatusFilter("all"); setPlanFilter("all"); }}
            className="text-xs font-semibold text-[var(--ink-muted)] underline hover:text-[var(--ink)]"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-[var(--ink-muted)]">
          {hasFilter ? `${filtered.length} of ${orgs.length}` : `${orgs.length} orgs`}
        </span>
      </div>

      {/* ── Table ── */}
      <DataTable
        rows={filtered}
        getRowKey={(org) => org.id}
        rowClassName={(org) => (!org.isActive ? "opacity-40" : undefined)}
        empty={hasFilter ? "No organisations match the current filter." : "No organisations yet."}
        columns={[
          {
            key: "org",
            header: "Organisation",
            cell: (org) => (
              <Link href={PLATFORM_ROUTES.org(org.id)} className="group block">
                <p className="font-semibold text-[var(--ink)] group-hover:underline">{org.name}</p>
                <p className="text-[var(--ink-muted)]">/{org.slug}</p>
              </Link>
            ),
          },
          {
            key: "plan",
            header: "Plan",
            cell: (org) => (
              <StatusBadge tone={toneFor(PLATFORM_PLAN_TONE, org.plan)}>{org.plan}</StatusBadge>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (org) => (
              <StatusBadge tone={toneFor(PLATFORM_STATUS_TONE, org.billingStatus)}>{org.billingStatus}</StatusBadge>
            ),
          },
          {
            key: "users",
            header: "Users",
            align: "center",
            className: "mono text-[var(--ink-muted)]",
            cell: (org) => org._count.users,
          },
          {
            key: "jobs",
            header: "Jobs",
            align: "center",
            className: "mono text-[var(--ink-muted)]",
            cell: (org) => org._count.jobs,
          },
          {
            key: "trial",
            header: "Trial / Renews",
            headerClassName: "hidden lg:table-cell",
            className: "hidden lg:table-cell",
            cell: (org) =>
              org.billingStatus === "TRIALING" ? (
                <TrialBadge trialEndsAt={org.trialEndsAt} />
              ) : (
                <span className="text-[var(--ink-muted)]">{fmt(org.planRenewsAt)}</span>
              ),
          },
          {
            key: "joined",
            header: "Joined",
            headerClassName: "hidden md:table-cell",
            className: "hidden text-[var(--ink-muted)] md:table-cell",
            cell: (org) => fmt(org.createdAt),
          },
          {
            key: "quick",
            header: "Quick change",
            cell: (org) => (
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Plan */}
                <form action={setPlanAction} className="flex items-center gap-1">
                  <input type="hidden" name="orgId" value={org.id} />
                  <select
                    name="plan"
                    defaultValue={org.plan}
                    className="rounded border border-[var(--line)] bg-[var(--panel-strong)] px-1.5 py-0.5 text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]"
                  >
                    <option value="STARTER">Starter</option>
                    <option value="STANDARD">Standard</option>
                    <option value="GROWTH">Growth</option>
                    <option value="PREMIUM">Premium</option>
                    <option value="ENTERPRISE">Enterprise</option>
                  </select>
                  <button type="submit" className="rounded border border-[var(--line)] bg-[var(--panel-strong)] px-1.5 py-0.5 font-semibold text-[var(--ink-muted)] hover:border-[var(--gold)]/60 hover:text-[var(--gold)]">
                    Plan
                  </button>
                </form>

                {/* Status */}
                <form action={setBillingStatusAction} className="flex items-center gap-1">
                  <input type="hidden" name="orgId" value={org.id} />
                  <select
                    name="status"
                    defaultValue={org.billingStatus}
                    className="rounded border border-[var(--line)] bg-[var(--panel-strong)] px-1.5 py-0.5 text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]"
                  >
                    <option value="TRIALING">Trialing</option>
                    <option value="ACTIVE">Active</option>
                    <option value="PAST_DUE">Past Due</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                  <button type="submit" className="rounded border border-[var(--line)] bg-[var(--panel-strong)] px-1.5 py-0.5 font-semibold text-[var(--ink-muted)] hover:border-sky-400/60 hover:text-sky-600">
                    Status
                  </button>
                </form>

                <Link
                  href={PLATFORM_ROUTES.org(org.id)}
                  className="rounded border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-0.5 font-semibold text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--ink)]"
                >
                  →
                </Link>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
