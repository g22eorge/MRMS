/**
 * Quotation — Modern template.
 *
 * The catalogue has advertised "Colorful header with summary box" at the
 * STANDARD tier since the picker was written, with no component behind it, so
 * the option silently rendered the default. This is that design.
 *
 * The brief is the layout: a saturated header band the eye lands on, and a
 * summary box carrying the three things a client actually reads first — what
 * it costs, how long the price holds, and whether it has been approved. Those
 * are lifted out of the body and given the strongest position on the page,
 * which is the difference between this and the Default template rather than a
 * change of colour.
 *
 * Prop shape is the shared quotation contract in generate-quotation.ts. Same
 * props as every other quotation template, so it is a drop-in.
 */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { AmountInWordsLine } from "@/lib/pdf/house";

import { hasValue } from "@/lib/pdf/pdf-utils";
import { QuotationPromoStrip, type QuotationPromo } from "@/lib/pdf/QuotationPromoStrip";

const INK = "#0f172a";
const MID = "#475569";
const LITE = "#94a3b8";
const BRAND = "#0f3b7a";
const BRAND_SOFT = "#e8eef8";
const RULE = "#e2e8f0";
const WHITE = "#ffffff";
const PANEL = "#f8fafc";

const s = StyleSheet.create({
  page: { padding: 0, fontSize: 9, color: INK, backgroundColor: WHITE },

  header: {
    backgroundColor: BRAND,
    paddingHorizontal: 26,
    paddingTop: 18,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: { width: 50, height: 50, marginRight: 12 },
  coRow: { flexDirection: "row", alignItems: "center" },
  coName: { fontSize: 13, fontWeight: 700, color: WHITE, marginBottom: 2 },
  coTag: { fontSize: 8, color: BRAND_SOFT, marginBottom: 2 },
  coLine: { fontSize: 7.4, color: BRAND_SOFT, marginBottom: 1 },
  docSide: { alignItems: "flex-end" },
  docType: { fontSize: 24, fontWeight: 800, color: WHITE, letterSpacing: 2 },
  docNum: { fontSize: 9, color: BRAND_SOFT, fontWeight: 600, marginTop: 2 },

  body: { paddingHorizontal: 26, paddingTop: 14, paddingBottom: 20 },

  // The summary box is the point of this template.
  summary: {
    flexDirection: "row",
    backgroundColor: BRAND_SOFT,
    borderLeft: `3 solid ${BRAND}`,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  summaryCell: { flex: 1 },
  summaryLabel: { fontSize: 7.2, color: MID, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 3 },
  summaryValue: { fontSize: 10, fontWeight: 700, color: INK },
  summaryTotal: { fontSize: 15, fontWeight: 800, color: BRAND },

  grid: { flexDirection: "row", gap: 12 },
  col: { width: "50%" },
  block: { marginBottom: 10 },
  label: { fontSize: 7.2, color: LITE, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  value: { fontSize: 9, color: INK, fontWeight: 600 },
  tiny: { fontSize: 7.6, color: MID, marginTop: 1 },

  card: { border: `1 solid ${RULE}`, borderRadius: 5, padding: 9, backgroundColor: PANEL },
  hr: { borderBottom: `1 solid ${RULE}`, marginVertical: 10 },
  moneyRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },

  sigRow: { flexDirection: "row", gap: 12, marginTop: 6 },
  sigLine: { borderBottom: `1 solid ${LITE}`, marginTop: 20 },
  footer: { fontSize: 7.2, color: LITE, marginTop: 10 },
});

type Props = {
  companyName: string;
  companyTagline: string;
  companyAddressLine1: string;
  companyAddressLine2: string;
  companyContacts: string;
  companyEmail: string;
  companyWebsite: string;
  companyTaxId?: string | null;
  companyLogoUrl: string | null;

  quotationNumber: string;
  dateIssued: string;
  validUntil: string;
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
  accessories: string;
  physicalCondition: string;
  customerIssue: string;
  diagnosisSummary: string;
  scopeOfWork: string;

  repairCost: string;
  vatApplicable: boolean;
  vatLabel: string;
  vatAmount: string;
  totalAmountPayable: string;
  amountWords?: string | null;
  estimatedDuration: string;
  approvalStatus: string;
  recommendation: string;
  notes: string;
  status: string;
  currency: string;
  termsText: string;
  promo?: QuotationPromo | null;
  footerText: string;
  signatureCompanyLabel: string;
  signatureClientLabel: string;
};

export function QuotationDocumentModern(props: Props) {
  const contact = [props.companyContacts, props.companyEmail, props.companyWebsite, props.companyTaxId ? `TIN: ${props.companyTaxId}` : ""].filter(Boolean).join(" · ");
  const address = [props.companyAddressLine1, props.companyAddressLine2].filter(Boolean).join(" · ");

  return (
    <Document title={`Quotation ${props.quotationNumber}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.coRow}>
            {props.companyLogoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop.
              <Image src={props.companyLogoUrl} style={s.logo} />
            ) : null}
            <View>
              <Text style={s.coName}>{props.companyName}</Text>
              {props.companyTagline ? <Text style={s.coTag}>{props.companyTagline}</Text> : null}
              {contact ? <Text style={s.coLine}>{contact}</Text> : null}
              {address ? <Text style={s.coLine}>{address}</Text> : null}
            </View>
          </View>
          <View style={s.docSide}>
            <Text style={s.docType}>QUOTATION</Text>
            <Text style={s.docNum}>{props.quotationNumber}</Text>
          </View>
        </View>

        <View style={s.body}>
          <View style={s.summary}>
            <View style={s.summaryCell}>
              <Text style={s.summaryLabel}>Total payable</Text>
              <Text style={s.summaryTotal}>{props.totalAmountPayable}</Text>
            </View>
            <View style={s.summaryCell}>
              <Text style={s.summaryLabel}>Valid until</Text>
              <Text style={s.summaryValue}>{props.validUntil}</Text>
              <Text style={s.tiny}>Issued {props.dateIssued}</Text>
            </View>
            <View style={s.summaryCell}>
              <Text style={s.summaryLabel}>Approval</Text>
              <Text style={s.summaryValue}>{props.approvalStatus}</Text>
              <Text style={s.tiny}>Job {props.repairId}</Text>
            </View>
          </View>

          <View style={s.grid}>
            <View style={s.col}>
              <View style={s.block}>
                <Text style={s.label}>Prepared for</Text>
                <Text style={s.value}>{props.clientName}</Text>
                <Text style={s.tiny}>
                  {props.clientPhone}{hasValue(props.clientEmail) ? ` · ${props.clientEmail}` : ""}
                </Text>
                {hasValue(props.clientOrganization) ? <Text style={s.tiny}>{props.clientOrganization}</Text> : null}
              </View>
            </View>
            <View style={s.col}>
              <View style={s.block}>
                <Text style={s.label}>Prepared by</Text>
                <Text style={s.value}>{props.preparedByName}</Text>
                <Text style={s.tiny}>{props.preparedByRole}</Text>
                <Text style={s.tiny}>Status: {props.status}</Text>
              </View>
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.label}>Device</Text>
            <Text style={s.value}>{props.deviceLabel}</Text>
            <Text style={s.tiny}>
              {props.deviceType}{hasValue(props.serialOrImei) ? ` · ${props.serialOrImei}` : ""}
            </Text>
            {hasValue(props.accessories) ? <Text style={s.tiny}>Accessories: {props.accessories}</Text> : null}
            {hasValue(props.physicalCondition) ? <Text style={s.tiny}>Condition: {props.physicalCondition}</Text> : null}
          </View>

          <View style={[s.grid, { marginTop: 10 }]}>
            <View style={s.col}>
              <View style={s.card}>
                <Text style={s.label}>Reported issue</Text>
                <Text style={s.value}>{hasValue(props.customerIssue) ? props.customerIssue : "-"}</Text>
              </View>
            </View>
            <View style={s.col}>
              <View style={s.card}>
                <Text style={s.label}>Diagnosis</Text>
                <Text style={s.value}>{hasValue(props.diagnosisSummary) ? props.diagnosisSummary : "-"}</Text>
              </View>
            </View>
          </View>

          <View style={[s.card, { marginTop: 10 }]}>
            <Text style={s.label}>Scope of work</Text>
            <Text style={s.value}>{hasValue(props.scopeOfWork) ? props.scopeOfWork : "-"}</Text>
            {hasValue(props.estimatedDuration) ? <Text style={s.tiny}>Estimated duration: {props.estimatedDuration}</Text> : null}
            {hasValue(props.recommendation) ? <Text style={s.tiny}>Recommendation: {props.recommendation}</Text> : null}
            {hasValue(props.notes) ? <Text style={s.tiny}>Notes: {props.notes}</Text> : null}
          </View>

          <View style={[s.card, { marginTop: 10 }]}>
            <Text style={s.label}>Pricing</Text>
            <View style={s.moneyRow}>
              <Text style={s.tiny}>Repair cost</Text>
              <Text style={s.value}>{props.repairCost}</Text>
            </View>
            {props.vatApplicable ? (
              <View style={s.moneyRow}>
                <Text style={s.tiny}>{props.vatLabel}</Text>
                <Text style={s.value}>{props.vatAmount}</Text>
              </View>
            ) : null}
            <View style={[s.hr, { marginVertical: 6 }]} />
            <View style={s.moneyRow}>
              <Text style={s.value}>Total payable</Text>
              <Text style={s.summaryTotal}>{props.totalAmountPayable}</Text>
            </View>
            <AmountInWordsLine value={props.amountWords} />
          </View>

          {props.termsText ? (
            <View style={{ marginTop: 10 }}>
              <Text style={s.label}>Terms</Text>
              <Text style={[s.tiny, { color: MID }]}>{props.termsText}</Text>
            </View>
          ) : null}

          <View style={s.hr} />
          <View style={s.sigRow}>
            <View style={s.col}>
              <Text style={s.tiny}>{props.signatureCompanyLabel}</Text>
              <View style={s.sigLine} />
            </View>
            <View style={s.col}>
              <Text style={s.tiny}>{props.signatureClientLabel}</Text>
              <View style={s.sigLine} />
            </View>
          </View>

          {props.footerText ? <Text style={s.footer}>{props.footerText}</Text> : null}
          <QuotationPromoStrip promo={props.promo} />
        </View>
      </Page>
    </Document>
  );
}
