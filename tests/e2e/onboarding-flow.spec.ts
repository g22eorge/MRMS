/**
 * E2E: Fresh registration → onboarding → dashboard (commercial path).
 *
 * A brand-new user must go register → workspace setup → working dashboard
 * with no global-error page. Guards the reported app.* failure where new
 * registrations died on the dashboard redirect.
 */
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { destroyE2eOrg } from "./fixtures/destroy-org";

process.env.DATABASE_URL = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;

const prisma = new PrismaClient();
const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";

const SHOP = "E2E Onboard Shop";
const SLUG = "e2e-onboard-shop";
const EMAIL = "e2e-onboarding-flow@example.invalid";
const PASSWORD = "Onboard123!";

test.beforeAll(async () => {
  await destroyE2eOrg(prisma, SLUG).catch(() => undefined);
  await prisma.user.deleteMany({ where: { email: EMAIL } });
});

test("register → workspace → dashboard with no error page", async ({ page }) => {
  await page.goto(`${baseUrl}/register`);
  await page.locator('input[name="name"]').fill("E2E Onboarder");
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').first().fill(PASSWORD);
  await page.locator('input[name="confirmPassword"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await page.waitForURL("**/onboarding**", { timeout: 30000 });

  // Step 1: business name.
  await page.locator('input[name="businessName"]').fill(SHOP);
  await page.getByRole("button", { name: /Next: Choose modules/ }).click();

  // Step 2: modules preselected (INVOICING + REPORTS) — continue.
  await page.getByRole("button", { name: /Next: Review plan/ }).click();

  // Step 3: launch.
  await page.getByRole("button", { name: /Launch my workspace/ }).click();
  await page.waitForURL("**/dashboard**", { timeout: 30000 });

  // The reported failure showed the global error page instead.
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
  await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible();

  // Workspace fully provisioned.
  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: SLUG } });
  const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
  expect(user.orgId).toBe(org.id);
  expect(user.role).toBe("ADMIN");
  await expect
    .poll(async () => prisma.documentBrandingSettings.count({ where: { orgId: org.id } }))
    .toBe(1);
  expect(await prisma.orgModuleGrant.count({ where: { orgId: org.id } })).toBeGreaterThan(0);
});

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await destroyE2eOrg(prisma, SLUG);
});
