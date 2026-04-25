"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";

import { createJobAction } from "@/app/(app)/jobs/new/actions";

const steps = ["Client Info", "Device Info", "Issue", "Review"] as const;

type DeviceDraft = {
  deviceType: string;
  brand: string;
  model: string;
  serialOrImei: string;
  accessories: string;
  physicalNotes: string;
  serviceType: "HARDWARE" | "SOFTWARE" | "BOTH";
  softwareOsInstall: boolean;
  softwareDriversUpdates: boolean;
  softwareDataBackupRestore: boolean;
  softwareAccountSetup: boolean;
  softwarePerformanceTune: boolean;
  softwareThirdPartyApps: boolean;
  softwareRequestedNotes: string;
  softwareLicenseAttested: boolean;
  softwareInstallerSource:
    | ""
    | "CLIENT_PROVIDED_INSTALLER"
    | "CLIENT_ACCOUNT_LOGIN"
    | "COMPANY_LICENSE"
    | "OPEN_SOURCE"
    | "OTHER";
  softwareInstallerSourceNote: string;
  issueDescription: string;
};

function blankDevice(): DeviceDraft {
  return {
    deviceType: "",
    brand: "",
    model: "",
    serialOrImei: "",
    accessories: "",
    physicalNotes: "",
    serviceType: "HARDWARE",
    softwareOsInstall: false,
    softwareDriversUpdates: false,
    softwareDataBackupRestore: false,
    softwareAccountSetup: false,
    softwarePerformanceTune: false,
    softwareThirdPartyApps: false,
    softwareRequestedNotes: "",
    softwareLicenseAttested: false,
    softwareInstallerSource: "",
    softwareInstallerSourceNote: "",
    issueDescription: "",
  };
}

const inputCls =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]/60 focus:ring-2 focus:ring-[var(--accent)]/20 placeholder:text-[var(--ink-muted)]";
const inputErrCls =
  "w-full rounded-lg border border-red-400 bg-red-50/30 px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-300/20 placeholder:text-[var(--ink-muted)]";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-0.5 text-xs text-red-500">{msg}</p>;
}

