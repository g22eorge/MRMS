"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSupplierAction } from "../actions";

export default function NewSupplierPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createSupplierAction(fd);
      if (result.error) { setError(result.error); return; }
      router.push(`/inventory/suppliers/${result.id}`);
    });
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Inventory · Supplier</p>
            <h1 className="text-base font-bold text-[var(--ink)]">New supplier</h1>
          </div>
          <p className="text-xs text-[var(--ink-muted)]">Prices and orders come after.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
          <p className="border-b border-[var(--line)] px-3 py-2 text-sm font-bold text-[var(--ink)]">Supplier</p>
          <div className="grid gap-3 p-3 sm:grid-cols-2">
            <Field name="name" label="Supplier Name" required />
            <Field name="contactName" label="Contact Person" />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
          <p className="border-b border-[var(--line)] px-3 py-2 text-sm font-bold text-[var(--ink)]">Contact</p>
          <div className="grid gap-3 p-3 sm:grid-cols-2">
            <Field name="email" label="Email" type="email" />
            <Field name="phone" label="Phone" />
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">Address</label>
              <textarea
                name="address"
                rows={2}
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 resize-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">Notes</label>
              <textarea
                name="notes"
                rows={2}
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 resize-none"
              />
            </div>
          </div>
        </div>

        {error && <p className="rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>}
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] bg-[var(--bg)]/95 py-2 backdrop-blur">
          <Link href="/inventory/suppliers" className="rounded-md border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--ink-muted)] hover:bg-[var(--panel-strong)]">
            Cancel
          </Link>
          <button type="submit" disabled={pending} className="btn-premium rounded-md px-4 py-2 text-sm font-bold disabled:opacity-50">
            {pending ? "Saving…" : "Save Supplier"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ name, label, required, type = "text" }: { name: string; label: string; required?: boolean; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
      />
    </div>
  );
}
