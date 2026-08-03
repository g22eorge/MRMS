// @ts-nocheck
"use server";

import { revalidatePath } from "next/cache";

import { ALL_MODULES } from "@/lib/module-access";
import { assertPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import type { OrgModule } from "@prisma/client";

export async function setOrgModulesAction(formData: FormData) {
  const admin = await assertPlatformAdmin();
  if (!admin) return;

  const orgId = String(formData.get("orgId") ?? "");
  if (!orgId) return;

  const granted = ALL_MODULES.filter((module) => formData.get(`module_${module}`) === "1");

  await prisma.$transaction([
    prisma.orgModuleGrant.deleteMany({ where: { orgId } }),
    prisma.orgModuleGrant.createMany({
      data: granted.map((module) => ({ orgId, module: module as OrgModule })),
    }),
  ]);

  revalidatePath("/admin/orgs");
}
