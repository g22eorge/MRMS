import { prisma } from "@/lib/prisma";
import { JobStatus, NotificationChannel, NotificationType, OutboundMessageType, Prisma } from "@prisma/client";

import { formatMoney } from "@/lib/currency";
import { EIS_ORG_ID } from "@/lib/org";
import { normalizeJobStatus, type JobStatus as LegacyJobStatus } from "@/lib/job-status";
import { renderCommunicationTemplate } from "@/lib/notifications/templates";
import { deliverOutboundMessage, enqueueEmailMessage, enqueueWhatsAppMessage } from "@/lib/notifications/whatsapp-outbox";
import { sendCustomWhatsAppMessage } from "@/lib/notifications/whatsapp";

interface CreateNotificationParams {
  orgId: string;
  type: NotificationType;
  title: string;
  message: string;
  jobId?: string;
  userId?: string;
  channel?: NotificationChannel;
}

export async function createNotification({
  orgId,
  type,
  title,
  message,
  jobId,
  userId,
  channel = NotificationChannel.DASHBOARD,
}: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      type,
      title,
      message,
      jobId,
      userId,
      channel,
      orgId,
    },
  });
}

export async function createNotificationsForRole({
  orgId,
  type,
  title,
  message,
  jobId,
  roles,
}: {
  orgId: string;
  type: NotificationType;
  title: string;
  message: string;
  jobId?: string;
  roles: ("ADMIN" | "OPS" | "TECHNICIAN_INTERNAL" | "TECHNICIAN_EXTERNAL")[];
}) {
  const users = await prisma.user.findMany({
    where: {
      orgId,
      role: { in: roles },
      isActive: true,
    },
    select: { id: true },
  });

  if (users.length === 0) return;

  await prisma.notification.createMany({
    data: users.map((user) => ({
      type,
      title,
      message,
      jobId,
      userId: user.id,
      channel: NotificationChannel.DASHBOARD,
      orgId,
    })),
  });
}

export async function getUnreadNotifications(userId: string, limit = 20, opts?: { includeClient?: boolean }) {
  const includeClient = opts?.includeClient ?? false;
  return prisma.notification.findMany({
    where: {
      userId,
      isRead: false,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      job: {
        select: {
          id: true,
          jobNumber: true,
          ...(includeClient ? { client: { select: { fullName: true, phone: true, organization: true } } } : {}),
        },
      },
    },
  });
}

export async function getAllNotifications(userId: string, limit = 50, opts?: { includeClient?: boolean }) {
  const includeClient = opts?.includeClient ?? false;
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      job: {
        select: {
          id: true,
          jobNumber: true,
          ...(includeClient ? { client: { select: { fullName: true, phone: true, organization: true } } } : {}),
        },
      },
    },
  });
}

export async function markNotificationAsRead(userId: string, notificationId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

export async function markAllNotificationsAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
}

export async function getUserPreferences(userId: string) {
  let prefs = await prisma.notificationPreferences.findUnique({
    where: { userId },
  });

  if (!prefs) {
    prefs = await prisma.notificationPreferences.create({
      data: { userId },
    });
  }

  return prefs;
}

