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

/**
 * Severity, carried as data.
 *
 * Status is never colour alone. A hue is invisible to roughly one man in twelve,
 * and it is invisible to everyone scanning a page quickly — so each level ships
 * with a word and a shape as well. The colours are the reserved status palette:
 * they mean state, and are never reused to distinguish one series from another.
 */
type Severity = "critical" | "serious" | "warning" | "good" | "neutral";
type Risk = { severity: Severity; text: string };
const r = (severity: Severity, text: string): Risk => ({ severity, text });

const SEVERITY: Record<Severity, { label: string; dot: string; stripe: string; chip: string }> = {
  critical: { label: "Act today", dot: "bg-red-500",     stripe: "bg-red-500",     chip: "text-red-600 dark:text-red-400" },
  serious:  { label: "This week", dot: "bg-amber-500",   stripe: "bg-amber-500",   chip: "text-amber-700 dark:text-amber-400" },
  warning:  { label: "Watch",     dot: "bg-sky-500",     stripe: "bg-sky-500",     chip: "text-sky-700 dark:text-sky-400" },
  good:     { label: "Healthy",   dot: "bg-emerald-500", stripe: "bg-emerald-500", chip: "text-emerald-700 dark:text-emerald-400" },
  neutral:  { label: "",          dot: "bg-[var(--ink-muted)]/40", stripe: "bg-[var(--line)]", chip: "text-[var(--ink-muted)]" },
};

/**
 * A figure, and what it means.
 *
 * The value stays in ink rather than wearing the status colour: colour on a
 * number reads as decoration and stops being a signal once several numbers have
 * it. The state is carried beside it by a dot and a word, which survives being
 * printed, being scanned, and being read by someone who cannot see the hue.
 */
