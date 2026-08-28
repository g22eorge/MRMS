/**
 * Seeds the two payment-reminder communication templates.
 *
 * WhatsApp only delivers a free-form business message inside a 24-hour window
 * that the customer opens by writing first. Reminders are the worst case for
 * that rule: the people being chased are quiet precisely because they owe
 * money, so the window is almost always shut. Meta accepts the send anyway and
 * returns a message id, so the outbox reads SENT for a message nobody received
 * — which is exactly what happened on the first live run, where one of five
 * arrived.
 *
 * Business-initiated messages outside the window must use a template Meta has
 * approved in advance. Two, not one, because tense matters and a template
 * cannot branch: an invoice that falls due on Friday and one that fell due in
 * July need different sentences, and putting the whole sentence in a variable
 * is the thing Meta rejects templates for.
 *
 * Neither body starts or ends with a variable, which is Meta's other common
 * rejection reason.
 *
 * Seeded INACTIVE by default, and that is the important part. The engine
 * passes metaTemplateName straight to Meta, so a template that exists here but
 * not yet in Meta's approved list makes every send fail — worse than the free
 * form it replaces, which at least reaches customers inside an open window.
 * renderCommunicationTemplate treats an inactive template as absent and falls
 * back, so the rows can sit here safely until approval lands.
 *
 *   node scripts/seed-payment-reminder-templates.mjs                      # local, inactive
 *   node scripts/seed-payment-reminder-templates.mjs --org=ID             # one org
 *   node scripts/seed-payment-reminder-templates.mjs --org=ID --activate  # after Meta approves
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEMPLATES = [
  {
    key: "PAYMENT_REMINDER_UPCOMING",
    label: "Payment reminder (before due)",
    metaTemplateName: "payment_reminder_upcoming_v1",
    body:
      "Hello {customerName}, this is {companyName}. " +
      "Invoice {invoiceNumber} for {amount} falls due on {dueDate}. " +
      "If payment is already on its way, please ignore this message.",
    variables: ["customerName", "companyName", "invoiceNumber", "amount", "dueDate"],
    subject: "Invoice {invoiceNumber} falls due on {dueDate}",
  },
  {
    key: "PAYMENT_REMINDER_OVERDUE",
    label: "Payment reminder (after due)",
    metaTemplateName: "payment_reminder_overdue_v1",
    body:
      "Hello {customerName}, this is {companyName}. " +
      "Invoice {invoiceNumber} for {amount} was due on {dueDate} and is still outstanding. " +
      "Please let us know when payment will be made, or reply if something is wrong with the invoice.",
    variables: ["customerName", "companyName", "invoiceNumber", "amount", "dueDate"],
    subject: "Invoice {invoiceNumber} — {amount} outstanding",
  },
];

const orgArg = process.argv.find((a) => a.startsWith("--org="));
const orgId = orgArg ? orgArg.slice("--org=".length) : null;
const activate = process.argv.includes("--activate");

async function main() {
  const orgs = orgId
    ? [{ id: orgId }]
    : await prisma.organization.findMany({ select: { id: true } });

  for (const org of orgs) {
    for (const t of TEMPLATES) {
      for (const channel of ["WHATSAPP", "EMAIL"]) {
        const existing = await prisma.communicationTemplate.findFirst({
          where: { orgId: org.id, key: t.key, channel },
          select: { id: true },
        });
        const data = {
          key: t.key,
          channel,
          label: t.label,
          subject: channel === "EMAIL" ? t.subject : null,
          body: t.body,
          variables: JSON.stringify(t.variables),
          // Email has no approval gate and no session window, so it carries the
          // text alone; only WhatsApp needs the approved name.
          metaTemplateName: channel === "WHATSAPP" ? t.metaTemplateName : null,
          metaLanguageCode: "en",
          isActive: activate,
          orgId: org.id,
        };
        if (existing) await prisma.communicationTemplate.update({ where: { id: existing.id }, data });
        else await prisma.communicationTemplate.create({ data });
      }
    }
    console.log(
      `[templates] ${org.id}: payment reminder templates seeded ${activate ? "and ACTIVE" : "(inactive — activate once Meta approves)"}`,
    );
  }
}

main()
  .catch((e) => {
    console.error("[templates] failed:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
