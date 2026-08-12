"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { sendAssessmentViaWhatsAppAction, sendAssessmentViaEmailAction } from "@/app/(app)/jobs/[id]/actions";

/**
 * Share the (published) assessment report to the client over WhatsApp and/or
 * email. Mirrors the quote/invoice/job-card sends: each logs through the outbox,
 * so a failed delivery stays visible on the job's Messages tab. WhatsApp sends a
 * link/media; email attaches the PDF. The server actions re-check that a
 * client-visible report exists before anything goes out.
 */
export function SendAssessmentButton({
  jobId,
  hasPhone,
  hasEmail,
}: {
  jobId: string;
  hasPhone: boolean;
  hasEmail: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingWa, startWa] = useTransition();
  const [pendingEmail, startEmail] = useTransition();

  function run(
    action: (id: string) => Promise<{ success: boolean; error?: string }>,
    start: React.TransitionStartFunction,
    fallback: string,
  ) {
    setError(null);
    start(async () => {
      const res = await action(jobId);
      if (res.success) router.refresh();
      else setError(res.error ?? fallback);
    });
  }

  const cls = "rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[0.75rem] font-semibold text-emerald-600 hover:bg-emerald-500/15 disabled:opacity-50";

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="text-[0.6875rem] text-red-600">{error}</span> : null}
      {hasPhone ? (
        <button type="button" onClick={() => run(sendAssessmentViaWhatsAppAction, startWa, "Failed to send")} disabled={pendingWa} className={cls}>
          {pendingWa ? "Sending…" : "WhatsApp"}
        </button>
      ) : null}
      {hasEmail ? (
        <button type="button" onClick={() => run(sendAssessmentViaEmailAction, startEmail, "Failed to email")} disabled={pendingEmail} className={cls}>
          {pendingEmail ? "Emailing…" : "Email"}
        </button>
      ) : null}
    </div>
  );
}