function KpiCard({
  title, value, caption, tone = "neutral",
}: { title: string; value: string; caption: string; tone?: Severity }) {
  const s = SEVERITY[tone];
  return (
    <section className="dc-card relative overflow-hidden px-3 py-2.5 pl-4">
      {/* A severity stripe, so the state is legible before any text is read. */}
      <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${s.stripe}`} />
      {/* Title, value, then state. Stacked rather than title-and-chip on one
          row: four tiles across a half-width pane leaves no room for both, and
          the chip truncated to "This w.." — a status label that cannot be read
          is worse than none, since it still takes the space and the attention. */}
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">{title}</p>
      <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-[var(--ink)]">{value}</p>
      {s.label ? (
        <span className={`mt-1 flex items-center gap-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] ${s.chip}`}>
          <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
          {s.label}
        </span>
      ) : null}
      <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{caption}</p>
    </section>
  );
}

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
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]">Collected</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-[var(--ink)]">{formatMoneyCompact(today.collected, currency)}</p>
          <p className="text-[0.75rem] text-[var(--ink-muted)]">
            {today.collectedYesterday === 0 && today.collected === 0
              ? "nothing yesterday either"
              : `${vsYesterday >= 0 ? "+" : "−"}${formatMoneyCompact(Math.abs(vsYesterday), currency)} vs yesterday`}
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]">Spent</p>
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

/**
 * The risk list: ordered by severity, and showing it.
 *
 * Previously every item was an identical bordered box, so nine overdue invoices
 * and a mild note about stale updates read with exactly the same weight. The
 * list is now sorted worst-first and each row carries a stripe, a dot and a
 * word — the same three encodings as the tiles, so the two agree.
 */
const SEVERITY_ORDER: Severity[] = ["critical", "serious", "warning", "good", "neutral"];

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
          title="Cash Received"
          value={formatMoneyCompact(finance.cashReceived, currency)}
          caption={`${trendLabel(finance.cashReceived, finance.cashReceivedPrev)} · ${formatMoneyCompact(finance.completedRepairValue, currency)} completed repair value`}
          tone={finance.cashReceived >= finance.cashReceivedPrev ? "good" : "serious"}
        />
        <KpiCard title="Cash after costs" value={formatMoneyCompact(finance.cashMarginSignal, currency)} caption={`Expenses: ${formatMoneyCompact(finance.expenses, currency)} (${trendLabel(finance.expenses, finance.expensesPrev)})`} tone={finance.cashMarginSignal >= 0 ? "good" : "critical"} />
        <KpiCard title="Open Pipeline" value={String(repairs.openJobs)} caption={`${repairs.overdueJobs} older than 7 days; ${repairs.staleJobs} stale updates`} tone={repairs.overdueJobs ? "serious" : "neutral"} />
        <KpiCard title="Low stock" value={String(inventory.lowStockParts)} caption={`${formatMoneyCompact(inventory.inventoryValue, currency)} stock value; ${plural(inventory.openPurchaseOrders, "open purchase order")}`} tone={inventory.lowStockParts ? "warning" : "good"} />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <RiskCard title="Needs your attention" items={risks} empty="Nothing needs chasing right now." />
        <ActionCard title="What to do next" items={recommendations} empty="Nothing to act on today." />
      </div>

      <section className="grid gap-4 xl:grid-cols-4">
        <div className="dc-card px-3 py-2.5">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Repairs</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">New jobs</dt><dd className="font-semibold text-[var(--ink)]">{repairs.jobsThisMonth} <span className="text-[0.75rem] font-medium text-[var(--ink-muted)]">({trendLabel(repairs.jobsThisMonth, repairs.jobsPrevMonth)})</span></dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Completed</dt><dd className="font-semibold text-[var(--ink)]">{repairs.completedThisMonth}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Avg turnaround</dt><dd className="font-semibold text-[var(--ink)]">{repairs.averageTurnaroundDays.toFixed(1)} days</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Completed repair value</dt><dd className="font-semibold text-[var(--ink)]">{formatMoneyCompact(finance.completedRepairValue, currency)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Repair collections</dt><dd className="font-semibold text-[var(--ink)]">{formatMoneyCompact(finance.cashReceivedByChannel.repairs, currency)}</dd></div>
          </dl>
        </div>

        <div className="dc-card px-3 py-2.5">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Sales</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">POS cash received</dt><dd className="font-semibold text-[var(--ink)]">{formatMoneyCompact(sales.posCashReceived, currency)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Invoice payments</dt><dd className="font-semibold text-[var(--ink)]">{formatMoneyCompact(sales.invoiceCashReceived, currency)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Open leads</dt><dd className="font-semibold text-[var(--ink)]">{sales.openLeads}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Pipeline value</dt><dd className="font-semibold text-[var(--ink)]">{formatMoneyCompact(sales.pipelineValue, currency)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Won leads</dt><dd className="font-semibold text-[var(--ink)]">{sales.wonLeads}</dd></div>
          </dl>
        </div>

        <div className="dc-card px-3 py-2.5">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Finance</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Expenses</dt><dd className="font-semibold text-[var(--ink)]">{formatMoneyCompact(finance.expenses, currency)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Receivables</dt><dd className="font-semibold text-[var(--ink)]">{formatMoneyCompact(finance.receivables, currency)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Payables</dt><dd className="font-semibold text-[var(--ink)]">{formatMoneyCompact(finance.payables, currency)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Target progress</dt><dd className="font-semibold text-[var(--ink)]">{targetProgress === null ? "No target" : `${targetProgress.toFixed(1)}%`}</dd></div>
          </dl>
        </div>

        <div className="dc-card px-3 py-2.5">
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
        <div className="dc-card px-3 py-2.5">
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

        <div className="dc-card px-3 py-2.5">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Top Low-Stock Parts</p>
          <div className="mt-3 space-y-2">
            {inventory.topLowStockParts.slice(0, 8).map((part) => (
              <div key={part.sku} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-[var(--ink)]">{part.name}</span>
                <span className="shrink-0 text-[var(--ink-muted)]">{part.qtyOnHand}/{part.reorderLevel}</span>
              </div>
            ))}
            {!inventory.lowStockParts ? <p className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-[var(--ink-muted)]">Every part is above its reorder level.</p> : null}
          </div>
        </div>
      </section>
        </>
      }
    />
  );
}
