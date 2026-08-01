/**
 * AssessmentReportDocument — branded "Hardware Assessment & Repair Report".
 * Matches the Eagle Info house report format: centered title, numbered sections,
 * gold-header tables (Repair Scope, Estimated Cost), warranty, prepared-by, and
 * a centered footer. Content is staff-entered and AI-expanded upstream.
 */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const INK = "#1a1a1a";
const MUTED = "#555555";
const GOLD = "#B08A3C";
const RULE = "#333333";
const LIGHT = "#E5E7EB";

const s = StyleSheet.create({
  page: { paddingHorizontal: 48, paddingVertical: 40, fontSize: 10, fontFamily: "Helvetica", color: INK, lineHeight: 1.5 },

  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  logo: { width: 54, height: 54, marginRight: 12, objectFit: "contain" },
  companyName: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#1f3a5f" },
  companyNameSuffix: { fontSize: 15, fontFamily: "Helvetica-Bold", color: INK },
  companyTagline: { fontSize: 8, fontFamily: "Helvetica-Oblique", color: MUTED, marginTop: 3 },
  companyAddress: { fontSize: 8, color: MUTED, marginTop: 1.5 },

  topRule: { borderTopWidth: 1.5, borderTopColor: GOLD, marginTop: 8, marginBottom: 12 },

  officialLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: GOLD, textAlign: "center", letterSpacing: 1, textTransform: "uppercase" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 4, letterSpacing: 0.5 },
  titleRule: { borderTopWidth: 1, borderTopColor: RULE, marginTop: 12, marginBottom: 12 },

  metaRow: { marginBottom: 4 },
  metaLabel: { fontFamily: "Helvetica-Bold" },

  sectionRuleTop: { borderTopWidth: 1, borderTopColor: RULE, marginTop: 10, marginBottom: 6 },
  sectionTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  para: { fontSize: 10, marginBottom: 5, textAlign: "justify" },
  subLabel: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginTop: 4, marginBottom: 3 },

  table: { borderWidth: 1, borderColor: LIGHT, marginTop: 2, marginBottom: 4 },
  tHead: { flexDirection: "row", backgroundColor: GOLD },
  tHeadCell: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#FFFFFF", paddingVertical: 5, paddingHorizontal: 8 },
  tRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LIGHT },
  tRowAlt: { backgroundColor: "#FAF7F0" },
  tCell: { fontSize: 9.5, paddingVertical: 5, paddingHorizontal: 8 },
  colL: { flex: 1, borderRightWidth: 1, borderRightColor: LIGHT },
  colR: { flex: 1 },

  totalLine: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 4 },
  totalValue: { color: GOLD },

  prepared: { marginTop: 16 },
  preparedLabel: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  preparedLine: { fontSize: 9, color: MUTED },

  footerRule: { borderTopWidth: 1, borderTopColor: RULE, marginTop: 22, marginBottom: 8 },
  footer: { fontSize: 8, color: MUTED, textAlign: "center" },
});

export type ScopeRow = { component: string; specification: string };
export type CostRow = { description: string; amount: string };

export type AssessmentReportProps = {
  companyName: string;
  companyNameSuffix?: string;
  companyTagline?: string;
  companyAddress?: string;
  companyLogoUrl?: string | null;

  jobNumber: string;
  deviceIssue: string;

  findings: string[]; // section 1 paragraphs
  recommendedSolution: string; // section 2 lead
  repairScope: ScopeRow[]; // section 2 table
  repairRecommendation?: string; // section 3
  costRows: CostRow[]; // section 4
  totalCostLabel: string; // e.g. "Total Replacement Cost:"
  totalCostValue: string;
  warranty: string[]; // section 5 paragraphs

  preparedByOrg: string;
  preparedByDept: string;
  dateText: string;
  footerText: string;
};

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <View wrap={false}>
      <View style={s.sectionRuleTop} />
      <Text style={s.sectionTitle}>{n}. {title}</Text>
      {children}
    </View>
  );
}

