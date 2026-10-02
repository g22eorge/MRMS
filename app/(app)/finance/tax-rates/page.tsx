import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { RowActionsMenu, MenuSection, MenuDestructiveRow } from "@/components/shared/RowActionsMenu";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FormErrorBanner } from "@/components/ui/FormErrorBanner";

import { SubmitButton } from "@/components/ui/SubmitButton";
import { CreateTaxRateDialog, type TaxRateFormState } from "./CreateTaxRateDialog";
export const dynamic = "force-dynamic";

export default async function TaxRatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.toLowerCase().trim() ?? "";
  const { user, orgId } = await requireOrgSession();
  if (!["ADMIN", "MANAGER"].includes(user.role)) redirect("/dashboard");

  const taxRates = await prisma.taxRate.findMany({
    where: { orgId },
    orderBy: [{ isDefault: "desc" }, { code: "asc" }],
  });
  const filteredTaxRates = q
    ? taxRates.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q))
    : taxRates;
  const activeRates = taxRates.filter((r) => r.isActive).length;
  const defaultRate = taxRates.find((r) => r.isDefault);

  async function createTaxRateAction(_prev: TaxRateFormState, formData: FormData): Promise<TaxRateFormState> {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!["ADMIN", "MANAGER"].includes(user.role)) redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const name = String(formData.get("name") ?? "").trim();
    const code = String(formData.get("code") ?? "").trim().toUpperCase();
    const rateRaw = Number(String(formData.get("rate") ?? "").trim());
    const isDefault = formData.get("isDefault") === "on";
    const appliesToSales = formData.get("appliesToSales") === "on";
    const appliesToPurchases = formData.get("appliesToPurchases") === "on";

    if (!name || !code) {
      return { error: "A tax rate needs a name and a code." };
    }
    if (!Number.isFinite(rateRaw) || rateRaw < 0) {
      return { error: "Enter a rate of zero or more." };
    }

    const existing = await prisma.taxRate.findFirst({ where: { orgId, code } });
    if (existing) {
      // The old inline form silently did nothing on a duplicate.
      return { error: `A tax rate with code ${code} already exists.` };
    }

    if (isDefault) {
      await prisma.taxRate.updateMany({ where: { orgId, isDefault: true }, data: { isDefault: false } });
    }

    const taxRate = await prisma.taxRate.create({
      data: { orgId, name, code, rate: rateRaw, isDefault, appliesToSales, appliesToPurchases },
    });

    await writeSystemAuditEvent({
      orgId,
      entityType: "TaxRate",
      entityId: taxRate.id,
      action: "TAX_RATE_CREATED",
      summary: `${code} — ${name} — ${rateRaw}%`,
      actorUserId: user.id,
    });

    revalidatePath("/finance/tax-rates");
    return null;
  }

  async function toggleTaxRateAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!["ADMIN", "MANAGER"].includes(user.role)) redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const taxRateId = String(formData.get("taxRateId") ?? "").trim();
    const action = String(formData.get("action") ?? "").trim();
    if (!taxRateId) return;

    const rate = await prisma.taxRate.findFirst({ where: { id: taxRateId, orgId } });
    if (!rate) return;

    if (action === "setDefault") {
      await prisma.taxRate.updateMany({ where: { orgId, isDefault: true }, data: { isDefault: false } });
      await prisma.taxRate.update({ where: { id: taxRateId }, data: { isDefault: true, isActive: true } });
    } else {
      await prisma.taxRate.update({ where: { id: taxRateId }, data: { isActive: !rate.isActive } });
    }

    revalidatePath("/finance/tax-rates");
  }

  async function deleteTaxRateAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!["ADMIN"].includes(user.role)) redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const taxRateId = String(formData.get("taxRateId") ?? "").trim();
    if (!taxRateId) return;

    const rate = await prisma.taxRate.findFirst({ where: { id: taxRateId, orgId }, select: { code: true, name: true } });
    if (!rate) return;

    await prisma.taxRate.delete({ where: { id: taxRateId } });

    await writeSystemAuditEvent({
      orgId,
      entityType: "TaxRate",
      entityId: taxRateId,
      action: "TAX_RATE_DELETED",
      summary: `Deleted ${rate.code} — ${rate.name}`,
      actorUserId: user.id,
    });

    revalidatePath("/finance/tax-rates");
  }

  // Named so the same actions menu renders in the desktop table AND mobile card.
  const renderRateActions = (rate: (typeof filteredTaxRates)[number]) => (
    <RowActionsMenu label="Rate actions">
      <MenuSection label="Actions" />
      <div className="px-3 py-1">
        <form action={toggleTaxRateAction}>
          <input type="hidden" name="taxRateId" value={rate.id} />
          <input type="hidden" name="action" value="toggle" />
          <SubmitButton bare className="w-full rounded py-1.5 text-left text-[0.75rem] text-[var(--ink)] hover:text-[var(--accent)]">
            {rate.isActive ? "Deactivate" : "Activate"}
          </SubmitButton>
        </form>
        {!rate.isDefault && (
          <form action={toggleTaxRateAction}>
            <input type="hidden" name="taxRateId" value={rate.id} />
            <input type="hidden" name="action" value="setDefault" />
            <SubmitButton bare className="w-full rounded py-1.5 text-left text-[0.75rem] text-[var(--ink)] hover:text-[var(--accent)]">
              Set as Default
            </SubmitButton>
          </form>
        )}
      </div>
      <MenuDestructiveRow>
        <form action={deleteTaxRateAction}>
          <input type="hidden" name="taxRateId" value={rate.id} />
          <ConfirmSubmitButton
            message={`Delete tax rate ${rate.code}? This cannot be undone.`}
            className="w-full text-left text-[0.75rem] text-red-600"
          >
            Delete
          </ConfirmSubmitButton>
        </form>
      </MenuDestructiveRow>
    </RowActionsMenu>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <FormErrorBanner message={sp.error} />
      <PageHeader
        title="Tax Rates"
        description={`${taxRates.length} configured — VAT, WHT, and other tax codes applied to invoices and purchases.`}
        kpis={[
          { label: "Rates", value: taxRates.length, sub: "total configured" },
          { label: "Active", value: activeRates, sub: "in use", tone: activeRates > 0 ? "good" : "neutral" },
          { label: "Default", value: defaultRate ? `${defaultRate.rate}%` : "—", sub: defaultRate ? defaultRate.code : "none set", tone: defaultRate ? "accent" : "neutral", muted: !defaultRate },
        ]}
        actions={
        <CreateTaxRateDialog action={createTaxRateAction} />
        }
      />

      {/* Search */}
      <form method="GET" className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, code…"
          className="h-8 flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-[0.75rem] text-[var(--ink)] outline-none focus:border-[var(--accent)]/50" />
        <SubmitButton bare className="h-8 rounded-lg border border-[var(--line)] px-3 text-[0.75rem] font-medium hover:bg-[var(--panel-strong)]">Search</SubmitButton>
        {q && <a href="/finance/tax-rates" className="flex h-8 items-center rounded-lg border border-[var(--line)] px-3 text-[0.75rem] text-[var(--ink-muted)] hover:text-[var(--ink)]">Clear</a>}
      </form>

      {/* Tax rate table */}
      <DataTable
        className="panel-shadow"
        rows={filteredTaxRates}
        getRowKey={(rate) => rate.id}
        empty="No tax rates configured. Add VAT, WHT, or other rates above."
        columns={[
          {
            key: "code",
            header: "Code",
            cell: (rate) => (
              <span className="inline-flex items-center gap-2">
                <span className="mono rounded-md bg-[var(--panel-strong)] px-2 py-1 text-[0.75rem] font-bold text-[var(--ink)]">
                  {rate.code}
                </span>
                {rate.isDefault && <StatusBadge tone="success">Default</StatusBadge>}
              </span>
            ),
          },
          {
            key: "name",
            header: "Name",
            className: "font-medium text-[var(--ink)]",
            cell: (rate) => rate.name,
          },
          {
            key: "rate",
            header: "Rate",
            align: "right",
            className: "font-semibold tabular-nums text-[var(--ink)]",
            cell: (rate) => `${rate.rate}%`,
          },
          {
            key: "sales",
            header: "Sales",
            align: "center",
            headerClassName: "hidden md:table-cell",
            className: "hidden md:table-cell",
            cell: (rate) =>
              rate.appliesToSales ? (
                <span className="text-emerald-600">✓</span>
              ) : (
                <span className="text-[var(--ink-muted)]">—</span>
              ),
          },
          {
            key: "purchases",
            header: "Purchases",
            align: "center",
            headerClassName: "hidden md:table-cell",
            className: "hidden md:table-cell",
            cell: (rate) =>
              rate.appliesToPurchases ? (
                <span className="text-emerald-600">✓</span>
              ) : (
                <span className="text-[var(--ink-muted)]">—</span>
              ),
          },
          {
            key: "status",
            header: "Status",
            align: "center",
            cell: (rate) => (
              <StatusBadge tone={rate.isActive ? "success" : "neutral"}>
                {rate.isActive ? "Active" : "Inactive"}
              </StatusBadge>
            ),
          },
        ]}
        actions={renderRateActions}
        renderMobileCard={(rate) => (
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate">
                <span className="mono rounded-md bg-[var(--panel-strong)] px-2 py-0.5 text-[0.75rem] font-bold text-[var(--ink)]">{rate.code}</span>
                <span className="font-semibold tabular-nums text-[var(--ink)]">{rate.rate}%</span>
                {rate.isDefault && <StatusBadge tone="success">Default</StatusBadge>}
              </p>
              <p className="mt-0.5 truncate text-[var(--ink)]">{rate.name}</p>
              <p className="mt-0.5 truncate text-[0.75rem] text-[var(--ink-muted)]">{[rate.appliesToSales ? "Sales" : null, rate.appliesToPurchases ? "Purchases" : null].filter(Boolean).join(" · ") || "Not applied"}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <StatusBadge tone={rate.isActive ? "success" : "neutral"}>{rate.isActive ? "Active" : "Inactive"}</StatusBadge>
              {renderRateActions(rate)}
            </div>
          </div>
        )}
      />
    </div>
  );
}
