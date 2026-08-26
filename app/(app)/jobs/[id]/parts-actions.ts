"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { findRecentDuplicate } from "@/lib/dedup";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import {
  InventoryError,
  reserveForJob,
  consumeReservation,
  releaseReservation,
} from "@/lib/inventory-service";

/**
 * Parts consumed on a repair job, wired to real stock.
 *
 * Until now the job card recorded parts as prose in `partsReplaced`, so fitting
 * a part never moved inventory: a job could say "USB-C charging port module"
 * while the part of that name sat on the shelf count untouched. These actions
 * put the job card on the same footing as POS — the part leaves stock when it
 * is fitted.
 *
 * The two-step reserve → consume mirrors how a workshop actually runs, and is
 * what lib/inventory-service already models:
 *   reserve  — the part is spoken for while the job waits (WAITING_FOR_PARTS).
 *              qtyReserved rises; qtyOnHand does not: it is still on the shelf.
 *   consume  — the part is physically fitted. Both fall.
 *   release  — it was not needed after all. Only the reservation unwinds.
 */

type ActionResult = { success: true; message: string } | { success: false; error: string };

const reserveSchema = z.object({
  jobId: z.string().min(1),
  partId: z.string().min(1),
  locationId: z.string().min(1),
  quantity: z.coerce.number().positive("Enter a quantity greater than zero."),
});

const reservationSchema = z.object({
  jobId: z.string().min(1),
  reservationId: z.string().min(1),
  locationId: z.string().min(1),
});

/**
 * Who may move stock against a job.
 *
 * External technicians are deliberately excluded. They work on the device but
 * sit outside the business, and are already walled off from pricing and client
 * data elsewhere; letting them decrement our inventory would undo that.
 */
function canRecordParts(user: { role: string; permissions?: string[] | null }) {
  if (user.role === "TECHNICIAN_EXTERNAL") return false;
  return (
    can.manageInventory({ role: user.role, permissions: user.permissions } as never)
    || user.role === "TECHNICIAN_INTERNAL"
  );
}

/**
 * Resolves the job, part and location together, each scoped to the caller's org.
 *
 * inventory-service looks parts up by id alone (`findUnique`), so it would
 * happily reserve another tenant's stock if handed a foreign id. The org check
 * has to happen here, before the service is called.
 */
type Scoped =
  | { ok: false; error: string }
  | { ok: true; partName: string };

async function resolveScoped(
  orgId: string, jobId: string, partId: string, locationId: string,
): Promise<Scoped> {
  const [job, part, location] = await Promise.all([
    prisma.job.findFirst({ where: { id: jobId, orgId }, select: { id: true } }),
    prisma.part.findFirst({ where: { id: partId, orgId }, select: { id: true, name: true } }),
    prisma.stockLocation.findFirst({ where: { id: locationId, orgId }, select: { id: true } }),
  ]);
  if (!job) return { ok: false, error: "Job not found." };
  if (!part) return { ok: false, error: "That part is not in your inventory." };
  if (!location) return { ok: false, error: "That stock location is not in your inventory." };
  return { ok: true, partName: part.name };
}

/**
 * Attributes a part's stock to a location the first time it is needed there.
 *
 * reserveForJob checks availability against PartLocationStock. Parts that
 * arrived through goods-received or a transfer have those rows; parts seeded or
 * imported straight onto Part.qtyOnHand do not, and would read as zero
 * available despite sitting on the shelf.
 *
 * Only safe when the part has no location rows AT ALL — if stock is already
 * attributed anywhere, inventing another row here would double-count it.
 */
async function backfillLocationStock(partId: string, locationId: string, orgId: string) {
  const existing = await prisma.partLocationStock.count({ where: { partId } });
  if (existing > 0) return;

  const part = await prisma.part.findFirst({
    where: { id: partId, orgId },
    select: { qtyOnHand: true, qtyReserved: true },
  });
  if (!part || part.qtyOnHand <= 0) return;

  await prisma.partLocationStock.create({
    data: {
      orgId,
      partId,
      locationId,
      qtyOnHand: part.qtyOnHand,
      qtyReserved: part.qtyReserved ?? 0,
    },
  });
}

