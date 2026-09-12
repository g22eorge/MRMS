"use client";

import { useActionState, useState } from "react";
import { PLAN_PRICES } from "@/lib/plan-prices";
import { useFormStatus } from "react-dom";
import { OrgModule } from "@prisma/client";

import {
  MODULE_LABELS,
  MODULE_DESCRIPTIONS,
  MODULE_MIN_PLAN,
  recommendPlanForModules,
} from "@/lib/module-catalog";
import { ModuleIcon } from "@/components/shared/ModuleIcon";
import { createOrganization, type CreateOrgState } from "./actions";
import { TRIAL_DAYS } from "@/lib/billing-access";

// ── Plan display metadata ─────────────────────────────────────────────────────

// Branded Duuka ladder, harmonised to the accent (gold) — no per-tier rainbow.
// Prices come from PLAN_PRICES, never from here. This block used to carry its
// own copy, so the figure a prospect was quoted at signup and the figure
// checkout charged were two independent facts that happened to agree — the same
// shape as the two price tables that made every payment fail, one step earlier
// in the funnel and on the screen where a customer decides.
const PLAN_META = {
  STARTER:    { label: "Duuka",        price: null,                     color: "text-[var(--ink)]",     bg: "bg-[var(--panel-strong)]", border: "border-[var(--line)]" },
  STANDARD:   { label: "Duuka Plus",   price: PLAN_PRICES.STANDARD,     color: "text-[var(--accent)]",  bg: "bg-[var(--accent)]/5",     border: "border-[var(--accent)]/25" },
  GROWTH:     { label: "Duuka Pro",    price: PLAN_PRICES.GROWTH,       color: "text-[var(--accent)]",  bg: "bg-[var(--accent)]/5",     border: "border-[var(--accent)]/25" },
  PREMIUM:    { label: "Duuka Max",    price: PLAN_PRICES.PREMIUM,      color: "text-[var(--accent)]",  bg: "bg-[var(--accent)]/5",     border: "border-[var(--accent)]/25" },
  ENTERPRISE: { label: "Duuka ProMax", price: PLAN_PRICES.ENTERPRISE,   color: "text-[var(--accent)]",  bg: "bg-[var(--accent)]/5",     border: "border-[var(--accent)]/25" },
} as const;

const ALL_MODULES = Object.keys(MODULE_LABELS) as OrgModule[];

function fmt(n: number) {
  return `UGX ${n.toLocaleString()}/mo`;
}

// ── Submit button ─────────────────────────────────────────────────────────────

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-premium w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
    >
      {pending ? "Creating workspace…" : "Launch my workspace →"}
    </button>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

const initial: CreateOrgState = {};