export async function updateUserPreferences(
  userId: string,
  data: {
    notifyStatusChange?: boolean;
    notifyApprovalNeeded?: boolean;
    notifyJobAssigned?: boolean;
    notifyEstimateSubmitted?: boolean;
    notifyPaymentReceived?: boolean;
    notifyPayoutGenerated?: boolean;
    notifyTimelineUpdated?: boolean;
    notifyDelayNote?: boolean;
    whatsappEnabled?: boolean;
    emailEnabled?: boolean;
    notifyStockAlert?: boolean;
    notifyJobCreated?: boolean;
    notifyRepairRequest?: boolean;
    notifyQuotationStatus?: boolean;
    notifyLeadStatus?: boolean;
    notifyPurchaseRequest?: boolean;
    notifyStockMovement?: boolean;
    notifyFieldVisit?: boolean;
    notifyCreditNote?: boolean;
  }
) {
  return prisma.notificationPreferences.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

export async function notifyStatusChange(
  orgId: string,
  jobId: string,
  oldStatus: JobStatus,
  newStatus: JobStatus,
  jobNumber: string,
  clientName: string
) {
  // Best-effort: cancel READY_FOR_PICKUP nudges when the status changes away.
  if (oldStatus === JobStatus.READY_FOR_PICKUP && newStatus !== JobStatus.READY_FOR_PICKUP) {
    await cancelReadyForPickupNudges(jobId, "BOTH");
  }

  const prefs = await getUserPreferencesForRoles(orgId, ["ADMIN", "OPS"]);
  const targetRoles = prefs.filter((p) => p.notifyStatusChange).map((p) => p.userId);
  const title = "Status Changed";
  const message = `Job ${jobNumber} (${clientName}) status changed from ${oldStatus.replaceAll("_", " ")} to ${newStatus.replaceAll("_", " ")}`;

  const policy = await getCommunicationPolicyForStatus(orgId, newStatus);
  const dashboardEnabled = policy?.dashboardEnabled ?? true;

  if (dashboardEnabled && targetRoles.length > 0) {
    await prisma.notification.createMany({
      data: targetRoles.map((userId) => ({
        type: NotificationType.STATUS_CHANGE,
        title,
        message,
        jobId,
        userId,
        channel: NotificationChannel.DASHBOARD,
        orgId,
      })),
    });
  }

  // If the status policy enables WhatsApp, use that policy's template.
  // Otherwise, preserve the preference-gated client status update through the outbox
  // so every triggered client status message is visible in the job thread.
  if (policy?.whatsappEnabled) {
    await sendClientWhatsAppForStatusChange({ orgId, jobId, jobNumber, oldStatus, newStatus, templateKey: policy.templateKey ?? null });
    if (newStatus === JobStatus.READY_FOR_PICKUP) {
      await scheduleReadyForPickupNudges({
        orgId,
        jobId,
        jobNumber,
        nudge1Hours: policy.nudge1Hours,
        nudge2Hours: policy.nudge2Hours,
        templateKey: policy.templateKey ?? null,
      });
    }
  } else if (prefs.some((p) => p.whatsappEnabled)) {
    await sendClientWhatsAppForStatusChange({ orgId, jobId, jobNumber, oldStatus, newStatus, templateKey: null });
  }

  // Email: status-change messages and optional nudges.
  if (policy?.emailEnabled) {
    await sendClientEmailForStatusChange({ orgId, jobId, jobNumber, oldStatus, newStatus, templateKey: policy.templateKey ?? null });
    if (newStatus === JobStatus.READY_FOR_PICKUP) {
      await scheduleReadyForPickupEmailNudges({
        orgId,
        jobId,
        jobNumber,
        nudge1Hours: policy.nudge1Hours,
        nudge2Hours: policy.nudge2Hours,
        templateKey: policy.templateKey ?? null,
      });
    }
  }
}

function supportsCommunicationPolicy() {
  return Boolean(Prisma.dmmf.datamodel.models.find((m) => m.name === "CommunicationPolicy"));
}

async function getCommunicationPolicyForStatus(orgId: string, status: JobStatus) {
  if (!supportsCommunicationPolicy()) return null;
  try {
    const normalized = normalizeJobStatus(status as unknown as LegacyJobStatus);
    return (
      (await prisma.communicationPolicy.findFirst({ where: { orgId, status: normalized as JobStatus } })) ??
      (await prisma.communicationPolicy.findFirst({ where: { orgId: null, status: normalized as JobStatus } }))
    );
  } catch {
    // If the table isn't migrated yet, silently fall back.
    return null;
  }
}

function isOutboundMessageType(value: string): value is OutboundMessageType {
  return (Object.values(OutboundMessageType) as string[]).includes(value);
}

function defaultTemplateKeyForStatus(status: JobStatus): OutboundMessageType {
  // READY_FOR_PICKUP nudges are scheduled separately; the status-change notice should be a single message.
  if (status === JobStatus.READY_FOR_PICKUP) return OutboundMessageType.JOB_STATUS_UPDATE;
  if (status === JobStatus.COMPLETED) return OutboundMessageType.JOB_COMPLETED;
  return OutboundMessageType.JOB_STATUS_UPDATE;
}

function nudge2KeyFrom(nudge1Key: string): string {
  if (nudge1Key.endsWith("_NUDGE_1")) return nudge1Key.replace(/_NUDGE_1$/, "_NUDGE_2");
  return nudge1Key;
}

// Eagle Info Solutions' Google review link. Used as the default for the care
// rollout — safe to hold in code because the reviewUrl below is gated to the
// EIS org, so it can never be sent for any other tenant. GOOGLE_REVIEW_URL
// overrides it. When commercial orgs get reviews, move this to a per-org
// branding setting and drop the org gate.
const EIS_GOOGLE_REVIEW_URL = "https://g.page/EagleInfoSolutions/review?rc";

/**
 * Links appended to a client status update.
 * - complaintUrl: the public complaint form, job number pre-filled (no login).
 *   Built from NEXT_PUBLIC_APP_URL; omitted when that isn't configured.
 * - reviewUrl: a Google review ask, ONLY on completion (COMPLETED/CLOSED) and —
 *   for now — ONLY for Eagle's own repair business (scoped by org id so it can
 *   never leak into another tenant's messages). Generalise to a per-org branding
 *   setting when rolling out to commercial orgs.
 */
function statusMessageLinks(orgId: string, jobNumber: string, newStatus: JobStatus) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || process.env.APP_URL?.replace(/\/$/, "");
  // Keep the ref human-readable in the link: encode the genuinely unsafe
  // characters but leave "/" literal (it's valid in a query value), so a job
  // number like EIS-3/2025/0042 reads cleanly instead of EIS-3%2F2025%2F0042.
  // /feedback reads params.ref back verbatim, so the DB lookup still matches.
  const ref = encodeURIComponent(jobNumber).replace(/%2F/gi, "/");
  const complaintUrl = appUrl ? `${appUrl}/feedback?ref=${ref}` : "";
  const isServiceDone = newStatus === JobStatus.COMPLETED || newStatus === JobStatus.CLOSED;
  const reviewUrl = isServiceDone && orgId === EIS_ORG_ID
    ? (process.env.GOOGLE_REVIEW_URL?.trim() || EIS_GOOGLE_REVIEW_URL)
    : "";
  return { complaintUrl, reviewUrl };
}

/**
 * Append the review/complaint links to a rendered message body when they aren't
 * already present. These links are a care-level footer, so they must survive
 * whether the body came from a custom CommunicationTemplate or the built-in
 * fallback: a template that never references {complaintUrl}/{reviewUrl} would
 * otherwise silently drop them (the fallback carries them, but a resolved
 * template pre-empts the fallback). A link already in the body — a custom
 * template that opts in — is skipped so it isn't duplicated.
 */
function appendClientLinks(body: string, complaintUrl: string, reviewUrl: string): string {
  const extra: string[] = [];
  if (reviewUrl && !body.includes(reviewUrl)) {
    extra.push(`Enjoyed our service? A quick Google review means a lot: ${reviewUrl}`);
  }
  if (complaintUrl && !body.includes(complaintUrl)) {
    extra.push(`${reviewUrl ? "Something not right? Tell us" : "Not happy with something? Let us know"}: ${complaintUrl}`);
  }
  if (extra.length === 0) return body;
  return `${body.trimEnd()}\n\n${extra.join("\n\n")}`;
}

