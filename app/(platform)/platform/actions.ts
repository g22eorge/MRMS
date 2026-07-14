"use server";

import { prisma } from "@/lib/prisma";
import { OrgPlan, OrgModule } from "@prisma/client";
import { setOrgAtSenderId } from "@/lib/org-whatsapp-config";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { revalidatePlatformHome, revalidatePlatformOrg, revalidatePlatformOrgAndHome } from "@/lib/platform/revalidate";

export async function setPlanAction(formData: FormData) {
  await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  const plan = formData.get("plan") as OrgPlan;
  if (!orgId || !["STARTER", "STANDARD", "GROWTH", "PREMIUM", "ENTERPRISE"].includes(plan)) return;
  await prisma.organization.update({
    where: { id: orgId },
    data: { plan, billingStatus: plan === "STARTER" ? "TRIALING" : "ACTIVE" },
  });
  revalidatePlatformHome();
}

export async function toggleOrgActive(formData: FormData) {
  await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  const isActive = formData.get("isActive") === "true";
  if (!orgId) return;
  await prisma.organization.update({ where: { id: orgId }, data: { isActive: !isActive } });
  revalidatePlatformHome();
}

export async function extendTrialAction(formData: FormData) {
  await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  const days = parseInt(formData.get("days") as string, 10);
  if (!orgId || isNaN(days) || days <= 0) return;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { trialEndsAt: true, billingStatus: true },
  });
  if (!org) return;

  const base = org.trialEndsAt && org.trialEndsAt > new Date() ? org.trialEndsAt : new Date();
  const newDate = new Date(base);
  newDate.setDate(newDate.getDate() + days);

  await prisma.organization.update({
    where: { id: orgId },
    data: { trialEndsAt: newDate, billingStatus: "TRIALING" },
  });
  revalidatePlatformHome();
}

export async function runCommercialSeedAction() {
  await requirePlatformAdmin();
  try {
    const { seedCommercialData } = await import("@/prisma/seed-commercial");
    await seedCommercialData();
  } catch (err) {
    console.error("[seed:commercial]", err);
  }
  revalidatePlatformHome();
}

export async function setOrgSmsSenderAction(formData: FormData) {
  await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  const raw = (formData.get("senderId") as string | null)?.trim() ?? "";
  if (!orgId) return;
  const senderId = raw === "" ? null : raw;
  if (senderId && (senderId.length > 11 || !/^[A-Za-z0-9]+$/.test(senderId))) return;
  await setOrgAtSenderId(orgId, senderId);
  revalidatePlatformOrg(orgId);
}

export async function setOrgAiModelAction(formData: FormData) {
  await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  const model = ((formData.get("aiModel") as string | null) ?? "").trim() || null;
  if (!orgId) return;
  await prisma.organization.update({ where: { id: orgId }, data: { aiModel: model } });
  revalidatePlatformOrg(orgId);
}

export async function toggleOrgModuleAction(formData: FormData) {
  await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  const orgModule = formData.get("module") as string;
  const currentlyEnabled = formData.get("currentlyEnabled") === "true";
  if (!orgId || !orgModule) return;
  try {
    if (currentlyEnabled) {
      await prisma.orgModuleGrant.deleteMany({ where: { orgId, module: orgModule as OrgModule } });
    } else {
      await prisma.orgModuleGrant.upsert({
        where: { orgId_module: { orgId, module: orgModule as OrgModule } },
        create: { orgId, module: orgModule as OrgModule },
        update: {},
      });
    }
  } catch { /* table may not exist yet */ }
  revalidatePlatformOrg(orgId);
}

export async function setBillingStatusAction(formData: FormData) {
  await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  const status = formData.get("status") as string;
  if (!orgId || !["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED"].includes(status)) return;
  await prisma.organization.update({
    where: { id: orgId },
    data: { billingStatus: status as never },
  });
  revalidatePlatformOrgAndHome(orgId);
}

export async function updateOrgDetailsAction(formData: FormData) {
  await requirePlatformAdmin();
  const orgId = formData.get("orgId") as string;
  if (!orgId) return;
  const data: Record<string, unknown> = {};
  for (const key of ["name", "tagline", "website", "phone", "email", "address"]) {
    const val = formData.get(key) as string | null;
    if (val !== null) data[key] = val || null;
  }
  const enableRepair = formData.get("enableRepairModule");
  if (enableRepair !== null) data.enableRepairModule = enableRepair === "true";
  await prisma.organization.update({ where: { id: orgId }, data: data as never });
  revalidatePlatformOrg(orgId);
}
