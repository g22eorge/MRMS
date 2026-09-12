/**
 * Quotation — Executive template.
 *
 * The ENTERPRISE tier has advertised "Dark premium layout for corporate
 * proposals" with nothing behind it, so the option rendered the default. This
 * is that design, and it deliberately mirrors InvoiceDocumentExecutive: navy
 * header, gold rule, same type scale. A client who receives the quotation and
 * then the invoice should see one house, not two — matching the sibling
 * matters more here than inventing a separate look.
 *
 * Where it departs from the other quotation templates is framing. A corporate
 * proposal is read by someone who did not hand in the device: it opens with
 * the investment and the validity window, states scope as a commitment, and
 * carries an acceptance block rather than a bare signature rule.
 *
 * Prop shape is the shared quotation contract in generate-quotation.ts.
 */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { AmountInWordsLine } from "@/lib/pdf/house";

import { hasValue } from "@/lib/pdf/pdf-utils";
import { QuotationPromoStrip, type QuotationPromo } from "@/lib/pdf/QuotationPromoStrip";

const NAVY = "#0f172a";
const SLATE = "#1e293b";
const GOLD = "#C9A227";
const GOLD2 = "#f6e27a";
const MID = "#475569";
const LITE = "#94a3b8";
const RULE = "#e2e8f0";
const BG = "#f8fafc";
const WHITE = "#ffffff";

