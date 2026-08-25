/**
 * Adapts the existing InvoiceDocument prop shape into EagleInfoDocument.
 * Drop-in replacement for InvoiceDocument (invoice_classic default).
 */
import { EagleInfoDocument, type EagleInfoLineItem } from "./EagleInfoDocument";
import type { PdfLineItem } from "./pdf-line-items";

type Props = {
  companyName: string;
  companyTagline?: string;
  companyAddressLine1: string;
  companyAddressLine2: string;
  companyContacts: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyLogoUrl?: string;
  paymentInstructions?: string;
  invoiceNumber: string;
  dateIssued: string;
  repairId: string;
  preparedByName: string;
  preparedByRole: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientOrganization: string;
  deviceType: string;
  deviceLabel: string;
  serialOrImei: string;
  diagnosisSummary: string;
  workDone: string;
  partsReplaced: string;
  repairCost: string;
  vatApplicable: boolean;
  vatLabel: string;
  vatAmount: string;
  totalAmountPayable: string;
  paymentMade?: string;
  balanceDue?: string;
  isPaid: boolean;
  status: string;
  currency: string;
  termsText: string;
  footerText: string;
  signatureCompanyLabel: string;
  signatureClientLabel: string;
  lineItems?: PdfLineItem[];
  documentMode?: string;
  subtotalValue?: string;
};

export function EagleInfoInvoiceAdapter(props: Props) {
  const address = [props.companyAddressLine1, props.companyAddressLine2]
    .filter(Boolean).join(", ");

  // Only show a VAT line when tax actually applies and is non-zero (the official
  // invoice omits the VAT row entirely when there's none).
  const showVat = props.vatApplicable && !!props.vatAmount && props.vatAmount !== "UGX 0";

  // Build line items — use provided lines, or synthesise from repair data
  let items: EagleInfoLineItem[];
  if (props.lineItems && props.lineItems.length > 0) {
    items = props.lineItems.map((li) => ({
      name:     li.description,
      sku:      li.sku ?? null,
      quantity: li.quantity,
      rate:     li.unitPrice,
      amount:   li.lineTotal,
    }));
  } else {
    // Repair invoice: single composite line
    const parts   = props.partsReplaced !== "N/A" ? `\nParts: ${props.partsReplaced}` : "";
    const workDesc = props.workDone !== "N/A"     ? props.workDone : props.diagnosisSummary;
    items = [{
      name:     `Device Repair — ${props.deviceLabel}`,
      sku:      props.repairId,
      quantity: 1,
      rate:     props.repairCost,
      // Line amount is the pre-VAT charge (= rate × 1); VAT is added in the totals.
      amount:   props.repairCost,
    }];
    if (workDesc && workDesc !== "N/A") {
      items[0] = { ...items[0], name: `${items[0].name}\n${workDesc}${parts}` };
    }
  }

  return (
    <EagleInfoDocument
      companyName={props.companyName}
      companyAddress={address}
      companyPhone={props.companyContacts || null}
      companyEmail={props.companyEmail || null}
      companyWebsite={props.companyWebsite || null}
      companyLogoUrl={props.companyLogoUrl || null}
      docTitle="Invoice"
      docNumber={props.invoiceNumber}
      docDate={props.dateIssued}
      primaryDateLabel="Inv Date:"
      terms={props.termsText ? "As agreed" : null}
      dueDate={props.isPaid ? "Paid" : null}
      clientLabel="Bill To"
      clientName={props.clientOrganization || props.clientName}
      clientAttn={props.clientOrganization ? props.clientName : null}
      clientEmail={props.clientEmail || null}
      clientPhone={props.clientPhone || null}
      clientLocation={null}
      lineItems={items}
      subTotal={props.subtotalValue || props.repairCost || null}
      vatLabel={showVat ? props.vatLabel : null}
      vatAmount={showVat ? props.vatAmount : null}
      totalLabel="Total"
      totalAmount={props.totalAmountPayable}
      paymentMade={props.paymentMade ?? (props.isPaid ? props.totalAmountPayable : "UGX 0")}
      balanceDue={props.balanceDue ?? (props.isPaid ? "UGX 0" : props.totalAmountPayable)}
      notes={props.footerText || null}
      paymentTo={props.paymentInstructions || null}
      termsText={props.termsText || null}
    />
  );
}
