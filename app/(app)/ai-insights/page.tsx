import Link from "next/link";
import { redirect } from "next/navigation";

import { BusinessCopilot } from "@/components/ai-insights/BusinessCopilot";
import { buildBusinessDataPack, pctChange, trendLabel } from "@/lib/ai/business-metrics";
import { formatMoneyCompact } from "@/lib/currency";
import { can } from "@/lib/permissions";
import { getCurrentUserRole } from "@/lib/session";
import { PageHeader } from "@/components/ui/PageHeader";

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function KpiCard({ title, value, caption, tone = "neutral" }: { title: string; value: string; caption: string; tone?: "neutral" | "good" | "risk" }) {
  const toneClass = tone === "good" ? "text-emerald-600" : tone === "risk" ? "text-amber-600" : "text-[var(--accent)]";
  return (
    <section className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">{title}</p>
      <p className={`mt-1 text-lg font-bold tracking-tight ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">{caption}</p>
    </section>
  );
}

function InsightCard({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">{title}</p>
      {items.length ? (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div key={item} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-[var(--ink)]">
              {item}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-[var(--ink-muted)]">{empty}</p>
      )}
    </section>
  );
}

export default async function AiInsightsPage() {
  const { user } = await getCurrentUserRole();
  if (!can.viewAccountsSummary(user)) redirect("/dashboard");
  if (!user.orgId) redirect("/dashboard");

  const data = await buildBusinessDataPack(user.orgId);
  const { currency, repairs, sales, finance, inventory } = data;
  const targetProgress = sales.targetProgressPct !== null ? Math.min(999, sales.targetProgressPct) : null;

  const risks = [
    repairs.overdueJobs ? `${repairs.overdueJobs} open repair job(s) are older than 7 days. Prioritise diagnosis, approvals, parts, or technician reassignment.` : null,
    repairs.staleJobs ? `${repairs.staleJobs} open job(s) have not been updated for 3+ days. Ask owners to add notes or move status.` : null,
    repairs.awaitingApproval ? `${repairs.awaitingApproval} job(s) are awaiting client approval. Follow up before they become stale.` : null,
    repairs.waitingForParts ? `${repairs.waitingForParts} job(s) are waiting for parts. Check low-stock items and pending purchase orders.` : null,
    inventory.lowStockParts ? `${inventory.lowStockParts} active part(s) are at or below reorder level. Review Stock Alerts and create purchase requests/orders.` : null,
    finance.overdueInvoices ? `${finance.overdueInvoices} invoice(s) are overdue. Receivables at risk: ${formatMoneyCompact(finance.receivables, currency)}.` : null,
    finance.overdueSupplierBills ? `${finance.overdueSupplierBills} supplier bill(s) are overdue. Payables outstanding: ${formatMoneyCompact(finance.payables, currency)}.` : null,
    finance.cashReceived < finance.cashReceivedPrev ? `Cash received is down ${Math.abs(pctChange(finance.cashReceived, finance.cashReceivedPrev)).toFixed(1)}% versus last month. Review collections, POS sales, and invoice payments.` : null,
    finance.cashMarginSignal < 0 ? `Cash margin signal is negative after expenses and external repair costs. Reduce discretionary spend or accelerate collections.` : null,
  ].filter((item): item is string => Boolean(item));

  const recommendations = [
    inventory.lowStockParts ? "Create purchase requests for the most critical low-stock repair parts before accepting jobs that depend on them." : null,
    repairs.overdueJobs ? "Run a daily stuck-job standup: owner, blocker, next action, and promised client update for every job older than 7 days." : null,
    repairs.awaitingApproval ? "Assign OPS/front desk to contact clients awaiting approval and record each decision on the job timeline." : null,
    finance.receivables > 0 ? "Prioritise collections by oldest and largest issued invoices; issue receipts immediately after payment." : null,
    inventory.openPurchaseOrders ? "Review open purchase orders and confirm expected delivery dates with suppliers." : null,
    sales.openLeads ? "Work the open sales pipeline by next follow-up date; focus first on high estimated-value qualified/proposal leads." : null,
    targetProgress !== null && targetProgress < 80 ? "Sales target progress is below 80%; increase follow-ups, campaigns, and quote conversion reviews this week." : null,
    repairs.completedThisMonth ? "Compare technician turnaround times and external repair costs before assigning the next batch of work." : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="AI · Analytics"
        title="Business Insights"
        actions={
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <Link href="/reports" className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink)] hover:border-[var(--accent)]/40">Operations Reports</Link>
            <Link href="/finance/reports" className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink)] hover:border-[var(--accent)]/40">Finance Reports</Link>
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Cash Received"
          value={formatMoneyCompact(finance.cashReceived, currency)}
          caption={`${trendLabel(finance.cashReceived, finance.cashReceivedPrev)} · ${formatMoneyCompact(finance.completedRepairValue, currency)} completed repair value`}
          tone={finance.cashReceived >= finance.cashReceivedPrev ? "good" : "risk"}
        />
        <KpiCard title="Cash Margin Signal" value={formatMoneyCompact(finance.cashMarginSignal, currency)} caption={`Expenses: ${formatMoneyCompact(finance.expenses, currency)} (${trendLabel(finance.expenses, finance.expensesPrev)})`} tone={finance.cashMarginSignal >= 0 ? "good" : "risk"} />
        <KpiCard title="Open Repair Load" value={String(repairs.openJobs)} caption={`${repairs.overdueJobs} older than 7 days; ${repairs.staleJobs} stale updates`} tone={repairs.overdueJobs ? "risk" : "neutral"} />
        <KpiCard title="Inventory Risk" value={String(inventory.lowStockParts)} caption={`${formatMoneyCompact(inventory.inventoryValue, currency)} stock value; ${inventory.openPurchaseOrders} open PO(s)`} tone={inventory.lowStockParts ? "risk" : "good"} />
      </section>

      <BusinessCopilot />

      <div className="grid gap-4 xl:grid-cols-2">
        <InsightCard title="Risks AI Should Escalate" items={risks} empty="No major cross-module risks detected from the current data." />
        <InsightCard title="Recommended Management Actions" items={recommendations} empty="No immediate management actions detected. Keep monitoring daily activity." />
      </div>

      <section className="grid gap-4 xl:grid-cols-4">
        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Repairs</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">New jobs</dt><dd className="font-semibold text-[var(--ink)]">{repairs.jobsThisMonth} <span className="text-[0.75rem] font-medium text-[var(--ink-muted)]">({trendLabel(repairs.jobsThisMonth, repairs.jobsPrevMonth)})</span></dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Completed</dt><dd className="font-semibold text-[var(--ink)]">{repairs.completedThisMonth}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Avg turnaround</dt><dd className="font-semibold text-[var(--ink)]">{repairs.averageTurnaroundDays.toFixed(1)} days</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Completed repair value</dt><dd className="font-semibold text-[var(--ink)]">{formatMoneyCompact(finance.completedRepairValue, currency)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Repair collections</dt><dd className="font-semibold text-[var(--ink)]">{formatMoneyCompact(finance.cashReceivedByChannel.repairs, currency)}</dd></div>
          </dl>
        </div>

        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Sales</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">POS cash received</dt><dd className="font-semibold text-[var(--ink)]">{formatMoneyCompact(sales.posCashReceived, currency)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Invoice payments</dt><dd className="font-semibold text-[var(--ink)]">{formatMoneyCompact(sales.invoiceCashReceived, currency)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Open leads</dt><dd className="font-semibold text-[var(--ink)]">{sales.openLeads}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Pipeline value</dt><dd className="font-semibold text-[var(--ink)]">{formatMoneyCompact(sales.pipelineValue, currency)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Won leads</dt><dd className="font-semibold text-[var(--ink)]">{sales.wonLeads}</dd></div>
          </dl>
        </div>

        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Finance</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Expenses</dt><dd className="font-semibold text-[var(--ink)]">{formatMoneyCompact(finance.expenses, currency)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Receivables</dt><dd className="font-semibold text-[var(--ink)]">{formatMoneyCompact(finance.receivables, currency)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Payables</dt><dd className="font-semibold text-[var(--ink)]">{formatMoneyCompact(finance.payables, currency)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Target progress</dt><dd className="font-semibold text-[var(--ink)]">{targetProgress === null ? "No target" : `${targetProgress.toFixed(1)}%`}</dd></div>
          </dl>
        </div>

        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Inventory</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Active parts</dt><dd className="font-semibold text-[var(--ink)]">{inventory.activeParts}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Low stock</dt><dd className="font-semibold text-[var(--ink)]">{inventory.lowStockParts}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Stock value</dt><dd className="font-semibold text-[var(--ink)]">{formatMoneyCompact(inventory.inventoryValue, currency)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Open POs</dt><dd className="font-semibold text-[var(--ink)]">{inventory.openPurchaseOrders}</dd></div>
          </dl>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Job Status Distribution</p>
          <div className="mt-3 space-y-2">
            {repairs.statusDistribution.map((item) => (
              <div key={item.status} className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm">
                <span className="text-[var(--ink-muted)]">{statusLabel(item.status)}</span>
                <span className="font-semibold text-[var(--ink)]">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Top Low-Stock Parts</p>
          <div className="mt-3 space-y-2">
            {inventory.topLowStockParts.slice(0, 8).map((part) => (
              <div key={part.sku} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-[var(--ink)]">{part.name}</span>
                <span className="shrink-0 text-[var(--ink-muted)]">{part.qtyOnHand}/{part.reorderLevel}</span>
              </div>
            ))}
            {!inventory.lowStockParts ? <p className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-[var(--ink-muted)]">No low-stock parts detected.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
