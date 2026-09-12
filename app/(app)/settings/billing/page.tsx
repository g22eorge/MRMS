import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { PLAN_LIMITS, PLAN_LABELS, getLimitsForOrg } from "@/lib/plan-limits";
import { PlanBanner } from "@/components/shared/PlanBanner";
import { TRIAL_DAYS } from "@/lib/billing-access";
import { submitOrder, getOrCreateIpnId, buildMerchantRef, CURRENCY } from "@/lib/pesapal";
import { getEffectivePlanPrice, getEffectivePlanPrices } from "@/lib/plan-prices";
import { getOrgModules } from "@/lib/module-access";
import { OrgModuleControls } from "@/components/settings/OrgModuleControls";
import { formatMoney } from "@/lib/currency";
import { getPesapalConsumerKey, getPesapalConsumerSecret } from "@/lib/platform-settings";

import { SubmitButton } from "@/components/ui/SubmitButton";
import { flash } from "@/lib/flash";
// ── Server actions ────────────────────────────────────────────────────────────

async function startGrowthTrial() {
  "use server";

  const { user, orgId } = await requireOrgSession();
  if (!can.manageUsers(user)) redirect("/settings/billing");

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true, billingStatus: true },
  });

  // Only available when org is still on Starter (never upgraded) and trial has expired.
  if (!org || org.plan !== "STARTER") redirect("/settings/billing");

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  await prisma.organization.update({
    where: { id: orgId },
    data: { plan: "GROWTH", billingStatus: "TRIALING", trialEndsAt },
  });

  revalidatePath("/settings/billing");
  redirect(flash("/dashboard", "Saved"));
}

async function subscribeToPlan(formData: FormData) {
  "use server";

  const { user, orgId } = await requireOrgSession();
  if (!can.manageUsers(user)) redirect("/settings/billing");

  const targetPlan = formData.get("plan") as "STANDARD" | "GROWTH" | "PREMIUM" | "ENTERPRISE";
  if (!["STANDARD", "GROWTH", "PREMIUM", "ENTERPRISE"].includes(targetPlan)) redirect("/settings/billing");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const merchantRef = buildMerchantRef(orgId, targetPlan);

  let redirectUrl: string;
  try {
    const ipnId = await getOrCreateIpnId();

    // The override, not the raw table. The webhook and the callback verify the
    // amount against getEffectivePlanPrice, so charging the base price while a
    // platform override is set would have every payment rejected for an amount
    // mismatch — one price to charge and another to verify, which is the exact
    // defect this system already had once.
    const amount = await getEffectivePlanPrice(targetPlan);
    if (amount == null) throw new Error(`No price configured for ${targetPlan}`);

    const result = await submitOrder({
      merchantReference: merchantRef,
      amount,
      currency: CURRENCY,
      description: `Duuka ProMax ${targetPlan} plan`,
      callbackUrl: `${baseUrl}/api/billing/callback`,
      ipnId,
      email: user.email,
      name: user.name,
    });
    redirectUrl = result.redirect_url;
  } catch (err) {
    // Unconfigured credentials, an unregisterable IPN, or Pesapal being down
    // all threw out of this action unhandled, so pressing Subscribe produced a
    // bare error page with a digest and no explanation. Nothing has been
    // charged at this point, and saying so is the whole message.
    console.error("[billing/subscribe]", err);
    redirect("/settings/billing?payment=unavailable");
  }

  redirect(redirectUrl);
}