async function sendClientWhatsAppForStatusChange(input: {
  orgId: string;
  jobId: string;
  jobNumber: string;
  oldStatus: JobStatus;
  newStatus: JobStatus;
  templateKey: string | null;
}) {
  const client = await prisma.client
    .findFirst({
      where: { orgId: input.orgId, jobs: { some: { id: input.jobId } } },
      select: { phone: true, fullName: true },
    })
    .catch(() => null);

  if (!client?.phone) return;

  const templateKey = input.templateKey ?? defaultTemplateKeyForStatus(input.newStatus);
  const type: OutboundMessageType = isOutboundMessageType(templateKey)
    ? (templateKey as OutboundMessageType)
    : OutboundMessageType.JOB_STATUS_UPDATE;

  const { complaintUrl, reviewUrl } = statusMessageLinks(input.orgId, input.jobNumber, input.newStatus);

  // On completion we offer both — a review if they're happy, a complaint if not
  // (honest routing, not review-gating). Mid-repair updates carry just the
  // complaint link.
  const blocks = [`Hi ${client.fullName}, update on job ${input.jobNumber}: status is now ${input.newStatus.replaceAll("_", " ")}.`];
  if (reviewUrl) blocks.push(`Enjoyed our service? A quick Google review means a lot: ${reviewUrl}`);
  if (complaintUrl) blocks.push(`${reviewUrl ? "Something not right? Tell us" : "Not happy with something? Let us know"}: ${complaintUrl}`);
  blocks.push("- Your Repair Team");
  const fallback = blocks.join("\n\n");

  const templateVars = {
    customerName: client.fullName,
    jobNumber: input.jobNumber,
    oldStatus: input.oldStatus,
    newStatus: input.newStatus,
    oldStatusLabel: input.oldStatus.replaceAll("_", " "),
    newStatusLabel: input.newStatus.replaceAll("_", " "),
    // Available to custom/policy templates as {{complaintUrl}} / {{reviewUrl}}.
    complaintUrl,
    reviewUrl,
  };

  const rendered = await renderCommunicationTemplate({
    orgId: input.orgId,
    key: templateKey,
    channel: "WHATSAPP",
    variables: templateVars,
    fallback: { body: fallback },
  });

  const body = appendClientLinks(rendered.body, complaintUrl, reviewUrl);

  const enqueueResult = await enqueueWhatsAppMessage({
    orgId: input.orgId,
    to: client.phone,
    body,
    type,
    jobId: input.jobId,
    provider: "meta",
    templateKey,
    templateVars: JSON.stringify(templateVars),
    metaTemplateName: rendered.metaTemplateName,
    metaTemplateLanguage: rendered.metaLanguageCode,
    metaTemplateVars: rendered.metaParamValues.length > 0 ? JSON.stringify(rendered.metaParamValues) : null,
  }).catch(() => null);

  if (enqueueResult && "outboxId" in enqueueResult && enqueueResult.outboxId) {
    await deliverOutboundMessage(enqueueResult.outboxId).catch(() => null);
  }
}

/**
 * Send the client a WhatsApp confirmation when their payment is recorded.
 * Enqueues through the outbox (so it's visible on the job Messages tab even if
 * delivery fails) and links to the job/org. Best-effort — never throws.
 */
async function sendClientPaymentConfirmation(input: {
  orgId: string;
  jobId: string;
  jobNumber: string;
  amount: number;
  currency: string;
}) {
  const client = await prisma.client
    .findFirst({
      where: { orgId: input.orgId, jobs: { some: { id: input.jobId } } },
      select: { phone: true, fullName: true },
    })
    .catch(() => null);

  if (!client?.phone) return;

  const body = `Hi ${client.fullName}, we've received your payment of ${input.currency} ${input.amount.toLocaleString()} for job ${input.jobNumber}. Thank you! — Your Repair Team`;

  const enqueueResult = await enqueueWhatsAppMessage({
    orgId: input.orgId,
    to: client.phone,
    body,
    type: OutboundMessageType.JOB_STATUS_UPDATE,
    jobId: input.jobId,
    provider: "meta",
  }).catch(() => null);

  if (enqueueResult && "outboxId" in enqueueResult && enqueueResult.outboxId) {
    await deliverOutboundMessage(enqueueResult.outboxId).catch(() => null);
  }
}

async function cancelReadyForPickupNudges(jobId: string, scope: "WHATSAPP" | "EMAIL" | "BOTH") {
  try {
    await prisma.outboundMessage.updateMany({
      where: {
        jobId,
        channel: scope === "BOTH" ? { in: ["WHATSAPP", "EMAIL"] } : scope,
        status: { in: ["PENDING", "FAILED"] },
        type: { in: [OutboundMessageType.READY_FOR_PICKUP_NUDGE_1, OutboundMessageType.READY_FOR_PICKUP_NUDGE_2] },
      },
      data: {
        status: "DEAD",
        nextAttemptAt: new Date(0),
        lockedAt: null,
      },
    });
  } catch {
    // Ignore: table may not exist yet.
  }
}

