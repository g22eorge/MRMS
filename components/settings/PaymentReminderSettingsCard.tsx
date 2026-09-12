import { revalidatePath } from "next/cache";

import { SubmitButton } from "@/components/ui/SubmitButton";
import { formatMoney } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { reminderState } from "@/lib/notifications/reminder-state";

/**
 * The switch for automatic payment reminders.
 *
 * Written to make the safe path the easy one. A new organisation starts off and
 * in preview, and the copy says what each control actually costs rather than
 * naming the field — because the person turning this on is deciding to let the
 * system speak to their customers unprompted, and should be able to see the
 * consequences from the form.
 */

type Settings = {
  enabled: boolean;
  dryRun: boolean;
  paymentTermsDays: number;
  manualReviewAbove: number;
  statementForMultiInvoice: boolean;
  quietHourStart: number;
  quietHourEnd: number;
};

const field =
  "mt-1 h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50";
const label = "text-[0.625rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]";

export function PaymentReminderSettingsCard({ orgId, settings }: { orgId: string; settings: Settings | null }) {
  const s: Settings = settings ?? {
    enabled: false,
    dryRun: true,
    paymentTermsDays: 30,
    manualReviewAbove: 2_000_000,
    statementForMultiInvoice: true,
    quietHourStart: 8,
    quietHourEnd: 20,
  };

  async function saveAction(formData: FormData) {
    "use server";
    const { user, orgId: actorOrg } = await requireOrgSession();
    if (user.role !== "ADMIN" || actorOrg !== orgId) return;

    const num = (key: string, fallback: number, min: number, max: number) => {
      const v = Number(String(formData.get(key) ?? "").replace(/,/g, "").trim());
      if (!Number.isFinite(v)) return fallback;
      return Math.min(max, Math.max(min, v));
    };
    const enabled = formData.get("enabled") === "on";
    // Turning the feature on cannot also turn preview off in the same save.
    // Two deliberate actions, so nobody reaches a live send by ticking one box.
    const dryRun = enabled && !settings?.enabled ? true : formData.get("dryRun") === "on";

    const data = {
      enabled,
      dryRun,
      paymentTermsDays: num("paymentTermsDays", 30, 1, 180),
      manualReviewAbove: num("manualReviewAbove", 2_000_000, 0, 1_000_000_000),
      statementForMultiInvoice: formData.get("statementForMultiInvoice") === "on",
      quietHourStart: num("quietHourStart", 8, 0, 23),
      quietHourEnd: num("quietHourEnd", 20, 1, 24),
    };
    await prisma.paymentReminderSettings.upsert({
      where: { orgId },
      update: data,
      create: { orgId, ...data },
    });
    revalidatePath("/settings/notifications");
  }

  const state = reminderState(settings);

  return (
    <form action={saveAction} className="dc-card overflow-hidden">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <p className="text-[0.8125rem] font-bold text-[var(--ink)]">Payment reminders</p>
        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
          Chases unpaid invoices on a fixed ladder: a courtesy a week before the due date, one on the
          day, then twice after. Nothing is sent in the first three weeks of a 30-day term, and an
          invoice still unpaid three weeks past its due date is left for a person rather than chased
          again.
        </p>
      </div>

      {/* What the two switches below currently add up to. Each explains itself;
          neither said what the pair amounts to, and "on but still previewing"
          is the combination a business is most likely to misread as working. */}
      <div
        className={`border-b px-4 py-2.5 ${
          state.mode === "live"
            ? "border-emerald-500/30 bg-emerald-500/10"
            : state.looksOnButSendsNothing
              ? "border-amber-500/30 bg-amber-500/10"
              : "border-[var(--line)] bg-[var(--panel-strong)]"
        }`}
      >
        <p
          className={`text-[0.8125rem] font-semibold ${
            state.mode === "live"
              ? "text-emerald-500"
              : state.looksOnButSendsNothing
                ? "text-amber-500"
                : "text-[var(--ink-muted)]"
          }`}
        >
          {state.headline}
        </p>
        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{state.detail}</p>
      </div>

      <div className="space-y-3 px-4 py-3">
        <label className="flex items-start gap-2.5">
          <input type="checkbox" name="enabled" defaultChecked={s.enabled} className="mt-0.5" />
          <span className="text-[0.8125rem]">
            <b>Send automatic reminders</b>
            <span className="block text-xs text-[var(--ink-muted)]">
              Runs once a day. Balances are re-checked at the moment of sending, so an invoice paid
              overnight is never chased.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2.5">
          <input type="checkbox" name="dryRun" defaultChecked={s.dryRun} className="mt-0.5" />
          <span className="text-[0.8125rem]">
            <b>Preview only — write to the outbox, send nothing</b>
            <span className="block text-xs text-[var(--ink-muted)]">
              Leave this on for a fortnight and read the outbox. Turning reminders on always starts
              in preview; clearing this is a separate, deliberate save.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            name="statementForMultiInvoice"
            defaultChecked={s.statementForMultiInvoice}
            className="mt-0.5"
          />
          <span className="text-[0.8125rem]">
            <b>One statement for clients with several unpaid invoices</b>
            <span className="block text-xs text-[var(--ink-muted)]">
              Without this a client holding ten invoices receives ten messages in one morning.
            </span>
          </span>
        </label>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className={label}>
            Payment terms (days)
            <input name="paymentTermsDays" type="number" min="1" max="180" defaultValue={s.paymentTermsDays} className={field} />
          </label>
          <label className={label}>
            Leave to a person above
            <input name="manualReviewAbove" type="number" min="0" step="any" defaultValue={s.manualReviewAbove} className={field} />
          </label>
          <label className={label}>
            Quiet hours from
            <input name="quietHourStart" type="number" min="0" max="23" defaultValue={s.quietHourStart} className={field} />
          </label>
          <label className={label}>
            until
            <input name="quietHourEnd" type="number" min="1" max="24" defaultValue={s.quietHourEnd} className={field} />
          </label>
        </div>

        <p className="text-xs text-[var(--ink-muted)]">
          Balances above {formatMoney(s.manualReviewAbove, "UGX")} are never chased automatically — a
          large debt is a conversation, and a template answering it reads as one. Reminders send only
          between {String(s.quietHourStart).padStart(2, "0")}:00 and{" "}
          {String(s.quietHourEnd).padStart(2, "0")}:00.
        </p>
      </div>

      <div className="flex justify-end border-t border-[var(--line)] px-4 py-3">
        <SubmitButton bare className="btn-premium rounded-lg px-4 py-2 text-[0.75rem] font-bold">
          Save reminder settings
        </SubmitButton>
      </div>
    </form>
  );
}