/** Turns an InventoryError into something a technician can act on. */
function describe(error: unknown): string {
  if (error instanceof InventoryError) {
    switch (error.code) {
      case "INSUFFICIENT_STOCK":
        return "Not enough of that part in stock at this location.";
      case "PART_NOT_FOUND":
        return "That part no longer exists.";
      case "RESERVATION_NOT_FOUND":
        return "That parts line is no longer on this job.";
      case "ALREADY_CONSUMED":
        return "That part is already marked as used.";
      case "ALREADY_RELEASED":
        return "That part was already returned to stock.";
      case "INVALID_QUANTITY":
        return "Enter a quantity greater than zero.";
    }
  }
  return "Could not update parts. Try again.";
}

export async function reserveJobPartAction(formData: FormData): Promise<ActionResult> {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!canRecordParts(user)) return { success: false, error: "Not authorised to record parts." };

  const parsed = reserveSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid parts entry." };
  const { jobId, partId, locationId, quantity } = parsed.data;

  const scoped = await resolveScoped(orgId, jobId, partId, locationId);
  if (!scoped.ok) return { success: false, error: scoped.error };

  // The same part added twice in seconds is a double submission, not a
  // technician fitting two of them a moment apart.
  const dup = await findRecentDuplicate(prisma.partReservation, {
    jobId, partId, quantity, status: "RESERVED",
  }, { createdAtField: "reservedAt" }).catch(() => null);
  if (dup) {
    revalidatePath(`/jobs/${jobId}`);
    return { success: true, message: `${scoped.partName} already added.` };
  }

  try {
    await backfillLocationStock(partId, locationId, orgId);
    await reserveForJob({
      partId,
      locationId,
      quantity,
      jobId,
      ctx: { orgId, performedById: user.id, jobId },
    });
  } catch (error) {
    return { success: false, error: describe(error) };
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/inventory");
  return { success: true, message: `${quantity} × ${scoped.partName} reserved for this job.` };
}

export async function consumeJobPartAction(formData: FormData): Promise<ActionResult> {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!canRecordParts(user)) return { success: false, error: "Not authorised to record parts." };

  const parsed = reservationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, error: "Invalid parts entry." };
  const { jobId, reservationId, locationId } = parsed.data;

  // Scope through the job: PartReservation carries no orgId of its own.
  const reservation = await prisma.partReservation.findFirst({
    where: { id: reservationId, job: { orgId } },
    select: { id: true, part: { select: { name: true } } },
  });
  if (!reservation) return { success: false, error: "That parts line is no longer on this job." };

  try {
    await consumeReservation({
      reservationId,
      locationId,
      ctx: { orgId, performedById: user.id, jobId },
    });
  } catch (error) {
    return { success: false, error: describe(error) };
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/inventory");
  return { success: true, message: `${reservation.part?.name ?? "Part"} marked as fitted and removed from stock.` };
}

export async function releaseJobPartAction(formData: FormData): Promise<ActionResult> {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!canRecordParts(user)) return { success: false, error: "Not authorised to record parts." };

  const parsed = reservationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, error: "Invalid parts entry." };
  const { jobId, reservationId, locationId } = parsed.data;

  const reservation = await prisma.partReservation.findFirst({
    where: { id: reservationId, job: { orgId } },
    select: { id: true, part: { select: { name: true } } },
  });
  if (!reservation) return { success: false, error: "That parts line is no longer on this job." };

  try {
    await releaseReservation({
      reservationId,
      locationId,
      ctx: { orgId, performedById: user.id, jobId },
    });
  } catch (error) {
    return { success: false, error: describe(error) };
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/inventory");
  return { success: true, message: `${reservation.part?.name ?? "Part"} returned to stock.` };
}