async function scheduleReadyForPickupNudges(input: {
  orgId: string;
  jobId: string;
  jobNumber: string;
  nudge1Hours: number | null;
  nudge2Hours: number | null;
  templateKey: string | null;
}) {
  const n1 = typeof input.nudge1Hours === "number" && input.nudge1Hours > 0 ? input.nudge1Hours : null;
  const n2 = typeof input.nudge2Hours === "number" && input.nudge2Hours > 0 ? input.nudge2Hours : null;
  if (!n1 && !n2) return;

  const client = await prisma.client
    .findFirst({
      where: { orgId: input.orgId, jobs: { some: { id: input.jobId } } },
      select: { phone: true, fullName: true },
    })
    .catch(() => null);

  if (!client?.phone) return;

  // De-dupe: remove any existing pending/failed nudges for this job.
  await cancelReadyForPickupNudges(input.jobId, "WHATSAPP");

  // Nudges always use the dedicated nudge templates.
  const key1 = input.templateKey ? input.templateKey : OutboundMessageType.READY_FOR_PICKUP_NUDGE_1;
  const key2 = input.templateKey ? nudge2KeyFrom(input.templateKey) : OutboundMessageType.READY_FOR_PICKUP_NUDGE_2;

  const nudgeVars = { customerName: client.fullName, jobNumber: input.jobNumber };

  const makeRendered = async (key: string) => {
    const fallback = `Hi ${client.fullName}, your device for job ${input.jobNumber} is ready for pickup. Please visit us to collect it. - Your Repair Team`;
    return renderCommunicationTemplate({
      orgId: input.orgId,
      key,
      channel: "WHATSAPP",
      variables: nudgeVars,
      fallback: { body: fallback },
    });
  };

  if (n1) {
    const rendered = await makeRendered(key1);
    await enqueueWhatsAppMessage({
      orgId: input.orgId,
      to: client.phone,
      body: rendered.body,
      type: OutboundMessageType.READY_FOR_PICKUP_NUDGE_1,
      jobId: input.jobId,
      provider: "meta",
      nextAttemptAt: new Date(Date.now() + n1 * 60 * 60 * 1000),
      templateKey: key1,
      templateVars: JSON.stringify(nudgeVars),
      metaTemplateName: rendered.metaTemplateName,
      metaTemplateLanguage: rendered.metaLanguageCode,
      metaTemplateVars: rendered.metaParamValues.length > 0 ? JSON.stringify(rendered.metaParamValues) : null,
    }).catch(() => null);
  }

  if (n2) {
    const rendered = await makeRendered(key2);
    await enqueueWhatsAppMessage({
      orgId: input.orgId,
      to: client.phone,
      body: rendered.body,
      type: OutboundMessageType.READY_FOR_PICKUP_NUDGE_2,
      jobId: input.jobId,
      provider: "meta",
      nextAttemptAt: new Date(Date.now() + n2 * 60 * 60 * 1000),
      templateKey: key2,
      templateVars: JSON.stringify(nudgeVars),
      metaTemplateName: rendered.metaTemplateName,
      metaTemplateLanguage: rendered.metaLanguageCode,
      metaTemplateVars: rendered.metaParamValues.length > 0 ? JSON.stringify(rendered.metaParamValues) : null,
    }).catch(() => null);
  }
}

async function sendClientEmailForStatusChange(input: {
  orgId: string;
  jobId: string;
  jobNumber: string;
  oldStatus: JobStatus;
  newStatus: JobStatus;
  templateKey: string | null;
}) {
  const client = await prisma.client
    .findFirst({
      where: { orgId: input.orgId, jobs: { some: { id: input.jobId } } },
      select: { email: true, fullName: true },
    })
    .catch(() => null);

  if (!client?.email) return;

  const templateKey = input.templateKey ?? defaultTemplateKeyForStatus(input.newStatus);
  const type: OutboundMessageType = isOutboundMessageType(templateKey)
    ? (templateKey as OutboundMessageType)
    : OutboundMessageType.JOB_STATUS_UPDATE;

  const { complaintUrl, reviewUrl } = statusMessageLinks(input.orgId, input.jobNumber, input.newStatus);

  const vars = {
    customerName: client.fullName,
    jobNumber: input.jobNumber,
    oldStatus: input.oldStatus,
    newStatus: input.newStatus,
    oldStatusLabel: input.oldStatus.replaceAll("_", " "),
    newStatusLabel: input.newStatus.replaceAll("_", " "),
    // Available to custom/policy templates as {{complaintUrl}} / {{reviewUrl}}.
    complaintUrl,
    reviewUrl,
  };

  const fallbackSubject = `Update on Job #${input.jobNumber}`;
  const bodyBlocks = [`Hello ${client.fullName},`, `Update on Job #${input.jobNumber}: status is now ${vars.newStatusLabel}.`];
  if (reviewUrl) bodyBlocks.push(`Enjoyed our service? A quick Google review means a lot: ${reviewUrl}`);
  if (complaintUrl) bodyBlocks.push(`${reviewUrl ? "Something not right? Tell us: " : "Not happy with something? Let us know: "}${complaintUrl}`);
  bodyBlocks.push("Your Repair Team");
  const fallbackBody = bodyBlocks.join("\n\n");

  const rendered = await renderCommunicationTemplate({
    orgId: input.orgId,
    key: templateKey,
    channel: "EMAIL",
    variables: vars,
    fallback: { subject: fallbackSubject, body: fallbackBody },
  });

  const body = appendClientLinks(rendered.body, complaintUrl, reviewUrl);

  const enqueueResult = await enqueueEmailMessage({
    orgId: input.orgId,
    to: client.email,
    subject: rendered.subject ?? fallbackSubject,
    body,
    type,
    jobId: input.jobId,
    templateKey,
    templateVars: JSON.stringify(vars),
  }).catch(() => null);

  if (enqueueResult && "outboxId" in enqueueResult && enqueueResult.outboxId) {
    await deliverOutboundMessage(enqueueResult.outboxId).catch(() => null);
  }
}

