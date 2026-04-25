import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUserRole } from "@/lib/session";

export default async function NotificationTemplatesPage() {
  const { user } = await getCurrentUserRole();
  if (!["ADMIN", "OPS"].includes(user.role)) {
    redirect("/dashboard");
  }

  return (
    <section className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Settings</p>
      <h1 className="mt-1 text-lg font-semibold text-[var(--ink)]">Communication Templates</h1>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        Manage reusable WhatsApp and email message templates for client updates.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/settings/notifications" className="btn-premium-secondary rounded-lg px-3 py-2 text-sm">
          Open Notification Center
        </Link>
      </div>
    </section>
  );
}
