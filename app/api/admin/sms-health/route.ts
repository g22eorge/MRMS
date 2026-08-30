import { NextResponse } from "next/server";

import { assertPlatformAdmin } from "@/lib/platform-admin";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getPlatformSetting, probePlatformSettingStore } from "@/lib/platform-settings";
import { getAtConfig } from "@/lib/notifications/sms";
import { senderIdProblem, atApiBase, isSandboxUsername } from "@/lib/notifications/sms-format";

export const dynamic = "force-dynamic";

/**
 * Do the Africa's Talking credentials actually work?
 *
 * The owner entered them and could not tell. Neither could the settings page,
 * which showed a green tick because it read the same table the form wrote to —
 * saying only that a value had been stored, never that it was correct or even
 * that anything used it. For a while nothing did: the sender read the
 * environment and the per-org row and skipped the database entirely, so a key
 * entered there sent no SMS and reported no error.
 *
 * The provider settles it. Africa's Talking exposes a user endpoint that
 * returns the account balance for a username, which is a read, needs the same
 * credentials a send does, and costs nothing. If it answers, the credentials
 * are real. If it refuses, the message says why.
 *
 * Read-only, platform-admin only, and no credential is returned — only whether
 * one resolved, from where, and what the provider said about it.
 */

type Verdict =
  | "READY"
  /** Credentials work, against the simulator. No customer receives anything. */
  | "READY — SANDBOX ONLY"
  | "NO CREDENTIALS"
  | "CREDENTIALS REJECTED"
  | "SETTINGS UNREADABLE";

export async function GET() {
  const admin = await assertPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rl = await rateLimit.platformAdmin(admin.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many admin operations. Wait a moment and retry." },
      { status: 429, headers: rateLimitHeaders(rl.retryAfterMs) },
    );
  }

  // Asked first: a null from getPlatformSetting means "absent" and "could not
  // read" alike, and those call for opposite actions.
  const store = await probePlatformSettingStore();

  const [dbKey, dbUser, dbSender] = await Promise.all([
    getPlatformSetting("AT_API_KEY").catch(() => null),
    getPlatformSetting("AT_USERNAME").catch(() => null),
    getPlatformSetting("AT_SENDER_ID").catch(() => null),
  ]);

  const config = await getAtConfig().catch(() => null);
  const source = dbKey && dbUser ? "platform settings" : config ? "environment" : "none";

  let verdict: Verdict;
  let providerError: string | null = null;
  let balance: string | null = null;

  if (!config) {
    verdict = store.readable ? "NO CREDENTIALS" : "SETTINGS UNREADABLE";
  } else {
    // The provider is the only authority on whether a key is real.
    try {
      // Whichever host these credentials belong to. Checking sandbox
      // credentials against the live host returns a 401 that reads as a wrong
      // key rather than a wrong address.
      const res = await fetch(
        `${atApiBase(config.username)}/version1/user?username=${encodeURIComponent(config.username)}`,
        { headers: { apiKey: config.apiKey, Accept: "application/json" } },
      );
      if (!res.ok) {
        providerError = `${res.status} ${(await res.text()).slice(0, 200)}`;
        verdict = "CREDENTIALS REJECTED";
      } else {
        const data = (await res.json().catch(() => null)) as { UserData?: { balance?: string } } | null;
        balance = data?.UserData?.balance ?? null;
        // Never a plain READY on the sandbox. It can send, and no customer
        // receives anything — a green light there is the same lie this system
        // has already told twice about payments.
        verdict = isSandboxUsername(config.username) ? "READY — SANDBOX ONLY" : "READY";
      }
    } catch (err) {
      providerError = err instanceof Error ? err.message.slice(0, 200) : "Africa's Talking did not answer";
      verdict = "CREDENTIALS REJECTED";
    }
  }

  const blockers: string[] = [];
  if (verdict === "NO CREDENTIALS") {
    blockers.push(
      "No Africa's Talking API key and username resolve, so every SMS is dropped with \"SMS not configured\" and nothing is sent.",
    );
  }
  if (verdict === "SETTINGS UNREADABLE") {
    blockers.push(`The settings store could not be read (${store.error}), so whether credentials exist cannot be determined from here.`);
  }
  if (verdict === "CREDENTIALS REJECTED") {
    blockers.push(`Africa's Talking rejected these credentials: ${providerError}`);
  }
  // Said whatever the verdict, because a malformed sender ID explains a 401
  // better than the 401 does: it means the fields were filled in wrongly.
  const senderIdIssue = senderIdProblem(config?.senderId);
  if (senderIdIssue) {
    blockers.push(
      `The stored sender ID is not a valid one — ${senderIdIssue}. ` +
        "If a credential was pasted into this field by mistake, treat it as exposed and rotate it.",
    );
  }

  // An email address is what you sign in to the dashboard with; the API
  // username is the account or app name beside it. They are easy to confuse
  // because only one of them is ever typed anywhere else, and the provider
  // answers the mistake with a bare 401 that names no field.
  if (config?.username?.includes("@")) {
    blockers.push(
      `The username is "${config.username}", which is an email address. Africa's Talking wants the ` +
        "account or app username shown in the dashboard — for the sandbox app that is literally " +
        "\"sandbox\" — not the address you sign in with. This alone produces the 401 above.",
    );
  }

  if (isSandboxUsername(config?.username)) {
    // Now reachable rather than rejected — which makes saying this louder, not
    // quieter. The same trap had the commercial deployment paying into Pesapal's
    // sandbox for months.
    blockers.push(
      "These are SANDBOX credentials, so this is checked against Africa's Talking' simulator. " +
        "Messages sent with them reach no real handset and no customer. For SMS that actually arrives, " +
        "create a live app in the Africa's Talking dashboard, use its username and key, and top it up.",
    );
  }

  if (verdict === "READY" && !config?.senderId) {
    // Not a blocker: AT sends from a shared shortcode without one.
    blockers.push(
      "No sender ID is set, so messages arrive from a shared shortcode rather than the business's name. Sending still works.",
    );
  }

  return NextResponse.json({
    readOnly: true,
    verdict,
    canSendSms: verdict === "READY",
    /** Separate from canSendSms: the sandbox sends, but never to a customer. */
    reachesRealCustomers: verdict === "READY",
    environment: isSandboxUsername(config?.username) ? "sandbox" : "live",
    blockers,
    credentials: {
      resolved: Boolean(config),
      source,
      /** Distinguishes "never configured" from "configured but unreadable". */
      absenceIsTrustworthy: store.readable,
      senderId: config?.senderId ?? null,
      // The username is an account name, not a secret, and a 401 is most often
      // a key belonging to a different app than the username beside it — which
      // nobody can spot without seeing which username was actually sent.
      username: config?.username ?? null,
      // The key's length, never the key. A freshly issued Africa's Talking key
      // is long; a value in the sixties or shorter is usually an account
      // password or a truncated paste, and that is visible from the number
      // alone without disclosing anything usable.
      apiKeyLength: config?.apiKey?.length ?? null,
      senderIdLooksValid: config?.senderId ? senderIdProblem(config.senderId) === null : null,
      storedInDatabase: { apiKey: Boolean(dbKey), username: Boolean(dbUser), senderId: Boolean(dbSender) },
    },
    provider: {
      name: "Africa's Talking",
      host: config ? atApiBase(config.username) : null,
      checkedWith: "GET /version1/user — a balance read, not a send",
      accepted: config ? verdict === "READY" : null,
      accountBalance: balance,
      error: providerError,
    },
    note:
      "A green tick on the settings page means a value was stored, not that it works. " +
      "This asks the provider.",
  });
}
