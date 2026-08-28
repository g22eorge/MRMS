import { OutboundMessageType } from "@prisma/client";

import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { formatEATDocDate } from "@/lib/date-eat";
import { renderCommunicationTemplate } from "@/lib/notifications/templates";
import { deliverOutboundMessage, enqueueEmailMessage, enqueueWhatsAppMessage } from "@/lib/notifications/whatsapp-outbox";
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
 * reminder feature usually does. On care at the time of writing: 19 unpaid
 * invoices, 6.3m outstanding, of which 5.1m is still inside terms and 2.8m
 * sits on a single client holding ten separate invoices. So:
 *
 *   - This is preventive, not recovery. Eighty-two per cent of the book is
 *     still inside its terms, which is exactly what a ladder can protect. It
 *     will not collect an old debt, and pretending otherwise would be the
 *     wrong promise to build against.
 *   - A client holding several unpaid invoices gets one statement, not one
 *     message per invoice. C-Care IHK holds ten — nearly half the book by
 *     value. Ten messages in a morning is how a reminder system turns into a
 *     reason to block the number.
 *   - A large balance is never chased by template. Above `manualReviewAbove`
 *     the ladder stops and a person is asked to call, because a substantial
 *     debt answered by an automated message reads as an insult and does not
 *     work. No current invoice reaches the default ceiling, so this guard is
 *     deliberate policy rather than something the present book exercises.
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
  // "queued", not "sent": the engine hands the message to the outbox and asks
  // for delivery, but whether the provider accepted it is the outbox row's
  // business. Reporting "sent" here made a run that failed at the provider read
  // as a clean one in the cron summary.
  action: "queued" | "dry-run" | "skipped" | "manual-review" | "statement";
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
    // What this invoice has actually been *delivered*, so the ladder can tell a
    // cold start from a customer who has been climbing it.
    //
    // SENT only, deliberately. A message that failed at the provider — a dead
    // number, a block — was never heard, and counting it would walk someone up
    // the ladder on the strength of messages that never arrived, until the
    // final rung fired at a person who had received nothing. The dedupe below
    // still counts the attempt, so nothing is re-queued; the two guards ask
    // different questions and want different answers.
    const sentStages = (
      await prisma.outboundMessage.findMany({
        where: {
          orgId: params.orgId,
          invoiceId: invoice.id,
          type: OutboundMessageType.INVOICE_REMINDER,
          status: "SENT",
          reminderStage: { not: null },
        },
        select: { reminderStage: true },
      })
    ).map((m) => m.reminderStage!);
    const stage = stageDueNow(due, now, sentStages);
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

    // Already attempted at this rung — attempted, not delivered. A failed
    // message is the retry sweep's to re-send, and queuing a second row for the
    // same rung would mean two copies could both eventually land. This is why
    // it asks a different question from the delivery history above.
    //
    // PREVIEW rows are excluded deliberately. A dry run is a rehearsal, and
    // counting it as the message would mean a fortnight of watching the outbox
    // silently consumed every reminder the customer was owed: the switch to
    // live would then send nothing at all, and look like it was working.
    const already = await prisma.outboundMessage.findFirst({
      where: {
        orgId: params.orgId,
        invoiceId: invoice.id,
        reminderStage: stage.key,
        status: { not: "PREVIEW" },
      },
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
        status: { not: "PREVIEW" },
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

    // WhatsApp will not deliver a free-form business message outside the
    // 24-hour window the customer opens by writing first, and a customer who
    // owes money is quiet by definition — so that window is nearly always shut.
    // Meta accepts the send regardless and returns a message id, which is why
    // the first live run reported five sent and one arrived. An approved
    // template is the only thing that reaches a closed window.
    //
    // Two templates, chosen by which side of the due date we are on, because a
    // template cannot branch and "falls due on" is wrong for July.
    const rendered = await renderCommunicationTemplate({
      orgId: params.orgId,
      key: stage.offsetDays < 0 ? "PAYMENT_REMINDER_UPCOMING" : "PAYMENT_REMINDER_OVERDUE",
      channel: channel === "whatsapp" ? "WHATSAPP" : "EMAIL",
      variables: {
        customerName: invoice.client.fullName,
        companyName: org.name,
        invoiceNumber: invoice.invoiceNumber,
        amount: formatMoney(balance, currency),
        dueLabel: formatEATDocDate(due),
        dueDate: formatEATDocDate(due),
      },
      // No template configured: fall back to the hand-written body rather than
      // sending nothing. Inside an open window it still arrives, and the outbox
      // records which path was taken.
      fallback: { body, subject: `Invoice ${invoice.invoiceNumber} — ${formatMoney(balance, currency)}` },
    });

    const common = {
      orgId: params.orgId,
      invoiceId: invoice.id,
      reminderStage: stage.key,
      type: OutboundMessageType.INVOICE_REMINDER,
      metaTemplateName: rendered.metaTemplateName,
      metaTemplateLanguage: rendered.metaLanguageCode,
      metaTemplateVars: rendered.metaParamValues.length > 0 ? JSON.stringify(rendered.metaParamValues) : null,
    };
    // A dry run writes the message it would have sent, as PREVIEW. Recording
    // nothing would have made the preview unreadable — the settings page
    // promises the outbox can be read for a fortnight before the feature is
    // allowed to speak, and a summary in a cron response is not that.
    if (dryRun) {
      await prisma.outboundMessage.create({
        data: {
          orgId: params.orgId,
          invoiceId: invoice.id,
          reminderStage: stage.key,
          type: OutboundMessageType.INVOICE_REMINDER,
          channel: channel === "whatsapp" ? "WHATSAPP" : "EMAIL",
          status: "PREVIEW",
          to: channel === "whatsapp" ? invoice.client.phone! : invoice.client.email!,
          subject: channel === "email" ? `Invoice ${invoice.invoiceNumber} — ${formatMoney(balance, currency)}` : null,
          body,
        },
      });
      push("dry-run");
      continue;
    }

    // Enqueue then deliver, which is the house pattern every other sender
    // follows. Enqueueing alone only writes a PENDING row; nothing sends it
    // until the retry sweep runs, and that is a daily job — a reminder saying
    // "due today" would have arrived tomorrow.
    const enqueued =
      channel === "whatsapp"
        ? await enqueueWhatsAppMessage({ ...common, to: invoice.client.phone!, body: rendered.body || body })
        : await enqueueEmailMessage({
            ...common,
            to: invoice.client.email!,
            subject: rendered.subject ?? `Invoice ${invoice.invoiceNumber} — ${formatMoney(balance, currency)}`,
            body: rendered.body || body,
          });

    if (enqueued && "outboxId" in enqueued && enqueued.outboxId) {
      // A failure here is not a failure of the run: the row is written, carries
      // its error, and the retry sweep will take it. Throwing would abandon
      // every invoice after this one in the loop.
      await deliverOutboundMessage(enqueued.outboxId).catch(() => null);
    }
    push("queued");
  }

  return results;
}
