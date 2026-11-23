/**
 * Next calls onRequestError for every uncaught error in a page, a route
 * handler or a server action. It is written to the ErrorEvent table for the
 * platform console (see lib/error-events.ts).
 */
export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routePath?: string; routeType?: string },
) {
  // The Prisma client only runs on the Node runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordErrorEvent } = await import("@/lib/error-events");
  const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";
  await recordErrorEvent(error, {
    route: context?.routePath ?? null,
    path: request?.path ?? null,
    method: request?.method ?? null,
    kind: context?.routeType ?? null,
    digest: digest || null,
  });
}
