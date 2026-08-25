/**
 * POS Sale Receipt — Eagle Info house style.
 * Matches the clean white design from Quote_EISL-000014.pdf.
 */
import { EagleInfoDocument, type EagleInfoLineItem } from "./EagleInfoDocument";
import { formatMoney, getAppCurrency, normalizeCurrency } from "@/lib/currency";
import { clientContactName, clientDisplayName } from "@/lib/client-name";

type Branding = {
  documentTitle?: string | null;
  companyName?: string | null;
  companyTagline?: string | null;
  companyContacts?: string | null;
  companyEmail?: string | null;
  companyWebsite?: string | null;
  companyAddressLine1?: string | null;
  companyAddressLine2?: string | null;
  companyLogoUrl?: string | null;
  vatRatePercent?: number | null;
  termsText?: string;
  footerText?: string;
  paymentInstructions?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
} | null;

type Sale = {
  saleNumber: string;
  status: string;
  createdAt: Date;
  currency?: string | null;
  branch: { name: string } | null;
  client: { fullName: string; phone: string | null; organization?: string | null } | null;
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  totalAmount: number;
  paidAmount: number;
  items: Array<{ id: string; description: string; quantity: number; unitPrice: number; lineTotal: number; sku?: string | null }>;
  payments: Array<{ id: string; amount: number; method: string; reference: string | null; receivedAt: Date }>;
};

export function SaleReceiptDocument({ sale, branding }: { sale: Sale; branding: Branding }) {
  const currency = normalizeCurrency(sale.currency, getAppCurrency());

  const lineItems: EagleInfoLineItem[] = sale.items.map((it) => ({
    name:     it.description,
    sku:      it.sku ?? null,
    quantity: it.quantity,
    rate:     formatMoney(it.unitPrice, currency),
    amount:   formatMoney(it.lineTotal, currency),
  }));

  const address = [branding?.companyAddressLine1, branding?.companyAddressLine2]
    .filter(Boolean).join(", ");

  const balance = Math.max(0, sale.totalAmount - sale.paidAmount);
  const dateStr = sale.createdAt.toLocaleDateString("en-GB", { timeZone: "Africa/Nairobi", day: "2-digit", month: "short", year: "numeric" });

  // Payment-to bank details: prefer the single Branding "paymentInstructions"
  // block; fall back to the older split bank fields if present.
  const bankLines = (branding?.paymentInstructions?.trim())
    || [
      branding?.bankName,
      branding?.bankBranch ? `Branch: ${branding.bankBranch}` : null,
      branding?.bankAccountName ? `A/c Name: ${branding.bankAccountName}` : null,
      branding?.bankAccountNumber ? `A/c No.: ${branding.bankAccountNumber}` : null,
    ].filter(Boolean).join("\n");

  // Method summary for notes
  const methodNote = sale.payments.length > 0
    ? sale.payments.map(p => `${p.method.replaceAll("_", " ")}: ${formatMoney(p.amount, currency)}`).join(" · ")
    : null;

  // Receipt meta (matches the official layout): Receipt Date / Payment Method / Reference.
  const primaryPayment = sale.payments[0] ?? null;
  const metaRows = [
    { label: "Receipt Date", value: dateStr },
    { label: "Payment Method", value: primaryPayment ? primaryPayment.method.replaceAll("_", " ") : "-" },
    { label: "Reference", value: primaryPayment?.reference || `REF-${sale.saleNumber}` },
  ];

  return (
    <EagleInfoDocument
      companyName={branding?.companyName ?? ""}
      companyAddress={address}
      companyPhone={branding?.companyContacts ?? null}
      companyEmail={branding?.companyEmail ?? null}
      companyWebsite={branding?.companyWebsite ?? null}
      companyLogoUrl={branding?.companyLogoUrl ?? null}
      docTitle="Receipt"
      docNumber={sale.saleNumber}
      docDate={dateStr}
      metaRows={metaRows}
      topRuleColor="#f97316"
      clientName={clientDisplayName(sale.client, "Walk-in Customer")}
      clientAttn={clientContactName(sale.client)}
      clientPhone={sale.client?.phone ?? null}
      clientEmail={null}
      clientLocation={null}
      lineItems={lineItems}
      subTotal={sale.discountAmount > 0 || sale.vatAmount > 0 ? formatMoney(sale.subtotal, currency) : null}
      // The discount was accepted as a prop but never rendered, so a discounted
      // sale printed "Sub-total 100,000 … Total 80,000" with nothing accounting
      // for the gap. The thermal and branded templates already showed it.
      discountAmount={sale.discountAmount > 0 ? formatMoney(sale.discountAmount, currency) : null}
      vatLabel={sale.vatAmount > 0 ? `VAT (${branding?.vatRatePercent ?? 18}%)` : null}
      vatAmount={sale.vatAmount > 0 ? formatMoney(sale.vatAmount, currency) : null}
      totalLabel="Total"
      totalAmount={formatMoney(sale.totalAmount, currency)}
      paymentMade={sale.paidAmount > 0 ? formatMoney(sale.paidAmount, currency) : null}
      balanceDue={balance > 0 ? formatMoney(balance, currency) : formatMoney(0, currency)}
      notes={methodNote ?? (branding?.footerText ?? null)}
      paymentTo={bankLines || null}
      termsText={branding?.termsText ?? null}
    />
  );
}
