/**
 * Hardware Assessment & Repair Report — house style.
 *
 * The one long-form document in the set: staff-entered findings expanded into
 * prose, with numbered sections a customer can cite back at us ("point 3 says
 * ..."). So it keeps the report structure -- numbered headings, running
 * paragraphs, a prepared-by block -- while taking its letterhead, tables and
 * page furniture from lib/pdf/house, the same as every other document.
 */
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import {
  HouseDocHead, HouseLetterhead, HousePageFooter, HouseTopRule,
  DIVIDER, INK, MUTED, SP, companyLetterheadLines, house,
} from "@/lib/pdf/house";

const s = StyleSheet.create({
  // Report body. Slightly larger than a transactional document because this one
  // is read through rather than scanned.
  section: { marginTop: SP.md },
  sectionHead: { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 5 },
  sectionNum: { fontSize: 9, fontFamily: "Helvetica-Bold", color: MUTED },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", letterSpacing: 0.2 },
  para: { fontSize: 9.5, lineHeight: 1.55, marginBottom: 5, textAlign: "justify" },
  subLabel: { fontSize: 8.5, fontFamily: "Helvetica-Bold", marginTop: 6, marginBottom: 4 },

  colL: { flex: 1, paddingRight: 10 },
  colR: { flex: 1 },

  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderTopWidth: 1, borderTopColor: INK, marginTop: 4, paddingTop: 7 },
  totalLabel: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  totalValue: { fontSize: 12, fontFamily: "Helvetica-Bold", letterSpacing: -0.3 },

  prepared: { marginTop: SP.lg, borderTopWidth: 1, borderTopColor: DIVIDER, paddingTop: SP.md },
  preparedLine: { fontSize: 8.5, color: MUTED, marginBottom: 1.5 },
  preparedName: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 2 },
});

export type ScopeRow = { component: string; specification: string };
export type CostRow = { description: string; amount: string };

export type AssessmentReportProps = {
  companyName: string;
  companyNameSuffix?: string;
  companyTagline?: string;
  companyAddress?: string;
  companyContacts?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyTaxId?: string | null;
  companyLogoUrl?: string | null;

  jobNumber: string;
  deviceIssue: string;
  preparedForName?: string;
  preparedForOrg?: string;

  findings: string[];            // section 1 paragraphs
  recommendedSolution: string;   // section 2 lead
  repairScope: ScopeRow[];       // section 2 table
  repairRecommendation?: string; // section 3
  costRows: CostRow[];           // section 4
  totalCostLabel: string;
  totalCostValue: string;
  warranty: string[];            // section 5 paragraphs

  preparedByOrg: string;
  preparedByDept: string;
  dateText: string;
  footerText: string;
};

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <View style={s.section} wrap={false}>
      <View style={s.sectionHead}>
        <Text style={s.sectionNum}>{n}.</Text>
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

/** Upstream compactText yields the literal "N/A" for an empty field, which is
 *  truthy and printed as the account name. Treat it as absent. */
const real = (v?: string | null) => {
  const t = (v ?? "").trim();
  return t && t !== "N/A" ? t : "";
};

