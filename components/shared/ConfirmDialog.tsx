"use client";

import { Modal } from "@/components/ui/Modal";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal open={open} onClose={onCancel} size="sm" ariaLabel={title} backdropClassName="bg-black/40">
      <div className="p-5">
        <h2 className="text-base font-semibold text-[var(--ink)]">{title}</h2>
        <p className="mt-1.5 text-sm text-[var(--ink-muted)]">{description}</p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn-premium-secondary rounded-lg px-4 py-2 text-sm font-medium"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              variant === "danger"
                ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                : "btn-premium rounded-lg px-4 py-2 text-sm font-semibold"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
