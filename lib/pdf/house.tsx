/**
 * The house document chrome.
 *
 * Every document Eagle Info sends a customer should look like it came from the
 * same company. Before this, the money documents (quotation, invoice, receipt,
 * credit note, refund) shared one template while the delivery note, job card
 * and statement each carried their own header, their own greys and their own
 * idea of how big a logo is. Put an invoice next to a delivery note and they
 * read as two different businesses.
 *
 * So the parts that identify the document -- top rule, letterhead, title block,
 * page footer, section labels, table furniture -- live here once, and each
 * template composes them around its own body. What differs between documents is
 * their content, which is the only thing that should differ.
 */
import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";

// ── Palette ────────────────────────────────────────────────────────────────
// One slate family, so the greys read as chosen rather than as several
// defaults that happened to land near each other.
export const INK     = "#0F172A";  // body text
export const MUTED   = "#64748B";  // labels, secondary lines
export const FAINT   = "#94A3B8";  // page furniture
export const DIVIDER = "#E2E8F0";  // hairline
export const WHITE   = "#FFFFFF";
export const NAVY    = "#1E293B";  // table header, default accent
export const PANEL   = "#F8FAFC";  // party/meta band
export const SHADE   = "#F1F5F9";  // emphasis bar
export const ZEBRA   = "#FBFCFE";  // alternate table row

export const LABEL_SZ = 7;

/** Vertical rhythm. Every margin is one of these, so the page has a beat. */
export const SP = { xs: 4, sm: 8, md: 14, lg: 22, xl: 32 };

export const house = StyleSheet.create({
  page: {
    paddingHorizontal: 40,
    paddingTop: 0,
    paddingBottom: 44,   // room for the fixed page footer
    fontSize: 9,
    fontFamily: "Helvetica",
    color: INK,
    backgroundColor: WHITE,
  },
  topRule: { height: 4, marginHorizontal: -40 },
  headPad: { height: SP.lg },

  // ── Letterhead / title block ──
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: SP.md },
  headerLeft: { flex: 1, paddingRight: 24 },
  headerRight: { width: 190, alignItems: "flex-end" },
  logo: { width: 150, height: 44, marginBottom: 6, objectFit: "contain" },
  companyName: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 3, letterSpacing: -0.15 },
  companyLine: { fontSize: 8, color: MUTED, lineHeight: 1.5 },
  docTitle: { fontSize: 24, fontFamily: "Helvetica-Bold", letterSpacing: -0.5, marginBottom: 2 },
  docNumber: { fontSize: 8.5, color: MUTED, letterSpacing: 0.3, marginBottom: SP.md },

  // The one fact a reader looks for first on this document.
  card: { borderWidth: 1, borderColor: DIVIDER, borderLeftWidth: 3, borderRadius: 3, paddingHorizontal: 12, paddingVertical: 9, alignItems: "flex-end", width: "100%", backgroundColor: PANEL },
  cardLabel: { fontSize: LABEL_SZ, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  cardValue: { fontSize: 16, fontFamily: "Helvetica-Bold", letterSpacing: -0.3 },
  /** For a card holding words rather than an amount, e.g. a status or a reference. */
  cardValueText: { fontSize: 10.5, fontFamily: "Helvetica-Bold", textAlign: "right", lineHeight: 1.35 },

  // ── Party / meta band ──
  band: { flexDirection: "row", backgroundColor: PANEL, borderRadius: 3, paddingVertical: SP.sm + 2, paddingHorizontal: SP.md, marginBottom: SP.md },
  bandLeft: { flex: 1, paddingRight: SP.md },
  bandRight: { width: 210, borderLeftWidth: 1, borderLeftColor: DIVIDER, paddingLeft: SP.md, justifyContent: "center" },
  bandCol: { flex: 1, paddingRight: SP.md },
  bandColDivided: { flex: 1, borderLeftWidth: 1, borderLeftColor: DIVIDER, paddingLeft: SP.md },

  label: { fontSize: LABEL_SZ, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 },
  partyName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2, letterSpacing: -0.15 },
  partyAttn: { fontSize: 8.5, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  partyLine: { fontSize: 8.5, color: MUTED, marginBottom: 1.5 },

  // Label/value pair, right-aligned value. Used in meta columns.
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 },
  metaLabel: { fontSize: 8.5, color: MUTED },
  metaValue: { fontSize: 8.5, fontFamily: "Helvetica-Bold", textAlign: "right" },

  // ── Sections outside the band ──
  sectionLabel: { fontSize: LABEL_SZ, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  hr: { borderTopWidth: 1, borderTopColor: DIVIDER },

  // ── Tables ──
  tableHead: { flexDirection: "row", backgroundColor: NAVY, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 2 },
  th: { fontSize: 7.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.7, color: WHITE },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: DIVIDER, paddingVertical: 8, paddingHorizontal: 10, alignItems: "flex-start" },
  tableRowAlt: { backgroundColor: ZEBRA },
  cell: { fontSize: 9 },
  cellMuted: { fontSize: 9, color: MUTED },
  cellStrong: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  emptyRow: { paddingVertical: 14, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: DIVIDER },
  emptyText: { fontSize: 8.5, color: FAINT, fontStyle: "italic" },

  // ── Fixed page footer ──
  pageFoot: {
    position: "absolute", bottom: 24, left: 40, right: 40,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderTopWidth: 1, borderTopColor: DIVIDER, paddingTop: 7,
  },
  pageFootText: { fontSize: 7, color: FAINT, letterSpacing: 0.4 },
});

