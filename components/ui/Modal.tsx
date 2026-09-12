"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { modalPanelClassName, type ModalSize } from "@/lib/ui/modal";

export type { ModalSize } from "@/lib/ui/modal";
export { modalPanelClassName } from "@/lib/ui/modal";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: ModalSize;
  ariaLabel?: string;
  labelledBy?: string;
  describedBy?: string;
  panelClassName?: string;
  backdropClassName?: string;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
};

export function Modal({
  open,
  onClose,
  children,
  size = "md",
  ariaLabel,
  labelledBy,
  describedBy,
  panelClassName = "",
  backdropClassName = "bg-black/50",
  closeOnEscape = true,
  closeOnBackdrop = true,
}: ModalProps) {
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeOnEscape, onClose]);

  // Rendered through a portal so the modal escapes <main>, which carries
  // `fade-in`: an animation with `fill-mode: both` whose final frame is
  // `transform: translateY(0)`. That transform stays applied for the life of
  // the page, and a transformed element becomes the containing block for its
  // position:fixed descendants — so in place, "fixed inset-0" covered only the
  // content column, dimming the page around a squeezed, half-hidden panel while
  // the sidebar stayed live. document.body sits outside that containing block.
  //
  // Safe for theming: the theme class is on <html> and the custom properties
  // are declared at :root, so body inherits every variable the panel uses.
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
    >
      <div
        className={`absolute inset-0 ${backdropClassName}`}
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div className={modalPanelClassName(size, panelClassName)}>{children}</div>
    </div>,
    document.body,
  );
}

type ModalHeaderProps = {
  title: string;
  subtitle?: string;
  onClose?: () => void;
};

export function ModalHeader({ title, subtitle, onClose }: ModalHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
      <div>
        <p className="text-[0.8125rem] font-semibold text-[var(--ink)]">
          {title}
        </p>
        {subtitle ? <p className="text-[0.75rem] text-[var(--ink-muted)]">{subtitle}</p> : null}
      </div>
      {onClose ? <ModalCloseButton onClose={onClose} /> : null}
    </div>
  );
}

type ModalCloseButtonProps = {
  onClose: () => void;
  label?: string;
  className?: string;
};

export function ModalCloseButton({ onClose, label = "Close", className = "" }: ModalCloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClose}
      className={`flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ink-muted)] transition hover:bg-[var(--panel-strong)] hover:text-[var(--ink)] ${className}`.trim()}
      aria-label={label}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}