export function OnboardingForm() {
  const [state, action] = useActionState(createOrganization, initial);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [businessName, setBusinessName] = useState("");
  const [selected, setSelected] = useState<Set<OrgModule>>(new Set(["INVOICING", "REPORTS"] as OrgModule[]));

  const recommended = recommendPlanForModules([...selected]);
  const meta = PLAN_META[recommended];

  // Modules that require a higher plan than STARTER get a badge
  function planBadge(m: OrgModule) {
    const p = MODULE_MIN_PLAN[m];
    if (p === "STARTER") return null;
    return PLAN_META[p].label;
  }

  function toggle(m: OrgModule) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(m)) {
        next.delete(m);
      } else {
        next.add(m);
      }
      return next;
    });
  }

  function goToStep2(e: React.FormEvent) {
    e.preventDefault();
    if (businessName.trim().length < 2) return;
    setStep(2);
  }

  function goToStep3(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) return;
    setStep(3);
  }

  // ── Step indicators ───────────────────────────────────────────────────────

  const steps = [
    { n: 1, label: "Business" },
    { n: 2, label: "Modules" },
    { n: 3, label: "Plan" },
  ];

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
              step === s.n
                ? "bg-[var(--accent)] text-black"
                : step > s.n
                ? "bg-emerald-500 text-white"
                : "bg-[var(--panel-strong)] text-[var(--ink-muted)]"
            }`}>
              {step > s.n ? "✓" : s.n}
            </div>
            <span className={`ml-1.5 text-xs font-medium ${step === s.n ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className={`mx-3 h-px w-8 ${step > s.n ? "bg-emerald-400" : "bg-[var(--line)]"}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Business name ─────────────────────────────────────────── */}
      {step === 1 && (
        <form onSubmit={goToStep2} className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-[var(--ink)]">Name your workspace</h2>
            <p className="text-xs text-[var(--ink-muted)]">This will appear on invoices, job cards, and client communications.</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="businessName" className="block text-sm font-medium text-[var(--ink)]">
              Business name
            </label>
            <input
              id="businessName"
              name="businessName"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Eagle Info Repairs"
              required
              minLength={2}
              maxLength={100}
              autoFocus
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <button
            type="submit"
            disabled={businessName.trim().length < 2}
            className="btn-premium w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Next: Choose modules →
          </button>
        </form>
      )}

      {/* ── Step 2: Module selection ──────────────────────────────────────── */}
      {step === 2 && (
        <form onSubmit={goToStep3} className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-[var(--ink)]">What does your business need?</h2>
            <p className="text-xs text-[var(--ink-muted)]">
              Select the features that match your workflow. You can adjust these later in settings.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ALL_MODULES.map((m) => {
              const active = selected.has(m);
              const badge = planBadge(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggle(m)}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)]/5 shadow-sm"
                      : "border-[var(--line)] bg-[var(--panel-strong)] hover:border-[var(--accent)]/40"
                  }`}
                >
                  <ModuleIcon module={m} className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-[var(--ink)]">{MODULE_LABELS[m]}</span>
                      {badge && (
                        <span className="rounded-full bg-[var(--panel-strong)] px-1.5 py-0.5 text-[0.8125rem] font-bold uppercase tracking-wide text-[var(--ink-muted)] border border-[var(--line)]">
                          {badge}+
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[0.8125rem] leading-snug text-[var(--ink-muted)]">
                      {MODULE_DESCRIPTIONS[m]}
                    </p>
                  </div>
                  <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${
                    active ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--line)]"
                  }`} />
                </button>
              );
            })}
          </div>

          {selected.size === 0 && (
            <p className="text-center text-xs text-amber-600">Select at least one module to continue.</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border border-[var(--line)] px-4 py-2.5 text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={selected.size === 0}
              className="btn-premium flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Next: Review plan →
            </button>
          </div>
        </form>
      )}

      {/* ── Step 3: Plan preview + final submit ───────────────────────────── */}
      {step === 3 && (
        <form action={action} className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          {/* Hidden fields passed to server action */}
          <input type="hidden" name="businessName" value={businessName} />
          {[...selected].map((m) => (
            <input key={m} type="hidden" name="module" value={m} />
          ))}

          <div className="space-y-1">
            <h2 className="text-base font-semibold text-[var(--ink)]">Your plan recommendation</h2>
            <p className="text-xs text-[var(--ink-muted)]">
              Based on your {selected.size} selected module{selected.size !== 1 ? "s" : ""}, here&apos;s what you&apos;ll need.
            </p>
          </div>

          {/* Plan card */}
          <div className={`rounded-xl border p-4 ${meta.bg} ${meta.border}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-lg font-bold ${meta.color}`}>{meta.label}</p>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                  {meta.price == null
                    ? "Free forever — no credit card needed"
                    : `${fmt(meta.price)} after your ${TRIAL_DAYS}-day free trial`}
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[0.75rem] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                {TRIAL_DAYS} days free
              </span>
            </div>
            {meta.price != null && (
              <p className="mt-3 text-[0.8125rem] text-[var(--ink-muted)]">
                Your trial starts today. No payment required now. You&apos;ll get a reminder before it ends.
              </p>
            )}
          </div>

          {/* Selected modules summary */}
          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] p-3">
            <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-widest text-[var(--ink-muted)]">
              Enabled modules
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[...selected].map((m) => (
                <span key={m} className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] px-2 py-0.5 text-xs font-medium text-[var(--ink)]">
                  <ModuleIcon module={m} className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span>{MODULE_LABELS[m]}</span>
                </span>
              ))}
            </div>
          </div>

          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {state.error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-lg border border-[var(--line)] px-4 py-2.5 text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]"
            >
              ← Back
            </button>
            <div className="flex-1">
              <SubmitButton />
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