export function NewJobStepper({ receivedByName }: { receivedByName: string }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    organization: "",
    receivedAt: "",
  });
  const [devices, setDevices] = useState<DeviceDraft[]>([blankDevice()]);
  const [existingClient, setExistingClient] = useState<null | {
    fullName: string;
    email: string | null;
    organization: string | null;
  }>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const receivedBy = useMemo(() => receivedByName, [receivedByName]);

  const touch = (key: string) => setTouched((prev) => ({ ...prev, [key]: true }));
  const isTouched = (key: string) => touched[key] ?? false;

  const clientErrors = {
    fullName: isTouched("fullName") && !form.fullName.trim() ? "Full name is required" : undefined,
    phone: isTouched("phone") && !form.phone.trim() ? "Phone number is required" : undefined,
  };

  function deviceErrors(device: DeviceDraft, idx: number) {
    return {
      deviceType: isTouched(`d${idx}_deviceType`) && !device.deviceType ? "Device type is required" : undefined,
      brand: isTouched(`d${idx}_brand`) && !device.brand.trim() ? "Brand is required" : undefined,
      model: isTouched(`d${idx}_model`) && !device.model.trim() ? "Model is required" : undefined,
      issueDescription: isTouched(`d${idx}_issue`) && !device.issueDescription.trim() ? "Issue description is required" : undefined,
    };
  }

  function validateStep(target: number): boolean {
    if (target <= step) return true;

    if (step === 0) {
      const newTouched: Record<string, boolean> = { fullName: true, phone: true };
      setTouched((prev) => ({ ...prev, ...newTouched }));
      if (!form.fullName.trim() || !form.phone.trim()) return false;
    }

    if (step === 1) {
      const newTouched: Record<string, boolean> = {};
      devices.forEach((_, idx) => {
        newTouched[`d${idx}_deviceType`] = true;
        newTouched[`d${idx}_brand`] = true;
        newTouched[`d${idx}_model`] = true;
      });
      setTouched((prev) => ({ ...prev, ...newTouched }));
      if (devices.some((d) => !d.deviceType || !d.brand.trim() || !d.model.trim())) return false;
    }

    if (step === 2) {
      const newTouched: Record<string, boolean> = {};
      devices.forEach((_, idx) => { newTouched[`d${idx}_issue`] = true; });
      setTouched((prev) => ({ ...prev, ...newTouched }));
      if (devices.some((d) => !d.issueDescription.trim())) return false;
    }

    return true;
  }

  const onInput = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onDeviceInput = (index: number, field: keyof DeviceDraft, value: string) => {
    setDevices((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const onDeviceToggle = (index: number, field: keyof DeviceDraft, checked: boolean) => {
    setDevices((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: checked };
      return next;
    });
  };

  const softwareOptions = [
    ["softwareOsInstall", "OS install / reinstall"],
    ["softwareDriversUpdates", "Drivers + updates"],
    ["softwareDataBackupRestore", "Backup / restore"],
    ["softwareAccountSetup", "Account setup"],
    ["softwarePerformanceTune", "Performance tune"],
    ["softwareThirdPartyApps", "Third-party apps (client-licensed)"],
  ] as const satisfies ReadonlyArray<readonly [
    | "softwareOsInstall"
    | "softwareDriversUpdates"
    | "softwareDataBackupRestore"
    | "softwareAccountSetup"
    | "softwarePerformanceTune"
    | "softwareThirdPartyApps",
    string,
  ]>;

  const missingAttestation = devices.some(
    (d) => d.serviceType !== "HARDWARE" && !d.softwareLicenseAttested,
  );

  const [state, formAction] = useFormState(createJobAction, { error: null });

  useEffect(() => {
    if (!state?.error) return;
    toast.error(state.error);
  }, [state?.error]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (missingAttestation) {
      e.preventDefault();
      toast.error(
        "Software jobs require license attestation. Confirm the client owns valid licenses/subscriptions.",
      );
      setStep(1);
    }
  }

  function SubmitButton() {
    const { pending } = useFormStatus();
    return (
      <button
        type="submit"
        disabled={pending}
        className="btn-premium rounded-lg px-3 py-1.5 text-[13px] disabled:opacity-60 sm:py-2 sm:text-sm"
      >
        {pending ? "Creating…" : "Create Job"}
      </button>
    );
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-4">
      {/* Step tabs */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        {steps.map((label, idx) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(idx)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition sm:py-2 sm:text-sm ${
              idx === step
                ? "bg-[var(--accent)] text-white"
                : idx < step
                  ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "bg-[var(--panel-strong)] text-[var(--ink-muted)]"
            }`}
          >
            {idx + 1}. {label}
          </button>
        ))}
      </div>

      {/* Step 0 — Client Info */}
      {step === 0 ? (
        <section className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 md:grid-cols-2">
          <div className="space-y-0.5">
            <input
              name="fullName"
              value={form.fullName}
              onChange={onInput}
              onBlur={() => touch("fullName")}
              required
              placeholder="Full Name *"
              className={clientErrors.fullName ? inputErrCls : inputCls}
            />
            <FieldError msg={clientErrors.fullName} />
          </div>
          <div className="space-y-0.5">
            <input
              name="phone"
              value={form.phone}
              onChange={onInput}
              onBlur={async () => {
                touch("phone");
                if (form.phone.trim().length < 3) { setExistingClient(null); return; }
                const res = await fetch(`/api/clients/search?phone=${encodeURIComponent(form.phone.trim())}`);
                if (!res.ok) return;
                const data = await res.json();
                setExistingClient(data.client ?? null);
              }}
              required
              placeholder="Phone *"
              className={clientErrors.phone ? inputErrCls : inputCls}
            />
            <FieldError msg={clientErrors.phone} />
          </div>
          <input
            name="email"
            value={form.email}
            onChange={onInput}
            placeholder="Email"
            className={inputCls}
          />
          <input
            name="organization"
            value={form.organization}
            onChange={onInput}
            placeholder="Organization"
            className={inputCls}
          />
          {existingClient ? (
            <p className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/8 px-3 py-2 text-xs text-[var(--accent)] md:col-span-2">
              Existing client found: <strong>{existingClient.fullName}</strong>. Submitting will update this client profile.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Step 1 — Device Info */}
      {step === 1 ? (
        <section className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--ink)]">Devices</p>
            <button
              type="button"
              onClick={() => setDevices((prev) => [...prev, blankDevice()])}
              className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[13px]"
            >
              Add another device
            </button>
          </div>

          <div className="grid gap-3">
            {devices.map((device, idx) => {
              const errs = deviceErrors(device, idx);
              return (
                <div key={idx} className="rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Device {idx + 1}</p>
                    <button
                      type="button"
                      disabled={devices.length === 1}
                      onClick={() => setDevices((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-xs text-[var(--ink-muted)] transition hover:text-red-500 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-0.5">
                      <select
                        value={device.deviceType}
                        onChange={(e) => onDeviceInput(idx, "deviceType", e.target.value)}
                        onBlur={() => touch(`d${idx}_deviceType`)}
                        required
                        className={errs.deviceType ? inputErrCls : inputCls}
                      >
                        <option value="">Device Type *</option>
                        <option value="PHONE_ANDROID">Phone Android</option>
                        <option value="PHONE_IPHONE">Phone iPhone</option>
                        <option value="TABLET">Tablet</option>
                        <option value="WINDOWS_PC">Windows PC</option>
                        <option value="MAC">Mac</option>
                        <option value="OTHER">Other</option>
                      </select>
                      <FieldError msg={errs.deviceType} />
                    </div>
                    <div className="space-y-0.5">
                      <input
                        value={device.brand}
                        onChange={(e) => onDeviceInput(idx, "brand", e.target.value)}
                        onBlur={() => touch(`d${idx}_brand`)}
                        required
                        placeholder="Brand *"
                        className={errs.brand ? inputErrCls : inputCls}
                      />
                      <FieldError msg={errs.brand} />
                    </div>
                    <div className="space-y-0.5">
                      <input
                        value={device.model}
                        onChange={(e) => onDeviceInput(idx, "model", e.target.value)}
                        onBlur={() => touch(`d${idx}_model`)}
                        required
                        placeholder="Model *"
                        className={errs.model ? inputErrCls : inputCls}
                      />
                      <FieldError msg={errs.model} />
                    </div>
                    <input
                      value={device.serialOrImei}
                      onChange={(e) => onDeviceInput(idx, "serialOrImei", e.target.value)}
                      placeholder="Serial / IMEI"
                      className={inputCls}
                    />
                    <textarea
                      value={device.accessories}
                      onChange={(e) => onDeviceInput(idx, "accessories", e.target.value)}
                      placeholder="Accessories"
                      className={`${inputCls} md:col-span-2`}
                    />
                    <textarea
                      value={device.physicalNotes}
                      onChange={(e) => onDeviceInput(idx, "physicalNotes", e.target.value)}
                      placeholder="Physical condition notes"
                      className={`${inputCls} md:col-span-2`}
                    />

                    {/* Service type */}
                    <div className="md:col-span-2 grid gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-[var(--ink)]">Service Type</p>
                          <select
                            value={device.serviceType}
                            onChange={(e) => onDeviceInput(idx, "serviceType", e.target.value)}
                            className={inputCls}
                          >
                            <option value="HARDWARE">Hardware repair</option>
                            <option value="SOFTWARE">Software service only</option>
                            <option value="BOTH">Hardware + software</option>
                          </select>
                        </div>
                        <p className="self-end text-xs leading-5 text-[var(--ink-muted)]">
                          Software work is internal. For paid software, the client must provide valid licenses/accounts.
                        </p>
                      </div>

                      {device.serviceType !== "HARDWARE" ? (
                        <div className="mt-2 grid gap-3">
                          <div className="grid gap-2 md:grid-cols-2">
                            {softwareOptions.map(([key, label]) => (
                              <label key={key} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm cursor-pointer hover:border-[var(--accent)]/30">
                                <input
                                  type="checkbox"
                                  checked={device[key]}
                                  onChange={(e) => onDeviceToggle(idx, key, e.target.checked)}
                                />
                                <span>{label}</span>
                              </label>
                            ))}
                          </div>

                          <textarea
                            value={device.softwareRequestedNotes}
                            onChange={(e) => onDeviceInput(idx, "softwareRequestedNotes", e.target.value)}
                            placeholder="Software notes (optional). Example: 'Install OS + office using client's account'."
                            className={`min-h-20 ${inputCls}`}
                          />

                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-[var(--ink)]">Installer source</p>
                              <select
                                value={device.softwareInstallerSource}
                                onChange={(e) => onDeviceInput(idx, "softwareInstallerSource", e.target.value)}
                                className={inputCls}
                              >
                                <option value="">Select source</option>
                                <option value="CLIENT_PROVIDED_INSTALLER">Client provided installer</option>
                                <option value="CLIENT_ACCOUNT_LOGIN">Client account login</option>
                                <option value="COMPANY_LICENSE">Company license</option>
                                <option value="OPEN_SOURCE">Open-source</option>
                                <option value="OTHER">Other</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-[var(--ink)]">Source note</p>
                              <input
                                value={device.softwareInstallerSourceNote}
                                onChange={(e) => onDeviceInput(idx, "softwareInstallerSourceNote", e.target.value)}
                                placeholder="Optional"
                                className={inputCls}
                              />
                            </div>
                          </div>

                          <label className="flex items-start gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm cursor-pointer hover:border-[var(--accent)]/30">
                            <input
                              type="checkbox"
                              checked={device.softwareLicenseAttested}
                              onChange={(e) => onDeviceToggle(idx, "softwareLicenseAttested", e.target.checked)}
                              className="mt-0.5"
                            />
                            <span>
                              Client confirms they own valid licenses/subscriptions for any paid software requested.
                            </span>
                          </label>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Step 2 — Issue + Photos */}
      {step === 2 ? (
        <section className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="grid gap-3">
            {devices.map((device, idx) => {
              const errs = deviceErrors(device, idx);
              return (
                <div key={idx} className="rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Issue for device {idx + 1}</p>
                  <div className="space-y-0.5">
                    <textarea
                      value={device.issueDescription}
                      onChange={(e) => onDeviceInput(idx, "issueDescription", e.target.value)}
                      onBlur={() => touch(`d${idx}_issue`)}
                      required
                      placeholder="Issue description in client's own words *"
                      className={`min-h-24 ${errs.issueDescription ? inputErrCls : inputCls}`}
                    />
                    <FieldError msg={errs.issueDescription} />
                  </div>
                  <div className="mt-3">
                    <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Before Repair Photos (device {idx + 1})</label>
                    <input name={`photos_${idx}`} type="file" accept="image/png,image/jpeg,image/webp" multiple className="text-sm text-[var(--ink-muted)]" />
                  </div>
                </div>
              );
            })}
          </div>

          <input
            value={receivedBy}
            readOnly
            aria-label="Received by"
            className={`${inputCls} bg-[var(--panel-strong)] opacity-70`}
          />
          <input
            name="receivedAt"
            type="datetime-local"
            value={form.receivedAt}
            onChange={onInput}
            className={inputCls}
          />
        </section>
      ) : null}

      {/* Step 3 — Review */}
      {step === 3 ? (
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="grid gap-2 text-sm text-[var(--ink)] md:grid-cols-2">
            <p><span className="font-medium text-[var(--ink-muted)]">Client:</span> {form.fullName || "—"}</p>
            <p><span className="font-medium text-[var(--ink-muted)]">Phone:</span> {form.phone || "—"}</p>
            {form.email ? <p><span className="font-medium text-[var(--ink-muted)]">Email:</span> {form.email}</p> : null}
            {form.organization ? <p><span className="font-medium text-[var(--ink-muted)]">Org:</span> {form.organization}</p> : null}
          </div>
          <div className="mt-3 grid gap-2">
            {devices.map((d, idx) => (
              <div key={idx} className="rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Device {idx + 1}</p>
                <p className="mt-1 text-sm"><span className="font-medium">Type:</span> {d.deviceType || "—"}</p>
                <p className="text-sm"><span className="font-medium">Model:</span> {[d.brand, d.model].filter(Boolean).join(" ") || "—"}</p>
                {d.serialOrImei ? <p className="text-sm"><span className="font-medium">Serial/IMEI:</span> {d.serialOrImei}</p> : null}
                <p className="mt-2 text-sm"><span className="font-medium">Issue:</span> {d.issueDescription || "—"}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <input type="hidden" name="fullName" value={form.fullName} />
      <input type="hidden" name="phone" value={form.phone} />
      <input type="hidden" name="email" value={form.email} />
      <input type="hidden" name="organization" value={form.organization} />
      <input type="hidden" name="receivedAt" value={form.receivedAt} />
      <input type="hidden" name="devicesJson" value={JSON.stringify(devices)} />

      <div className="flex justify-between">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
          className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[13px] disabled:opacity-50 sm:py-2 sm:text-sm"
        >
          Back
        </button>

        {step < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => {
              if (validateStep(step + 1)) setStep((prev) => Math.min(prev + 1, steps.length - 1));
            }}
            className="btn-premium-dark rounded-lg px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm"
          >
            Next
          </button>
        ) : (
          <SubmitButton />
        )}
      </div>
    </form>
  );
}
