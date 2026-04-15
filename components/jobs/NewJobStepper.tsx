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

  const receivedBy = useMemo(() => receivedByName, [receivedByName]);

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
        className="btn-premium rounded-md px-3 py-1.5 text-[13px] disabled:opacity-60 sm:py-2 sm:text-sm"
      >
        {pending ? "Creating..." : "Create Job"}
      </button>
    );
  }

  return (
      <form action={formAction} onSubmit={onSubmit} className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        {steps.map((label, idx) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(idx)}
            className={`rounded-full px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm ${
              idx === step ? "bg-[#D4AF37] text-white" : "bg-[var(--panel-strong)] text-[var(--ink)]"
            }`}
          >
            {idx + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 ? (
        <section className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 md:grid-cols-2">
          <input name="fullName" value={form.fullName} onChange={onInput} required placeholder="Full Name" className="rounded-md border border-[var(--line)] px-3 py-2" />
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
            className="rounded-md border border-[var(--line)] px-3 py-2"
          />
          <input name="email" value={form.email} onChange={onInput} placeholder="Email" className="rounded-md border border-[var(--line)] px-3 py-2" />
          <input name="organization" value={form.organization} onChange={onInput} placeholder="Organization" className="rounded-md border border-[var(--line)] px-3 py-2" />
          {existingClient ? (
            <p className="text-xs text-[#D4AF37] md:col-span-2">
              Existing client found by phone: {existingClient.fullName}. Submitting will update this client profile.
            </p>
          ) : null}
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--ink)]">Devices</p>
            <button
              type="button"
              onClick={() => setDevices((prev) => [...prev, blankDevice()])}
              className="btn-premium-secondary rounded-md px-3 py-1.5 text-[13px]"
            >
              Add another device
            </button>
          </div>

          <div className="grid gap-3">
            {devices.map((device, idx) => (
              <div key={idx} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Device {idx + 1}</p>
                  <button
                    type="button"
                    disabled={devices.length === 1}
                    onClick={() => setDevices((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-xs text-black disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    value={device.deviceType}
                    onChange={(e) => onDeviceInput(idx, "deviceType", e.target.value)}
                    required
                    className="rounded-md border border-[var(--line)] px-3 py-2"
                  >
                    <option value="">Device Type</option>
                    <option value="PHONE_ANDROID">Phone Android</option>
                    <option value="PHONE_IPHONE">Phone iPhone</option>
                    <option value="TABLET">Tablet</option>
                    <option value="WINDOWS_PC">Windows PC</option>
                    <option value="MAC">Mac</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <input
                    value={device.brand}
                    onChange={(e) => onDeviceInput(idx, "brand", e.target.value)}
                    required
                    placeholder="Brand"
                    className="rounded-md border border-[var(--line)] px-3 py-2"
                  />
                  <input
                    value={device.model}
                    onChange={(e) => onDeviceInput(idx, "model", e.target.value)}
                    required
                    placeholder="Model"
                    className="rounded-md border border-[var(--line)] px-3 py-2"
                  />
                  <input
                    value={device.serialOrImei}
                    onChange={(e) => onDeviceInput(idx, "serialOrImei", e.target.value)}
                    placeholder="Serial / IMEI"
                    className="rounded-md border border-[var(--line)] px-3 py-2"
                  />
                  <textarea
                    value={device.accessories}
                    onChange={(e) => onDeviceInput(idx, "accessories", e.target.value)}
                    placeholder="Accessories"
                    className="rounded-md border border-[var(--line)] px-3 py-2 md:col-span-2"
                  />
                  <textarea
                    value={device.physicalNotes}
                    onChange={(e) => onDeviceInput(idx, "physicalNotes", e.target.value)}
                    placeholder="Physical notes"
                    className="rounded-md border border-[var(--line)] px-3 py-2 md:col-span-2"
                  />

                  <div className="md:col-span-2 grid gap-2 rounded-lg border border-[var(--line)] bg-white p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-[var(--ink)]">Service Type</p>
                        <select
                          value={device.serviceType}
                          onChange={(e) => onDeviceInput(idx, "serviceType", e.target.value)}
                          className="w-full rounded-md border border-[var(--line)] px-3 py-2"
                        >
                          <option value="HARDWARE">Hardware repair</option>
                          <option value="SOFTWARE">Software service only</option>
                          <option value="BOTH">Hardware + software</option>
                        </select>
                      </div>
                      <div className="text-xs text-[var(--ink-muted)] leading-5">
                        Software work is internal. For paid software, the client must provide valid licenses/accounts.
                      </div>
                    </div>

                    {device.serviceType !== "HARDWARE" ? (
                        <div className="mt-2 grid gap-3">
                          <div className="grid gap-2 md:grid-cols-2">
                          {softwareOptions.map(([key, label]) => (
                            <label key={key} className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm">
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
                          className="min-h-20 w-full rounded-md border border-[var(--line)] px-3 py-2"
                        />

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Installer source</p>
                            <select
                              value={device.softwareInstallerSource}
                              onChange={(e) => onDeviceInput(idx, "softwareInstallerSource", e.target.value)}
                              className="w-full rounded-md border border-[var(--line)] px-3 py-2"
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
                            <p className="text-sm font-medium">Source note</p>
                            <input
                              value={device.softwareInstallerSourceNote}
                              onChange={(e) => onDeviceInput(idx, "softwareInstallerSourceNote", e.target.value)}
                              placeholder="Optional"
                              className="w-full rounded-md border border-[var(--line)] px-3 py-2"
                            />
                          </div>
                        </div>

                        <label className="flex items-start gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={device.softwareLicenseAttested}
                            onChange={(e) => onDeviceToggle(idx, "softwareLicenseAttested", e.target.checked)}
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
            ))}
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="grid gap-3">
            {devices.map((device, idx) => (
              <div key={idx} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Issue for device {idx + 1}</p>
                <textarea
                  value={device.issueDescription}
                  onChange={(e) => onDeviceInput(idx, "issueDescription", e.target.value)}
                  required
                  placeholder="Issue description in client's words"
                  className="mt-2 min-h-24 w-full rounded-md border border-[var(--line)] px-3 py-2"
                />
                <div className="mt-2">
                  <label className="mb-1 block text-sm font-medium">Before Repair Photos (device {idx + 1})</label>
                  <input name={`photos_${idx}`} type="file" accept="image/png,image/jpeg,image/webp" multiple />
                </div>
              </div>
            ))}
          </div>

          <input
            value={receivedBy}
            readOnly
            aria-label="Received by"
            className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-[var(--ink)]"
          />
          <input
            name="receivedAt"
            type="datetime-local"
            value={form.receivedAt}
            onChange={onInput}
            className="rounded-md border border-[var(--line)] px-3 py-2"
          />
        </section>
      ) : null}

      {step === 3 ? (
        <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="grid gap-2 text-sm text-[var(--ink)] md:grid-cols-2">
            <p><span className="font-medium">Client:</span> {form.fullName || "-"}</p>
            <p><span className="font-medium">Phone:</span> {form.phone || "-"}</p>
          </div>
          <div className="mt-3 grid gap-2">
            {devices.map((d, idx) => (
              <div key={idx} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Device {idx + 1}</p>
                <p className="mt-1 text-sm"><span className="font-medium">Type:</span> {d.deviceType || "-"}</p>
                <p className="text-sm"><span className="font-medium">Model:</span> {d.brand} {d.model}</p>
                <p className="text-sm"><span className="font-medium">Serial/IMEI:</span> {d.serialOrImei || "-"}</p>
                <p className="mt-2 text-sm"><span className="font-medium">Issue:</span> {d.issueDescription || "-"}</p>
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
          <SubmitButton />
        )}
      </div>
    </form>
  );
}