/**
 * Address lines, phones, then email and site — each on its own row.
 *
 * Callers pass the street address newline separated. Running all five details
 * into one paragraph was unreadable once a real address and two numbers were
 * set, and giving each a bold "PHONE:" label shouted louder than the company
 * name above it.
 */
export function companyLetterheadLines(input: {
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  companyWebsite?: string | null;
}): string[] {
  return [
    ...(input.companyAddress ?? "").split("\n").map((l) => l.trim()),
    input.companyPhone ?? "",
    [input.companyEmail, input.companyWebsite].filter(Boolean).join("   ·   "),
  ].filter((l) => l && l.trim());
}

/** Full-bleed accent bar, repeated on every page so each sheet is sealed. */
export function HouseTopRule({ accent }: { accent?: string | null }) {
  return <View style={[house.topRule, { backgroundColor: accent || NAVY }]} fixed />;
}

/** Logo, company name, and the contact block beneath it. */
export function HouseLetterhead({
  companyName, companyLogoUrl, lines,
}: { companyName: string; companyLogoUrl?: string | null; lines: string[] }) {
  return (
    <View style={house.headerLeft}>
      {companyLogoUrl ? (
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image style={house.logo} src={companyLogoUrl} />
      ) : null}
      <Text style={house.companyName}>{companyName}</Text>
      {lines.map((line, i) => (
        <Text key={i} style={house.companyLine}>{line}</Text>
      ))}
    </View>
  );
}

/** Document type, number, and the single headline fact for this document. */
export function HouseDocHead({
  docTitle, docNumber, accent, cardLabel, cardValue, cardIsText,
}: {
  docTitle: string;
  docNumber: string;
  accent?: string | null;
  cardLabel?: string | null;
  cardValue?: string | null;
  /** Words rather than an amount, so they set smaller and wrap. */
  cardIsText?: boolean;
}) {
  return (
    <View style={house.headerRight}>
      <Text style={house.docTitle}>{docTitle}</Text>
      <Text style={house.docNumber}>#{docNumber}</Text>
      {cardLabel && cardValue ? (
        <View style={[house.card, { borderLeftColor: accent || NAVY }]}>
          <Text style={house.cardLabel}>{cardLabel}</Text>
          <Text style={cardIsText ? house.cardValueText : house.cardValue}>{cardValue}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Pinned to every page: identifies a loose sheet, and makes it obvious when a
 * document runs to more than one page.
 */
export function HousePageFooter({ companyName, docTitle, docNumber }: {
  companyName: string; docTitle: string; docNumber: string;
}) {
  return (
    <View style={house.pageFoot} fixed>
      <Text style={house.pageFootText}>
        {[companyName, `${docTitle} #${docNumber}`].filter(Boolean).join("   ·   ")}
      </Text>
      <Text
        style={house.pageFootText}
        render={({ pageNumber, totalPages }) => (totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : "")}
      />
    </View>
  );
}
