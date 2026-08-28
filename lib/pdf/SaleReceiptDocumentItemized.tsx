/**
 * Receipt — Itemized template.
 *
 * The PREMIUM tier has advertised "Shows line items from the invoice" with no
 * component behind it, so the option rendered the default. This is that design.
 *
 * What distinguishes it is that the line items are the document rather than a
 * detail inside it: every row carries SKU, quantity, unit price and line total,
 * and the totals reconcile downward from subtotal through discount and tax to
 * what was actually paid and what remains. That is what a customer reconciling
 * a receipt against a purchase order needs, and it is the reason to pick this
 * over Default — which summarises rather than itemises.
 *
 * Props are the {sale, branding} pair that /api/sales/[id]/receipt passes.
 */
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { clientDisplayName } from "@/lib/client-name";
import { formatMoney, getAppCurrency, normalizeCurrency } from "@/lib/currency";

type Branding = {
  documentTitle?: string | null;
  companyName?: string | null;
  companyTagline?: string | null;
  companyContacts?: string | null;
  companyEmail?: string | null;
  companyWebsite?: string | null;
  companyAddressLine1?: string | null;
  companyAddressLine2?: string | null;
  vatRatePercent?: number | null;
  footerText?: string | null;
  paymentInstructions?: string | null;
} | null;

type Sale = {
  saleNumber: string;
  status: string;
  createdAt: Date;
  currency?: string | null;
  branch: { name: string } | null;
  client: { fullName: string; phone: string | null; organization?: string | null } | null;
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  totalAmount: number;
  paidAmount: number;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    sku?: string | null;
  }>;
  payments: Array<{ id: string; amount: number; method: string; reference: string | null; receivedAt: Date }>;
};

const INK = "#0f172a";
const MID = "#475569";
const LITE = "#94a3b8";
const TEAL = "#0f766e";
const TEAL_SOFT = "#ccfbf1";
const RULE = "#e2e8f0";
const ZEBRA = "#f8fafc";
const WHITE = "#ffffff";

const s = StyleSheet.create({
  page: { paddingHorizontal: 28, paddingVertical: 24, fontSize: 8.6, color: INK, backgroundColor: WHITE },

  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  coName: { fontSize: 13, fontWeight: 700, color: INK },
  coLine: { fontSize: 7.4, color: MID, marginTop: 1 },
  docSide: { alignItems: "flex-end" },
  docType: { fontSize: 17, fontWeight: 800, color: TEAL, letterSpacing: 1.4 },
  docNum: { fontSize: 9, fontWeight: 600, color: INK, marginTop: 2 },
  docMeta: { fontSize: 7.4, color: MID, marginTop: 1 },

  rule: { borderBottom: `1 solid ${RULE}`, marginVertical: 10 },

  meta: { flexDirection: "row", gap: 10, marginBottom: 10 },
  metaCell: { flex: 1 },
  label: { fontSize: 7, color: LITE, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  value: { fontSize: 8.8, color: INK, fontWeight: 600 },

  // ── items table ──────────────────────────────────────────────────────────
  thead: {
    flexDirection: "row",
    backgroundColor: TEAL,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  th: { fontSize: 7.2, color: WHITE, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 },
  tr: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderBottom: `1 solid ${RULE}` },
  td: { fontSize: 8.2, color: INK },
  tdMuted: { fontSize: 7.2, color: LITE, marginTop: 1 },

  colNo: { width: "6%" },
  colDesc: { width: "44%" },
  colQty: { width: "10%", textAlign: "right" },
  colRate: { width: "20%", textAlign: "right" },
  colAmt: { width: "20%", textAlign: "right" },

  // ── totals ───────────────────────────────────────────────────────────────
  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10 },
  totals: { width: "56%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  totalLbl: { fontSize: 8.2, color: MID },
  totalVal: { fontSize: 8.2, color: INK, fontWeight: 600 },
  grand: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: TEAL_SOFT,
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  grandLbl: { fontSize: 9, color: INK, fontWeight: 700 },
  grandVal: { fontSize: 12, color: TEAL, fontWeight: 800 },
  balance: { flexDirection: "row", justifyContent: "space-between", marginTop: 5 },
  balanceLbl: { fontSize: 8.6, fontWeight: 700, color: INK },

  payHead: { marginTop: 14 },
  payRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottom: `1 solid ${RULE}` },

  footer: { fontSize: 7, color: LITE, marginTop: 14, textAlign: "center" },
});

function fmtDate(d: Date) {
  return new Date(d).toISOString().slice(0, 10);
}