async function scheduleReadyForPickupEmailNudges(input: {
  orgId: string;
  jobId: string;
  jobNumber: string;
  nudge1Hours: number | null;
  nudge2Hours: number | null;
  templateKey: string | null;
}) {
  const n1 = typeof input.nudge1Hours === "number" && input.nudge1Hours > 0 ? input.nudge1Hours : null;
  const n2 = typeof input.nudge2Hours === "number" && input.nudge2Hours > 0 ? input.nudge2Hours : null;
  if (!n1 && !n2) return;

  const client = await prisma.client
    .findFirst({
      where: { orgId: input.orgId, jobs: { some: { id: input.jobId } } },
      select: { email: true, fullName: true },
    })
    .catch(() => null);

  if (!client?.email) return;

  // De-dupe: remove any existing pending/failed nudges for this job.
  await cancelReadyForPickupNudges(input.jobId, "EMAIL");

  const baseKey = input.templateKey ?? OutboundMessageType.READY_FOR_PICKUP_NUDGE_1;
  const key1 = baseKey;
  const key2 = input.templateKey ? nudge2KeyFrom(baseKey) : OutboundMessageType.READY_FOR_PICKUP_NUDGE_2;

  const makeEmail = async (key: string) => {
    const fallbackSubject = `Pickup Reminder: Job #${input.jobNumber}`;
    const fallbackBody = `Hello ${client.fullName},\n\nReminder: your device for job ${input.jobNumber} is ready for pickup.\n\nYour Repair Team`;
    const rendered = await renderCommunicationTemplate({
      orgId: input.orgId,
      key,
      channel: "EMAIL",
      variables: { customerName: client.fullName, jobNumber: input.jobNumber },
      fallback: { subject: fallbackSubject, body: fallbackBody },
    });
    return { subject: rendered.subject ?? fallbackSubject, body: rendered.body };
  };

  if (n1) {
    const msg = await makeEmail(key1);
    await enqueueEmailMessage({
      orgId: input.orgId,
      to: client.email,
      subject: msg.subject,
      body: msg.body,
      type: OutboundMessageType.READY_FOR_PICKUP_NUDGE_1,
      jobId: input.jobId,
      nextAttemptAt: new Date(Date.now() + n1 * 60 * 60 * 1000),
      templateKey: key1,
      templateVars: JSON.stringify({ customerName: client.fullName, jobNumber: input.jobNumber }),
    }).catch(() => null);
  }

  if (n2) {
    const msg = await makeEmail(key2);
    await enqueueEmailMessage({
      orgId: input.orgId,
      to: client.email,
      subject: msg.subject,
      body: msg.body,
      type: OutboundMessageType.READY_FOR_PICKUP_NUDGE_2,
      jobId: input.jobId,
      nextAttemptAt: new Date(Date.now() + n2 * 60 * 60 * 1000),
      templateKey: key2,
      templateVars: JSON.stringify({ customerName: client.fullName, jobNumber: input.jobNumber }),
    }).catch(() => null);
  }
}

export async function notifyApprovalNeeded(
  orgId: string,
  jobId: string,
  jobNumber: string,
  clientName: string,
  costEstimate: number
) {
  const prefs = await getUserPreferencesForRoles(orgId, ["ADMIN", "OPS"]);
  const targetRoles = prefs.filter((p) => p.notifyApprovalNeeded).map((p) => p.userId);
  const title = "Approval Needed";
  const message = `Job ${jobNumber} (${clientName}) requires approval. Estimated cost: ${formatMoney(costEstimate)}`;

  if (targetRoles.length > 0) {
    await prisma.notification.createMany({
      data: targetRoles.map((userId) => ({
        type: NotificationType.APPROVAL_NEEDED,
        title,
        message,
        jobId,
        userId,
        channel: NotificationChannel.DASHBOARD,
        orgId,
      })),
    });
  }

  const client = await prisma.client.findFirst({
    where: { orgId, jobs: { some: { id: jobId } } },
    select: { phone: true, fullName: true },
  });

  if (client?.phone && prefs.some((p) => p.whatsappEnabled)) {
    await sendCustomWhatsAppMessage(
      client.phone,
      `Hi ${client.fullName}, your repair for job ${jobNumber} is ready. Estimated cost: ${formatMoney(costEstimate)}. Please confirm to proceed. - Your Repair Team`
    );
  }
}

async function getUserPreferencesForRoles(
  orgId: string,
  roles: Array<"ADMIN" | "OPS" | "TECHNICIAN_INTERNAL" | "TECHNICIAN_EXTERNAL" | "FRONT_DESK">,
) {
  const users = await prisma.user.findMany({
    where: { orgId, role: { in: roles }, isActive: true },
    select: { id: true },
  });
  if (users.length === 0) {
    return [] as Array<{
      userId: string;
      whatsappEnabled: boolean;
      notifyStatusChange: boolean;
      notifyApprovalNeeded: boolean;
      notifyEstimateSubmitted: boolean;
      notifyTimelineUpdated: boolean;
      notifyDelayNote: boolean;
    }>;
  }

  const prefs = await prisma.notificationPreferences.findMany({
    where: { userId: { in: users.map((u) => u.id) } },
    select: {
      userId: true,
      whatsappEnabled: true,
      notifyStatusChange: true,
      notifyApprovalNeeded: true,
      notifyEstimateSubmitted: true,
      notifyTimelineUpdated: true,
      notifyDelayNote: true,
    },
  });

  const prefMap = new Map(prefs.map((p) => [p.userId, p]));
  return users.map((u) =>
    prefMap.get(u.id) ?? {
      userId: u.id,
      whatsappEnabled: true,
      notifyStatusChange: true,
      notifyApprovalNeeded: true,
      notifyEstimateSubmitted: true,
      notifyTimelineUpdated: true,
      notifyDelayNote: true,
    },
  );
}

export async function notifyJobAssigned(
  orgId: string,
  jobId: string,
  jobNumber: string,
  deviceInfo: string,
  technicianId: string
) {
  const title = "Job Assigned";
  const message = `You've been assigned job ${jobNumber} - ${deviceInfo}`;

  await createNotification({
    orgId,
    type: NotificationType.JOB_ASSIGNED,
    title,
    message,
    jobId,
    userId: technicianId,
  });
}

