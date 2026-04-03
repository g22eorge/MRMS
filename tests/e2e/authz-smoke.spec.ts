import { expect, test, type Cookie, type Page } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin@eagle.local";
const externalTechEmail = process.env.E2E_EXTERNAL_EMAIL ?? "tech.external@eagle.local";
const password = process.env.E2E_PASSWORD ?? process.env.SEED_PASSWORD ?? "Admin123!";
const baseUrl = process.env.E2E_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function parseSetCookie(setCookie: string, origin: URL): Cookie {
  const [nameValue, ...attributes] = setCookie.split(";").map((value) => value.trim());
  const [name, ...valueParts] = nameValue.split("=");

  const cookie: Cookie = {
    name,
    value: valueParts.join("="),
    domain: origin.hostname,
    path: "/",
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  };

  for (const attribute of attributes) {
    const [keyRaw, ...rawValue] = attribute.split("=");
    const key = keyRaw.toLowerCase();
    const value = rawValue.join("=");

    if (key === "path" && value) cookie.path = value;
    if (key === "domain" && value) cookie.domain = value;
    if (key === "httponly") cookie.httpOnly = true;
    if (key === "secure") cookie.secure = true;
    if (key === "samesite" && (value === "Lax" || value === "Strict" || value === "None")) {
      cookie.sameSite = value;
    }
    if (key === "max-age" && value) {
      const seconds = Number(value);
      if (Number.isFinite(seconds)) cookie.expires = Math.floor(Date.now() / 1000) + seconds;
    }
  }

  return cookie;
}

async function login(page: Page, email: string) {
  const origin = new URL(baseUrl);
  const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, callbackURL: "/dashboard" }),
  });

  expect(response.ok).toBeTruthy();

  const cookies = response.headers.getSetCookie().map((entry) => parseSetCookie(entry, origin));
  await page.context().addCookies(cookies);

  await page.goto("/dashboard");
  await page.waitForURL("**/dashboard");
}

test("admin sees admin navigation and can open user settings", async ({ page }) => {
  await login(page, adminEmail);

  await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Branding" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Clients" })).toBeVisible();

  await page.getByRole("link", { name: "Users" }).click();
  await page.waitForURL("**/settings/users");
  await expect(page.getByRole("button", { name: "Create User" })).toBeVisible();
});

test("external technician is restricted from client-identifying views", async ({ page }) => {
  await login(page, externalTechEmail);

  await expect(page.getByRole("link", { name: "My Jobs" })).toBeVisible();
  await expect(page.getByRole("link", { name: "My Payouts" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Clients" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Reports" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);

  await page.goto("/jobs");
  await expect(page.getByPlaceholder("Search job #")).toBeVisible();
  await expect(page.getByPlaceholder("Search job # or client")).toHaveCount(0);

  await page.getByRole("link", { name: "Open" }).first().click();
  await expect(page.getByText("External Diagnosis")).toBeVisible();
  await expect(page.getByRole("button", { name: "client" })).toHaveCount(0);
  await expect(page.getByText("Revenue Demo Client")).toHaveCount(0);
  await expect(page.getByText("Amina Yusuf")).toHaveCount(0);
});
