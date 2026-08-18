/**
 * Statement of Account — Eagle Info house style.
 *
 * Deliberately shares the letterhead, type scale and rules of the quotation,
 * assessment and delivery-note documents, so a statement looks like the rest of
 * the shop's paperwork rather than a separate design.
 */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const INK     = "#0f172a";
const MUTED   = "#6B7280";
const DIVIDER = "#E5E7EB";
const WHITE   = "#FFFFFF";
const CRIT    = "#B91C1C";
const LABEL   = 7;

const s = StyleSheet.create({
  page: { paddingHorizontal: 40, paddingVertical: 36, fontSize: 9, fontFamily: "Helvetica", color: INK, backgroundColor: WHITE },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  headerLeft: { flex: 1, paddingRight: 24 },
  logo: { width: 72, height: 36, marginBottom: 6, objectFit: "contain" },
  companyName: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  companyLine: { fontSize: 8, color: MUTED, marginBottom: 1.5 },
  infoRow: { flexDirection: "row", gap: 4, marginBottom: 1.5 },
  infoLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", width: 38 },
  headerRight: { width: 190, alignItems: "flex-end" },
  docTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  docNumber: { fontSize: 8.5, color: MUTED, marginBottom: 8 },
  refBox: { borderWidth: 1, borderColor: DIVIDER, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 7, alignItems: "flex-end", width: "100%" },
  refLabel: { fontSize: LABEL, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  refValue: { fontSize: 13, fontFamily: "Helvetica-Bold" },

  hr: { borderTopWidth: 1, borderTopColor: DIVIDER, marginBottom: 16 },

  grid2: { flexDirection: "row", gap: 24, marginBottom: 16 },
  col: { flex: 1 },
  sectionLabel: { fontSize: LABEL, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: DIVIDER, paddingBottom: 4 },
  partyName: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  partyLine: { fontSize: 8.5, color: MUTED, marginBottom: 1.5 },
  fieldRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: DIVIDER, paddingVertical: 4.5 },
  fieldLabel: { width: 80, fontSize: 8.5, color: MUTED },
  fieldValue: { flex: 1, fontSize: 8.5, fontFamily: "Helvetica-Bold" },

  table: { marginBottom: 14 },
  tableHead: { flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: INK, paddingBottom: 4 },
  th: { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: DIVIDER, paddingVertical: 6 },
  td: { fontSize: 8.5 },
  colDate: { width: 62 },
  colType: { width: 48 },
  colDoc:  { flex: 1 },
  colNum:  { width: 74, textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  crit: { color: CRIT },

  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 18 },
  totals: { width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalLabel: { fontSize: 8.5, color: MUTED },
  totalValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  grandRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1.5, borderTopColor: INK, marginTop: 4, paddingTop: 7 },
  grandLabel: { fontSize: 9.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.4 },
  grandValue: { fontSize: 13, fontFamily: "Helvetica-Bold" },

  empty: { fontSize: 9, color: MUTED, paddingVertical: 18, textAlign: "center" },
  noteLabel: { fontSize: LABEL, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  noteText: { fontSize: 8.5, color: INK, lineHeight: 1.5, marginBottom: 10 },
  footerDivider: { borderTopWidth: 1, borderTopColor: DIVIDER, marginTop: 6, marginBottom: 10 },
  footerText: { fontSize: 7.5, color: MUTED, textAlign: "center" },
  pageNo: { position: "absolute", bottom: 22, left: 0, right: 0, textAlign: "center", fontSize: 7.5, color: MUTED },
});

export type StatementDocLine = {
  type: string;
  number: string;
  date: string;
  status: string;
  billed: string;
  paid: string;
  balance: string;
};

type Props = {
  branding: {
    companyName: string;
    companyAddressLine1: string;
    companyAddressLine2: string;
    companyContacts: string;
    companyEmail?: string | null;
    companyLogoUrl?: string | null;
    footerText?: string | null;
  };
  statementNumber: string;
  issuedAt: string;
  periodLabel: string;
  client: { name: string; organization?: string | null; phone?: string | null; email?: string | null; address?: string | null };
  lines: StatementDocLine[];
  totals: { billed: string; paid: string; outstanding: string };
  /** Drives the red balance styling — never infer this from the formatted string. */
  isSettled: boolean;
};

export function StatementDocument({ branding, statementNumber, issuedAt, periodLabel, client, lines, totals, isSettled }: Props) {
  const address = [branding.companyAddressLine1, branding.companyAddressLine2].filter(Boolean).join(", ");

  return (
    <Document title={`Statement of Account ${statementNumber}`}>
      <Page size="A4" style={s.page}>

        {/* Letterhead — same block as the quotation / delivery note */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            {branding.companyLogoUrl
              // eslint-disable-next-line jsx-a11y/alt-text
              ? <Image style={s.logo} src={branding.companyLogoUrl} />
              : null}
            <Text style={s.companyName}>{branding.companyName}</Text>
            {address ? <Text style={s.companyLine}>{address}</Text> : null}
            {branding.companyContacts ? (
              <View style={s.infoRow}><Text style={s.infoLabel}>PHONE:</Text><Text style={s.companyLine}>{branding.companyContacts}</Text></View>
            ) : null}
            {branding.companyEmail ? (
              <View style={s.infoRow}><Text style={s.infoLabel}>EMAIL:</Text><Text style={s.companyLine}>{branding.companyEmail}</Text></View>
            ) : null}
          </View>
          <View style={s.headerRight}>
            <Text style={s.docTitle}>Statement</Text>
            <Text style={s.docNumber}>#{statementNumber}</Text>
            <View style={s.refBox}>
              <Text style={s.refLabel}>Balance Due</Text>
              <Text style={s.refValue}>{totals.outstanding}</Text>
            </View>
          </View>
        </View>

        <View style={s.hr} />

        {/* Account holder + statement meta */}
        <View style={s.grid2}>
          <View style={s.col}>
            <Text style={s.sectionLabel}>Statement For</Text>
            <Text style={s.partyName}>{client.organization || client.name}</Text>
            {client.organization ? <Text style={s.partyLine}>{client.name}</Text> : null}
            {client.address ? <Text style={s.partyLine}>{client.address}</Text> : null}
            {client.phone ? <Text style={s.partyLine}>{client.phone}</Text> : null}
            {client.email ? <Text style={s.partyLine}>{client.email}</Text> : null}
          </View>
          <View style={s.col}>
            <Text style={s.sectionLabel}>Statement Details</Text>
            <View style={s.fieldRow}><Text style={s.fieldLabel}>Issued</Text><Text style={s.fieldValue}>{issuedAt}</Text></View>
            <View style={s.fieldRow}><Text style={s.fieldLabel}>Period</Text><Text style={s.fieldValue}>{periodLabel}</Text></View>
            <View style={s.fieldRow}><Text style={s.fieldLabel}>Documents</Text><Text style={s.fieldValue}>{String(lines.length)}</Text></View>
          </View>
        </View>

        {/* Document history */}
        <View style={s.table}>
          <View style={s.tableHead}>
            <Text style={[s.th, s.colDate]}>Date</Text>
            <Text style={[s.th, s.colType]}>Type</Text>
            <Text style={[s.th, s.colDoc]}>Document</Text>
            <Text style={[s.th, s.colNum]}>Billed</Text>
            <Text style={[s.th, s.colNum]}>Paid</Text>
            <Text style={[s.th, s.colNum]}>Balance</Text>
          </View>

          {lines.length === 0 ? (
            <Text style={s.empty}>No invoices or sales on this account yet.</Text>
          ) : (
            lines.map((line) => (
              <View key={`${line.type}-${line.number}`} style={s.tableRow} wrap={false}>
                <Text style={[s.td, s.colDate]}>{line.date}</Text>
                <Text style={[s.td, s.colType]}>{line.type}</Text>
                <Text style={[s.td, s.colDoc]}>{line.number}</Text>
                <Text style={[s.td, s.colNum]}>{line.billed}</Text>
                <Text style={[s.td, s.colNum]}>{line.paid}</Text>
                <Text style={[s.td, s.colNum, s.bold]}>{line.balance}</Text>
              </View>
            ))
          )}
        </View>

        {/* Totals */}
        <View style={s.totalsWrap}>
          <View style={s.totals}>
            <View style={s.totalRow}><Text style={s.totalLabel}>Total billed</Text><Text style={s.totalValue}>{totals.billed}</Text></View>
            <View style={s.totalRow}><Text style={s.totalLabel}>Total paid</Text><Text style={s.totalValue}>{totals.paid}</Text></View>
            <View style={s.grandRow}>
              <Text style={s.grandLabel}>Balance Due</Text>
              <Text style={[s.grandValue, isSettled ? {} : s.crit]}>{totals.outstanding}</Text>
            </View>
          </View>
        </View>

        <View style={s.footerDivider} />
        {branding.footerText ? <Text style={s.footerText}>{branding.footerText}</Text> : null}
        <Text
          style={s.pageNo}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
