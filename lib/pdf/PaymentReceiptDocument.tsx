/**
 * Payment receipt — Eagle Info house style (delegates to EagleInfoDocument so it
 * matches the official invoice/estimate/receipt layout: navy line-item header,
 * orange top rule, Receipt Date / Payment Method / Reference meta, and the DFCU
 * "Payment To" block).
 */
import { EagleInfoDocument, type EagleInfoLineItem } from "./EagleInfoDocument";

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
  forLabel: string;
  receivedBy: string;
  clientName?: string | null;
  clientOrganization?: string | null;
  clientPhone?: string | null;
};

export function PaymentReceiptDocument({ branding, receiptNumber, receivedAt, method, reference, amountLabel, forLabel, receivedBy, clientName, clientOrganization, clientPhone }: ReceiptProps) {
  const address = [branding.companyAddressLine1, branding.companyAddressLine2].filter(Boolean).join(", ");

  // A paid receipt has no outstanding balance — mirror the amount's currency by
  // zeroing its numeric part (e.g. "UGX 600,000" -> "UGX 0").
  const zeroLabel = amountLabel.replace(/[\d.,]+/, "0");

  const items: EagleInfoLineItem[] = [{
    name:     `Payment received — ${forLabel}`,
    quantity: 1,
    rate:     amountLabel,
    amount:   amountLabel,
  }];

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
        { label: "Reference", value: reference || `REF-${receiptNumber}` },
      ]}
      clientLabel="Received From"
      clientName={clientName || "—"}
      clientLocation={clientOrganization || null}
      clientPhone={clientPhone || null}
      lineItems={items}
      subTotal={amountLabel}
      totalLabel="Total"
      totalAmount={amountLabel}
      paymentMade={amountLabel}
      balanceDue={zeroLabel}
      notes={`Received by: ${receivedBy}\n${branding.footerText || "Thank you for your business."}`}
      paymentTo={branding.paymentInstructions || null}
      termsText={branding.termsText || "This is a computer-generated receipt and is valid without signature."}
    />
  );
}
