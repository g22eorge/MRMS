/**
 * E2E: Lead → customer conversion (CRM productivity).
 *
 * A WON lead converts to a customer without re-typing: dedupe on phone,
 * client created from lead fields, lead.clientId stamped, conversion logged.
 */
import { expect, test, type Cookie, type Page } from "@playwright/test";
import { OrgModule, PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { destroyE2eOrg } from "./fixtures/destroy-org";

process.env.DATABASE_URL = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;

const prisma = new PrismaClient();
const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const password = process.env.E2E_PASSWORD ?? "Convert123!";

const ORG_SLUG = "e2e-lead-convert";

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

test("WON lead converts to a customer without re-typing", async ({ page }) => {
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: { name: "E2E Lead Convert", billingStatus: "ACTIVE", plan: "GROWTH", baseCurrency: "UGX", supportedCurrencies: "UGX" },
    create: { slug: ORG_SLUG, name: "E2E Lead Convert", billingStatus: "ACTIVE", plan: "GROWTH", baseCurrency: "UGX", supportedCurrencies: "UGX" },
  });
  await prisma.orgModuleGrant.deleteMany({ where: { orgId: org.id } });
  await prisma.orgModuleGrant.createMany({ data: Object.values(OrgModule).map((module) => ({ orgId: org.id, module })) });
  const user = await prisma.user.upsert({
    where: { email: "lead-convert-admin@example.invalid" },
    update: { orgId: org.id, role: "ADMIN", isActive: true, emailVerified: true },
    create: { orgId: org.id, name: "Lead Convert Admin", email: "lead-convert-admin@example.invalid", role: "ADMIN", isActive: true, emailVerified: true },
  });
  await ensureAccount(user.id);

  const lead = await prisma.lead.upsert({
    where: { id: "e2e-convert-lead-0001" },
    update: { orgId: org.id, fullName: "Convert Client", phone: "08025550003", email: "convert-client@example.invalid", status: "WON", convertedAt: new Date(), clientId: null, createdById: user.id },
    create: { id: "e2e-convert-lead-0001", orgId: org.id, fullName: "Convert Client", phone: "08025550003", email: "convert-client@example.invalid", status: "WON", convertedAt: new Date(), createdById: user.id },
  });
  await prisma.client.deleteMany({ where: { orgId: org.id, phone: "08025550003" } });

  await login(page, user.email);
  await page.goto(`/sales/leads/${lead.id}`);
  await page.waitForLoadState("domcontentloaded");

  await page.getByRole("button", { name: "Convert to customer" }).click();
  await page.waitForURL(/\/clients\/[^/?#]+/, { timeout: 30000 });

  // Customer exists from lead fields, lead stamped, conversion logged.
  const client = await prisma.client.findFirstOrThrow({ where: { orgId: org.id, phone: "08025550003" } });
  expect(client.fullName).toBe("Convert Client");
  expect(page.url()).toContain(`/clients/${client.id}`);
  const fresh = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
  expect(fresh.clientId).toBe(client.id);
  await expect
    .poll(async () => prisma.leadActivity.count({ where: { leadId: lead.id, type: "CONVERSION" } }))
    .toBe(1);
});

test.afterAll(async () => {
  await destroyE2eOrg(prisma, ORG_SLUG);
});
