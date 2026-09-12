"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OrgModule } from "@prisma/client";

import { setOrgModuleAction, type ModuleChangeResult } from "@/app/(app)/settings/billing/module-actions";
import { ALL_MODULES, MODULE_LABELS, MODULE_DESCRIPTIONS } from "@/lib/module-catalog";
import { ModuleIcon } from "@/components/shared/ModuleIcon";
import { formatMoney } from "@/lib/currency";

/**
 * Turning modules on and off, for the business rather than for support.
 *
 * The list used to be read-only, with a line explaining that a platform
 * administrator could change it. That put a support request between a customer
 * and a feature they are entitled to.
 *
 * Adding a module the plan does not cover is refused by the server with the
 * plan it needs and the price, which is shown here as a prompt rather than
 * applied. Nobody's bill moves because they pressed a toggle.
 */
export function OrgModuleControls({
  enabled,
  isTrialing,
  canEdit,
}: {
  enabled: OrgModule[];
  /** During a trial everything is on regardless of grants, so toggles are moot. */
  isTrialing: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<OrgModule | null>(null);
  const [result, setResult] = useState<ModuleChangeResult | null>(null);

  const on = new Set(enabled);

  function change(module: OrgModule, enable: boolean) {
    setBusy(module);
    setResult(null);
    const data = new FormData();
    data.set("module", module);
    data.set("enable", String(enable));
    startTransition(async () => {
      const res = await setOrgModuleAction(data);
      setResult(res);
      setBusy(null);
      if (res.ok) router.refresh();
    });
  }

  if (isTrialing) {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3">
        <p className="text-[0.8125rem] font-semibold text-[var(--ink)]">
          Every module is available during your trial
        </p>
        <p className="mt-1 text-[0.8125rem] text-[var(--ink-muted)]">
          Use whatever is useful. When the trial ends you keep the ones your plan covers, and you can
          change the selection here at any time — so there is nothing to decide now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {ALL_MODULES.map((m) => {
          const isOn = on.has(m);
          return (
            <div
              key={m}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                isOn ? "border-[var(--accent)]/40 bg-[var(--accent)]/5" : "border-[var(--line)] bg-[var(--panel-strong)]"
              }`}
            >
              <ModuleIcon module={m} className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
              <div className="min-w-0 flex-1">
                <p className="text-[0.8125rem] font-semibold text-[var(--ink)]">{MODULE_LABELS[m]}</p>
                <p className="text-[0.75rem] text-[var(--ink-muted)]">{MODULE_DESCRIPTIONS[m]}</p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  disabled={pending && busy === m}
                  onClick={() => change(m, !isOn)}
                  className={`shrink-0 rounded-md px-2.5 py-1 text-[0.75rem] font-semibold transition disabled:opacity-50 ${
                    isOn
                      ? "bg-[var(--panel)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                      : "bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)]/25"
                  }`}
                >
                  {busy === m ? "…" : isOn ? "Turn off" : "Turn on"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* An upgrade is offered, never performed. */}
      {result && !result.ok && "needsUpgrade" in result && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <p className="text-[0.8125rem] font-semibold text-amber-500">{result.error}</p>
          <p className="mt-1 text-[0.8125rem] text-[var(--ink-muted)]">
            {result.monthlyPrice != null
              ? `${result.requiredPlanLabel} is ${formatMoney(result.monthlyPrice)} per month. Choose it below to enable ${MODULE_LABELS[result.module]}.`
              : `Choose ${result.requiredPlanLabel} below to enable ${MODULE_LABELS[result.module]}.`}
          </p>
        </div>
      )}

      {result && !result.ok && !("needsUpgrade" in result) && (
        <p className="text-[0.8125rem] font-medium text-red-500">{result.error}</p>
      )}

      {!canEdit && (
        <p className="text-[0.8125rem] text-[var(--ink-muted)]">
          An administrator on this workspace can change which modules are switched on.
        </p>
      )}
    </div>
  );
}
