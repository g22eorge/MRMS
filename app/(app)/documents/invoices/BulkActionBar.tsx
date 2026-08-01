"use client";

import { useBulkSelection } from "./BulkSelectionProvider";

export function BulkActionBar() {
  const { selected, toggleAllOnPage, allSelectedOnPage, pageIds } = useBulkSelection();
  const count = selected.size;

  if (count === 0) return null;

  const handleBulkEmail = async () => {
    if (!confirm(`Send email for ${count} invoice(s)?`)) return;
    const form = new FormData();
    form.set("ids", JSON.stringify([...selected]));
    await fetch("/api/invoices/bulk-email", { method: "POST", body: form });
    location.reload();
  };

  const handleBulkWhatsApp = async () => {
    if (!confirm(`Send WhatsApp for ${count} invoice(s)?`)) return;
    const form = new FormData();
    form.set("ids", JSON.stringify([...selected]));
    await fetch("/api/invoices/bulk-whatsapp", { method: "POST", body: form });
    location.reload();
  };

  const handleBulkVoid = async () => {
    if (!confirm(`Void ${count} invoice(s)? This cannot be undone.`)) return;
    const form = new FormData();
    form.set("ids", JSON.stringify([...selected]));
    form.set("reason", "Bulk void from list");
    await fetch("/api/invoices/bulk-void", { method: "POST", body: form });
    location.reload();
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
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 text-sm font-semibold text-red-700 hover:bg-red-500/20"
        >
          Void
        </button>
        <button
          type="button"
          onClick={handleBulkEmail}
          className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-sm font-semibold text-blue-700 hover:bg-blue-500/20"
        >
          Email
        </button>
        <button
          type="button"
          onClick={handleBulkWhatsApp}
          className="rounded-lg border border-green-600/40 bg-green-600/10 px-2 py-1 text-sm font-semibold text-green-700 hover:bg-green-600/20"
        >
          WhatsApp
        </button>
      </div>
    </div>
  );
}
