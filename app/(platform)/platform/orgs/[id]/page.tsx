import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBillingEventsByOrg } from "@/lib/billing-events";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { formatEATMediumDate } from "@/lib/date-eat";
import { PLATFORM_PLAN_CHIP, PLATFORM_ROUTES, PLATFORM_STATUS_CHIP } from "@/lib/platform/routes";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import {
  setBillingStatusAction,
  setPlanAction,
  extendTrialAction,
  toggleOrgActive,
  setOrgSmsSenderAction,
  setOrgAiModelAction,
  toggleOrgModuleAction,
  resetOrgAdminPasswordAction,
} from "../../actions";
import { UserPasswordResetForm } from "@/components/settings/UserPasswordResetForm";
import { getSmsUsage, SMS_PLAN_QUOTAS } from "@/lib/notifications/sms-quota";
import { getOrgWhatsAppConfig } from "@/lib/org-whatsapp-config";
import { ALL_MODULES, MODULE_LABELS } from "@/lib/module-access";
import { ModuleIcon } from "@/components/shared/ModuleIcon";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

const STATUS_CHIP = PLATFORM_STATUS_CHIP;
const PLAN_CHIP = PLATFORM_PLAN_CHIP;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.75rem] font-bold uppercase tracking-[0.18em] text-[var(--ink-muted)]">{children}</p>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-[var(--ink)]">{value}</p>
    </div>
  );
}

