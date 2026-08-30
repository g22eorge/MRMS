/**
 * pesapal.ts — Pesapal v3 API wrapper
 * Docs: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/api-reference
 *
 * Set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET in .env.local
 * Set PESAPAL_ENV=production for live payments (default: sandbox)
 */

import { getPesapalConsumerKey, getPesapalConsumerSecret } from "@/lib/platform-settings";

export const PESAPAL_BASE =
  process.env.PESAPAL_ENV === "production"
    ? "https://pay.pesapal.com/v3"
    : "https://cybqa.pesapal.com/pesapalv3";

// ── Plan prices (UGX) ─────────────────────────────────────────────────────────
// Declared in lib/plan-prices.ts and re-exported here, where callers already
// expect to find them. This file never used the table — it only held it, and
// holding it in two places is what let the webhook verify against a ladder the
// product had stopped selling.
export { PLAN_PRICES } from "@/lib/plan-prices";

export const CURRENCY = "UGX";

// ── Auth token (module-level cache, 4-min TTL) ────────────────────────────────

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getAuthToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;

  const consumerKey = await getPesapalConsumerKey();
  const consumerSecret = await getPesapalConsumerSecret();
  if (!consumerKey || !consumerSecret) throw new Error("Pesapal credentials not configured");

  const res = await fetch(`${PESAPAL_BASE}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
  });

  const json = (await res.json()) as { token?: string; error?: { message: string } };
  if (!res.ok || !json.token) throw new Error(json.error?.message ?? `Pesapal auth failed: ${res.status}`);

  tokenCache = { token: json.token, expiresAt: Date.now() + 4 * 60 * 1000 };
  return json.token;
}

async function pesapalFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`${PESAPAL_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { throw new Error(`Pesapal non-JSON response: ${text.slice(0, 200)}`); }

  const j = json as Record<string, unknown>;
  if (!res.ok) throw new Error((j?.error as Record<string, unknown>)?.message as string ?? j?.message as string ?? `Pesapal error: ${res.status}`);
  return json as T;
}

// ── IPN registration ──────────────────────────────────────────────────────────

type IpnEntry = { ipn_id: string; url: string; status: string };

export async function registerIpn(ipnUrl: string): Promise<string> {
  const result = await pesapalFetch<IpnEntry>("/api/URLSetup/RegisterIPN", {
    method: "POST",
    body: JSON.stringify({ url: ipnUrl, ipn_notification_type: "GET" }),
  });
  return result.ipn_id;
}

export async function getRegisteredIpns(): Promise<IpnEntry[]> {
  return pesapalFetch<IpnEntry[]>("/api/URLSetup/GetIpnList");
}

/**
 * The URL Pesapal is told to call back.
 *
 * Registration happens once and the resulting id is stored forever — nothing
 * re-checks where it points. So a registration made while NEXT_PUBLIC_APP_URL
 * was unset would pin every future payment notification to localhost, where it
 * is delivered to nothing, and the only symptom is payments that never
 * activate. Refusing here costs one loud failure; allowing it costs silent
 * ones for the life of the deployment.
 */
export function ipnCallbackUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(baseUrl);
  if (process.env.NODE_ENV === "production" && local) {
    throw new Error(
      "Refusing to register a localhost IPN URL in production: set NEXT_PUBLIC_APP_URL to the public app URL first. " +
        "Pesapal stores this address permanently, and notifications sent to localhost are lost.",
    );
  }
  return `${baseUrl}/api/webhooks/pesapal`;
}

export const IS_LIVE = PESAPAL_BASE.includes("pay.pesapal.com");

/**
 * Which stored IPN id applies, and why it is not just one key.
 *
 * An IPN id belongs to the Pesapal account that registered it. Sandbox and live
 * are different accounts, so an id from one is meaningless to the other — but
 * the setting was a single "PESAPAL_IPN_ID" with nothing recording where it
 * came from. This deployment has only ever run against the sandbox, so the
 * moment PESAPAL_ENV is set to production the stored sandbox id would be handed
 * to the live host as notification_id, and the order is rejected or accepted and
 * never notified. Going live would silently not work, and would look exactly
 * like the defect it was meant to end.
 *
 * Keyed by environment, the flip registers a fresh id against the live account
 * on its own, and switching back finds the sandbox one still there.
 */
