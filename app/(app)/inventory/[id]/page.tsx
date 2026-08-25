import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DataTable } from "@/components/ui/DataTable";
import { StatCards, type StatCard } from "@/components/ui/StatCards";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RecordActionBar } from "@/components/record/RecordActionBar";
import { formatMoney } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { requireModule, OrgModule } from "@/lib/module-access";
import { can } from "@/lib/permissions";
import { adjustStockAction, updatePartAction, togglePartActiveAction } from "../actions";
import { FormField, FormRow, FormSelect, FormTextarea } from "@/components/ui/form-field";
import { StockAdjustModal } from "@/components/inventory/StockAdjustModal";
import { FormErrorBanner } from "@/components/ui/FormErrorBanner";

import { SubmitButton } from "@/components/ui/SubmitButton";
// Subtle grouping label inside the details panel — keeps a long edit form
// scannable without hand-rolling repeated markup.
function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2 border-t border-[var(--line)] pt-3">
      <p className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]/60">{label}</p>
      {children}
    </div>
  );
}

export default async function PartDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModule(OrgModule.INVENTORY);
  const { user, orgId } = await requireOrgSession();
  if (!["ADMIN", "MANAGER", "TECH_MANAGER", "OPS", "TECHNICIAN_INTERNAL"].includes(user.role)) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const sp = ((await searchParams?.catch(() => ({}))) ?? {}) as Record<string, string | string[] | undefined>;
  const error = typeof sp.error === "string" ? sp.error : null;
  const saved = sp.saved === "1";
  const canManage = can.manageInventory(user);
  // Read-first: details show as a clean summary; ?edit=1 opens the edit form.
  const editMode = canManage && sp.edit === "1";

  const [part, transactions] = await Promise.all([
    prisma.part.findFirst({
      where: { id, orgId },
      select: {
        id: true, sku: true, name: true, manufacturer: true,
        unitCost: true, qtyOnHand: true, qtyReserved: true,
        reorderLevel: true, isActive: true, createdAt: true,
        sellingPrice: true, category: true, description: true,
        taxable: true, taxRate: true,
        reservations: {
          where: { status: "RESERVED" },
          select: {
            id: true, quantity: true, reservedAt: true,
            job: { select: { id: true, jobNumber: true, device: { select: { brand: true, model: true } } } },
          },
          orderBy: { reservedAt: "desc" },
          take: 10,
        },
      },
    }),
    prisma.partStockTransaction.findMany({
      where: { partId: id, part: { orgId } },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  if (!part) notFound();

  const available = part.qtyOnHand - part.qtyReserved;
  const stockValue = (part.unitCost ?? 0) * part.qtyOnHand;
  const isLow = part.reorderLevel > 0 && part.qtyOnHand <= part.reorderLevel;
  const isOut = part.qtyOnHand === 0;

  // Standard KPI band — the shared StatCards (desktop) + a compact mobile strip,
  // instead of hand-rolled tiles (per components/ui/StatCards.tsx guidance).
  const kpiCards: StatCard[] = [
    { key: "onhand", label: "On Hand", value: part.qtyOnHand, tone: isOut ? "crit" : isLow ? "warn" : "neutral" },
    { key: "reserved", label: "Reserved", value: part.qtyReserved, tone: "neutral" },
    { key: "available", label: "Available", value: available, tone: available <= 0 ? "crit" : "good" },
    { key: "value", label: "Stock Value", value: formatMoney(stockValue), tone: "accent" },
  ];
  const kpiToneText: Record<string, string> = {
    neutral: "text-[var(--ink)]", crit: "text-[var(--dc-crit)]", warn: "text-[var(--dc-warn)]", good: "text-[var(--dc-good)]", accent: "text-[var(--dc-accent-2)]",
  };

  // Running balance per row
  const txnsAsc = [...transactions].reverse();
  let bal = part.qtyOnHand;
  const bals: number[] = new Array(txnsAsc.length);
  for (let i = txnsAsc.length - 1; i >= 0; i--) {
    bals[i] = bal;
    const t = txnsAsc[i];
    bal -= t.type === "IN" ? t.quantity : t.type === "OUT" ? -t.quantity : t.quantity;
  }
  const txnsDisplay = transactions.map((t, di) => ({ ...t, balance: bals[transactions.length - 1 - di] }));


  return (
    <div className="space-y-5">
      <FormErrorBanner message={typeof sp.error === "string" ? sp.error : undefined} />

      {/* ── Banners ── */}
      {saved && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-2.5 text-[0.8125rem] font-semibold text-emerald-700">
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>
          Stock updated — new entry recorded in the log.
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-2.5 text-[0.8125rem] text-red-600">
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm0 3.75a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3A.75.75 0 0 0 8 4.75Zm0 6.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/></svg>
          {error}
        </div>
      )}

      {/* ── Header ── */}
      <RecordActionBar
        backHref="/inventory"
        eyebrow="Inventory"
        title={part.name}
        status={
          !part.isActive ? { label: "Inactive", tone: "neutral" }
            : isOut ? { label: "Out of Stock", tone: "danger" }
              : isLow ? { label: "Low Stock", tone: "warning" }
                : { label: "Active Stock", tone: "success" }
        }
        primary={canManage ? <StockAdjustModal partId={part.id} currentQty={part.qtyOnHand} action={adjustStockAction} /> : undefined}
        secondary={
          canManage ? (
            <div className="flex items-center gap-2">
              {!editMode ? (
                <Link href={`/inventory/${part.id}?edit=1`} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.75rem] font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">
                  Edit
                </Link>
              ) : null}
              <form action={togglePartActiveAction}>
                <input type="hidden" name="partId" value={part.id} />
                <input type="hidden" name="next" value={part.isActive ? "0" : "1"} />
                <SubmitButton bare className={`rounded-lg border px-3 py-1.5 text-[0.75rem] font-semibold transition ${
 part.isActive
 ? "border-red-400/40 text-red-600 hover:bg-red-500/8"
 : "border-emerald-400/40 text-emerald-700 hover:bg-emerald-500/8"
 }`}>
                  {part.isActive ? "Deactivate" : "Reactivate"}
                </SubmitButton>
              </form>
            </div>
          ) : undefined
        }
      />
      {part.manufacturer ? <p className="-mt-2 px-0.5 text-[0.8125rem] text-[var(--ink-muted)]">{part.manufacturer}</p> : null}

      {/* ── KPI band — compact strip on mobile, shared StatCards on desktop ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:hidden">
        {kpiCards.map((c) => (
          <div key={c.key} className="dc-card px-4 py-3">
            <p className="text-[0.6875rem] font-semibold text-[var(--ink-muted)]">{c.label}</p>
            <p className={`mt-0.5 text-xl font-bold leading-none tabular-nums ${kpiToneText[c.tone ?? "neutral"]}`}>{c.value}</p>
          </div>
        ))}
      </div>
      <StatCards cards={kpiCards} />

      {/* ── Main grid ── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">

        {/* ── Left ── */}
        <div className="space-y-4 min-w-0">

          {/* Movement log */}
          <div className="dc-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-2.5">
              <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Movement Log</p>
              <p className="text-[0.6875rem] tabular-nums text-[var(--ink-muted)]">{transactions.length} entries</p>
            </div>
            <DataTable
              frameless
              dense
              rows={txnsDisplay}
              getRowKey={(txn) => txn.id}
              empty="No movements recorded yet."
              columns={[
                {
                  key: "date",
                  header: <>Date &amp; Time</>,
                  className: "text-[0.75rem] tabular-nums text-[var(--ink)] whitespace-nowrap",
                  cell: (txn) => (
                    <>
                      {txn.createdAt.toLocaleDateString([], { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-")}
                      {" "}
                      <span className="text-[var(--ink-muted)]">
                        {txn.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </>
                  ),
                },
                {
                  key: "action",
                  header: "Action",
                  cell: (txn) => (
                    <StatusBadge
                      tone={txn.type === "IN" ? "success" : txn.type === "OUT" ? "danger" : "warning"}
                      className="uppercase tracking-wide"
                    >
                      {txn.type === "IN" ? "Inbound" : txn.type === "OUT" ? "Write-off" : "Correction"}
                    </StatusBadge>
                  ),
                },
                {
                  key: "change",
                  header: "Change",
                  align: "right",
                  className: "font-black tabular-nums whitespace-nowrap",
                  cell: (txn) => {
                    const isIn = txn.type === "IN";
                    const isOt = txn.type === "OUT";
                    const sign = isIn ? "+" : isOt ? "−" : (txn.quantity >= 0 ? "+" : "−");
                    return (
                      <span className={isIn ? "text-emerald-600" : isOt ? "text-red-500" : "text-amber-600"}>
                        {sign}{Math.abs(txn.quantity)}
                      </span>
                    );
                  },
                },
                {
                  key: "balance",
                  header: "Balance",
                  align: "right",
                  className: "font-semibold tabular-nums text-[var(--ink)] whitespace-nowrap",
                  cell: (txn) => txn.balance,
                },
                {
                  key: "cost",
                  header: "Unit cost",
                  align: "right",
                  className: "hidden whitespace-nowrap tabular-nums text-[0.75rem] text-[var(--ink-muted)] sm:table-cell",
                  headerClassName: "hidden sm:table-cell",
                  cell: (txn) => txn.unitCost != null ? formatMoney(txn.unitCost) : <span className="text-[var(--ink-muted)]/30">—</span>,
                },
                {
                  key: "reference",
                  header: "Reference",
                  className: "hidden max-w-[180px] truncate text-[0.75rem] text-[var(--ink-muted)] sm:table-cell",
                  headerClassName: "hidden sm:table-cell",
                  cell: (txn) => txn.reason ?? <span className="text-[var(--ink-muted)]/30">—</span>,
                },
                {
                  key: "handler",
                  header: "Handler",
                  className: "text-[0.75rem] text-[var(--ink-muted)] whitespace-nowrap",
                  cell: (txn) => txn.createdBy?.name ?? <span className="text-[var(--ink-muted)]/30">—</span>,
                },
              ]}
            />
          </div>
        </div>

        {/* ── Right: Static Details ── */}
        <div className="space-y-4">
          <div className="dc-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-2.5">
              <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Item Details</p>
              <span className="mono text-[0.6875rem] text-[var(--ink-muted)]">{part.sku}</span>
            </div>

            {editMode ? (
              <form action={updatePartAction} className="space-y-4 p-4">
                <input type="hidden" name="partId" value={part.id} />

                <div className="space-y-2">
                  <FormField label="Item name" name="name" defaultValue={part.name} required />
                  <FormRow>
                    <FormField label="Manufacturer" name="manufacturer" defaultValue={part.manufacturer ?? ""} placeholder="Optional" />
                    <FormField label="Category"     name="category"     defaultValue={part.category ?? ""} placeholder="Optional" />
                  </FormRow>
                </div>

                <FieldGroup label="Pricing &amp; tax">
                  <FormRow>
                    <FormField label="Cost / unit"   name="unitCost"     defaultValue={String(part.unitCost ?? "")} placeholder="0.00" inputMode="decimal" />
                    <FormField label="Selling price" name="sellingPrice" defaultValue={String(part.sellingPrice ?? "")} placeholder="0.00" inputMode="decimal" />
                  </FormRow>
                  <FormRow>
                    <FormSelect label="Taxable" name="taxable" defaultValue={part.taxable ? "true" : "false"}>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </FormSelect>
                    <FormField label="Tax rate %" name="taxRate" defaultValue={String(part.taxRate ?? "")} placeholder="18" inputMode="decimal" />
                  </FormRow>
                </FieldGroup>

                <FieldGroup label="Stock &amp; notes">
                  <FormField label="Reorder point" name="reorderLevel" defaultValue={String(part.reorderLevel)} placeholder="0" inputMode="numeric" />
                  <FormTextarea label="Description" name="description" defaultValue={part.description ?? ""} placeholder="Optional" rows={2} />
                </FieldGroup>

                <div className="flex gap-2 pt-1">
                  <SubmitButton bare className="btn-premium flex-1 rounded-lg px-4 py-2 text-sm font-semibold">Save details</SubmitButton>
                  <Link href={`/inventory/${part.id}`} className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--ink-muted)] transition hover:text-[var(--ink)]">Cancel</Link>
                </div>
              </form>
            ) : (
              <>
                <dl className="divide-y divide-[var(--line)]">
                  {[
                    ["Manufacturer",  part.manufacturer || "—"],
                    ["Category",      part.category || "—"],
                    ["Cost / unit",   part.unitCost != null ? formatMoney(part.unitCost) : "—"],
                    ["Selling price", part.sellingPrice != null ? formatMoney(part.sellingPrice) : "—"],
                    ["Tax",           part.taxable ? `${part.taxRate ?? 0}% VAT` : "Not taxable"],
                    ["Reorder point", String(part.reorderLevel)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 px-5 py-2.5">
                      <dt className="text-[0.75rem] text-[var(--ink-muted)]">{label}</dt>
                      <dd className="text-right text-[0.8125rem] font-semibold text-[var(--ink)]">{value}</dd>
                    </div>
                  ))}
                </dl>
                {part.description ? (
                  <div className="border-t border-[var(--line)] px-5 py-3">
                    <p className="mb-1 text-[0.75rem] text-[var(--ink-muted)]">Description</p>
                    <p className="text-[0.8125rem] text-[var(--ink)]">{part.description}</p>
                  </div>
                ) : null}
              </>
            )}
          </div>

          {/* Reservations */}
          {part.reservations.length > 0 && (
            <div className="dc-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-2.5">
                <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Reserved For Jobs</p>
                <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[0.6875rem] font-bold text-amber-700">
                  {part.reservations.length}
                </span>
              </div>
              <ul className="divide-y divide-[var(--line)]">
                {part.reservations.map((res) => (
                  <li key={res.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                    <div className="min-w-0">
                      {res.job ? (
                        <Link href={`/jobs/${res.job.id}`} className="text-[0.8125rem] font-semibold text-[var(--accent)] hover:underline">
                          {res.job.jobNumber ?? `#${res.job.id.slice(-6)}`}
                        </Link>
                      ) : (
                        <p className="text-[0.8125rem] text-[var(--ink-muted)]">Job removed</p>
                      )}
                      {res.job?.device && (
                        <p className="truncate text-[0.6875rem] text-[var(--ink-muted)]">
                          {res.job.device.brand} {res.job.device.model}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-0.5 text-[0.75rem] font-bold text-amber-700">
                      ×{res.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
