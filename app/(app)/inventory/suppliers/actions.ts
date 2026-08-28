"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { assertOrgCanMutate } from "@/lib/org-write";

import { flash } from "@/lib/flash";
/**
 * Suppliers are inventory work, and every sibling action in this folder —
 * locations, purchase orders, purchase requests, stock counts, supplier bills,
 * transfers — gates on manageInventory. This one alone asked for manageUsers,
 * which is user administration and a different thing entirely.
 *
 * The page admits anyone with manageInventory, so a MANAGER, OPS or
 * TECH_MANAGER could open Suppliers, fill in the visible Add Supplier form,
 * click Add, and be bounced to /inventory with nothing created and nothing
 * said. Aligning with the siblings is a correction of an outlier rather than a
 * widening: the six other writes in the same folder already work this way.
 */
async function requireInventoryManager() {
  const ctx = await requireOrgSession();
  if (!can.manageInventory(ctx.user)) redirect("/inventory");
  assertOrgCanMutate({ access: ctx.org.access, userRole: ctx.user.role, userAccessMode: ctx.user.accessMode, kind: "GENERAL" });
  return ctx;
}

export async function createSupplierAction(formData: FormData): Promise<{ id?: string; error?: string }> {
  const { orgId } = await requireInventoryManager();
  const name = (formData.get("name") as string).trim();
  if (!name) return { error: "Supplier name is required" };
  try {
    const supplier = await prisma.supplier.create({
      data: {
        orgId,
        name,
        contactName: (formData.get("contactName") as string).trim() || null,
        email: (formData.get("email") as string).trim() || null,
        phone: (formData.get("phone") as string).trim() || null,
        address: (formData.get("address") as string).trim() || null,
        notes: (formData.get("notes") as string).trim() || null,
      },
    });
    return { id: supplier.id };
  } catch {
    return { error: "Failed to create supplier" };
  }
}

export async function updateSupplierAction(formData: FormData): Promise<{ error?: string }> {
  const { orgId } = await requireInventoryManager();
  const id = formData.get("id") as string;
  const supplier = await prisma.supplier.findUnique({ where: { id }, select: { orgId: true } });
  if (!supplier || supplier.orgId !== orgId) return { error: "Not found" };
  await prisma.supplier.update({
    where: { id },
    data: {
      name: (formData.get("name") as string).trim(),
      contactName: (formData.get("contactName") as string).trim() || null,
      email: (formData.get("email") as string).trim() || null,
      phone: (formData.get("phone") as string).trim() || null,
      address: (formData.get("address") as string).trim() || null,
      notes: (formData.get("notes") as string).trim() || null,
      isActive: formData.get("isActive") === "1",
    },
  });
  return {};
}

export async function createSupplierPriceAction(formData: FormData): Promise<void> {
  const { orgId } = await requireInventoryManager();
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const partId = String(formData.get("partId") ?? "").trim() || null;
  const sku = String(formData.get("sku") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim();
  const unitCost = Number(String(formData.get("unitCost") ?? "0").trim());
  const currency = String(formData.get("currency") ?? "UGX").trim().toUpperCase() || "UGX";
  const minQuantityRaw = String(formData.get("minQuantity") ?? "").trim();
  const leadTimeRaw = String(formData.get("leadTimeDays") ?? "").trim();

  if (!supplierId || !description || !Number.isFinite(unitCost) || unitCost < 0) redirect(`/inventory/suppliers/${supplierId}?error=Invalid+price+input`);
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, orgId }, select: { id: true } });
  if (!supplier) redirect("/inventory/suppliers");

  await prisma.supplierPrice.create({
    data: {
      orgId,
      supplierId,
      partId,
      sku,
      description,
      unitCost,
      currency,
      minQuantity: minQuantityRaw ? Math.max(1, Math.floor(Number(minQuantityRaw))) : null,
      leadTimeDays: leadTimeRaw ? Math.max(0, Math.floor(Number(leadTimeRaw))) : null,
    },
  });

  revalidatePath(`/inventory/suppliers/${supplierId}`);
  redirect(flash(`/inventory/suppliers/${supplierId}?priceCreated=1`, "Supplier price created"));
}

export async function updateSupplierPriceAction(formData: FormData): Promise<void> {
  const { orgId } = await requireInventoryManager();
  const id = String(formData.get("id") ?? "").trim();
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const partId = String(formData.get("partId") ?? "").trim() || null;
  const sku = String(formData.get("sku") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim();
  const unitCost = Number(String(formData.get("unitCost") ?? "0").trim());
  const currency = String(formData.get("currency") ?? "UGX").trim().toUpperCase() || "UGX";
  const minQuantityRaw = String(formData.get("minQuantity") ?? "").trim();
  const leadTimeRaw = String(formData.get("leadTimeDays") ?? "").trim();
  const validToRaw = String(formData.get("validTo") ?? "").trim();

  if (!id || !supplierId || !description || !Number.isFinite(unitCost) || unitCost < 0) redirect(`/inventory/suppliers/${supplierId}?error=Invalid+price+input`);

  await prisma.supplierPrice.updateMany({
    where: { id, orgId, supplierId },
    data: {
      partId,
      sku,
      description,
      unitCost,
      currency,
      minQuantity: minQuantityRaw ? Math.max(1, Math.floor(Number(minQuantityRaw))) : null,
      leadTimeDays: leadTimeRaw ? Math.max(0, Math.floor(Number(leadTimeRaw))) : null,
      validTo: validToRaw ? new Date(validToRaw) : null,
    },
  });

  revalidatePath(`/inventory/suppliers/${supplierId}`);
  redirect(flash(`/inventory/suppliers/${supplierId}?priceSaved=1`, "Supplier price updated"));
}

export async function deleteSupplierPriceAction(formData: FormData): Promise<void> {
  const { orgId } = await requireInventoryManager();
  const id = String(formData.get("id") ?? "").trim();
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  if (!id || !supplierId) return;

  await prisma.supplierPrice.deleteMany({ where: { id, orgId, supplierId } });
  revalidatePath(`/inventory/suppliers/${supplierId}`);
}
