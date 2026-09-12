import { redirect } from "next/navigation";

import { requirePortalSessionAllowingPasswordChange } from "@/lib/portal-auth";
import { changePortalPasswordAction } from "../actions";

import { SubmitButton } from "@/components/ui/SubmitButton";
export const dynamic = "force-dynamic";

/**
 * Replace the password an admin issued.
 *
 * Reached automatically the first time a new login signs in, because
 * requirePortalSession sends anyone still carrying `mustChangePassword` here —
 * so this page has to use the variant that allows the flag, or it would bounce
 * against itself. It is also reachable voluntarily from the portal header.
 */
export default async function PortalChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { portalUser } = await requirePortalSessionAllowingPasswordChange();
  const { error } = await searchParams;
  const forced = portalUser.mustChangePassword;

  const field =
    "w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15";

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-12">
      <div className="mx-auto w-full max-w-md space-y-4">
        <div>
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            {portalUser.name}
          </p>
          <h1 className="mt-1 text-xl font-black text-[var(--ink)]">
            {forced ? "Set your own password" : "Change your password"}
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {forced
              ? "You're signed in with the password you were given. Choose your own before you continue — whoever set it up knows the current one."
              : "Pick something only you know. You'll stay signed in here; anywhere else will be signed out."}
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        ) : null}

        <form action={changePortalPasswordAction} className="dc-card space-y-3 p-4">
          <label className="block space-y-1">
            <span className="text-[0.75rem] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              {forced ? "The password you were given" : "Current password"}
            </span>
            <input type="password" name="currentPassword" required autoComplete="current-password" className={field} />
          </label>

          <label className="block space-y-1">
            <span className="text-[0.75rem] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              New password
            </span>
            <input
              type="password"
              name="newPassword"
              required
              minLength={8}
              autoComplete="new-password"
              className={field}
            />
            <span className="text-[0.75rem] text-[var(--ink-muted)]">At least 8 characters.</span>
          </label>

          <label className="block space-y-1">
            <span className="text-[0.75rem] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              Confirm new password
            </span>
            <input
              type="password"
              name="confirmPassword"
              required
              minLength={8}
              autoComplete="new-password"
              className={field}
            />
          </label>

          <SubmitButton bare className="btn-premium w-full rounded-lg px-4 py-2.5 text-sm font-semibold">
            Save password
          </SubmitButton>
        </form>

        {!forced ? (
          <form
            action={async () => {
              "use server";
              redirect("/portal/dashboard");
            }}
          >
            <SubmitButton bare className="w-full text-center text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]">
              Back to my repairs
            </SubmitButton>
          </form>
        ) : null}
      </div>
    </div>
  );
}
