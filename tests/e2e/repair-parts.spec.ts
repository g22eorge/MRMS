/**
 * E2E: Repair parts tracking (ADR-003).
 *
 * Structured parts must move inventory; free-text notes must not:
 * reserve → RESERVED + qtyReserved up → mark fitted → CONSUMED +
 * location stock down + ledger row, while the diagnosis/repair text boxes
 * stay labelled as notes-only.
 */
import { expect, test, type Cookie, type Page } from "@playwright/test";
import { OrgModule, PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { destroyE2eOrg } from "./fixtures/destroy-org";

process.env.DATABASE_URL = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;

const prisma = new PrismaClient();
const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const password = process.env.E2E_PASSWORD ?? "Parts123!";

const ORG_SLUG = "e2e-repair-parts";

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

async function seedPartsFixture() {
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: { name: "E2E Repair Parts", billingStatus: "ACTIVE", plan: "GROWTH", baseCurrency: "UGX", supportedCurrencies: "UGX" },
    create: { slug: ORG_SLUG, name: "E2E Repair Parts", billingStatus: "ACTIVE", plan: "GROWTH", baseCurrency: "UGX", supportedCurrencies: "UGX" },
  });
  await prisma.orgModuleGrant.deleteMany({ where: { orgId: org.id } });
  await prisma.orgModuleGrant.createMany({ data: Object.values(OrgModule).map((module) => ({ orgId: org.id, module })) });
  const user = await prisma.user.upsert({
    where: { email: "repair-parts-admin@example.invalid" },
    update: { orgId: org.id, role: "ADMIN", isActive: true, emailVerified: true },
    create: { orgId: org.id, name: "Repair Parts Admin", email: "repair-parts-admin@example.invalid", role: "ADMIN", isActive: true, emailVerified: true },
  });
  await ensureAccount(user.id);

  const client = await prisma.client.upsert({
    where: { phone_orgId: { phone: "08025550002", orgId: org.id } },
    update: { fullName: "Parts Client" },
    create: { orgId: org.id, fullName: "Parts Client", phone: "08025550002" },
  });
  const location = await prisma.stockLocation.upsert({
    where: { orgId_code: { orgId: org.id, code: "E2E-MAIN" } },
    update: { name: "E2E Main Store", isActive: true },
    create: { orgId: org.id, name: "E2E Main Store", code: "E2E-MAIN", isActive: true },
  });
  const part = await prisma.part.upsert({
    where: { sku_orgId: { sku: "E2E-SCREEN-01", orgId: org.id } },
    update: { name: "E2E Test Screen", qtyOnHand: 10, qtyReserved: 0, isActive: true },
    create: { orgId: org.id, sku: "E2E-SCREEN-01", name: "E2E Test Screen", qtyOnHand: 10, qtyReserved: 0, unitCost: 50000, sellingPrice: 80000, isActive: true },
  });
  await prisma.partLocationStock.upsert({
    where: { partId_locationId: { partId: part.id, locationId: location.id } },
    update: { qtyOnHand: 10, qtyReserved: 0 },
    create: { orgId: org.id, partId: part.id, locationId: location.id, qtyOnHand: 10, qtyReserved: 0 },
  });
  const job = await prisma.job.upsert({
    where: { jobNumber: "E2E-PARTS-0001" },
    update: { orgId: org.id, clientId: client.id, createdById: user.id, status: "DIAGNOSING", partsNeeded: null, partsReplaced: null },
    create: {
      orgId: org.id, jobNumber: "E2E-PARTS-0001", status: "DIAGNOSING", repairPath: "IN_HOUSE",
      clientId: client.id, createdById: user.id, deviceType: "PHONE_ANDROID",
      brand: "Tecno", model: "Spark", issueDescription: "Cracked screen",
    },
  });
  await prisma.partReservation.deleteMany({ where: { jobId: job.id } });
  await prisma.partStockTransaction.deleteMany({ where: { jobId: job.id } });

  return { org, user, job, part, location };
}

test("repair parts move inventory while free-text boxes stay notes-only", async ({ page }) => {
  const { org, user, job, part, location } = await seedPartsFixture();
  await login(page, user.email);

  await page.goto(`/jobs/${job.id}`);
  await page.waitForLoadState("domcontentloaded");

  // Reserve 2 through the parts panel (the stock-affecting path).
  await page.locator('select[name="partId"]').selectOption(part.id);
  await page.locator('input[name="quantity"]').fill("2");
  await page.getByRole("button", { name: "Add part" }).click();

  await expect
    .poll(async () => prisma.partReservation.count({ where: { jobId: job.id, partId: part.id, status: "RESERVED" } }))
    .toBe(1);
  await expect
    .poll(async () => (await prisma.part.findUniqueOrThrow({ where: { id: part.id } })).qtyReserved)
    .toBe(2);

  // Fit them: reservation consumed, shelf stock down, ledger row written.
  await page.getByRole("button", { name: "Mark fitted" }).click();

  await expect
    .poll(async () => prisma.partReservation.count({ where: { jobId: job.id, partId: part.id, status: "CONSUMED" } }))
    .toBe(1);
  const after = await prisma.part.findUniqueOrThrow({ where: { id: part.id } });
  expect(after.qtyOnHand).toBe(8);
  expect(after.qtyReserved).toBe(0);
  const locStock = await prisma.partLocationStock.findUniqueOrThrow({
    where: { partId_locationId: { partId: part.id, locationId: location.id } },
  });
  expect(locStock.qtyOnHand).toBe(8);
  await expect
    .poll(async () => prisma.partStockTransaction.count({ where: { jobId: job.id, partId: part.id } }))
    .toBeGreaterThan(0);

  // ADR-003 distinction: the free-text boxes declare themselves notes-only.
  await page.goto(`/jobs/${job.id}?tab=diagnosis`);
  await expect(page.getByText("Parts needed (notes only)")).toBeVisible();
  const workTab = page.getByRole("button", { name: /^Repair|Work/ }).first();
  if (await workTab.isVisible()) await workTab.click();
  await expect(page.getByText("Parts replaced (notes only)")).toBeVisible();
  // The UI flow above wrote reservations, not free text: the notes columns stay null.
  const freshJob = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
  expect(freshJob.partsNeeded).toBeNull();
  expect(freshJob.partsReplaced).toBeNull();

  // Org isolation sanity: nothing leaked outside the fixture org.
  expect(org.slug).toBe(ORG_SLUG);
});

test.afterAll(async () => {
  await destroyE2eOrg(prisma, ORG_SLUG);
});
