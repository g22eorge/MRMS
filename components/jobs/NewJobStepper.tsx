"use client";

import { useFormState } from "react";
import { ChangeEvent, useMemo, useState } from "react";

import { createJobAction } from "@/app/(app)/jobs/new/actions";

const steps = ["Client Info", "Device Info", "Issue", "Review"] as const;

const initialState = { error: null as string | null };

export function NewJobStepper({ receivedByName }: { receivedByName: string }) {
  const [step, setStep] = useState(0);
  const [formState, formAction] = useFormState(async (prevState: typeof initialState, formData: FormData) => {
    try {
      await createJobAction(formData);
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create job";
      return { error: message };
    }
  }, initialState);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    organization: "",
    deviceType: "",
    brand: "",
    model: "",
    serialOrImei: "",
    accessories: "",
    physicalNotes: "",
    issueDescription: "",
    receivedAt: "",
  });
  const [existingClient, setExistingClient] = useState<null | {
    fullName: string;
    email: string | null;
    organization: string | null;
  }>(null);

  const receivedBy = useMemo(() => receivedByName, [receivedByName]);

  const onInput = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <form action={formAction} className="space-y-4">
      {formState?.error && (
        <div className="rounded-md border border-black bg-black p-3 text-sm text-white">
          {formState.error}
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto">
        {steps.map((label, idx) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(idx)}
            className={`rounded-full px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm ${
              idx === step ? "bg-[#D4AF37] text-white" : "bg-slate-200 text-slate-700"
            }`}
          >
            {idx + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 ? (
        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2">
          <input name="fullName" value={form.fullName} onChange={onInput} required placeholder="Full Name" className="rounded-md border border-slate-300 px-3 py-2" />
          <input
            name="phone"
            value={form.phone}
            onChange={onInput}
            onBlur={async () => {
              if (form.phone.trim().length < 3) {
                setExistingClient(null);
                return;
              }
              const res = await fetch(`/api/clients/search?phone=${encodeURIComponent(form.phone.trim())}`);
              if (!res.ok) return;
              const data = await res.json();
              setExistingClient(data.client ?? null);
            }}
            required
            placeholder="Phone"
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <input name="email" value={form.email} onChange={onInput} placeholder="Email" className="rounded-md border border-slate-300 px-3 py-2" />
          <input name="organization" value={form.organization} onChange={onInput} placeholder="Organization" className="rounded-md border border-slate-300 px-3 py-2" />
          {existingClient ? (
            <p className="text-xs text-[#D4AF37] md:col-span-2">
              Existing client found by phone: {existingClient.fullName}. Submitting will update this client profile.
            </p>
          ) : null}
        </section>
      ) : null}

      {step === 1 ? (
        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2">
          <select name="deviceType" value={form.deviceType} onChange={onInput} required className="rounded-md border border-slate-300 px-3 py-2">
            <option value="">Device Type</option>
            <option value="PHONE_ANDROID">Phone Android</option>
            <option value="PHONE_IPHONE">Phone iPhone</option>
            <option value="TABLET">Tablet</option>
            <option value="WINDOWS_PC">Windows PC</option>
            <option value="MAC">Mac</option>
            <option value="OTHER">Other</option>
          </select>
          <input name="brand" value={form.brand} onChange={onInput} required placeholder="Brand" className="rounded-md border border-slate-300 px-3 py-2" />
          <input name="model" value={form.model} onChange={onInput} required placeholder="Model" className="rounded-md border border-slate-300 px-3 py-2" />
          <input name="serialOrImei" value={form.serialOrImei} onChange={onInput} placeholder="Serial / IMEI" className="rounded-md border border-slate-300 px-3 py-2" />
          <textarea name="accessories" value={form.accessories} onChange={onInput} placeholder="Accessories" className="rounded-md border border-slate-300 px-3 py-2 md:col-span-2" />
          <textarea name="physicalNotes" value={form.physicalNotes} onChange={onInput} placeholder="Physical notes" className="rounded-md border border-slate-300 px-3 py-2 md:col-span-2" />
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Before Repair Photos</label>
            <input name="photos" type="file" accept="image/png,image/jpeg,image/webp" multiple />
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <textarea
            name="issueDescription"
            value={form.issueDescription}
            onChange={onInput}
            required
            placeholder="Issue description in client's words"
            className="min-h-28 w-full rounded-md border border-slate-300 px-3 py-2"
          />
          <input
            value={receivedBy}
            readOnly
            aria-label="Received by"
            className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
          />
          <input
            name="receivedAt"
            type="datetime-local"
            value={form.receivedAt}
            onChange={onInput}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </section>
      ) : null}

      {step === 3 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
            <p><span className="font-medium">Client:</span> {form.fullName || "-"}</p>
            <p><span className="font-medium">Phone:</span> {form.phone || "-"}</p>
            <p><span className="font-medium">Device:</span> {form.deviceType || "-"}</p>
            <p><span className="font-medium">Model:</span> {form.brand} {form.model}</p>
            <p className="md:col-span-2"><span className="font-medium">Issue:</span> {form.issueDescription || "-"}</p>
          </div>
        </section>
      ) : null}

      <input type="hidden" name="fullName" value={form.fullName} />
      <input type="hidden" name="phone" value={form.phone} />
      <input type="hidden" name="email" value={form.email} />
      <input type="hidden" name="organization" value={form.organization} />
      <input type="hidden" name="deviceType" value={form.deviceType} />
      <input type="hidden" name="brand" value={form.brand} />
      <input type="hidden" name="model" value={form.model} />
      <input type="hidden" name="serialOrImei" value={form.serialOrImei} />
      <input type="hidden" name="accessories" value={form.accessories} />
      <input type="hidden" name="physicalNotes" value={form.physicalNotes} />
      <input type="hidden" name="issueDescription" value={form.issueDescription} />
      <input type="hidden" name="receivedAt" value={form.receivedAt} />

      <div className="flex justify-between">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
          className="btn-premium-secondary rounded-md px-3 py-1.5 text-[13px] disabled:opacity-50 sm:py-2 sm:text-sm"
        >
          Back
        </button>

        {step < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((prev) => Math.min(prev + 1, steps.length - 1))}
            className="btn-premium-dark rounded-md px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm"
          >
            Next
          </button>
        ) : (
          <button
            type="submit"
            disabled={isPending}
            className="btn-premium rounded-md px-3 py-1.5 text-[13px] disabled:opacity-60 sm:py-2 sm:text-sm"
          >
            {isPending ? "Creating..." : "Create Job"}
          </button>
        )}
      </div>
    </form>
  );
}
