import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";

import { getClientStatement } from "@/lib/commercial/statements";
import { formatEATDocDate } from "@/lib/date-eat";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { getDocumentBrandingSettings } from "@/lib/document-branding";
import { resolvePdfLogo } from "@/lib/pdf/pdf-utils";
import { StatementDocument, type StatementDocLine } from "@/lib/pdf/StatementDocument";
import { prisma } from "@/lib/prisma";

export type GenerateStatementResult =
  | { ok: true; buffer: Buffer; filename: string; outstanding: number; currency: string }
  | { ok: false; error: string };

/**
 * Statement of account for one client: every invoice and POS sale on the
 * account with its billed/paid/balance, plus headline totals.
 *
 * Reads through getClientStatement so the PDF, the staff client page and the
 * customer portal all quote the same figures rather than three calculations
 * that can drift apart.
 */
export async function generateStatementBuffer(
  orgId: string,
  clientId: string,
  baseCurrency: string,
): Promise<GenerateStatementResult> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId },
    select: { id: true, fullName: true, organization: true, phone: true, email: true, address: true },
  });
  if (!client) return { ok: false, error: "Client not found" };

  // NB: never call this inside a $transaction — it deadlocks on Turso.
  const branding = await getDocumentBrandingSettings(orgId);
  const logoUrl = await resolvePdfLogo();
  const statement = await getClientStatement(orgId, clientId, normalizeCurrency(baseCurrency, "UGX"));
  const currency = statement.currency;
  const money = (n: number) => formatMoney(n, currency);

  const lines: StatementDocLine[] = statement.lines.map((line) => ({
    type: line.type,
    number: line.number,
    date: formatEATDocDate(line.date),
    status: line.status,
    billed: money(line.billed),
    paid: money(line.paid),
    balance: money(line.balance),
  }));

  const first = statement.lines[0]?.date;
  const last = statement.lines[statement.lines.length - 1]?.date;
  const periodLabel = first && last
    ? `${formatEATDocDate(first)} — ${formatEATDocDate(last)}`
    : "No activity yet";

  const issuedAt = new Date();
  // Statements are generated on demand and never persisted, so the reference is
  // derived from the client and the day rather than taken from a sequence.
  const statementNumber = `STMT-${client.id.slice(-6).toUpperCase()}-${issuedAt.toISOString().slice(0, 10).replace(/-/g, "")}`;

  const element = createElement(StatementDocument, {
    branding: {
      companyName: branding.companyName,
      companyAddressLine1: branding.companyAddressLine1,
      companyAddressLine2: branding.companyAddressLine2,
      companyContacts: branding.companyContacts,
      companyEmail: branding.companyEmail,
      companyLogoUrl: logoUrl,
      footerText: branding.footerText,
    },
    statementNumber,
    issuedAt: formatEATDocDate(issuedAt),
    periodLabel,
    client: {
      name: client.fullName,
      organization: client.organization,
      phone: client.phone,
      email: client.email,
      address: client.address,
    },
    lines,
    totals: {
      billed: money(statement.totals.billed),
      paid: money(statement.totals.paid),
      outstanding: money(statement.totals.outstanding),
    },
    isSettled: statement.totals.outstanding <= 0,
  });

  const buffer = await renderToBuffer(element as never);
  return {
    ok: true,
    buffer,
    filename: `statement-${(client.organization || client.fullName).replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.pdf`,
    outstanding: statement.totals.outstanding,
    currency,
  };
}
