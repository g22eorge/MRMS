import { checkSmsQuota, incrementSmsUsage } from "@/lib/notifications/sms-quota";
import { normalizeUgPhone } from "@/lib/phone";
import { getAtApiKey, getAtUsername, getAtSenderId } from "@/lib/platform-settings";

export interface AtSmsConfig {
  apiKey: string;
  username: string;
  senderId?: string;
}

/**
 * Async because the platform-settings tier is a database read.
 *
 * It used to consult only the per-org row and process.env, while the platform
 * settings form wrote the credentials to the database — so a key entered there
 * was stored, displayed as configured, and never used to send anything.
 */
/**
 * Whether a string can be an Africa's Talking sender ID at all.
 *
 * Alphanumeric, eleven characters at most. Shared by the settings form, which
 * refuses to store anything else, and the health check, which reports a stored
 * value that should never have got in. Both matter: validating only at the
 * point of entry leaves existing bad values invisible, and validating only in
 * the check lets new ones be created.
 */
export function senderIdProblem(senderId: string | null | undefined): string | null {
  if (!senderId) return null;
  if (senderId.length > 11) {
    return `it is ${senderId.length} characters and Africa's Talking allows at most 11`;
  }
  if (!/^[A-Za-z0-9 ]+$/.test(senderId)) {
    return "sender IDs are alphanumeric, and this contains other characters";
  }
  return null;
}

export async function getAtConfig(
  orgCfg?: { atApiKey?: string | null; atUsername?: string | null; atSenderId?: string | null } | null,
): Promise<AtSmsConfig | null> {
  // A tenant's own credentials still win: their sender ID, their bill.
  if (orgCfg?.atApiKey && orgCfg?.atUsername) {
    return {
      apiKey: orgCfg.atApiKey,
      username: orgCfg.atUsername,
      senderId: orgCfg.atSenderId ?? undefined,
    };
  }

  const [apiKey, username, senderId] = await Promise.all([
    getAtApiKey(),
    getAtUsername(),
    getAtSenderId(),
  ]);
  if (!apiKey || !username) return null;
  // Org's registered sender ID takes priority over the platform default
  return { apiKey, username, senderId: orgCfg?.atSenderId ?? senderId ?? undefined };
}

export async function smsIsConfigured(
  orgCfg?: { atApiKey?: string | null; atUsername?: string | null } | null,
): Promise<boolean> {
  return Boolean(await getAtConfig(orgCfg));
}

export async function sendSms(
  phone: string,
  message: string,
  cfg?: AtSmsConfig | null,
  orgId?: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Quota check
  if (orgId) {
    const quota = await checkSmsQuota(orgId);
    if (!quota.allowed) {
      console.warn(`[SMS] Quota exceeded for org ${orgId}: ${quota.used}/${quota.limit}`);
      return { success: false, error: `SMS quota exceeded (${quota.used}/${quota.limit} used this month)` };
    }
  }

  const config = cfg ?? (await getAtConfig());
  if (!config) return { success: false, error: "SMS not configured" };

  const to = normalizeUgPhone(phone, { format: "e164" });
  if (!to) return { success: false, error: "Invalid phone" };
  const params = new URLSearchParams({ username: config.username, to, message });
  if (config.senderId) params.set("from", config.senderId);

  try {
    const res = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: {
        apiKey: config.apiKey,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `AT SMS error: ${res.status} ${text.slice(0, 200)}` };
    }

    const data = await res.json();
    const recipient = data?.SMSMessageData?.Recipients?.[0];
    if (recipient?.statusCode === 101) {
      if (orgId) void incrementSmsUsage(orgId);
      return { success: true, messageId: String(recipient.messageId) };
    }
    return { success: false, error: recipient?.status ?? "Unknown SMS error" };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function smsHealthCheck(
  cfg?: AtSmsConfig | null,
): Promise<{ ok: boolean; error?: string }> {
  const config = cfg ?? (await getAtConfig());
  if (!config) return { ok: false, error: "SMS not configured" };

  try {
    const res = await fetch(
      `https://api.africastalking.com/version1/user?username=${encodeURIComponent(config.username)}`,
      {
        headers: { apiKey: config.apiKey, Accept: "application/json" },
      },
    );
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `AT API error: ${res.status} ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
