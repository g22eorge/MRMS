import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { AmountInWordsLine, DIVIDER, INK, LABEL_SZ, MUTED, NAVY, PANEL, SHADE, SP, WHITE } from "@/lib/pdf/house";
import type { PdfLineItem } from "./pdf-line-items";

/**
 * Itemised invoice — the PREMIUM tier's invoice design.
 *
 * The catalogue advertises five designs per document at five plan tiers, and
 * job cards and receipts add one at every step. Invoices and quotations did not:
 * both put two designs at GROWTH and nothing at PREMIUM, so a customer paying to
 * move from Duuka Pro to Duuka Max gained a job card and a receipt design and no
 * invoice at all. This closes that gap rather than moving an existing design up a
 * tier, which would have taken a design away from customers who already have it.
 *
 * PREMIUM in this catalogue means more detail, not different colours — the job
 * card at this tier adds a test checklist and the receipt adds every line with
 * its SKU. So this one earns its place by showing the things the other four
 * invoice designs leave out: the stock code against each line, what tax each
 * line carried, and a settlement panel that states what has been paid and what
 * is still owed rather than only the total.
 */

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 46, paddingHorizontal: 34, fontSize: 9, fontFamily: "Helvetica", color: INK },

  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { width: 96, height: 30, objectFit: "contain", marginBottom: 6 },
  coName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: INK },
  coLine: { fontSize: 7.5, color: MUTED, lineHeight: 1.45 },

  titleWrap: { alignItems: "flex-end" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: -0.4 },
  docNo: { fontSize: 8, color: MUTED, marginTop: 1 },

  // A settlement strip rather than a single balance box: this design exists to
  // say what is outstanding, not merely what was charged.
  strip: { flexDirection: "row", marginTop: SP.md, borderWidth: 0.5, borderColor: DIVIDER, borderRadius: 3, overflow: "hidden" },
  cell: { flex: 1, paddingVertical: 7, paddingHorizontal: 9, borderRightWidth: 0.5, borderRightColor: DIVIDER },
  cellLast: { flex: 1, paddingVertical: 7, paddingHorizontal: 9 },
  cellLbl: { fontSize: LABEL_SZ, fontFamily: "Helvetica-Bold", color: MUTED, letterSpacing: 0.6, textTransform: "uppercase" },
  cellVal: { fontSize: 10, fontFamily: "Helvetica-Bold", color: INK, marginTop: 2 },
  cellDue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#B45309", marginTop: 2 },

  parties: { flexDirection: "row", gap: 14, marginTop: SP.md },
  party: { flex: 1, backgroundColor: SHADE, borderRadius: 3, padding: 9 },
  partyLbl: { fontSize: LABEL_SZ, fontFamily: "Helvetica-Bold", color: MUTED, letterSpacing: 0.6, textTransform: "uppercase" },
  partyName: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 3 },
  partyLine: { fontSize: 8, color: MUTED, marginTop: 1.5 },

  // Six columns, which is the point of the design.
  tHead: { flexDirection: "row", backgroundColor: NAVY, marginTop: SP.md, paddingVertical: 6, paddingHorizontal: 8, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  th: { fontSize: 7, fontFamily: "Helvetica-Bold", color: WHITE, letterSpacing: 0.5, textTransform: "uppercase" },
  row: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: DIVIDER },
  rowAlt: { backgroundColor: PANEL },
  cNo: { width: "5%" }, cDesc: { width: "39%" }, cQty: { width: "8%", textAlign: "right" },
  cRate: { width: "16%", textAlign: "right" }, cTax: { width: "14%", textAlign: "right" }, cAmt: { width: "18%", textAlign: "right" },
  cell9: { fontSize: 8.5 },
  sku: { fontSize: 7, color: MUTED, marginTop: 1 },
  muted: { fontSize: 8.5, color: MUTED },
  amt: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },

  totals: { marginTop: SP.sm, marginLeft: "auto", width: 220 },
  tRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  tLbl: { fontSize: 8.5, color: MUTED },
  tVal: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  tTotal: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: DIVIDER, paddingTop: 5, marginTop: 3 },

  foot: { marginTop: SP.lg, borderTopWidth: 0.5, borderTopColor: DIVIDER, paddingTop: 8, flexDirection: "row", gap: 16 },
  footCol: { flex: 1 },
  footLbl: { fontSize: LABEL_SZ, fontFamily: "Helvetica-Bold", color: MUTED, letterSpacing: 0.6, textTransform: "uppercase" },
  footText: { fontSize: 7.5, color: MUTED, lineHeight: 1.5, marginTop: 3 },
});

