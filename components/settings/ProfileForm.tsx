"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateProfileAction, type UpdateProfileState } from "@/app/(app)/settings/profile/actions";

function SaveButton({ variant }: { variant: "page" | "compact" }) {
  const { pending } = useFormStatus();

  if (variant === "compact") {
    return (
      <button
        type="submit"
        disabled={pending}
        className="btn-premium rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    );
  }

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-premium rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
    >
      {pending ? "Saving..." : "Save changes"}
    </button>
  );
}

export function ProfileForm({
  name,
  email,
  role,
  phone,
  variant = "page",
  footerHint,
}: {
  name: string;
  email: string;
  role: string;
  phone: string | null;
  variant?: "page" | "compact";
  footerHint?: React.ReactNode;
}) {
  const router = useRouter();
  const initialState: UpdateProfileState = {};
  const [state, formAction] = useActionState(updateProfileAction, initialState);
  const isCompact = variant === "compact";
  const idPrefix = isCompact ? "sp-" : "";

  useEffect(() => {
    if (state.success) {
      if (isCompact) {
        toast.success("Profile updated");
      }
      router.refresh();
    }
    if (state.error && isCompact) {
      toast.error(state.error);
    }
  }, [isCompact, router, state.error, state.success]);

  const fieldClass =
    "w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-sm outline-none transition focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/14";
  const labelClass = isCompact
    ? "mb-1 block text-xs text-[var(--ink-muted)]"
    : "mb-1 block text-sm text-[var(--ink-muted)]";
  const metaLabelClass = isCompact
    ? "text-[12px] uppercase tracking-[0.08em] text-[var(--ink-muted)]"
    : "text-[13px] uppercase tracking-[0.08em] text-[var(--ink-muted)]";
  const metaValueClass = isCompact
    ? "mt-0.5 truncate text-xs font-medium text-[var(--ink)]"
    : "mt-1 text-sm font-medium text-[var(--ink)]";

  return (
    <form
      action={formAction}
      className={
        isCompact
          ? "mt-3 space-y-2"
          : "panel-shadow space-y-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4"
      }
    >
      {!isCompact ? (
        <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2">
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">Profile Summary</p>
          <p className="mt-1 text-sm text-[var(--ink)]">Keep your contact details current so internal handoffs and approvals remain accurate.</p>
        </div>
      ) : null}

      <div>
        <label htmlFor={`${idPrefix}name`} className={labelClass}>
          Name
        </label>
        <input
          id={`${idPrefix}name`}
          name="name"
          defaultValue={name}
          required
          minLength={2}
          maxLength={80}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}phone`} className={labelClass}>
          Phone
        </label>
        <input
          id={`${idPrefix}phone`}
          name="phone"
          defaultValue={phone ?? ""}
          maxLength={30}
          placeholder={isCompact ? "+256…" : "e.g. +2567..."}
          className={fieldClass}
        />
      </div>

      <div className={isCompact ? "grid grid-cols-2 gap-2" : "grid gap-2 sm:grid-cols-2"}>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
          <p className={metaLabelClass}>Email</p>
          <p className={metaValueClass}>{email}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
          <p className={metaLabelClass}>Role</p>
          <p className={metaValueClass}>{role}</p>
        </div>
      </div>

      {!isCompact && state.error ? <p className="text-sm text-[var(--ink)] md:col-span-2">{state.error}</p> : null}
      {!isCompact && state.success ? <p className="text-sm text-[var(--accent)]">{state.success}</p> : null}

      <div className={isCompact ? "flex items-center justify-between" : undefined}>
        <SaveButton variant={variant} />
        {isCompact && footerHint ? footerHint : null}
      </div>
    </form>
  );
}
