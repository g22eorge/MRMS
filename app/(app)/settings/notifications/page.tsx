import { redirect } from "next/navigation";

import { getCurrentUserRole } from "@/lib/session";

export default async function NotificationSettingsPage() {
  const { user } = await getCurrentUserRole();

  async function updatePrefs(formData: FormData) {
    "use server";
    redirect("/settings/notifications?saved=true");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink)]">Notification Settings</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Configure how you receive alerts about job updates
        </p>
      </div>

      <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6">
        <p className="text-sm text-[var(--ink-muted)]">
          Notification preferences coming soon. Currently, all notifications are enabled by default.
        </p>
      </div>
    </div>
  );
}