export function AssessmentReportDocument(p: AssessmentReportProps) {
  let n = 0;
  const forOrg = real(p.preparedForOrg);
  const forName = real(p.preparedForName);
  const letterhead = companyLetterheadLines({
    companyAddress: p.companyAddress,
    companyPhone: p.companyContacts,
    companyEmail: p.companyEmail,
    companyWebsite: p.companyWebsite,
    companyTaxId: p.companyTaxId,
  });

  return (
    <Document title={`Assessment Report ${p.jobNumber}`}>
      <Page size="A4" style={house.page}>
        <HouseTopRule />
        <View style={house.headPad} />

        <View style={house.header}>
          <HouseLetterhead companyName={p.companyName} companyLogoUrl={p.companyLogoUrl} lines={letterhead} />
          <HouseDocHead
            docTitle="Assessment"
            docNumber={p.jobNumber}
            cardLabel={p.totalCostLabel.replace(/:\s*$/, "")}
            cardValue={p.totalCostValue}
          />
        </View>

        {/* Who it is for, and what it is about */}
        <View style={house.band} wrap={false}>
          <View style={house.bandLeft}>
            <Text style={house.label}>Prepared For</Text>
            {/* The organisation is the account; the person is the contact on it. */}
            <Text style={house.partyName}>{forOrg || forName || "—"}</Text>
            {forOrg && forName ? <Text style={house.partyAttn}>Attn: {forName}</Text> : null}
          </View>
          <View style={house.bandRight}>
            <View style={house.metaRow}>
              <Text style={house.metaLabel}>Repair Job</Text>
              <Text style={house.metaValue}>{p.jobNumber}</Text>
            </View>
            <View style={house.metaRow}>
              <Text style={house.metaLabel}>Date</Text>
              <Text style={house.metaValue}>{p.dateText}</Text>
            </View>
          </View>
        </View>

        <Text style={house.sectionLabel}>Device Issue</Text>
        <Text style={s.para}>{p.deviceIssue}</Text>

        <Section n={(n += 1)} title="Assessment Findings">
          {p.findings.map((para, i) => <Text key={i} style={s.para}>{para}</Text>)}
        </Section>

        <Section n={(n += 1)} title="Recommended Solution">
          {p.recommendedSolution ? <Text style={s.para}>{p.recommendedSolution}</Text> : null}
          {p.repairScope.length > 0 ? (
            <>
              <Text style={s.subLabel}>Repair Scope</Text>
              <View style={house.tableHead}>
                <Text style={[house.th, s.colL]}>Component</Text>
                <Text style={[house.th, s.colR]}>Specification</Text>
              </View>
              {p.repairScope.map((r, i) => (
                <View key={i} style={i % 2 === 1 ? [house.tableRow, house.tableRowAlt] : house.tableRow} wrap={false}>
                  <Text style={[house.cellStrong, s.colL]}>{r.component}</Text>
                  <Text style={[house.cell, s.colR]}>{r.specification}</Text>
                </View>
              ))}
            </>
          ) : null}
        </Section>

        {p.repairRecommendation ? (
          <Section n={(n += 1)} title="Repair Recommendation">
            <Text style={s.para}>{p.repairRecommendation}</Text>
          </Section>
        ) : null}

        <Section n={(n += 1)} title="Estimated Repair Cost">
          <View style={house.tableHead}>
            <Text style={[house.th, s.colL]}>Description</Text>
            <Text style={[house.th, s.colR, { textAlign: "right" }]}>Amount</Text>
          </View>
          {p.costRows.map((r, i) => (
            <View key={i} style={i % 2 === 1 ? [house.tableRow, house.tableRowAlt] : house.tableRow} wrap={false}>
              <Text style={[house.cell, s.colL]}>{r.description}</Text>
              <Text style={[house.cellStrong, s.colR, { textAlign: "right" }]}>{r.amount}</Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>{p.totalCostLabel.replace(/:\s*$/, "")}</Text>
            <Text style={s.totalValue}>{p.totalCostValue}</Text>
          </View>
        </Section>

        {p.warranty.length > 0 ? (
          <Section n={(n += 1)} title="Warranty & Support">
            {p.warranty.map((para, i) => <Text key={i} style={s.para}>{para}</Text>)}
          </Section>
        ) : null}

        <View style={s.prepared} wrap={false}>
          <Text style={house.sectionLabel}>Prepared By</Text>
          <Text style={s.preparedName}>{p.preparedByOrg}</Text>
          <Text style={s.preparedLine}>{p.preparedByDept}</Text>
          <Text style={s.preparedLine}>{p.dateText}</Text>
        </View>

        <HousePageFooter companyName={p.companyName} docTitle="Assessment" docNumber={p.jobNumber} />
      </Page>
    </Document>
  );
}
