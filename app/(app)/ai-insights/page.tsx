import Link from "next/link";
import { KpiCard, Stat, SummaryCard, SEVERITY, SEVERITY_ORDER, type Severity } from "@/components/insights/severity";
import { redirect } from "next/navigation";
import { plural } from "@/lib/plural";

import { BusinessCopilot } from "@/components/ai-insights/BusinessCopilot";
import { InsightsWorkspace } from "@/components/ai-insights/InsightsWorkspace";
import { buildBusinessDataPack, pctChange, trendLabel } from "@/lib/ai/business-metrics";
import { formatMoneyCompact } from "@/lib/currency";
import { can } from "@/lib/permissions";
import { getCurrentUserRole } from "@/lib/session";

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// Risk carries a severity assigned where it is built, from the condition that
// produced it — not inferred from its wording later.
type Risk = { severity: Severity; text: string };
const r = (severity: Severity, text: string): Risk => ({ severity, text });

/**
 * Today, at the top, because it is the question asked most often.
 *
 * "How much have I collected today?" is what someone asks at closing time, and
 * until now the page could not answer it — every figure was a calendar month,
 * so the smallest window was "this month so far".
 *
 * Deliberately without severity chips, unlike everything below it. A partial
 * day cannot be judged: at nine in the morning you have collected nothing and
 * spent nothing, and painting that red would be noise that teaches people to
 * ignore the colours that do mean something. Today is reported; the month is
 * assessed.
 */
function TodayStrip({
  today, currency,
}: {
  today: { date: string; collected: number; collectedYesterday: number; spent: number; expensesPaid: number; supplierPaid: number; netCash: number };
  currency: string;
}) {
  const vsYesterday = today.collected - today.collectedYesterday;
  const day = new Date(`${today.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return (
    <section className="dc-card px-4 py-3">
      {/* The date is a header, and the three figures a grid — as an inline flex
          row the fourth item wrapped alone onto its own line, which read as a
          mistake rather than a layout. A grid wraps two-and-two, which looks
          deliberate at any width. */}
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
        Today <span className="ml-1.5 font-normal normal-case tracking-normal text-[var(--ink-muted)]/80">{day}</span>
      </p>
      <div className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        <div className="min-w-0">
          <Link href="/finance" className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]">Collected</Link>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-[var(--ink)]">{formatMoneyCompact(today.collected, currency)}</p>
          <p className="text-[0.75rem] text-[var(--ink-muted)]">
            {today.collectedYesterday === 0 && today.collected === 0
              ? "nothing yesterday either"
              : `${vsYesterday >= 0 ? "+" : "−"}${formatMoneyCompact(Math.abs(vsYesterday), currency)} vs yesterday`}
          </p>
        </div>

        <div className="min-w-0">
          <Link href="/finance/expenses" className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]">Spent</Link>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-[var(--ink)]">{formatMoneyCompact(today.spent, currency)}</p>
          <p className="text-[0.75rem] text-[var(--ink-muted)]">
            {formatMoneyCompact(today.expensesPaid, currency)} expenses · {formatMoneyCompact(today.supplierPaid, currency)} suppliers
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]">Net</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-[var(--ink)]">{formatMoneyCompact(today.netCash, currency)}</p>
          <p className="text-[0.75rem] text-[var(--ink-muted)]">collected less spent</p>
        </div>
      </div>
    </section>
  );
}



/** A short delta, for beside a figure. The long form wrapped every first row. */
function delta(current: number, previous: number): string | undefined {
  if (previous === 0 && current === 0) return undefined;
  const change = pctChange(current, previous);
  return `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(0)}%`;
}

/**
 * The risk list: ordered by severity, and showing it.
 *
 * Previously every item was an identical bordered box, so nine overdue invoices
 * and a mild note about stale updates read with exactly the same weight. The
 * list is now sorted worst-first and each row carries a stripe, a dot and a
 * word — the same three encodings as the tiles, so the two agree.
 */

function RiskCard({ title, items, empty }: { title: string; items: Risk[]; empty: string }) {
  const sorted = [...items].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
  return (
    <section className="dc-card px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">{title}</p>
        {sorted.length ? (
          <span className="text-[0.6875rem] font-semibold tabular-nums text-[var(--ink-muted)]">{sorted.length}</span>
        ) : null}
      </div>
      {sorted.length ? (
        <ul className="mt-3 space-y-1.5">
          {sorted.map((item) => {
            const s = SEVERITY[item.severity];
            return (
              <li key={item.text} className="relative overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] py-2 pl-4 pr-3">
                <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${s.stripe}`} />
                <span className={`mb-0.5 flex items-center gap-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] ${s.chip}`}>
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
                <span className="block text-sm leading-6 text-[var(--ink)]">{item.text}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-sm text-[var(--ink-muted)]">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
          {empty}
        </p>
      )}
    </section>
  );
}

