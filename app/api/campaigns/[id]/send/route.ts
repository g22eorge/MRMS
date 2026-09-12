import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import { enqueueEmailMessage, enqueueWhatsAppMessage, deliverOutboundMessage } from "@/lib/notifications/whatsapp-outbox";

/**
 * Send a campaign to its pending contacts.
 *
 * The Send button on the campaigns page has always POSTed here and this route
 * has never existed, so every click hit the 404 handler, failed to parse the
 * HTML body as JSON, and showed "Network error". Campaigns could be composed
 * and their contacts enrolled, but never sent — the one thing a campaign is for.
 *
 * Sends go through the outbox rather than the provider directly, for the same
 * reason everything else does: a row exists before delivery is attempted, so a
 * failed send is visible in the outbox instead of vanishing. Delivery is then
 * attempted immediately, because a campaign the operator is watching should not
 * wait for tomorrow's retry sweep.
 *
 * SMS and CALL campaigns are recorded but not dispatched: this system has no
 * SMS provider and a call is a person's job. They are counted as skipped and
 * named in the response rather than being silently marked sent, which would
 * tell the operator a customer had been contacted when nobody had.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, orgId, org } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  // Same gate as the campaigns page itself.
  if (!["ADMIN", "OPS"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id, orgId },
    select: { id: true, name: true, type: true, subject: true, body: true, status: true },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (campaign.status === "CANCELLED" || campaign.status === "COMPLETED") {
    return NextResponse.json({ error: `This campaign is ${campaign.status.toLowerCase()}` }, { status: 400 });
  }

  const contacts = await prisma.campaignContact.findMany({
    where: { campaignId: campaign.id, orgId, status: "PENDING" },
    select: {
      id: true,
      lead: { select: { fullName: true, phone: true, email: true } },
      client: { select: { fullName: true, phone: true, email: true } },
    },
  });
  if (contacts.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, failed: 0, errors: ["Nothing pending"] });
  }

  if (campaign.type === "SMS" || campaign.type === "CALL") {
    return NextResponse.json({
      sent: 0,
      skipped: contacts.length,
      failed: 0,
      errors: [`${campaign.type} campaigns are not dispatched by the system — work this list by hand.`],
    });
  }

  let sent = 0, skipped = 0, failed = 0;
  const errors: string[] = [];
  const note = (msg: string) => { if (errors.length < 5) errors.push(msg); };

  for (const contact of contacts) {
    const person = contact.client ?? contact.lead;
    const name = person?.fullName ?? "there";
    // {name} is the one substitution the composer documents; leaving the raw
    // token in a customer's message is worse than sending it unpersonalised.
    const body = campaign.body.replaceAll("{name}", name);

    const to = campaign.type === "EMAIL" ? person?.email : person?.phone;
    if (!to) {
      skipped += 1;
      note(`${name}: no ${campaign.type === "EMAIL" ? "email address" : "phone number"} on record`);
      continue;
    }

    try {
      const row = campaign.type === "EMAIL"
        ? await enqueueEmailMessage({
            orgId, to, subject: campaign.subject || campaign.name, body, type: "CAMPAIGN_MESSAGE",
          })
        : await enqueueWhatsAppMessage({ orgId, to, body, type: "CAMPAIGN_MESSAGE" });

      // enqueue returns outboxId only when a row was written; without the
      // outbox schema it has already sent directly and there is nothing to
      // deliver a second time.
      if ("outboxId" in row && row.outboxId) await deliverOutboundMessage(row.outboxId);
      await prisma.campaignContact.update({
        where: { id: contact.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      sent += 1;
    } catch (err) {
      // One unreachable contact must not abandon the rest of the list.
      failed += 1;
      note(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (sent > 0 && campaign.status === "DRAFT") {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "ACTIVE", startedAt: new Date() },
    });
  }

  return NextResponse.json({ sent, skipped, failed, errors });
}