export function ipnSettingKey(): string {
  return IS_LIVE ? "PESAPAL_IPN_ID_LIVE" : "PESAPAL_IPN_ID_SANDBOX";
}

/**
 * The stored id for the current environment.
 *
 * Falls back to the legacy un-namespaced key only in sandbox, which is sound
 * rather than merely convenient: every value ever written under it was written
 * while this deployment pointed at the sandbox. Reading it in live mode would
 * reintroduce exactly the cross-account confusion this exists to prevent.
 */
export async function getStoredIpnId(): Promise<string | null> {
  const { getPlatformSetting } = await import("@/lib/platform-settings");
  const scoped = await getPlatformSetting(ipnSettingKey());
  if (scoped) return scoped;
  return IS_LIVE ? null : getPlatformSetting("PESAPAL_IPN_ID");
}

/** Get the stored IPN ID for this environment, or register one if absent. */
export async function getOrCreateIpnId(): Promise<string> {
  const { setPlatformSetting } = await import("@/lib/platform-settings");
  const stored = await getStoredIpnId();
  if (stored) return stored;

  const ipnId = await registerIpn(ipnCallbackUrl());
  await setPlatformSetting(ipnSettingKey(), ipnId);
  return ipnId;
}

// ── Submit order (initiate payment) ──────────────────────────────────────────

type SubmitOrderParams = {
  merchantReference: string;
  amount: number;
  currency: string;
  description: string;
  callbackUrl: string;
  ipnId: string;
  email: string;
  name: string;
};

export type SubmitOrderResult = {
  order_tracking_id: string;
  merchant_reference: string;
  redirect_url: string;
  status: string;
};

export async function submitOrder(params: SubmitOrderParams): Promise<SubmitOrderResult> {
  const nameParts = params.name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? params.name;
  const lastName = nameParts.slice(1).join(" ") || firstName;

  return pesapalFetch<SubmitOrderResult>("/api/Transactions/SubmitOrderRequest", {
    method: "POST",
    body: JSON.stringify({
      id: params.merchantReference,
      currency: params.currency,
      amount: params.amount,
      description: params.description,
      callback_url: params.callbackUrl,
      notification_id: params.ipnId,
      billing_address: {
        email_address: params.email,
        first_name: firstName,
        last_name: lastName,
      },
    }),
  });
}

// ── Transaction status ────────────────────────────────────────────────────────

export type PesapalTxStatus = {
  payment_method: string;
  amount: number;
  created_date: string;
  confirmation_code: string;
  payment_status_description: "Completed" | "Failed" | "Reversed" | "Pending" | "Invalid";
  merchant_reference: string;
  payment_status_code: string;
  currency: string;
  error: { error_type: string | null; code: string | null; message: string | null };
};

export async function getTransactionStatus(orderTrackingId: string): Promise<PesapalTxStatus> {
  return pesapalFetch<PesapalTxStatus>(
    `/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
  );
}

// ── Merchant reference encoding ───────────────────────────────────────────────

const PLAN_CODE: Record<string, string> = { STANDARD: "S", GROWTH: "P", PREMIUM: "M", ENTERPRISE: "E" };
const PLAN_FROM_CODE: Record<string, string> = { S: "STANDARD", P: "GROWTH", M: "PREMIUM", E: "ENTERPRISE" };

/** Build a unique merchant reference encoding orgId and plan. Max ~35 chars. */
export function buildMerchantRef(orgId: string, plan: "STANDARD" | "GROWTH" | "PREMIUM" | "ENTERPRISE"): string {
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `${orgId}-${rand}-${PLAN_CODE[plan]}`;
}

/** Parse orgId and plan from a merchant reference built with buildMerchantRef. */
export function parseMerchantRef(ref: string): { orgId: string; plan: "STANDARD" | "GROWTH" | "PREMIUM" | "ENTERPRISE" } | null {
  const parts = ref.split("-");
  if (parts.length < 3) return null;
  const planCode = parts[parts.length - 1];
  const plan = PLAN_FROM_CODE[planCode] as "STANDARD" | "GROWTH" | "PREMIUM" | "ENTERPRISE" | undefined;
  if (!plan) return null;
  const orgId = parts.slice(0, parts.length - 2).join("-");
  return orgId ? { orgId, plan } : null;
}
