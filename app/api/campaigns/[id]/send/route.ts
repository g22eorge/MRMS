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

  // Bounded batch: a campaign can hold thousands of contacts, so each send
  // works the next slice and reports how many are left. Delivery within the
  // slice runs in small parallel chunks instead of one serial chain.
  const BATCH_SIZE = 200;
  const CHUNK_SIZE = 10;

  const contacts = await prisma.campaignContact.findMany({
    where: { campaignId: campaign.id, orgId, status: "PENDING" },
    select: {
      id: true,
      lead: { select: { fullName: true, phone: true, email: true } },
      client: { select: { fullName: true, phone: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE + 1,
  });
  if (contacts.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, failed: 0, errors: ["Nothing pending"] });
  }
  const batch = contacts.slice(0, BATCH_SIZE);
  const remaining = contacts.length > BATCH_SIZE;

  // Captured for the sendOne closure (narrowing doesn't cross it).
  const campaignBody = campaign.body;
  const campaignType = campaign.type;
  const campaignSubject = campaign.subject || campaign.name;

  if (campaign.type === "SMS" || campaign.type === "CALL") {
    return NextResponse.json({
      sent: 0,
      skipped: batch.length,
      failed: 0,
      errors: [`${campaign.type} campaigns are not dispatched by the system — work this list by hand.`],
    });
  }

  let sent = 0, skipped = 0, failed = 0;
  const errors: string[] = [];
  const note = (msg: string) => { if (errors.length < 5) errors.push(msg); };

  async function sendOne(contact: (typeof batch)[number]) {
    const person = contact.client ?? contact.lead;
    const name = person?.fullName ?? "there";
    // {name} is the one substitution the composer documents; leaving the raw
    // token in a customer's message is worse than sending it unpersonalised.
    const body = campaignBody.replaceAll("{name}", name);

    const to = campaignType === "EMAIL" ? person?.email : person?.phone;
    if (!to) {
      return { outcome: "skipped" as const, note: `${name}: no ${campaignType === "EMAIL" ? "email address" : "phone number"} on record` };
    }

    try {
      const row = campaignType === "EMAIL"
        ? await enqueueEmailMessage({
            orgId, to, subject: campaignSubject, body, type: "CAMPAIGN_MESSAGE",
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
      return { outcome: "sent" as const };
    } catch (err) {
      // One unreachable contact must not abandon the rest of the list.
      return { outcome: "failed" as const, note: `${name}: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
    const results = await Promise.allSettled(batch.slice(i, i + CHUNK_SIZE).map(sendOne));
    for (const r of results) {
      if (r.status === "fulfilled") {
        if (r.value.outcome === "sent") sent += 1;
        else if (r.value.outcome === "skipped") { skipped += 1; if (r.value.note) note(r.value.note); }
        else { failed += 1; if (r.value.note) note(r.value.note); }
      } else {
        failed += 1;
        note(r.reason instanceof Error ? r.reason.message : String(r.reason));
      }
    }
  }

  if (sent > 0 && campaign.status === "DRAFT") {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "ACTIVE", startedAt: new Date() },
    });
  }

  return NextResponse.json({ sent, skipped, failed, remaining, errors });
}
