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

import { isTermsHeading } from "@/lib/quote-terms";
import { QuotationPromoFooter, PROMO_PINNED_HEIGHT, type QuotationPromo } from "@/lib/pdf/QuotationPromoStrip";
// Palette and rhythm come from lib/pdf/house, so this template and the delivery
// note, job card and statement cannot drift apart into slightly different greys.
import { DIVIDER, FAINT, INK, LABEL_SZ, MUTED, NAVY, PANEL, SHADE, SP, WHITE, ZEBRA } from "@/lib/pdf/house";

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    paddingHorizontal: 40,
    paddingTop: 0,
    // Room for the fixed page footer AND the pinned promo strip above it, so
    // body content can never run into either. The strip used to flow after the
    // content, which meant a nearly-full page pushed it onto a sheet of its own.
    paddingBottom: 44 + PROMO_PINNED_HEIGHT,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: INK,
    backgroundColor: WHITE,
  },

  // Full-bleed accent bar. Every document gets one now: it seals the top edge
  // and stops the page starting on nothing.
  topRule: { height: 4, marginHorizontal: -40 },
  headPad: { height: SP.lg },

  // ── Header ──
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: SP.md },
  headerLeft: { flex: 1, paddingRight: 24 },
  logo: { width: 150, height: 44, marginBottom: 6, objectFit: "contain" },
  companyName: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 3, letterSpacing: -0.15 },
  // One quiet contact line instead of a stack of bold PHONE:/EMAIL:/WEB: labels,
  // which shouted louder than the company name above them.
  companyLine: { fontSize: 8, color: MUTED, lineHeight: 1.5 },

  headerRight: { width: 190, alignItems: "flex-end" },
  docTitle: { fontSize: 24, fontFamily: "Helvetica-Bold", letterSpacing: -0.5, marginBottom: 2 },
  docNumber: { fontSize: 8.5, color: MUTED, letterSpacing: 0.3, marginBottom: SP.md },
  // The one number a reader looks for first, so it gets the accent edge.
  balanceBox: { borderWidth: 1, borderColor: DIVIDER, borderLeftWidth: 3, borderRadius: 3, paddingHorizontal: 12, paddingVertical: 9, alignItems: "flex-end", width: "100%", backgroundColor: PANEL },
  balanceLabel: { fontSize: LABEL_SZ, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  balanceAmount: { fontSize: 16, fontFamily: "Helvetica-Bold", letterSpacing: -0.3 },

  // ── Party / meta band ──
  // A single soft panel rather than two floating columns with competing
  // underlines. It anchors the upper page and separates "who and when" from
  // "what and how much".
  band: { flexDirection: "row", backgroundColor: PANEL, borderRadius: 3, paddingVertical: SP.sm + 2, paddingHorizontal: SP.md, marginBottom: SP.md },
  bandLeft: { flex: 1, paddingRight: SP.md },
  // Centred, so a three-row meta column sits against the middle of a five-line
  // address rather than hanging from its top edge.
  bandRight: { width: 210, borderLeftWidth: 1, borderLeftColor: DIVIDER, paddingLeft: SP.md, justifyContent: "center" },
  toLabel: { fontSize: LABEL_SZ, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 },
  toName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2, letterSpacing: -0.15 },
  toAttn: { fontSize: 8.5, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  toLine: { fontSize: 8.5, color: MUTED, marginBottom: 1.5 },
  dateRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 },
  dateLabel: { fontSize: 8.5, color: MUTED },
  dateValue: { fontSize: 8.5, fontFamily: "Helvetica-Bold", textAlign: "right" },

  // ── Line-items table ──
  table: { marginBottom: SP.sm },
  tableHead: { flexDirection: "row", backgroundColor: NAVY, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 2 },
  th: { fontSize: 7.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.7, color: WHITE },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: DIVIDER, paddingVertical: 8, paddingHorizontal: 10, alignItems: "flex-start" },
  // Barely-there tint on alternate rows. On a thirty-line quotation it keeps the
  // eye on one row across the full width; on a three-line one it is invisible.
  tableRowAlt: { backgroundColor: ZEBRA },
  emptyRow: { paddingVertical: 14, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: DIVIDER },
  emptyText: { fontSize: 8.5, color: FAINT, fontStyle: "italic" },
  colNum:   { width: 22 },
  colDesc:  { flex: 1, paddingRight: 10 },
  colQty:   { width: 44, textAlign: "center" },
  colRate:  { width: 92, textAlign: "right" },
  colAmt:   { width: 100, textAlign: "right" },
  itemName: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 2, lineHeight: 1.35 },
  itemSku:  { fontSize: 7.5, color: MUTED, letterSpacing: 0.2 },
  cell:     { fontSize: 9 },
  cellMuted:{ fontSize: 9, color: MUTED },
  // The amount is what a reader scans down the page for, so it carries weight
  // while the unit rate beside it stays quiet.
  cellAmount:{ fontSize: 9, fontFamily: "Helvetica-Bold" },

  // ── Totals ──
  totalsWrap: { marginTop: SP.sm, marginLeft: "auto", width: 250 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  totalLabel: { fontSize: 9, color: MUTED },
  totalValue: { fontSize: 9, textAlign: "right" },
  // A rule above the grand total instead of a box around every row: the eye
  // needs one break between the arithmetic and its result.
  totalRowBold: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderTopWidth: 1, borderTopColor: INK, marginTop: 2 },
  totalLabelBold: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  totalValueBold: { fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "right" },
  balanceDueRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: 10, backgroundColor: SHADE, borderRadius: 3, borderLeftWidth: 3, marginTop: SP.xs },

  // ── Footer ──
  // A flexGrow spacer here would anchor this block to the foot of the page,
  // but react-pdf lets it consume the whole remaining page and pushes the
  // footer onto a second sheet -- a six-line quotation came out two pages
  // long. Trailing whitespace is the cheaper problem.
  footerDivider: { borderTopWidth: 1, borderTopColor: DIVIDER, marginTop: SP.lg, marginBottom: SP.sm },
  footer: { flexDirection: "row", gap: SP.xl },
  footerCol: { flex: 1 },

  // ── Fixed page footer ──
  // Without this the page simply stopped, leaving a third of the sheet blank
  // and no way to tell a two-page invoice from a one-page one.
  pageFoot: {
    position: "absolute", bottom: 24, left: 40, right: 40,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderTopWidth: 1, borderTopColor: DIVIDER, paddingTop: 7,
  },
  pageFootText: { fontSize: 7, color: FAINT, letterSpacing: 0.4 },
  footerLabel: { fontSize: LABEL_SZ, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5 },
  footerText: { fontSize: 8.5, color: INK, lineHeight: 1.5, marginBottom: 10 },
  footerTermHead: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: INK, marginTop: 4, marginBottom: 1 },
  footerTermLine: { fontSize: 8.5, color: INK, lineHeight: 1.3, marginBottom: 0.5 },
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
  /** The person to address inside a company — printed as "Attn: …". */
  clientAttn?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientLocation?: string | null;

  // Line items
  lineItems: EagleInfoLineItem[];

  // Totals
  subTotal?: string | null;
  discountLabel?: string | null;  // e.g. "Discount"
  discountAmount?: string | null; // pre-formatted, shown as a deduction
  vatLabel?: string | null;   // e.g. "VAT (18%)"
  vatAmount?: string | null;  // pre-formatted
  totalLabel?: string;        // "Total"
  totalAmount: string;
  paymentMade?: string | null;
  balanceDue: string;
  /** Header-card overrides. A receipt leads with "Amount Paid", not a nil balance. */
  headlineLabel?: string | null;
  headlineAmount?: string | null;

  // Footer
  notes?: string | null;
  paymentTo?: string | null; // multi-line bank details
  termsText?: string | null;
  promo?: QuotationPromo | null;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function EagleInfoDocument(props: EagleInfoDocumentProps) {
  const {
    companyName, companyAddress, companyPhone, companyEmail, companyWebsite, companyLogoUrl,
    docTitle, docNumber, docDate, primaryDateLabel, terms, dueDate, metaRows, topRuleColor,
    clientLabel = "To", clientName, clientAttn, clientEmail, clientPhone, clientLocation,
    lineItems,
    subTotal, discountLabel, discountAmount, vatLabel, vatAmount, totalLabel = "Total", totalAmount, paymentMade, balanceDue,
    headlineLabel, headlineAmount,
    notes, paymentTo, termsText, promo,
  } = props;

  const dateRows = metaRows && metaRows.length > 0
    ? metaRows
    : [
        { label: primaryDateLabel || `${docTitle} Date:`, value: docDate },
        { label: "Terms:",            value: terms || "-" },
        { label: "Due Date:",         value: dueDate || "-" },
      ];

  // Receipts pass their own colour; everything else takes the house navy. This
  // is the single hue that moves, and it appears in exactly three places: the
  // top edge, the balance card, and the balance bar.
  const accent = topRuleColor || NAVY;

  // The letterhead under the logo: who issued this, where they are, and how to
  // reach them. Each street line keeps its own row (callers pass them newline
  // separated) rather than running into one long comma-joined line, phones sit
  // together, and email and site share the last row. Collapsing all five into
  // one paragraph was unreadable once a real address and two numbers were set;
  // giving each a bold "PHONE:" label, as this once did, was louder than the
  // company name above it.
  const companyLines = [
    ...companyAddress.split("\n").map((l) => l.trim()),
    companyPhone ?? "",
    [companyEmail, companyWebsite].filter(Boolean).join("   ·   "),
  ].filter((l) => l && l.trim());

  // Bank details: one or more accounts, each a block of lines. Blank lines
  // separate accounts (so "Payment To" can list multiple bank accounts).
  const bankBlocks = (paymentTo ?? "")
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0);

  return (
    <Document title={`${docTitle} ${docNumber}`}>
      <Page size="A4" style={s.page}>

        <View style={[s.topRule, { backgroundColor: accent }]} fixed />
        <View style={s.headPad} />

        {/* ── Header ── */}
        <View style={s.header}>
          {/* Left: logo + company */}
          <View style={s.headerLeft}>
            {companyLogoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image style={s.logo} src={companyLogoUrl} />
            ) : null}
            <Text style={s.companyName}>{companyName}</Text>
            {companyLines.map((line, i) => (
              <Text key={i} style={s.companyLine}>{line}</Text>
            ))}
          </View>

          {/* Right: doc type + the headline number */}
          <View style={s.headerRight}>
            <Text style={s.docTitle}>{docTitle}</Text>
            <Text style={s.docNumber}>#{docNumber}</Text>
            <View style={[s.balanceBox, { borderLeftColor: accent }]}>
              <Text style={s.balanceLabel}>{headlineLabel || "Balance Due"}</Text>
              <Text style={s.balanceAmount}>{headlineAmount || balanceDue}</Text>
            </View>
          </View>
        </View>

        {/* ── Who and when ── */}
        <View style={s.band} wrap={false}>
          <View style={s.bandLeft}>
            <Text style={s.toLabel}>{clientLabel}</Text>
            <Text style={s.toName}>{clientName}</Text>
            {clientAttn    ? <Text style={s.toAttn}>Attn: {clientAttn}</Text>  : null}
            {clientEmail   ? <Text style={s.toLine}>{clientEmail}</Text>   : null}
            {clientPhone   ? <Text style={s.toLine}>{clientPhone}</Text>   : null}
            {clientLocation? <Text style={s.toLine}>{clientLocation}</Text>: null}
          </View>
          <View style={s.bandRight}>
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
          {/* Repeats at the top of every page, so a long invoice stays readable. */}
          <View style={s.tableHead} fixed>
            <Text style={[s.th, s.colNum]}>#</Text>
            <Text style={[s.th, s.colDesc]}>Item &amp; Description</Text>
            <Text style={[s.th, s.colQty]}>Qty</Text>
            <Text style={[s.th, s.colRate]}>Rate</Text>
            <Text style={[s.th, s.colAmt]}>Amount</Text>
          </View>

          {/* Data rows. wrap={false} keeps a description and its price together
              rather than splitting one item across a page break. */}
          {lineItems.map((item, idx) => (
            <View key={idx} style={idx % 2 === 1 ? [s.tableRow, s.tableRowAlt] : s.tableRow} wrap={false}>
              <Text style={[s.cellMuted, s.colNum]}>{idx + 1}</Text>
              <View style={s.colDesc}>
                <Text style={s.itemName}>{item.name}</Text>
                {item.sku ? <Text style={s.itemSku}>SKU: {item.sku}</Text> : null}
              </View>
              <Text style={[s.cell, s.colQty]}>{String(item.quantity)}</Text>
              <Text style={[s.cellMuted, s.colRate]}>{item.rate}</Text>
              <Text style={[s.cellAmount, s.colAmt]}>{item.amount}</Text>
            </View>
          ))}

          {lineItems.length === 0 ? (
            <View style={s.emptyRow}>
              <Text style={s.emptyText}>No items on this document.</Text>
            </View>
          ) : null}
        </View>

        {/* ── Totals ── */}
        <View style={s.totalsWrap} wrap={false}>
          {subTotal ? (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Sub Total</Text>
              <Text style={s.totalValue}>{subTotal}</Text>
            </View>
          ) : null}
          {discountAmount ? (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>{discountLabel || "Discount"}</Text>
              <Text style={s.totalValue}>-{discountAmount}</Text>
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
          <View style={[s.balanceDueRow, { borderLeftColor: accent }]}>
            <Text style={s.totalLabelBold}>Balance Due</Text>
            <Text style={s.totalValueBold}>{balanceDue}</Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={s.footerDivider} />
        {/* Deliberately allowed to wrap. Pinning it whole meant a tall terms
            block that did not fit the remaining space jumped to a second sheet,
            turning a six-line quotation into a two-page document. */}
        <View style={s.footer}>
          {/* Left: terms sit first, where the eye lands */}
          {termsText ? (
            <View style={s.footerCol}>
              <Text style={s.footerLabel}>Terms &amp; Conditions</Text>
              {termsText.split("\n").map((l) => l.trim()).filter(Boolean).map((line, i) => (
                <Text key={i} style={isTermsHeading(line) ? s.footerTermHead : s.footerTermLine}>{line}</Text>
              ))}
            </View>
          ) : null}
          {/* Right: notes + payment to */}
          <View style={s.footerCol}>
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
        </View>

        {/* Sits directly above the page footer: 24 for the footer's offset plus
            its own single line and rule. */}
        <QuotationPromoFooter promo={promo} bottom={24 + 18} />

        {/* Pinned to every page: identifies a loose sheet, and makes it obvious
            when a document runs to more than one page. */}
        <View style={s.pageFoot} fixed>
          <Text style={s.pageFootText}>
            {[companyName, `${docTitle} #${docNumber}`].filter(Boolean).join("   ·   ")}
          </Text>
          <Text
            style={s.pageFootText}
            render={({ pageNumber, totalPages }) =>
              totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : ""
            }
          />
        </View>

      </Page>
    </Document>
  );
}