type Props = {
  companyName: string; companyTagline?: string; companyAddressLine1: string; companyAddressLine2: string;
  companyContacts: string; companyEmail?: string; companyWebsite?: string;
  companyTaxId?: string | null; companyLogoUrl?: string;
  documentTitle: string; quotationNumber: string; dateIssued: string; validUntil: string;
  repairId: string; preparedByName: string; preparedByRole: string;
  clientName: string; clientPhone: string; clientEmail: string; clientOrganization: string;
  deviceType: string; deviceLabel: string; serialOrImei: string; accessories: string; physicalCondition: string;
  customerIssue: string; diagnosisSummary: string; scopeOfWork: string;
  repairCost: string; vatApplicable: boolean; vatLabel: string; vatAmount: string; totalAmountPayable: string;
  amountWords?: string | null;
  estimatedDuration: string; approvalStatus: string; recommendation: string; notes: string;
  status: string; currency: string; termsText: string; footerText: string;
  signatureCompanyLabel: string; signatureClientLabel: string;
  invoiceNumber?: string;
  paymentMade?: string | null;
  balanceDue?: string | null;
  isPaid?: boolean;
  lineItems?: PdfLineItem[];
  documentMode?: string;
  subtotalValue?: string;
};

export function InvoiceDocumentItemized(props: Props) {
  const docNumber = props.invoiceNumber || props.quotationNumber;
  const items = props.lineItems ?? [];
  // With no line items there is nothing to itemise, so the repair charge stands
  // as the single line rather than the page rendering an empty table.
  const rows: PdfLineItem[] = items.length > 0
    ? items
    : [{ description: props.scopeOfWork || props.customerIssue || "Repair services", quantity: 1, unitPrice: props.repairCost, lineTotal: props.repairCost }];

  const companyLines = [
    props.companyAddressLine1, props.companyAddressLine2, props.companyContacts,
    [props.companyEmail, props.companyWebsite].filter(Boolean).join("  ·  "),
    props.companyTaxId ? `TIN: ${props.companyTaxId}` : "",
  ].filter(Boolean);

  const clientLines = [props.clientOrganization, props.clientPhone, props.clientEmail].filter(Boolean);
  const deviceLine = [props.deviceLabel, props.serialOrImei && `S/N ${props.serialOrImei}`].filter(Boolean).join("  ·  ");

  return (
    <Document title={`${props.documentTitle} ${docNumber}`}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View style={{ maxWidth: "58%" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {props.companyLogoUrl ? <Image style={s.logo} src={props.companyLogoUrl} /> : null}
            <Text style={s.coName}>{props.companyName}</Text>
            {companyLines.map((l, i) => <Text key={i} style={s.coLine}>{l}</Text>)}
          </View>
          <View style={s.titleWrap}>
            <Text style={s.title}>{props.documentTitle}</Text>
            <Text style={s.docNo}>#{docNumber}</Text>
            <Text style={s.docNo}>Issued {props.dateIssued}</Text>
            {props.status ? <Text style={s.docNo}>{props.status}</Text> : null}
          </View>
        </View>

        {/* What is charged, what has been paid, what is left. */}
        <View style={s.strip}>
          <View style={s.cell}>
            <Text style={s.cellLbl}>Invoice total</Text>
            <Text style={s.cellVal}>{props.totalAmountPayable}</Text>
          </View>
          <View style={s.cell}>
            <Text style={s.cellLbl}>Paid to date</Text>
            <Text style={s.cellVal}>{props.paymentMade ?? (props.isPaid ? props.totalAmountPayable : "—")}</Text>
          </View>
          <View style={s.cellLast}>
            <Text style={s.cellLbl}>Balance due</Text>
            <Text style={props.isPaid ? s.cellVal : s.cellDue}>
              {props.balanceDue ?? (props.isPaid ? "—" : props.totalAmountPayable)}
            </Text>
          </View>
        </View>

        <View style={s.parties}>
          <View style={s.party}>
            <Text style={s.partyLbl}>Billed to</Text>
            <Text style={s.partyName}>{props.clientName}</Text>
            {clientLines.map((l, i) => <Text key={i} style={s.partyLine}>{l}</Text>)}
          </View>
          <View style={s.party}>
            <Text style={s.partyLbl}>{deviceLine ? "Equipment" : "Reference"}</Text>
            <Text style={s.partyName}>{deviceLine || props.repairId || "—"}</Text>
            {props.preparedByName ? <Text style={s.partyLine}>Prepared by {props.preparedByName}</Text> : null}
            {props.repairId && deviceLine ? <Text style={s.partyLine}>Job {props.repairId}</Text> : null}
          </View>
        </View>

        <View style={s.tHead}>
          <Text style={[s.th, s.cNo]}>#</Text>
          <Text style={[s.th, s.cDesc]}>Item &amp; stock code</Text>
          <Text style={[s.th, s.cQty]}>Qty</Text>
          <Text style={[s.th, s.cRate]}>Unit</Text>
          <Text style={[s.th, s.cTax]}>Tax</Text>
          <Text style={[s.th, s.cAmt]}>Amount</Text>
        </View>
        {rows.map((it, i) => (
          <View key={i} style={i % 2 === 1 ? [s.row, s.rowAlt] : s.row} wrap={false}>
            <Text style={[s.muted, s.cNo]}>{i + 1}</Text>
            <View style={s.cDesc}>
              <Text style={s.cell9}>{it.description}</Text>
              {it.sku ? <Text style={s.sku}>SKU {it.sku}</Text> : null}
            </View>
            <Text style={[s.cell9, s.cQty]}>{it.quantity}</Text>
            <Text style={[s.muted, s.cRate]}>{it.unitPrice}</Text>
            <Text style={[s.muted, s.cTax]}>{props.vatApplicable ? props.vatLabel : "—"}</Text>
            <Text style={[s.amt, s.cAmt]}>{it.lineTotal}</Text>
          </View>
        ))}

        <View style={s.totals}>
          <View style={s.tRow}>
            <Text style={s.tLbl}>Sub-total</Text>
            <Text style={s.tVal}>{props.subtotalValue || props.repairCost}</Text>
          </View>
          {props.vatApplicable ? (
            <View style={s.tRow}>
              <Text style={s.tLbl}>{props.vatLabel}</Text>
              <Text style={s.tVal}>{props.vatAmount}</Text>
            </View>
          ) : null}
          <View style={s.tTotal}>
            <Text style={[s.tVal, { fontSize: 10 }]}>Total</Text>
            <Text style={[s.tVal, { fontSize: 10 }]}>{props.totalAmountPayable}</Text>
          </View>
        </View>

        <AmountInWordsLine value={props.amountWords} />

        <View style={s.foot}>
          {props.termsText ? (
            <View style={s.footCol}>
              <Text style={s.footLbl}>Terms &amp; conditions</Text>
              <Text style={s.footText}>{props.termsText}</Text>
            </View>
          ) : null}
          <View style={s.footCol}>
            <Text style={s.footLbl}>Notes</Text>
            <Text style={s.footText}>{props.notes || props.footerText}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
