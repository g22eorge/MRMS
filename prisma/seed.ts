import { hashPassword } from "better-auth/crypto";
import { DeviceType, JobStatus, RepairPath, Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const restExtendedPermissions = [
  "can_run_internal_repairs",
  "can_intake",
  "can_search_jobs",
  "can_generate_job_cards",
  "can_view_job_progress",
  "can_view_approved_cost",
  "can_assign_jobs",
  "can_view_external_updates",
  "can_view_external_quotes",
  "can_review_external_bills",
  "can_view_accounts_summary",
  "can_approve_invoices",
] as const;

async function ensureCredentialAccount(userId: string, password: string) {
  const existing = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
  });

  if (existing) return;

  await prisma.account.create({
    data: {
      accountId: userId,
      providerId: "credential",
      userId,
      password: await hashPassword(password),
    },
  });
}

async function ensureUser({
  name,
  email,
  role,
  password,
}: {
  name: string;
  email: string;
  role: Role;
  password: string;
}) {
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role, isActive: true, emailVerified: true },
    create: { name, email, role, isActive: true, emailVerified: true },
  });

  await ensureCredentialAccount(user.id, password);
  return user;
}

async function deactivateUsersByEmail(emails: string[]) {
  if (emails.length === 0) return;
  await prisma.user.updateMany({
    where: { email: { in: emails } },
    data: { isActive: false },
  });
}

async function ensureUserPermissions(userId: string, permissions: readonly string[]) {
  await prisma.userPermission.deleteMany({ where: { userId } });
  for (const permission of permissions) {
    await prisma.userPermission.create({
      data: { userId, permission },
    });
  }
}

async function ensureClient({
  fullName,
  phone,
  email,
  organization,
}: {
  fullName: string;
  phone: string;
  email?: string;
  organization?: string;
}) {
  return prisma.client.upsert({
    where: { phone },
    update: { fullName, email: email ?? null, organization: organization ?? null },
    create: { fullName, phone, email: email ?? null, organization: organization ?? null },
  });
}

async function ensureJob({
  jobNumber,
  status,
  repairPath,
  clientId,
  createdById,
  assignedToId,
  deviceType,
  brand,
  model,
  issueDescription,
  diagnosisNotes,
  externalDiagnosis,
  externalTechBill,
  clientBill,
  clientApproved,
  repairTimeline,
  timelineMinMinutes,
  timelineMaxMinutes,
  timelineConfidence,
  timelineNote,
  workDone,
  partsReplaced,
  externalTechFee,
  externalPaid,
  externalPaidAt,
  externalPaymentRef,
  receivedAt,
  completedAt,
  closedAt,
}: {
  jobNumber: string;
  status: JobStatus;
  repairPath?: RepairPath;
  clientId: string;
  createdById: string;
  assignedToId?: string;
  deviceType: DeviceType;
  brand: string;
  model: string;
  issueDescription: string;
  diagnosisNotes?: string;
  externalDiagnosis?: string;
  externalTechBill?: number;
  clientBill?: number;
  clientApproved?: boolean | null;
  repairTimeline?: string;
  timelineMinMinutes?: number;
  timelineMaxMinutes?: number;
  timelineConfidence?: "FIRM" | "ESTIMATED" | "PARTS_DEPENDENT";
  timelineNote?: string;
  workDone?: string;
  partsReplaced?: string;
  externalTechFee?: number;
  externalPaid?: boolean;
  externalPaidAt?: Date;
  externalPaymentRef?: string;
  receivedAt: Date;
  completedAt?: Date;
  closedAt?: Date;
}) {
  const existing = await prisma.job.findUnique({ where: { jobNumber } });
  if (existing) {
    return prisma.job.update({
      where: { id: existing.id },
      data: {
        status,
        repairPath: repairPath ?? null,
        clientId,
        createdById,
        assignedToId: assignedToId ?? null,
        deviceType,
        brand,
        model,
        issueDescription,
        diagnosisNotes: diagnosisNotes ?? null,
        externalDiagnosis: externalDiagnosis ?? null,
        externalTechBill: externalTechBill ?? null,
        clientBill: clientBill ?? null,
        clientApproved: typeof clientApproved === "boolean" ? clientApproved : null,
        repairTimeline: repairTimeline ?? null,
        timelineMinMinutes: timelineMinMinutes ?? null,
        timelineMaxMinutes: timelineMaxMinutes ?? null,
        timelineConfidence: timelineConfidence ?? null,
        timelineNote: timelineNote ?? null,
        workDone: workDone ?? null,
        partsReplaced: partsReplaced ?? null,
        externalTechFee: externalTechFee ?? null,
        externalPaid: externalPaid ?? false,
        externalPaidAt: externalPaidAt ?? null,
        externalPaymentRef: externalPaymentRef ?? null,
        receivedAt,
        completedAt: completedAt ?? null,
        closedAt: closedAt ?? null,
      },
    });
  }

  return prisma.job.create({
    data: {
      jobNumber,
      status,
      repairPath,
      clientId,
      createdById,
      assignedToId: assignedToId ?? null,
      deviceType,
      brand,
      model,
      issueDescription,
      diagnosisNotes: diagnosisNotes ?? null,
      externalDiagnosis: externalDiagnosis ?? null,
      externalTechBill: externalTechBill ?? null,
      clientBill: clientBill ?? null,
      clientApproved: typeof clientApproved === "boolean" ? clientApproved : null,
      repairTimeline: repairTimeline ?? null,
      timelineMinMinutes: timelineMinMinutes ?? null,
      timelineMaxMinutes: timelineMaxMinutes ?? null,
      timelineConfidence: timelineConfidence ?? null,
      timelineNote: timelineNote ?? null,
      workDone: workDone ?? null,
      partsReplaced: partsReplaced ?? null,
      externalTechFee: externalTechFee ?? null,
      externalPaid: externalPaid ?? false,
      externalPaidAt: externalPaidAt ?? null,
      externalPaymentRef: externalPaymentRef ?? null,
      receivedAt,
      completedAt: completedAt ?? null,
      closedAt: closedAt ?? null,
    },
  });
}

