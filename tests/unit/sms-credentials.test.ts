import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

// The real rule, not a copy of it — a mirrored validator in a test proves only
// that the mirror is self-consistent.
// From the pure module, not the sender: importing sms.ts reaches platform
// settings and therefore Prisma, and a live client in the test process passed
// every assertion and then aborted on exit.
import {
  senderIdProblem, atApiBase, isSandboxUsername, atStatusAccepted, atStatusExplanation,
} from "@/lib/notifications/sms-format";

/**
 * SMS credentials entered in the platform settings form, and never used.
 *
 * The owner added Africa's Talking credentials and could not tell whether they
 * worked. They did not, and could not have: saveAtSettingsAction writes
 * AT_API_KEY, AT_USERNAME and AT_SENDER_ID to PlatformSetting, while
 * getAtConfig read only the per-org config row and process.env. The database
 * tier did not exist on the read side.
 *
 * The settings page then showed a green tick, because the page reads the same
 * table the form wrote to. So the interface confirmed the thing it had not
 * checked, every SMS was dropped with "SMS not configured", and nothing
 * anywhere said why — the same defect as the Pesapal credentials, in the
 * integration directly beside it, and with the same misleading confirmation.
 */

const SMS = readFileSync("lib/notifications/sms.ts", "utf8");
const SETTINGS = readFileSync("lib/platform-settings.ts", "utf8");
const ACTIONS = readFileSync("app/(platform)/platform/settings/actions.ts", "utf8");
const HEALTH = readFileSync("app/api/admin/sms-health/route.ts", "utf8");

describe("what the form writes is what the sender reads", () => {
  it("the form still writes all three keys to the settings store", () => {
    for (const k of ["AT_API_KEY", "AT_USERNAME", "AT_SENDER_ID"]) {
      expect(ACTIONS).toContain(`setPlatformSetting("${k}"`);
    }
  });

  it("and the sender now reads that store", () => {
    // The missing tier. Without it the value was stored and inert.
    for (const fn of ["getAtApiKey", "getAtUsername", "getAtSenderId"]) {
      expect(SETTINGS).toContain(`export async function ${fn}()`);
      expect(SMS).toContain(fn);
    }
  });

  it("keeps the environment as a fallback rather than replacing it", () => {
    expect(SETTINGS).toContain("process.env.AT_API_KEY");
    expect(SETTINGS).toContain("process.env.AT_USERNAME");
  });

  it("no longer reaches for process.env from the sender itself", () => {
    // Reading env directly there is what let the database tier be skipped.
    expect(SMS).not.toContain("process.env.AT_API_KEY");
    expect(SMS).not.toContain("process.env.AT_USERNAME");
  });

  it("still lets a tenant's own credentials win", () => {
    // Their sender ID, their bill — the per-org row is checked before either.
    const fn = SMS.slice(SMS.indexOf("export async function getAtConfig"), SMS.indexOf("export async function smsIsConfigured"));
    expect(fn.indexOf("orgCfg?.atApiKey")).toBeLessThan(fn.indexOf("getAtApiKey()"));
  });
});

