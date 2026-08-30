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
