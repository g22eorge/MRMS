/**
 * EagleInfoDocument — Default document template matching Eagle Info's house style.
 *
 * Layout (matches Quote_EISL-000014.pdf):
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  [Logo]  Company Name            Estimate / Invoice  │
 *   │  Address · Phone · Email         #EISL-000014        │
 *   │                                  BALANCE DUE         │
 *   │                                  UGX 21,800,000      │
 *   ├──────────────────────────────────────────────────────────┤
 *   │  TO                     Quote Date:  May 29, 2026    │
 *   │  AVSI Foundation        Terms:       30 Days         │
 *   │  email · location       Due Date:    -               │
 *   ├──────────────────────────────────────────────────────────┤
 *   │  #  ITEM & DESCRIPTION      QTY      RATE     AMOUNT │
 *   │  1  Adobe CC 2025                    …        …      │
 *   │     SKU: EIS008SXX001                                 │
 *   │                              Sub Total  UGX …        │
 *   │                              Total      UGX …        │
 *   │                              Paid       UGX …        │
 *   │                              Balance    UGX …        │
 *   ├──────────────────────────────────────────────────────────┤
 *   │  NOTES                   TERMS & CONDITIONS           │
 *   │  note text               terms text                  │
 *   │  PAYMENT TO                                           │
 *   │  bank details                                         │
 *   └──────────────────────────────────────────────────────────┘
 */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// ── Palette ────────────────────────────────────────────────────────────────────
const INK      = "#0f172a";   // near-black body text
const MUTED    = "#6B7280";   // grey labels
const DIVIDER  = "#E5E7EB";   // thin rule
const WHITE    = "#FFFFFF";
const NAVY     = "#1e293b";   // filled line-item header bar (matches official)
const SHADE    = "#F3F4F6";   // shaded balance-due row
const LABEL_SZ = 7;           // caps section-label font size

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    paddingHorizontal: 40,
    paddingVertical: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: INK,
    backgroundColor: WHITE,
  },

  // Full-bleed accent bar (pulled to the page edges past the 40/36 padding).
  topRule: { height: 5, marginHorizontal: -40, marginTop: -36, marginBottom: 24 },

  // ── Header ──
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  headerLeft: { flex: 1, paddingRight: 24 },
  logo: { width: 150, height: 60, marginBottom: 8, objectFit: "contain" },
  companyName: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  companyLine: { fontSize: 8, color: MUTED, marginBottom: 1.5 },
  phoneEmailRow: { flexDirection: "row", gap: 4, marginBottom: 1.5 },
  companyLineLabel: { fontSize: 8, color: INK, fontFamily: "Helvetica-Bold", width: 38 },

  headerRight: { width: 180, alignItems: "flex-end" },
  docTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  docNumber: { fontSize: 8.5, color: MUTED, marginBottom: 8 },
  balanceBox: { borderWidth: 1, borderColor: DIVIDER, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 7, alignItems: "flex-end", width: "100%" },
  balanceLabel: { fontSize: LABEL_SZ, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  balanceAmount: { fontSize: 15, fontFamily: "Helvetica-Bold" },

  // ── Divider ──
  hr: { borderTopWidth: 1, borderTopColor: DIVIDER, marginBottom: 14 },

  // ── Client / dates row ──
  toDateRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  toBlock: { flex: 1 },
  toLabel: { fontSize: LABEL_SZ, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5 },
  toName: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  toLine: { fontSize: 8.5, color: MUTED, marginBottom: 1.5 },
  datesBlock: { width: 200 },
  dateRow: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: DIVIDER, paddingVertical: 4 },
  dateLabel: { fontSize: 8.5, color: MUTED },
  dateValue: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },

  // ── Line-items table ──
  table: { marginBottom: 6 },
  tableHead: { flexDirection: "row", backgroundColor: NAVY, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 2 },
  th: { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.4, color: WHITE },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: DIVIDER, paddingVertical: 7, paddingHorizontal: 8 },
  colNum:   { width: 24 },
  colDesc:  { flex: 1, paddingRight: 6 },
  colQty:   { width: 44, textAlign: "center" },
  colRate:  { width: 88, textAlign: "right" },
  colAmt:   { width: 96, textAlign: "right" },
  itemName: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  itemSku:  { fontSize: 7.5, color: MUTED },

  // ── Totals ──
  totalsWrap: { marginTop: 6, marginLeft: "auto", width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: DIVIDER },
  totalLabel: { fontSize: 9, color: MUTED },
  totalValue: { fontSize: 9, textAlign: "right" },
  totalRowBold: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  totalLabelBold: { fontSize: 9.5, fontFamily: "Helvetica-Bold" },
  totalValueBold: { fontSize: 9.5, fontFamily: "Helvetica-Bold", textAlign: "right" },
  balanceDueRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, paddingHorizontal: 8, backgroundColor: SHADE, marginTop: 2 },

  // ── Footer ──
  footerDivider: { borderTopWidth: 1, borderTopColor: DIVIDER, marginTop: 28, marginBottom: 14 },
  footer: { flexDirection: "row", gap: 32 },
  footerLeft: { flex: 1 },
  footerRight: { flex: 1 },
  footerLabel: { fontSize: LABEL_SZ, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5 },
  footerText: { fontSize: 8.5, color: INK, lineHeight: 1.5, marginBottom: 10 },
  bankBlock: { marginBottom: 8 },
  bankBlockDivided: { marginTop: 6, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: "#E5E7EB" },
  bankLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  bankName: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  bankLine: { fontSize: 8.5, color: INK, marginBottom: 1.5 },
});

