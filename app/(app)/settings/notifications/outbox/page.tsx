import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { Prisma, OutboundMessageChannel, OutboundMessageStatus, OutboundMessageType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";
import { deliverOutboundMessage, getOutboxRetryLimit, retryDueOutboundMessages } from "@/lib/notifications/whatsapp-outbox";

export const dynamic = "force-dynamic";

type SearchParams = {
  channel?: string;
  status?: string;
  type?: string;
  q?: string;
};

const CHANNELS = Object.values(OutboundMessageChannel);
const STATUSES = Object.values(OutboundMessageStatus);
const TYPES = Object.values(OutboundMessageType);

export default async function OutboxPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user } = await getCurrentUserRole();
  if (!(user.role === "ADMIN" || user.role === "OPS")) {
    redirect("/dashboard");
  }

  const filters = await searchParams;
  const channel = CHANNELS.includes(filters.channel as OutboundMessageChannel)
    ? (filters.channel as OutboundMessageChannel)
    : null;
  const status = STATUSES.includes(filters.status as OutboundMessageStatus)
    ? (filters.status as OutboundMessageStatus)
    : null;
  const type = TYPES.includes(filters.type as OutboundMessageType)
    ? (filters.type as OutboundMessageType)
    : null;
  const q = typeof filters.q === "string" ? filters.q.trim() : "";

  const where: Prisma.OutboundMessageWhereInput = {
    ...(channel ? { channel } : {}),
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(q
      ? {
          OR: [
            { id: { contains: q } },
            { to: { contains: q } },
            { providerMessageId: { contains: q } },
            { lastError: { contains: q } },
          ],
        }
      : {}),
  };

  const [rows, counts] = await Promise.all([
    prisma.outboundMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        channel: true,
        type: true,
        status: true,
        to: true,
        attemptCount: true,
        lastAttemptAt: true,
        nextAttemptAt: true,
        sentAt: true,
        provider: true,
        providerMessageId: true,
        providerDeliveryStatus: true,
        providerDeliveryAt: true,
        providerDeliveryErrorCode: true,
        providerDeliveryError: true,
        lastErrorCode: true,
        lastError: true,
        createdAt: true,
      },
    }),
    prisma.outboundMessage.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count.status]));

  async function retryNowAction() {
    "use server";
    const { user } = await getCurrentUserRole();
    if (!(user.role === "ADMIN" || user.role === "OPS")) return;
    await retryDueOutboundMessages(getOutboxRetryLimit(25));
    revalidatePath("/settings/notifications/outbox");
  }

  async function retryOneAction(formData: FormData) {
    "use server";
    const { user } = await getCurrentUserRole();
    if (!(user.role === "ADMIN" || user.role === "OPS")) return;
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await deliverOutboundMessage(id);
    revalidatePath("/settings/notifications/outbox");
  }

  async function markDeadAction(formData: FormData) {
    "use server";
    const { user } = await getCurrentUserRole();
    if (!(user.role === "ADMIN" || user.role === "OPS")) return;
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await prisma.outboundMessage.update({
      where: { id },
      data: { status: "DEAD", nextAttemptAt: new Date(0), lockedAt: null },
    });
    revalidatePath("/settings/notifications/outbox");
  }

  return (
    <div className="space-y-4">
      <div className="panel-shadow flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Status</span>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${(byStatus.PENDING ?? 0) > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)]"}`}>
            {byStatus.PENDING ?? 0} pending
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${(byStatus.FAILED ?? 0) > 0 ? "border-red-200 bg-red-50 text-red-700" : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)]"}`}>
            {byStatus.FAILED ?? 0} failed
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            {byStatus.SENT ?? 0} sent
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${(byStatus.DEAD ?? 0) > 0 ? "border-[var(--line)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)]"}`}>
            {byStatus.DEAD ?? 0} dead
          </span>
        </div>
        <form action={retryNowAction}>
          <button className="btn-premium rounded-md px-3 py-1.5 text-xs">Run Retry</button>
        </form>
      </div>

      <div className="panel-shadow grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <form className="grid gap-3 md:grid-cols-4" method="GET">
          <select name="channel" defaultValue={channel ?? ""} className="rounded-md border border-[var(--line)] px-3 py-2 text-sm">
            <option value="">All channels</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status ?? ""} className="rounded-md border border-[var(--line)] px-3 py-2 text-sm">
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
            <input
              name="type"
              defaultValue={type ?? ""}
              placeholder="Type (optional)"
              className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
            />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search id/to/error"
            className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          />
          <div className="md:col-span-4">
            <button className="btn-premium-secondary rounded-md px-4 py-2 text-sm">Apply Filters</button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--panel)] text-[11px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
            <tr>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Channel</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">To</th>
              <th className="px-3 py-2">Attempts</th>
              <th className="px-3 py-2">Last Error</th>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Delivery</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--line)] align-top">
                <td className="px-3 py-2">
                  <span className="inline-flex rounded-full border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-xs font-semibold">
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-[var(--ink-muted)]">{r.channel}</td>
                <td className="px-3 py-2 text-xs text-[var(--ink-muted)]">{r.type}</td>
                <td className="px-3 py-2 font-mono text-xs break-all">{r.to}</td>
                <td className="px-3 py-2 text-xs text-[var(--ink-muted)]">{r.attemptCount}</td>
                <td className="px-3 py-2 text-xs text-[var(--ink-muted)]">
                  {r.lastErrorCode ? <div className="font-mono">{r.lastErrorCode}</div> : null}
                  {r.lastError ? <div className="line-clamp-3 max-w-[28rem]">{r.lastError}</div> : <span>-</span>}
                </td>
                <td className="px-3 py-2 text-xs text-[var(--ink-muted)]">
                  {r.provider ? <div>{r.provider}</div> : <div>-</div>}
                  {r.providerMessageId ? <div className="font-mono break-all">{r.providerMessageId}</div> : null}
                </td>
                <td className="px-3 py-2 text-xs text-[var(--ink-muted)]">
                  {r.providerDeliveryStatus ? (
                    <>
                      <div className="font-mono">{r.providerDeliveryStatus}</div>
                      {r.providerDeliveryAt ? <div>{new Date(r.providerDeliveryAt).toLocaleString()}</div> : null}
                      {r.providerDeliveryErrorCode || r.providerDeliveryError ? (
                        <div className="mt-1">
                          <div className="font-mono">{r.providerDeliveryErrorCode}</div>
                          <div className="line-clamp-2 max-w-[20rem]">{r.providerDeliveryError}</div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <span>-</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <form action={retryOneAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="btn-premium-secondary rounded-md px-3 py-1 text-xs">Retry</button>
                    </form>
                    {r.status !== "DEAD" ? (
                      <form action={markDeadAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="rounded-md border border-black bg-black px-3 py-1 text-xs font-semibold text-white">
                          Mark Dead
                        </button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-sm text-[var(--ink-muted)]" colSpan={9}>
                  No outbox messages match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
