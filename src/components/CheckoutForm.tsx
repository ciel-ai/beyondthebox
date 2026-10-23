"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { computePrice, formatPaise, formatRate, type PricingConfig } from "@/lib/pricing";
import { createBookingSchema, fieldErrors, type TierCodeValue } from "@/lib/schemas";
import { Field, FieldError, Turnstile } from "./forms";

type Person = { name: string; email: string; phone: string };
const empty = (): Person => ({ name: "", email: "", phone: "" });

export function CheckoutForm({
  tier,
  qty,
  pricing,
}: {
  tier: { code: TierCodeValue; name: string; pricePaise: number };
  qty: number;
  pricing: PricingConfig;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [buyer, setBuyer] = useState<Person>(empty());
  const [business, setBusiness] = useState(false);
  const [company, setCompany] = useState("");
  const [gstin, setGstin] = useState("");
  const [buyerAttends, setBuyerAttends] = useState(true);
  const [attendees, setAttendees] = useState<Person[]>(Array.from({ length: qty }, empty));
  const [token, setToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const price = computePrice(tier.pricePaise, qty, pricing);
  const people = attendees.map((a, i) => (i === 0 && buyerAttends ? buyer : a));

  const setPerson = (i: number, k: keyof Person, v: string) => setAttendees((list) => list.map((p, j) => (j === i ? { ...p, [k]: v } : p)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    const payload = {
      tier: tier.code,
      quantity: qty,
      buyer: { ...buyer, company: business ? company : "", gstin: business ? gstin : "" },
      attendees: people,
      turnstileToken: token,
    };
    const parsed = createBookingSchema.safeParse(payload);
    if (!parsed.success) {
      const f = fieldErrors(parsed.error);
      setErrors(f);
      focusFirst(f);
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push(`/checkout/${data.reference}/review`);
        return;
      }
      if (data.fields) {
        setErrors(data.fields);
        focusFirst(data.fields);
      }
      setBanner(data.error ?? "We couldn't save your details. Try again.");
      setTurnstileReset((n) => n + 1);
    } catch {
      setBanner("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const focusFirst = (f: Record<string, string>) => {
    const first = Object.keys(f)[0];
    if (!first) return;
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus());
  };

  const e = (k: string) => errors[k];

  return (
    <form ref={formRef} noValidate onSubmit={submit} className="grid-12 gap-y-12">
      <div className="col-span-12 space-y-12 lg:col-span-7">
        <fieldset>
          <legend><h2 className="display text-[32px]">Your details</h2></legend>
          <p className="meta mt-2 text-muted">We send the tickets and receipt here.</p>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label="Full name" name="buyer.name" autoComplete="name" value={buyer.name} onChange={(v) => setBuyer({ ...buyer, name: v })} error={e("buyer.name")} />
            </div>
            <Field label="Email" name="buyer.email" type="email" inputMode="email" autoComplete="email" value={buyer.email} onChange={(v) => setBuyer({ ...buyer, email: v })} error={e("buyer.email")} />
            <Field label="Mobile number" name="buyer.phone" type="tel" inputMode="tel" autoComplete="tel" hint="10 digits, or with country code" value={buyer.phone} onChange={(v) => setBuyer({ ...buyer, phone: v })} error={e("buyer.phone")} />
          </div>

          <label className="mt-6 flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" checked={business} onChange={(ev) => setBusiness(ev.target.checked)} className="h-5 w-5 accent-[#DDBB4B]" />
            <span>I need a GST invoice for my company</span>
          </label>
          {business && (
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <Field label="Company name" name="buyer.company" autoComplete="organization" value={company} onChange={setCompany} error={e("buyer.company")} />
              <Field label="GSTIN" name="buyer.gstin" autoComplete="off" hint="15 characters, e.g. 29ABCDE1234F1Z5" value={gstin} onChange={(v) => setGstin(v.toUpperCase())} error={e("buyer.gstin")} required={false} />
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend><h2 className="display text-[32px]">Attendees</h2></legend>
          <p className="meta mt-2 text-muted">Each attendee gets their own e-ticket with a QR code.</p>
          {e("attendees") && <FieldError id="attendees-err">{e("attendees")}</FieldError>}
          <div className="mt-6 space-y-8">
            {attendees.map((a, i) => (
              <div key={i} className="rounded-sm border border-hairline p-5 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="ui">Ticket {i + 1}</h3>
                  {i === 0 && (
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
                      <input type="checkbox" checked={buyerAttends} onChange={(ev) => setBuyerAttends(ev.target.checked)} className="h-5 w-5 accent-[#DDBB4B]" />
                      I&apos;m attending (use my details)
                    </label>
                  )}
                </div>
                {i === 0 && buyerAttends ? (
                  <p className="meta mt-3 text-muted">{buyer.name || "Your name"} will be on this ticket.</p>
                ) : (
                  <div className="mt-4 grid gap-5 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <Field label="Full name" name={`attendees.${i}.name`} autoComplete={`section-attendee${i + 1} name`} value={a.name} onChange={(v) => setPerson(i, "name", v)} error={e(`attendees.${i}.name`)} />
                    </div>
                    <Field label="Email" name={`attendees.${i}.email`} type="email" inputMode="email" autoComplete={`section-attendee${i + 1} email`} value={a.email} onChange={(v) => setPerson(i, "email", v)} error={e(`attendees.${i}.email`)} />
                    <Field label="Mobile number" name={`attendees.${i}.phone`} type="tel" inputMode="tel" autoComplete={`section-attendee${i + 1} tel`} value={a.phone} onChange={(v) => setPerson(i, "phone", v)} error={e(`attendees.${i}.phone`)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </fieldset>
      </div>

      <aside className="col-span-12 lg:col-span-4 lg:col-start-9" aria-label="Order summary">
        <div className="rounded-sm border border-hairline bg-surface p-6 lg:sticky lg:top-28">
          <h2 className="display text-[28px]">Order: {tier.name}</h2>
          <dl className="mt-5 space-y-3 text-[15px]">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">
                {formatPaise(tier.pricePaise, { whole: true })} × {qty}
              </dt>
              <dd className="tnum">{formatPaise(price.subtotalPaise)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">GST ({formatRate(pricing.gstRateBps)})</dt>
              <dd className="tnum">{formatPaise(price.taxPaise + price.feeTaxPaise)}</dd>
            </div>
            {price.feePaise > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Convenience fee</dt>
                <dd className="tnum">{formatPaise(price.feePaise)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t border-hairline pt-3 text-[18px] font-bold">
              <dt>Total</dt>
              <dd className="tnum text-gold-deep">{formatPaise(price.totalPaise)}</dd>
            </div>
          </dl>
          <p className="meta mt-4 text-muted">Seats are held for 15 minutes once you continue.</p>
          <div className="mt-6">
            <Turnstile onToken={setToken} resetKey={turnstileReset} error={e("turnstileToken")} />
          </div>
          {banner && (
            <p role="alert" className="mt-4 text-[15px] text-gold-deep">
              {banner}
            </p>
          )}
          <button type="submit" disabled={sending} className="btn btn-leaf mt-6 w-full">
            {sending ? "Holding your seats…" : "Continue to review"}
          </button>
        </div>
      </aside>
    </form>
  );
}
