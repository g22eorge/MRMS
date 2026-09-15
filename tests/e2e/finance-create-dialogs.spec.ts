import { expect, test, type Cookie, type Page } from "@playwright/test";

/**
 * The reported defect, as a click test.
 *
 * "The new expense button remains stagnant or it brings an object that remains
 * hidden and not usable." Both halves were true and they had different causes:
 *
 *  - It was `stagnant` because the popup was an absolutely-positioned panel
 *    inside a header card that declared `overflow-hidden`. The panel stayed in
 *    the DOM and stayed invisible.
 *  - It was `not usable` because a rejected save redirected to `?error=...`,
 *    which re-rendered the page with the popup shut, so the reason for the
 *    rejection was never visible.
 *
 * A unit test can assert the markup that caused this; only a browser can assert
 * that the panel is on screen and its submit button is reachable. That is what
 * this spec does, for the three finance create controls.
 *
 * It writes nothing: the rejection case uses a whitespace-only description,
 * which passes the HTML `required` attribute and is then trimmed to "" by the
 * action — the exact silent-failure path the action now reports.
 */

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin@eagle.local";
const password = process.env.E2E_PASSWORD ?? process.env.SEED_PASSWORD ?? "Admin123!";
const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";

function parseSetCookie(setCookie: string, origin: URL): Cookie {
  const [nameValue, ...attributes] = setCookie.split(";").map((value) => value.trim());
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

async function login(page: Page) {
  const origin = new URL(baseUrl);
  let response: Response | null = null;
  let failureNote = "";
  for (let attempt = 1; attempt <= 15; attempt += 1) {
    response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", origin: baseUrl },
      body: JSON.stringify({ email: adminEmail, password, callbackURL: "/dashboard" }),
    });
    if (response.ok) break;
    failureNote = `status=${response.status} body=${(await response.clone().text()).slice(0, 240)}`;
    await new Promise((resolve) => setTimeout(resolve, response?.status === 429 ? 2000 : 350));
  }
  expect(response?.ok, failureNote).toBeTruthy();
  await page.context().addCookies(response!.headers.getSetCookie().map((entry) => parseSetCookie(entry, origin)));
}

/** The panel must be on screen, not merely in the DOM. */
async function expectPanelOnScreen(page: Page, submitLabel: string) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const size = page.viewportSize();
  const panel = await dialog.boundingBox();
  expect(panel, "the dialog has no box — it is in the DOM but not laid out").toBeTruthy();
  expect(panel!.width).toBeGreaterThan(200);
  expect(panel!.height).toBeGreaterThan(80);
  if (size) {
    // The failure mode was a panel pushed outside the clipped card and out of
    // reach. Anything outside the viewport is the same defect wearing a fix.
    expect(panel!.x, "panel starts off the left edge").toBeGreaterThanOrEqual(0);
    expect(panel!.y, "panel starts above the viewport").toBeGreaterThanOrEqual(0);
    expect(panel!.x + panel!.width, "panel runs off the right edge").toBeLessThanOrEqual(size.width + 1);
  }

  // And the control that finishes the job has to be clickable.
  const submit = dialog.getByRole("button", { name: submitLabel });
  await expect(submit).toBeVisible();
  await expect(submit).toBeEnabled();
}

const CONTROLS = [
  { path: "/finance/expenses", trigger: "+ Record Expense", heading: "Record Business Expense", submit: "Save Expense" },
  { path: "/finance/tax-rates", trigger: "+ Add Tax Rate", heading: "New Tax Rate", submit: "Create Tax Rate" },
  { path: "/finance/recurring", trigger: "+ New Template", heading: "New Recurring Invoice", submit: "Create Template" },
];

for (const control of CONTROLS) {
  test(`${control.path}: the create control opens a panel on screen`, async ({ page }) => {
    await login(page);
    await page.goto(control.path);
    await page.waitForLoadState("networkidle");

    // The trigger must be there and clickable before anything else.
    const trigger = page.getByRole("button", { name: control.trigger });
    await expect(trigger).toBeVisible();
    await expect(trigger).toBeEnabled();

    await trigger.click();
    await expect(page.getByRole("dialog").getByText(control.heading, { exact: false })).toBeVisible();
    await expectPanelOnScreen(page, control.submit);

    // Escape closes it — a panel you cannot dismiss is its own trap.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });
}

test("/finance/expenses: a rejected expense says why, inside the panel", async ({ page }) => {
  await login(page);
  await page.goto("/finance/expenses");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "+ Record Expense" }).click();
  await expectPanelOnScreen(page, "Save Expense");

  // Whitespace passes the HTML `required` attribute and is trimmed to "" by the
  // action, which is precisely the input that used to save nothing and say
  // nothing.
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("e.g. Office rent — April").fill("   ");
  await dialog.getByPlaceholder("0.00").fill("100");
  await dialog.getByRole("button", { name: "Save Expense" }).click();

  // The panel must stay open with the reason visible, not vanish.
  await expect(dialog.getByText("Enter a description for this expense.")).toBeVisible();
  await expect(dialog).toBeVisible();
});