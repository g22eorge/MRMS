"use client";

import clsx from "clsx";
import { useFormStatus } from "react-dom";

type SubmitActionButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  className?: string;
};

export function SubmitActionButton({ idleLabel, pendingLabel, className }: SubmitActionButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={clsx(className)}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

type RoleActionButtonProps = {
  role: string;
  currentRole: string;
  label: string;
};

export function RoleActionButton({ role, currentRole, label }: RoleActionButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      name="role"
      value={role}
      className={clsx(
        "rounded-full border px-3 py-1.5 text-xs",
        currentRole === role
          ? "btn-premium border-transparent text-white"
          : "btn-premium-secondary border-[var(--line)] bg-white text-[var(--ink)]",
      )}
    >
      {pending ? "Updating..." : label}
    </button>
  );
}
