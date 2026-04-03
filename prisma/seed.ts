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

async function deactivateUsersByEmail(emails: string[]) {
  if (emails.length === 0) return;
  await prisma.user.updateMany({
    where: { email: { in: emails } },
    data: { isActive: false },
  });
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

  const techExternal = await ensureUser({
    name: "Abdu",
    email: "abdu@eagle.tech",
    role: "TECHNICIAN_EXTERNAL",
    password: defaultPassword,
  });

  const ops = await ensureUser({
    name: "Kakande",
    email: "ops@eagle.tech",
    role: "OPS",
    password: defaultPassword,
  });

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

  console.log("Seeded users for all roles.");

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
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
      jobNumber: formatJobNumber(currentDate, 1),
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
      externalTechBill: 180000,
      clientBill: 240000,
      clientApproved: true,
      repairTimeline: "2 days",
      workDone: "Replaced display assembly and tested touch sensors",
      partsReplaced: "Display assembly",
      receivedAt: new Date(now - 2 * day),
      completedAt: new Date(now),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 2),
      status: "RECEIVED",
      clientId: c2.id,
      createdById: ops.id,
      assignedToId: techInternal.id,
      deviceType: "PHONE_IPHONE",
      brand: "Apple",
      model: "iPhone 12",
      issueDescription: "Battery drains very quickly",
      receivedAt: new Date(now - 1 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 3),
      status: "DIAGNOSING",
      clientId: c3.id,
      createdById: ops.id,
      assignedToId: techInternal.id,
      deviceType: "WINDOWS_PC",
      brand: "Dell",
      model: "Latitude 5420",
      issueDescription: "Laptop powers off randomly",
      diagnosisNotes: "Suspected failing power IC",
      receivedAt: new Date(now - 3 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 4),
      status: "IN_REPAIR",
      repairPath: "EXTERNAL",
      clientId: c4.id,
      createdById: ops.id,
      assignedToId: techExternal.id,
      deviceType: "MAC",
      brand: "Apple",
      model: "MacBook Pro 2019",
      issueDescription: "No display but keyboard lights up",
      externalDiagnosis: "Likely logic board fault; requires board-level repair",
      externalTechBill: 420000,
      repairTimeline: "5-7 days",
      timelineMinMinutes: 5 * 24 * 60,
      timelineMaxMinutes: 7 * 24 * 60,
      timelineConfidence: "PARTS_DEPENDENT",
      timelineNote: "Logic board donor stock arrives mid-week",
      receivedAt: new Date(now - 5 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 5),
      status: "AWAITING_APPROVAL",
      repairPath: "EXTERNAL",
      clientId: c5.id,
      createdById: ops.id,
      assignedToId: techExternal.id,
      deviceType: "TABLET",
      brand: "Samsung",
      model: "Tab S7",
      issueDescription: "Tablet not charging",
      externalDiagnosis: "Charging IC replacement required",
      externalTechBill: 150000,
      clientApproved: null,
      timelineMinMinutes: 2 * 24 * 60,
      timelineMaxMinutes: 3 * 24 * 60,
      timelineConfidence: "ESTIMATED",
      receivedAt: new Date(now - 4 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 6),
      status: "IN_REPAIR",
      repairPath: "IN_HOUSE",
      clientId: c6.id,
      createdById: ops.id,
      assignedToId: techInternal.id,
      deviceType: "OTHER",
      brand: "Canon",
      model: "Printer i-Sensys",
      issueDescription: "Paper jam error even with empty path",
      diagnosisNotes: "Worn sensor arm",
      externalTechBill: 120000,
      clientApproved: true,
      repairTimeline: "1 day",
      timelineMinMinutes: 8 * 60,
      timelineMaxMinutes: 12 * 60,
      timelineConfidence: "FIRM",
      receivedAt: new Date(now - 2 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 7),
      status: "CLOSED",
      repairPath: "EXTERNAL",
      clientId: c2.id,
      createdById: ops.id,
      assignedToId: dan.id,
      deviceType: "PHONE_ANDROID",
      brand: "Xiaomi",
      model: "Redmi Note 11",
      issueDescription: "Bootloop after update",
      diagnosisNotes: "Storage likely degraded",
      externalTechBill: 220000,
      clientApproved: false,
      receivedAt: new Date(now - 9 * day),
      closedAt: new Date(now - 6 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 8),
      status: "COMPLETED",
      repairPath: "IN_HOUSE",
      clientId: c3.id,
      createdById: ops.id,
      assignedToId: techInternal.id,
      deviceType: "WINDOWS_PC",
      brand: "HP",
      model: "ProDesk 400",
      issueDescription: "Overheating and noisy fan",
      diagnosisNotes: "Dust clog and bad fan bearing",
      externalTechBill: 110000,
      clientBill: 150000,
      clientApproved: true,
      workDone: "Replaced fan and cleaned thermal path",
      partsReplaced: "CPU fan",
      receivedAt: new Date(now - 7 * day),
      completedAt: new Date(now - 5 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 9),
      status: "COMPLETED",
      repairPath: "EXTERNAL",
      clientId: c4.id,
      createdById: ops.id,
      assignedToId: techExternal.id,
      deviceType: "MAC",
      brand: "Apple",
      model: "MacBook Air M1",
      issueDescription: "Liquid damage around keyboard",
      externalDiagnosis: "Keyboard and top case replacement",
      externalTechBill: 350000,
      clientBill: 500000,
      clientApproved: true,
      timelineMinMinutes: 2 * 24 * 60,
      timelineMaxMinutes: 4 * 24 * 60,
      timelineConfidence: "ESTIMATED",
      receivedAt: new Date(now - 10 * day),
      completedAt: new Date(now - 2 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 10),
      status: "IN_REPAIR",
      repairPath: "IN_HOUSE",
      clientId: c5.id,
      createdById: ops.id,
      assignedToId: techInternal.id,
      deviceType: "PHONE_IPHONE",
      brand: "Apple",
      model: "iPhone XR",
      issueDescription: "Rear camera not focusing",
      diagnosisNotes: "Camera module replacement ongoing",
      externalTechBill: 120000,
      clientApproved: true,
      receivedAt: new Date(now - 2 * day),
    }),
  ]);

  const sequenceByMonthYear: Record<string, number> = {
    [`${currentMonth}/${currentYear}`]: 11,
  };
  const monthlyJobs = await Promise.all(
    Array.from({ length: 18 }, (_, orderIndex) => {
      const index = 17 - orderIndex;
      const monthDate = new Date();
      monthDate.setDate(1);
      monthDate.setMonth(monthDate.getMonth() - index);
      const jobMonth = monthDate.getMonth() + 1;
      const jobYear = monthDate.getFullYear();
      const monthYearKey = `${jobMonth}/${jobYear}`;
      const nextSequence = sequenceByMonthYear[monthYearKey] ?? 1;
      sequenceByMonthYear[monthYearKey] = nextSequence + 1;

      const completedAt = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth(),
        Math.min(25, 8 + (index % 12)),
        14,
        30,
        0,
        0,
      );
      const safeCompletedAt = completedAt.getTime() > now ? new Date(now - 2 * 60 * 60 * 1000) : completedAt;
      const receivedAt = new Date(safeCompletedAt.getTime() - (2 + (index % 3)) * day);
      const isExternal = index % 2 === 0;
      const externalTechBill = 140000 + index * 12000;
      const clientBill = externalTechBill + 70000 + (index % 4) * 10000;
      const monthlyClient = [c1, c2, c3, c4, c5, c6][index % 6];
      const rotatingExternalTech = [techExternal.id, ryan.id, dan.id][index % 3];

      return ensureJob({
        jobNumber: formatJobNumber(monthDate, nextSequence),
        status: "COMPLETED",
        repairPath: isExternal ? "EXTERNAL" : "IN_HOUSE",
        clientId: monthlyClient.id,
        createdById: ops.id,
        assignedToId: isExternal ? rotatingExternalTech : techInternal.id,
        deviceType: isExternal ? "MAC" : "PHONE_ANDROID",
        brand: isExternal ? "Apple" : "Samsung",
        model: isExternal ? `MacBook ${2018 + (index % 6)}` : `Galaxy A${30 + (index % 10)}`,
        issueDescription: isExternal
          ? "Board-level repair required after liquid contact"
          : "Display and battery performance degradation",
        diagnosisNotes: isExternal
          ? undefined
          : "In-house diagnostics completed; repair validated after stress test",
        externalDiagnosis: isExternal
          ? "Specialized board repair and component replacement completed"
          : undefined,
        externalTechBill,
        clientBill,
        clientApproved: true,
        repairTimeline: isExternal ? "3-5 days" : "1-2 days",
        timelineMinMinutes: isExternal ? 3 * 24 * 60 : 24 * 60,
        timelineMaxMinutes: isExternal ? 5 * 24 * 60 : 2 * 24 * 60,
        timelineConfidence: isExternal ? "ESTIMATED" : "FIRM",
        workDone: isExternal
          ? "External specialist completed board-level restoration"
          : "In-house replacement and QA validation completed",
        partsReplaced: isExternal ? "Logic board components" : "Display and battery",
        receivedAt,
        completedAt: safeCompletedAt,
      });
    }),
  );

  const statusMixJobs = await Promise.all([
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 801),
      status: "RECEIVED",
      clientId: c1.id,
      createdById: ops.id,
      assignedToId: techInternal.id,
      deviceType: "PHONE_ANDROID",
      brand: "Infinix",
      model: "Hot 30",
      issueDescription: "Phone reboots during calls",
      receivedAt: new Date(now - 6 * 60 * 60 * 1000),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 802),
      status: "RECEIVED",
      clientId: c2.id,
      createdById: ops.id,
      assignedToId: techInternal.id,
      deviceType: "TABLET",
      brand: "Lenovo",
      model: "Tab M10",
      issueDescription: "Tablet does not power on",
      receivedAt: new Date(now - 10 * 60 * 60 * 1000),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 803),
      status: "DIAGNOSING",
      clientId: c3.id,
      createdById: ops.id,
      assignedToId: techInternal.id,
      deviceType: "WINDOWS_PC",
      brand: "Acer",
      model: "Aspire 5",
      issueDescription: "System freezes after login",
      diagnosisNotes: "Running memory and SSD diagnostics",
      receivedAt: new Date(now - 2 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 804),
      status: "DIAGNOSING",
      clientId: c4.id,
      createdById: ops.id,
      assignedToId: techInternal.id,
      deviceType: "PHONE_IPHONE",
      brand: "Apple",
      model: "iPhone 11",
      issueDescription: "Face ID unavailable",
      diagnosisNotes: "Front sensor array inspection in progress",
      receivedAt: new Date(now - 3 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 805),
      status: "AWAITING_APPROVAL",
      repairPath: "EXTERNAL",
      clientId: c5.id,
      createdById: ops.id,
      assignedToId: ryan.id,
      deviceType: "MAC",
      brand: "Apple",
      model: "MacBook Pro 2020",
      issueDescription: "Liquid spill near trackpad",
      externalDiagnosis: "Trackpad and flex cable replacement required",
      externalTechBill: 260000,
      clientApproved: null,
      repairTimeline: "3-4 days",
      timelineMinMinutes: 3 * 24 * 60,
      timelineMaxMinutes: 4 * 24 * 60,
      timelineConfidence: "ESTIMATED",
      receivedAt: new Date(now - 4 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 806),
      status: "AWAITING_APPROVAL",
      repairPath: "IN_HOUSE",
      clientId: c6.id,
      createdById: ops.id,
      assignedToId: techInternal.id,
      deviceType: "OTHER",
      brand: "Canon",
      model: "Pixma G3410",
      issueDescription: "Printer prints faded pages",
      diagnosisNotes: "Printhead cleaning and possible replacement needed",
      clientApproved: null,
      repairTimeline: "1-2 days",
      timelineMinMinutes: 24 * 60,
      timelineMaxMinutes: 2 * 24 * 60,
      timelineConfidence: "ESTIMATED",
      receivedAt: new Date(now - 2 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 807),
      status: "IN_REPAIR",
      repairPath: "EXTERNAL",
      clientId: c1.id,
      createdById: ops.id,
      assignedToId: dan.id,
      deviceType: "PHONE_ANDROID",
      brand: "Google",
      model: "Pixel 6",
      issueDescription: "No network signal",
      externalDiagnosis: "RF module replacement in progress",
      externalTechBill: 210000,
      clientApproved: true,
      repairTimeline: "2-3 days",
      timelineMinMinutes: 2 * 24 * 60,
      timelineMaxMinutes: 3 * 24 * 60,
      timelineConfidence: "PARTS_DEPENDENT",
      receivedAt: new Date(now - 3 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 808),
      status: "IN_REPAIR",
      repairPath: "IN_HOUSE",
      clientId: c2.id,
      createdById: ops.id,
      assignedToId: techInternal.id,
      deviceType: "PHONE_ANDROID",
      brand: "Tecno",
      model: "Camon 20",
      issueDescription: "Charging port loose",
      diagnosisNotes: "Port replacement and board cleanup ongoing",
      clientApproved: true,
      repairTimeline: "Same day",
      timelineMinMinutes: 6 * 60,
      timelineMaxMinutes: 10 * 60,
      timelineConfidence: "FIRM",
      receivedAt: new Date(now - day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 809),
      status: "READY_FOR_PICKUP",
      repairPath: "EXTERNAL",
      clientId: c3.id,
      createdById: ops.id,
      assignedToId: techExternal.id,
      deviceType: "TABLET",
      brand: "Apple",
      model: "iPad 9th Gen",
      issueDescription: "Touchscreen ghost taps",
      externalDiagnosis: "Digitizer replaced and burn-in tested",
      externalTechBill: 190000,
      clientBill: 265000,
      clientApproved: true,
      workDone: "Digitizer replacement completed",
      partsReplaced: "Digitizer",
      receivedAt: new Date(now - 5 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 810),
      status: "READY_FOR_PICKUP",
      repairPath: "IN_HOUSE",
      clientId: c4.id,
      createdById: ops.id,
      assignedToId: techInternal.id,
      deviceType: "WINDOWS_PC",
      brand: "Lenovo",
      model: "ThinkPad T490",
      issueDescription: "Keyboard keys not responding",
      diagnosisNotes: "Keyboard replaced and tested",
      externalTechBill: 90000,
      clientBill: 140000,
      clientApproved: true,
      workDone: "Installed new keyboard and updated BIOS",
      partsReplaced: "Keyboard assembly",
      receivedAt: new Date(now - 4 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 811),
      status: "CLOSED",
      repairPath: "EXTERNAL",
      clientId: c5.id,
      createdById: ops.id,
      assignedToId: ryan.id,
      deviceType: "MAC",
      brand: "Apple",
      model: "MacBook Air 2018",
      issueDescription: "Water damage after rain exposure",
      externalDiagnosis: "Board corrosion severe; client declined repair",
      externalTechBill: 300000,
      clientApproved: false,
      receivedAt: new Date(now - 12 * day),
      closedAt: new Date(now - 9 * day),
    }),
    ensureJob({
      jobNumber: formatJobNumber(currentDate, 812),
      status: "CLOSED",
      repairPath: "IN_HOUSE",
      clientId: c6.id,
      createdById: ops.id,
      assignedToId: techInternal.id,
      deviceType: "OTHER",
      brand: "Epson",
      model: "L3150",
      issueDescription: "Paper feed motor failure",
      diagnosisNotes: "Replacement cost exceeds customer budget",
      externalTechBill: 80000,
      clientApproved: false,
      receivedAt: new Date(now - 11 * day),
      closedAt: new Date(now - 8 * day),
    }),
  ]);

  console.log(`Seeded/ensured ${jobs.length + monthlyJobs.length + statusMixJobs.length} demo jobs.`);

  for (const job of [...jobs, ...monthlyJobs, ...statusMixJobs]) {
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
  await ensureAudit(jobs[0].id, admin.id, "INVOICE_READY", {
    seeded: true,
    amount: 240000,
  });

  const jobsWithoutAudit = await prisma.job.findMany({
    where: { auditLogs: { none: {} } },
    select: { id: true, jobNumber: true },
  });

  for (const job of jobsWithoutAudit) {
    await ensureAudit(job.id, admin.id, "JOB_CREATED", {
      seeded: true,
      backfill: true,
      jobNumber: job.jobNumber,
    });
  }

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
