import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * Shared button used across the app. Server-component friendly (no hooks, no
 * "use client") so it works inside server-action <form>s and server pages.
 *
 * It bakes in consistent sizing/radius/typography — the per-call-site tweaking
 * (px-3 vs px-2.5, rounded-lg vs rounded-md, text-[0.75rem] vs text-xs) is exactly
 * what made buttons look inconsistent. Pick a `variant` + `size`; pass `href`
 * to render a link instead of a <button>.
 *
 *   <Button>Save</Button>                          // primary, md
 *   <Button variant="secondary" size="sm">Edit</Button>
 *   <Button href="/reports" variant="secondary" size="sm">Reports →</Button>
 *   <Button type="submit" variant="danger">Delete</Button>
 */

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  // Gold gradient (colours/shadows come from globals `.btn-premium`).
  primary: "btn-premium",
  // Neutral panel gradient with hairline border.
  secondary: "btn-premium-secondary",
  // Red-tinted outline for destructive actions.
  danger:
    "border border-red-400/30 bg-red-500/5 text-red-600 hover:bg-red-500/10 hover:border-red-400/50 dark:text-red-400",
  // Borderless tertiary for low-emphasis actions.
  ghost:
    "border border-transparent text-[var(--ink-muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--ink)]",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-[0.75rem] rounded-lg",
  md: "h-9 gap-2 px-4 text-[0.8125rem] rounded-lg",
  lg: "h-11 gap-2 px-5 text-[0.875rem] rounded-xl",
};

const BASE =
  "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--panel)]";

type SharedProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to fill the container width. */
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = SharedProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof SharedProps> & { href?: undefined };

type ButtonAsLink = SharedProps &
  Omit<ComponentPropsWithoutRef<"a">, keyof SharedProps> & {
    href: string;
    /** Render a plain <a> (new tab / non-app routes) instead of next/link. */
    external?: boolean;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

/**
 * The exact class string `<Button>` applies — for consumers that must render
 * their own element (e.g. a confirm-wrapped submit) but want identical styling.
 */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  opts?: { fullWidth?: boolean; className?: string },
) {
  return [BASE, VARIANT_CLASS[variant], SIZE_CLASS[size], opts?.fullWidth ? "w-full" : "", opts?.className ?? ""]
    .filter(Boolean)
    .join(" ");
}

function classesFor(variant: ButtonVariant, size: ButtonSize, fullWidth?: boolean, className?: string) {
  return buttonClasses(variant, size, { fullWidth, className });
}

export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", fullWidth, className, children } = props;
  const cls = classesFor(variant, size, fullWidth, className);

  if (props.href !== undefined) {
    const { href, external, variant: _v, size: _s, fullWidth: _fw, className: _c, children: _ch, ...rest } =
      props as ButtonAsLink;
    if (external) {
      return (
        <a href={href} className={cls} {...rest}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={cls} {...rest}>
        {children}
      </Link>
    );
  }

  const { variant: _v, size: _s, fullWidth: _fw, className: _c, children: _ch, type, ...rest } =
    props as ButtonAsButton;
  return (
    <button type={type ?? "button"} className={cls} {...rest}>
      {children}
    </button>
  );
}