export default async function OrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePlatformAdmin();

  const org = await prisma.organization.findUnique({
    where: { id },
    select: {
      id: true, name: true, slug: true, plan: true, billingStatus: true,
      isActive: true, trialEndsAt: true, planRenewsAt: true, planCancelledAt: true,
      flwSubscriptionId: true, flwCustomerId: true, aiModel: true,
      createdAt: true, updatedAt: true,
      _count: { select: { users: true, jobs: true } },
    },
  }).catch(() =>
    prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, isActive: true, createdAt: true, updatedAt: true, _count: { select: { users: true, jobs: true } } },
    }).then((r) => r ? { ...r, plan: "STARTER" as const, billingStatus: "TRIALING" as const, isActive: r.isActive, trialEndsAt: null, planRenewsAt: null, planCancelledAt: null, flwSubscriptionId: null, flwCustomerId: null, aiModel: null } : null)
  );

  if (!org) notFound();

  const [orgUsers, billingHistory, smsUsed, orgWaCfg, moduleGrants] = await Promise.all([
    prisma.user.findMany({
      where: { orgId: id },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }).catch(() => []),
    getBillingEventsByOrg(id).catch(() => []),
    getSmsUsage(id),
    getOrgWhatsAppConfig(id).catch(() => null),
    prisma.orgModuleGrant.findMany({ where: { orgId: id }, select: { module: true } }).catch(() => []),
  ]);

  const enabledModuleSet = new Set(moduleGrants.map((g) => g.module as string));
  const smsLimit  = SMS_PLAN_QUOTAS[org.plan] ?? 200;
  const smsPct    = Math.min(100, Math.round((smsUsed / smsLimit) * 100));
  const totalPaid = billingHistory
    .filter((e) => e.status === "successful" && e.event === "charge.completed")
    .reduce((s, e) => s + e.amount, 0);

  const fmt = (d: Date | null) => (d ? formatEATMediumDate(d) : "—");

  return (
    <div className="space-y-6">

      {/* Back + breadcrumb */}
      <Link href={PLATFORM_ROUTES.home} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Organisations
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--ink)]">{org.name}</h1>
            <span className={`rounded-full border px-2.5 py-0.5 text-[0.8125rem] font-semibold ${PLAN_CHIP[org.plan] ?? ""}`}>
              {org.plan}
            </span>
            <span className={`rounded-full border px-2.5 py-0.5 text-[0.8125rem] font-semibold ${STATUS_CHIP[org.billingStatus] ?? ""}`}>
              {org.billingStatus}
            </span>
            {!org.isActive && (
              <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2.5 py-0.5 text-[0.8125rem] font-semibold text-red-700 dark:text-red-400">
                INACTIVE
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">/{org.slug} · created {fmt(org.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/admin/db-fix"
            target="_blank"
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-muted)] transition-colors hover:border-amber-400/60 hover:text-amber-600"
          >
            DB Fix
          </a>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Users",            value: org._count.users },
          { label: "Jobs",             value: org._count.jobs },
          { label: "Total Paid",       value: formatMoney(totalPaid) },
          { label: `SMS ${smsUsed}/${smsLimit}`, value: `${smsPct}%` },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.15em] text-[var(--ink-muted)]">{m.label}</p>
            <p className="mt-1 text-xl font-bold text-[var(--ink)]">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Billing info */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 space-y-3">
        <SectionTitle>Billing Info</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Plan" value={org.plan} />
          <Field label="Trial ends" value={fmt(org.trialEndsAt)} />
          <Field label="Renews" value={fmt(org.planRenewsAt)} />
          <Field label="Pesapal ID" value={<span className="mono text-xs">{org.flwSubscriptionId ?? "—"}</span>} />
        </div>
      </div>

      {/* Billing controls */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 space-y-4">
        <SectionTitle>Billing Controls</SectionTitle>
        <div className="flex flex-wrap gap-3">

          {/* Set plan */}
          <form action={setPlanAction} className="flex items-center gap-2">
            <input type="hidden" name="orgId" value={org.id} />
            <label className="text-xs font-semibold text-[var(--ink-muted)]">Plan</label>
            <select name="plan" defaultValue={org.plan} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]">
              <option value="STARTER">Starter</option>
              <option value="STANDARD">Standard</option>
              <option value="GROWTH">Growth</option>
              <option value="PREMIUM">Premium</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
            <button type="submit" className="rounded-lg bg-[var(--accent)]/20 px-3 py-1.5 text-xs font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/30">
              Set Plan
            </button>
          </form>

          <div className="w-px bg-[var(--line)] self-stretch" />

          {/* Set billing status */}
          <form action={setBillingStatusAction} className="flex items-center gap-2">
            <input type="hidden" name="orgId" value={org.id} />
            <label className="text-xs font-semibold text-[var(--ink-muted)]">Status</label>
            <select name="status" defaultValue={org.billingStatus} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]">
              <option value="TRIALING">Trialing</option>
              <option value="ACTIVE">Active</option>
              <option value="PAST_DUE">Past Due</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <button type="submit" className="rounded-lg bg-[var(--accent)]/20 px-3 py-1.5 text-xs font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/30">
              Set Status
            </button>
          </form>

          <div className="w-px bg-[var(--line)] self-stretch" />

          {/* Extend trial */}
          <form action={extendTrialAction} className="flex items-center gap-2">
            <input type="hidden" name="orgId" value={org.id} />
            <label className="text-xs font-semibold text-[var(--ink-muted)]">Trial</label>
            <select name="days" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]">
              <option value="7">+7 days</option>
              <option value="14">+14 days</option>
              <option value="30">+30 days</option>
              <option value="60">+60 days</option>
              <option value="90">+90 days</option>
            </select>
            <button type="submit" className="rounded-lg bg-[var(--accent)]/20 px-3 py-1.5 text-xs font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/30">
              Extend Trial
            </button>
          </form>
        </div>
      </div>

      {/* Integrations */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* SMS Sender */}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 space-y-3">
          <div>
            <SectionTitle>SMS Sender Name</SectionTitle>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">Alphanumeric, max 11 chars. Pre-approved by Africa&apos;s Talking required. Leave blank for platform default.</p>
          </div>
          <form action={setOrgSmsSenderAction} className="flex items-center gap-2">
            <input type="hidden" name="orgId" value={org.id} />
            <input
              type="text" name="senderId"
              defaultValue={orgWaCfg?.atSenderId ?? ""}
              placeholder="e.g. EagleInfo"
              maxLength={11} pattern="[A-Za-z0-9]*"
              className="w-40 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 mono text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <button type="submit" className="rounded-lg bg-[var(--accent)]/20 px-3 py-1.5 text-xs font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/30">
              Save
            </button>
            {orgWaCfg?.atSenderId && (
              <span className="text-xs text-[var(--ink-muted)]">Current: <span className="mono font-semibold text-[var(--ink)]">{orgWaCfg.atSenderId}</span></span>
            )}
          </form>
        </div>

        {/* AI Model */}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 space-y-3">
          <div>
            <SectionTitle>AI Model Override</SectionTitle>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">Assign a specific Claude model. Leave blank for platform default.</p>
          </div>
          <form action={setOrgAiModelAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="orgId" value={org.id} />
            <select
              name="aiModel" defaultValue={org.aiModel ?? ""}
              className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 mono text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            >
              <option value="">Platform default</option>
              <option value="claude-haiku-4-5-20251001">Haiku 4.5 — fast / cheap</option>
              <option value="claude-sonnet-4-6">Sonnet 4.6 — balanced</option>
              <option value="claude-opus-4-7">Opus 4.7 — most capable</option>
            </select>
            <button type="submit" className="rounded-lg bg-[var(--accent)]/20 px-3 py-1.5 text-xs font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/30">
              Save
            </button>
          </form>
          {org.aiModel && (
            <p className="text-xs text-[var(--ink-muted)]">Active: <span className="mono font-semibold text-[var(--ink)]">{org.aiModel}</span></p>
          )}
        </div>
      </div>

      {/* Users */}
      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="border-b border-[var(--line)] px-5 py-3">
          <SectionTitle>Users ({orgUsers.length})</SectionTitle>
        </div>
        <DataTable
          frameless
          rows={orgUsers}
          getRowKey={(u) => u.id}
          empty="No users."
          columns={[
            {
              key: "name",
              header: "Name",
              className: "font-medium text-[var(--ink)]",
              cell: (u) => u.name,
            },
            {
              key: "email",
              header: "Email",
              className: "text-[var(--ink-muted)]",
              cell: (u) => u.email,
            },
            {
              key: "role",
              header: "Role",
              cell: (u) => <StatusBadge tone="neutral">{u.role}</StatusBadge>,
            },
            {
              key: "status",
              header: "Status",
              cell: (u) => (
                <StatusBadge tone={u.isActive ? "success" : "neutral"}>
                  {u.isActive ? "Active" : "Inactive"}
                </StatusBadge>
              ),
            },
            {
              key: "joined",
              header: "Joined",
              headerClassName: "hidden sm:table-cell",
              className: "hidden text-[var(--ink-muted)] sm:table-cell",
              cell: (u) => fmt(u.createdAt),
            },
          ]}
        />
      </div>

      {/* Admin access — reset a locked-out org administrator */}
      {orgUsers.some((u) => u.role === "ADMIN") && (
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] px-5 py-3">
            <SectionTitle>Admin Access</SectionTitle>
          </div>
          <div className="space-y-3 px-5 py-4">
            <p className="text-[0.8125rem] text-[var(--ink-muted)]">
              Reset a locked-out administrator. This sets a new password and signs them out of every device.
            </p>
            {orgUsers.filter((u) => u.role === "ADMIN").map((u) => (
              <div key={u.id} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)]/40 px-3 py-2.5">
                <p className="mb-2 text-[0.8125rem] font-medium text-[var(--ink)]">
                  {u.name} <span className="text-[var(--ink-muted)]">· {u.email}</span>
                </p>
                <UserPasswordResetForm userId={u.id} action={resetOrgAdminPasswordAction} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment history */}
      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="border-b border-[var(--line)] px-5 py-3">
          <SectionTitle>Payment History ({billingHistory.length})</SectionTitle>
        </div>
        <DataTable
          frameless
          rows={billingHistory}
          getRowKey={(e) => e.id}
          empty="No payment records yet."
          columns={[
            {
              key: "date",
              header: "Date",
              className: "text-[var(--ink-muted)]",
              cell: (e) => fmt(e.createdAt),
            },
            {
              key: "event",
              header: "Event",
              className: "text-[var(--ink)]",
              cell: (e) => e.event,
            },
            {
              key: "status",
              header: "Status",
              cell: (e) => (
                <StatusBadge tone={e.status === "successful" ? "success" : "danger"}>{e.status}</StatusBadge>
              ),
            },
            {
              key: "amount",
              header: "Amount",
              align: "right",
              className: "mono text-[var(--ink)]",
              cell: (e) => (e.amount > 0 ? formatMoney(e.amount, normalizeCurrency(e.currency, "UGX")) : "—"),
            },
            {
              key: "reference",
              header: "Reference",
              headerClassName: "hidden md:table-cell",
              className: "hidden mono text-[0.75rem] text-[var(--ink-muted)] md:table-cell",
              cell: (e) => e.txRef ?? "—",
            },
          ]}
        />
      </div>

      {/* Module access */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 space-y-4">
        <div>
          <SectionTitle>Module Access</SectionTitle>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            {enabledModuleSet.size === 0
              ? "No modules explicitly granted — org sees all modules (default). Toggle any module to start managing access."
              : `${enabledModuleSet.size} of ${ALL_MODULES.length} modules enabled.`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {ALL_MODULES.map((mod) => {
            const enabled = enabledModuleSet.size === 0 || enabledModuleSet.has(mod);
            const isGranted = enabledModuleSet.has(mod);
            return (
              <form key={mod} action={toggleOrgModuleAction}>
                <input type="hidden" name="orgId" value={org.id} />
                <input type="hidden" name="module" value={mod} />
                <input type="hidden" name="currentlyEnabled" value={String(isGranted)} />
                <button
                  type="submit"
                  className={`w-full rounded-xl border px-3 py-3 text-left transition-colors hover:opacity-80 ${
                    enabled && isGranted
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                      : isGranted
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                      : enabledModuleSet.size === 0
                      ? "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)]"
                      : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <ModuleIcon module={mod} className="h-4 w-4 text-[var(--accent)]" />
                    <span className={`h-2 w-2 rounded-full ${isGranted ? "bg-emerald-500" : enabledModuleSet.size === 0 ? "bg-[var(--ink-muted)]/30" : "bg-red-400"}`} />
                  </div>
                  <p className="mt-1.5 text-[0.8125rem] font-bold leading-tight">{MODULE_LABELS[mod]}</p>
                  <p className="mt-0.5 text-[0.75rem] font-semibold uppercase tracking-wide opacity-60">
                    {isGranted ? "ON — click to disable" : enabledModuleSet.size === 0 ? "default on" : "OFF — click to enable"}
                  </p>
                </button>
              </form>
            );
          })}
        </div>
        {enabledModuleSet.size === 0 && (
          <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <strong>Tip:</strong> Enabling any module switches this org from &ldquo;all access&rdquo; to explicit grant mode. Only enabled modules will appear in the sidebar.
          </p>
        )}
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-red-400/30 bg-red-500/5 p-5 space-y-3">
        <SectionTitle>Danger Zone</SectionTitle>
        <div className="flex flex-wrap items-center gap-4">
          <form action={toggleOrgActive}>
            <input type="hidden" name="orgId" value={org.id} />
            <input type="hidden" name="isActive" value={String(org.isActive)} />
            <button
              type="submit"
              className={`rounded-lg border px-4 py-2 text-xs font-semibold transition-colors ${
                org.isActive
                  ? "border-red-400/30 bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:text-red-400"
                  : "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
              }`}
            >
              {org.isActive ? "Deactivate Organisation" : "Reactivate Organisation"}
            </button>
          </form>
          <p className="text-xs text-red-600/70">
            {org.isActive
              ? "Deactivating blocks all org members from logging in."
              : "Organisation is currently deactivated — members cannot log in."}
          </p>
        </div>
      </div>

    </div>
  );
}
