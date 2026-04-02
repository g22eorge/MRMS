import { hashPassword } from "better-auth/crypto";
import { DeviceType, JobStatus, RepairPath, Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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

async function main() {
  const defaultPassword = process.env.SEED_PASSWORD ?? "Admin123!";

  const admin = await ensureUser({
    name: "System Admin",
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@eagle.local",
    role: "ADMIN",
    password: process.env.SEED_ADMIN_PASSWORD ?? defaultPassword,
  });

  const intake = await ensureUser({
    name: "Intake Officer",
    email: "intake@eagle.local",
    role: "INTAKE",
    password: defaultPassword,
  });

  const techInternal = await ensureUser({
    name: "Internal Tech",
    email: "tech.internal@eagle.local",
    role: "TECHNICIAN_INTERNAL",
    password: defaultPassword,
  });

  const techExternal = await ensureUser({
    name: "External Tech",
    email: "tech.external@eagle.local",
    role: "TECHNICIAN_EXTERNAL",
    password: defaultPassword,
  });

  const ops = await ensureUser({
    name: "Ops Coordinator",
    email: "ops@eagle.local",
    role: "OPS",
    password: defaultPassword,
  });

  const accounts = await ensureUser({
    name: "Accounts Officer",
    email: "accounts@eagle.local",
    role: "ACCOUNTS",
    password: defaultPassword,
  });

  console.log("Seeded users for all roles.");

  const year = new Date().getFullYear();
  const c1 = await ensureClient({
    fullName: "Revenue Demo Client",
    phone: "000-REV-0001",
    email: "revenue-demo@eagle.local",
    organization: "Demo Org",
  });
  const c2 = await ensureClient({
    fullName: "Amina Yusuf",
    phone: "08010010001",
    email: "amina@example.com",
  });
  const c3 = await ensureClient({
    fullName: "Bello Devices Ltd",
    phone: "08010010002",
    email: "support@bello.dev",
    organization: "Bello Devices",
  });
  const c4 = await ensureClient({
    fullName: "Chinwe Okafor",
    phone: "08010010003",
  });
  const c5 = await ensureClient({
    fullName: "Danjuma Musa",
    phone: "08010010004",
  });
  const c6 = await ensureClient({
    fullName: "Eko Learning Hub",
    phone: "08010010005",
    organization: "Eko Hub",
  });

  console.log("Seeded clients.");

  const now = Date.now();
  const day = 1000 * 60 * 60 * 24;

  const jobs = await Promise.all([
    ensureJob({
      jobNumber: `EI-${year}-9001`,
      status: "COMPLETED",
      repairPath: "IN_HOUSE",
      clientId: c1.id,
      createdById: admin.id,
      assignedToId: techInternal.id,
      deviceType: "PHONE_ANDROID",
      brand: "Samsung",
      model: "Galaxy A54",
      issueDescription: "Screen flickers and touch is intermittent",
      diagnosisNotes: "Display connector reseated and panel replaced",
      externalTechBill: 180,
      clientBill: 199.99,
      clientApproved: true,
      repairTimeline: "2 days",
      workDone: "Replaced display assembly and tested touch sensors",
      partsReplaced: "Display assembly",
      receivedAt: new Date(now - 2 * day),
      completedAt: new Date(now),
    }),
    ensureJob({
      jobNumber: `EI-${year}-9002`,
      status: "RECEIVED",
      clientId: c2.id,
      createdById: intake.id,
      assignedToId: techInternal.id,
      deviceType: "PHONE_IPHONE",
      brand: "Apple",
      model: "iPhone 12",
      issueDescription: "Battery drains very quickly",
      receivedAt: new Date(now - 1 * day),
    }),
    ensureJob({
      jobNumber: `EI-${year}-9003`,
      status: "DIAGNOSING",
      clientId: c3.id,
      createdById: intake.id,
      assignedToId: techInternal.id,
      deviceType: "WINDOWS_PC",
      brand: "Dell",
      model: "Latitude 5420",
      issueDescription: "Laptop powers off randomly",
      diagnosisNotes: "Suspected failing power IC",
      receivedAt: new Date(now - 3 * day),
    }),
    ensureJob({
      jobNumber: `EI-${year}-9004`,
      status: "REFERRED",
      repairPath: "EXTERNAL",
      clientId: c4.id,
      createdById: intake.id,
      assignedToId: techExternal.id,
      deviceType: "MAC",
      brand: "Apple",
      model: "MacBook Pro 2019",
      issueDescription: "No display but keyboard lights up",
      externalDiagnosis: "Likely logic board fault; requires board-level repair",
      externalTechBill: 420,
      repairTimeline: "5-7 days",
      timelineMinMinutes: 5 * 24 * 60,
      timelineMaxMinutes: 7 * 24 * 60,
      timelineConfidence: "PARTS_DEPENDENT",
      timelineNote: "Logic board donor stock arrives mid-week",
      receivedAt: new Date(now - 5 * day),
    }),
    ensureJob({
      jobNumber: `EI-${year}-9005`,
      status: "AWAITING_APPROVAL",
      repairPath: "EXTERNAL",
      clientId: c5.id,
      createdById: intake.id,
      assignedToId: techExternal.id,
      deviceType: "TABLET",
      brand: "Samsung",
      model: "Tab S7",
      issueDescription: "Tablet not charging",
      externalDiagnosis: "Charging IC replacement required",
      externalTechBill: 150,
      clientApproved: null,
      timelineMinMinutes: 2 * 24 * 60,
      timelineMaxMinutes: 3 * 24 * 60,
      timelineConfidence: "ESTIMATED",
      receivedAt: new Date(now - 4 * day),
    }),
    ensureJob({
      jobNumber: `EI-${year}-9006`,
      status: "IN_REPAIR",
      repairPath: "IN_HOUSE",
      clientId: c6.id,
      createdById: intake.id,
      assignedToId: techInternal.id,
      deviceType: "OTHER",
      brand: "Canon",
      model: "Printer i-Sensys",
      issueDescription: "Paper jam error even with empty path",
      diagnosisNotes: "Worn sensor arm",
      externalTechBill: 90,
      clientApproved: true,
      repairTimeline: "1 day",
      timelineMinMinutes: 8 * 60,
      timelineMaxMinutes: 12 * 60,
      timelineConfidence: "FIRM",
      receivedAt: new Date(now - 2 * day),
    }),
    ensureJob({
      jobNumber: `EI-${year}-9007`,
      status: "CLOSED",
      repairPath: "EXTERNAL",
      clientId: c2.id,
      createdById: intake.id,
      assignedToId: ops.id,
      deviceType: "PHONE_ANDROID",
      brand: "Xiaomi",
      model: "Redmi Note 11",
      issueDescription: "Bootloop after update",
      diagnosisNotes: "Storage likely degraded",
      externalTechBill: 220,
      clientApproved: false,
      receivedAt: new Date(now - 9 * day),
      closedAt: new Date(now - 6 * day),
    }),
    ensureJob({
      jobNumber: `EI-${year}-9008`,
      status: "COMPLETED",
      repairPath: "IN_HOUSE",
      clientId: c3.id,
      createdById: intake.id,
      assignedToId: techInternal.id,
      deviceType: "WINDOWS_PC",
      brand: "HP",
      model: "ProDesk 400",
      issueDescription: "Overheating and noisy fan",
      diagnosisNotes: "Dust clog and bad fan bearing",
      externalTechBill: 65,
      clientBill: 70,
      clientApproved: true,
      workDone: "Replaced fan and cleaned thermal path",
      partsReplaced: "CPU fan",
      receivedAt: new Date(now - 7 * day),
      completedAt: new Date(now - 5 * day),
    }),
    ensureJob({
      jobNumber: `EI-${year}-9009`,
      status: "COMPLETED",
      repairPath: "EXTERNAL",
      clientId: c4.id,
      createdById: intake.id,
      assignedToId: techExternal.id,
      deviceType: "MAC",
      brand: "Apple",
      model: "MacBook Air M1",
      issueDescription: "Liquid damage around keyboard",
      externalDiagnosis: "Keyboard and top case replacement",
      externalTechBill: 350,
      clientBill: 365,
      clientApproved: true,
      timelineMinMinutes: 2 * 24 * 60,
      timelineMaxMinutes: 4 * 24 * 60,
      timelineConfidence: "ESTIMATED",
      receivedAt: new Date(now - 10 * day),
      completedAt: new Date(now - 2 * day),
    }),
    ensureJob({
      jobNumber: `EI-${year}-9010`,
      status: "IN_REPAIR",
      repairPath: "IN_HOUSE",
      clientId: c5.id,
      createdById: intake.id,
      assignedToId: techInternal.id,
      deviceType: "PHONE_IPHONE",
      brand: "Apple",
      model: "iPhone XR",
      issueDescription: "Rear camera not focusing",
      diagnosisNotes: "Camera module replacement ongoing",
      externalTechBill: 120,
      clientApproved: true,
      receivedAt: new Date(now - 2 * day),
    }),
  ]);

  console.log(`Seeded/ensured ${jobs.length} demo jobs.`);

  for (const job of jobs) {
    await ensureAudit(job.id, admin.id, "JOB_CREATED", { seeded: true, jobNumber: job.jobNumber });
  }

  await ensureAudit(jobs[3].id, techExternal.id, "EXTERNAL_DIAGNOSIS_ADDED", {
    seeded: true,
    note: "External diagnostic details captured",
  });
  await ensureAudit(jobs[4].id, ops.id, "AWAITING_CLIENT_APPROVAL", {
    seeded: true,
    note: "Estimate shared with client",
  });
  await ensureAudit(jobs[0].id, accounts.id, "INVOICE_READY", {
    seeded: true,
    amount: 199.99,
  });

  console.log("Seeded audit logs.");
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
