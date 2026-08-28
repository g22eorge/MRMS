import { OutboundMessageType } from "@prisma/client";

import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { formatEATDocDate } from "@/lib/date-eat";
import { enqueueEmailMessage, enqueueWhatsAppMessage } from "@/lib/notifications/whatsapp-outbox";
import {
  REMINDER_LADDER,
  effectiveDueDate,
  reminderAnchor,
  stageDueNow,
  startOfDay,
  withinQuietHours,
  type ReminderStage,
} from "@/lib/notifications/payment-reminder-schedule";
import { prisma } from "@/lib/prisma";

/**
 * Automatic payment reminders for invoices sold on terms.
 *
 * Shaped by what the receivables book actually looks like rather than by what a
 * reminder feature usually does. On care at the time of writing: 20 unpaid
 * invoices, 19.6m outstanding, of which 14.5m is already past 30 days and
 * 13.3m of that is a single invoice. So:
 *
 *   - This is preventive, not recovery. It protects invoices still inside
 *     their terms from ageing. It will not collect an old debt, and pretending
 *     otherwise would be the wrong promise to build against.
 *   - A large balance is never chased by template. Above `manualReviewAbove`
 *     the ladder stops and a person is asked to call — a 13m debt answered by
 *     an automated message reads as an insult, and does not work.
 *   - A client holding several unpaid invoices gets one statement, not one
 *     message per invoice. Ten messages in a morning is how a reminder system
 *     turns into a reason to block the number.
 *
 * The ladder is deliberately silent for the first three weeks of a 30-day
 * term. Chasing on day three signals distrust of a customer who is not late,
 * and teaches everyone to ignore the channel before it is needed.
 */

function reminderBody(params: {
  tone: ReminderStage["tone"];
  clientName: string;
  invoiceNumber: string;
  amount: string;
  dueLabel: string;
  companyName: string;
  anchorSource: "delivery-note" | "job-handover" | "issued";
  anchorLabel: string;
}) {
  const { tone, clientName, invoiceNumber, amount, dueLabel, companyName } = params;
  // Naming what the money was for outperforms naming the document: it recalls
  // the value received rather than the obligation, and the customer often
  // walks back through the door, so the wording has to survive meeting them.
  const received =
    params.anchorSource === "issued"
      ? ""
      : ` for the work collected on ${params.anchorLabel}`;

  if (tone === "courtesy") {
    return `Hello ${clientName},\n\nA friendly note that invoice ${invoiceNumber}${received} — ${amount} — falls due on ${dueLabel}.\n\nIf it is already on its way, thank you and please ignore this.\n\n${companyName}`;
  }
  if (tone === "due") {
    return `Hello ${clientName},\n\nInvoice ${invoiceNumber}${received} — ${amount} — is due today, ${dueLabel}.\n\nIf you would like the invoice sent again or need another payment method, just reply to this message.\n\n${companyName}`;
  }
  if (tone === "firm") {
    return `Hello ${clientName},\n\nInvoice ${invoiceNumber}${received} was due on ${dueLabel} and ${amount} is still outstanding.\n\nCould you let us know when payment will be made? If something is wrong with the invoice, tell us and we will put it right.\n\n${companyName}`;
  }
  return `Hello ${clientName},\n\nInvoice ${invoiceNumber} — ${amount} — remains unpaid since ${dueLabel}.\n\nThis is our last automatic reminder; one of our team will follow up personally. If payment has been made, please send us the reference so we can clear it.\n\n${companyName}`;
}

export { REMINDER_LADDER, effectiveDueDate, reminderAnchor, stageDueNow, withinQuietHours };
export type { ReminderStage };

export type ReminderOutcome = {
  invoiceId: string;
  invoiceNumber: string;
  stage: string;
  action: "sent" | "dry-run" | "skipped" | "manual-review" | "statement";
  reason?: string;
};