export async function notifyEstimateSubmitted(
  orgId: string,
  jobId: string,
  jobNumber: string,
  deviceInfo: string,
  estimatedCost: number
) {
  const prefs = await getUserPreferencesForRoles(orgId, ["ADMIN", "OPS"]);
  const targets = prefs.filter((p) => p.notifyEstimateSubmitted).map((p) => p.userId);
  const title = "Estimate Submitted";
  const message = `External tech submitted estimate for job ${jobNumber} (${deviceInfo}) - ${formatMoney(estimatedCost)}`;

  if (targets.length > 0) {
    await prisma.notification.createMany({
      data: targets.map((userId) => ({
        type: NotificationType.ESTIMATE_SUBMITTED,
        title,
        message,
        jobId,
        userId,
        channel: NotificationChannel.DASHBOARD,
        orgId,
      })),
    });
  }
}

export async function notifyTimelineUpdate(
  orgId: string,
  jobId: string,
  jobNumber: string,
  deviceInfo: string,
  newTimeline: string
) {
  const prefs = await getUserPreferencesForRoles(orgId, ["ADMIN", "OPS"]);
  const targets = prefs.filter((p) => p.notifyTimelineUpdated).map((p) => p.userId);
  const title = "Timeline Updated";
  const message = `Job ${jobNumber} (${deviceInfo}) timeline updated: ${newTimeline}`;

  if (targets.length > 0) {
    await prisma.notification.createMany({
      data: targets.map((userId) => ({
        type: NotificationType.TIMELINE_UPDATED,
        title,
        message,
        jobId,
        userId,
        channel: NotificationChannel.DASHBOARD,
        orgId,
      })),
    });
  }
}

export async function notifyDelayNote(
  orgId: string,
  jobId: string,
  jobNumber: string,
  deviceInfo: string,
  note: string
) {
  const prefs = await getUserPreferencesForRoles(orgId, ["ADMIN", "OPS"]);
  const targets = prefs.filter((p) => p.notifyDelayNote).map((p) => p.userId);
  const title = "Delay Note Added";
  const message = `Job ${jobNumber} (${deviceInfo}) delay: ${note}`;

  if (targets.length > 0) {
    await prisma.notification.createMany({
      data: targets.map((userId) => ({
        type: NotificationType.DELAY_NOTE_ADDED,
        title,
        message,
        jobId,
        userId,
        channel: NotificationChannel.DASHBOARD,
        orgId,
      })),
    });
  }
}

// ---------------------------------------------------------------------------
// Stock level alerts — STOCK_LOW and STOCK_OUT
// Fires when qty crosses a threshold. Suppresses duplicates: won't re-fire
// the same level while stock hasn't recovered above it since the last alert.
// ---------------------------------------------------------------------------

export async function notifyStockAlert({
  orgId,
  partId,
  partName,
  qtyOnHand,
  reorderLevel,
  actorName,
}: {
  orgId: string;
  partId: string;
  partName: string;
  qtyOnHand: number;
  reorderLevel: number;
  actorName: string;
}) {
  const isOut = qtyOnHand === 0;
  const isLow = !isOut && reorderLevel > 0 && qtyOnHand <= reorderLevel;
  if (!isOut && !isLow) return;

  const alertType = isOut ? NotificationType.STOCK_OUT : NotificationType.STOCK_LOW;

  // Suppress duplicate: skip if the most recent stock alert for this part
  // is already the same type (stock hasn't recovered since last alert)
  const lastAlert = await prisma.notification.findFirst({
    where: {
      orgId,
      type: { in: [NotificationType.STOCK_OUT, NotificationType.STOCK_LOW] },
      message: { contains: partId },
    },
    orderBy: { createdAt: "desc" },
    select: { type: true },
  });
  if (lastAlert?.type === alertType) return;

  // Find ADMIN/MANAGER users whose preferences allow stock alerts
  const users = await prisma.user.findMany({
    where: { orgId, role: { in: ["ADMIN", "MANAGER"] }, isActive: true },
    select: {
      id: true,
      notificationPreferences: { select: { notifyStockAlert: true } },
    },
  });

  const eligible = users.filter(
    (u) => u.notificationPreferences?.notifyStockAlert !== false
  );
  if (eligible.length === 0) return;

  const title = isOut
    ? `Out of stock — ${partName}`
    : `Low stock — ${partName}`;
  const message = isOut
    ? `${partName} [${partId}] is now out of stock (0 units). Adjusted by ${actorName}.`
    : `${partName} [${partId}] is low — ${qtyOnHand} unit${qtyOnHand === 1 ? "" : "s"} remaining (reorder at ${reorderLevel}). Adjusted by ${actorName}.`;

  await prisma.notification.createMany({
    data: eligible.map((u) => ({
      type: alertType,
      title,
      message,
      userId: u.id,
      channel: NotificationChannel.DASHBOARD,
      orgId,
    })),
  });
}

// ---------------------------------------------------------------------------
// Shared helper — notify ADMIN + MANAGER users whose pref field is enabled
// ---------------------------------------------------------------------------

async function notifyAdmins({
  orgId,
  type,
  title,
  message,
  prefField,
}: {
  orgId: string;
  type: NotificationType;
  title: string;
  message: string;
  prefField: string;
}) {
  const users = await prisma.user.findMany({
    where: { orgId, role: { in: ["ADMIN", "MANAGER"] }, isActive: true },
    select: { id: true, notificationPreferences: true },
  });
  const eligible = users.filter((u) => {
    const pref = u.notificationPreferences as Record<string, unknown> | null;
    return pref == null || pref[prefField] !== false;
  });
  if (!eligible.length) return;
  await prisma.notification.createMany({
    data: eligible.map((u) => ({
      type,
      title,
      message,
      userId: u.id,
      channel: NotificationChannel.DASHBOARD,
      orgId,
    })),
  });
}

