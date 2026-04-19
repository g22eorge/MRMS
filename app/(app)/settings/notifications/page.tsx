import Link from "next/link";

import { getUserPreferences } from "@/lib/notifications";
import { getCurrentUserRole } from "@/lib/session";

import { NotificationPrefsForm } from "@/components/settings/NotificationPrefsForm";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  const { user } = await getCurrentUserRole();
  const prefs = await getUserPreferences(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink)]">Notification Settings</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">Choose which job events should alert you.</p>
        {user.role === "ADMIN" || user.role === "OPS" ? (
          <div className="mt-3">
            <Link
              href="/settings/notifications/outbox"
              className="btn-premium-secondary inline-block rounded-md px-4 py-2 text-sm"
            >
              View Outbox
            </Link>
          </div>
        ) : null}
      </div>

      <NotificationPrefsForm prefs={prefs} />
    </div>
  );
}
