import { prisma } from "@/lib/prisma";
import { NotificationType, NotificationChannel, JobStatus } from "@prisma/client";
import { sendCustomWhatsAppMessage } from "@/lib/notifications/whatsapp";

interface CreateNotificationParams {
  type: NotificationType;
  title: string;
  message: string;
  jobId?: string;
  userId?: string;
  channel?: NotificationChannel;
}

export async function createNotification({
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
    },
  });
}

export async function createNotificationsForRole({
  type,
  title,
  message,
  jobId,
  roles,
}: {
  type: NotificationType;
  title: string;
  message: string;
  jobId?: string;
  roles: ("ADMIN" | "OPS" | "TECHNICIAN_INTERNAL" | "TECHNICIAN_EXTERNAL")[];
}) {
  const users = await prisma.user.findMany({
    where: {
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
    })),
  });
}

export async function getUnreadNotifications(userId: string, limit = 20) {
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
          client: {
            select: {
              fullName: true,
              phone: true,
            },
          },
        },
      },
    },
  });
}

export async function getAllNotifications(userId: string, limit = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      job: {
        select: {
          id: true,
          jobNumber: true,
          client: {
            select: {
              fullName: true,
              phone: true,
            },
          },
        },
      },
    },
  });
}

export async function markNotificationAsRead(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
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
  }
) {
  return prisma.notificationPreferences.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

export async function notifyStatusChange(
  jobId: string,
  oldStatus: JobStatus,
  newStatus: JobStatus,
  jobNumber: string,
  clientName: string
) {
  const prefs = await getUserPreferencesForRoles(["ADMIN", "OPS"]);
  const targetRoles = prefs.filter((p) => p.notifyStatusChange).map((p) => p.userId);
  const title = "Status Changed";
  const message = `Job ${jobNumber} (${clientName}) status changed from ${oldStatus.replace("_", " ")} to ${newStatus.replace("_", " ")}`;

  if (targetRoles.length > 0) {
    await prisma.notification.createMany({
      data: targetRoles.map((userId) => ({
        type: NotificationType.STATUS_CHANGE,
        title,
        message,
        jobId,
        userId,
        channel: NotificationChannel.DASHBOARD,
      })),
    });
  }

  if (newStatus === JobStatus.READY_FOR_PICKUP) {
    const client = await prisma.client.findFirst({
      where: { jobs: { some: { id: jobId } } },
      select: { phone: true, fullName: true },
    });

    if (client?.phone && prefs.some((p) => p.whatsappEnabled)) {
      await sendCustomWhatsAppMessage(
        client.phone,
        `Hi ${client.fullName}, your device for job ${jobNumber} is ready for pickup. Please visit us to collect it. - Eagle Info Solutions`,
      );
    }
  }
}

export async function notifyApprovalNeeded(
  jobId: string,
  jobNumber: string,
  clientName: string,
  costEstimate: number
) {
  const prefs = await getUserPreferencesForRoles(["ADMIN", "OPS"]);
  const targetRoles = prefs.filter((p) => p.notifyApprovalNeeded).map((p) => p.userId);
  const title = "Approval Needed";
  const message = `Job ${jobNumber} (${clientName}) requires approval. Estimated cost: UGX ${costEstimate.toLocaleString()}`;

  if (targetRoles.length > 0) {
    await prisma.notification.createMany({
      data: targetRoles.map((userId) => ({
        type: NotificationType.APPROVAL_NEEDED,
        title,
        message,
        jobId,
        userId,
        channel: NotificationChannel.DASHBOARD,
      })),
    });
  }

  const client = await prisma.client.findFirst({
    where: { jobs: { some: { id: jobId } } },
    select: { phone: true, fullName: true },
  });

  if (client?.phone && prefs.some((p) => p.whatsappEnabled)) {
    await sendCustomWhatsAppMessage(
      client.phone,
      `Hi ${client.fullName}, your repair for job ${jobNumber} is ready. Estimated cost: UGX ${costEstimate.toLocaleString()}. Please confirm to proceed. - Eagle Info Solutions`
    );
  }
}

async function getUserPreferencesForRoles(roles: Array<"ADMIN" | "OPS" | "TECHNICIAN_INTERNAL" | "TECHNICIAN_EXTERNAL" | "INTAKE">) {
  const users = await prisma.user.findMany({
    where: { role: { in: roles }, isActive: true },
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
  jobId: string,
  jobNumber: string,
  deviceInfo: string,
  technicianId: string
) {
  const title = "Job Assigned";
  const message = `You've been assigned job ${jobNumber} - ${deviceInfo}`;

  await createNotification({
    type: NotificationType.JOB_ASSIGNED,
    title,
    message,
    jobId,
    userId: technicianId,
  });
}

export async function notifyEstimateSubmitted(
  jobId: string,
  jobNumber: string,
  deviceInfo: string,
  estimatedCost: number
) {
  const prefs = await getUserPreferencesForRoles(["ADMIN", "OPS"]);
  const targets = prefs.filter((p) => p.notifyEstimateSubmitted).map((p) => p.userId);
  const title = "Estimate Submitted";
  const message = `External tech submitted estimate for job ${jobNumber} (${deviceInfo}) - UGX ${estimatedCost.toLocaleString()}`;

  if (targets.length > 0) {
    await prisma.notification.createMany({
      data: targets.map((userId) => ({
        type: NotificationType.ESTIMATE_SUBMITTED,
        title,
        message,
        jobId,
        userId,
        channel: NotificationChannel.DASHBOARD,
      })),
    });
  }
}

export async function notifyTimelineUpdate(
  jobId: string,
  jobNumber: string,
  deviceInfo: string,
  newTimeline: string
) {
  const prefs = await getUserPreferencesForRoles(["ADMIN", "OPS"]);
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
      })),
    });
  }
}

export async function notifyDelayNote(
  jobId: string,
  jobNumber: string,
  deviceInfo: string,
  note: string
) {
  const prefs = await getUserPreferencesForRoles(["ADMIN", "OPS"]);
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
      })),
    });
  }
}
