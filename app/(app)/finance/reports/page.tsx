import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/session";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function FinanceReportsPage() {
  const { user } = await getCurrentUserRole();
  if (!can.viewFinancials(user)) redirect("/dashboard");

  const reports = [
    {
      href: "/finance/reports/pl",
      title: "Profit & Loss",
      desc: "Income vs expenses by period with category breakdown and net profit.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
        </svg>
      ),
    },
    {
      href: "/finance/reports/balance-sheet",
      title: "Balance Sheet",
      desc: "Assets, liabilities and equity snapshot with financial ratios.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
      ),
    },
    {
      href: "/finance/reports/cash-flow",
      title: "Cash Flow",
      desc: "Operating inflows and outflows, bank activity and expense breakdown.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
    },
    {
      href: "/finance/reports/trial-balance",
      title: "Trial Balance",
      desc: "Every account's debit and credit balance, proving the books balance.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
          <path d="M12 3v18M3 7h18M6 7l-3 6h6l-3-6zM18 7l-3 6h6l-3-6z"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Finance"
        title="Financial Reports"
        description="Statements, analysis and export tools"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="dc-card flex flex-col gap-2 p-5 transition hover:shadow-[var(--dc-shadow-hover)]"
          >
            <span className="text-[var(--accent)]">{r.icon}</span>
            <p className="font-semibold text-[var(--ink)]">{r.title}</p>
            <p className="text-[12px] text-[var(--ink-muted)]">{r.desc}</p>
            <p className="mt-auto text-[13px] font-semibold text-[var(--accent)]">Open Report →</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
