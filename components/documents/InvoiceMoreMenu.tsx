"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { RowActionsMenu } from "@/components/shared/RowActionsMenu";

/**
 * InvoiceMoreMenu — the ⋮ overflow for invoice detail. Holds the rare/destructive
 * actions (Void) behind a confirm, posting to the working /api/invoices/[id]/actions
 * endpoint. Keeps the primary bar uncluttered.
 */
export function InvoiceMoreMenu({
  invoiceId,
  canVoid,
  isVoid,
}: {
  invoiceId: string;
  canVoid: boolean;
  isVoid: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  // Nothing to offer → render nothing so the bar doesn't show an empty ⋮.
  if (!canVoid || isVoid) return null;

  async function voidInvoice() {
    if (pending) return;
    if (!window.confirm("Void this invoice? Product stock from this invoice will be restored. This cannot be undone.")) return;
    setPending(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "void" }),
      });
      if (!res.ok) {
        // The endpoint returns JSON { error }, e.g. "This invoice has payments
        // recorded. Refund … first, then void." Surface that, not the raw body.
        const msg = await res.json().then((j) => j?.error).catch(() => null);
        window.alert(msg || "Could not void the invoice.");
        setPending(false);
        return;
      }
      router.refresh();
    } catch {
      window.alert("Network error. Please try again.");
      setPending(false);
    }
  }

  return (
    <RowActionsMenu label="More actions">
      <button
        type="button"
        onClick={voidInvoice}
        disabled={pending}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-red-600 transition hover:bg-[var(--panel-strong)] disabled:opacity-60 dark:text-red-400"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center opacity-80" aria-hidden="true">✕</span>
        <span className="min-w-0 flex-1">{pending ? "Voiding…" : "Void invoice"}</span>
      </button>
    </RowActionsMenu>
  );
}
