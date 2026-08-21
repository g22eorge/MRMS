/**
 * The message a server action leaves behind when it refuses to do something.
 *
 * Server actions can't return a value to a plain `<form action={...}>`, so the
 * established pattern here is `redirect("...?error=<message>")`. Without
 * something rendering that parameter the redirect is invisible: the page simply
 * reloads unchanged and the user is left guessing whether their click
 * registered. Several actions were doing exactly that — validating, refusing,
 * and saying nothing.
 *
 * Renders nothing when there is no message, so it is safe to drop at the top of
 * any page.
 */
export function FormErrorBanner({ message }: { message?: string | null }) {
  const text = (message ?? "").trim();
  if (!text) return null;

  return (
    <p
      role="alert"
      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
    >
      {text}
    </p>
  );
}
