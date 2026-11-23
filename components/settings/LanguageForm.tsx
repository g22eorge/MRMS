"use client";

import { useState } from "react";

/**
 * Changing the language reloads the page.
 *
 * Page text is translated in place after it is displayed (PageTranslator), so
 * a page already on screen holds the old language's words where React believes
 * nothing changed. Re-rendering does not put them back; only a fresh load
 * does. Without the reload the switch appeared to hang: the setting was saved,
 * and the screen stayed as it was.
 */
export function LanguageForm({
  current,
  options,
  action,
}: {
  current: string;
  options: ReadonlyArray<{ code: string; label: string }>;
  action: (formData: FormData) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (String(data.get("locale")) === current) return;
    setPending(true);
    setFailed(false);
    try {
      await action(data);
      window.location.reload();
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <select
        name="locale"
        defaultValue={current}
        disabled={pending}
        className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-[0.8125rem] text-[var(--ink)]"
      >
        {options.map((option) => (
          <option key={option.code} value={option.code}>{option.label}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] font-semibold text-[var(--ink)] disabled:opacity-50"
      >
        {pending ? "…" : "Save"}
      </button>
      {failed ? <span role="alert" className="text-[0.8125rem] text-red-500">Not saved. Try again.</span> : null}
    </form>
  );
}
