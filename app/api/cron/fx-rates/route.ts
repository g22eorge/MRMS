import { NextRequest, NextResponse } from "next/server";

import { assertCronAuthorized } from "@/lib/cron-auth";
import { refreshReferenceRates } from "@/lib/currency/reference-rate";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Refresh the published reference rates used to monitor transfer cost.
 *
 * These rates never post and never convert. They exist so a transfer settled at
 * 3,850 can be shown as sitting 4% above the published rate, which is what
 * identifies an expensive channel — the books themselves always use what the
 * bank statement showed.
 *
 * Pairs are discovered from the currencies actually present on supplier bills,
 * so a business buying in AED and RMB fetches two and not the whole table. An
 * organisation that has never raised a foreign bill fetches nothing.
 *
 * Daily is deliberate. A rate used for comparison does not need to be live, and
 * a monitoring feature must never be a reason the system is slower or less
 * reliable than it was without it.
 */
export async function GET(request: NextRequest) {
  const authError = assertCronAuthorized(request);
  if (authError) return authError;

  try {
    const orgs = await prisma.organization.findMany({ select: { id: true, baseCurrency: true } });
    const summary: Array<{ orgId: string; pairs: number; ok: number; failed: number }> = [];

    for (const org of orgs) {
      const quote = (org.baseCurrency ?? "UGX").toUpperCase();
      // Only currencies this org has actually transacted in.
      const bills = await prisma.supplierBill
        .findMany({ where: { orgId: org.id, currency: { not: quote } }, select: { currency: true }, distinct: ["currency"] })
        .catch(() => []);
      const bases = [...new Set(bills.map((b) => b.currency.toUpperCase()))];
      if (bases.length === 0) continue;

      const results = await refreshReferenceRates({ quote, bases });
      summary.push({
        orgId: org.id,
        pairs: results.length,
        ok: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
      });
      for (const r of results.filter((x) => !x.ok)) {
        console.warn(`[cron/fx-rates] ${r.base}->${r.quote}: ${r.error}`);
      }
    }

    return NextResponse.json({ organisations: summary.length, summary });
  } catch (err) {
    console.error("[cron/fx-rates] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
