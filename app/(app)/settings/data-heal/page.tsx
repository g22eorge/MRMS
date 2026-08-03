import Link from "next/link";
import { redirect } from "next/navigation";

import { runDataHeal } from "@/lib/data-heal";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";
import { checkIsPlatformAdmin } from "@/lib/platform-admin";
import { DataTable } from "@/components/ui/DataTable";

export default async function DataHealPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; fixed?: string; pending?: string; checked?: string; dry?: string; at?: string }>;
}) {
  const { user } = await getCurrentUserRole();
  // runDataHeal operates ACROSS ALL orgs (it's a system maintenance job, also run
  // by cron) — so restrict it to the platform operator, not every tenant admin.
  if (!checkIsPlatformAdmin(user.email)) {
    redirect("/dashboard");
  }

  const feedback = await searchParams;

  const [unresolved, lastHealedAt, preview] = await Promise.all([
    prisma.job.count({
      where: { OR: [{ brand: "Unknown" }, { model: "Unknown" }, { deviceType: "OTHER" }] },
    }),
    prisma.auditLog.findFirst({
      where: { action: "DATA_HEAL_JOB_DEVICE_FIELDS" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    runDataHeal(prisma, { dryRun: true, limit: 25 }),
  ]);

  async function runDry() {
    "use server";
    const { user: actor } = await getCurrentUserRole();
    if (!checkIsPlatformAdmin(actor.email)) return;
    const result = await runDataHeal(prisma, { dryRun: true, actorUserId: actor.id });
    redirect(
      `/settings/data-heal?mode=dry&checked=${result.checked}&fixed=${result.fixed}&pending=${result.pending}&at=${Date.now()}`,
    );
  }

  async function runApply() {
    "use server";
    const { user: actor } = await getCurrentUserRole();
    if (!checkIsPlatformAdmin(actor.email)) return;
    const result = await runDataHeal(prisma, { dryRun: false, actorUserId: actor.id });
    redirect(
      `/settings/data-heal?mode=apply&checked=${result.checked}&fixed=${result.fixed}&pending=${result.pending}&at=${Date.now()}`,
    );
  }

  return (
    <div className="space-y-4">
      <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[13px] font-bold text-[var(--ink)]">Data Heal</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-[13px] font-semibold ${unresolved > 0 ? "border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`}>
              {unresolved} unresolved
            </span>
            <span className="rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-0.5 text-[13px] text-[var(--ink-muted)]">
              Last: {lastHealedAt ? new Date(lastHealedAt.createdAt).toLocaleString() : "Never"}
            </span>
          </div>
        </div>
      </div>

      <section className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
        {feedback.mode ? (
          <div className="mb-3 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-xs text-[var(--ink)]">
            {feedback.mode === "dry" ? "Dry check complete" : "Heal run complete"}: checked {feedback.checked ?? "0"},
            fixable {feedback.fixed ?? "0"}, pending {feedback.pending ?? "0"}
            {feedback.at ? ` (run ${new Date(Number(feedback.at)).toLocaleTimeString()})` : ""}.
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <form action={runDry}>
            <button type="submit" className="btn-premium-secondary rounded-lg px-3 py-2 text-sm">Run Dry Check</button>
          </form>
          <form action={runApply}>
            <button type="submit" className="btn-premium rounded-lg px-3 py-2 text-sm font-semibold text-white">Run Heal Now</button>
          </form>
        </div>
      </section>

      <section className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--ink)]">Dry-run Preview</p>
          <p className="text-xs text-[var(--ink-muted)]">Showing up to 25 rows that can be healed right now.</p>
        </div>
        <DataTable
          frameless
          dense
          className="doc-list"
          rows={preview.changes}
          getRowKey={(change) => change.id}
          empty="No healable placeholder rows found."
          columns={[
            {
              key: "job",
              header: "Job #",
              cell: (change) => (
                <Link href={`/jobs/${change.id}`} className="mono font-bold text-[var(--ink)] transition-colors hover:text-[var(--accent)]">{change.jobNumber}</Link>
              ),
            },
            {
              key: "from",
              header: "From",
              className: "text-[var(--ink-muted)]",
              cell: (change) => `${change.from.brand} / ${change.from.model} / ${change.from.deviceType}`,
            },
            {
              key: "to",
              header: "To",
              className: "text-[var(--ink)]",
              cell: (change) => `${change.to.brand} / ${change.to.model} / ${change.to.deviceType}`,
            },
          ]}
        />
      </section>
    </div>
  );
}