// ── Types ──────────────────────────────────────────────────────────────────────

export type EagleInfoLineItem = {
  name: string;
  sku?: string | null;
  quantity: number;
  rate: string;       // pre-formatted
  amount: string;     // pre-formatted
};

export type EagleInfoDocumentProps = {
  // Company
  companyName: string;
  companyAddress: string;
  companyPhone?: string | null;
  companyEmail?: string | null;
  companyWebsite?: string | null;
  companyLogoUrl?: string | null;

  // Document meta
  docTitle: string;          // "Estimate" | "Invoice" | "Receipt" | "Credit Note"
  docNumber: string;
  docDate: string;
  primaryDateLabel?: string; // overrides the "<docTitle> Date:" row label, e.g. "Inv Date:"
  terms?: string | null;     // "30 Days"
  dueDate?: string | null;
  metaRows?: Array<{ label: string; value: string }> | null; // overrides the date/terms/due rows
  topRuleColor?: string | null;  // full-width accent bar at the very top (e.g. receipts)

  // Client
  clientLabel?: string;      // "To" (default) | "Bill To"
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientLocation?: string | null;

  // Line items
  lineItems: EagleInfoLineItem[];

  // Totals
  subTotal?: string | null;
  vatLabel?: string | null;   // e.g. "VAT (18%)"
  vatAmount?: string | null;  // pre-formatted
  totalLabel?: string;        // "Total"
  totalAmount: string;
  paymentMade?: string | null;
  balanceDue: string;

  // Footer
  notes?: string | null;
  paymentTo?: string | null; // multi-line bank details
  termsText?: string | null;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function EagleInfoDocument(props: EagleInfoDocumentProps) {
  const {
    companyName, companyAddress, companyPhone, companyEmail, companyWebsite, companyLogoUrl,
    docTitle, docNumber, docDate, primaryDateLabel, terms, dueDate, metaRows, topRuleColor,
    clientLabel = "To", clientName, clientEmail, clientPhone, clientLocation,
    lineItems,
    subTotal, vatLabel, vatAmount, totalLabel = "Total", totalAmount, paymentMade, balanceDue,
    notes, paymentTo, termsText,
  } = props;

  const dateRows = metaRows && metaRows.length > 0
    ? metaRows
    : [
        { label: primaryDateLabel || `${docTitle} Date:`, value: docDate },
        { label: "Terms:",            value: terms || "-" },
        { label: "Due Date:",         value: dueDate || "-" },
      ];

  // Bank details: one or more accounts, each a block of lines. Blank lines
  // separate accounts (so "Payment To" can list multiple bank accounts).
  const bankBlocks = (paymentTo ?? "")
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0);

  return (
    <Document title={`${docTitle} ${docNumber}`}>
      <Page size="A4" style={s.page}>

        {topRuleColor ? <View style={[s.topRule, { backgroundColor: topRuleColor }]} /> : null}

        {/* ── Header ── */}
        <View style={s.header}>
          {/* Left: logo + company */}
          <View style={s.headerLeft}>
            {companyLogoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image style={s.logo} src={companyLogoUrl} />
            ) : null}
            <Text style={s.companyName}>{companyName}</Text>
            <Text style={s.companyLine}>{companyAddress}</Text>
            {companyPhone ? (
              <View style={s.phoneEmailRow}>
                <Text style={s.companyLineLabel}>PHONE:</Text>
                <Text style={s.companyLine}>{companyPhone}</Text>
              </View>
            ) : null}
            {companyEmail ? (
              <View style={s.phoneEmailRow}>
                <Text style={s.companyLineLabel}>EMAIL:</Text>
                <Text style={s.companyLine}>{companyEmail}</Text>
              </View>
            ) : null}
            {companyWebsite ? (
              <View style={s.phoneEmailRow}>
                <Text style={s.companyLineLabel}>WEB:</Text>
                <Text style={s.companyLine}>{companyWebsite}</Text>
              </View>
            ) : null}
          </View>

          {/* Right: doc type + balance */}
          <View style={s.headerRight}>
            <Text style={s.docTitle}>{docTitle}</Text>
            <Text style={s.docNumber}>#{docNumber}</Text>
            <View style={s.balanceBox}>
              <Text style={s.balanceLabel}>Balance Due</Text>
              <Text style={s.balanceAmount}>{balanceDue}</Text>
            </View>
          </View>
        </View>

        {/* ── Divider ── */}
        <View style={s.hr} />

        {/* ── Client / Dates ── */}
        <View style={s.toDateRow}>
          <View style={s.toBlock}>
            <Text style={s.toLabel}>{clientLabel}</Text>
            <Text style={s.toName}>{clientName}</Text>
            {clientEmail   ? <Text style={s.toLine}>{clientEmail}</Text>   : null}
            {clientPhone   ? <Text style={s.toLine}>{clientPhone}</Text>   : null}
            {clientLocation? <Text style={s.toLine}>{clientLocation}</Text>: null}
          </View>
          <View style={s.datesBlock}>
            {dateRows.map((dr, i) => (
              <View key={i} style={s.dateRow}>
                <Text style={s.dateLabel}>{dr.label}</Text>
                <Text style={s.dateValue}>{dr.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Line items table ── */}
        <View style={s.table}>
          {/* Header row */}
          <View style={s.tableHead}>
            <Text style={[s.th, s.colNum]}>#</Text>
            <Text style={[s.th, s.colDesc]}>Item &amp; Description</Text>
            <Text style={[s.th, s.colQty]}>Qty</Text>
            <Text style={[s.th, s.colRate]}>Rate</Text>
            <Text style={[s.th, s.colAmt]}>Amount</Text>
          </View>

          {/* Data rows */}
          {lineItems.map((item, idx) => (
            <View key={idx} style={s.tableRow}>
              <Text style={[{ fontSize: 9 }, s.colNum]}>{idx + 1}</Text>
              <View style={s.colDesc}>
                <Text style={s.itemName}>{item.name}</Text>
                {item.sku ? <Text style={s.itemSku}>SKU: {item.sku}</Text> : null}
              </View>
              <Text style={[{ fontSize: 9 }, s.colQty]}>{String(item.quantity)}</Text>
              <Text style={[{ fontSize: 9, color: MUTED }, s.colRate]}>{item.rate}</Text>
              <Text style={[{ fontSize: 9 }, s.colAmt]}>{item.amount}</Text>
            </View>
          ))}
        </View>

        {/* ── Totals ── */}
        <View style={s.totalsWrap}>
          {subTotal ? (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Sub Total</Text>
              <Text style={s.totalValue}>{subTotal}</Text>
            </View>
          ) : null}
          {vatLabel && vatAmount ? (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>{vatLabel}</Text>
              <Text style={s.totalValue}>{vatAmount}</Text>
            </View>
          ) : null}
          <View style={s.totalRowBold}>
            <Text style={s.totalLabelBold}>{totalLabel}</Text>
            <Text style={s.totalValueBold}>{totalAmount}</Text>
          </View>
          {paymentMade ? (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Payment Made</Text>
              <Text style={s.totalValue}>{paymentMade}</Text>
            </View>
          ) : null}
          <View style={s.balanceDueRow}>
            <Text style={s.totalLabelBold}>Balance Due</Text>
            <Text style={s.totalValueBold}>{balanceDue}</Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={s.footerDivider} />
        <View style={s.footer}>
          {/* Left: notes + payment to */}
          <View style={s.footerLeft}>
            {notes ? (
              <>
                <Text style={s.footerLabel}>Notes</Text>
                <Text style={s.footerText}>{notes}</Text>
              </>
            ) : null}
            {bankBlocks.length > 0 ? (
              <>
                <Text style={s.footerLabel}>Payment To</Text>
                {bankBlocks.map((lines, bi) => (
                  <View key={bi} style={bi > 0 ? [s.bankBlock, s.bankBlockDivided] : s.bankBlock}>
                    {bankBlocks.length > 1 ? <Text style={s.bankLabel}>Bank {bi + 1}</Text> : null}
                    <Text style={s.bankName}>{lines[0]}</Text>
                    {lines.slice(1).map((line, i) => (
                      <Text key={i} style={s.bankLine}>{line}</Text>
                    ))}
                  </View>
                ))}
              </>
            ) : null}
          </View>

          {/* Right: terms */}
          {termsText ? (
            <View style={s.footerRight}>
              <Text style={s.footerLabel}>Terms &amp; Conditions</Text>
              <Text style={s.footerText}>{termsText}</Text>
            </View>
          ) : null}
        </View>

      </Page>
    </Document>
  );
}
