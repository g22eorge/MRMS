'use client';

import { useState } from "react";
import { PLATFORM_ROUTES } from "@/lib/platform/routes";

interface OrgAlert {
  id: string;
  name: string;
  trialEndsAt: Date | string | null;
}

interface AlertsBannerProps {
  pastDueOrgs: OrgAlert[];
  expiringOrgs: OrgAlert[];
  now: number;
}

export default function AlertsBanner({ pastDueOrgs, expiringOrgs, now }: AlertsBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const visiblePastDue = pastDueOrgs.filter((o) => !dismissed.has(o.id));
  const visibleExpiring = expiringOrgs.filter((o) => !dismissed.has(o.id));

  if (visiblePastDue.length === 0 && visibleExpiring.length === 0) return null;

  return (
    <div className="space-y-2">
      {visiblePastDue.map((org) => (
        <div key={org.id} className="flex items-center justify-between gap-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-red-500">●</span>
            <span className="font-semibold text-red-800 dark:text-red-300">{org.name}</span>
            <span className="text-red-600 dark:text-red-400">is past due</span>
          </div>
          <div className="flex items-center gap-2">
            <a href={PLATFORM_ROUTES.org(org.id)} className="rounded-lg border border-red-400/30 bg-red-500/5 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-500/15 dark:text-red-400">
              Fix →
            </a>
            <button
              onClick={() => dismiss(org.id)}
              className="text-red-500 hover:text-red-700"
              aria-label="Dismiss past due alert"
            >
              ×
            </button>
          </div>
        </div>
      ))}
      {visibleExpiring.map((org) => {
        const days = Math.ceil((new Date(org.trialEndsAt!).getTime() - now) / 86_400_000);
        return (
          <div key={org.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-amber-500">●</span>
              <span className="font-semibold text-amber-800 dark:text-amber-300">{org.name}</span>
              <span className="text-amber-700 dark:text-amber-400">
                trial expires in {days} day{days !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a href={PLATFORM_ROUTES.org(org.id)} className="rounded-lg border border-amber-400/30 bg-amber-500/5 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-500/15 dark:text-amber-400">
                Extend →
              </a>
              <button
                onClick={() => dismiss(org.id)}
                className="text-amber-500 hover:text-amber-700"
                aria-label="Dismiss trial expiry alert"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
