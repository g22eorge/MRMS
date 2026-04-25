"use server";

import { revalidatePath } from "next/cache";
import { StockTransactionType } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

const createPartSchema = z.object({
  sku: z.string().trim().min(2, "SKU is required"),
  name: z.string().trim().min(2, "Part name is required"),
  manufacturer: z.string().trim().optional(),
  reorderLevel: z.coerce.number().int().min(0),
  unitCost: z.coerce.number().min(0).optional(),
  openingQty: z.coerce.number().int().min(0),
});

const adjustStockSchema = z.object({
  partId: z.string().min(1),
  type: z.nativeEnum(StockTransactionType),
  quantity: z.coerce.number().int().min(0),
  reason: z.string().trim().optional(),
});

function canManageInventory(role: string) {
  return ["ADMIN", "OPS", "TECHNICIAN_INTERNAL"].includes(role);
}

export async function createPartAction(formData: FormData) {
  const { session, user } = await getCurrentUserRole();
  if (!canManageInventory(user.role)) {
    return { error: "Forbidden" };
  }

  const parsed = createPartSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid part details" };
  }

  const data = parsed.data;
  const sku = data.sku.toUpperCase();

  try {
    await prisma.$transaction(async (tx) => {
      const part = await tx.part.create({
        data: {
          sku,
          name: data.name,
          manufacturer: data.manufacturer || null,
          reorderLevel: data.reorderLevel,
          unitCost: typeof data.unitCost === "number" ? data.unitCost : null,
          qtyOnHand: data.openingQty,
        },
      });

      if (data.openingQty > 0) {
        await tx.partStockTransaction.create({
          data: {
            partId: part.id,
            type: StockTransactionType.IN,
            quantity: data.openingQty,
            reason: "Opening stock",
            createdById: session.user.id,
          },
        });
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create part";
    if (message.toLowerCase().includes("unique")) {
      return { error: `SKU ${sku} already exists` };
    }
    return { error: message };
  }

  revalidatePath("/inventory");
  return { success: true };
}

export async function adjustStockAction(formData: FormData) {
  const { session, user } = await getCurrentUserRole();
  if (!canManageInventory(user.role)) {
    return { error: "Forbidden" };
  }

  const parsed = adjustStockSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid stock update" };
  }

  const payload = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const part = await tx.part.findUnique({
        where: { id: payload.partId },
        select: { id: true, qtyOnHand: true },
      });

      if (!part) {
        throw new Error("Part not found");
      }

      let nextQty = part.qtyOnHand;
      let txnQty = payload.quantity;

      if (payload.type === StockTransactionType.IN) {
        nextQty = part.qtyOnHand + payload.quantity;
      } else if (payload.type === StockTransactionType.OUT) {
        if (payload.quantity > part.qtyOnHand) {
          throw new Error("Cannot remove more stock than available");
        }
        nextQty = part.qtyOnHand - payload.quantity;
      } else {
        nextQty = payload.quantity;
        txnQty = payload.quantity - part.qtyOnHand;
      }

      await tx.part.update({
        where: { id: part.id },
        data: { qtyOnHand: nextQty },
      });

      await tx.partStockTransaction.create({
        data: {
          partId: part.id,
          type: payload.type,
          quantity: txnQty,
          reason: payload.reason || null,
          createdById: session.user.id,
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to adjust stock";
    return { error: message };
  }

  revalidatePath("/inventory");
  return { success: true };
}
