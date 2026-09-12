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
  wrap: { marginTop: 10, paddingTop: 7, borderTopWidth: 1, borderTopColor: RULE },
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

/**
 * The same strip, pinned above the page footer instead of flowing after the
 * content.
 *
 * As flow content the strip could not be split (`wrap={false}`) and was the
 * last element on the page, so whenever the remaining space was smaller than
 * the block react-pdf moved it to a page of its own — and since nothing
 * followed it, that page held one line of cross-sell and a page of white. A
 * two-item quotation printed as "Page 1 of 2".
 *
 * Pinned, it cannot create a page: absolutely positioned, so it takes no part
 * in the flow, and `fixed` so it is drawn per page. It repeats on every page
 * like the footer beneath it — react-pdf only passes `totalPages` to a Text
 * render callback, not a View's, and a View cannot be nested inside a Text, so
 * restricting it to the last page would mean relying on an untyped argument.
 * Repeating is honest page furniture and costs nothing on the one-page
 * quotations that are the common case.
 *
 * The page must reserve room for it in `paddingBottom` or long content will run
 * underneath. PROMO_PINNED_HEIGHT is that reservation — raise it if the strip
 * grows a line.
 */
export const PROMO_PINNED_HEIGHT = 40;

export function QuotationPromoFooter({
  promo,
  bottom,
  horizontal = 40,
}: {
  promo?: QuotationPromo | null;
  /** Distance from the page bottom — clear the page footer that sits below. */
  bottom: number;
  /** Match the page's horizontal padding so the rule lines up with the body. */
  horizontal?: number;
}) {
  if (!promo || promo.services.length === 0) return null;
  return (
    <View fixed style={{ position: "absolute", left: horizontal, right: horizontal, bottom }}>
      <View style={s.wrap}>
        <Text style={s.label}>{promo.label}</Text>
        <Text style={s.services}>{promo.services.join("   ·   ")}</Text>
        {promo.line ? <Text style={s.line}>{promo.line}</Text> : null}
      </View>
    </View>
  );
}
