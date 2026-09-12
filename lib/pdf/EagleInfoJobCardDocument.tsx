/**
 * Job Card — house style.
 *
 * The workshop's intake record, and the one document a customer signs before
 * anything is opened up. So it has to be legible at a counter and unambiguous
 * afterwards: what came in, what was on it, what the customer said was wrong,
 * and what we found. The chrome comes from lib/pdf/house.
 */
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import {
  HouseDocHead, HouseLetterhead, HousePageFooter, HouseTopRule,
  DIVIDER, INK, MUTED, PANEL, SP, companyLetterheadLines, house,
} from "@/lib/pdf/house";

const s = StyleSheet.create({
  grid2: { flexDirection: "row", gap: SP.lg, marginBottom: SP.md },
  col: { flex: 1 },
  section: { marginBottom: SP.md },

  // Label/value rows. Hairline under each so a handwritten correction has a
  // line to sit on, which is how these get used in practice.
  fieldRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: DIVIDER, paddingVertical: 5 },
  fieldLabel: { width: 78, fontSize: 8.5, color: MUTED },
  fieldValue: { flex: 1, fontSize: 8.5, fontFamily: "Helvetica-Bold" },

  // Accessories. A ticked box has to read as ticked from across a counter, so
  // it is a filled square with a clear border rather than a tint.
  checkGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 2 },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 5, width: "33%", marginBottom: 6 },
  checkBox: { width: 9, height: 9, borderWidth: 1, borderColor: "#94A3B8", borderRadius: 1.5 },
  checkBoxOn: { backgroundColor: INK, borderColor: INK },
  checkLabel: { fontSize: 8, color: MUTED },
  checkLabelOn: { fontSize: 8, color: INK, fontFamily: "Helvetica-Bold" },

  // Free-text areas keep a panel so the block is obviously a written statement
  // rather than a field we filled in.
  contentBox: { backgroundColor: PANEL, borderRadius: 3, padding: 10, minHeight: 42 },
  contentText: { fontSize: 8.5, lineHeight: 1.5 },

  sigWrap: { marginTop: SP.lg, borderTopWidth: 1, borderTopColor: DIVIDER, paddingTop: SP.md },
  sigRow: { flexDirection: "row", gap: SP.xl },
  sigCol: { flex: 1 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: INK, marginTop: 30, marginBottom: 5 },
  sigLabel: { fontSize: 7.5, color: MUTED },

  noteText: { fontSize: 8, color: MUTED, lineHeight: 1.45 },
});

type Props = {
  companyName: string;
  companyTagline?: string;
  companyAddressLine1: string;
  companyAddressLine2: string;
  companyContacts: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyLogoUrl?: string;
  documentNumber: string;
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
  accessories: string;
  physicalCondition: string;
  customerIssue: string;
  diagnosisSummary: string;
  partsNeeded: string;
  technicianNotes: string;
  status: string;
  footerText: string;
  signatureCompanyLabel: string;
  signatureClientLabel: string;
  statusQrDataUrl?: string;
};

const DEVICE_CHECKLIST = [
  "Power cable", "Back cover", "Battery", "SIM card", "Memory card",
  "Charger", "Earphones", "Screen protector", "Case / Cover",
];

const has = (v?: string | null) => Boolean(v && v !== "N/A" && v.trim());
const orDash = (v?: string | null) => (has(v) ? (v as string) : "—");

