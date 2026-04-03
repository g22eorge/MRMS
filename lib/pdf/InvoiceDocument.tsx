import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 8.6,
    color: "#0f172a",
    backgroundColor: "#f4f7fb",
  },
  topAccent: {
    height: 5,
    backgroundColor: "#0f766e",
    borderRadius: 8,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  leftHeader: {
    width: "52%",
  },
  logo: {
    width: 126,
    marginBottom: 5,
  },
  companyName: {
    fontSize: 11.4,
    fontWeight: 700,
    marginBottom: 2,
  },
  companyLine: {
    fontSize: 8,
    color: "#1f2937",
    marginBottom: 1,
  },
  rightHeader: {
    width: "46%",
    alignItems: "flex-end",
    marginTop: 18,
  },
  heading: {
    fontSize: 11.2,
    fontWeight: 700,
    marginBottom: 2,
    textAlign: "right",
  },
  headingBlock: {
    width: "100%",
    marginBottom: 6,
  },
  headerInfoBlock: {
    width: "100%",
  },
  infoRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
    borderBottom: "1 solid #cfd8e3",
    paddingBottom: 1,
  },
  infoRowGroupGap: {
    marginTop: 4,
  },
  infoLabel: {
    fontSize: 8,
    fontWeight: 600,
    textAlign: "left",
  },
  infoValue: {
    fontSize: 8,
    fontWeight: 700,
    textAlign: "right",
  },
  section: {
    marginBottom: 7,
    padding: 7,
    border: "1 solid #d6e0eb",
    borderTop: "2 solid #a7c8e7",
    borderRadius: 6,
    backgroundColor: "#ffffff",
    boxShadow: "0 1 0 #e7eef6",
  },
  sectionTitle: {
    fontSize: 8.6,
    fontWeight: 700,
    marginBottom: 6,
    color: "#0f766e",
    letterSpacing: 0.45,
    textTransform: "uppercase",
  },
  grid: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  colHalf: {
    width: "49%",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 3,
    gap: 8,
  },
  label: {
    width: "34%",
    color: "#475569",
  },
  value: {
    width: "64%",
    fontWeight: 600,
    flexShrink: 1,
  },
  longField: {
    marginBottom: 4,
  },
  longLabel: {
    fontSize: 8,
    color: "#475569",
    marginBottom: 1,
  },
  longValue: {
    fontSize: 8.4,
    fontWeight: 600,
    color: "#0f172a",
  },
  summaryStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottom: "1 solid #dbe5f0",
  },
  summaryItem: {
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "#eef4fb",
    border: "1 solid #d6e1ee",
  },
  summaryLabel: {
    fontSize: 7,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  summaryValue: {
    fontSize: 8.3,
    fontWeight: 700,
    color: "#0f172a",
  },
  bulletList: {
    marginTop: 1,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 2,
    gap: 4,
  },
  bulletMark: {
    width: 8,
    fontSize: 8.2,
    color: "#334155",
  },
  bulletText: {
    flex: 1,
    fontSize: 8.4,
    fontWeight: 600,
    color: "#0f172a",
  },
  total: {
    marginTop: 4,
    paddingTop: 4,
    borderTop: "1 solid #cbd5e1",
    fontSize: 9,
    fontWeight: 700,
  },
  costWrap: {
    marginTop: 2,
    marginLeft: "auto",
    width: "60%",
    padding: 5,
    border: "1 solid #d8e3ef",
    borderRadius: 5,
    backgroundColor: "#f8fbff",
  },
  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  costLabel: {
    fontSize: 8.2,
    color: "#334155",
  },
  costValue: {
    fontSize: 8.4,
    fontWeight: 600,
    textAlign: "right",
  },
  costDivider: {
    borderTop: "1 solid #aabacf",
    marginTop: 2,
    marginBottom: 3,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 1,
  },
  totalLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: "#0f172a",
  },
  totalValue: {
    fontSize: 10,
    fontWeight: 700,
    color: "#0f3b7a",
    textAlign: "right",
  },
  termsItem: {
    marginBottom: 3,
    color: "#334155",
  },
  signaturesWrap: {
    marginTop: 2,
    marginBottom: 4,
    padding: 7,
    border: "1 solid #d6e0eb",
    borderTop: "2 solid #a7c8e7",
    borderRadius: 6,
    backgroundColor: "#ffffff",
  },
  signaturesRow: {
    flexDirection: "row",
    gap: 10,
  },
  signatureCol: {
    width: "50%",
  },
  signatureLine: {
    borderBottom: "1 solid #94a3b8",
    marginTop: 16,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: "#475569",
  },
  signatureValue: {
    fontSize: 9,
    fontWeight: 700,
    color: "#0f172a",
  },
  footer: {
    marginTop: 4,
    fontSize: 7.6,
    color: "#5b6b81",
    textAlign: "center",
  },
});

type InvoiceDocProps = {
  companyName: string;
  companyTagline?: string;
  companyAddressLine1: string;
  companyAddressLine2: string;
  companyContacts: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyLogoUrl?: string;
  documentTitle: string;
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
  estimatedDuration: string;
  approvalStatus: string;
  recommendation: string;
  notes: string;
  status: string;
  currency: string;
  termsText: string;
  footerText: string;
  signatureCompanyLabel: string;
  signatureClientLabel: string;
};