async function cancelPlan() {
  "use server";

  const { user, orgId } = await requireOrgSession();
  if (!can.manageUsers(user)) redirect("/settings/billing");

  await prisma.organization.update({
    where: { id: orgId },
    data: { billingStatus: "CANCELLED", planCancelledAt: new Date() },
  });

  revalidatePath("/settings/billing");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ suspended?: string; payment?: string }>;
}) {
  const params = await searchParams;
  const isSuspended = params.suspended === "1";
  const { user, orgId } = await requireOrgSession();
  const isAdmin = can.manageUsers(user);

  const [org, enabledModules] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        plan: true,
        billingStatus: true,
        trialEndsAt: true,
        planRenewsAt: true,
        planCancelledAt: true,
        flwSubscriptionId: true,
      },
    }),
    getOrgModules(orgId),
  ]);

  if (!org) redirect("/dashboard");
  const enabledModuleList = [...enabledModules];

  const now = new Date();
  const trialDaysLeft = org.trialEndsAt
    ? Math.max(0, Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / 86_400_000))
    : null;

  // Current plan usage — shown in the plan banner on the main billing view.
  const planInfo = await getLimitsForOrg(orgId);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [activeUserCount, jobsThisMonth, partCount] = await Promise.all([
    prisma.user.count({ where: { orgId, isActive: true } }),
    prisma.job.count({ where: { orgId, receivedAt: { gte: monthStart } } }),
    prisma.part.count({ where: { orgId, isActive: true } }),
  ]);

  const isFreeStarter = org.billingStatus === "TRIALING" && org.trialEndsAt == null;

  const isStarterTrialExpired =
    org.plan === "STARTER" &&
    org.billingStatus === "TRIALING" &&
    org.trialEndsAt != null &&
    org.trialEndsAt < now;

  const isGrowthTrialExpired =
    org.plan === "GROWTH" &&
    org.billingStatus === "TRIALING" &&
    org.trialEndsAt != null &&
    org.trialEndsAt < now;

  const isTrialActive =
    org.billingStatus === "TRIALING" &&
    org.trialEndsAt != null &&
    org.trialEndsAt > now;

  // Growth trial is available only when org is still on Starter (never upgraded yet)
  const canStartGrowthTrial = isAdmin && isStarterTrialExpired;

  const isPastDue = org.billingStatus === "PAST_DUE";

  const paymentNotice = (() => {
    if (params.payment === "success") return { tone: "success" as const, title: "Payment received", body: "Your subscription is active." };
    if (params.payment === "unavailable") return { tone: "warn" as const, title: "Payments are not available right now", body: "You have not been charged. This is a problem on our side rather than with your details — please try again shortly, or contact support if it continues." };
    if (params.payment === "failed") return { tone: "error" as const, title: "Payment failed", body: "No charge was captured. Try again or use a different method." };
    if (params.payment === "cancelled") return { tone: "warn" as const, title: "Payment cancelled", body: "You can resume payment anytime." };
    return null;
  })();

  const [pesapalKey, pesapalSecret] = isAdmin
    ? await Promise.all([getPesapalConsumerKey(), getPesapalConsumerSecret()])
    : [null, null];
  const pesapalConfigured = Boolean(pesapalKey && pesapalSecret);
  const pesapalMode = process.env.PESAPAL_ENV === "production" ? "live" : "sandbox";

  // ── Suspension wall ───────────────────────────────────────────────────────
  if (isSuspended || isStarterTrialExpired || isGrowthTrialExpired || isPastDue) {
    const alertTitle = isGrowthTrialExpired
      ? "Your Growth trial has ended"
      : isPastDue
      ? "Payment overdue"
      : "Your free trial has ended";

    const alertBody = isGrowthTrialExpired
      ? "Subscribe to Growth or Enterprise to restore access to your workspace."
      : isPastDue
      ? "Your last payment failed. Re-subscribe below to restore full access."
      : `Your ${TRIAL_DAYS}-day free trial has expired. Choose a plan below to continue using your workspace.`;

    return (
      <div className="space-y-4">
        {paymentNotice ? (
          <div className={`rounded-xl border px-5 py-4 text-sm ${
            paymentNotice.tone === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : paymentNotice.tone === "error"
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-amber-500/30 bg-amber-500/10 text-amber-200"
          }`}>
            <p className="font-semibold text-[var(--ink)]">{paymentNotice.title}</p>
            <p className="mt-1 text-[var(--ink-muted)]">{paymentNotice.body}</p>
          </div>
        ) : null}

        {/* Alert banner */}
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-5">
          <p className="font-semibold text-red-400 text-lg">{alertTitle}</p>
          <p className="mt-1 text-sm text-red-300/80">{alertBody}</p>
        </div>

        <div className="dc-card flex items-center px-4 py-2.5">
          <p className="text-[0.8125rem] font-bold text-[var(--ink)]">Choose a plan</p>
        </div>

        {!isAdmin && (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
            <p className="text-sm text-[var(--ink-muted)]">
              Only admins can manage the subscription. Contact your workspace admin to upgrade.
            </p>
          </div>
        )}

        {isAdmin && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(
              [
                {
                  key: "STANDARD" as const,
                  features: [
                    `${PLAN_LIMITS.STANDARD.maxUsers} team members`,
                    `${PLAN_LIMITS.STANDARD.maxJobsPerMonth} jobs / month`,
                    `${PLAN_LIMITS.STANDARD.maxParts} inventory SKUs`,
                    "Invoicing, Sales CRM & Inventory",
                    "Invite links · WhatsApp alerts",
                  ],
                },
                {
                  key: "GROWTH" as const,
                  highlight: true,
                  features: [
                    `${PLAN_LIMITS.GROWTH.maxUsers} team members`,
                    `${PLAN_LIMITS.GROWTH.maxJobsPerMonth} jobs / month`,
                    `${PLAN_LIMITS.GROWTH.maxParts} inventory SKUs`,
                    "POS, Purchase Orders & Field Ops",
                    "Custom branding · Priority support",
                  ],
                },
                {
                  key: "PREMIUM" as const,
                  features: [
                    `${PLAN_LIMITS.PREMIUM.maxUsers} team members`,
                    `${PLAN_LIMITS.PREMIUM.maxJobsPerMonth} jobs / month`,
                    `${PLAN_LIMITS.PREMIUM.maxParts} inventory SKUs`,
                    `Up to ${PLAN_LIMITS.PREMIUM.maxBranches} branches`,
                    "All modules · Advanced analytics",
                  ],
                },
                {
                  key: "ENTERPRISE" as const,
                  features: [
                    "Unlimited team members",
                    "Unlimited jobs & inventory",
                    "Unlimited branches",
                    "White-label branding & SLA",
                    "Dedicated account manager",
                  ],
                },
              ] as Array<{ key: "STANDARD" | "GROWTH" | "PREMIUM" | "ENTERPRISE"; highlight?: boolean; features: string[] }>
            ).map(({ key, highlight, features }) => (
              <div
                key={key}
                className={`rounded-xl border p-5 space-y-4 ${
                  highlight
                    ? "border-[var(--accent)] bg-[var(--accent)]/5"
                    : "border-[var(--line)] bg-[var(--panel)]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--ink)]">{PLAN_LABELS[key]}</p>
                    {highlight && (
                      <span className="rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-[0.75rem] font-semibold text-[var(--accent)] uppercase tracking-wide">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-lg font-bold text-[var(--ink)]">
                    <span className="text-base font-normal text-[var(--ink-muted)]">UGX </span>
                    {formatMoney(prices[key] ?? 0)}
                    <span className="text-sm font-normal text-[var(--ink-muted)]"> / mo</span>
                  </p>
                </div>
                <ul className="space-y-1.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
                      <span className="text-[var(--accent)]">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <div className="space-y-2">
                  <form action={subscribeToPlan}>
                    <input type="hidden" name="plan" value={key} />
                    <SubmitButton bare className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-colors ${
 highlight
 ? "btn-premium text-white"
 : "border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--accent)]/10"
 }`}>
                      Subscribe to {PLAN_LABELS[key]}
                    </SubmitButton>
                  </form>
                  {key === "GROWTH" && canStartGrowthTrial && (
                    <form action={startGrowthTrial}>
                      <SubmitButton bare className="w-full rounded-lg border border-[var(--accent)] py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors">
                        Try Growth free for 14 days
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {isAdmin ? (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Payment provider</p>
            <p className="mt-1 text-sm text-[var(--ink)]">Pesapal ({pesapalMode})</p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              {pesapalConfigured ? "Credentials configured." : "Missing Pesapal credentials. Set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET in Platform Settings or environment variables."}
            </p>
            {org.flwSubscriptionId ? (
              <p className="mt-2 text-xs text-[var(--ink-muted)]">Last payment reference: <span className="mono">{org.flwSubscriptionId}</span></p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  // ── Normal billing page (active trial or paid) ─────────────────────────────
  // Every price shown here is the one checkout will charge and the webhook will
  // verify — a platform override has to move all three together or a customer
  // is quoted one figure, charged it, and has the payment rejected against
  // another.
  const prices = await getEffectivePlanPrices();

  const plans: Array<{
    key: "STARTER" | "STANDARD" | "GROWTH" | "PREMIUM" | "ENTERPRISE";
    price: number | null;
    features: string[];
    highlight?: boolean;
  }> = [
    {
      key: "STARTER",
      price: null,
      features: [
        `${PLAN_LIMITS.STARTER.maxUsers} team members`,
        `${PLAN_LIMITS.STARTER.maxJobsPerMonth} jobs / month`,
        `${PLAN_LIMITS.STARTER.maxParts} inventory SKUs`,
        "Jobs, Reports & Complaints",
        "Public client intake form",
      ],
    },
    {
      key: "STANDARD",
      price: prices.STANDARD ?? null,
      features: [
        `${PLAN_LIMITS.STANDARD.maxUsers} team members`,
        `${PLAN_LIMITS.STANDARD.maxJobsPerMonth} jobs / month`,
        `${PLAN_LIMITS.STANDARD.maxParts} inventory SKUs`,
        "Invoicing, Sales CRM & Inventory",
        "Invite links · WhatsApp alerts",
      ],
    },
    {
      key: "GROWTH",
      price: prices.GROWTH ?? null,
      highlight: true,
      features: [
        `${PLAN_LIMITS.GROWTH.maxUsers} team members`,
        `${PLAN_LIMITS.GROWTH.maxJobsPerMonth} jobs / month`,
        `${PLAN_LIMITS.GROWTH.maxParts} inventory SKUs`,
        "POS, Purchase Orders & Field Ops",
        "Custom branding · Priority support",
      ],
    },
    {
      key: "PREMIUM",
      price: prices.PREMIUM ?? null,
      features: [
        `${PLAN_LIMITS.PREMIUM.maxUsers} team members`,
        `${PLAN_LIMITS.PREMIUM.maxJobsPerMonth} jobs / month`,
        `${PLAN_LIMITS.PREMIUM.maxParts} inventory SKUs`,
        `Up to ${PLAN_LIMITS.PREMIUM.maxBranches} branches`,
        "All modules · Advanced analytics",
      ],
    },
    {
      key: "ENTERPRISE",
      price: prices.ENTERPRISE ?? null,
      features: [
        "Unlimited team members",
        "Unlimited jobs & inventory",
        "Unlimited branches",
        "White-label branding & SLA",
        "Dedicated account manager",
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {paymentNotice ? (
        <div className={`rounded-xl border px-5 py-4 text-sm ${
          paymentNotice.tone === "success"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
            : paymentNotice.tone === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200"
        }`}>
          <p className="font-semibold text-[var(--ink)]">{paymentNotice.title}</p>
          <p className="mt-1 text-[var(--ink-muted)]">{paymentNotice.body}</p>
        </div>
      ) : null}

      {/* Header */}
      <div className="dc-card flex items-center px-4 py-2.5">
        <p className="text-[0.8125rem] font-bold text-[var(--ink)]">Billing &amp; Plan</p>
      </div>

      {isAdmin ? (
        <section className="dc-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Payment provider</p>
              <p className="mt-1 text-sm text-[var(--ink)]">Pesapal ({pesapalMode})</p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                {pesapalConfigured ? "Credentials configured." : "Missing Pesapal credentials. Set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET in Platform Settings or environment variables."}
              </p>
              {org.flwSubscriptionId ? (
                <p className="mt-2 text-xs text-[var(--ink-muted)]">Last payment reference: <span className="mono">{org.flwSubscriptionId}</span></p>
              ) : null}
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-xs text-[var(--ink-muted)]">
              Callback: <span className="mono">/api/billing/callback</span>
            </div>
          </div>
        </section>
      ) : null}

      {/* Current status card */}
      <section className="dc-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Current plan</p>
            <p className="mt-1 text-lg font-bold text-[var(--ink)]">{PLAN_LABELS[org.plan]}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
             org.billingStatus === "ACTIVE"    ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" :
             org.billingStatus === "TRIALING"  ? "border border-blue-400/30 bg-blue-500/10 text-blue-700 dark:text-blue-400" :
             org.billingStatus === "PAST_DUE"  ? "border border-red-400/30 bg-red-500/10 text-red-700 dark:text-red-400" :
                                                 "bg-[var(--border)] text-[var(--ink-muted)]"
           }`}>
            {org.billingStatus === "TRIALING" ? (isFreeStarter ? "Free" : "Free trial") :
             org.billingStatus === "ACTIVE"   ? "Active" :
             org.billingStatus === "PAST_DUE" ? "Payment overdue" :
                                                 "Cancelled"}
          </span>
        </div>

        {isTrialActive && trialDaysLeft !== null && (
          <div>
            <p className="text-sm text-[var(--ink-muted)]">
              {trialDaysLeft > 0
                ? <>{org.plan === "STARTER" ? "Free trial" : "Growth trial"} — <span className="font-medium text-[var(--ink)]">{trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining</span></>
                : "Your trial has ended."}
            </p>
            {org.plan === "STARTER" && trialDaysLeft <= 7 && trialDaysLeft > 0 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Your trial ends soon. Upgrade now to avoid interruption.
              </p>
            )}
          </div>
        )}

        {org.billingStatus === "ACTIVE" && org.planRenewsAt && (
          <p className="text-sm text-[var(--ink-muted)]">
            Next renewal:{" "}
            <span className="font-medium text-[var(--ink)]">
              {org.planRenewsAt.toLocaleDateString("en-UG", { day: "numeric", month: "long", year: "numeric" })}
            </span>{" "}
            · {CURRENCY} {formatMoney(prices[org.plan] ?? 0)} / month
          </p>
        )}

        {org.billingStatus === "CANCELLED" && org.planCancelledAt && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Subscription cancelled. Your access continues until the end of the current billing period.
          </p>
        )}

        {isAdmin && org.billingStatus === "ACTIVE" && (
          <form action={cancelPlan}>
            <SubmitButton bare className="text-xs text-red-500 underline underline-offset-2 hover:text-red-600">
              Cancel subscription
            </SubmitButton>
          </form>
        )}
      </section>

      {/* Plan usage vs limits */}
      <PlanBanner plan={planInfo.plan} limits={planInfo} usage={{ users: activeUserCount, jobsThisMonth, parts: partCount }} />

      {/* Enabled modules */}
      <section className="dc-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Enabled modules</p>
          <span className="rounded-full bg-[var(--panel-strong)] px-2 py-0.5 text-[0.75rem] font-semibold text-[var(--ink-muted)]">
            {enabledModuleList.length} / 10
          </span>
        </div>
        {/* Was a read-only list telling the customer to ask a platform
            administrator — a support request between them and a feature they
            are entitled to. */}
        <OrgModuleControls
          enabled={enabledModuleList}
          isTrialing={org.billingStatus === "TRIALING"}
          canEdit={isAdmin}
        />
      </section>

      {/* Plan cards — hide Starter upgrade (it's the free tier, no upgrade path back to it) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {plans.map(({ key, price, features }) => {
          const isCurrent = org.plan === key;
          const isDowngrade = key === "STARTER";
          const canSubscribe = isAdmin && !isCurrent && !isDowngrade;

          return (
            <div
              key={key}
              className={`panel-shadow rounded-xl border p-5 space-y-4 ${
                isCurrent
                  ? "border-[var(--accent)] bg-[var(--accent)]/5"
                  : "border-[var(--line)] bg-[var(--panel)]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[var(--ink)]">{PLAN_LABELS[key]}</p>
                  {isCurrent && (
                    <span className="rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-[0.75rem] font-semibold text-[var(--accent)]">
                      Current
                    </span>
                  )}
                </div>
                <p className="mt-1 text-lg font-bold text-[var(--ink)]">
                  {price === null ? (
                    <span>Free</span>
                  ) : (
                    <>
                      <span className="text-base font-normal text-[var(--ink-muted)]">UGX </span>
                      {formatMoney(price)}
                      <span className="text-sm font-normal text-[var(--ink-muted)]"> / mo</span>
                    </>
                  )}
                </p>
              </div>

              <ul className="space-y-1.5">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
                    <span className="text-[var(--accent)]">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {canSubscribe && (
                <form action={subscribeToPlan}>
                  <input type="hidden" name="plan" value={key} />
                  <SubmitButton bare className="btn-premium w-full rounded-lg py-2 text-sm font-semibold text-white">
                    Upgrade to {PLAN_LABELS[key]}
                  </SubmitButton>
                </form>
              )}

              {isDowngrade && !isCurrent && (
                <p className="text-xs text-[var(--ink-muted)]">
                  To downgrade, cancel your current subscription first.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!isAdmin && (
        <p className="text-sm text-[var(--ink-muted)]">
          Only admins can manage the subscription. Contact your workspace admin to upgrade.
        </p>
      )}
    </div>
  );
}