/**
 * The action list.
 *
 * Numbered, unlike the risks — because here the order is the content. These are
 * ranked by what to do first, and a reader who does only the first one has done
 * the most useful thing available. Numbering a list that is not a sequence would
 * be decoration; numbering this one is information.
 */
function ActionCard({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section className="dc-card px-3 py-2.5">
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">{title}</p>
      {items.length ? (
        <ol className="mt-3 space-y-1.5">
          {items.map((item, i) => (
            <li key={item} className="flex gap-2.5 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/12 text-[0.6875rem] font-bold tabular-nums text-[var(--accent)]">
                {i + 1}
              </span>
              <span className="text-sm leading-6 text-[var(--ink)]">{item}</span>
            </li>
          ))}
        </ol>
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

  // Severity is assigned where the item is built, from the condition that
  // produced it — not inferred from the wording later. "critical" is money
  // already at risk or leaving; "serious" is work that has stalled long enough
  // to cost a customer; "warning" is worth knowing before it becomes either.
  const risks: Risk[] = [
    repairs.overdueJobs ? r("serious", `${plural(repairs.overdueJobs, "open repair job")} ${repairs.overdueJobs === 1 ? "is" : "are"} older than 7 days. Prioritise diagnosis, approvals, parts, or technician reassignment.`) : null,
    repairs.staleJobs ? r("warning", `${plural(repairs.staleJobs, "open job")} ${repairs.staleJobs === 1 ? "has" : "have"} not been updated for 3+ days. Ask owners to add notes or move status.`) : null,
    repairs.awaitingApproval ? r("warning", `${plural(repairs.awaitingApproval, "job")} ${repairs.awaitingApproval === 1 ? "is" : "are"} awaiting client approval. Follow up before they become stale.`) : null,
    repairs.waitingForParts ? r("warning", `${plural(repairs.waitingForParts, "job")} ${repairs.waitingForParts === 1 ? "is" : "are"} waiting for parts. Check low-stock items and pending purchase orders.`) : null,
    inventory.lowStockParts ? r("warning", `${inventory.lowStockParts} active part(s) are at or below reorder level. Review Stock Alerts and create purchase requests/orders.`) : null,
    finance.overdueInvoices ? r("critical", `${plural(finance.overdueInvoices, "invoice")} ${finance.overdueInvoices === 1 ? "is" : "are"} overdue. Receivables at risk: ${formatMoneyCompact(finance.receivables, currency)}.`) : null,
    finance.overdueSupplierBills ? r("serious", `${plural(finance.overdueSupplierBills, "supplier bill")} ${finance.overdueSupplierBills === 1 ? "is" : "are"} overdue. Payables outstanding: ${formatMoneyCompact(finance.payables, currency)}.`) : null,
    finance.cashReceived < finance.cashReceivedPrev ? r("serious", `Cash received is down ${Math.abs(pctChange(finance.cashReceived, finance.cashReceivedPrev)).toFixed(1)}% versus last month. Review collections, POS sales, and invoice payments.`) : null,
    finance.cashMarginSignal < 0 ? r("critical", `You are spending more than you are taking in, once expenses and external repair costs are counted. Cut non-essential spend or chase collections.`) : null,
  ].filter((item): item is Risk => Boolean(item));

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
    <InsightsWorkspace
      copilot={<BusinessCopilot />}
      figures={
        <>
      <TodayStrip today={data.today} currency={currency} />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          href="/finance"
          title="Cash Received"
          value={formatMoneyCompact(finance.cashReceived, currency)}
          caption={`${trendLabel(finance.cashReceived, finance.cashReceivedPrev)} · ${formatMoneyCompact(finance.completedRepairValue, currency)} completed repair value`}
          tone={finance.cashReceived >= finance.cashReceivedPrev ? "good" : "serious"}
        />
        <KpiCard href="/finance" title="Cash after costs" value={formatMoneyCompact(finance.cashMarginSignal, currency)} caption={`Expenses: ${formatMoneyCompact(finance.expenses, currency)} (${trendLabel(finance.expenses, finance.expensesPrev)})`} tone={finance.cashMarginSignal >= 0 ? "good" : "critical"} />
        <KpiCard href="/jobs" title="Open Pipeline" value={String(repairs.openJobs)} caption={`${repairs.overdueJobs} older than 7 days; ${repairs.staleJobs} stale updates`} tone={repairs.overdueJobs ? "serious" : "neutral"} />
        <KpiCard href="/inventory" title="Low stock" value={String(inventory.lowStockParts)} caption={`${formatMoneyCompact(inventory.inventoryValue, currency)} stock value; ${plural(inventory.openPurchaseOrders, "open purchase order")}`} tone={inventory.lowStockParts ? "warning" : "good"} />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <RiskCard title="Needs your attention" items={risks} empty="Nothing needs chasing right now." />
        <ActionCard title="What to do next" items={recommendations} empty="Nothing to act on today." />
      </div>

      <section className="grid gap-4 xl:grid-cols-4">
        {/* Destinations are only attached where the route is known to show that
            figure. Rows without one — an average, a value that is not itself a
            list — stay plain, because a link that lands on an unfiltered page is
            a small betrayal each time someone follows it. */}
        <SummaryCard title="Repairs" href="/jobs">
          <Stat label="New jobs" value={String(repairs.jobsThisMonth)} sub={delta(repairs.jobsThisMonth, repairs.jobsPrevMonth)} href="/jobs" />
          <Stat label="Completed" value={String(repairs.completedThisMonth)} href="/jobs" />
          <Stat label="Avg turnaround" value={`${repairs.averageTurnaroundDays.toFixed(1)} days`} />
          <Stat label="Completed repair value" value={formatMoneyCompact(finance.completedRepairValue, currency)} />
          <Stat label="Repair collections" value={formatMoneyCompact(finance.cashReceivedByChannel.repairs, currency)} />
        </SummaryCard>

        <SummaryCard title="Sales" href="/sales">
          <Stat label="POS cash received" value={formatMoneyCompact(sales.posCashReceived, currency)} href="/pos" />
          <Stat label="Invoice payments" value={formatMoneyCompact(sales.invoiceCashReceived, currency)} href="/documents/invoices" />
          <Stat label="Open leads" value={String(sales.openLeads)} href="/sales/leads" />
          <Stat label="Pipeline value" value={formatMoneyCompact(sales.pipelineValue, currency)} href="/sales/leads" />
          <Stat label="Won leads" value={String(sales.wonLeads)} href="/sales/leads" />
        </SummaryCard>

        <SummaryCard title="Finance" href="/finance">
          <Stat label="Expenses" value={formatMoneyCompact(finance.expenses, currency)} href="/finance/expenses" />
          <Stat label="Receivables" value={formatMoneyCompact(finance.receivables, currency)} href="/documents/invoices" />
          <Stat label="Payables" value={formatMoneyCompact(finance.payables, currency)} href="/finance" />
          <Stat label="Target progress" value={targetProgress === null ? "No target" : `${targetProgress.toFixed(1)}%`} href="/targets" />
        </SummaryCard>

        <SummaryCard title="Inventory" href="/inventory">
          <Stat label="Active parts" value={String(inventory.activeParts)} href="/inventory" />
          <Stat label="Low stock" value={String(inventory.lowStockParts)} href="/inventory" />
          <Stat label="Stock value" value={formatMoneyCompact(inventory.inventoryValue, currency)} href="/inventory" />
          <Stat label="Open POs" value={String(inventory.openPurchaseOrders)} href="/inventory/purchase-orders" />
        </SummaryCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="dc-card px-3 py-2.5">
          <Link href="/jobs" className="group inline-flex items-center gap-1 text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]">Job Status Distribution<span aria-hidden className="opacity-0 transition-opacity group-hover:opacity-100">→</span></Link>
          {/* A distribution, drawn as one. As nine "status: count" rows you had
              to read every number and hold them in your head to see where work
              was piling up; the bar shows that shape before you read anything.
              Sorted by size for the same reason — the pile is the question.

              One series, so no legend: the card title names it. The count stays
              in ink beside the bar rather than inside it, because a number on a
              coloured fill stops being legible the moment the bar is short. */}
          {(() => {
            const rows = [...repairs.statusDistribution].sort((a, b) => b.count - a.count);
            const max = Math.max(1, ...rows.map((r) => r.count));
            return (
              <div className="mt-3 space-y-1.5">
                {rows.map((item) => (
                  <div key={item.status} className="flex items-center gap-2.5 text-sm">
                    <span className="w-[42%] shrink-0 truncate text-[0.8125rem] text-[var(--ink-muted)]">{statusLabel(item.status)}</span>
                    <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--panel-strong)] ring-1 ring-inset ring-[var(--line)]">
                      <span
                        className="block h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${Math.max(item.count > 0 ? 6 : 0, (item.count / max) * 100)}%` }}
                      />
                    </span>
                    <span className="w-7 shrink-0 text-right text-[0.8125rem] font-semibold tabular-nums text-[var(--ink)]">{item.count}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        <div className="dc-card px-3 py-2.5">
          <Link href="/inventory" className="group inline-flex items-center gap-1 text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]">Top Low-Stock Parts<span aria-hidden className="opacity-0 transition-opacity group-hover:opacity-100">→</span></Link>
          {/* Not a distribution — a quantity against a threshold. "12/20" makes
              you do the arithmetic for every row; the bar shows how far below
              reorder level each part is, which is the actual question.

              The fill is capped at the reorder level, so a full bar means "at
              the line" rather than "plenty". Out of stock is the reserved
              critical colour and says so in words, because a bar of zero width
              is indistinguishable from a bar that failed to render. */}
          <div className="mt-3 space-y-2">
            {inventory.topLowStockParts.slice(0, 8).map((part) => {
              const level = Math.max(1, part.reorderLevel);
              const pct = Math.min(100, (part.qtyOnHand / level) * 100);
              const out = part.qtyOnHand <= 0;
              return (
                <div key={part.sku} className="text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[0.8125rem] text-[var(--ink)]">{part.name}</span>
                    <span className={`shrink-0 text-[0.75rem] font-semibold tabular-nums ${out ? "text-red-600 dark:text-red-400" : "text-[var(--ink-muted)]"}`}>
                      {out ? "Out of stock" : `${part.qtyOnHand} of ${part.reorderLevel}`}
                    </span>
                  </div>
                  <span className="mt-1 block h-2 w-full overflow-hidden rounded-full bg-[var(--panel-strong)] ring-1 ring-inset ring-[var(--line)]">
                    <span
                      className={`block h-full rounded-full ${out ? "bg-red-500" : "bg-amber-500"}`}
                      style={{ width: `${out ? 100 : Math.max(4, pct)}%` }}
                    />
                  </span>
                </div>
              );
            })}
            {!inventory.lowStockParts ? <p className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-[var(--ink-muted)]">Every part is above its reorder level.</p> : null}
          </div>
        </div>
      </section>
        </>
      }
    />
  );
}
