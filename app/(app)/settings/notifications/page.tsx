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
      </div>

      <NotificationPrefsForm prefs={prefs} />
    </div>
  );
}
