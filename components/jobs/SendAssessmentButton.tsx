"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { sendAssessmentViaWhatsAppAction } from "@/app/(app)/jobs/[id]/actions";

/**
 * Share the (published) assessment report to the client over WhatsApp. Mirrors
 * the quote/invoice/job-card PDF sends: it logs through the outbox, so a failed
 * delivery stays visible on the job's Messages tab. The server action re-checks
 * that a client-visible report exists before anything is sent.
 */
export function SendAssessmentButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const res = await sendAssessmentViaWhatsAppAction(jobId);
      if (res.success) {
        router.refresh();
      } else {
        setError(res.error ?? "Failed to send assessment");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
      <button
        type="button"
        onClick={handleSend}
        disabled={pending}
        className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-semibold text-emerald-600 hover:bg-emerald-500/15 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send via WhatsApp"}
      </button>
    </div>
  );
}
