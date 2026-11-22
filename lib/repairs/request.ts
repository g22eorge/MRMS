import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

interface CreateRepairRequestInput {
  orgId?: string;
  customerName: string;
  phone: string;
  email?: string;
  preferredContactMethod?: "WHATSAPP" | "PHONE" | "EMAIL" | "SMS";
  deviceType: string;
  brand: string;
  model?: string;
  serialNumber?: string;
  problemDescription: string;
  handoverMethod: "SELF_DROPOFF" | "SEND_WITH_DELIVERY_PERSON" | "REQUEST_PICKUP";
  preferredDropoffDate?: string;
  preferredDropoffTime?: string;
  dropoffNotes?: string;
  deliveryPersonName?: string;
  deliveryPersonPhone?: string;
  deliveryCompany?: string;
  dispatchDate?: string;
  expectedArrivalTime?: string;
  deliveryTrackingReference?: string;
  deliveryFeeResponsibility?: string;
  deliveryNotes?: string;
  pickupAddress?: string;
  pickupLandmark?: string;
  preferredPickupDate?: string;
  preferredPickupTime?: string;
  alternateContactPerson?: string;
  alternateContactPhone?: string;
  pickupNotes?: string;
  submissionIp?: string;
}

async function allocateRequestNumber(orgId?: string | null): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `REQ-${year}-`;

  // Repair requests are tenant-scoped, and the sequence must not use a NULL
  // orgId: a UNIQUE index treats NULLs as distinct, so ON CONFLICT would never
  // fire and every request would insert a fresh row starting at 1.
  //
  // Do NOT fall back to "first org". That is nondeterministic and can route
  // public repair requests into the wrong tenant. Require an explicit orgId or
  // DEFAULT_ORG_ID.
  if (!orgId) orgId = process.env.DEFAULT_ORG_ID?.trim() ?? null;
  if (!orgId) throw new Error("Missing orgId for repair requests. Provide orgId or set DEFAULT_ORG_ID.");

  const getMaxExisting = async () => {
    const last = await prisma.repairRequest.findFirst({
      where: { requestNumber: { startsWith: prefix, mode: "insensitive" as const } },
      orderBy: { requestNumber: "desc" },
      select: { requestNumber: true },
    });

    const lastSeqRaw = last?.requestNumber.slice(prefix.length);
    const lastSeq = lastSeqRaw ? Number.parseInt(lastSeqRaw, 10) : 0;
    return Number.isFinite(lastSeq) ? lastSeq : 0;
  };

  // Catch the sequence up to the highest number already issued, so it stays
  // monotonic even if rows were imported or inserted by hand.
  const maxExisting = await getMaxExisting();

  // One atomic statement: claim the next number, or bump the existing row.
  //
  // Every identifier is double-quoted. Postgres folds unquoted identifiers to
  // lower case, so `orgId` became `orgid` and the insert failed with
  // `column "orgid" does not exist` — which meant no repair request could be
  // submitted at all. The table is also no longer created here: it is a real
  // model (RepairRequestSequence) and migrations own its shape. The CREATE that
  // used to sit here declared "updatedAt" as DATETIME, a type Postgres does not
  // have.
  const rows = await prisma.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "RepairRequestSequence" ("id", "orgId", "year", "value", "updatedAt")
    VALUES (${randomUUID()}, ${orgId}, ${year}, ${maxExisting + 1}, CURRENT_TIMESTAMP)
    ON CONFLICT ("orgId", "year") DO UPDATE
      SET "value" = (
            CASE
              WHEN "RepairRequestSequence"."value" < ${maxExisting} THEN ${maxExisting}
              ELSE "RepairRequestSequence"."value"
            END
          ) + 1,
          "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "value"
  `;
  const nextVal = rows[0]?.value ?? 1;
  return `${prefix}${String(nextVal).padStart(4, "0")}`;
}

export async function createRepairRequest(
  input: CreateRepairRequestInput
): Promise<{ success: boolean; requestId?: string; requestNumber?: string; error?: string }> {
  try {
    // Public repair requests must be bound to a single tenant.
    // Never pick an org implicitly from the DB.
    const resolvedOrgId = input.orgId?.trim() || process.env.DEFAULT_ORG_ID?.trim() || null;
    if (!resolvedOrgId) {
      return { success: false, error: "Missing orgId for repair request. Provide orgId or set DEFAULT_ORG_ID." };
    }

    // Request numbers must be human-friendly but also safe under concurrency.
    // We allocate from a per-year sequence table, and still retry in case the
    // requestNumber uniqueness constraint is hit for any unexpected reason.
    let request:
      | {
          id: string;
          requestNumber: string;
        }
      | null = null;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const requestNumber = await allocateRequestNumber(resolvedOrgId);
      try {
        request = await prisma.repairRequest.create({
          data: {
            requestNumber,
            requestStatus: "PENDING_FRONT_DESK",
            handoverStatus: "PENDING",
            orgId: resolvedOrgId,
            customerName: input.customerName,
            phone: input.phone,
            email: input.email,
            preferredContactMethod: input.preferredContactMethod || "WHATSAPP",
            deviceType: input.deviceType as import("@prisma/client").DeviceType,
            brand: input.brand,
            model: input.model?.trim() ? input.model.trim() : null,
            serialNumber: input.serialNumber,
            problemDescription: input.problemDescription,
            handoverMethod: input.handoverMethod,
            preferredDropoffDate: input.preferredDropoffDate,
            preferredDropoffTime: input.preferredDropoffTime,
            dropoffNotes: input.dropoffNotes,
            deliveryPersonName: input.deliveryPersonName,
            deliveryPersonPhone: input.deliveryPersonPhone,
            deliveryCompany: input.deliveryCompany,
            dispatchDate: input.dispatchDate,
            expectedArrivalTime: input.expectedArrivalTime,
            deliveryTrackingReference: input.deliveryTrackingReference,
            deliveryFeeResponsibility: input.deliveryFeeResponsibility,
            deliveryNotes: input.deliveryNotes,
            pickupAddress: input.pickupAddress,
            pickupLandmark: input.pickupLandmark,
            preferredPickupDate: input.preferredPickupDate,
            preferredPickupTime: input.preferredPickupTime,
            alternateContactPerson: input.alternateContactPerson,
            alternateContactPhone: input.alternateContactPhone,
            pickupNotes: input.pickupNotes,
            submissionIp: input.submissionIp,
          },
          select: { id: true, requestNumber: true },
        });
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          continue;
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("UNIQUE constraint failed") && msg.includes("RepairRequest.requestNumber")) {
          continue;
        }
        throw error;
      }
    }

    if (!request) {
      return { success: false, error: "Could not allocate a unique request number. Please retry." };
    }

    return { success: true, requestId: request.id, requestNumber: request.requestNumber };
  } catch (error) {
    console.error("[RepairRequestService] Create error:", error);
    return { success: false, error: String(error) };
  }
}
