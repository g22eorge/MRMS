import { beforeAll, describe, it, expect, mock } from "bun:test";

/**
 * Reproduction harness for the "external notes only save on the second try"
 * report. updateJobAction is a real server action that reads the session
 * through requireOrgSession(); for an in-process test we mock the session
 * layer and drive the action exactly the way the diagnosis form does — one
 * FormData, one call, no retry.
 *
 * Runs against the runner-provisioned test DB (never dev.db) and seeds its
 * own org, users, client and jobs, so it passes however the shared test.db
 * happens to look.
 */

process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET ?? "test-secret";

const ADMIN = {
  id: "cmtegkmuc00012lxeb69ll102",
  email: "admin@eagle.test",
  name: "E2E Admin",
  role: "ADMIN" as const,
  orgId: "org_eis_01",
  permissions: [] as string[],
  accessMode: "FULL" as const,
};

mock.module("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));

mock.module("@/lib/deployment-context", () => ({
  getDeploymentContext: async () => ({ mode: "COMMERCIAL_MULTI_TENANT", fixedOrgId: null }),
}));

mock.module("@/lib/platform-admin", () => ({
  checkIsPlatformAdmin: () => false,
}));

let asRole: "ADMIN" | "TECHNICIAN_EXTERNAL" = "ADMIN";

function sessionFor() {
  const user =
    asRole === "ADMIN"
      ? ADMIN
      : { ...ADMIN, id: "cmtegkn41000p2lxezd6r8o61", email: "exttech@eagle.test", name: "Abdu External Tech", role: "TECHNICIAN_EXTERNAL" as const };
  return {
    session: { id: "sess-test", userId: user.id, user, expiresAt: new Date(Date.now() + 3_600_000) },
    user,
  };
}

mock.module("@/lib/session", () => ({
  getCurrentUserRole: async () => sessionFor(),
  getCurrentUserRoleOptional: async () => ({ session: null, user: null }),
}));

const { updateJobAction } = await import("../../app/(app)/jobs/[id]/actions");

async function loadPrisma() {
  return import("@/lib/prisma").then((m) => m.prisma);
}

const ORG_ID = "org_eis_01";
const ADMIN_ID = "cmtegkmuc00012lxeb69ll102";
const EXT_TECH_ID = "cmtegkn41000p2lxezd6r8o61";

let seedClientId = "";

// Seed the exact rows the mocked sessions and the action need. Upserts by the
// fixed ids the session mocks carry, so reruns are idempotent however many
// suites share test.db. Each test then mints its own job, so the five
// mutating saves can never trip each other's optimistic-locking guard.
beforeAll(async () => {
  const prisma = await loadPrisma();
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: "EIS Test Org", slug: "org-eis-01-test" },
  });
  await prisma.user.upsert({
    where: { id: ADMIN_ID },
    update: { orgId: ORG_ID, role: "ADMIN", isActive: true },
    create: { id: ADMIN_ID, name: "E2E Admin", email: "admin@eagle.test", orgId: ORG_ID, role: "ADMIN" },
  });
  await prisma.user.upsert({
    where: { id: EXT_TECH_ID },
    update: { orgId: ORG_ID, role: "TECHNICIAN_EXTERNAL", isActive: true },
    create: { id: EXT_TECH_ID, name: "Abdu External Tech", email: "exttech@eagle.test", orgId: ORG_ID, role: "TECHNICIAN_EXTERNAL" },
  });
  const client = await prisma.client.create({
    data: {
      fullName: "Diagnosis Test Client",
      phone: `+256700${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`,
      orgId: ORG_ID,
    },
  });
  seedClientId = client.id;
});

