"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
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
/**
 * Everything a plain <button> accepts, minus the props this component owns.
 *
 * Submits in the wild carry `title`, `name`/`value`, `formAction` (which is how
 * one form drives several server actions) and the odd `onClick`. Without these
 * passed through, replacing a plain submit with this component silently drops
 * behaviour, so the rest is forwarded verbatim.
 */
type NativeSubmitProps = Omit<
  ComponentPropsWithoutRef<"button">,
  "type" | "disabled" | "className" | "children"
>;

export function SubmitButton({
  children,
  pendingLabel = "Working…",
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  disabled,
  bare,
  ...rest
}: NativeSubmitProps & {
  children: ReactNode;
  pendingLabel?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  disabled?: boolean;
  /**
   * When true, use `className` verbatim instead of the shared buttonClasses().
   * Lets an existing custom-styled inline submit keep its exact look while
   * still gaining the pending disable + label (the double-submit guard).
   */
  bare?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      {...rest}
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={bare ? className : buttonClasses(variant, size, { fullWidth, className })}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
