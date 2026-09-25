/**
 * E2E: Automatic tracking links (SPEC-001).
 *
 * The public /status link must ride with client messages without staff
 * lifting a finger: job-created (intake convert) and status changes carry
 * it; an opted-out org sends the same messages without it.
 */
import { expect, test, type Cookie, type Page } from "@playwright/test";
import { OrgModule, PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { destroyE2eOrg } from "./fixtures/destroy-org";

process.env.DATABASE_URL = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;

const prisma = new PrismaClient();
const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const password = process.env.E2E_PASSWORD ?? "Track123!";

const ORG_SLUG = "e2e-tracking-link";

function parseSetCookie(setCookie: string, origin: URL): Cookie {
  const [nameValue, ...attributes] = setCookie.split(";").map((v) => v.trim());
  const [name, ...valueParts] = nameValue.split("=");
  const cookie: Cookie = { name, value: valueParts.join("="), domain: origin.hostname, path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" };
  for (const attribute of attributes) {
    const [keyRaw, ...rawValue] = attribute.split("=");
    const key = keyRaw.toLowerCase();
    const value = rawValue.join("=");
    if (key === "path" && value) cookie.path = value;
    if (key === "domain" && value) cookie.domain = value;
    if (key === "httponly") cookie.httpOnly = true;
    if (key === "secure") cookie.secure = true;
    if (key === "samesite" && (value === "Lax" || value === "Strict" || value === "None")) cookie.sameSite = value;
    if (key === "max-age" && value) {
      const seconds = Number(value);
      if (Number.isFinite(seconds)) cookie.expires = Math.floor(Date.now() / 1000) + seconds;
    }
  }
  return cookie;
}

async function ensureAccount(userId: string) {
  const passwordHash = await hashPassword(password);
  const existing = await prisma.account.findFirst({ where: { userId, providerId: "credential" }, select: { id: true } });
  if (existing) {
    await prisma.account.update({ where: { id: existing.id }, data: { password: passwordHash } });
    return;
  }
  await prisma.account.create({ data: { userId, accountId: userId, providerId: "credential", password: passwordHash } });
}

async function login(page: Page, email: string) {
  const origin = new URL(baseUrl);
  let response: Response | null = null;
  for (let attempt = 1; attempt <= 15; attempt += 1) {
    response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", origin: baseUrl },
      body: JSON.stringify({ email, password, callbackURL: "/dashboard" }),
    });
    if (response.ok) break;
    await new Promise((r) => setTimeout(r, response?.status === 429 ? 2000 : 350));
  }
  expect(response?.ok, "Login failed").toBeTruthy();
  await page.context().addCookies(response!.headers.getSetCookie().map((e) => parseSetCookie(e, origin)));
}

async function seedFixture() {
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: { name: "E2E Tracking Link", billingStatus: "ACTIVE", plan: "GROWTH", baseCurrency: "UGX", supportedCurrencies: "UGX", trackingLinksEnabled: true },
    create: { slug: ORG_SLUG, name: "E2E Tracking Link", billingStatus: "ACTIVE", plan: "GROWTH", baseCurrency: "UGX", supportedCurrencies: "UGX", trackingLinksEnabled: true },
  });
  await prisma.orgModuleGrant.deleteMany({ where: { orgId: org.id } });
  await prisma.orgModuleGrant.createMany({ data: Object.values(OrgModule).map((module) => ({ orgId: org.id, module })) });
  const user = await prisma.user.upsert({
    where: { email: "tracking-link-admin@example.invalid" },
    update: { orgId: org.id, role: "ADMIN", isActive: true, emailVerified: true },
    create: { orgId: org.id, name: "Tracking Link Admin", email: "tracking-link-admin@example.invalid", role: "ADMIN", isActive: true, emailVerified: true },
  });
  await ensureAccount(user.id);
  await prisma.notificationPreferences.upsert({
    where: { userId: user.id },
    update: { whatsappEnabled: true, notifyStatusChange: true },
    create: { userId: user.id, whatsappEnabled: true, notifyStatusChange: true },
  });
  const client = await prisma.client.upsert({
    where: { phone_orgId: { phone: "08025550006", orgId: org.id } },
    update: { fullName: "Track Client" },
    create: { orgId: org.id, fullName: "Track Client", phone: "08025550006" },
  });
  const job = await prisma.job.upsert({
    where: { jobNumber: "E2E-TRACK-0001" },
    update: { orgId: org.id, clientId: client.id, createdById: user.id, status: "RECEIVED" },
    create: {
      orgId: org.id, jobNumber: "E2E-TRACK-0001", status: "RECEIVED", repairPath: "IN_HOUSE",
      clientId: client.id, createdById: user.id, deviceType: "PHONE_ANDROID",
      brand: "Tecno", model: "Spark", issueDescription: "Screen",
    },
  });
  const job2 = await prisma.job.upsert({
    where: { jobNumber: "E2E-TRACK-0002" },
    update: { orgId: org.id, clientId: client.id, createdById: user.id, status: "RECEIVED" },
    create: {
      orgId: org.id, jobNumber: "E2E-TRACK-0002", status: "RECEIVED", repairPath: "IN_HOUSE",
      clientId: client.id, createdById: user.id, deviceType: "PHONE_ANDROID",
      brand: "Tecno", model: "Spark", issueDescription: "Battery",
    },
  });
  await prisma.outboundMessage.deleteMany({ where: { orgId: org.id, jobId: { in: [job.id, job2.id] } } });
  return { org, user, job, job2 };
}

test("status change carries the tracking link; opt-out removes it", async ({ page }) => {
  const { org, user, job, job2 } = await seedFixture();
  await login(page, user.email);

  await page.goto(`/jobs/${job.id}`);
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("button", { name: "Start diagnosis" }).click();

  await expect
    .poll(async () => prisma.outboundMessage.count({
      where: { jobId: job.id, body: { contains: `/status/${job.jobNumber}` } },
    }), { timeout: 30000 })
    .toBeGreaterThan(0);

  // Opt out: the same trigger on a fresh job now sends without the link.
  await prisma.organization.update({ where: { id: org.id }, data: { trackingLinksEnabled: false } });
  await page.goto(`/jobs/${job2.id}`);
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("button", { name: "Start diagnosis" }).click();
  await expect
    .poll(async () => prisma.outboundMessage.count({ where: { jobId: job2.id } }), { timeout: 30000 })
    .toBeGreaterThan(0);
  const rows = await prisma.outboundMessage.findMany({ where: { jobId: job2.id }, select: { body: true } });
  expect(rows.every((r) => !r.body.includes("/status/"))).toBe(true);
  await prisma.organization.update({ where: { id: org.id }, data: { trackingLinksEnabled: true } });
});

test.afterAll(async () => {
  await destroyE2eOrg(prisma, ORG_SLUG);
});
