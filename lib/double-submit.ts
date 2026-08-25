/**
 * Server-side guard against the same submission arriving twice.
 *
 * Disabling the button while a form is in flight closes the common case -- the
 * impatient second tap on a slow connection -- but it is not a guarantee, and
 * treating it as one is how duplicates keep appearing. It does nothing when:
 *
 *   - the request is slow, the user reloads, and re-submits
 *   - the first request actually landed but the response was lost on a flaky
 *     mobile connection, so the client retries
 *   - someone goes back and submits the form again
 *   - a webhook or integration posts the same payload twice
 *
 * The only thing that can promise "one submission, one record" is the server.
 * So an action looks for a row it already created from the same natural key
 * moments ago, and returns that row instead of writing a second one.
 *
 * The window is deliberately short. Long enough to cover a retry on a bad
 * connection, short enough that genuinely entering the same customer twice in
 * a row -- which does happen -- is not silently swallowed.
 */
export const DOUBLE_SUBMIT_WINDOW_MS = 90_000;

/**
 * True when a row that matches the incoming payload was created so recently
 * that it is almost certainly the same submission, not a new one.
 */
export function isDoubleSubmit(existingCreatedAt: Date | null | undefined, now: number = Date.now()): boolean {
  if (!existingCreatedAt) return false;
  const age = now - existingCreatedAt.getTime();
  // Guard against clock skew producing a negative age on a replicated database.
  return age >= 0 && age < DOUBLE_SUBMIT_WINDOW_MS;
}