function toBulletLines(value: string) {
  const lines = value
    .split(/\n|\||;/g)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (lines.length === 0) return ["N/A"];
  return lines;
}

function BulletField({ value }: { value: string }) {
  const lines = toBulletLines(value);
  return (
    <View style={styles.bulletList}>
      {lines.map((line, index) => (
        <View style={styles.bulletItem} key={`${line}-${index}`}>
          <Text style={styles.bulletMark}>-</Text>
          <Text style={styles.bulletText}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

export function InvoiceDocument(props: InvoiceDocProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topAccent} />

        <View style={styles.topRow}>
          <View style={styles.leftHeader}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {props.companyLogoUrl ? <Image style={styles.logo} src={props.companyLogoUrl} /> : null}
            <Text style={styles.companyName}>{props.companyName}</Text>
            {props.companyTagline ? <Text style={styles.companyLine}>{props.companyTagline}</Text> : null}
            <Text style={styles.companyLine}>{props.companyAddressLine1}</Text>
            <Text style={styles.companyLine}>{props.companyAddressLine2}</Text>
            <Text style={styles.companyLine}>{props.companyContacts}</Text>
            {props.companyEmail ? <Text style={styles.companyLine}>{props.companyEmail}</Text> : null}
            {props.companyWebsite ? <Text style={styles.companyLine}>{props.companyWebsite}</Text> : null}
          </View>

          <View style={styles.rightHeader}>
            <View style={styles.headingBlock}>
              <Text style={styles.heading}>{props.documentTitle}</Text>
            </View>
            <View style={styles.headerInfoBlock}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Est No:</Text>
                <Text style={styles.infoValue}>{props.quotationNumber}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Balance Due:</Text>
                <Text style={styles.infoValue}>{props.totalAmountPayable}</Text>
              </View>
              <View style={[styles.infoRow, styles.infoRowGroupGap]}>
                <Text style={styles.infoLabel}>Est Date:</Text>
                <Text style={styles.infoValue}>{props.dateIssued}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Valid Until:</Text>
                <Text style={styles.infoValue}>{props.validUntil}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.colHalf}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Client & Job</Text>
              <View style={styles.row}><Text style={styles.label}>Repair ID</Text><Text style={styles.value}>{props.repairId}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Prepared By</Text><Text style={styles.value}>{props.preparedByName}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Role</Text><Text style={styles.value}>{props.preparedByRole}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Client</Text><Text style={styles.value}>{props.clientName}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Phone</Text><Text style={styles.value}>{props.clientPhone}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Email</Text><Text style={styles.value}>{props.clientEmail}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Org</Text><Text style={styles.value}>{props.clientOrganization}</Text></View>
            </View>
          </View>

          <View style={styles.colHalf}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Device</Text>
              <View style={styles.row}><Text style={styles.label}>Type</Text><Text style={styles.value}>{props.deviceType}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Model</Text><Text style={styles.value}>{props.deviceLabel}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Serial/IMEI</Text><Text style={styles.value}>{props.serialOrImei}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Accessories</Text><Text style={styles.value}>{props.accessories}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Condition</Text><Text style={styles.value}>{props.physicalCondition}</Text></View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diagnosis & Work</Text>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Duration</Text>
              <Text style={styles.summaryValue}>{props.estimatedDuration}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Approval</Text>
              <Text style={styles.summaryValue}>{props.approvalStatus}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Status</Text>
              <Text style={styles.summaryValue}>{props.status}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Recommendation</Text>
              <Text style={styles.summaryValue}>{props.recommendation}</Text>
            </View>
          </View>

          <View style={styles.longField}>
            <Text style={styles.longLabel}>Issue</Text>
            <BulletField value={props.customerIssue} />
          </View>
          <View style={styles.longField}>
            <Text style={styles.longLabel}>Diagnosis</Text>
            <BulletField value={props.diagnosisSummary} />
          </View>
          <View style={styles.longField}>
            <Text style={styles.longLabel}>Scope</Text>
            <BulletField value={props.scopeOfWork} />
          </View>
          <View style={styles.longField}>
            <Text style={styles.longLabel}>Notes</Text>
            <BulletField value={props.notes} />
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Cost Breakdown</Text>
          <View style={styles.costWrap}>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Repair Cost</Text>
              <Text style={styles.costValue}>{props.repairCost}</Text>
            </View>
            {props.vatApplicable ? (
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>{props.vatLabel}</Text>
                <Text style={styles.costValue}>{props.vatAmount}</Text>
              </View>
            ) : null}
            <View style={styles.costDivider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount Payable</Text>
              <Text style={styles.totalValue}>{props.totalAmountPayable}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Terms & Conditions</Text>
          {props.termsText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => (
              <Text key={line} style={styles.termsItem}>- {line}</Text>
            ))}
        </View>

        <View style={styles.signaturesWrap}>
          <Text style={styles.sectionTitle}>Sign-off</Text>
          <View style={styles.signaturesRow}>
            <View style={styles.signatureCol}>
              <Text style={styles.signatureValue}>{props.signatureCompanyLabel}</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Authorized company signature</Text>
            </View>
            <View style={styles.signatureCol}>
              <Text style={styles.signatureValue}>{props.signatureClientLabel}</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Client signature & date</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>{props.footerText}</Text>
      </Page>
    </Document>
  );
}
