import Link from "next/link";

import type { OnboardingStatus } from "@/lib/onboarding-checklist";

/**
 * First-run guidance for a new workspace.
 *
 * Steps are derived from real data (see lib/onboarding-checklist.ts), so this
 * needs no dismiss state: it disappears on its own once every step is done, or
 * after the org's first 30 days.
 */
export function OnboardingChecklist({ status }: { status: OnboardingStatus }) {
  if (!status.show) return null;

  const next = status.steps.find((s) => !s.done);

  return (
    <section className="dc-card mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--dc-line)] px-5 py-3.5">
        <div>
          <p className="text-[0.9375rem] font-bold text-[var(--dc-ink)]">Get started</p>
          <p className="mt-0.5 text-[0.75rem] text-[var(--dc-ink-3)]">
            A few quick steps to set your workspace up properly.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[var(--dc-line)]" role="presentation">
            <div
              className="h-full rounded-full bg-[var(--dc-accent)] transition-[width]"
              style={{ width: `${Math.round((status.doneCount / status.totalCount) * 100)}%` }}
            />
          </div>
          <span className="text-[0.75rem] font-semibold tabular-nums text-[var(--dc-ink-2)]">
            {status.doneCount} of {status.totalCount}
          </span>
        </div>
      </div>

      <ul className="divide-y divide-[var(--dc-line)]">
        {status.steps.map((step) => {
          const isNext = !step.done && step.id === next?.id;
          return (
            <li key={step.id} className={`flex items-center gap-3 px-5 py-3 ${step.done ? "opacity-55" : ""}`}>
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0.625rem] font-bold ${
                  step.done
                    ? "border-[var(--dc-good)] bg-[var(--dc-good)]/15 text-[var(--dc-good)]"
                    : "border-[var(--dc-line)] text-[var(--dc-ink-3)]"
                }`}
              >
                {step.done ? "✓" : ""}
              </span>

              <div className="min-w-0 flex-1">
                <p className={`text-[0.8125rem] font-semibold ${step.done ? "text-[var(--dc-ink-2)] line-through" : "text-[var(--dc-ink)]"}`}>
                  {step.title}
                </p>
                <p className="text-[0.71875rem] text-[var(--dc-ink-3)]">{step.description}</p>
              </div>

              {step.done ? (
                <span className="shrink-0 text-[0.71875rem] font-semibold text-[var(--dc-good)]">Done</span>
              ) : (
                <Link
                  href={step.href}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-[0.75rem] font-semibold transition ${
                    isNext
                      ? "dc-btn"
                      : "border border-[var(--dc-line)] text-[var(--dc-ink-2)] hover:text-[var(--dc-ink)]"
                  }`}
                >
                  {step.cta}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
