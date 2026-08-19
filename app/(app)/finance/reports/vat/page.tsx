import Link from "next/link";
import { redirect } from "next/navigation";

import { StatCards } from "@/components/ui/StatCards";
import { PrintReportButton } from "@/components/reports/PrintReportButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { requireOrgSession } from "@/lib/org-context";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatMoneyCompact } from "@/lib/currency";
import { can } from "@/lib/permissions";
import { parsePeriodInt } from "@/lib/date-eat";

export const dynamic = "force-dynamic";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * VAT summary — document-computed (NOT journal-sourced). Output VAT is read
 * from the tax already stored on paid sales/invoices (Sale.vatAmount and
 * InvoiceLine.taxAmount); input VAT from supplier bills. This never touches the
 * ledger, where sale payments post revenue gross of VAT and VAT Payable (2100)
 * is currently unposted — so this is the only place the VAT actually charged is
 * surfaced. Output side is cash-basis (documents paid in the period); the
 * purchases side is by bill issue date.
 */
export default async function VatReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { user, orgId, org } = await requireOrgSession();
  if (!can.viewFinancials(user)) redirect("/dashboard");

  const sp = await searchParams;
  const currency = org.baseCurrency;
  const now = new Date();
  const year = parsePeriodInt(sp.year, now.getFullYear());
  const month = parsePeriodInt(sp.month, now.getMonth() + 1);
  const mode = sp.mode === "ytd" ? "ytd" : "month";

  const from = mode === "ytd" ? new Date(year, 0, 1) : new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);

  const paidWindow = { gte: from, lte: to };

  const [posAgg, invoiceGrossAgg, invoiceVatAgg, purchaseAgg] = await Promise.all([
    prisma.sale
      .aggregate({ where: { orgId, status: "PAID", paidAt: paidWindow }, _sum: { vatAmount: true, totalAmount: true } })
      .catch(() => ({ _sum: { vatAmount: 0, totalAmount: 0 } })),
    prisma.invoice
      .aggregate({ where: { orgId, status: "PAID", paidAt: paidWindow }, _sum: { totalAmount: true } })
      .catch(() => ({ _sum: { totalAmount: 0 } })),
    prisma.invoiceLine
      .aggregate({ where: { orgId, invoice: { status: "PAID", paidAt: paidWindow } }, _sum: { taxAmount: true } })
      .catch(() => ({ _sum: { taxAmount: 0 } })),
    prisma.supplierBill
      .aggregate({ where: { orgId, status: { not: "CANCELLED" }, issuedAt: paidWindow }, _sum: { taxAmount: true, subtotal: true } })
      .catch(() => ({ _sum: { taxAmount: 0, subtotal: 0 } })),
  ]);

  const posVat = posAgg._sum.vatAmount ?? 0;
  const posGross = posAgg._sum.totalAmount ?? 0;
  const invoiceVat = invoiceVatAgg._sum.taxAmount ?? 0;
  const invoiceGross = invoiceGrossAgg._sum.totalAmount ?? 0;

  const outputVat = posVat + invoiceVat;
  const grossRevenue = posGross + invoiceGross;
  const netRevenue = grossRevenue - outputVat;

  const inputVat = purchaseAgg._sum.taxAmount ?? 0;
  const purchasesNet = purchaseAgg._sum.subtotal ?? 0;
  const netVatPayable = outputVat - inputVat;

  const posNet = posGross - posVat;
  const invoiceNet = invoiceGross - invoiceVat;

  const hasData = grossRevenue > 0 || outputVat > 0 || inputVat > 0;

  const periodLabel = mode === "ytd" ? `Jan–${MONTHS[month - 1]} ${year} YTD` : `${MONTHS[month - 1]} ${year}`;

  type OutRow = { id: string; channel: string; gross: number; vat: number; net: number; kind: "channel" | "total" };
  const outputRows: OutRow[] = [
    { id: "pos", channel: "POS Sales", gross: posGross, vat: posVat, net: posNet, kind: "channel" },
    { id: "invoices", channel: "Invoices", gross: invoiceGross, vat: invoiceVat, net: invoiceNet, kind: "channel" },
    { id: "total", channel: "Total Output", gross: grossRevenue, vat: outputVat, net: netRevenue, kind: "total" },
  ];

  return (
    <div className="print-area space-y-4">
      <PageHeader
        eyebrow="Finance"
        title="VAT Summary"
        description={periodLabel}
        actions={
          <>
            <PrintReportButton />
            <Link
              href={`/finance/reports/pl?year=${year}&month=${month}`}
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--panel-strong)]"
            >
              Profit &amp; Loss →
            </Link>
          </>
        }
      />

      {/* ── VAT POSITION SUMMARY ─────────────────────────────────────────── */}
      {hasData && (
        <div className={`rounded-xl border px-5 py-4 ${netVatPayable >= 0 ? "border-amber-500/30 bg-amber-500/8" : "border-emerald-500/30 bg-emerald-500/8"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                Net VAT {netVatPayable >= 0 ? "Payable" : "Reclaimable"} — {periodLabel}
              </p>
              <p className={`mt-1 text-[1.75rem] font-black leading-none tabular-nums ${netVatPayable >= 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {netVatPayable < 0 ? "−" : ""}{formatMoney(Math.abs(netVatPayable), currency)}
              </p>
              <p className="mt-1 text-[0.8125rem] text-[var(--ink-muted)]">
                Output VAT {formatMoneyCompact(outputVat, currency)} − Input VAT {formatMoneyCompact(inputVat, currency)}
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <p className="text-[0.6875rem] uppercase tracking-wide text-[var(--ink-muted)]">Net Revenue (ex-VAT)</p>
                <p className="text-[1.0625rem] font-black tabular-nums text-emerald-600 dark:text-emerald-400">{formatMoneyCompact(netRevenue, currency)}</p>
              </div>
              <div>
                <p className="text-[0.6875rem] uppercase tracking-wide text-[var(--ink-muted)]">Gross Revenue</p>
                <p className="text-[1.0625rem] font-black tabular-nums text-[var(--ink)]">{formatMoneyCompact(grossRevenue, currency)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PERIOD SELECTOR ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <form method="GET" className="no-print flex items-center gap-2">
          <input type="hidden" name="mode" value={mode} />
          <select name="month" defaultValue={month} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[0.8125rem]">
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select name="year" defaultValue={year} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[0.8125rem]">
            {[year - 2, year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black">View</button>
        </form>

        <div className="flex rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-0.5">
          <Link
            href={`/finance/reports/vat?year=${year}&month=${month}&mode=month`}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${mode === "month" ? "bg-[var(--panel)] text-[var(--ink)] shadow-sm" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
          >
            Monthly
          </Link>
          <Link
            href={`/finance/reports/vat?year=${year}&month=${month}&mode=ytd`}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${mode === "ytd" ? "bg-[var(--panel)] text-[var(--ink)] shadow-sm" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
          >
            YTD
          </Link>
        </div>
      </div>

      {!hasData ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] py-14 text-center">
          <p className="text-sm font-medium text-[var(--ink-muted)]">No sales, invoices or purchases in this period.</p>
        </div>
      ) : (
        <>
          {/* ── KPI cards ──────────────────────────────────────────────────── */}
          <StatCards
            columns={4}
            cards={[
              { key: "net", label: "Net Revenue (ex-VAT)", value: formatMoneyCompact(netRevenue, currency), tone: "good", muted: netRevenue === 0 },
              { key: "output", label: "VAT Collected", value: formatMoneyCompact(outputVat, currency), tone: "accent", muted: outputVat === 0 },
              { key: "input", label: "VAT on Purchases", value: formatMoneyCompact(inputVat, currency), tone: "neutral", muted: inputVat === 0 },
              { key: "payable", label: `Net VAT ${netVatPayable >= 0 ? "Payable" : "Reclaimable"}`, value: formatMoneyCompact(Math.abs(netVatPayable), currency), tone: netVatPayable >= 0 ? "warn" : "good", muted: netVatPayable === 0 },
            ]}
          />

          {/* ── OUTPUT VAT BY CHANNEL ──────────────────────────────────────── */}
          <section className="dc-card overflow-hidden">
            <div className="border-b border-[var(--line)] px-4 py-2.5">
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-[var(--ink-muted)]/70">Output VAT — Sales Collected in {periodLabel}</p>
            </div>
            <DataTable
              frameless
              dense
              rows={outputRows}
              getRowKey={(row) => row.id}
              rowClassName={(row) => (row.kind === "total" ? "bg-[var(--panel-strong)]" : undefined)}
              columns={[
                {
                  key: "channel",
                  header: "Channel",
                  cell: (row) => <span className={row.kind === "total" ? "text-sm font-bold text-[var(--ink)]" : "text-[var(--ink)]"}>{row.channel}</span>,
                },
                {
                  key: "gross",
                  header: "Gross (incl. VAT)",
                  align: "right",
                  className: "w-32 whitespace-nowrap tabular-nums",
                  cell: (row) => <span className={row.kind === "total" ? "text-sm font-bold tabular-nums" : "tabular-nums text-[var(--ink-muted)]"}>{formatMoney(row.gross, currency)}</span>,
                },
                {
                  key: "vat",
                  header: "VAT",
                  align: "right",
                  className: "w-28 whitespace-nowrap tabular-nums",
                  cell: (row) => <span className={`tabular-nums ${row.kind === "total" ? "text-sm font-bold text-[var(--accent)]" : "font-medium text-[var(--accent)]"}`}>{formatMoney(row.vat, currency)}</span>,
                },
                {
                  key: "net",
                  header: "Net (ex-VAT)",
                  align: "right",
                  className: "w-32 whitespace-nowrap tabular-nums",
                  cell: (row) => <span className={row.kind === "total" ? "text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400" : "tabular-nums"}>{formatMoney(row.net, currency)}</span>,
                },
              ]}
            />
          </section>

          {/* ── INPUT VAT / NET POSITION ───────────────────────────────────── */}
          <section className="dc-card overflow-hidden">
            <div className="border-b border-[var(--line)] px-4 py-2.5">
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-[var(--ink-muted)]/70">Input VAT — Purchases (bills issued in {periodLabel})</p>
            </div>
            <dl className="divide-y divide-[var(--line)]">
              {[
                ["Net purchases (ex-VAT)", formatMoney(purchasesNet, currency)],
                ["Input VAT (reclaimable)", formatMoney(inputVat, currency)],
                ["Output VAT (collected)", formatMoney(outputVat, currency)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <dt className="text-[0.8125rem] text-[var(--ink-muted)]">{label}</dt>
                  <dd className="text-[0.8125rem] font-semibold tabular-nums text-[var(--ink)]">{value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between bg-[var(--panel-strong)] px-4 py-3">
                <dt className="text-sm font-bold text-[var(--ink)]">Net VAT {netVatPayable >= 0 ? "Payable" : "Reclaimable"}</dt>
                <dd className={`text-base font-black tabular-nums ${netVatPayable >= 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {netVatPayable < 0 ? "−" : ""}{formatMoney(Math.abs(netVatPayable), currency)}
                </dd>
              </div>
            </dl>
          </section>

          <p className="px-1 text-[0.6875rem] text-[var(--ink-muted)]">
            Output VAT is the tax on sales and invoices paid in the period (cash basis). Input VAT is from supplier bills issued in the period. This summary reads tax stored on documents and does not post to the accounting ledger.
          </p>
        </>
      )}
    </div>
  );
}
