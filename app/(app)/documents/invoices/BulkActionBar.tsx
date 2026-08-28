"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useBulkSelection } from "./BulkSelectionProvider";

export function BulkActionBar() {
  const { selected, toggleAllOnPage, allSelectedOnPage, pageIds } = useBulkSelection();
  const [busy, setBusy] = useState(false);
  const count = selected.size;

  if (count === 0) return null;

  /**
   * The response was thrown away and the page reloaded regardless, so a refusal
   * was indistinguishable from success. Every role that can reach this list
   * sees these buttons, but the routes require viewFinancials or ADMIN/OPS/
   * FRONT_DESK — so a MANAGER or a SALES user could select invoices, confirm
   * "Void — this cannot be undone", watch the page reload, and be told nothing
   * about the 403 that left every invoice untouched. The routes also skip
   * invoices that are already paid; that was silent too.
   */
  async function run(endpoint: string, verb: string, extra?: Record<string, string>) {
    if (busy) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("ids", JSON.stringify([...selected]));
      for (const [k, v] of Object.entries(extra ?? {})) form.set(k, v);
      const res = await fetch(endpoint, { method: "POST", body: form });
      const data = await res.json().catch(() => null);

      if (res.status === 403) {
        toast.error(`You do not have permission to ${verb} invoices.`);
        return;
      }
      if (!res.ok) {
        toast.error(data?.error ?? `Could not ${verb} — the server refused (${res.status}).`);
        return;
      }
      const done = data?.sent ?? data?.voided ?? data?.updated ?? 0;
      const skipped = data?.skipped ?? 0;
      if (skipped > 0) toast.warning(`${done} ${verb}; ${skipped} skipped.`);
      else toast.success(`${done || count} invoice${(done || count) === 1 ? "" : "s"} ${verb}.`);
      location.reload();
    } catch {
      toast.error(`Could not ${verb} — the request did not complete.`);
    } finally {
      setBusy(false);
    }
  }

  const handleBulkEmail = async () => {
    if (!confirm(`Send email for ${count} invoice(s)?`)) return;
    await run("/api/invoices/bulk-email", "emailed");
  };

  const handleBulkWhatsApp = async () => {
    if (!confirm(`Send WhatsApp for ${count} invoice(s)?`)) return;
    await run("/api/invoices/bulk-whatsapp", "sent");
  };

  const handleBulkVoid = async () => {
    if (!confirm(`Void ${count} invoice(s)? This cannot be undone.`)) return;
    await run("/api/invoices/bulk-void", "voided", { reason: "Bulk void from list" });
  };

  return (
    <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2">
      <span className="text-sm font-bold text-amber-700">{count} selected</span>
      {pageIds.length > 0 && (
        <button type="button" onClick={toggleAllOnPage} className="text-xs underline text-amber-800 hover:no-underline">
          {allSelectedOnPage ? "Deselect page" : "Select all on page"}
        </button>
      )}
      <div className="ml-auto flex gap-2">
        <button
          type="button"
          onClick={handleBulkVoid}
          disabled={busy}
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 text-sm font-semibold text-red-700 hover:bg-red-500/20"
        >
          Void
        </button>
        <button
          type="button"
          onClick={handleBulkEmail}
          disabled={busy}
          className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-sm font-semibold text-blue-700 hover:bg-blue-500/20"
        >
          Email
        </button>
        <button
          type="button"
          onClick={handleBulkWhatsApp}
          disabled={busy}
          className="rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-2 py-1 text-sm font-semibold text-emerald-700 hover:bg-emerald-600/20"
        >
          WhatsApp
        </button>
      </div>
    </div>
  );
}
