"use client";

import { useState } from "react";

// Labels are what the customer reads; the values are the DeviceType enum and
// must not change. Kept short so the row of choices stays scannable.
const DEVICE_TYPES = [
  { value: "PHONE_ANDROID", label: "Android" },
  { value: "PHONE_IPHONE",  label: "iPhone" },
  { value: "TABLET",        label: "Tablet" },
  { value: "WINDOWS_PC",    label: "Windows" },
  { value: "MAC",           label: "Mac" },
  { value: "OTHER",         label: "Other" },
];

const HANDOVER_OPTIONS = [
  {
    value: "SELF_DROPOFF",
    label: "Walk in / Drop off",
    desc: "Come to our shop",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    value: "SEND_WITH_DELIVERY_PERSON",
    label: "Send via delivery person",
    desc: "We receive from your courier",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden>
        <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
  },
  {
    value: "REQUEST_PICKUP",
    label: "Request a pickup",
    desc: "We come to you in Kampala",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden>
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
      </svg>
    ),
  },
];

type Step = "form" | "success";
/** Which pane of the slip is showing. Purely presentational: every field
 *  stays in `data`, so the submitted payload is identical whatever is visible. */
type Pane = 1 | 2 | 3;

interface FormData {
  customer_name: string;
  phone: string;
  email: string;
  device_type: string;
  brand: string;
  model: string;
  problem_description: string;
  handover_method: string;
  preferred_dropoff_date: string;
  pickup_address: string;
  preferred_pickup_date: string;
  delivery_person_name: string;
  delivery_person_phone: string;
  _hp: string; // honeypot
}

const empty: FormData = {
  customer_name: "", phone: "", email: "",
  device_type: "", brand: "", model: "",
  problem_description: "", handover_method: "SELF_DROPOFF",
  preferred_dropoff_date: "", pickup_address: "", preferred_pickup_date: "",
  delivery_person_name: "", delivery_person_phone: "",
  _hp: "",
};

interface RepairRequestFormProps {
  /** Org slug to scope the request. Omit for the default EIS form. */
  orgSlug?: string;
  /** Company name shown in success message. Defaults to "Eagle Info Solutions". */
  companyName?: string;
  /** WhatsApp number for the success CTA, e.g. "256772006344". */
  whatsappNumber?: string;
}

