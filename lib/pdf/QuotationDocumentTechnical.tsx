import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { AmountInWordsLine, DIVIDER, INK, LABEL_SZ, MUTED, NAVY, PANEL, SHADE, SP, WHITE } from "@/lib/pdf/house";
import type { PdfLineItem } from "./pdf-line-items";

/**
 * Technical quotation — the PREMIUM tier's quotation design.
 *
 * Pairs with the itemised invoice added at the same tier, for the same reason:
 * the catalogue promised a new design at every step and quotations gave PREMIUM
 * nothing. Adding one is the honest fix; promoting an existing GROWTH design
 * would have taken it away from customers who already have it.
 *
 * What makes it a PREMIUM design rather than a recolour is the same thing that
 * makes the job card at this tier one — it carries information the others do
 * not. A quotation that loses work loses it on ambiguity, so this one states
 * the assessment, what is included per line, and, most importantly, what is
 * *excluded*. The exclusions block is the part that prevents an argument later,
 * and no other quotation design has anywhere to put it.
 */

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 46, paddingHorizontal: 34, fontSize: 9, fontFamily: "Helvetica", color: INK },

  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 1.5, borderBottomColor: NAVY, paddingBottom: 8 },
  logo: { width: 92, height: 28, objectFit: "contain", marginBottom: 5 },
  coName: { fontSize: 12.5, fontFamily: "Helvetica-Bold" },
  coLine: { fontSize: 7.5, color: MUTED, lineHeight: 1.45 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: -0.3, textAlign: "right" },
  docNo: { fontSize: 8, color: MUTED, textAlign: "right", marginTop: 1 },

  metaRow: { flexDirection: "row", marginTop: SP.md, gap: 10 },
  meta: { flex: 1, borderLeftWidth: 2, borderLeftColor: NAVY, paddingLeft: 7 },
  metaLbl: { fontSize: LABEL_SZ, fontFamily: "Helvetica-Bold", color: MUTED, letterSpacing: 0.6, textTransform: "uppercase" },
  metaVal: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 2 },

  block: { marginTop: SP.md, backgroundColor: SHADE, borderRadius: 3, padding: 10 },
  blockLbl: { fontSize: LABEL_SZ, fontFamily: "Helvetica-Bold", color: MUTED, letterSpacing: 0.6, textTransform: "uppercase" },
  blockBody: { fontSize: 8.5, lineHeight: 1.55, marginTop: 4 },

  twoUp: { flexDirection: "row", gap: 10, marginTop: SP.md },
  half: { flex: 1, borderWidth: 0.5, borderColor: DIVIDER, borderRadius: 3, padding: 9 },

  tHead: { flexDirection: "row", backgroundColor: NAVY, marginTop: SP.md, paddingVertical: 6, paddingHorizontal: 8, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  th: { fontSize: 7, fontFamily: "Helvetica-Bold", color: WHITE, letterSpacing: 0.5, textTransform: "uppercase" },
  row: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: DIVIDER },
  rowAlt: { backgroundColor: PANEL },
  cNo: { width: "6%" }, cSpec: { width: "54%" }, cQty: { width: "10%", textAlign: "right" },
  cRate: { width: "14%", textAlign: "right" }, cAmt: { width: "16%", textAlign: "right" },
  cell9: { fontSize: 8.5 },
  spec: { fontSize: 7, color: MUTED, marginTop: 1.5, lineHeight: 1.4 },
  muted: { fontSize: 8.5, color: MUTED },
  amt: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },

  totals: { marginTop: SP.sm, marginLeft: "auto", width: 210 },
  tRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  tLbl: { fontSize: 8.5, color: MUTED },
  tVal: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  tTotal: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: DIVIDER, paddingTop: 5, marginTop: 3 },

  excl: { marginTop: SP.md, borderWidth: 0.5, borderColor: "#D9A441", borderRadius: 3, padding: 9, backgroundColor: "#FDF8EC" },
  exclLbl: { fontSize: LABEL_SZ, fontFamily: "Helvetica-Bold", color: "#8A6216", letterSpacing: 0.6, textTransform: "uppercase" },
  exclBody: { fontSize: 8, color: "#6B4E12", lineHeight: 1.5, marginTop: 3 },

  sigRow: { flexDirection: "row", gap: 20, marginTop: SP.lg },
  sig: { flex: 1 },
  sigLine: { borderTopWidth: 0.5, borderTopColor: INK, marginTop: 26, paddingTop: 3 },
  sigLbl: { fontSize: 7.5, color: MUTED },
  foot: { marginTop: SP.md, borderTopWidth: 0.5, borderTopColor: DIVIDER, paddingTop: 7 },
  footText: { fontSize: 7.5, color: MUTED, lineHeight: 1.5 },
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
  lineItems?: PdfLineItem[];
  documentMode?: string;
  subtotalValue?: string;
};

