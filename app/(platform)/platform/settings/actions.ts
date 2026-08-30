"use server";

import { setPlatformSetting, deletePlatformSetting } from "@/lib/platform-settings";
import { registerIpn, getRegisteredIpns, ipnCallbackUrl, ipnSettingKey } from "@/lib/pesapal";
import { senderIdProblem } from "@/lib/notifications/sms";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { revalidatePlatformSettings } from "@/lib/platform/revalidate";

export async function savePesapalSettingsAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  await requirePlatformAdmin();

  const consumerKey = (formData.get("PESAPAL_CONSUMER_KEY") as string | null)?.trim() ?? "";
  const consumerSecret = (formData.get("PESAPAL_CONSUMER_SECRET") as string | null)?.trim() ?? "";

  try {
    if (consumerKey) await setPlatformSetting("PESAPAL_CONSUMER_KEY", consumerKey);
    if (consumerSecret) await setPlatformSetting("PESAPAL_CONSUMER_SECRET", consumerSecret);
    revalidatePlatformSettings();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed" };
  }
}

export async function clearPlatformKeyAction(
  _prev: { ok: boolean } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  await requirePlatformAdmin();
  const key = formData.get("key") as string | null;
  const allowed = [
    "PESAPAL_CONSUMER_KEY",
    "PESAPAL_CONSUMER_SECRET",
    // Both scoped keys, plus the legacy one so a value stored before the
    // environments were separated can still be cleared.
    "PESAPAL_IPN_ID_SANDBOX",
    "PESAPAL_IPN_ID_LIVE",
    "PESAPAL_IPN_ID",
    "AT_API_KEY",
    "AT_USERNAME",
    "AT_SENDER_ID",
  ];
  if (!key || !allowed.includes(key)) {
    return { ok: false, error: "Invalid key" };
  }
  try {
    await deletePlatformSetting(key);
    revalidatePlatformSettings();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Delete failed" };
  }
}

// Backwards compatible export name
export const clearPesapalKeyAction = clearPlatformKeyAction;

export async function saveAtSettingsAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  await requirePlatformAdmin();

  const apiKey = (formData.get("AT_API_KEY") as string | null)?.trim() ?? "";
  const username = (formData.get("AT_USERNAME") as string | null)?.trim() ?? "";
  const senderId = (formData.get("AT_SENDER_ID") as string | null)?.trim() ?? "";

  // Refused rather than stored. A value of the wrong shape here is not a typo
  // to be corrected later — it is usually a credential pasted into the wrong
  // box, and once saved it is displayed, returned by the health check, and
  // pasted onward before anyone notices. The cheapest place to stop that is
  // before it is written.
  const badSender = senderIdProblem(senderId);
  if (badSender) {
    return {
      ok: false,
      error:
        `That sender ID cannot be right — ${badSender}. Leave it blank to send from a shared ` +
        "shortcode. If you have pasted an API key here by mistake, rotate that key: it has been submitted.",
    };
  }

  try {
    if (apiKey) await setPlatformSetting("AT_API_KEY", apiKey);
    if (username) await setPlatformSetting("AT_USERNAME", username);
    if (senderId) await setPlatformSetting("AT_SENDER_ID", senderId);
    revalidatePlatformSettings();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed" };
  }
}

export async function registerIpnAction(
  _prev: { ok: boolean; ipnId?: string; error?: string } | null,
  _formData: FormData,
): Promise<{ ok: boolean; ipnId?: string; error?: string }> {
  await requirePlatformAdmin();
  try {
    const ipnUrl = ipnCallbackUrl();

    // Check if already registered
    const existing = await getRegisteredIpns().catch(() => []);
    const found = existing.find((i) => i.url === ipnUrl && i.status === "Active");
    if (found) {
      await setPlatformSetting(ipnSettingKey(), found.ipn_id);
      revalidatePlatformSettings();
      return { ok: true, ipnId: found.ipn_id };
    }

    const ipnId = await registerIpn(ipnUrl);
    await setPlatformSetting(ipnSettingKey(), ipnId);
    revalidatePlatformSettings();
    return { ok: true, ipnId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "IPN registration failed" };
  }
}