export function AssessmentReportDocument(p: AssessmentReportProps) {
  let n = 0;
  return (
    <Document title={`Assessment Report ${p.jobNumber}`}>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          {p.companyLogoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image style={s.logo} src={p.companyLogoUrl} />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text>
              <Text style={s.companyName}>{p.companyName}</Text>
              {p.companyNameSuffix ? <Text style={s.companyNameSuffix}>{"  "}{p.companyNameSuffix}</Text> : null}
            </Text>
            {p.companyTagline ? <Text style={s.companyTagline}>{p.companyTagline}</Text> : null}
            {p.companyAddress ? <Text style={s.companyAddress}>{p.companyAddress}</Text> : null}
          </View>
        </View>
        <View style={s.topRule} />

        {/* Title */}
        <Text style={s.officialLabel}>Official Document</Text>
        <Text style={s.title}>HARDWARE ASSESSMENT &amp; REPAIR REPORT</Text>
        <View style={s.titleRule} />

        {/* Meta */}
        <Text style={s.metaRow}><Text style={s.metaLabel}>Repair Job No: </Text>{p.jobNumber}</Text>
        <Text style={s.metaRow}><Text style={s.metaLabel}>Device Issue: </Text>{p.deviceIssue}</Text>

        {/* 1. Assessment findings */}
        <Section n={(n += 1)} title="ASSESSMENT FINDINGS">
          {p.findings.map((para, i) => <Text key={i} style={s.para}>{para}</Text>)}
        </Section>

        {/* 2. Recommended solution + scope */}
        <Section n={(n += 1)} title="RECOMMENDED SOLUTION">
          {p.recommendedSolution ? <Text style={s.para}>{p.recommendedSolution}</Text> : null}
          {p.repairScope.length > 0 ? (
            <>
              <Text style={s.subLabel}>Repair Scope</Text>
              <View style={s.table}>
                <View style={s.tHead}>
                  <Text style={[s.tHeadCell, s.colL]}>Component</Text>
                  <Text style={[s.tHeadCell, s.colR]}>Specification</Text>
                </View>
                {p.repairScope.map((r, i) => (
                  <View key={i} style={[s.tRow, ...(i % 2 ? [s.tRowAlt] : [])]}>
                    <Text style={[s.tCell, s.colL]}>{r.component}</Text>
                    <Text style={[s.tCell, s.colR]}>{r.specification}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </Section>

        {/* 3. Repair recommendation */}
        {p.repairRecommendation ? (
          <Section n={(n += 1)} title="REPAIR RECOMMENDATION">
            <Text style={s.para}>{p.repairRecommendation}</Text>
          </Section>
        ) : null}

        {/* 4. Estimated repair cost */}
        <Section n={(n += 1)} title="ESTIMATED REPAIR COST">
          <View style={s.table}>
            <View style={s.tHead}>
              <Text style={[s.tHeadCell, s.colL]}>Description</Text>
              <Text style={[s.tHeadCell, s.colR]}>Amount</Text>
            </View>
            {p.costRows.map((r, i) => (
              <View key={i} style={[s.tRow, ...(i % 2 ? [s.tRowAlt] : [])]}>
                <Text style={[s.tCell, s.colL]}>{r.description}</Text>
                <Text style={[s.tCell, s.colR]}>{r.amount}</Text>
              </View>
            ))}
          </View>
          <Text style={s.totalLine}>{p.totalCostLabel} <Text style={s.totalValue}>{p.totalCostValue}</Text></Text>
        </Section>

        {/* 5. Warranty & support */}
        {p.warranty.length > 0 ? (
          <Section n={(n += 1)} title="WARRANTY & SUPPORT">
            {p.warranty.map((para, i) => <Text key={i} style={s.para}>{para}</Text>)}
          </Section>
        ) : null}

        {/* Prepared by */}
        <View style={s.prepared}>
          <Text style={s.preparedLabel}>Prepared by:</Text>
          <Text style={s.preparedLine}>{p.preparedByOrg}</Text>
          <Text style={s.preparedLine}>{p.preparedByDept}</Text>
          <Text style={s.preparedLine}>Date: {p.dateText}</Text>
        </View>

        {/* Footer */}
        <View style={s.footerRule} />
        <Text style={s.footer}>{p.footerText}</Text>
      </Page>
    </Document>
  );
}
