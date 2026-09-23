/**
 * E2E: Expense payment button (regression).
 *
 * The row-menu "Record payment" form must submit and record: amount + date +
 * method in, ExpensePayment row + paidAmount rollup out. Guards against the
 * reported dead-button failure (native constraints silently refusing submit).
 */
import { expect, test, type Cookie, type Page } from "@playwright/test";
import { OrgModule, PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { destroyE2eOrg } from "./fixtures/destroy-org";

process.env.DATABASE_URL = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;

const prisma = new PrismaClient();
const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const password = process.env.E2E_PASSWORD ?? "ExpensePay123!";

const ORG_SLUG = "e2e-expense-pay";

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

test("expense row-menu payment records and rolls up", async ({ page }) => {
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: { name: "E2E Expense Pay", billingStatus: "ACTIVE", plan: "GROWTH", baseCurrency: "UGX", supportedCurrencies: "UGX" },
    create: { slug: ORG_SLUG, name: "E2E Expense Pay", billingStatus: "ACTIVE", plan: "GROWTH", baseCurrency: "UGX", supportedCurrencies: "UGX" },
  });
  await prisma.orgModuleGrant.deleteMany({ where: { orgId: org.id } });
  await prisma.orgModuleGrant.createMany({ data: Object.values(OrgModule).map((module) => ({ orgId: org.id, module })) });
  const user = await prisma.user.upsert({
    where: { email: "expense-pay-admin@example.invalid" },
    update: { orgId: org.id, role: "ADMIN", isActive: true, emailVerified: true },
    create: { orgId: org.id, name: "Expense Pay Admin", email: "expense-pay-admin@example.invalid", role: "ADMIN", isActive: true, emailVerified: true },
  });
  await ensureAccount(user.id);

  const expense = await prisma.expense.upsert({
    where: { expenseNumber: "E2E-EXP-PAY-0001" },
    update: { orgId: org.id, description: "E2E power bill", amount: 90000, paidAmount: 0, paidAt: null, createdById: user.id },
    create: { orgId: org.id, expenseNumber: "E2E-EXP-PAY-0001", description: "E2E power bill", amount: 90000, paidAmount: 0, createdById: user.id },
  });
  await prisma.expensePayment.deleteMany({ where: { expenseId: expense.id } });

  await login(page, user.email);
  await page.goto("/finance/expenses?q=E2E-EXP-PAY-0001");
  await page.waitForLoadState("domcontentloaded");

  // Open the row's ⋯ menu and submit the payment form inside it.
  const menu = page.getByRole("button", { name: "Expense actions" }).first();
  await expect(menu).toBeVisible();
  await menu.scrollIntoViewIfNeeded();
  await menu.click();
  const amount = page.locator('input[name="amount"]');
  await expect(amount).toBeVisible();
  await amount.fill("40000");
  await page.getByRole("button", { name: "Record payment", exact: true }).click();

  // Payment recorded and rolled up — the button did its job. Generous timeout:
  // on a cold server the first action round-trip compiles the route.
  await expect
    .poll(async () => prisma.expensePayment.count({ where: { expenseId: expense.id } }), { timeout: 30000 })
    .toBe(1);
  const fresh = await prisma.expense.findUniqueOrThrow({ where: { id: expense.id } });
  expect(fresh.paidAmount).toBe(40000);
  expect(fresh.paidAt).toBeNull(); // part payment leaves it open
});

test.afterAll(async () => {
  await destroyE2eOrg(prisma, ORG_SLUG);
});
