"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { OrgModule } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { sendWelcomeEmail } from "@/lib/email";
import { ALL_MODULES, recommendPlanForModules } from "@/lib/module-access";
import { TRIAL_DAYS } from "@/lib/billing-access";
import { defaultDocumentCodeForSlug } from "@/lib/commercial/org-number";

const schema = z.object({
  businessName: z.string().min(2, "Business name must be at least 2 characters").max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  modules: z.array(z.nativeEnum(OrgModule)).min(1, "Select at least one module"),
});

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

export type CreateOrgState = {
  error?: string;
  fieldErrors?: { businessName?: string[]; slug?: string[]; modules?: string[] };
};

export async function createOrganization(
  _prev: CreateOrgState,
  formData: FormData,
): Promise<CreateOrgState> {
  const session = await requireSession();

  const modulesRaw = formData.getAll("module") as string[];
  const businessNameRaw = formData.get("businessName") as string;

  const raw = {
    businessName: businessNameRaw,
    slug: toSlug(businessNameRaw ?? ""),
    modules: modulesRaw.length > 0 ? modulesRaw : ALL_MODULES,
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { businessName, slug, modules } = parsed.data;

  // Check if user already has an org.
  const existingUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { orgId: true },
  });

  if (existingUser?.orgId) {
    redirect("/dashboard");
  }

  // Check slug uniqueness.
  const slugTaken = await prisma.organization.findUnique({ where: { slug } });
  if (slugTaken) {
    return { error: "That business name is already taken. Try a different one." };
  }

  // Determine the plan tier that satisfies all selected modules.
  // This is stored on the org so billing knows what to charge after the trial.
  const recommendedPlan = recommendPlanForModules(modules);

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

  await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: businessName,
        slug,
        trialEndsAt,
        billingStatus: "TRIALING",
        plan: recommendedPlan,
      },
    });

    await tx.user.update({
      where: { id: session.user.id },
      data: { orgId: org.id, role: "ADMIN" },
    });

    // Seed default branding settings for this org.
    //
    // The document code is set explicitly rather than left to the schema default
    // of "EIS": document-number columns are globally unique while the counters
    // are per-org, so every new tenant inheriting the same code meant their
    // documents composed the same number as an existing tenant's and failed to
    // write. The slug is globally unique, so deriving from it is collision-free
    // on day one. The admin can shorten it in Settings -> Branding.
    await tx.documentBrandingSettings.create({
      data: { orgId: org.id, quotePrefix: defaultDocumentCodeForSlug(slug) },
    });

    // Grant only the modules the client selected.
    await tx.orgModuleGrant.createMany({
      data: modules.map((module) => ({ orgId: org.id, module })),
    });
  });

  void sendWelcomeEmail(session.user.email, session.user.name, businessName);

  redirect("/dashboard");
}
