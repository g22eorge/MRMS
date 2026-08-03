import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserRole } from "@/lib/session";
import { requireOrgSession } from "@/lib/org-context";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

import { formatMoney } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { StatCards } from "@/components/ui/StatCards";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { StatusBadge } from "@/components/ui/StatusBadge";

const scryptAsync = promisify(scrypt);

async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(pin, salt, 32)) as Buffer;
  return `${salt}:${buf.toString("hex")}`;
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const buf = (await scryptAsync(pin, salt, 32)) as Buffer;
  const storedBuf = Buffer.from(hash, "hex");
  if (buf.length !== storedBuf.length) return false;
  return timingSafeEqual(buf, storedBuf);
}

export const dynamic = "force-dynamic";

export default async function CashierShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { user } = await getCurrentUserRole();

  if (!["ADMIN", "OPS", "FRONT_DESK"].includes(user.role)) {
    redirect("/dashboard");
  }

  if (!user.orgId) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const statusFilter = params.status ?? "all";
  const page = parsePage(params.page);

  // ── Server actions ───────────────────────────────────────────────────────────

  async function openShiftAction(formData: FormData) {
    "use server";
    const { user: _u, orgId } = await requireOrgSession();
    if (!["ADMIN", "OPS", "FRONT_DESK"].includes(_u.role)) return;

    const openingCashRaw = Number(String(formData.get("openingCash") ?? "0").trim());
    const notes = String(formData.get("notes") ?? "").trim();
    const pinRaw = String(formData.get("shiftPin") ?? "").trim();
    const openingCash = Number.isFinite(openingCashRaw) && openingCashRaw >= 0 ? openingCashRaw : 0;

    // Validate PIN: must be 4–8 digits if provided
    if (pinRaw && !/^\d{4,8}$/.test(pinRaw)) return;

    // Only one open shift per cashier at a time (scoped to org)
    const existing = await prisma.cashierShift.findFirst({
      where: { orgId, cashierId: _u.id, status: "OPEN" },
      select: { id: true },
    }).catch(() => null);
    if (existing) return;

    const shiftPin = pinRaw ? await hashPin(pinRaw) : null;

    await prisma.cashierShift.create({
      data: {
        orgId,
        cashierId: _u.id,
        status: "OPEN",
        openingCash,
        shiftPin,
        notes: notes || null,
      },
    });
    revalidatePath("/pos/shifts");
  }

  async function closeShiftAction(formData: FormData) {
    "use server";
    const { user: _u, orgId } = await requireOrgSession();
    if (!["ADMIN", "OPS", "FRONT_DESK"].includes(_u.role)) return;

    const shiftId = String(formData.get("shiftId") ?? "").trim();
    const closingCashRaw = Number(String(formData.get("closingCash") ?? "0").trim());
    const notes = String(formData.get("notes") ?? "").trim();
    const pinRaw = String(formData.get("shiftPin") ?? "").trim();
    if (!shiftId) return;

    const closingCash = Number.isFinite(closingCashRaw) && closingCashRaw >= 0 ? closingCashRaw : 0;

    const shift = await prisma.cashierShift.findFirst({
      where: {
        id: shiftId,
        orgId,
        status: "OPEN",
        ...( !["ADMIN"].includes(_u.role) ? { cashierId: _u.id } : {} ),
      },
      select: { id: true, shiftPin: true },
    }).catch(() => null);
    if (!shift) return;

    // If shift has a PIN and the closer is not ADMIN, verify it
    if (shift.shiftPin && !["ADMIN"].includes(_u.role)) {
      if (!pinRaw) return; // PIN required but not provided
      const ok = await verifyPin(pinRaw, shift.shiftPin);
      if (!ok) return;
    }

    await prisma.cashierShift.update({
      where: { id: shiftId },
      data: { status: "CLOSED", closingCash, closedAt: new Date(), notes: notes || null },
    }).catch(() => {});
    revalidatePath("/pos/shifts");
  }

  async function setShiftPinAction(formData: FormData) {
    "use server";
    const { user: _u, orgId } = await requireOrgSession();
    if (!["ADMIN", "OPS", "FRONT_DESK"].includes(_u.role)) return;

    const shiftId = String(formData.get("shiftId") ?? "").trim();
    const pinRaw  = String(formData.get("newPin") ?? "").trim();
    const action  = String(formData.get("pinAction") ?? "set").trim(); // "set" | "remove"
    if (!shiftId) return;

    // Non-admins can only update their own open shift
    const shift = await prisma.cashierShift.findFirst({
      where: {
        id: shiftId,
        orgId,
        status: "OPEN",
        ...(!["ADMIN"].includes(_u.role) ? { cashierId: _u.id } : {}),
      },
      select: { id: true },
    }).catch(() => null);
    if (!shift) return;

    if (action === "remove") {
      await prisma.cashierShift.update({ where: { id: shiftId }, data: { shiftPin: null } }).catch(() => {});
    } else {
      if (!/^\d{4,8}$/.test(pinRaw)) return;
      const hashed = await hashPin(pinRaw);
      await prisma.cashierShift.update({ where: { id: shiftId }, data: { shiftPin: hashed } }).catch(() => {});
    }
    revalidatePath("/pos/shifts");
  }

  async function reopenShiftAction(formData: FormData) {
    "use server";
    const { user: _u, orgId } = await requireOrgSession();
    if (_u.role !== "ADMIN") return;

    const shiftId = String(formData.get("shiftId") ?? "").trim();
    if (!shiftId) return;

    // Only one open shift per cashier — check for existing open shift first
    const shift = await prisma.cashierShift.findFirst({
      where: { id: shiftId, orgId, status: "CLOSED" },
      select: { id: true, cashierId: true },
    }).catch(() => null);
    if (!shift) return;

    const alreadyOpen = await prisma.cashierShift.findFirst({
      where: { orgId, cashierId: shift.cashierId, status: "OPEN" },
      select: { id: true },
    }).catch(() => null);
    if (alreadyOpen) return; // cashier already has an open shift

    await prisma.cashierShift.update({
      where: { id: shiftId },
      data: { status: "OPEN", closedAt: null, closingCash: null },
    }).catch(() => {});
    revalidatePath("/pos/shifts");
  }

  async function deleteShiftAction(formData: FormData) {
    "use server";
    const { user: _u, orgId } = await requireOrgSession();
    if (_u.role !== "ADMIN") return;

    const shiftId = String(formData.get("shiftId") ?? "").trim();
    if (!shiftId) return;

    await prisma.cashierShift.deleteMany({ where: { id: shiftId, orgId } }).catch(() => {});
    revalidatePath("/pos/shifts");
  }

  // ── Data fetching ────────────────────────────────────────────────────────────

  const where: Prisma.CashierShiftWhereInput = { orgId: user.orgId };
  if (statusFilter === "open") where.status = "OPEN";
  if (statusFilter === "closed") where.status = "CLOSED";

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [shifts, shiftsTotal, myOpenShift, openCount, totalShifts, closedThisMonth, cashCollectedAgg] = await Promise.all([
    prisma.cashierShift.findMany({
      where,
      orderBy: { openedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }).catch(() => []),
    prisma.cashierShift.count({ where }).catch(() => 0),
    // Resolve the current user's open shift across the whole dataset, not just the
    // current page, so the "My Shift" panel is always correct.
    prisma.cashierShift.findFirst({ where: { orgId: user.orgId, cashierId: user.id, status: "OPEN" } }).catch(() => null),
    prisma.cashierShift.count({ where: { orgId: user.orgId, status: "OPEN" } }).catch(() => 0),
    prisma.cashierShift.count({ where: { orgId: user.orgId } }).catch(() => 0),
    prisma.cashierShift.count({ where: { orgId: user.orgId, status: "CLOSED", closedAt: { gte: monthStart } } }).catch(() => 0),
    prisma.cashierShift.aggregate({ _sum: { closingCash: true }, where: { orgId: user.orgId, status: "CLOSED", closedAt: { gte: monthStart } } }).catch(() => ({ _sum: { closingCash: 0 } })),
  ]);
  const cashCollectedThisMonth = cashCollectedAgg._sum?.closingCash ?? 0;
  const pageView = paginationView(page, shiftsTotal);
  const shiftsHref = pageHrefBuilder("/pos/shifts", { status: params.status ?? "" });

  // Fetch cashier names in one query
  const cashierIds = [...new Set(shifts.map((s) => s.cashierId))];
  const cashiers = cashierIds.length
    ? await prisma.user.findMany({
        where: { id: { in: cashierIds } },
        select: { id: true, name: true },
      }).catch(() => [])
    : [];
  const cashierMap = Object.fromEntries(cashiers.map((c) => [c.id, c.name]));

  const currency = "UGX";

  return (
    <ListPageLayout
      header={{
        eyebrow: "POS · Cashier Shifts",
        title: "Shift Management",
        description: "Open or close your shift to start processing sales",
        actions: <Link href="/pos" className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px]">← Back to Sales</Link>,
      }}
    >
      {/* ── MY SHIFT — always first ── */}
      {!myOpenShift ? (
        <div className="rounded-xl border-2 border-dashed border-[var(--accent)]/30 bg-[var(--accent)]/5 p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)]/15 text-xl">⏱</div>
            <div>
              <h2 className="text-base font-bold text-[var(--ink)]">No shift open — start yours now</h2>
              <p className="text-[13px] text-[var(--ink-muted)]">You must open a shift before processing any sales.</p>
            </div>
          </div>
          <form action={openShiftAction} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                Opening Cash ({currency})
              </label>
              <input
                name="openingCash"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                className="h-9 w-40 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                Shift PIN <span className="normal-case font-normal text-[var(--ink-muted)]">(4–8 digits, optional)</span>
              </label>
              <input
                name="shiftPin"
                type="password"
                inputMode="numeric"
                placeholder="e.g. 1234"
                maxLength={8}
                autoComplete="new-password"
                className="h-9 w-36 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                Notes (optional)
              </label>
              <input
                name="notes"
                placeholder="Handover note, branch info…"
                className="h-9 w-56 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <button
              type="submit"
              className="btn-premium h-9 rounded-lg px-5 text-sm font-semibold"
            >
              Open Shift
            </button>
          </form>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Your Shift is Open</h2>
                {myOpenShift.shiftPin
                  ? <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">🔒 PIN protected</span>
                  : <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">No PIN</span>
                }
              </div>
              <p className="text-[12px] text-emerald-700 dark:text-emerald-400">
                Opened {myOpenShift.openedAt.toLocaleString()} · Opening cash: {formatMoney(myOpenShift.openingCash, currency)}
              </p>
            </div>
          </div>
          <form action={closeShiftAction} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="shiftId" value={myOpenShift.id} />
            <div className="space-y-1">
              <label className="text-[13px] font-semibold uppercase tracking-wide text-emerald-700">
                Closing Cash ({currency})
              </label>
              <input
                name="closingCash"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                required
                className="h-9 w-40 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            {myOpenShift.shiftPin && (
              <div className="space-y-1">
                <label className="text-[13px] font-semibold uppercase tracking-wide text-emerald-700">
                  Shift PIN <span className="text-emerald-600 normal-case font-normal">(required)</span>
                </label>
                <input
                  name="shiftPin"
                  type="password"
                  inputMode="numeric"
                  placeholder="Enter PIN"
                  maxLength={8}
                  required
                  autoComplete="current-password"
                  className="h-9 w-32 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[13px] font-semibold uppercase tracking-wide text-emerald-700">
                Closing Notes
              </label>
              <input
                name="notes"
                placeholder="End-of-day notes…"
                className="h-9 w-56 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <ConfirmSubmitButton
              message="Close this shift? This will record the closing cash and mark the shift as closed."
              confirmLabel="Close Shift"
              className="h-9 rounded-lg bg-emerald-700 px-5 text-sm font-semibold text-white hover:opacity-90"
            >Close Shift</ConfirmSubmitButton>
          </form>

          {/* Set / change / remove PIN on the active shift */}
          <div className="mt-4 border-t border-emerald-500/20 pt-3">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
              {myOpenShift.shiftPin ? "Change or remove shift PIN" : "Set a shift PIN"}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <form action={setShiftPinAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="shiftId" value={myOpenShift.id} />
                <input type="hidden" name="pinAction" value="set" />
                <div className="space-y-1">
                  <label className="text-[12px] font-semibold uppercase tracking-wide text-emerald-700">{myOpenShift.shiftPin ? "New PIN" : "PIN"} (4–8 digits)</label>
                  <input
                    name="newPin"
                    type="password"
                    inputMode="numeric"
                    placeholder="e.g. 1234"
                    maxLength={8}
                    required
                    autoComplete="new-password"
                    className="h-9 w-32 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button type="submit" className="h-9 rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-500/30 dark:text-emerald-300">
                  {myOpenShift.shiftPin ? "Update PIN" : "Set PIN"}
                </button>
              </form>
              {myOpenShift.shiftPin && (
                <form action={setShiftPinAction}>
                  <input type="hidden" name="shiftId" value={myOpenShift.id} />
                  <input type="hidden" name="pinAction" value="remove" />
                  <ConfirmSubmitButton message="Remove the PIN from this shift? Anyone will be able to close it without a PIN." confirmLabel="Remove PIN" className="h-9 rounded-lg border border-red-400/30 bg-red-500/5 px-4 text-sm font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-400">
                    Remove PIN
                  </ConfirmSubmitButton>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── KPI tiles (below shift panel) ── */}
      <StatCards columns={4} cards={[
          { label: "Total Shifts", value: totalShifts, sub: "all time" },
          { label: "Open Shifts", value: openCount, sub: "currently open" },
          { label: "Closed This Month", value: closedThisMonth, sub: "this month" },
          { label: "Cash Collected MTD", value: formatMoney(cashCollectedThisMonth, currency), sub: "closing cash, this month" },
        ]} />

      {/* Filter */}
      <form method="GET" className="flex gap-2">
        {(["all", "open", "closed"] as const).map((s) => (
          <button
            key={s}
            name="status"
            value={s}
            type="submit"
            className={`h-8 rounded-lg px-3 text-sm font-semibold capitalize transition-colors ${
              statusFilter === s
                ? "bg-[var(--accent)] text-black"
                : "border border-[var(--line)] text-[var(--ink-muted)] hover:bg-[var(--panel-strong)]"
            }`}
          >
            {s}
          </button>
        ))}
      </form>

      {/* Shifts table */}
      <DataTable
        rows={shifts}
        getRowKey={(shift) => shift.id}
        empty="No shifts found"
        renderMobileCard={(shift) => {
          const variance = shift.closingCash != null ? shift.closingCash - shift.openingCash : null;
          const isOpen = shift.status === "OPEN";
          return (
            <div className="px-4 py-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-medium text-[var(--ink)]">
                  {cashierMap[shift.cashierId] ?? shift.cashierId.slice(0, 8)}
                  {shift.cashierId === user.id && <StatusBadge tone="info" className="ml-1.5">you</StatusBadge>}
                  {shift.shiftPin && <span className="ml-1 text-[12px]" title="PIN protected">🔒</span>}
                </span>
                <StatusBadge tone={isOpen ? "success" : "neutral"}>{shift.status}</StatusBadge>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] text-[var(--ink-muted)]">
                <span>Open: {shift.openedAt.toLocaleString()}</span>
                {shift.closedAt && <span>Close: {shift.closedAt.toLocaleString()}</span>}
              </div>
              <div className="mt-1 flex items-center gap-3 text-[12px]">
                <span className="text-[var(--ink-muted)]">Opening {formatMoney(shift.openingCash, currency)}</span>
                {shift.closingCash != null && <span className="text-[var(--ink)]">Closing {formatMoney(shift.closingCash, currency)}</span>}
                {variance != null && <span className={variance < 0 ? "font-semibold text-red-600" : variance > 0 ? "font-semibold text-emerald-600" : "text-[var(--ink-muted)]"}>{variance >= 0 ? "+" : ""}{formatMoney(variance, currency)}</span>}
              </div>
              {["ADMIN"].includes(user.role) && (
                <div className="mt-2 flex items-center gap-2">
                  {isOpen && shift.cashierId !== user.id && (
                    <form action={closeShiftAction}>
                      <input type="hidden" name="shiftId" value={shift.id} />
                      <input type="hidden" name="closingCash" value="0" />
                      <ConfirmSubmitButton message="Force close this shift? Closing cash will be set to 0." confirmLabel="Force Close" className="rounded border border-orange-400/30 px-2 py-0.5 text-[13px] font-semibold text-orange-600 hover:bg-orange-500/10 dark:text-orange-400">Force close</ConfirmSubmitButton>
                    </form>
                  )}
                  {!isOpen && (
                    <form action={reopenShiftAction}>
                      <input type="hidden" name="shiftId" value={shift.id} />
                      <ConfirmSubmitButton message="Reopen this shift? The cashier will be able to process sales again. Use this to correct an accidental closure." confirmLabel="Reopen" className="rounded border border-sky-400/30 px-2 py-0.5 text-[13px] font-semibold text-sky-600 hover:bg-sky-500/10 dark:text-sky-400">Reopen</ConfirmSubmitButton>
                    </form>
                  )}
                  {!isOpen && (
                    <form action={deleteShiftAction}>
                      <input type="hidden" name="shiftId" value={shift.id} />
                      <ConfirmSubmitButton message="Delete this shift record? This cannot be undone." confirmLabel="Delete" className="rounded border border-red-400/30 px-2 py-0.5 text-[13px] font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-400">Delete</ConfirmSubmitButton>
                    </form>
                  )}
                </div>
              )}
            </div>
          );
        }}
        columns={[
          {
            key: "cashier",
            header: "Cashier",
            className: "font-medium text-[var(--ink)]",
            cell: (shift) => (
              <>
                {cashierMap[shift.cashierId] ?? shift.cashierId.slice(0, 8)}
                {shift.cashierId === user.id && <StatusBadge tone="info" className="ml-1.5">you</StatusBadge>}
                {shift.shiftPin && <span className="ml-1 text-[12px]" title="PIN protected">🔒</span>}
              </>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (shift) => <StatusBadge tone={shift.status === "OPEN" ? "success" : "neutral"}>{shift.status}</StatusBadge>,
          },
          { key: "opened", header: "Opened", className: "whitespace-nowrap text-[var(--ink-muted)]", cell: (shift) => shift.openedAt.toLocaleString() },
          { key: "closed", header: "Closed", className: "whitespace-nowrap text-[var(--ink-muted)]", cell: (shift) => (shift.closedAt ? shift.closedAt.toLocaleString() : "—") },
          { key: "openingCash", header: "Opening Cash", align: "right", className: "whitespace-nowrap tabular-nums text-[var(--ink)]", cell: (shift) => formatMoney(shift.openingCash, currency) },
          { key: "closingCash", header: "Closing Cash", align: "right", className: "whitespace-nowrap tabular-nums text-[var(--ink)]", cell: (shift) => (shift.closingCash != null ? formatMoney(shift.closingCash, currency) : "—") },
          {
            key: "variance",
            header: "Variance",
            align: "right",
            className: "whitespace-nowrap tabular-nums",
            cell: (shift) => {
              const variance = shift.closingCash != null ? shift.closingCash - shift.openingCash : null;
              return variance != null
                ? <span className={variance < 0 ? "font-semibold text-red-600" : variance > 0 ? "font-semibold text-emerald-600" : "text-[var(--ink-muted)]"}>{variance >= 0 ? "+" : ""}{formatMoney(variance, currency)}</span>
                : "—";
            },
          },
          { key: "notes", header: "Notes", className: "max-w-[160px] truncate text-[var(--ink-muted)]", cell: (shift) => shift.notes || "—" },
        ]}
        actions={["ADMIN"].includes(user.role) ? (shift) => {
          const isOpen = shift.status === "OPEN";
          return (
            <>
              {isOpen && shift.cashierId !== user.id && (
                <form action={closeShiftAction}><input type="hidden" name="shiftId" value={shift.id} /><input type="hidden" name="closingCash" value="0" /><ConfirmSubmitButton message="Force close this shift? Closing cash will be set to 0." confirmLabel="Force Close" className="rounded border border-orange-400/30 px-2 py-0.5 font-semibold text-orange-600 hover:bg-orange-500/10 dark:text-orange-400">Force close</ConfirmSubmitButton></form>
              )}
              {!isOpen && (
                <form action={reopenShiftAction}><input type="hidden" name="shiftId" value={shift.id} /><ConfirmSubmitButton message="Reopen this shift? The cashier will be able to process sales again. Use this to correct an accidental closure." confirmLabel="Reopen" className="rounded border border-sky-400/30 px-2 py-0.5 font-semibold text-sky-600 hover:bg-sky-500/10 dark:text-sky-400">Reopen</ConfirmSubmitButton></form>
              )}
              {!isOpen && (
                <form action={deleteShiftAction}><input type="hidden" name="shiftId" value={shift.id} /><ConfirmSubmitButton message="Delete this shift record? This cannot be undone." confirmLabel="Delete" className="rounded border border-red-400/30 px-2 py-0.5 font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-400">Delete</ConfirmSubmitButton></form>
              )}
            </>
          );
        } : undefined}
      />

      <TablePagination
        page={pageView.page}
        totalPages={pageView.totalPages}
        rangeStart={pageView.rangeStart}
        rangeEnd={pageView.rangeEnd}
        total={pageView.total}
        unit="shifts"
        hrefForPage={shiftsHref}
      />
    </ListPageLayout>
  );
}
