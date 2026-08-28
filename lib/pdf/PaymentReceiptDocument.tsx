/**
 * Payment receipt — Eagle Info house style (delegates to EagleInfoDocument so it
 * matches the official invoice/estimate/receipt layout: navy line-item header,
 * orange top rule, Receipt Date / Payment Method / Reference meta, and the DFCU
 * "Payment To" block).
 */
import { EagleInfoDocument, type EagleInfoLineItem } from "./EagleInfoDocument";
import { isShippedDefaultTerms } from "@/lib/quote-terms";

type ReceiptProps = {
  branding: {
    companyName: string;
    companyTagline?: string | null;
    companyAddressLine1: string;
    companyAddressLine2: string;
    companyContacts: string;
    companyEmail?: string | null;
    companyWebsite?: string | null;
    companyLogoUrl?: string | null;
    paymentInstructions?: string | null;
    termsText?: string;
    footerText?: string;
  };
  receiptNumber: string;
  receivedAt: string;
  method: string;
  reference?: string | null;
  amountLabel: string;
  /** Cumulative amount paid on the linked invoice/sale (defaults to this payment). */
  paidLabel?: string | null;
  /** Outstanding balance after this payment (defaults to zero). */
  balanceLabel?: string | null;
  forLabel: string;
  receivedBy: string;
  clientName?: string | null;
  clientOrganization?: string | null;
  clientPhone?: string | null;
  /** The document's own lines. Empty for a payment with nothing linked. */
  lineItems?: EagleInfoLineItem[] | null;
  /** The linked document's total. */
  docTotalLabel?: string | null;
  /** What the lines actually sum to, before discount and VAT. */
  subtotalLabel?: string | null;
  discountLabel?: string | null;
  vatLabel?: string | null;
};

export function PaymentReceiptDocument({ branding, receiptNumber, receivedAt, method, reference, amountLabel, paidLabel, balanceLabel, forLabel, receivedBy, clientName, clientOrganization, clientPhone, lineItems, docTotalLabel, subtotalLabel, discountLabel, vatLabel }: ReceiptProps) {
  const address = [branding.companyAddressLine1, branding.companyAddressLine2].filter(Boolean).join("\n");

  // Zero in the amount's currency (e.g. "UGX 600,000" -> "UGX 0") for the
  // fallback when no real balance was supplied.
  const zeroLabel = amountLabel.replace(/[\d.,]+/, "0");

  // Prefer the document's real lines. The single synthetic line stays as the
  // fallback for a payment with no invoice or sale behind it, where there is
  // genuinely nothing to itemise.
  const hasLines = (lineItems?.length ?? 0) > 0;
  const items: EagleInfoLineItem[] = hasLines
    ? (lineItems as EagleInfoLineItem[])
    : [{
        name:     `Payment received — ${forLabel}`,
        quantity: 1,
        rate:     amountLabel,
        amount:   amountLabel,
      }];

  // With real lines the money column belongs to the document: the lines sum to
  // its total, and Payment Made / Balance Due say how much is settled. This
  // payment then becomes the headline, so the number the customer came for is
  // the largest thing on the page and is not confused with the invoice total.
  const columnTotal = (hasLines && docTotalLabel) || amountLabel;

  return (
    <EagleInfoDocument
      companyName={branding.companyName}
      companyAddress={address}
      companyPhone={branding.companyContacts || null}
      companyEmail={branding.companyEmail || null}
      companyWebsite={branding.companyWebsite || null}
      companyLogoUrl={branding.companyLogoUrl || null}
      docTitle="Receipt"
      docNumber={receiptNumber}
      docDate={receivedAt}
      topRuleColor="#f97316"
      metaRows={[
        { label: "Receipt Date", value: receivedAt },
        { label: "Payment Method", value: method },
        // Only a real reference. Cash has none, and the old fallback invented
        // "REF-<receipt number>", which reads like a transaction id the customer
        // could quote back to a bank and cannot.
        ...(reference ? [{ label: "Reference", value: reference }] : []),
        { label: "For", value: forLabel },
      ]}
      clientLabel="Received From"
      clientName={clientOrganization || clientName || "—"}
      clientAttn={clientOrganization ? clientName || null : null}
      clientLocation={null}
      clientPhone={clientPhone || null}
      headlineLabel="Amount Received"
      headlineAmount={amountLabel}
      lineItems={items}
      subTotal={(hasLines && subtotalLabel) || columnTotal}
      discountLabel={hasLines && discountLabel ? "Discount" : undefined}
      discountAmount={hasLines ? discountLabel : null}
      vatLabel={hasLines && vatLabel ? "VAT" : null}
      vatAmount={hasLines ? vatLabel : null}
      totalLabel="Total"
      totalAmount={columnTotal}
      paymentMade={paidLabel || amountLabel}
      balanceDue={balanceLabel || zeroLabel}
      notes={`Received by: ${receivedBy}\n${branding.footerText || "Thank you for your business."}`}
      paymentTo={branding.paymentInstructions || null}
      // branding.termsText holds the org's quotation terms, so printing it here
      // put "Quotation valid for 30 days from date issued. Repair work begins
      // only after approval is recorded" on a receipt for money already taken.
      // Owner-written terms are still honoured; the shipped default is not,
      // because it was never written for this document.
      termsText={
        isShippedDefaultTerms(branding.termsText)
          ? "This is a computer-generated receipt and is valid without signature."
          : (branding.termsText ?? "").trim() ||
            "This is a computer-generated receipt and is valid without signature."
      }
    />
  );
}
