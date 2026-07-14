"use client";

import { useEffect, type ReactNode } from "react";

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

  if (!open) return null;

  return (
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
    </div>
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
        <p className="text-[13px] font-semibold text-[var(--ink)]">
          {title}
        </p>
        {subtitle ? <p className="text-[12px] text-[var(--ink-muted)]">{subtitle}</p> : null}
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
