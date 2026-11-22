/**
 * Double-submit dedup guard.
 *
 * A slow server + an impatient click = the same create action fired twice.
 * The client <SubmitButton> greys out on the first click, but a fast or laggy
 * double-tap can still land two requests. This is the server backstop: run it
 * INSIDE the same transaction as the create, just before inserting. Because
 * writes are serialized, the second request sees the first
 * request's already-committed row and reuses it instead of inserting a duplicate.
 *
 * The `where` must capture the identity of the thing being created (org + the
 * fields a human would call "the same one") plus nothing that legitimately
 * differs between two intentional creates. Keep the window short (seconds), so
 * a genuine second identical action a minute later is still allowed.
 */
// The delegate is any Prisma model client (prisma.payment, tx.refund, orgDb().sale, …).
// Typed loosely on purpose so one helper composes with every model's findFirst
// without fighting Prisma's per-model generic signatures at each call site.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FindFirstDelegate = { findFirst: (args: any) => Promise<any> };

export async function findRecentDuplicate(
  delegate: FindFirstDelegate,
  where: Record<string, unknown>,
  opts?: { windowMs?: number; createdAtField?: string; nowMs?: number },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const windowMs = opts?.windowMs ?? 10_000;
  const field = opts?.createdAtField ?? "createdAt";
  const nowMs = opts?.nowMs ?? Date.now();
  const since = new Date(nowMs - windowMs);
  return delegate.findFirst({
    where: { ...where, [field]: { gte: since } },
    orderBy: { [field]: "desc" },
  });
}