describe("there is now a way to tell whether they work", () => {
  it("asks the provider rather than the database", () => {
    // A tick on the settings page says a value was stored. Only Africa's
    // Talking knows whether it is a real key. The host is no longer a literal
    // here — atApiBase picks live or sandbox from the username.
    expect(HEALTH).toContain("atApiBase(config.username)}/version1/user");
  });

  it("checks with a read, so verifying costs nothing and sends nothing", () => {
    expect(HEALTH).not.toContain("/version1/messaging");
    expect(HEALTH).toContain("a balance read, not a send");
  });

  it("separates 'never configured' from 'settings unreadable'", () => {
    expect(HEALTH).toContain("probePlatformSettingStore");
    expect(HEALTH).toContain("SETTINGS UNREADABLE");
  });

  it("treats a missing sender ID as a delivery problem for these recipients", () => {
    // This assertion previously said the opposite, encoding a belief the
    // provider's own overview contradicts: the default sender ID is allowed
    // "only in Kenya and available for only Airtel Numbers". This product
    // normalises Ugandan numbers, so a blank sender ID means no delivery — and
    // it fails per message with 402, never at setup, which is why the check has
    // to say it.
    expect(HEALTH).toContain("only allows its default sender ID for Kenyan Airtel");
  });

  it("shows the username and the key's length, but never the key", () => {
    // A 401 is most often a key from one Africa's Talking app paired with
    // another app's username, and that is invisible unless the username sent is
    // shown. The length distinguishes a real key from a pasted password without
    // disclosing anything usable — the endpoint is platform-admin only, and the
    // admin owns the key.
    const body = HEALTH.slice(HEALTH.lastIndexOf("return NextResponse.json({"));
    expect(body).toContain("username: config?.username ?? null");
    expect(body).toContain("apiKeyLength: config?.apiKey?.length ?? null");
    expect(body).not.toContain("apiKey: config.apiKey");
  });

  it("returns no credential, only whether one resolved and from where", () => {
    // lastIndexOf, not indexOf: the early 403 and 429 returns are also
    // NextResponse.json, so indexOf sliced from the top of the function and the
    // "body" was the whole file — which is how an earlier version of this
    // assertion failed against the request headers it was never meant to cover.
    const body = HEALTH.slice(HEALTH.lastIndexOf("return NextResponse.json({"));
    expect(body).toContain("resolved: Boolean(config)");
    // The value itself, not the word: the body reports apiKey: Boolean(dbKey),
    // which says a key is stored without disclosing it.
    expect(body).not.toContain("config.apiKey");
    expect(body).not.toContain("dbKey,");
    expect(body).toContain("apiKey: Boolean(dbKey)");
  });

  it("is platform-admin only and rate limited", () => {
    expect(HEALTH).toContain("assertPlatformAdmin()");
    expect(HEALTH).toContain("rateLimit.platformAdmin");
  });

  it("is reachable from the page where the credentials are entered", () => {
    const form = readFileSync("components/platform/ATSmsPlatformSettingsForm.tsx", "utf8");
    expect(form).toContain("/api/admin/sms-health");
    expect(form).toContain("Saved is not the same as working");
  });
});

describe("it explains a 401 that a 401 cannot explain", () => {
  const SRC = readFileSync("app/api/admin/sms-health/route.ts", "utf8");


  it("rejects a value of the shape actually found stored on the live system", () => {
    // Twenty characters and hyphenated, where Africa's Talking allows eleven
    // alphanumeric. A value shaped like a generated secret sitting in the
    // sender ID box means the fields were filled in wrongly, and that explains
    // a 401 far better than the 401 does.
    //
    // The real value is deliberately not written here. An earlier version of
    // this test carried it verbatim — after this audit had told the owner to
    // treat it as exposed, which committing it to the repository made more
    // true, not less. A placeholder of the same shape tests the same rule.
    expect(senderIdProblem("aaaaaa-bbbbbb-0cDeFg")).toContain("20 characters");
  });

  it("accepts a real one", () => {
    // Hyphens and underscores are explicitly acceptable per the provider's
    // guidance; the first version of this rule refused them.
    for (const ok of ["DDUUKA", "EAGLEINFO", "Duuka-Pro", "Duuka_Pro", "DuukaProMx"]) {
      expect(senderIdProblem(ok)).toBeNull();
    }
  });

  it("rejects a space, which the provider does not allow", () => {
    // "No spacing allowed but hyphens and underscores are acceptable." This
    // rule was written inverted: it permitted spaces and refused hyphens, so a
    // usable id was rejected and an unusable one stored — to fail later, per
    // message, with 402, where nobody would see it.
    expect(senderIdProblem("Duuka Pro")).toContain("does not allow spaces");
  });

  it("rejects punctuation that is neither hyphen nor underscore", () => {
    for (const bad of ["Duuka.Pro", "Duuka!", "Duuka/Pro"]) {
      expect(senderIdProblem(bad)).toContain("hyphens and underscores only");
    }
  });

  it("still rejects anything over eleven characters", () => {
    // "Duuka ProMax" was twelve, and would now fail on the space as well.
    expect(senderIdProblem("DuukaProMax1")).toContain("12 characters");
  });

  it("treats an absent sender ID as fine, not as malformed", () => {
    // Optional: AT sends from a shared shortcode without one.
    expect(senderIdProblem(null)).toBeNull();
    expect(senderIdProblem("")).toBeNull();
  });

  it("tells the reader to rotate, not merely to correct", () => {
    // If a key landed in this field it has been stored, displayed and probably
    // pasted somewhere. Fixing the field does not un-expose it.
    expect(SRC).toContain("treat it as exposed and rotate it");
  });

  it("names the sandbox trap this system has already been caught by once", () => {
    // The wording moved on when the sandbox stopped being unreachable and
    // started being merely useless for customers. The warning got louder, not
    // quieter, which is the property worth pinning.
    expect(SRC).toContain("isSandboxUsername(config?.username)");
    expect(SRC).toContain("reach no real handset and no customer");
  });

  it("reports the sender ID problem whatever the verdict", () => {
    // Reporting it only on READY would hide it behind the 401 it explains.
    const at = SRC.indexOf("const senderIdIssue");
    const readyBlock = SRC.indexOf('!config?.senderId && (verdict === "READY"');
    expect(at).toBeGreaterThan(-1);
    expect(readyBlock).toBeGreaterThan(-1);
    expect(at).toBeLessThan(readyBlock);
  });
});

