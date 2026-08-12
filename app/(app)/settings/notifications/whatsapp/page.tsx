import { redirect } from "next/navigation";

import { requireOrgSession } from "@/lib/org-context";
import { COMMUNICATIONS_ROUTES } from "@/lib/communications/routes";
import { whatsappConfigSummaryForOrg, whatsappHealthCheckForOrg } from "@/lib/notifications/whatsapp";
import { getOrgWhatsAppConfig } from "@/lib/org-whatsapp-config";
import { WhatsAppConfigForm } from "@/components/settings/WhatsAppConfigForm";
import { WhatsAppTestPanel } from "@/components/settings/WhatsAppTestPanel";

export const dynamic = "force-dynamic";

export default async function WhatsAppSettingsPage() {
  const { user, orgId } = await requireOrgSession();
  if (user.role !== "ADMIN") redirect(COMMUNICATIONS_ROUTES.outbox);

  const [currentConfig, summary] = await Promise.all([
    getOrgWhatsAppConfig(orgId),
    whatsappConfigSummaryForOrg(orgId),
  ]);
  const health = summary.configured ? await whatsappHealthCheckForOrg(orgId) : null;

  // Extract the extra fields that whatsappHealthCheck returns alongside { ok, error }
  const healthData = health as (typeof health & {
    display_phone_number?: string;
    verified_name?: string;
    code_verification_status?: string;
    quality_rating?: string;
  }) | null;

  const stats: { label: string; value: string }[] = [
    { label: "Business number", value: healthData?.display_phone_number ?? summary.businessNumber ?? "—" },
    { label: "Verified name", value: healthData?.verified_name ?? "—" },
    { label: "Verification", value: healthData?.code_verification_status ?? "—" },
    { label: "Quality rating", value: healthData?.quality_rating ?? "—" },
  ];

  return (
    <div className="space-y-4">
      {/* Connected account panel */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.8125rem] font-semibold text-[var(--ink)]">WhatsApp Business Account</p>
            <p className="mt-0.5 text-[0.75rem] text-[var(--ink-muted)]">Messages sent from this number via Meta Cloud API.</p>
          </div>
          {health?.ok ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[0.75rem] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Connected
            </span>
          ) : summary.configured ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-500/12 px-2.5 py-1 text-[0.75rem] font-semibold text-red-600 dark:text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Error
            </span>
          ) : (
            <span className="flex shrink-0 items-center rounded-full bg-[var(--panel-strong)] px-2.5 py-1 text-[0.75rem] font-semibold text-[var(--ink-muted)]">
              Not configured
            </span>
          )}
        </div>

        {summary.configured ? (
          <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-[var(--line)]/60 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-[var(--panel-strong)] px-3 py-2.5">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]/70">{s.label}</p>
                <p className="mt-1 truncate mono text-[0.8125rem] font-semibold text-[var(--ink)]" title={s.value}>{s.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-lg bg-amber-500/10 px-4 py-3 text-[0.75rem] text-amber-700 dark:text-amber-400">
            WhatsApp is not configured. Set <code className="mono">WHATSAPP_ACCESS_TOKEN</code>,{" "}
            <code className="mono">WHATSAPP_PHONE_NUMBER_ID</code>, and{" "}
            <code className="mono">WHATSAPP_BUSINESS_NUMBER</code> in your environment.
          </div>
        )}

        {health && !health.ok && (
          <div className="mt-3 rounded-lg bg-red-500/10 px-4 py-3 text-[0.75rem] text-red-700 dark:text-red-400">
            <span className="font-semibold">API error:</span> {health.error}
          </div>
        )}
      </div>

      {/* Send test — only if connected */}
      {summary.configured ? (
        <WhatsAppTestPanel
          from={healthData?.display_phone_number ?? summary.businessNumber ?? ""}
          verifiedName={healthData?.verified_name ?? null}
        />
      ) : null}

      <WhatsAppConfigForm orgId={orgId} current={currentConfig} />
    </div>
  );
}