export function SaleReceiptDocumentItemized({ sale, branding }: { sale: Sale; branding: Branding }) {
  const currency = normalizeCurrency(sale.currency, getAppCurrency());
  const contact = [branding?.companyContacts, branding?.companyEmail, branding?.companyWebsite]
    .filter(Boolean)
    .join(" · ");
  const address = [branding?.companyAddressLine1, branding?.companyAddressLine2].filter(Boolean).join(" · ");
  // Never show a negative balance: an overpayment is change given, not a debt.
  const balanceDue = Math.max(0, sale.totalAmount - sale.paidAmount);
  const unitCount = sale.items.reduce((n, it) => n + it.quantity, 0);

  return (
    <Document title={`Receipt ${sale.saleNumber}`}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <Text style={s.coName}>{branding?.companyName ?? "Receipt"}</Text>
            {branding?.companyTagline ? <Text style={s.coLine}>{branding.companyTagline}</Text> : null}
            {contact ? <Text style={s.coLine}>{contact}</Text> : null}
            {address ? <Text style={s.coLine}>{address}</Text> : null}
          </View>
          <View style={s.docSide}>
            <Text style={s.docType}>RECEIPT</Text>
            <Text style={s.docNum}>{sale.saleNumber}</Text>
            <Text style={s.docMeta}>{fmtDate(sale.createdAt)}</Text>
            <Text style={s.docMeta}>{sale.status}</Text>
          </View>
        </View>

        <View style={s.rule} />

        <View style={s.meta}>
          <View style={s.metaCell}>
            <Text style={s.label}>Customer</Text>
            <Text style={s.value}>{clientDisplayName(sale.client, "Walk-in")}</Text>
            {sale.client?.phone ? <Text style={s.tdMuted}>{sale.client.phone}</Text> : null}
          </View>
          <View style={s.metaCell}>
            <Text style={s.label}>Branch</Text>
            <Text style={s.value}>{sale.branch?.name ?? "-"}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.label}>Lines</Text>
            <Text style={s.value}>
              {sale.items.length} item{sale.items.length === 1 ? "" : "s"} · {unitCount} unit
              {unitCount === 1 ? "" : "s"}
            </Text>
          </View>
        </View>

        <View style={s.thead}>
          <Text style={[s.th, s.colNo]}>#</Text>
          <Text style={[s.th, s.colDesc]}>Description</Text>
          <Text style={[s.th, s.colQty]}>Qty</Text>
          <Text style={[s.th, s.colRate]}>Unit price</Text>
          <Text style={[s.th, s.colAmt]}>Amount</Text>
        </View>

        {sale.items.map((it, i) => (
          <View key={it.id} style={[s.tr, i % 2 === 1 ? { backgroundColor: ZEBRA } : {}]} wrap={false}>
            <Text style={[s.td, s.colNo]}>{i + 1}</Text>
            <View style={s.colDesc}>
              <Text style={s.td}>{it.description}</Text>
              {it.sku ? <Text style={s.tdMuted}>SKU {it.sku}</Text> : null}
            </View>
            <Text style={[s.td, s.colQty]}>{it.quantity}</Text>
            <Text style={[s.td, s.colRate]}>{formatMoney(it.unitPrice, currency)}</Text>
            <Text style={[s.td, s.colAmt]}>{formatMoney(it.lineTotal, currency)}</Text>
          </View>
        ))}

        {sale.items.length === 0 ? (
          <View style={s.tr}>
            <Text style={[s.td, { color: LITE }]}>No line items recorded for this sale.</Text>
          </View>
        ) : null}

        <View style={s.totalsWrap}>
          <View style={s.totals}>
            <View style={s.totalRow}>
              <Text style={s.totalLbl}>Subtotal</Text>
              <Text style={s.totalVal}>{formatMoney(sale.subtotal, currency)}</Text>
            </View>
            {sale.discountAmount > 0 ? (
              <View style={s.totalRow}>
                <Text style={s.totalLbl}>Discount</Text>
                <Text style={s.totalVal}>-{formatMoney(sale.discountAmount, currency)}</Text>
              </View>
            ) : null}
            {sale.vatAmount > 0 ? (
              <View style={s.totalRow}>
                <Text style={s.totalLbl}>
                  VAT{branding?.vatRatePercent ? ` (${branding.vatRatePercent}%)` : ""}
                </Text>
                <Text style={s.totalVal}>{formatMoney(sale.vatAmount, currency)}</Text>
              </View>
            ) : null}

            <View style={s.grand}>
              <Text style={s.grandLbl}>Total</Text>
              <Text style={s.grandVal}>{formatMoney(sale.totalAmount, currency)}</Text>
            </View>

            <View style={s.totalRow}>
              <Text style={s.totalLbl}>Paid</Text>
              <Text style={s.totalVal}>{formatMoney(sale.paidAmount, currency)}</Text>
            </View>
            <View style={s.balance}>
              {balanceDue > 0 ? (
                <>
                  <Text style={s.balanceLbl}>Balance due</Text>
                  <Text style={s.balanceLbl}>{formatMoney(balanceDue, currency)}</Text>
                </>
              ) : (
                // "Settled in full — UGX 0" reads as an amount owed of zero,
                // which is a sentence nobody needs. The words carry it alone.
                <Text style={s.balanceLbl}>Settled in full</Text>
              )}
            </View>
          </View>
        </View>

        {sale.payments.length > 0 ? (
          <View style={s.payHead}>
            <Text style={s.label}>Payments received</Text>
            {sale.payments.map((p) => (
              <View key={p.id} style={s.payRow}>
                <View>
                  <Text style={s.td}>{p.method.replaceAll("_", " ")}</Text>
                  {p.reference ? <Text style={s.tdMuted}>Ref {p.reference}</Text> : null}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={s.totalVal}>{formatMoney(p.amount, currency)}</Text>
                  <Text style={s.tdMuted}>{fmtDate(p.receivedAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {branding?.paymentInstructions ? (
          <View style={{ marginTop: 12 }}>
            <Text style={s.label}>Payment instructions</Text>
            <Text style={s.tdMuted}>{branding.paymentInstructions}</Text>
          </View>
        ) : null}

        {branding?.footerText ? <Text style={s.footer}>{branding.footerText}</Text> : null}
      </Page>
    </Document>
  );
}
