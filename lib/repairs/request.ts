import { prisma } from "@/lib/prisma";

interface CreateRepairRequestInput {
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
}

async function generateRequestNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.repairRequest.count();
  return `REQ-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function createRepairRequest(
  input: CreateRepairRequestInput
): Promise<{ success: boolean; requestNumber?: string; error?: string }> {
  try {
    const requestNumber = await generateRequestNumber();

    const request = await prisma.repairRequest.create({
      data: {
        requestNumber,
        requestStatus: "PENDING_INTAKE",
        handoverStatus: "PENDING",
        customerName: input.customerName,
        phone: input.phone,
        email: input.email,
        preferredContactMethod: input.preferredContactMethod || "WHATSAPP",
        deviceType: input.deviceType as import("@prisma/client").DeviceType,
        brand: input.brand,
        model: input.model || "",
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
      },
    });

    return { success: true, requestNumber: request.requestNumber };
  } catch (error) {
    console.error("[RepairRequestService] Create error:", error);
    return { success: false, error: String(error) };
  }
}