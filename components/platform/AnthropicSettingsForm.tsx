"use client";

import { useActionState, useState, useTransition } from "react";
import { saveAnthropicSettingsAction, clearAnthropicKeyAction } from "@/app/(platform)/platform/settings/actions";

import { SubmitButton } from "@/components/ui/SubmitButton";

type Configured = {
  apiKey: boolean;
  apiKeyInDb: boolean;
  guideModel: string;
  guideModelInDb: boolean;
  copilotModel: string;
  copilotModelInDb: boolean;
};

type Props = { configured: Configured };

export function AnthropicSettingsForm({ configured }: Props) {
  const [saveState, saveAction, saving] = useActionState<{ ok: boolean; error?: string } | null, FormData>(
    saveAnthropicSettingsAction,
    null,
  );

  const [cleared, setCleared] = useState<{ key: string; ok: boolean; error?: string } | null>(null);
  const [clearPending, startClearTransition] = useTransition();
  const [clearingKey, setClearingKey] = useState<string | null>(null);
  const clearing = clearPending ? clearingKey : null;
  const startClear = (fn: () => Promise<void>) => startClearTransition(fn);

  const getValue = (name: string) => {
    if (name === "ANTHROPIC_API_KEY") return "";
    if (name === "ANTHROPIC_GUIDE_MODEL") return configured.guideModel;
    return configured.copilotModel;
  };

  const isConfigured = (name: string) => {
    if (name === "ANTHROPIC_API_KEY") return configured.apiKey;
    return getValue(name).length > 0;
  };

  const isInDb = (name: string) => {
    if (name === "ANTHROPIC_API_KEY") return configured.apiKeyInDb;
    if (name === "ANTHROPIC_GUIDE_MODEL") return configured.guideModelInDb;
    return configured.copilotModelInDb;
  };

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 space-y-5">
      <div>
        <p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
          Anthropic AI (platform-wide)
        </p>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Configure the platform-wide Anthropic key used by the AI Guide and Business Copilot. Values saved
          here override environment variables.
        </p>
      </div>

      <form action={saveAction} className="space-y-4">
        {FIELDS.map((f) => {
          const key = f.name as "ANTHROPIC_API_KEY" | "ANTHROPIC_GUIDE_MODEL" | "ANTHROPIC_COPILOT_MODEL";
          const configuredValue = isConfigured(key);
          const storedValue = isInDb(key);

          return (
            <div key={f.name}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-[var(--ink-muted)]">{f.label}</label>
                <span
                  className={`text-[0.75rem] font-semibold ${configuredValue ? "text-emerald-600" : "text-[var(--ink-muted)]"}`}
                >
                  {configuredValue ? (storedValue ? "✓ Configured (DB)" : "✓ Configured (env)") : "Not configured"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  name={f.name}
                  type={f.type ?? "text"}
                  autoComplete="off"
                  defaultValue={getValue(f.name)}
                  placeholder={configuredValue ? "Leave blank to keep existing value" : f.placeholder}
                  className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] mono text-[var(--ink)] placeholder:text-[var(--ink-muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                />

                {storedValue && (
                  <button
                    type="button"
                    disabled={clearing === key}
                    onClick={() => {
                      setCleared(null);
                      setClearingKey(key);
                      startClear(async () => {
                        const data = new FormData();
                        data.set("key", key);
                        const res = await clearAnthropicKeyAction(null, data);
                        setCleared({ key, ok: res.ok, error: res.error });
                      });
                    }}
                    className="rounded-md px-2.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {clearing === key ? "Clearing…" : "Clear"}
                  </button>
                )}
              </div>

              <p className="mt-1 text-[0.75rem] text-[var(--ink-muted)]">{f.hint}</p>

              {cleared?.key === key && (
                <p className={`mt-1 text-[0.75rem] font-semibold ${cleared.ok ? "text-emerald-600" : "text-red-600"}`}>
                  {cleared.ok ? "Cleared." : cleared.error ?? "Could not clear."}
                </p>
              )}
            </div>
          );
        })}

        {saveState && !saveState.ok && <p className="text-xs text-red-600">{saveState.error ?? "Save failed"}</p>}
        {saveState?.ok && <p className="text-xs text-emerald-600">Settings saved successfully.</p>}

        <p className="text-[0.75rem] text-[var(--ink-muted)]">
          Saved is not the same as working.{" "}
          <a href="/api/admin/ai-health" className="font-semibold text-[var(--accent)] underline underline-offset-2">
            Check these credentials against Anthropic
          </a>{" "}
          — it calls the API with a tiny request, sends nothing, and costs nothing.
        </p>

        <SubmitButton
          bare
          disabled={saving}
          className="btn-premium rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save AI Settings"}
        </SubmitButton>
      </form>
    </div>
  );
}
