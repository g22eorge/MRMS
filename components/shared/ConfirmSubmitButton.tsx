"use client";

import { useRef, useState } from "react";

import { ConfirmDialog } from "./ConfirmDialog";

type ConfirmSubmitButtonProps = {
  message: string;
  className?: string;
  children: React.ReactNode;
  confirmLabel?: string;
  /** Tooltip / accessible name — required when the trigger renders an icon only. */
  title?: string;
  "aria-label"?: string;
};

export function ConfirmSubmitButton({
  message,
  className,
  children,
  confirmLabel = "Confirm",
  title,
  "aria-label": ariaLabel,
}: ConfirmSubmitButtonProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={className}
        title={title}
        aria-label={ariaLabel ?? title}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <ConfirmDialog
        open={open}
        title="Please confirm"
        description={message}
        confirmLabel={confirmLabel}
        variant="danger"
        onConfirm={() => {
          setOpen(false);
          btnRef.current?.closest("form")?.requestSubmit();
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