export function QuotationDocumentTechnical(props: Props) {
  const items = props.lineItems ?? [];
  const rows: PdfLineItem[] = items.length > 0
    ? items
    : [{ description: props.scopeOfWork || "Repair works as assessed", quantity: 1, unitPrice: props.repairCost, lineTotal: props.repairCost }];

  const companyLines = [
    props.companyAddressLine1, props.companyContacts,
    [props.companyEmail, props.companyWebsite].filter(Boolean).join("  ·  "),
    props.companyTaxId ? `TIN: ${props.companyTaxId}` : "",
  ].filter(Boolean);

  // deviceLabel is the heading of this cell already; repeating it in the detail
  // line printed the model twice, one above the other.
  const device = [props.serialOrImei && `S/N ${props.serialOrImei}`, props.physicalCondition && `Condition: ${props.physicalCondition}`]
    .filter(Boolean).join("  ·  ");

  return (
    <Document title={`Quotation ${props.quotationNumber}`}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View style={{ maxWidth: "58%" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {props.companyLogoUrl ? <Image style={s.logo} src={props.companyLogoUrl} /> : null}
            <Text style={s.coName}>{props.companyName}</Text>
            {companyLines.map((l, i) => <Text key={i} style={s.coLine}>{l}</Text>)}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Quotation</Text>
            <Text style={s.docNo}>#{props.quotationNumber}</Text>
            <Text style={s.docNo}>Issued {props.dateIssued}</Text>
            <Text style={s.docNo}>Valid until {props.validUntil}</Text>
          </View>
        </View>

        <View style={s.metaRow}>
          <View style={s.meta}>
            <Text style={s.metaLbl}>Prepared for</Text>
            <Text style={s.metaVal}>{props.clientOrganization || props.clientName}</Text>
            <Text style={s.coLine}>{[props.clientOrganization ? props.clientName : "", props.clientPhone].filter(Boolean).join("  ·  ")}</Text>
          </View>
          <View style={s.meta}>
            <Text style={s.metaLbl}>Equipment</Text>
            <Text style={s.metaVal}>{props.deviceLabel || props.deviceType || "—"}</Text>
            {device ? <Text style={s.coLine}>{device}</Text> : null}
          </View>
          <View style={s.meta}>
            <Text style={s.metaLbl}>Total</Text>
            <Text style={[s.metaVal, { fontSize: 12, color: NAVY }]}>{props.totalAmountPayable}</Text>
            {props.estimatedDuration ? <Text style={s.coLine}>Est. {props.estimatedDuration}</Text> : null}
          </View>
        </View>

        <View style={s.twoUp}>
          <View style={s.half}>
            <Text style={s.blockLbl}>Reported fault</Text>
            <Text style={s.blockBody}>{props.customerIssue || "—"}</Text>
          </View>
          <View style={s.half}>
            <Text style={s.blockLbl}>Assessment</Text>
            <Text style={s.blockBody}>{props.diagnosisSummary || "—"}</Text>
          </View>
        </View>

        {props.scopeOfWork ? (
          <View style={s.block}>
            <Text style={s.blockLbl}>Proposed works</Text>
            <Text style={s.blockBody}>{props.scopeOfWork}</Text>
          </View>
        ) : null}

        <View style={s.tHead}>
          <Text style={[s.th, s.cNo]}>#</Text>
          <Text style={[s.th, s.cSpec]}>Works &amp; specification</Text>
          <Text style={[s.th, s.cQty]}>Qty</Text>
          <Text style={[s.th, s.cRate]}>Rate</Text>
          <Text style={[s.th, s.cAmt]}>Amount</Text>
        </View>
        {rows.map((it, i) => (
          <View key={i} style={i % 2 === 1 ? [s.row, s.rowAlt] : s.row} wrap={false}>
            <Text style={[s.muted, s.cNo]}>{i + 1}</Text>
            <View style={s.cSpec}>
              <Text style={s.cell9}>{it.description}</Text>
              {it.sku ? <Text style={s.spec}>Part reference {it.sku}</Text> : null}
            </View>
            <Text style={[s.cell9, s.cQty]}>{it.quantity}</Text>
            <Text style={[s.muted, s.cRate]}>{it.unitPrice}</Text>
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

        {/* The block that stops the argument. A quotation that loses work
            usually loses it on what someone assumed was included. */}
        <View style={s.excl}>
          <Text style={s.exclLbl}>Not included in this quotation</Text>
          <Text style={s.exclBody}>
            {props.recommendation
              || "Faults found after disassembly that were not visible at assessment, parts that fail while being removed, and any works not listed above. Anything further is quoted separately and starts only once you approve it."}
          </Text>
        </View>

        <View style={s.sigRow}>
          <View style={s.sig}>
            <View style={s.sigLine} />
            <Text style={s.sigLbl}>{props.signatureCompanyLabel}</Text>
          </View>
          <View style={s.sig}>
            <View style={s.sigLine} />
            <Text style={s.sigLbl}>{props.signatureClientLabel}</Text>
          </View>
        </View>

        {props.termsText ? (
          <View style={s.foot}>
            <Text style={s.footText}>{props.termsText}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