export async function runPaymentReminders(params: {
  orgId: string;
  now?: Date;
  /** Overrides the stored setting; the cron passes nothing. */
  forceDryRun?: boolean;
}): Promise<ReminderOutcome[]> {
  const now = params.now ?? new Date();
  const settings = await prisma.paymentReminderSettings.findUnique({ where: { orgId: params.orgId } });
  if (!settings?.enabled) return [];
  const dryRun = params.forceDryRun ?? settings.dryRun;

  if (!withinQuietHours(now, settings.quietHourStart, settings.quietHourEnd)) return [];

  const org = await prisma.organization.findUnique({
    where: { id: params.orgId },
    select: { name: true, baseCurrency: true },
  });
  if (!org) return [];

  const invoices = await prisma.invoice.findMany({
    where: { orgId: params.orgId, status: { not: "VOID" } },
    select: {
      id: true,
      invoiceNumber: true,
      issuedAt: true,
      dueDate: true,
      totalAmount: true,
      paidAmount: true,
      currency: true,
      clientId: true,
      client: { select: { id: true, fullName: true, organization: true, phone: true, email: true } },
      job: { select: { deliveredAt: true, completedAt: true } },
      deliveryNotes: { select: { deliveredAt: true }, orderBy: { deliveredAt: "asc" }, take: 1 },
    },
  });

  const outstanding = invoices.filter((i) => i.totalAmount - i.paidAmount > 0.5);
  const perClient = new Map<string, number>();
  for (const i of outstanding) {
    if (i.clientId) perClient.set(i.clientId, (perClient.get(i.clientId) ?? 0) + 1);
  }

  const results: ReminderOutcome[] = [];

  for (const invoice of outstanding) {
    const balance = invoice.totalAmount - invoice.paidAmount;
    const currency = normalizeCurrency(invoice.currency, org.baseCurrency);
    const due = effectiveDueDate(invoice, settings.paymentTermsDays);
    const stage = stageDueNow(due, now);
    const push = (action: ReminderOutcome["action"], reason?: string) =>
      results.push({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, stage: stage?.key ?? "-", action, reason });

    if (!stage) continue;

    if (balance > settings.manualReviewAbove) {
      push("manual-review", `balance ${formatMoney(balance, currency)} is above the automatic ceiling`);
      continue;
    }
    if (settings.statementForMultiInvoice && invoice.clientId && (perClient.get(invoice.clientId) ?? 0) > 1) {
      push("statement", "client holds several unpaid invoices — send one statement instead");
      continue;
    }
    if (!invoice.client) {
      push("skipped", "no client on the invoice");
      continue;
    }

    // Already asked at this rung. The unique-ish guard is the pair
    // (invoice, stage), so a cron running hourly is harmless.
    const already = await prisma.outboundMessage.findFirst({
      where: { orgId: params.orgId, invoiceId: invoice.id, reminderStage: stage.key },
      select: { id: true },
    });
    if (already) continue;

    // One message per invoice per day, whatever the ladder thinks. Two rungs
    // can fall close together and the customer does not care why.
    const sentToday = await prisma.outboundMessage.findFirst({
      where: {
        orgId: params.orgId,
        invoiceId: invoice.id,
        type: OutboundMessageType.INVOICE_REMINDER,
        createdAt: { gte: startOfDay(now) },
      },
      select: { id: true },
    });
    if (sentToday) {
      push("skipped", "already messaged today");
      continue;
    }

    const anchor = reminderAnchor(invoice);
    const body = reminderBody({
      tone: stage.tone,
      clientName: invoice.client.fullName,
      invoiceNumber: invoice.invoiceNumber,
      amount: formatMoney(balance, currency),
      dueLabel: formatEATDocDate(due),
      companyName: org.name,
      anchorSource: anchor.source,
      anchorLabel: formatEATDocDate(anchor.at),
    });

    // One channel, not both. Two copies of the same chase reads as a machine
    // losing track of itself.
    const channel = invoice.client.phone ? "whatsapp" : invoice.client.email ? "email" : null;
    if (!channel) {
      push("skipped", "client has neither phone nor email");
      continue;
    }

    // Checked before the dry-run exit on purpose: a preview that reports a
    // message it could never actually send is worse than no preview, because
    // someone watching it for a fortnight counts it as working.
    if (dryRun) {
      push("dry-run");
      continue;
    }

    const common = {
      orgId: params.orgId,
      invoiceId: invoice.id,
      reminderStage: stage.key,
      type: OutboundMessageType.INVOICE_REMINDER,
    };
    if (channel === "whatsapp") {
      await enqueueWhatsAppMessage({ ...common, to: invoice.client.phone!, body });
    } else {
      await enqueueEmailMessage({
        ...common,
        to: invoice.client.email!,
        subject: `Invoice ${invoice.invoiceNumber} — ${formatMoney(balance, currency)}`,
        body,
      });
    }
    push("sent");
  }

  return results;
}
