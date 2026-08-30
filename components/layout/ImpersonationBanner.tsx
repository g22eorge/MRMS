import { stopImpersonationAction } from "@/app/(platform)/platform/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";

/**
 * Says, unmistakably, that this is somebody else's workspace.
 *
 * Impersonation is only defensible while it is impossible to forget you are
 * doing it. The danger is not reading a customer's data on purpose — that is
 * the point — it is reading it, wandering off, and later mistaking their
 * numbers for your own, or filing a bug against a workspace you were never in.
 *
 * So it sits above everything, in a colour used nowhere else in the app, names
 * the organisation, and carries the way out. Not dismissible: a banner you can
 * close is a banner that will be closed.
 */
export function ImpersonationBanner({ orgName, startedAt, maxAgeMs }: {
  orgName: string | null;
  startedAt: number;
  maxAgeMs: number;
}) {
  const minutesLeft = Math.max(0, Math.round((startedAt + maxAgeMs - Date.now()) / 60000));

  return (
    <div
      role="status"
      className="sticky top-0 z-[60] flex flex-wrap items-center justify-between gap-2 border-b border-fuchsia-400/40 bg-fuchsia-950 px-3 py-1.5 text-[0.8125rem] text-fuchsia-50"
    >
      <span className="flex min-w-0 items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span className="truncate">
          Viewing <b className="font-semibold">{orgName ?? "another organisation"}</b> — read-only,
          {" "}{minutesLeft} min left. Nothing you do here can change their data.
        </span>
      </span>
      <form action={stopImpersonationAction}>
        <SubmitButton
          bare
          className="rounded-md border border-fuchsia-300/40 bg-fuchsia-100/10 px-2.5 py-1 text-[0.75rem] font-semibold text-fuchsia-50 transition hover:bg-fuchsia-100/20"
        >
          Stop viewing
        </SubmitButton>
      </form>
    </div>
  );
}
