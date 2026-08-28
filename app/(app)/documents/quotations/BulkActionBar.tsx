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
   * Every action used to fire and then reload regardless of the answer, so a
   * refusal looked exactly like success — which is how three of these could POST
   * to routes that did not exist without anyone noticing. The response is now
   * read, the outcome reported, and the page only reloads when something
   * actually changed.
   */
  async function run(endpoint: string, verb: string) {
    if (busy) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("ids", JSON.stringify([...selected]));
      const res = await fetch(endpoint, { method: "POST", body: form });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.error ?? `Could not ${verb} — the server refused (${res.status}).`);
        return;
      }
      const done = data?.sent ?? data?.converted ?? 0;
      const failed = data?.failed ?? 0;
      if (failed > 0) toast.warning(`${done} of ${data?.total ?? count} done — ${failed} could not be processed.`);
      else toast.success(`${done} quotation${done === 1 ? "" : "s"} ${verb}.`);
      location.reload();
    } catch {
      toast.error(`Could not ${verb} — the request did not complete.`);
    } finally {
      setBusy(false);
    }
  }

  const handleBulkEmail = async () => {
    if (!confirm(`Send email for ${count} quotation(s)?`)) return;
    await run("/api/quotations/bulk-email", "emailed");
  };

  const handleBulkWhatsApp = async () => {
    if (!confirm(`Send WhatsApp for ${count} quotation(s)?`)) return;
    await run("/api/quotations/bulk-whatsapp", "sent");
  };

  const handleBulkConvert = async () => {
    if (!confirm(`Convert ${count} quotation(s) to invoice(s)?`)) return;
    await run("/api/quotations/bulk-convert", "converted");
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
          disabled={busy}
          onClick={handleBulkConvert}
          className="rounded-lg border border-slate-500/40 bg-slate-500/10 px-2 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-500/20"
        >
          Convert to Invoice
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleBulkEmail}
          className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-sm font-semibold text-blue-700 hover:bg-blue-500/20"
        >
          Email
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleBulkWhatsApp}
          className="rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-2 py-1 text-sm font-semibold text-emerald-700 hover:bg-emerald-600/20"
        >
          WhatsApp
        </button>
      </div>
    </div>
  );
}