async function ensureAudit(jobId: string, userId: string, action: string, detail: unknown) {
  const serialized = JSON.stringify(detail);
  const existing = await prisma.auditLog.findFirst({
    where: { jobId, userId, action, detail: serialized },
  });
  if (existing) return;

  await prisma.auditLog.create({
    data: {
      jobId,
      userId,
      action,
      detail: serialized,
    },
  });
}

function formatJobNumber(date: Date, sequence: number) {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `EIS-${month}/${year}/${String(sequence).padStart(4, "0")}`;
}

async function main() {
  const defaultPassword = process.env.SEED_PASSWORD ?? "Admin123!";

  const admin = await ensureUser({
    name: "System Admin",
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@eagle.local",
    role: "ADMIN",
    password: process.env.SEED_ADMIN_PASSWORD ?? defaultPassword,
  });

  const techInternal = await ensureUser({
    name: "Rest",
    email: "rest@eagle.tech",
    role: "TECHNICIAN_INTERNAL",
    password: defaultPassword,
  });
  await ensureUserPermissions(techInternal.id, []);

  const techExternal = await ensureUser({
    name: "Abdu",
    email: "abdu@eagle.tech",
    role: "TECHNICIAN_EXTERNAL",
    password: defaultPassword,
  });

  const ops = await ensureUser({
    name: "Kakande",
    email: "ops@eagle.tech",
    role: "INTAKE",
    password: defaultPassword,
  });
  await ensureUserPermissions(ops.id, []);

  const opsExtended = await ensureUser({
    name: "Ops Extended",
    email: "ops.extended@eagle.tech",
    role: "OPS",
    password: defaultPassword,
  });
  await ensureUserPermissions(opsExtended.id, restExtendedPermissions);

  const ryan = await ensureUser({
    name: "Ryan",
    email: "ryan@eagle.tech",
    role: "TECHNICIAN_EXTERNAL",
    password: defaultPassword,
  });

  const dan = await ensureUser({
    name: "Dan",
    email: "dan@eagle.tech",
    role: "TECHNICIAN_EXTERNAL",
    password: defaultPassword,
  });

  await deactivateUsersByEmail([
    "ops@eagle.local",
    "tech.internal@eagle.local",
    "tech.external@eagle.local",
  ]);

  await prisma.user.updateMany({
    where: { email: "ops@eagle.local" },
    data: { name: "Ops Coordinator (Legacy)" },
  });
  await prisma.user.updateMany({
    where: { email: "tech.internal@eagle.local" },
    data: { name: "Internal Tech (Legacy)" },
  });
  await prisma.user.updateMany({
    where: { email: "tech.external@eagle.local" },
    data: { name: "External Tech (Legacy)" },
  });

  console.log("Seeded users for all roles.");

  await prisma.auditLog.deleteMany({});
  await prisma.photo.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.clientNote.deleteMany({});
  await prisma.client.deleteMany({});

  const trainingDate = new Date();
  const now = Date.now();
  const day = 1000 * 60 * 60 * 24;

  const clients = await Promise.all([
    ensureClient({ fullName: "Amina Yusuf", phone: "08010020001", email: "amina@train.eagle" }),
    ensureClient({ fullName: "Bello Devices Ltd", phone: "08010020002", organization: "Bello Devices" }),
    ensureClient({ fullName: "Chinwe Okafor", phone: "08010020003" }),
    ensureClient({ fullName: "Danjuma Musa", phone: "08010020004" }),
    ensureClient({ fullName: "Eko Learning Hub", phone: "08010020005", organization: "Eko Hub" }),
    ensureClient({ fullName: "Fatima Ibra", phone: "08010020006" }),
    ensureClient({ fullName: "Gadgets Plus", phone: "08010020007", organization: "Gadgets Plus" }),
    ensureClient({ fullName: "Hassan Ali", phone: "08010020008" }),
  ]);

  const [c1, c2, c3, c4, c5, c6, c7, c8] = clients;

  const trainingJobs = await Promise.all([
    ensureJob({
      jobNumber: formatJobNumber(trainingDate, 1),
      status: "RECEIVED",
      clientId: c1.id,
      createdById: ops.id,
      assignedToId: techInternal.id,
      deviceType: "PHONE_IPHONE",
      brand: "Apple",
      model: "iPhone 13",
      issueDescription: "Battery drains from 70% to 20% in one hour",
      receivedAt: new Date(now - 2 * 60 * 60 * 1000),
    }),
    ensureJob({
      jobNumber: formatJobNumber(trainingDate, 2),
      status: "DIAGNOSING",
      clientId: c2.id,
      createdById: ops.id,
      assignedToId: techInternal.id,
      deviceType: "WINDOWS_PC",
      brand: "Dell",
      model: "Latitude 5410",
      issueDescription: "Random shutdown during boot",
      diagnosisNotes: "Power rail diagnostics in progress",
      receivedAt: new Date(now - 1 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(trainingDate, 3),
      status: "AWAITING_APPROVAL",
      repairPath: "EXTERNAL",
      clientId: c3.id,
      createdById: ops.id,
      assignedToId: ryan.id,
      deviceType: "MAC",
      brand: "Apple",
      model: "MacBook Pro 2020",
      issueDescription: "Liquid spill near keyboard",
      externalDiagnosis: "Top case and board repair required",
      externalTechBill: 280000,
      clientApproved: null,
      repairTimeline: "3-4 days",
      receivedAt: new Date(now - 2 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(trainingDate, 4),
      status: "IN_REPAIR",
      repairPath: "IN_HOUSE",
      clientId: c4.id,
      createdById: ops.id,
      assignedToId: techInternal.id,
      deviceType: "PHONE_ANDROID",
      brand: "Samsung",
      model: "Galaxy A34",
      issueDescription: "Camera not focusing",
      diagnosisNotes: "Camera module replacement ongoing",
      clientApproved: true,
      repairTimeline: "1-2 days",
      receivedAt: new Date(now - 2 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(trainingDate, 5),
      status: "IN_REPAIR",
      repairPath: "EXTERNAL",
      clientId: c5.id,
      createdById: ops.id,
      assignedToId: dan.id,
      deviceType: "TABLET",
      brand: "Samsung",
      model: "Tab S8",
      issueDescription: "Charging port intermittently disconnected",
      externalDiagnosis: "Port track repair in progress",
      externalTechBill: 175000,
      clientApproved: true,
      repairTimeline: "2-3 days",
      receivedAt: new Date(now - 3 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(trainingDate, 6),
      status: "READY_FOR_PICKUP",
      repairPath: "IN_HOUSE",
      clientId: c6.id,
      createdById: ops.id,
      assignedToId: techInternal.id,
      deviceType: "WINDOWS_PC",
      brand: "Lenovo",
      model: "ThinkPad E14",
      issueDescription: "Keyboard keys failed after spill",
      diagnosisNotes: "Keyboard replaced and tested",
      clientBill: 165000,
      clientApproved: true,
      workDone: "Replaced keyboard and validated typing matrix",
      partsReplaced: "Keyboard",
      receivedAt: new Date(now - 4 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(trainingDate, 7),
      status: "COMPLETED",
      repairPath: "EXTERNAL",
      clientId: c7.id,
      createdById: ops.id,
      assignedToId: techExternal.id,
      deviceType: "MAC",
      brand: "Apple",
      model: "MacBook Air M1",
      issueDescription: "No display output",
      externalDiagnosis: "Display flex and board fix completed",
      externalTechBill: 320000,
      externalTechFee: 290000,
      externalPaid: false,
      clientBill: 470000,
      clientApproved: true,
      receivedAt: new Date(now - 7 * day),
      completedAt: new Date(now - 2 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(trainingDate, 8),
      status: "COMPLETED",
      repairPath: "EXTERNAL",
      clientId: c8.id,
      createdById: ops.id,
      assignedToId: ryan.id,
      deviceType: "PHONE_ANDROID",
      brand: "Google",
      model: "Pixel 7",
      issueDescription: "No network service",
      externalDiagnosis: "RF section replaced and calibrated",
      externalTechBill: 210000,
      externalTechFee: 180000,
      externalPaid: true,
      externalPaidAt: new Date(now - day),
      externalPaymentRef: "TRN-EXT-1008",
      clientBill: 310000,
      clientApproved: true,
      receivedAt: new Date(now - 8 * day),
      completedAt: new Date(now - 3 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(trainingDate, 9),
      status: "COMPLETED",
      repairPath: "IN_HOUSE",
      clientId: c1.id,
      createdById: ops.id,
      assignedToId: techInternal.id,
      deviceType: "PHONE_ANDROID",
      brand: "Tecno",
      model: "Camon 20",
      issueDescription: "Screen touch not responding",
      diagnosisNotes: "Display changed and touch tested",
      externalTechBill: 115000,
      clientBill: 165000,
      clientApproved: true,
      workDone: "Replaced display assembly and calibrated touch",
      partsReplaced: "Display assembly",
      receivedAt: new Date(now - 6 * day),
      completedAt: new Date(now - day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(trainingDate, 10),
      status: "CLOSED",
      repairPath: "EXTERNAL",
      clientId: c2.id,
      createdById: ops.id,
      assignedToId: dan.id,
      deviceType: "OTHER",
      brand: "Epson",
      model: "L3150",
      issueDescription: "Motor failure and paper feed jam",
      externalDiagnosis: "Replacement not economical for client",
      externalTechBill: 130000,
      clientApproved: false,
      receivedAt: new Date(now - 9 * day),
      closedAt: new Date(now - 5 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(trainingDate, 11),
      status: "READY_FOR_PICKUP",
      repairPath: "EXTERNAL",
      clientId: c3.id,
      createdById: ops.id,
      assignedToId: techExternal.id,
      deviceType: "TABLET",
      brand: "Apple",
      model: "iPad 10th Gen",
      issueDescription: "Ghost touches",
      externalDiagnosis: "Digitizer replaced and QA complete",
      externalTechBill: 195000,
      externalTechFee: 170000,
      clientBill: 285000,
      clientApproved: true,
      receivedAt: new Date(now - 5 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(trainingDate, 12),
      status: "AWAITING_APPROVAL",
      repairPath: "IN_HOUSE",
      clientId: c4.id,
      createdById: ops.id,
      assignedToId: techInternal.id,
      deviceType: "PHONE_IPHONE",
      brand: "Apple",
      model: "iPhone 11",
      issueDescription: "Face ID unavailable",
      diagnosisNotes: "Sensor flex replacement needed",
      externalTechBill: 145000,
      clientApproved: null,
      repairTimeline: "1 day",
      receivedAt: new Date(now - day),
    }),
  ]);

  for (const job of trainingJobs) {
    await ensureAudit(job.id, admin.id, "JOB_CREATED", { seeded: true, training: true, jobNumber: job.jobNumber });
  }

  await ensureAudit(trainingJobs[4].id, dan.id, "EXTERNAL_DIAGNOSIS_ADDED", {
    seeded: true,
    note: "External technician posted live progress update",
  });
  await ensureAudit(trainingJobs[2].id, ops.id, "AWAITING_CLIENT_APPROVAL", {
    seeded: true,
    note: "Client contacted and pending decision",
  });

  console.log(`Prepared ${trainingJobs.length} fresh training jobs.`);
  console.log("Sample login password for seeded non-admin users:", defaultPassword);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
