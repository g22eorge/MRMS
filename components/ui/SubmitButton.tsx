"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";

/**
 * A submit button that disables itself and shows a pending label while its
 * enclosing <form> is submitting. This is the double-submit guard: on a slow
 * server the button greys out on the first click, so repeated clicks can't fire
 * the action again (which was creating duplicate invoices / sales / documents).
 *
 * Must be rendered inside a <form> (server-action or otherwise). Styling matches
 * <Button> via the shared buttonClasses().
 */
export function SubmitButton({
  children,
  pendingLabel = "Working…",
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  disabled,
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={buttonClasses(variant, size, { fullWidth, className })}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