async function createDiagnosingJob() {
  const prisma = await loadPrisma();
  return prisma.job.create({
    data: {
      jobNumber: `T-DIAG-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      orgId: ORG_ID,
      clientId: seedClientId,
      createdById: ADMIN_ID,
      assignedToId: EXT_TECH_ID,
      brand: "Samsung",
      model: "Galaxy S23",
      deviceType: "PHONE_ANDROID",
      issueDescription: "Screen replacement",
      status: "DIAGNOSING",
    },
    select: { id: true, updatedAt: true, assignedToId: true },
  });
}

describe("diagnosis save persists external notes on the first attempt", () => {
  it("saves externalDiagnosis in one updateJobAction call (admin)", async () => {
    asRole = "ADMIN";
    const stamp = `repro-admin-${Date.now()}`;
    const prisma = await loadPrisma();
    const job = await createDiagnosingJob();
    expect(job).toBeTruthy();

    const fd = new FormData();
    fd.set("jobId", job!.id);
    fd.set("expectedUpdatedAt", job!.updatedAt.toISOString());
    fd.set("externalDiagnosis", stamp);

    const res = await updateJobAction(fd);
    expect(res.error ?? "(no error)").toBe("(no error)");

    const after = await prisma.job.findUnique({ where: { id: job!.id }, select: { externalDiagnosis: true } });
    expect(after?.externalDiagnosis).toBe(stamp);
  });

  it("saves externalDiagnosis in one updateJobAction call (external tech)", async () => {
    asRole = "TECHNICIAN_EXTERNAL";
    const stamp = `repro-ext-${Date.now()}`;
    const prisma = await loadPrisma();
    // The job the harness mints is assigned to this external technician.
    const job = await createDiagnosingJob();
    expect(job).toBeTruthy();

    const fd = new FormData();
    fd.set("jobId", job!.id);
    fd.set("expectedUpdatedAt", job!.updatedAt.toISOString());
    fd.set("externalDiagnosis", stamp);

    const res = await updateJobAction(fd);
    expect(res.error ?? "(no error)").toBe("(no error)");

    const after = await prisma.job.findUnique({ where: { id: job!.id }, select: { externalDiagnosis: true } });
    expect(after?.externalDiagnosis).toBe(stamp);
  });

  it("saves externalDiagnosis alongside assignedToId in the full diagnosis-form shape", async () => {
    asRole = "ADMIN";
    const stamp = `repro-fullform-${Date.now()}`;
    const prisma = await loadPrisma();
    // Shape the payload exactly like the diagnosis form does: every named
    // input on the form is present, including empty strings for optional
    // numerics — the classic trigger for a schema reject that silently eats
    // the notes with it. The minted job is DIAGNOSING with an assignee.
    const job = await createDiagnosingJob();
    expect(job).toBeTruthy();

    const fd = new FormData();
    fd.set("jobId", job!.id);
    fd.set("expectedUpdatedAt", job!.updatedAt.toISOString());
    fd.set("assignedToId", job!.assignedToId!);
    fd.set("diagnosisNotes", "internal side unchanged");
    fd.set("externalDiagnosis", stamp);
    fd.set("partsNeeded", "");
    fd.set("externalTechBill", "");
    fd.set("clientBill", "");
    fd.set("externalTechFee", "");
    fd.set("vatApplicable", "true");
    fd.set("externalPaid", "false");
    fd.set("externalPaymentRef", "");
    fd.set("clientPaid", "false");
    fd.set("clientPaymentRef", "");
    fd.set("recommendationOption", "");
    fd.set("communicationStatus", "");
    fd.set("clientConversationNote", "");
    fd.set("repairPath", "");
    fd.set("repairTimeline", "");
    fd.set("timelineMinValue", "");
    fd.set("timelineMaxValue", "");
    fd.set("timelineConfidence", "");
    fd.set("timelineNote", "");

    const res = await updateJobAction(fd);
    expect(res.error ?? "(no error)").toBe("(no error)");

    const after = await prisma.job.findUnique({ where: { id: job!.id }, select: { externalDiagnosis: true } });
    expect(after?.externalDiagnosis).toBe(stamp);
  });

  it("saves externalDiagnosis in the exact ExternalTechJobView payload shape", async () => {
    asRole = "TECHNICIAN_EXTERNAL";
    const stamp = `repro-extview-${Date.now()}`;
    const prisma = await loadPrisma();
    const job = await createDiagnosingJob();
    expect(job).toBeTruthy();

    // Field-for-field what ExternalTechJobView submits on a plain Save:
    // externalDiagnosis, partsNeeded, externalTechBill, the timeline builder
    // inputs, timelineConfidence, timelineNote, repairTimeline (hidden).
    const fd = new FormData();
    fd.set("jobId", job!.id);
    fd.set("expectedUpdatedAt", job!.updatedAt.toISOString());
    fd.set("externalDiagnosis", stamp);
    fd.set("partsNeeded", "screen");
    fd.set("externalTechBill", "150000");
    fd.set("timelineMinValue", "1");
    fd.set("timelineMaxValue", "2");
    fd.set("timelineUnit", "HOUR");
    fd.set("timelineConfidence", "ESTIMATED");
    fd.set("timelineNote", "");
    fd.set("repairTimeline", "1-2 hours");

    const res = await updateJobAction(fd);
    expect(res.error ?? "(no error)").toBe("(no error)");

    const after = await prisma.job.findUnique({ where: { id: job!.id }, select: { externalDiagnosis: true } });
    expect(after?.externalDiagnosis).toBe(stamp);
  });

  it("saves externalDiagnosis when the timeline builder is empty (the common first-save case)", async () => {
    asRole = "TECHNICIAN_EXTERNAL";
    const stamp = `repro-emptytl-${Date.now()}`;
    const prisma = await loadPrisma();
    const job = await createDiagnosingJob();
    expect(job).toBeTruthy();

    // What ExternalTechJobView submits when the tech has NOT touched the
    // timeline builder: minValue/maxValue state starts "" for a job with no
    // stored timeline, so the inputs submit empty strings.
    const fd = new FormData();
    fd.set("jobId", job!.id);
    fd.set("expectedUpdatedAt", job!.updatedAt.toISOString());
    fd.set("externalDiagnosis", stamp);
    fd.set("partsNeeded", "screen");
    fd.set("externalTechBill", "150000");
    fd.set("timelineMinValue", "");
    fd.set("timelineMaxValue", "");
    fd.set("timelineUnit", "HOUR");
    fd.set("timelineConfidence", "ESTIMATED");
    fd.set("timelineNote", "");
    fd.set("repairTimeline", "");

    const res = await updateJobAction(fd);
    expect(res.error ?? "(no error)").toBe("(no error)");

    const after = await prisma.job.findUnique({ where: { id: job!.id }, select: { externalDiagnosis: true } });
    expect(after?.externalDiagnosis).toBe(stamp);
  });
});


