"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { buttonClasses } from "@/components/ui/Button";
import { changePasswordAction, type ChangePasswordState } from "@/app/(app)/settings/profile/actions";

/**
 * Password section of the profile page. Uses the same server action as the
 * settings popover — this is just the page-scale presentation.
 */

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("secondary", "sm", { className: "px-4" })}>
      {pending ? "Updating..." : "Change password"}
    </button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, {} as ChangePasswordState);

  const field =
    "w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none transition focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15";
  const label = "mb-1 block text-[12px] font-medium text-[var(--ink-muted)]";

  return (
    <form action={formAction} className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="border-b border-[var(--line)] px-4 py-2.5">
        <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Password</p>
        <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">At least 8 characters, different from your current one.</p>
      </div>

      <div className="grid gap-3 p-3 sm:grid-cols-3">
        <div>
          <label htmlFor="pf-current-password" className={label}>Current password</label>
          <input id="pf-current-password" name="currentPassword" type="password" required autoComplete="current-password" className={field} />
        </div>
        <div>
          <label htmlFor="pf-new-password" className={label}>New password</label>
          <input id="pf-new-password" name="newPassword" type="password" required minLength={8} autoComplete="new-password" className={field} />
        </div>
        <div>
          <label htmlFor="pf-confirm-password" className={label}>Confirm new password</label>
          <input id="pf-confirm-password" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" className={field} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] bg-[var(--panel-strong)]/40 p-3">
        <SaveButton />
        {state.error ? <p className="text-[13px] text-red-600 dark:text-red-400">{state.error}</p> : null}
        {state.success ? <p className="text-[13px] text-emerald-600">{state.success}</p> : null}
      </div>
    </form>
  );
}
