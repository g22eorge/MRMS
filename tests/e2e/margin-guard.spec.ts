/**
 * E2E: Below-cost guard (margin protection).
 *
 * A part-linked quotation line priced (after discount) below the part's cost
 * is rejected; the same line at a profitable discount succeeds. The selling-
 * price floor is pre-discount, so only the cost guard catches deep discounts.
 */
import { expect, test, type Cookie, type Page } from "@playwright/test";
import { OrgModule, PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { destroyE2eOrg } from "./fixtures/destroy-org";

process.env.DATABASE_URL = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;

const prisma = new PrismaClient();
const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const password = process.env.E2E_PASSWORD ?? "Margin123!";

const ORG_SLUG = "e2e-margin-guard";

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

async function postQuotation(page: Page, body: unknown) {
  return page.evaluate(async ({ url, payload }) => {
    const response = await fetch(`${url}/api/quotations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: await response.text() };
  }, { url: baseUrl, payload: body });
}

test("discount below cost is rejected, profitable discount passes", async ({ page }) => {
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: { name: "E2E Margin Guard", billingStatus: "ACTIVE", plan: "GROWTH", baseCurrency: "UGX", supportedCurrencies: "UGX" },
    create: { slug: ORG_SLUG, name: "E2E Margin Guard", billingStatus: "ACTIVE", plan: "GROWTH", baseCurrency: "UGX", supportedCurrencies: "UGX" },
  });
  await prisma.orgModuleGrant.deleteMany({ where: { orgId: org.id } });
  await prisma.orgModuleGrant.createMany({ data: Object.values(OrgModule).map((module) => ({ orgId: org.id, module })) });
  const user = await prisma.user.upsert({
    where: { email: "margin-guard-admin@example.invalid" },
    update: { orgId: org.id, role: "ADMIN", isActive: true, emailVerified: true },
    create: { orgId: org.id, name: "Margin Guard Admin", email: "margin-guard-admin@example.invalid", role: "ADMIN", isActive: true, emailVerified: true },
  });
  await ensureAccount(user.id);
  const part = await prisma.part.upsert({
    where: { sku_orgId: { sku: "E2E-MARGIN-01", orgId: org.id } },
    update: { name: "E2E Margin Part", qtyOnHand: 10, unitCost: 50000, sellingPrice: 60000, isActive: true },
    create: { orgId: org.id, sku: "E2E-MARGIN-01", name: "E2E Margin Part", qtyOnHand: 10, unitCost: 50000, sellingPrice: 60000, isActive: true },
  });

  await login(page, user.email);
  await page.goto(`${baseUrl}/dashboard`);
  await page.waitForLoadState("domcontentloaded");

  const line = (discount: number) => ({
    newClient: { fullName: "Margin Client", phone: "08025550004" },
    currency: "UGX",
    items: [{ partId: part.id, description: "E2E Margin Part", quantity: 1, unitPrice: 60000, discount }],
  });

  // 20% off 60000 = 48000 effective < 50000 cost → rejected (floor passes: 60000 >= 60000).
  const rejected = await postQuotation(page, line(20));
  expect(rejected.status).toBe(400);
  expect(rejected.body).toContain("below its cost");

  // 10% off = 54000 effective >= 50000 cost → created.
  const accepted = await postQuotation(page, line(10));
  expect(accepted.status).toBe(201);

  // Foreign currency is judged in base terms: $16.50 × 3700 = 61050 clears the
  // 60000 floor and the 50000 cost → created; with 20% off the effective 48840
  // falls under cost → rejected.
  const usdLine = (discount: number) => ({
    newClient: { fullName: "Margin USD Client", phone: "08025550005" },
    currency: "USD",
    exchangeRate: 3700,
    items: [{ partId: part.id, description: "E2E Margin Part", quantity: 1, unitPrice: 16.5, discount }],
  });
  const usdOk = await postQuotation(page, usdLine(0));
  expect(usdOk.status).toBe(201);
  const usdBad = await postQuotation(page, usdLine(20));
  expect(usdBad.status).toBe(400);
  expect(usdBad.body).toContain("below its cost");
});

test.afterAll(async () => {
  await destroyE2eOrg(prisma, ORG_SLUG);
});
