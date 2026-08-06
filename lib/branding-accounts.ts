export type BankAccount = {
  bankName: string;
  branch: string;
  accountName: string;
  accountNumber: string;
};

/** Parse the stored paymentAccounts JSON into a typed, sanitised list. */
export function parsePaymentAccounts(json: string | null | undefined): BankAccount[] {
  if (!json || !json.trim()) return [];
  try {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw
      .map((a) => ({
        bankName: String(a?.bankName ?? "").trim(),
        branch: String(a?.branch ?? "").trim(),
        accountName: String(a?.accountName ?? "").trim(),
        accountNumber: String(a?.accountNumber ?? "").trim(),
      }))
      .filter((a) => a.bankName || a.accountNumber)
      .slice(0, 10);
  } catch {
    return [];
  }
}

/** Build the multi-line "Payment To" block rendered on documents from accounts. */
export function formatPaymentAccounts(accounts: BankAccount[]): string {
  return accounts
    .filter((a) => a.bankName.trim() || a.accountNumber.trim())
    .map((a) =>
      [
        a.bankName.trim(),
        a.branch.trim() ? `Branch: ${a.branch.trim()}` : null,
        a.accountName.trim() ? `A/c Name: ${a.accountName.trim()}` : null,
        a.accountNumber.trim() ? `A/c No.: ${a.accountNumber.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .filter(Boolean)
    .join("\n\n");
}