export function RepairRequestForm({ orgSlug, companyName = "Eagle Info Solutions", whatsappNumber = "256772006344" }: RepairRequestFormProps) {
  const [step, setStep]       = useState<Step>("form");
  const [pane, setPane]       = useState<Pane>(1);
  const [data, setData]       = useState<FormData>(empty);
  const [errors, setErrors]   = useState<string[]>([]);
  const [busy, setBusy]       = useState(false);
  const [requestNum, setRequestNum] = useState("");

  function set(field: keyof FormData, value: string) {
    setData((d) => ({ ...d, [field]: value }));
    setErrors([]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // honeypot filled → silently pretend success (bot)
    if (data._hp) { setStep("success"); setRequestNum("REQ-" + Date.now()); return; }

    setBusy(true);
    setErrors([]);
    try {
      const res = await fetch("/api/repair-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: data.customer_name,
          phone: data.phone,
          email: data.email || undefined,
          device_type: data.device_type,
          brand: data.brand,
          model: data.model || undefined,
          problem_description: data.problem_description,
          handover_method: data.handover_method,
          preferred_dropoff_date: data.handover_method === "SELF_DROPOFF" ? data.preferred_dropoff_date : undefined,
          pickup_address: data.handover_method === "REQUEST_PICKUP" ? data.pickup_address : undefined,
          // Required by POST /api/repair-requests for this handover method.
          preferred_pickup_date: data.handover_method === "REQUEST_PICKUP" ? data.preferred_pickup_date : undefined,
          delivery_person_name: data.handover_method === "SEND_WITH_DELIVERY_PERSON" ? data.delivery_person_name : undefined,
          delivery_person_phone: data.handover_method === "SEND_WITH_DELIVERY_PERSON" ? data.delivery_person_phone : undefined,
          ...(orgSlug ? { org_slug: orgSlug } : {}),
          _hp: "",
        }),
      });

      const json = await res.json();
      if (res.ok && json.success !== false) {
        setRequestNum(json.request_number ?? json.requestNumber ?? "");
        setStep("success");
      } else {
        setErrors(json.errors ?? [json.error ?? "Something went wrong. Please try again."]);
      }
    } catch {
      setErrors(["Network error. Please check your connection and try again."]);
    } finally {
      setBusy(false);
    }
  }

  if (step === "success") {
    // Rendered inside the bone slip on the landing page, so this is ink on
    // paper too — a stamped receipt rather than a dark success toast.
    return (
      <div>
        <div className="flex items-baseline justify-between gap-3 border-b-2 border-[#221E17] pb-2.5">
          <h2 className="text-[23px] font-bold uppercase leading-none text-[#221E17]">
            Booked in
          </h2>
          {requestNum && (
            <p className="mono shrink-0 text-[13px] font-semibold text-[#6A6154]">{requestNum}</p>
          )}
        </div>

        <p className="mt-4 text-[16px] leading-relaxed text-[#221E17]">
          Thank you{data.customer_name ? `, ${data.customer_name.split(" ")[0]}` : ""}. We have your
          device details{requestNum ? <> under <b className="font-semibold">{requestNum}</b></> : null}.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-[#6A6154]">
          Someone from the counter will be in touch shortly with a written quote and the timeline.
          Nothing gets opened until you approve the price.
        </p>

        {/* The stamp — the promise, pressed onto the receipt */}
        <div className="mt-5 inline-block -rotate-[6deg] border-[2.5px] border-[#A87A1E] px-3.5 pb-1.5 pt-2 leading-[0.95] tracking-[0.05em] text-[#A87A1E] opacity-90">
          <b className="block font-cond text-[21px] font-bold uppercase">Quote before work</b>
          <span className="mono block text-[10.5px] tracking-[0.1em]">{companyName}</span>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank" rel="noreferrer"
            className="rounded-[0.625rem] bg-[#221E17] px-5 py-3 font-cond text-[17px] font-bold uppercase tracking-[0.04em] text-[#EDE6D6] transition-colors hover:bg-[#0B0A08]"
          >
            Message us on WhatsApp
          </a>
          <button
            type="button"
            onClick={() => { setStep("form"); setPane(1); setData(empty); setRequestNum(""); }}
            className="text-[14px] text-[#6A6154] underline underline-offset-4 transition-colors hover:text-[#221E17]"
          >
            Book another device
          </button>
        </div>
      </div>
    );
  }

  // ── Paper-slip palette ────────────────────────────────────────────────────
  // The form sits on bone stock on a dark counter (see app/page.tsx), so it is
  // ink-on-paper rather than the app's light-on-dark.
  const inputCls =
    "w-full border-b-[1.5px] border-[#C4B99F] bg-transparent px-0.5 py-1.5 text-[16px] text-[#221E17] outline-none transition placeholder:text-[#8A806E] focus:border-[#221E17]";
  const labelCls =
    "mb-1.5 block text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#5F574A]";
  const optionCls =
    "flex min-h-11 cursor-pointer select-none items-center justify-center rounded-[0.625rem] border px-1 text-center text-[14px] font-medium leading-tight transition";

  /** Which fields each pane needs before it will let you move on. The server
   *  validates the whole payload regardless — this only avoids a pointless
   *  round trip and a scroll back up the slip. */
  function missingOn(p: Pane): string[] {
    const gaps: string[] = [];
    if (p === 1) {
      if (!data.device_type) gaps.push("Choose what kind of device it is.");
      if (!data.brand.trim()) gaps.push("Tell us the make — Samsung, Apple, HP…");
      if (!data.problem_description.trim()) gaps.push("Describe what it's doing.");
    }
    if (p === 2) {
      if (!data.customer_name.trim()) gaps.push("We need a name to put on the job.");
      if (!data.phone.trim()) gaps.push("We need a phone number to send the quote to.");
    }
    if (p === 3) {
      if (!data.handover_method) gaps.push("Choose how the device gets to us.");
      if (data.handover_method === "SELF_DROPOFF" && !data.preferred_dropoff_date)
        gaps.push("Pick the day you'll bring it in.");
      if (data.handover_method === "REQUEST_PICKUP" && !data.pickup_address.trim())
        gaps.push("Where should we collect it?");
      if (data.handover_method === "REQUEST_PICKUP" && !data.preferred_pickup_date)
        gaps.push("Pick the day we should collect it.");
      if (data.handover_method === "SEND_WITH_DELIVERY_PERSON"
        && (!data.delivery_person_name.trim() || !data.delivery_person_phone.trim()))
        gaps.push("Give us the courier's name and number.");
    }
    return gaps;
  }

  function next() {
    const gaps = missingOn(pane);
    if (gaps.length) { setErrors(gaps); return; }
    setErrors([]);
    setPane((p) => (p === 1 ? 2 : 3));
  }

  function back() {
    setErrors([]);
    setPane((p) => (p === 3 ? 2 : 1));
  }

  const PANES: Array<{ n: Pane; title: string; hint: string }> = [
    { n: 1, title: "What needs fixing?", hint: "Next: how to reach you, then how it gets to us." },
    { n: 2, title: "How do we reach you?", hint: "One more step: getting the device to us." },
    { n: 3, title: "Getting it to us", hint: "We reply on WhatsApp with a written quote." },
  ];
  const current = PANES[pane - 1];

  return (
    <form onSubmit={submit} noValidate>
      {/* honeypot — hidden from users, visible to bots */}
      <input
        type="text" name="_hp" value={data._hp}
        onChange={(e) => set("_hp", e.target.value)}
        tabIndex={-1} aria-hidden="true"
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
        autoComplete="off"
      />

      {/* Progress: three rules, filled as you go */}
      <div className="flex gap-1.5" aria-hidden="true">
        {PANES.map((p) => (
          <span
            key={p.n}
            className={`h-[3px] flex-1 ${p.n <= pane ? "bg-[#221E17]" : "bg-[#C4B99F]"}`}
          />
        ))}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3 border-b-2 border-[#221E17] pb-2.5">
        <h2 className="text-[23px] font-bold uppercase leading-none text-[#221E17]">
          {current.title}
        </h2>
        <p className="shrink-0 text-[11.5px] uppercase tracking-[0.08em] text-[#6A6154]">
          Step {pane} of 3
        </p>
      </div>

      {errors.length > 0 && (
        <div role="alert" className="mt-4 border-l-[3px] border-[#B4342A] bg-[#B4342A]/8 px-3 py-2.5">
          {errors.map((e) => (
            <p key={e} className="text-[14px] text-[#8E2A22]">{e}</p>
          ))}
        </div>
      )}

      {/* ── Pane 1: the device ── */}
      {pane === 1 && (
        <>
          <fieldset className="mt-4">
            <legend className={labelCls}>What is it?</legend>
            <div className="grid grid-cols-3 gap-1.5">
              {DEVICE_TYPES.map((d) => {
                const on = data.device_type === d.value;
                return (
                  <label
                    key={d.value}
                    className={`${optionCls} ${on
                      ? "border-[#221E17] bg-[#221E17] text-white shadow-[0_1px_2px_rgba(34,30,23,0.25)]"
                      : "border-[#8A7E64] bg-white text-[#3B352A] hover:border-[#5F574A]"}`}
                  >
                    <input
                      type="radio" name="device_type" value={d.value} checked={on}
                      onChange={(e) => set("device_type", e.target.value)} className="sr-only"
                    />
                    {d.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="rr-brand">Make</label>
              <input
                id="rr-brand" value={data.brand} onChange={(e) => set("brand", e.target.value)}
                placeholder="Samsung, Apple" className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="rr-model">
                Model <span className="font-normal normal-case tracking-normal">(if you know it)</span>
              </label>
              <input
                id="rr-model" value={data.model} onChange={(e) => set("model", e.target.value)}
                placeholder="Galaxy S21…" className={inputCls}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className={labelCls} htmlFor="rr-problem">What&apos;s it doing?</label>
            <textarea
              id="rr-problem" rows={3} value={data.problem_description}
              onChange={(e) => set("problem_description", e.target.value)}
              placeholder="Screen cracked, won't charge, very slow…"
              className={`${inputCls} resize-none`}
            />
          </div>
        </>
      )}

      {/* ── Pane 2: reaching you ── */}
      {pane === 2 && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="rr-name">Your name</label>
              <input
                id="rr-name" value={data.customer_name} autoComplete="name"
                onChange={(e) => set("customer_name", e.target.value)}
                placeholder="Sarah Namutebi" className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="rr-phone">Phone number</label>
              <input
                id="rr-phone" type="tel" value={data.phone} autoComplete="tel"
                onChange={(e) => set("phone", e.target.value)}
                placeholder="07xx xxx xxx" className={inputCls}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className={labelCls} htmlFor="rr-email">
              Email <span className="font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id="rr-email" type="email" value={data.email} autoComplete="email"
              onChange={(e) => set("email", e.target.value)}
              placeholder="you@example.com" className={inputCls}
            />
          </div>
          <p className="mt-3 text-[13px] leading-snug text-[#6A6154]">
            The quote comes by WhatsApp to the number above, usually within a few hours.
          </p>
        </>
      )}

      {/* ── Pane 3: getting it to us ── */}
      {pane === 3 && (
        <>
          <fieldset className="mt-4">
            <legend className={labelCls}>How does it get to us?</legend>
            <div className="flex flex-col gap-2">
              {HANDOVER_OPTIONS.map((opt) => {
                const on = data.handover_method === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-baseline gap-3 rounded-[0.625rem] border bg-white px-3.5 py-3 transition ${on
                      ? "border-[#221E17] shadow-[0_0_0_1px_#221E17]"
                      : "border-[#8A7E64] hover:border-[#5F574A]"}`}
                  >
                    <input
                      type="radio" name="handover_method" value={opt.value} checked={on}
                      onChange={(e) => set("handover_method", e.target.value)} className="sr-only"
                    />
                    <span className={`mt-0.5 h-3.5 w-3.5 shrink-0 border-[1.5px] ${on
                      ? "border-[#221E17] bg-[#221E17]" : "border-[#8A806E]"}`} aria-hidden="true" />
                    <span>
                      <span className="block text-[15px] font-semibold text-[#221E17]">{opt.label}</span>
                      <span className="block text-[13px] text-[#6A6154]">{opt.desc}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {data.handover_method === "SELF_DROPOFF" && (
            <div className="mt-4">
              <label className={labelCls} htmlFor="rr-date">Which day will you bring it?</label>
              <input
                id="rr-date" type="date" value={data.preferred_dropoff_date}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => set("preferred_dropoff_date", e.target.value)}
                className={inputCls}
              />
            </div>
          )}

          {data.handover_method === "REQUEST_PICKUP" && (
            <div className="mt-4">
              <label className={labelCls} htmlFor="rr-addr">Where do we collect it?</label>
              <input
                id="rr-addr" value={data.pickup_address}
                onChange={(e) => set("pickup_address", e.target.value)}
                placeholder="Address or nearest landmark in Kampala" className={inputCls}
              />
              <div className="mt-4">
                <label className={labelCls} htmlFor="rr-pickdate">Which day should we come?</label>
                <input
                  id="rr-pickdate" type="date" value={data.preferred_pickup_date}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => set("preferred_pickup_date", e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {data.handover_method === "SEND_WITH_DELIVERY_PERSON" && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="rr-dpn">Courier&apos;s name</label>
                <input
                  id="rr-dpn" value={data.delivery_person_name}
                  onChange={(e) => set("delivery_person_name", e.target.value)}
                  placeholder="Who's bringing it" className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="rr-dpp">Courier&apos;s phone</label>
                <input
                  id="rr-dpp" type="tel" value={data.delivery_person_phone}
                  onChange={(e) => set("delivery_person_phone", e.target.value)}
                  placeholder="07xx xxx xxx" className={inputCls}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Move through the slip ── */}
      <div className="mt-6 flex items-center gap-3">
        {pane > 1 && (
          <button
            type="button" onClick={back}
            className="rounded-[0.625rem] border border-[#8A7E64] px-4 py-3 font-cond text-[17px] font-bold uppercase tracking-[0.04em] text-[#5D5548] transition-colors hover:border-[#221E17] hover:text-[#221E17]"
          >
            Back
          </button>
        )}
        {pane < 3 ? (
          <button
            type="button" onClick={next}
            className="flex-1 rounded-[0.625rem] bg-[#221E17] px-4 py-3.5 font-cond text-[19px] font-bold uppercase tracking-[0.05em] text-[#EDE6D6] transition-colors hover:bg-[#0B0A08]"
          >
            Continue
          </button>
        ) : (
          <button
            type="submit" disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-[0.625rem] bg-[#221E17] px-4 py-3.5 font-cond text-[19px] font-bold uppercase tracking-[0.05em] text-[#EDE6D6] transition-colors hover:bg-[#0B0A08] disabled:opacity-60"
          >
            {busy ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Sending…
              </>
            ) : "Send it in"}
          </button>
        )}
      </div>
      <p className="mt-3 text-[13px] leading-snug text-[#6A6154]">{current.hint}</p>
    </form>
  );
}