export function EagleInfoJobCardDocument(props: Props) {
  const letterhead = companyLetterheadLines({
    companyAddress: [props.companyAddressLine1, props.companyAddressLine2].filter(Boolean).join("\n"),
    companyPhone: props.companyContacts,
    companyEmail: props.companyEmail,
    companyWebsite: props.companyWebsite,
  });

  const accList = (has(props.accessories) ? props.accessories : "")
    .split(/,|;|\n/).map((x) => x.trim()).filter(Boolean);

  const diagnosis = [
    has(props.diagnosisSummary) ? props.diagnosisSummary : "",
    has(props.partsNeeded) ? `Parts: ${props.partsNeeded}` : "",
  ].filter(Boolean).join("\n") || "—";

  return (
    <Document title={`Job Card ${props.documentNumber}`}>
      <Page size="A4" style={house.page}>
        <HouseTopRule />
        <View style={house.headPad} />

        <View style={house.header}>
          <HouseLetterhead companyName={props.companyName} companyLogoUrl={props.companyLogoUrl} lines={letterhead} />
          <HouseDocHead
            docTitle="Job Card"
            docNumber={props.documentNumber}
            cardLabel="Status"
            cardValue={props.status}
            cardIsText
          />
        </View>

        {/* Whose device, and when it came in */}
        <View style={house.band} wrap={false}>
          <View style={house.bandLeft}>
            <Text style={house.label}>Client</Text>
            {/* The organisation is the account; the person is the contact on it. */}
            <Text style={house.partyName}>{props.clientOrganization || props.clientName}</Text>
            {props.clientOrganization ? <Text style={house.partyAttn}>Attn: {props.clientName}</Text> : null}
            {has(props.clientPhone) ? <Text style={house.partyLine}>{props.clientPhone}</Text> : null}
            {has(props.clientEmail) ? <Text style={house.partyLine}>{props.clientEmail}</Text> : null}
          </View>
          <View style={house.bandRight}>
            <View style={house.metaRow}>
              <Text style={house.metaLabel}>Received</Text>
              <Text style={house.metaValue}>{props.dateIssued}</Text>
            </View>
            <View style={house.metaRow}>
              <Text style={house.metaLabel}>Repair ID</Text>
              <Text style={house.metaValue}>{props.repairId}</Text>
            </View>
            <View style={house.metaRow}>
              <Text style={house.metaLabel}>Received by</Text>
              <Text style={house.metaValue}>{props.preparedByName}</Text>
            </View>
          </View>
        </View>

        {/* What came in */}
        <View style={s.grid2}>
          <View style={s.col}>
            <Text style={house.sectionLabel}>Device</Text>
            {[
              { label: "Type", value: orDash(props.deviceType) },
              { label: "Brand / Model", value: orDash(props.deviceLabel) },
              { label: "Serial / IMEI", value: orDash(props.serialOrImei) },
              { label: "Condition", value: orDash(props.physicalCondition) },
            ].map((r, i) => (
              <View key={i} style={s.fieldRow}>
                <Text style={s.fieldLabel}>{r.label}</Text>
                <Text style={s.fieldValue}>{r.value}</Text>
              </View>
            ))}
          </View>
          <View style={s.col}>
            <Text style={house.sectionLabel}>Accessories Received</Text>
            <View style={s.checkGrid}>
              {DEVICE_CHECKLIST.map((item) => {
                const checked = accList.some((a) => a.toLowerCase().includes(item.toLowerCase()));
                return (
                  <View key={item} style={s.checkItem}>
                    <View style={checked ? [s.checkBox, s.checkBoxOn] : s.checkBox} />
                    <Text style={checked ? s.checkLabelOn : s.checkLabel}>{item}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* What is wrong with it, said twice: by the customer, then by us */}
        <View style={s.grid2}>
          <View style={s.col}>
            <Text style={house.sectionLabel}>Reported by Customer</Text>
            <View style={s.contentBox}>
              <Text style={s.contentText}>{orDash(props.customerIssue)}</Text>
            </View>
          </View>
          <View style={s.col}>
            <Text style={house.sectionLabel}>Diagnosis / Parts Needed</Text>
            <View style={s.contentBox}>
              <Text style={s.contentText}>{diagnosis}</Text>
            </View>
          </View>
        </View>

        {has(props.technicianNotes) ? (
          <View style={s.section} wrap={false}>
            <Text style={house.sectionLabel}>Technician Notes</Text>
            <View style={s.contentBox}>
              <Text style={s.contentText}>{props.technicianNotes}</Text>
            </View>
          </View>
        ) : null}

        {/* Signatures stay whole; a rule stranded on its own page signs nothing. */}
        <View style={s.sigWrap} wrap={false}>
          {props.footerText ? <Text style={s.noteText}>{props.footerText}</Text> : null}
          <View style={s.sigRow}>
            <View style={s.sigCol}>
              <View style={s.sigLine} />
              <Text style={s.sigLabel}>{props.signatureCompanyLabel || "Authorised Signatory"}</Text>
            </View>
            <View style={s.sigCol}>
              <View style={s.sigLine} />
              <Text style={s.sigLabel}>{props.signatureClientLabel || "Client Signature"}</Text>
            </View>
          </View>
        </View>

        <HousePageFooter companyName={props.companyName} docTitle="Job Card" docNumber={props.documentNumber} />
      </Page>
    </Document>
  );
}
