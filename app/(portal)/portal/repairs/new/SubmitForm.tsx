"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { submitPortalRepairRequest, type SubmitState } from "./actions";

const input = "w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]/50";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-premium rounded-lg px-4 py-2 text-[13px] text-white disabled:opacity-60">
      {pending ? "Submitting…" : "Submit request"}
    </button>
  );
}

export function SubmitForm() {
  const [state, action] = useActionState<SubmitState, FormData>(submitPortalRepairRequest, {});

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[12px] font-medium text-[var(--ink-muted)]">
          Device type
          <select name="deviceType" required defaultValue="" className={`mt-1 ${input}`}>
            <option value="" disabled>Select…</option>
            <option value="PHONE_ANDROID">Android phone</option>
            <option value="PHONE_IPHONE">iPhone</option>
            <option value="TABLET">Tablet</option>
            <option value="WINDOWS_PC">Windows PC / laptop</option>
            <option value="MAC">Mac</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="text-[12px] font-medium text-[var(--ink-muted)]">
          Handover
          <select name="handoverMethod" defaultValue="SELF_DROPOFF" className={`mt-1 ${input}`}>
            <option value="SELF_DROPOFF">We&rsquo;ll drop it off</option>
            <option value="REQUEST_PICKUP">Please pick it up</option>
            <option value="SEND_WITH_DELIVERY_PERSON">Sending via courier</option>
          </select>
        </label>
        <label className="text-[12px] font-medium text-[var(--ink-muted)]">
          Brand
          <input name="brand" required placeholder="e.g. Dell, Apple, Samsung" className={`mt-1 ${input}`} />
        </label>
        <label className="text-[12px] font-medium text-[var(--ink-muted)]">
          Model (optional)
          <input name="model" placeholder="e.g. Latitude 5420" className={`mt-1 ${input}`} />
        </label>
        <label className="text-[12px] font-medium text-[var(--ink-muted)] sm:col-span-2">
          Serial / asset tag (optional)
          <input name="serialNumber" placeholder="Serial number or asset tag" className={`mt-1 ${input}`} />
        </label>
      </div>
      <label className="block text-[12px] font-medium text-[var(--ink-muted)]">
        What&rsquo;s wrong?
        <textarea name="problemDescription" required rows={4} placeholder="Describe the fault or the work you need…" className={`mt-1 ${input}`} />
      </label>
      {state.error ? <p className="text-[13px] text-red-500">{state.error}</p> : null}
      <Submit />
    </form>
  );
}
