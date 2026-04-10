import { redirect } from "next/navigation";

import { getCurrentUserRole } from "@/lib/session";
import { getUserPreferences, updateUserPreferences } from "@/lib/notifications";
import { can } from "@/lib/permissions";

export default async function NotificationSettingsPage() {
  const { user } = await getCurrentUserRole();
  const preferences = await getUserPreferences(user.id);

  async function updatePrefs(formData: FormData) {
    "use server";
    const { user: sessionUser } = await getCurrentUserRole();
    
    const data = {
      notifyStatusChange: formData.get("notifyStatusChange") === "on",
      notifyApprovalNeeded: formData.get("notifyApprovalNeeded") === "on",
      notifyJobAssigned: formData.get("notifyJobAssigned") === "on",
      notifyEstimateSubmitted: formData.get("notifyEstimateSubmitted") === "on",
      notifyPaymentReceived: formData.get("notifyPaymentReceived") === "on",
      notifyPayoutGenerated: formData.get("notifyPayoutGenerated") === "on",
      notifyTimelineUpdated: formData.get("notifyTimelineUpdated") === "on",
      notifyDelayNote: formData.get("notifyDelayNote") === "on",
      whatsappEnabled: formData.get("whatsappEnabled") === "on",
      emailEnabled: formData.get("emailEnabled") === "on",
    };

    await updateUserPreferences(sessionUser.id, data);
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

      <form action={updatePrefs} className="space-y-6">
        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6">
          <h2 className="text-lg font-semibold text-[var(--ink)]">Dashboard Notifications</h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            These notifications appear on your dashboard
          </p>

          <div className="mt-4 space-y-4">
            {[
              { key: "notifyStatusChange", label: "Status Changes", desc: "When job status changes (e.g., started, completed)" },
              { key: "notifyApprovalNeeded", label: "Approval Needed", desc: "When a job requires client approval" },
              { key: "notifyJobAssigned", label: "Job Assigned", desc: "When a job is assigned to you" },
              { key: "notifyEstimateSubmitted", label: "Estimate Submitted", desc: "When external tech submits estimate" },
              { key: "notifyPaymentReceived", label: "Payment Received", desc: "When payment is recorded" },
              { key: "notifyPayoutGenerated", label: "Payout Generated", desc: "When payout is generated for external tech" },
              { key: "notifyTimelineUpdated", label: "Timeline Updated", desc: "When repair timeline changes" },
              { key: "notifyDelayNote", label: "Delay Notes", desc: "When delay notes are added to a job" },
            ].map((item) => (
              <label key={item.key} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name={item.key}
                  defaultChecked={preferences[item.key as keyof typeof preferences]}
                  className="mt-1 h-4 w-4 rounded border-[var(--line)] text-[#D4AF37] focus:ring-[#D4AF37]"
                />
                <div>
                  <p className="text-sm font-medium text-[var(--ink)]">{item.label}</p>
                  <p className="text-xs text-[var(--ink-muted)]">{item.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6">
          <h2 className="text-lg font-semibold text-[var(--ink)]">Channels</h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Choose how you want to receive notifications
          </p>

          <div className="mt-4 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="whatsappEnabled"
                defaultChecked={preferences.whatsappEnabled}
                className="mt-1 h-4 w-4 rounded border-[var(--line)] text-[#D4AF37] focus:ring-[#D4AF37]"
              />
              <div>
                <p className="text-sm font-medium text-[var(--ink)]">WhatsApp</p>
                <p className="text-xs text-[var(--ink-muted)]">Receive updates via WhatsApp</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="emailEnabled"
                defaultChecked={preferences.emailEnabled}
                className="mt-1 h-4 w-4 rounded border-[var(--line)] text-[#D4AF37] focus:ring-[#D4AF37]"
              />
              <div>
                <p className="text-sm font-medium text-[var(--ink)]">Email</p>
                <p className="text-xs text-[var(--ink-muted)]">Receive updates via email</p>
              </div>
            </label>
          </div>
        </div>

        <button type="submit" className="btn-premium rounded-lg px-6 py-2.5 text-white">
          Save Preferences
        </button>
      </form>
    </div>
  );
}