describe("the form refuses what the check would only report", () => {
  const ACTIONS_SRC = readFileSync("app/(platform)/platform/settings/actions.ts", "utf8");

  it("validates before writing, so a bad value is never stored", () => {
    // Reporting it afterwards is second best: once saved it is displayed,
    // returned by the health check, and pasted onward before anyone notices.
    const check = ACTIONS_SRC.indexOf("const badSender = senderIdProblem(senderId)");
    const write = ACTIONS_SRC.indexOf('setPlatformSetting("AT_SENDER_ID"');
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(write);
    expect(ACTIONS_SRC).toContain("if (senderId && !badSender)");
  });

  it("still saves the credentials when only the sender ID is wrong", () => {
    // The three fields are independent. Rejecting the whole save would discard
    // a corrected API key because the sender ID beside it was bad — trapping
    // someone in the loop they were trying to leave. Caught before it shipped.
    const write = ACTIONS_SRC.indexOf('setPlatformSetting("AT_API_KEY"');
    const refuse = ACTIONS_SRC.indexOf("if (badSender) {");
    expect(write).toBeLessThan(refuse);
  });

  it("says which fields were saved and which was not", () => {
    expect(ACTIONS_SRC).toContain("The sender ID was not saved");
    expect(ACTIONS_SRC).toContain("Saved the ${saved}");
  });

  it("tells the person to rotate the key, not just retype the field", () => {
    expect(ACTIONS_SRC).toContain("rotate that key");
  });

  it("uses the same rule the health check uses", () => {
    // Two copies of this would drift, which is the defect this audit has now
    // found in prices, in job statuses, and in SMS credentials.
    for (const f of ["app/api/admin/sms-health/route.ts", "app/(platform)/platform/settings/actions.ts"]) {
      const src = readFileSync(f, "utf8");
      // Matched on the import of the symbol from the one module that owns it,
      // rather than an exact import line — the health route imports several
      // names alongside it now.
      expect(src).toMatch(/import \{[^}]*senderIdProblem[^}]*\} from "@\/lib\/notifications\/sms-format"/);
    }
  });
});

describe("sandbox and live are different hosts, and only one reaches a customer", () => {
  /**
   * Africa's Talking runs the sandbox on its own host, and the sandbox app's
   * username is always literally "sandbox" — so the credentials say where they
   * belong and nothing extra needs configuring. Sending them to the live host
   * returns 401 "The supplied authentication is invalid", which reads as a
   * wrong key rather than a wrong address, and cost several rounds to
   * recognise on this deployment.
   */
  it("routes by username, with no separate setting to forget", () => {
    expect(atApiBase("sandbox")).toBe("https://api.sandbox.africastalking.com");
    expect(atApiBase("eagleinfo")).toBe("https://api.africastalking.com");
  });

  it("is not fooled by case or padding", () => {
    for (const u of ["Sandbox", "SANDBOX", "  sandbox  "]) {
      expect(isSandboxUsername(u)).toBe(true);
    }
  });

  it("treats an absent username as live, never as sandbox", () => {
    // Guessing sandbox would silently route real traffic to the simulator.
    expect(isSandboxUsername(null)).toBe(false);
    expect(atApiBase(undefined)).toBe("https://api.africastalking.com");
  });

  it("uses the plain messaging endpoint, which the sandbox serves", () => {
    // The /messaging/bulk variant is documented as not yet available on
    // sandbox. This code does not use it, so that limitation does not apply.
    const SMS_SRC = readFileSync("lib/notifications/sms.ts", "utf8");
    expect(SMS_SRC).toContain("/version1/messaging`");
    expect(SMS_SRC).not.toContain("/messaging/bulk");
    // The rules live apart from the sender, so neither the form nor the tests
    // need a database connection to use them.
    expect(readFileSync("lib/notifications/sms-format.ts", "utf8")).not.toContain("prisma");
  });
});

