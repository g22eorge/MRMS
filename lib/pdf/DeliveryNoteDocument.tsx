/**
 * Delivery Note — house style.
 *
 * A handover record, so the page is built around three questions: what was
 * handed over, to whom, and who signed for it. The chrome comes from
 * lib/pdf/house so this sits beside an invoice as the same company's paper.
 */
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import {
  HouseDocHead, HouseLetterhead, HousePageFooter, HouseTopRule,
  INK, MUTED, SP, companyLetterheadLines, house,
} from "@/lib/pdf/house";

const s = StyleSheet.create({
  colNum:  { width: 22 },
  colDesc: { flex: 1, paddingRight: 10 },
  colQty:  { width: 60, textAlign: "right" },

  noteBlock: { marginBottom: SP.md },
  noteText: { fontSize: 8.5, color: INK, lineHeight: 1.45 },

  // Signatures. The rule sits under an empty run of space rather than under the
  // typed name, because someone has to sign on it in ink.
  sigWrap: { marginTop: SP.lg, borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: SP.md },
  sigRow: { flexDirection: "row", gap: SP.xl },
  sigCol: { flex: 1 },
  sigName: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  sigLine: { borderBottomWidth: 1, borderBottomColor: INK, marginTop: 30, marginBottom: 5 },
  sigLabel: { fontSize: 7.5, color: MUTED },
});

type DeliveryItem = { description: string; quantity: number };

type Props = {
  branding: {
    companyName: string;
    companyTagline?: string | null;
    companyAddressLine1: string;
    companyAddressLine2: string;
    companyContacts: string;
    companyEmail?: string | null;
    companyWebsite?: string | null;
    companyLogoUrl?: string | null;
  };
  deliveryNoteNumber: string;
  deliveredAt: string;
  saleRef: string;
  clientName: string;
  deliveredByName: string;
  receivedByName: string;
  receivedBySignatureText?: string | null;
  deliveryMethod?: string | null;
  note?: string | null;
  items: DeliveryItem[];
};

export function DeliveryNoteDocument({
  branding, deliveryNoteNumber, deliveredAt, saleRef, clientName,
  deliveredByName, receivedByName, receivedBySignatureText, deliveryMethod, note, items,
}: Props) {
  const lines = companyLetterheadLines({
    companyAddress: [branding.companyAddressLine1, branding.companyAddressLine2].filter(Boolean).join("\n"),
    companyPhone: branding.companyContacts,
    companyEmail: branding.companyEmail,
    companyWebsite: branding.companyWebsite,
  });

  return (
    <Document title={`Delivery Note ${deliveryNoteNumber}`}>
      <Page size="A4" style={house.page}>
        <HouseTopRule />
        <View style={house.headPad} />

        <View style={house.header}>
          <HouseLetterhead companyName={branding.companyName} companyLogoUrl={branding.companyLogoUrl} lines={lines} />
          <HouseDocHead
            docTitle="Delivery Note"
            docNumber={deliveryNoteNumber}
            cardLabel="Reference"
            cardValue={saleRef}
            cardIsText
          />
        </View>

        {/* Who received it, and who released it */}
        <View style={house.band} wrap={false}>
          <View style={house.bandCol}>
            <Text style={house.label}>Delivered To</Text>
            <Text style={house.partyName}>{clientName}</Text>
            <Text style={house.partyLine}>{deliveredAt}</Text>
            {deliveryMethod ? <Text style={house.partyLine}>{deliveryMethod}</Text> : null}
          </View>
          <View style={house.bandColDivided}>
            <Text style={house.label}>Dispatch</Text>
            <View style={house.metaRow}>
              <Text style={house.metaLabel}>Dispatched by</Text>
              <Text style={house.metaValue}>{deliveredByName}</Text>
            </View>
            <View style={house.metaRow}>
              <Text style={house.metaLabel}>Received by</Text>
              <Text style={house.metaValue}>{receivedByName}</Text>
            </View>
          </View>
        </View>

        {/* What was handed over */}
        <View style={{ marginBottom: SP.md }}>
          <View style={house.tableHead} fixed>
            <Text style={[house.th, s.colNum]}>#</Text>
            <Text style={[house.th, s.colDesc]}>Description</Text>
            <Text style={[house.th, s.colQty]}>Qty</Text>
          </View>
          {items.map((it, i) => (
            <View key={i} style={i % 2 === 1 ? [house.tableRow, house.tableRowAlt] : house.tableRow} wrap={false}>
              <Text style={[house.cellMuted, s.colNum]}>{i + 1}</Text>
              <Text style={[house.cell, s.colDesc]}>{it.description}</Text>
              <Text style={[house.cellStrong, s.colQty]}>{String(it.quantity)}</Text>
            </View>
          ))}
          {items.length === 0 ? (
            <View style={house.emptyRow}>
              <Text style={house.emptyText}>No items listed on this delivery.</Text>
            </View>
          ) : null}
        </View>

        {note ? (
          <View style={s.noteBlock}>
            <Text style={house.sectionLabel}>Notes</Text>
            <Text style={s.noteText}>{note}</Text>
          </View>
        ) : null}

        {/* Signatures stay whole; a rule stranded on its own page signs nothing. */}
        <View style={s.sigWrap} wrap={false}>
          <View style={s.sigRow}>
            <View style={s.sigCol}>
              <Text style={s.sigName}>{deliveredByName}</Text>
              <View style={s.sigLine} />
              <Text style={s.sigLabel}>Dispatched by</Text>
            </View>
            <View style={s.sigCol}>
              <Text style={s.sigName}>{receivedByName}</Text>
              <View style={s.sigLine} />
              <Text style={s.sigLabel}>
                {receivedBySignatureText || "Client signature (confirmation of receipt)"}
              </Text>
            </View>
          </View>
        </View>

        <HousePageFooter companyName={branding.companyName} docTitle="Delivery Note" docNumber={deliveryNoteNumber} />
      </Page>
    </Document>
  );
}
