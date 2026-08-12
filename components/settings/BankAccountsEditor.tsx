"use client";

import { useState } from "react";

import type { BankAccount } from "@/lib/branding-accounts";

const EMPTY: BankAccount = { bankName: "", branch: "", accountName: "", accountNumber: "" };

const inputClass =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/14";

export function BankAccountsEditor({ initial }: { initial: BankAccount[] }) {
  const [accounts, setAccounts] = useState<BankAccount[]>(initial.length > 0 ? initial : [{ ...EMPTY }]);

  const update = (i: number, field: keyof BankAccount, value: string) =>
    setAccounts((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));

  const remove = (i: number) => setAccounts((prev) => prev.filter((_, idx) => idx !== i));
  const add = () => setAccounts((prev) => [...prev, { ...EMPTY }]);

  // Only keep accounts that have at least a bank name; serialise for the server action.
  const cleaned = accounts.filter((a) => a.bankName.trim() || a.accountNumber.trim());

  return (
    <div className="grid gap-3">
      <input type="hidden" name="paymentAccounts" value={JSON.stringify(cleaned)} />

      {accounts.map((acc, i) => (
        <div key={i} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)]/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              Bank account {i + 1}
            </span>
            {accounts.length > 1 ? (
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-[0.75rem] font-medium text-red-600 hover:underline dark:text-red-400"
              >
                Remove
              </button>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inputClass} placeholder="Bank name (e.g. DFCU Bank)" value={acc.bankName} onChange={(e) => update(i, "bankName", e.target.value)} />
            <input className={inputClass} placeholder="Branch (e.g. Bugolobi)" value={acc.branch} onChange={(e) => update(i, "branch", e.target.value)} />
            <input className={inputClass} placeholder="Account name" value={acc.accountName} onChange={(e) => update(i, "accountName", e.target.value)} />
            <input className={inputClass} placeholder="Account number" value={acc.accountNumber} onChange={(e) => update(i, "accountNumber", e.target.value)} />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="justify-self-start rounded-lg border border-dashed border-[var(--line)] px-3 py-1.5 text-[0.8125rem] font-medium text-[var(--ink)] transition hover:border-[var(--accent)]/50"
      >
        + Add another bank account
      </button>
    </div>
  );
}