// ---------------------------------------------------------------------------
// Payment received
// ---------------------------------------------------------------------------
export async function notifyPaymentReceived({
  orgId, jobId, jobNumber, amount, currency, actorName,
}: { orgId: string; jobId?: string; jobNumber: string; amount: number; currency: string; actorName: string }) {
  await notifyAdmins({
    orgId,
    type: NotificationType.PAYMENT_RECEIVED,
    title: `Payment received — ${jobNumber}`,
    message: `${currency} ${amount.toLocaleString()} recorded on job ${jobNumber} by ${actorName}.`,
    prefField: "notifyPaymentReceived",
  });

  // Client-facing confirmation (best-effort). Only when a jobId is supplied —
  // callers omit it for refunds so a refund never sends a "payment received".
  if (jobId) {
    await sendClientPaymentConfirmation({ orgId, jobId, jobNumber, amount, currency }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Warranty claim raised or settled
// ---------------------------------------------------------------------------

/**
 * Tells the customer their warranty claim moved.
 *
 * A claim is the one moment a customer is most anxious and least informed —
 * they have brought a device back and want to know whether it will be covered.
 * Ordinary status changes already message them; claims did not.
 *
 * Best-effort, exactly like the payment confirmation above: no phone means no
 * message, and a provider failure leaves a FAILED outbox row on the job rather
 * than throwing back into the action that settled the claim. Settling a claim
 * must not fail because a message could not go out.
 */
export async function notifyWarrantyClaim(input: {
  orgId: string;
  jobId: string;
  jobNumber: string;
  event: "OPENED" | "RESOLVED" | "REJECTED";
  resolution?: string | null;
}) {
  const client = await prisma.client
    .findFirst({
      where: { orgId: input.orgId, jobs: { some: { id: input.jobId } } },
      select: { phone: true, fullName: true },
    })
    .catch(() => null);

  if (!client?.phone) return;

  const name = client.fullName?.trim() || "there";
  const outcome = input.resolution?.trim();

  // Rejection is the message that most needs to read like a person wrote it:
  // say the decision, give the reason, and leave the door open.
  const body =
    input.event === "OPENED"
      ? `Hi ${name}, we've logged a warranty claim on job ${input.jobNumber}. We'll look at it and come back to you shortly. — Your Repair Team`
      : input.event === "RESOLVED"
        ? `Hi ${name}, your warranty claim on job ${input.jobNumber} has been settled.${outcome ? ` ${outcome}` : ""} — Your Repair Team`
        : `Hi ${name}, we've reviewed your warranty claim on job ${input.jobNumber} and we're not able to cover this one.${outcome ? ` ${outcome}` : ""} Please get in touch if you'd like to talk it through. — Your Repair Team`;

  const enqueueResult = await enqueueWhatsAppMessage({
    orgId: input.orgId,
    to: client.phone,
    body,
    type: OutboundMessageType.WARRANTY_CLAIM_UPDATE,
    jobId: input.jobId,
    provider: "meta",
  }).catch(() => null);

  if (enqueueResult && "outboxId" in enqueueResult && enqueueResult.outboxId) {
    await deliverOutboundMessage(enqueueResult.outboxId).catch(() => null);
  }
}

// ---------------------------------------------------------------------------
// Technician payout recorded
// ---------------------------------------------------------------------------
export async function notifyPayoutGenerated({
  orgId, jobNumber, techName, amount, actorName,
}: { orgId: string; jobNumber: string; techName: string; amount: number; actorName: string }) {
  await notifyAdmins({
    orgId,
    type: NotificationType.PAYOUT_GENERATED,
    title: `Payout recorded — ${jobNumber}`,
    message: `Payout of ${amount.toLocaleString()} for ${techName} on job ${jobNumber} recorded by ${actorName}.`,
    prefField: "notifyPayoutGenerated",
  });
}

// ---------------------------------------------------------------------------
// Job created
// ---------------------------------------------------------------------------
export async function notifyJobCreated({
  orgId, jobNumber, clientName, deviceLabel, actorName,
}: { orgId: string; jobNumber: string; clientName: string; deviceLabel: string; actorName: string }) {
  await notifyAdmins({
    orgId,
    type: NotificationType.JOB_CREATED,
    title: `New job — ${jobNumber}`,
    message: `${clientName} · ${deviceLabel} — created by ${actorName}.`,
    prefField: "notifyJobCreated",
  });
}

// ---------------------------------------------------------------------------
// Repair request received
// ---------------------------------------------------------------------------
export async function notifyRepairRequestReceived({
  orgId, requestNumber, clientName, deviceLabel,
}: { orgId: string; requestNumber: string; clientName: string; deviceLabel: string }) {
  await notifyAdmins({
    orgId,
    type: NotificationType.REPAIR_REQUEST_RECEIVED,
    title: `New repair request — ${requestNumber}`,
    message: `${clientName} submitted a repair request for ${deviceLabel}.`,
    prefField: "notifyRepairRequest",
  });
}

// ---------------------------------------------------------------------------
// Quotation accepted / rejected
// ---------------------------------------------------------------------------
export async function notifyQuotationStatus({
  orgId, quotationRef, status, clientName, actorName,
}: { orgId: string; quotationRef: string; status: "ACCEPTED" | "REJECTED"; clientName: string; actorName: string }) {
  const accepted = status === "ACCEPTED";
  await notifyAdmins({
    orgId,
    type: accepted ? NotificationType.QUOTATION_ACCEPTED : NotificationType.QUOTATION_REJECTED,
    title: accepted ? `Quotation accepted — ${quotationRef}` : `Quotation rejected — ${quotationRef}`,
    message: accepted
      ? `${clientName}'s quotation ${quotationRef} was accepted by ${actorName}.`
      : `${clientName}'s quotation ${quotationRef} was rejected by ${actorName}.`,
    prefField: "notifyQuotationStatus",
  });
}

// ---------------------------------------------------------------------------
// Lead won / lost
// ---------------------------------------------------------------------------
export async function notifyLeadStatus({
  orgId, leadTitle, status, actorName,
}: { orgId: string; leadTitle: string; status: "WON" | "LOST"; actorName: string }) {
  await notifyAdmins({
    orgId,
    type: status === "WON" ? NotificationType.LEAD_WON : NotificationType.LEAD_LOST,
    title: status === "WON" ? `Lead won — ${leadTitle}` : `Lead lost — ${leadTitle}`,
    message: status === "WON"
      ? `Lead "${leadTitle}" marked WON by ${actorName}.`
      : `Lead "${leadTitle}" marked LOST by ${actorName}.`,
    prefField: "notifyLeadStatus",
  });
}

// ---------------------------------------------------------------------------
// Purchase request submitted / approved
// ---------------------------------------------------------------------------
export async function notifyPurchaseRequest({
  orgId, requestNumber, status, actorName,
}: { orgId: string; requestNumber: string; status: "SUBMITTED" | "APPROVED"; actorName: string }) {
  await notifyAdmins({
    orgId,
    type: status === "SUBMITTED" ? NotificationType.PURCHASE_REQUEST_SUBMITTED : NotificationType.PURCHASE_REQUEST_APPROVED,
    title: status === "SUBMITTED" ? `Purchase request — ${requestNumber}` : `Purchase request approved — ${requestNumber}`,
    message: status === "SUBMITTED"
      ? `Purchase request ${requestNumber} submitted by ${actorName} — awaiting review.`
      : `Purchase request ${requestNumber} approved by ${actorName}.`,
    prefField: "notifyPurchaseRequest",
  });
}

// ---------------------------------------------------------------------------
// Stock received (goods received against PO)
// ---------------------------------------------------------------------------
export async function notifyStockReceived({
  orgId, grnNumber, poReference, itemCount, actorName,
}: { orgId: string; grnNumber: string; poReference?: string; itemCount: number; actorName: string }) {
  await notifyAdmins({
    orgId,
    type: NotificationType.STOCK_RECEIVED,
    title: `Stock received — ${grnNumber}`,
    message: `${itemCount} line${itemCount === 1 ? "" : "s"} received${poReference ? ` against PO ${poReference}` : ""} by ${actorName}.`,
    prefField: "notifyStockMovement",
  });
}

// ---------------------------------------------------------------------------
// Stock transfer updated
// ---------------------------------------------------------------------------
export async function notifyStockTransferUpdated({
  orgId, transferNumber, status, actorName,
}: { orgId: string; transferNumber: string; status: "APPROVED" | "DISPATCHED" | "RECEIVED"; actorName: string }) {
  const label = status === "APPROVED" ? "approved" : status === "DISPATCHED" ? "dispatched" : "received";
  await notifyAdmins({
    orgId,
    type: NotificationType.STOCK_TRANSFER_UPDATED,
    title: `Transfer ${label} — ${transferNumber}`,
    message: `Stock transfer ${transferNumber} was ${label} by ${actorName}.`,
    prefField: "notifyStockMovement",
  });
}

// ---------------------------------------------------------------------------
// Stock count approved
// ---------------------------------------------------------------------------
export async function notifyStockCountApproved({
  orgId, countNumber, varianceCount, actorName,
}: { orgId: string; countNumber: string; varianceCount: number; actorName: string }) {
  await notifyAdmins({
    orgId,
    type: NotificationType.STOCK_COUNT_APPROVED,
    title: `Stock count approved — ${countNumber}`,
    message: `Stock count ${countNumber} approved by ${actorName}. ${varianceCount} line${varianceCount === 1 ? "" : "s"} with variance reconciled.`,
    prefField: "notifyStockMovement",
  });
}

// ---------------------------------------------------------------------------
// Field visit completed
// ---------------------------------------------------------------------------
export async function notifyFieldVisitCompleted({
  orgId, clientName, address, techName,
}: { orgId: string; clientName: string; address: string; techName: string }) {
  await notifyAdmins({
    orgId,
    type: NotificationType.FIELD_VISIT_COMPLETED,
    title: `Field visit completed`,
    message: `Visit for ${clientName} at ${address} completed by ${techName}.`,
    prefField: "notifyFieldVisit",
  });
}

// ---------------------------------------------------------------------------
// Credit note issued / refund issued
// ---------------------------------------------------------------------------
export async function notifyCreditNoteIssued({
  orgId, creditNoteNumber, clientName, amount, actorName,
}: { orgId: string; creditNoteNumber: string; clientName: string; amount: number; actorName: string }) {
  await notifyAdmins({
    orgId,
    type: NotificationType.CREDIT_NOTE_ISSUED,
    title: `Credit note issued — ${creditNoteNumber}`,
    message: `Credit note ${creditNoteNumber} for ${clientName} (${amount.toLocaleString()}) issued by ${actorName}.`,
    prefField: "notifyCreditNote",
  });
}

export async function notifyRefundIssued({
  orgId, creditNoteNumber, clientName, amount, actorName,
}: { orgId: string; creditNoteNumber: string; clientName: string; amount: number; actorName: string }) {
  await notifyAdmins({
    orgId,
    type: NotificationType.REFUND_ISSUED,
    title: `Refund issued — ${creditNoteNumber}`,
    message: `Refund of ${amount.toLocaleString()} for ${clientName} issued by ${actorName}.`,
    prefField: "notifyCreditNote",
  });
}
