/**
 * Statement of Account — house style.
 *
 * A ledger: every billed document on the account, what has been paid against
 * each, and what is still owed. The chrome comes from lib/pdf/house, so a
 * statement reads as the same company's paper as the invoices it summarises.
 */
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import {
  HouseDocHead, HouseLetterhead, HousePageFooter, HouseTopRule,
  DIVIDER, INK, MUTED, SP, companyLetterheadLines, house,
} from "@/lib/pdf/house";

const CRIT = "#B91C1C";

const s = StyleSheet.create({
  colDate: { width: 62 },
  colType: { width: 74 },
  colDoc:  { flex: 1, paddingRight: 10 },
  colAmt:  { width: 84, textAlign: "right" },

  totalsWrap: { marginTop: SP.sm, marginLeft: "auto", width: 250 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  totalLabel: { fontSize: 9, color: MUTED },
  totalValue: { fontSize: 9, textAlign: "right" },
  // One strong rule between the arithmetic and its result.
  grandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderTopWidth: 1, borderTopColor: INK, marginTop: 2, paddingTop: 7 },
  grandLabel: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  grandValue: { fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "right", letterSpacing: -0.3 },
  crit: { color: CRIT },

  footNote: { marginTop: SP.lg, borderTopWidth: 1, borderTopColor: DIVIDER, paddingTop: SP.sm },
  footNoteText: { fontSize: 7.5, color: MUTED, lineHeight: 1.45 },
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
    companyWebsite?: string | null;
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

export function StatementDocument({
  branding, statementNumber, issuedAt, periodLabel, client, lines, totals, isSettled,
}: Props) {
  const letterhead = companyLetterheadLines({
    companyAddress: [branding.companyAddressLine1, branding.companyAddressLine2].filter(Boolean).join("\n"),
    companyPhone: branding.companyContacts,
    companyEmail: branding.companyEmail,
    companyWebsite: branding.companyWebsite,
  });

  return (
    <Document title={`Statement of Account ${statementNumber}`}>
      <Page size="A4" style={house.page}>
        <HouseTopRule />
        <View style={house.headPad} />

        <View style={house.header}>
          <HouseLetterhead companyName={branding.companyName} companyLogoUrl={branding.companyLogoUrl} lines={letterhead} />
          <HouseDocHead
            docTitle="Statement"
            docNumber={statementNumber}
            cardLabel="Balance Due"
            cardValue={totals.outstanding}
          />
        </View>

        {/* Whose account, and over what period */}
        <View style={house.band} wrap={false}>
          <View style={house.bandLeft}>
            <Text style={house.label}>Statement For</Text>
            {/* The organisation is the account; the person is the contact on it. */}
            <Text style={house.partyName}>{client.organization || client.name}</Text>
            {client.organization ? <Text style={house.partyAttn}>Attn: {client.name}</Text> : null}
            {client.address ? <Text style={house.partyLine}>{client.address}</Text> : null}
            {client.phone ? <Text style={house.partyLine}>{client.phone}</Text> : null}
            {client.email ? <Text style={house.partyLine}>{client.email}</Text> : null}
          </View>
          <View style={house.bandRight}>
            <View style={house.metaRow}>
              <Text style={house.metaLabel}>Issued</Text>
              <Text style={house.metaValue}>{issuedAt}</Text>
            </View>
            <View style={house.metaRow}>
              <Text style={house.metaLabel}>Period</Text>
              <Text style={house.metaValue}>{periodLabel}</Text>
            </View>
            <View style={house.metaRow}>
              <Text style={house.metaLabel}>Documents</Text>
              <Text style={house.metaValue}>{String(lines.length)}</Text>
            </View>
          </View>
        </View>

        {/* The ledger */}
        <View style={{ marginBottom: SP.sm }}>
          {/* Repeats per page: a statement is the document most likely to run long. */}
          <View style={house.tableHead} fixed>
            <Text style={[house.th, s.colDate]}>Date</Text>
            <Text style={[house.th, s.colType]}>Type</Text>
            <Text style={[house.th, s.colDoc]}>Document</Text>
            <Text style={[house.th, s.colAmt]}>Billed</Text>
            <Text style={[house.th, s.colAmt]}>Paid</Text>
            <Text style={[house.th, s.colAmt]}>Balance</Text>
          </View>

          {lines.map((line, i) => (
            <View
              key={`${line.type}-${line.number}`}
              style={i % 2 === 1 ? [house.tableRow, house.tableRowAlt] : house.tableRow}
              wrap={false}
            >
              <Text style={[house.cellMuted, s.colDate]}>{line.date}</Text>
              <Text style={[house.cellMuted, s.colType]}>{line.type}</Text>
              <Text style={[house.cell, s.colDoc]}>{line.number}</Text>
              <Text style={[house.cell, s.colAmt]}>{line.billed}</Text>
              <Text style={[house.cellMuted, s.colAmt]}>{line.paid}</Text>
              <Text style={[house.cellStrong, s.colAmt]}>{line.balance}</Text>
            </View>
          ))}

          {lines.length === 0 ? (
            <View style={house.emptyRow}>
              <Text style={house.emptyText}>No invoices or sales on this account yet.</Text>
            </View>
          ) : null}
        </View>

        <View style={s.totalsWrap} wrap={false}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total billed</Text>
            <Text style={s.totalValue}>{totals.billed}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total paid</Text>
            <Text style={s.totalValue}>{totals.paid}</Text>
          </View>
          <View style={s.grandRow}>
            <Text style={s.grandLabel}>Balance Due</Text>
            <Text style={[s.grandValue, isSettled ? {} : s.crit]}>{totals.outstanding}</Text>
          </View>
        </View>

        {branding.footerText ? (
          <View style={s.footNote} wrap={false}>
            <Text style={s.footNoteText}>{branding.footerText}</Text>
          </View>
        ) : null}

        <HousePageFooter companyName={branding.companyName} docTitle="Statement" docNumber={statementNumber} />
      </Page>
    </Document>
  );
}
