import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

// The real rule, not a copy of it — a mirrored validator in a test proves only
// that the mirror is self-consistent.
import { senderIdProblem } from "@/lib/notifications/sms";

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
    // Talking knows whether it is a real key.
    expect(HEALTH).toContain("api.africastalking.com/version1/user");
  });

  it("checks with a read, so verifying costs nothing and sends nothing", () => {
    expect(HEALTH).not.toContain("/version1/messaging");
    expect(HEALTH).toContain("a balance read, not a send");
  });

  it("separates 'never configured' from 'settings unreadable'", () => {
    expect(HEALTH).toContain("probePlatformSettingStore");
    expect(HEALTH).toContain("SETTINGS UNREADABLE");
  });

  it("treats a missing sender ID as a note, not a failure", () => {
    // Africa's Talking sends from a shared shortcode without one, so blocking
    // on it would report a working integration as broken.
    expect(HEALTH).toContain("Sending still works");
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


  it("rejects the value actually found stored on the live system", () => {
    // "wecmys-piqcut-0biJvu" — twenty characters and hyphenated. Africa's
    // Talking allows eleven, alphanumeric. A value shaped like a generated
    // secret in the sender ID box means the fields were filled in wrongly, and
    // that explains a 401 far better than the 401 does.
    expect(senderIdProblem("wecmys-piqcut-0biJvu")).toContain("20 characters");
  });

  it("accepts a real one", () => {
    for (const ok of ["DDUUKA", "EAGLEINFO", "Eagle Info"]) {
      expect(senderIdProblem(ok)).toBeNull();
    }
  });

  it("rejects hyphens and underscores at a legal length", () => {
    expect(senderIdProblem("ab-cd")).toContain("alphanumeric");
    expect(senderIdProblem("ab_cd")).toContain("alphanumeric");
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
    expect(SRC).toContain('config.username.toLowerCase() === "sandbox"');
    expect(SRC).toContain("always calls the live Africa's Talking host");
  });

  it("reports the sender ID problem whatever the verdict", () => {
    // Reporting it only on READY would hide it behind the 401 it explains.
    const at = SRC.indexOf("const senderIdIssue");
    const readyBlock = SRC.indexOf('verdict === "READY" && !config?.senderId');
    expect(at).toBeGreaterThan(-1);
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
  });

  it("tells the person to rotate the key, not just retype the field", () => {
    expect(ACTIONS_SRC).toContain("rotate that key");
  });

  it("uses the same rule the health check uses", () => {
    // Two copies of this would drift, which is the defect this audit has now
    // found in prices, in job statuses, and in SMS credentials.
    for (const f of ["app/api/admin/sms-health/route.ts", "app/(platform)/platform/settings/actions.ts"]) {
      expect(readFileSync(f, "utf8")).toContain('senderIdProblem } from "@/lib/notifications/sms"');
    }
  });
});
