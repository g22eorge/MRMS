"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  openWarrantyClaimAction,
  resolveWarrantyClaimAction,
  linkWarrantyRepairAction,
} from "@/app/(app)/jobs/[id]/warranty-actions";

export type WarrantyClaimRow = {
  id: string;
  status: string;
  reason: string;
  resolution: string | null;
  openedAt: string;
  closedAt: string | null;
  warrantyJob: { id: string; jobNumber: string } | null;
};

type Props = {
  jobId: string;
  coverageMonths: number | null;
  coverageExpiresAt: string | null;
  claims: WarrantyClaimRow[];
  /** Other jobs for this client, offered as the repair done under warranty. */
  linkableJobs: Array<{ id: string; jobNumber: string }>;
  canRaise: boolean;
  canSettle: boolean;
};

const field =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.8125rem]";

function statusChip(status: string) {
  if (status === "RESOLVED") return "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400";
  if (status === "REJECTED") return "bg-red-500/12 text-red-600 dark:text-red-400";
  return "bg-amber-500/12 text-amber-700 dark:text-amber-400";
}

const fmt = (iso: string) => iso.slice(0, 10);

/**
 * Warranty claims raised against this repair.
 *
 * Coverage state is shown but never enforced — honouring a lapsed warranty is a
 * commercial call, so an expired claim can still be raised and whoever decides
 * can see exactly what they are deciding.
 */
export function WarrantyClaimsPanel({
  jobId, coverageMonths, coverageExpiresAt, claims, linkableJobs, canRaise, canSettle,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [settling, setSettling] = useState<string | null>(null);

  const expired = coverageExpiresAt ? new Date(coverageExpiresAt) < new Date() : false;
  const hasOpen = claims.some((c) => c.status === "OPEN");

  function run(action: (fd: FormData) => Promise<{ success: true; message: string } | { success: false; error: string }>, fd: FormData) {
    startTransition(async () => {
      const res = await action(fd);
      if (res.success) {
        toast.success(res.message);
        setSettling(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[0.75rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Warranty claims</p>
        <p className="mt-0.5 text-[0.8125rem] text-[var(--ink-muted)]">
          {coverageExpiresAt
            ? expired
              ? `Cover ran out on ${fmt(coverageExpiresAt)}. A claim can still be raised — honouring it is your call.`
              : `Covered for ${coverageMonths} month${coverageMonths === 1 ? "" : "s"}, until ${fmt(coverageExpiresAt)}.`
            : "No warranty recorded on this repair. Set one above before claiming against it."}
        </p>
      </div>

      {claims.length > 0 ? (
        <ul className="space-y-2">
          {claims.map((claim) => (
            <li key={claim.id} className="rounded-lg border border-[var(--line)] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase ${statusChip(claim.status)}`}>
                  {claim.status}
                </span>
                <span className="text-[0.75rem] text-[var(--ink-muted)]">Opened {fmt(claim.openedAt)}</span>
                {claim.closedAt ? (
                  <span className="text-[0.75rem] text-[var(--ink-muted)]">· Closed {fmt(claim.closedAt)}</span>
                ) : null}
              </div>

              <p className="mt-1.5 text-[0.8125rem] text-[var(--ink)]">{claim.reason}</p>

              {claim.resolution ? (
                <p className="mt-1 text-[0.8125rem] text-[var(--ink-muted)]">
                  <span className="font-semibold">Outcome:</span> {claim.resolution}
                </p>
              ) : null}

              {claim.warrantyJob ? (
                <p className="mt-1 text-[0.8125rem]">
                  <span className="text-[var(--ink-muted)]">Repaired under warranty on </span>
                  <Link href={`/jobs/${claim.warrantyJob.id}`} className="font-semibold text-[var(--accent)] underline">
                    {claim.warrantyJob.jobNumber}
                  </Link>
                </p>
              ) : null}

              {canSettle && claim.status === "OPEN" ? (
                <div className="mt-2.5 space-y-2 border-t border-[var(--line)] pt-2.5">
                  {!claim.warrantyJob && linkableJobs.length > 0 ? (
                    <form
                      action={(fd) => { fd.set("jobId", jobId); fd.set("claimId", claim.id); run(linkWarrantyRepairAction, fd); }}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <label className="min-w-0 flex-1">
                        <span className="mb-1 block text-[0.6875rem] font-semibold text-[var(--ink-muted)]">
                          Repair done under warranty
                        </span>
                        <select name="warrantyJobId" required className={field} defaultValue="">
                          <option value="" disabled>Choose the follow-up repair…</option>
                          {linkableJobs.map((j) => (
                            <option key={j.id} value={j.id}>{j.jobNumber}</option>
                          ))}
                        </select>
                      </label>
                      <SubmitButton size="sm" variant="secondary" disabled={pending} pendingLabel="Linking…">
                        Link repair
                      </SubmitButton>
                    </form>
                  ) : null}

                  {settling === claim.id ? (
                    <form
                      action={(fd) => { fd.set("jobId", jobId); fd.set("claimId", claim.id); run(resolveWarrantyClaimAction, fd); }}
                      className="space-y-2"
                    >
                      <textarea
                        name="resolution"
                        required
                        minLength={3}
                        rows={2}
                        placeholder="What was done, or why it was turned down…"
                        className={field}
                      />
                      <div className="flex flex-wrap gap-2">
                        <SubmitButton size="sm" name="status" value="RESOLVED" disabled={pending} pendingLabel="Saving…">
                          Resolve
                        </SubmitButton>
                        <SubmitButton size="sm" variant="danger" name="status" value="REJECTED" disabled={pending} pendingLabel="Saving…">
                          Reject
                        </SubmitButton>
                        <button type="button" onClick={() => setSettling(null)} className="px-2 text-[0.8125rem] text-[var(--ink-muted)]">
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSettling(claim.id)}
                      className="text-[0.8125rem] font-semibold text-[var(--accent)]"
                    >
                      Settle this claim →
                    </button>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[0.8125rem] text-[var(--ink-muted)]">No claims raised against this repair.</p>
      )}

      {canRaise && !hasOpen ? (
        <form
          action={(fd) => { fd.set("jobId", jobId); run(openWarrantyClaimAction, fd); }}
          className="space-y-2 border-t border-[var(--line)] pt-3"
        >
          <textarea
            name="reason"
            required
            minLength={3}
            rows={2}
            placeholder="What has the customer come back with?"
            className={field}
          />
          <SubmitButton size="sm" disabled={pending} pendingLabel="Opening…">
            Raise warranty claim
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
