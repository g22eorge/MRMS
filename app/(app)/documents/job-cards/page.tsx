import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUserRole } from "@/lib/session";

export default async function JobCardsPage() {
  const { user } = await getCurrentUserRole();
  if (!["ADMIN", "OPS", "INTAKE", "TECHNICIAN_INTERNAL"].includes(user.role)) {
    redirect("/dashboard");
  }

  return (
    <section className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">Documents</p>
      <h1 className="mt-1 text-lg font-semibold text-[var(--ink)]">Job Cards</h1>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        Generate and review job card records from the jobs workspace.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/jobs" className="btn-premium-secondary rounded-lg px-3 py-2 text-sm">
          Open Jobs
        </Link>
      </div>
    </section>
  );
}
