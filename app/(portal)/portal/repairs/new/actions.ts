"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requirePortalSession } from "@/lib/portal-auth";
import { createRepairRequest } from "@/lib/repairs/request";

export type SubmitState = { error?: string };

const DEVICE_TYPES = ["PHONE_ANDROID", "PHONE_IPHONE", "TABLET", "WINDOWS_PC", "MAC", "OTHER"];
const HANDOVER = ["SELF_DROPOFF", "REQUEST_PICKUP", "SEND_WITH_DELIVERY_PERSON"] as const;

export async function submitPortalRepairRequest(_state: SubmitState, formData: FormData): Promise<SubmitState> {
  const { org, client, portalUser } = await requirePortalSession();

  const deviceType = String(formData.get("deviceType") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim() || undefined;
  const serialNumber = String(formData.get("serialNumber") ?? "").trim() || undefined;
  const problemDescription = String(formData.get("problemDescription") ?? "").trim();
  const handoverRaw = String(formData.get("handoverMethod") ?? "SELF_DROPOFF").trim();
  const handoverMethod = (HANDOVER.includes(handoverRaw as (typeof HANDOVER)[number]) ? handoverRaw : "SELF_DROPOFF") as (typeof HANDOVER)[number];

  if (!DEVICE_TYPES.includes(deviceType)) return { error: "Choose a device type" };
  if (!brand) return { error: "Enter the device brand" };
  if (problemDescription.length < 5) return { error: "Describe the problem" };

  const result = await createRepairRequest({
    orgId: org.id,
    customerName: client.fullName,
    phone: client.phone,
    email: client.email ?? undefined,
    deviceType,
    brand,
    model,
    serialNumber,
    problemDescription,
    handoverMethod,
  });

  if (!result.success || !result.requestId) {
    return { error: result.error ?? "Could not submit your request. Please try again." };
  }

  // Attribute the request to this corporate client + portal user so staff know
  // who it came from and the portal can show it as pending.
  await prisma.repairRequest.update({
    where: { id: result.requestId },
    data: { clientId: client.id, submittedByPortalUserId: portalUser.id },
  }).catch(() => {});

  redirect("/portal/repairs?submitted=1");
}
