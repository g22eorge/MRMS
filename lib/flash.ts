/**
 * Attach a result message to a redirect.
 *
 * Server actions finish by redirecting, which repaints the page and says
 * nothing. <FlashToast> (mounted once for every app page) reads these
 * parameters, raises a toast and strips them back out of the URL.
 *
 *   redirect(flash("/clients", "Client added"));
 *   redirect(flash(`/jobs/${id}`, "Could not save", "failed"));
 *
 * Existing query parameters on the path are preserved, so a redirect back to a
 * filtered list keeps its filters.
 */
export function flash(path: string, message: string, kind: "saved" | "failed" = "saved"): string {
  const [base, existing] = path.split("?");
  const params = new URLSearchParams(existing ?? "");
  params.set(kind, message);
  return `${base}?${params.toString()}`;
}

/** Shorthand for the failure case, so call sites read as what they are. */
export function flashError(path: string, message: string): string {
  return flash(path, message, "failed");
}
