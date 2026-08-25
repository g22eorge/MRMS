import { StyleSheet, Text, View } from "@react-pdf/renderer";

/**
 * A short capability strip at the foot of a quotation.
 *
 * Every client receives a quotation, which makes it the one document that
 * reaches the whole customer base. Someone quoted for equipment has no way of
 * knowing we also repair, and a repair customer has no idea we supply. This
 * says so once, quietly, at the bottom of the page.
 *
 * Quotations only. An invoice or receipt is a record of a transaction that has
 * already happened; selling into it would cheapen the document.
 */

export type QuotationPromo = {
  /** Small uppercase lead-in, e.g. "Also from Eagle Info Tech". */
  label: string;
  /** Capabilities, printed on one line separated by middots. */
  services: string[];
  /** Optional closing sentence. */
  line?: string | null;
};

const SERVICES = [
  "Device repair and diagnostics",
  "Spare parts and accessories",
  "Laptops, desktops and printers",
  "Networking and IT support",
];

/**
 * The default strip. Named from branding so it reads correctly for whichever
 * org is printing, rather than hard-coding one tenant's name into shared code.
 */
export function defaultQuotationPromo(companyName?: string | null): QuotationPromo {
  const who = (companyName ?? "").trim();
  return {
    label: who ? `Also from ${who}` : "Also from us",
    services: SERVICES,
    line: "Ask for a quote on any of the above.",
  };
}

const MUTED = "#6b7280";
const RULE = "#e5e7eb";

const s = StyleSheet.create({
  wrap: { marginTop: 14, paddingTop: 8, borderTopWidth: 1, borderTopColor: RULE },
  label: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 3,
  },
  services: { fontSize: 8.5, color: "#111827", lineHeight: 1.45 },
  line: { fontSize: 8, color: MUTED, marginTop: 2 },
});

export function QuotationPromoStrip({ promo }: { promo?: QuotationPromo | null }) {
  if (!promo || promo.services.length === 0) return null;
  return (
    <View style={s.wrap} wrap={false}>
      <Text style={s.label}>{promo.label}</Text>
      <Text style={s.services}>{promo.services.join("   ·   ")}</Text>
      {promo.line ? <Text style={s.line}>{promo.line}</Text> : null}
    </View>
  );
}