const s = StyleSheet.create({
  page: { padding: 0, fontSize: 8.8, color: NAVY, backgroundColor: BG },

  header: {
    backgroundColor: NAVY,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: { width: 56, height: 56 },
  logoChip: {
    backgroundColor: WHITE,
    borderRadius: 4,
    padding: 4,
    marginRight: 12,
  },

  coRow: { flexDirection: "row", alignItems: "center" },
  coName: { fontSize: 14, fontWeight: 700, color: WHITE, marginBottom: 2 },
  coTag: { fontSize: 8.2, color: GOLD, fontWeight: 600, marginBottom: 2 },
  coLine: { fontSize: 7.8, color: LITE, marginBottom: 1 },
  docSide: { alignItems: "flex-end" },
  docLbl: { fontSize: 8, color: LITE, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 2 },
  docType: { fontSize: 26, fontWeight: 700, color: GOLD, letterSpacing: 2, marginBottom: 3 },
  docNum: { fontSize: 9, color: GOLD2, fontWeight: 600 },
  goldBar: { backgroundColor: GOLD, height: 4 },

  body: { paddingHorizontal: 28, paddingTop: 16, paddingBottom: 22 },

  investment: {
    backgroundColor: SLATE,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  investLabel: { fontSize: 7.6, color: LITE, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  investValue: { fontSize: 20, fontWeight: 700, color: GOLD },
  investSide: { alignItems: "flex-end" },
  investMeta: { fontSize: 8.4, color: WHITE, fontWeight: 600 },

  grid: { flexDirection: "row", gap: 14 },
  col: { width: "50%" },
  block: { marginBottom: 10 },
  label: { fontSize: 7.4, color: LITE, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 },
  value: { fontSize: 9, color: NAVY, fontWeight: 600 },
  tiny: { fontSize: 7.6, color: MID, marginTop: 1 },

  card: { border: `1 solid ${RULE}`, borderRadius: 4, padding: 10, backgroundColor: WHITE },
  sectionRule: { borderBottom: `2 solid ${GOLD}`, width: 34, marginBottom: 6 },
  hr: { borderBottom: `1 solid ${RULE}`, marginVertical: 10 },
  moneyRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  totalValue: { fontSize: 13, fontWeight: 700, color: NAVY },

  accept: {
    marginTop: 12,
    border: `1 solid ${GOLD}`,
    borderRadius: 4,
    padding: 12,
    backgroundColor: WHITE,
  },
  sigRow: { flexDirection: "row", gap: 14, marginTop: 8 },
  sigLine: { borderBottom: `1 solid ${MID}`, marginTop: 22 },
  footer: { fontSize: 7.2, color: LITE, marginTop: 12 },
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

export function QuotationDocumentExecutive(props: Props) {
  const contact = [props.companyContacts, props.companyEmail, props.companyWebsite, props.companyTaxId ? `TIN: ${props.companyTaxId}` : ""].filter(Boolean).join(" · ");
  const address = [props.companyAddressLine1, props.companyAddressLine2].filter(Boolean).join(" · ");

  return (
    <Document title={`Quotation ${props.quotationNumber}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.coRow}>
            {props.companyLogoUrl ? (
              // The header is near-black and the mark is dark artwork, so it
              // disappears straight into the background without a light chip.
              <View style={s.logoChip}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop. */}
                <Image src={props.companyLogoUrl} style={s.logo} />
              </View>
            ) : null}
            <View>
              <Text style={s.coName}>{props.companyName}</Text>
              {props.companyTagline ? <Text style={s.coTag}>{props.companyTagline}</Text> : null}
              {contact ? <Text style={s.coLine}>{contact}</Text> : null}
              {address ? <Text style={s.coLine}>{address}</Text> : null}
            </View>
          </View>
          <View style={s.docSide}>
            <Text style={s.docLbl}>Proposal</Text>
            <Text style={s.docType}>QUOTATION</Text>
            <Text style={s.docNum}>{props.quotationNumber}</Text>
          </View>
        </View>
        <View style={s.goldBar} />

        <View style={s.body}>
          <View style={s.investment}>
            <View>
              <Text style={s.investLabel}>Total investment</Text>
              <Text style={s.investValue}>{props.totalAmountPayable}</Text>
            </View>
            <View style={s.investSide}>
              <Text style={s.investLabel}>Valid until</Text>
              <Text style={s.investMeta}>{props.validUntil}</Text>
              <Text style={[s.investLabel, { marginTop: 6 }]}>Status</Text>
              <Text style={s.investMeta}>{props.approvalStatus}</Text>
            </View>
          </View>

          <View style={s.grid}>
            <View style={s.col}>
              <View style={s.block}>
                <View style={s.sectionRule} />
                <Text style={s.label}>Prepared for</Text>
                <Text style={s.value}>
                  {hasValue(props.clientOrganization) ? props.clientOrganization : props.clientName}
                </Text>
                {hasValue(props.clientOrganization) ? <Text style={s.tiny}>Attn: {props.clientName}</Text> : null}
                <Text style={s.tiny}>
                  {props.clientPhone}{hasValue(props.clientEmail) ? ` · ${props.clientEmail}` : ""}
                </Text>
              </View>
            </View>
            <View style={s.col}>
              <View style={s.block}>
                <View style={s.sectionRule} />
                <Text style={s.label}>Issued</Text>
                <Text style={s.value}>{props.dateIssued}</Text>
                <Text style={s.tiny}>Reference: {props.repairId}</Text>
                <Text style={s.tiny}>{props.preparedByName} · {props.preparedByRole}</Text>
              </View>
            </View>
          </View>

          <View style={s.card}>
            <View style={s.sectionRule} />
            <Text style={s.label}>Equipment</Text>
            <Text style={s.value}>{props.deviceLabel}</Text>
            <Text style={s.tiny}>
              {props.deviceType}{hasValue(props.serialOrImei) ? ` · ${props.serialOrImei}` : ""}
            </Text>
            {hasValue(props.accessories) ? <Text style={s.tiny}>Accessories: {props.accessories}</Text> : null}
            {hasValue(props.physicalCondition) ? <Text style={s.tiny}>Condition on receipt: {props.physicalCondition}</Text> : null}
          </View>

          <View style={[s.card, { marginTop: 10 }]}>
            <View style={s.sectionRule} />
            <Text style={s.label}>Assessment</Text>
            <Text style={s.value}>{hasValue(props.customerIssue) ? props.customerIssue : "-"}</Text>
            {hasValue(props.diagnosisSummary) ? (
              <Text style={[s.tiny, { marginTop: 4 }]}>Findings: {props.diagnosisSummary}</Text>
            ) : null}
          </View>

          <View style={[s.card, { marginTop: 10 }]}>
            <View style={s.sectionRule} />
            <Text style={s.label}>Proposed scope</Text>
            <Text style={s.value}>{hasValue(props.scopeOfWork) ? props.scopeOfWork : "-"}</Text>
            {hasValue(props.estimatedDuration) ? <Text style={s.tiny}>Estimated duration: {props.estimatedDuration}</Text> : null}
            {hasValue(props.recommendation) ? <Text style={s.tiny}>Recommendation: {props.recommendation}</Text> : null}
            {hasValue(props.notes) ? <Text style={s.tiny}>Notes: {props.notes}</Text> : null}
          </View>

          <View style={[s.card, { marginTop: 10 }]}>
            <View style={s.sectionRule} />
            <Text style={s.label}>Commercials</Text>
            <View style={s.moneyRow}>
              <Text style={s.tiny}>Works</Text>
              <Text style={s.value}>{props.repairCost}</Text>
            </View>
            {props.vatApplicable ? (
              <View style={s.moneyRow}>
                <Text style={s.tiny}>{props.vatLabel}</Text>
                <Text style={s.value}>{props.vatAmount}</Text>
              </View>
            ) : null}
            <View style={[s.hr, { marginVertical: 7 }]} />
            <View style={s.moneyRow}>
              <Text style={s.value}>Total investment</Text>
              <Text style={s.totalValue}>{props.totalAmountPayable}</Text>
            </View>
            <AmountInWordsLine value={props.amountWords} />
          </View>

          {props.termsText ? (
            <View style={{ marginTop: 10 }}>
              <View style={s.sectionRule} />
              <Text style={s.label}>Terms</Text>
              <Text style={[s.tiny, { color: MID }]}>{props.termsText}</Text>
            </View>
          ) : null}

          <View style={s.accept}>
            <Text style={s.label}>Acceptance</Text>
            <Text style={s.tiny}>
              Signing below confirms acceptance of the scope and commercials set out above,
              and authorises the works to proceed.
            </Text>
            <View style={s.sigRow}>
              <View style={s.col}>
                <View style={s.sigLine} />
                <Text style={s.tiny}>{props.signatureClientLabel}</Text>
              </View>
              <View style={s.col}>
                <View style={s.sigLine} />
                <Text style={s.tiny}>{props.signatureCompanyLabel}</Text>
              </View>
            </View>
          </View>

          {props.footerText ? <Text style={s.footer}>{props.footerText}</Text> : null}
          <QuotationPromoStrip promo={props.promo} />
        </View>
      </Page>
    </Document>
  );
}
