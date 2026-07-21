"use client";

export function InvoiceNewButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("invoice-create-dialog:open"))}
      className={className ?? "btn-premium rounded-lg px-4 py-2 text-[13px] font-bold"}
    >
      + New Invoice
    </button>
  );
}
