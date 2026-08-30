/**
 * Africa's Talking value rules, with no I/O.
 *
 * Split out so the settings form, the health check and the tests can use the
 * same rules without importing the sender — which reaches platform settings and
 * therefore Prisma. A test that pulled that in passed and then aborted the
 * process on exit, and a pure rule has no need of a database connection to
 * decide whether a string is eleven characters long.
 */

/**
 * Which Africa's Talking host a set of credentials belongs to.
 *
 * The sandbox is a separate environment on a separate host, and its username is
 * always literally "sandbox" — so the credentials themselves say where they
 * belong and nothing extra needs configuring. Sending sandbox credentials to
 * the live host returns 401 "The supplied authentication is invalid", which
 * reads as a wrong key rather than a wrong address and cost several rounds to
 * recognise.
 *
 * Supporting the sandbox is for testing only. Messages sent there reach Africa's
 * Talking' simulator and no real handset, so anything reporting on this must say
 * so rather than showing a green light — a working sandbox that looks like a
 * working integration is the defect this system has already had twice.
 */
export const AT_LIVE_BASE = "https://api.africastalking.com";
export const AT_SANDBOX_BASE = "https://api.sandbox.africastalking.com";

export function isSandboxUsername(username: string | null | undefined): boolean {
  return (username ?? "").trim().toLowerCase() === "sandbox";
}

export function atApiBase(username: string | null | undefined): string {
  return isSandboxUsername(username) ? AT_SANDBOX_BASE : AT_LIVE_BASE;
}

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

/**
 * What Africa's Talking says it did with each recipient.
 *
 * Three codes mean accepted, not one. 101 is "Sent", but 102 is "Queued" and
 * 100 is "Processed" — and queueing is the *default*, since the enqueue flag
 * defaults to 1 and the API stores messages then delivers them asynchronously.
 * Treating only 101 as success therefore recorded ordinary, successful sends as
 * failures, which is this system's usual defect running backwards: an outbox
 * full of red for messages that actually went.
 *
 * Codes and meanings from the provider's own reference.
 */
export const AT_ACCEPTED_STATUS_CODES = [100, 101, 102] as const;

export function atStatusAccepted(statusCode: unknown): boolean {
  return (AT_ACCEPTED_STATUS_CODES as readonly number[]).includes(Number(statusCode));
}

/** Actionable text for the documented failures, rather than a bare word. */
export const AT_STATUS_MEANING: Record<number, string> = {
  100: "Processed",
  101: "Sent",
  102: "Queued — accepted and will be delivered asynchronously",
  401: "Held for risk review by Africa's Talking",
  402: "Invalid sender ID — it must be registered and approved for this account",
  403: "Invalid phone number",
  404: "Unsupported number type",
  405: "Insufficient balance — top the account up",
  406: "Recipient is on the account blacklist",
  407: "Could not route to this network",
  409: "Rejected by the recipient's Do-Not-Disturb setting",
  500: "Africa's Talking internal error",
  501: "Gateway error",
  502: "Rejected by the gateway",
};

export function atStatusExplanation(statusCode: unknown, fallback?: string | null): string {
  const code = Number(statusCode);
  return AT_STATUS_MEANING[code] ?? fallback ?? `Unknown SMS status ${statusCode}`;
}
