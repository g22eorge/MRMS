import Link from "next/link";
import { redirect } from "next/navigation";

import { COMMUNICATIONS_ROUTES } from "@/lib/communications/routes";
import { getUserPreferences } from "@/lib/notifications";
import { getCurrentUserRole } from "@/lib/session";
import { can } from "@/lib/permissions";

import { NotificationPrefsForm } from "@/components/settings/NotificationPrefsForm";
import { PaymentReminderSettingsCard } from "@/components/settings/PaymentReminderSettingsCard";
import { WhatsAppReadinessNotice } from "@/components/notifications/WhatsAppReadinessNotice";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  const { user } = await getCurrentUserRole();
  if (!can.viewNotifications(user)) {
    redirect("/dashboard");
  }
  const prefs = await getUserPreferences(user.id);

  // Reminders speak to customers without a person deciding to, so the control
  // sits with ADMIN alone rather than with everyone who can read notifications.
  const canManageReminders = user.role === "ADMIN";
  const reminderSettings = canManageReminders && user.orgId
    ? await prisma.paymentReminderSettings.findUnique({ where: { orgId: user.orgId } })
    : null;

  const canSeeOutbox = user.role === "ADMIN" || user.role === "OPS";
  const canSeeTemplates = user.role === "ADMIN" || user.role === "OPS";
  const canSeeWhatsApp = user.role === "ADMIN";

  return (
    <div className="space-y-4">
      {/* Said here because this is where reminders are switched on. Renders
          nothing once WhatsApp is configured. */}
      <WhatsAppReadinessNotice orgId={user.orgId ?? undefined} />

      {/* Header */}
      <div className="dc-card overflow-hidden px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[0.8125rem] font-bold text-[var(--ink)]">Notifications</p>
          </div>
          {(canSeeOutbox || canSeeTemplates || canSeeWhatsApp) && (
            <div className="flex flex-wrap gap-1.5">
              {canSeeOutbox && (
                <Link href={COMMUNICATIONS_ROUTES.outbox} className="btn-premium-secondary rounded-lg px-3 py-1.5 text-xs">
                  Outbox
                </Link>
              )}
              {canSeeTemplates && (
                <Link href={COMMUNICATIONS_ROUTES.templates} className="btn-premium-secondary rounded-lg px-3 py-1.5 text-xs">
                  Templates
                </Link>
              )}
              {canSeeWhatsApp && (
                <Link href={COMMUNICATIONS_ROUTES.whatsapp} className="btn-premium-secondary rounded-lg px-3 py-1.5 text-xs">
                  WhatsApp
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {canManageReminders && user.orgId ? (
        <PaymentReminderSettingsCard
          orgId={user.orgId}
          settings={reminderSettings ? {
            enabled: reminderSettings.enabled,
            dryRun: reminderSettings.dryRun,
            paymentTermsDays: reminderSettings.paymentTermsDays,
            manualReviewAbove: reminderSettings.manualReviewAbove,
            statementForMultiInvoice: reminderSettings.statementForMultiInvoice,
            quietHourStart: reminderSettings.quietHourStart,
            quietHourEnd: reminderSettings.quietHourEnd,
          } : null}
        />
      ) : null}

      {canSeeOutbox ? (
        <div className="dc-card flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Outbox</p>
            <p className="text-xs text-[var(--ink-muted)]">Delivery status for WhatsApp and email.</p>
          </div>
          <Link
            href={COMMUNICATIONS_ROUTES.outbox}
            className="btn-premium-secondary shrink-0 rounded-lg px-3 py-1.5 text-sm"
          >
            Open →
          </Link>
        </div>
      ) : null}
      <NotificationPrefsForm prefs={prefs} />
    </div>
  );
}