describe("a working sandbox must never read as a working integration", () => {
  const HEALTH_SRC = readFileSync("app/api/admin/sms-health/route.ts", "utf8");

  it("never returns a plain READY on sandbox credentials", () => {
    // This system has twice shown a green light for something that reached no
    // customer. Making the sandbox reachable makes saying so louder, not
    // quieter.
    expect(HEALTH_SRC).toContain('verdict = isSandboxUsername(config.username) ? "READY — SANDBOX ONLY" : "READY"');
  });

  it("separates 'can send' from 'reaches a real customer'", () => {
    expect(HEALTH_SRC).toContain('reachesRealCustomers: verdict === "READY"');
  });

  it("says plainly that no handset receives a sandbox message", () => {
    expect(HEALTH_SRC).toContain("reach no real handset and no customer");
  });

  it("reports which host was actually contacted", () => {
    expect(HEALTH_SRC).toContain("host: config ? atApiBase(config.username) : null");
  });
});

describe("an email address is not a username", () => {
  const SRC = readFileSync("app/api/admin/sms-health/route.ts", "utf8");

  /**
   * Found on the live system: the stored username was g22eorge@gmail.com — the
   * address used to sign in to the dashboard, not the account username beside
   * it. Africa's Talking answers that with a bare 401 naming no field, and the
   * key length of 77 showed the key itself was plausible, so the fault was
   * invisible until the username was displayed.
   *
   * It is also why the sandbox check never fired: it compared against
   * "sandbox" while an email sat in the field.
   */
  it("flags a username containing @", () => {
    expect(SRC).toContain('config?.username?.includes("@")');
  });

  it("says what to use instead, not merely that it is wrong", () => {
    expect(SRC).toContain("account or app username shown in the dashboard");
  });

  it("attributes the 401 to it, since it is sufficient on its own", () => {
    expect(SRC).toContain("This alone produces the 401 above");
  });

  it("is reported before the sandbox check, which an email would mask", () => {
    // With an email stored, isSandboxUsername is false and the sandbox warning
    // stays silent — so the email must be named or the real cause is hidden.
    const email = SRC.indexOf('config?.username?.includes("@")');
    const sandbox = SRC.indexOf("isSandboxUsername(config?.username)");
    expect(email).toBeLessThan(sandbox);
  });
});

describe("what Africa's Talking calls success", () => {
  /**
   * Checked against the provider's own reference rather than assumed. Three
   * codes mean accepted — 100 Processed, 101 Sent, 102 Queued — and queueing is
   * the default, since enqueue defaults to 1 and the API stores messages then
   * delivers them asynchronously.
   *
   * Only 101 counted, so ordinary successful sends were recorded as failures:
   * this system's usual defect running backwards, an outbox full of red for
   * messages that had gone.
   */
  it("accepts all three acceptance codes, not just Sent", () => {
    for (const code of [100, 101, 102]) expect(atStatusAccepted(code)).toBe(true);
  });

  it("accepts a queued message, which is the default outcome", () => {
    expect(atStatusAccepted(102)).toBe(true);
  });

  it("still rejects every documented failure", () => {
    for (const code of [401, 402, 403, 404, 405, 406, 407, 409, 500, 501, 502]) {
      expect(atStatusAccepted(code)).toBe(false);
    }
  });

  it("does not treat a missing or junk code as success", () => {
    for (const bad of [undefined, null, "", "abc", 0]) expect(atStatusAccepted(bad)).toBe(false);
  });

  it("explains a failure instead of echoing a bare word", () => {
    expect(atStatusExplanation(405)).toContain("top the account up");
    expect(atStatusExplanation(402)).toContain("registered and approved");
    expect(atStatusExplanation(409)).toContain("Do-Not-Disturb");
  });

  it("falls back to the provider's own text for an undocumented code", () => {
    expect(atStatusExplanation(999, "SomethingNew")).toBe("SomethingNew");
  });
});

describe("the sender ID guidance matches the provider, not the usual summary", () => {
  const SRC = readFileSync("app/api/admin/sms-health/route.ts", "utf8");

  it("says a blank sender ID does not deliver to Ugandan numbers", () => {
    // The documentation is narrower than "it sends from a shared shortcode":
    // the default sender ID is Kenya-and-Airtel only. This product normalises
    // Ugandan numbers, so for its recipients a blank sender ID means no
    // delivery — and it fails per message with 402, not at setup.
    expect(SRC).toContain("only allows its default sender ID for Kenyan Airtel");
    expect(SRC).toContain("402");
  });

  it("says it on the sandbox verdict too, where it is equally true", () => {
    expect(SRC).toContain('verdict === "READY" || verdict === "READY — SANDBOX ONLY"');
  });
});
