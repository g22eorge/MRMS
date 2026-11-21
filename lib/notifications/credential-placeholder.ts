/**
 * Is this value one of the placeholders from `.env.example`, not a credential?
 *
 * A copied `.env.example` leaves `WHATSAPP_ACCESS_TOKEN=your_meta_access_token`
 * in place. That is a non-empty string, so the "is it configured" check passed
 * and every send went to Meta with a token it could not parse:
 *
 *   401 Invalid OAuth access token - Cannot parse access token
 *
 * The outbox recorded that as a provider failure and retried it, and the
 * scheduled reminder jobs did the same every morning from any stack that held
 * a copy of real client data. Treating a placeholder as "not configured" makes
 * such a stack say what is actually wrong, and never contact the provider.
 */
const PLACEHOLDER_PATTERNS = [
  /^your[_-]/i,
  /^re_your[_-]/i,
  /^random_string/i,
  /^replace[-_ ]?with/i,
  /^change[-_ ]?me$/i,
  /^<.*>$/,
];

export function isPlaceholderCredential(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** Present, and not a placeholder. */
export function isRealCredential(value: string | null | undefined): value is string {
  return Boolean(value?.trim()) && !isPlaceholderCredential(value);
}
