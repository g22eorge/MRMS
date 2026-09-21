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

test("receipts: the source-picker dropdown is not clipped by the modal panel", async ({ page }) => {
  await login(page);
  await page.goto("/documents/receipts");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "+ Receipt" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // The picker lives inside the panel whose class string is
  // `panel-shadow relative z-10 w-full overflow-hidden ...`. While the dropdown
  // was an absolutely-positioned child of the picker, that overflow-hidden was its
  // containing block, and it clipped the list the moment it grew past the input.
  // No search term: focus opens the list with every outstanding source,
  // whatever the seed text is; the option count below still fails loudly when
  // none exist.
  const listbox = page.getByRole("listbox");
  const input = dialog.getByPlaceholder(/Search by customer, invoice or sale number/);
  await input.click();
  await expect(listbox).toBeVisible();

  const options = listbox.getByRole("option");
  expect(await options.count(), "nothing outstanding matched — seed a sale or invoice first").toBeGreaterThan(0);

  const report = await listbox.evaluate((b) => {
    const box = (b as HTMLElement).getBoundingClientRect();
    const panel = (b as HTMLElement).closest(".panel-shadow") as HTMLElement | null;
    const pr = panel ? panel.getBoundingClientRect() : null;
    const cx = box.left + box.width / 2;
    const hit = document.elementFromPoint(cx, box.bottom - 3);
    return {
      box: {
        top: Math.round(box.top),
        bottom: Math.round(box.bottom),
        left: Math.round(box.left),
        right: Math.round(box.right),
      },
      // null means the dropdown is no longer a descendant of `.panel-shadow`, so
      // there is no panel edge it could have been clipped against.
      overflowPastPanelRight: pr ? Math.round(box.right - pr.right) : null,
      overflowPastPanelBottom: pr ? Math.round(box.bottom - pr.bottom) : null,
      bottomPointHitsDropdown: !!(hit && b.contains(hit)),
    };
  });

  // The dropdown must be fully reachable: probing the bottom edge of the listbox
  // must land on the dropdown itself, not on whatever sits behind it (which is
  // what the clipped list looked like).
  expect(report.bottomPointHitsDropdown, "dropdown bottom edge is clipped by the modal panel's overflow-hidden").toBe(true);

  // The dropdown is portaled to document.body with position:fixed, so it is no
  // longer a child of .panel-shadow and cannot be clipped by its overflow rule.
  expect(report.overflowPastPanelBottom).toBe(null);
  expect(report.overflowPastPanelRight).toBe(null);

  // And the dropdown must be within the viewport, not pushed out of bounds.
  const size = page.viewportSize();
  if (size) {
    expect(report.box.right, "dropdown runs off the right edge").toBeLessThanOrEqual(size.width);
    expect(report.box.bottom, "dropdown runs off the bottom edge").toBeLessThanOrEqual(size.height);
  }
});

test("delivery notes: the source-picker list flips above the input when it sits at the window's bottom edge", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1280, height: 380 });
  await login(page);
  await page.goto("/documents/delivery-notes");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Create Delivery Note" }).click();
  const input = page.getByPlaceholder("Search invoices and sales by customer, number or job…");
  await input.click();
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  const options = listbox.getByRole("option");
  expect(await options.count(), "no invoice or sale sources — seed documents first").toBeGreaterThan(0);

  // Park the input 20px above the bottom edge of the window. The room below
  // (8px once the gap and margin are paid) can never fit the list, so the
  // picker must flip it above the input instead of anchoring it past the
  // bottom edge, where no scroll could reach it.
  await input.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const target = window.innerHeight - 20;
    let scrolled = false;
    let ancestor: HTMLElement | null = el.parentElement;
    while (ancestor) {
      if (ancestor.scrollHeight > ancestor.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(ancestor).overflowY)) {
        ancestor.scrollTop += r.bottom - target;
        scrolled = true;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    if (!scrolled) window.scrollBy(0, r.bottom - target);
  });
  // The picker re-caps its fixed list on scroll (capture phase, so container
  // scrolls count). Settled means: inside the window and clear of the input —
  // which can only hold once that reposition has actually applied.
  await page
    .waitForFunction(
      () => {
        const list = document.querySelector('[role="listbox"]') as HTMLElement | null;
        const combo = document.querySelector('[role="combobox"]') as HTMLElement | null;
        if (!list || !combo) return false;
        const lb = list.getBoundingClientRect();
        const cb = combo.getBoundingClientRect();
        const withinWindow = lb.top >= -1 && lb.bottom <= window.innerHeight + 1;
        const clearOfInput = lb.bottom <= cb.top + 1 || lb.top >= cb.bottom - 1;
        return withinWindow && clearOfInput;
      },
      undefined,
      { timeout: 15000 },
    )
    .catch(() => {
      throw new Error("the list never settled inside the window and clear of the input after the scroll");
    });

  const m = await page.evaluate(() => {
    const list = document.querySelector('[role="listbox"]') as HTMLElement;
    const combo = document.querySelector('[role="combobox"]') as HTMLElement;
    const lb = list.getBoundingClientRect();
    const cb = combo.getBoundingClientRect();
    return {
      listTop: Math.round(lb.top),
      listBottom: Math.round(lb.bottom),
      listHeight: Math.round(lb.height),
      inputTop: Math.round(cb.top),
      inputBottom: Math.round(cb.bottom),
      innerHeight: window.innerHeight,
    };
  });

  // The scroll must actually have parked the input at the bottom edge, or this
  // test would pass vacuously.
  expect(
    Math.abs(m.inputBottom - (m.innerHeight - 20)),
    "could not park the picker input at the bottom edge — no scrollable container?",
  ).toBeLessThanOrEqual(4);

  // Absolute invariants: the fixed list sits above the input, fully inside the
  // window. (scrollHeight exceeding the cap is correct — the list scrolls; the
  // defect was rows laid out outside the window, which no scroll can reach.)
  expect(m.listTop, "list starts above the window").toBeGreaterThanOrEqual(0);
  expect(m.listBottom, "list hangs past the bottom of the window").toBeLessThanOrEqual(m.innerHeight + 1);
  expect(m.listBottom, "list opened downward past an input parked at the bottom edge instead of flipping up").toBeLessThanOrEqual(m.inputTop + 1);
  expect(m.listHeight, "the cap grew past its ceiling").toBeLessThanOrEqual(288);
});
