"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { buttonClasses } from "@/components/ui/Button";
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
      className={buttonClasses("primary", "sm", { className: "px-4 font-bold" })}
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
    "w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none transition placeholder:text-[var(--ink-muted)]/60 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15";
  const labelClass = "mb-1 block text-[12px] font-medium text-[var(--ink-muted)]";
  const metaLabelClass = "text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]/70";
  const metaValueClass = "mt-0.5 truncate text-[13px] font-semibold text-[var(--ink)]";

  // ── Compact variant (settings popover) — unchanged shape ──
  if (isCompact) {
    return (
      <form action={formAction} className="mt-3 space-y-2">
        <div>
          <label htmlFor={`${idPrefix}name`} className={labelClass}>Name</label>
          <input id={`${idPrefix}name`} name="name" defaultValue={name} required minLength={2} maxLength={80} className={fieldClass} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}phone`} className={labelClass}>Phone</label>
          <input id={`${idPrefix}phone`} name="phone" defaultValue={phone ?? ""} maxLength={30} placeholder="+256…" className={fieldClass} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
            <p className={metaLabelClass}>Email</p>
            <p className={metaValueClass}>{email}</p>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
            <p className={metaLabelClass}>Role</p>
            <p className={metaValueClass}>{role}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <SaveButton variant="compact" />
          {footerHint}
        </div>
      </form>
    );
  }

  // ── Page variant — editable details, then a read-only account strip ──
  return (
    <form action={formAction} className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="border-b border-[var(--line)] px-4 py-2.5">
        <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Your Details</p>
        <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
          Handoffs, approvals and client messages use these details.
        </p>
      </div>

      <div className="grid gap-3 p-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}name`} className={labelClass}>Name</label>
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
          <label htmlFor={`${idPrefix}phone`} className={labelClass}>Phone</label>
          <input
            id={`${idPrefix}phone`}
            name="phone"
            defaultValue={phone ?? ""}
            maxLength={30}
            placeholder="e.g. +2567..."
            className={fieldClass}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] bg-[var(--panel-strong)]/40 p-3">
        <SaveButton variant="page" />
        {state.error ? <p className="text-[13px] text-red-600 dark:text-red-400">{state.error}</p> : null}
        {state.success ? <p className="text-[13px] text-emerald-600">{state.success}</p> : null}
      </div>

      <div className="grid grid-cols-2 divide-x divide-[var(--line)] border-t border-[var(--line)]">
        <div className="px-4 py-2.5">
          <p className={metaLabelClass}>Email</p>
          <p className={metaValueClass}>{email}</p>
        </div>
        <div className="px-4 py-2.5">
          <p className={metaLabelClass}>Role</p>
          <p className={metaValueClass}>{role}</p>
        </div>
      </div>
    </form>
  );
}
