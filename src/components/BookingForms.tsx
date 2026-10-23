"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { cancellationSchema, findBookingSchema, fieldErrors } from "@/lib/schemas";
import { Field, FieldError, Turnstile } from "./forms";

export function CancelRequest({ reference }: { reference: string }) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = cancellationSchema.safeParse({ reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]!.message);
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/bookings/${reference}/cancellation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.fields?.reason ?? data.error ?? "We couldn't send your request. Try again.");
      return;
    }
    router.refresh();
  };

  if (!open) {
    return (
      <button type="button" className="btn btn-dark" onClick={() => setOpen(true)}>
        Request cancellation
      </button>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="max-w-xl">
      <label htmlFor={id} className="meta block">
        Why do you want to cancel?
      </label>
      <p className="text-[13px] text-muted">Requests are reviewed under the Refund and Cancellation Policy. Nothing is refunded automatically.</p>
      <textarea
        id={id}
        name="reason"
        rows={4}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        className="field mt-2 resize-y"
      />
      {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className="btn btn-dark">
          {busy ? "Sending…" : "Send request"}
        </button>
        <button type="button" className="btn btn-dark" onClick={() => setOpen(false)}>
          Keep my booking
        </button>
      </div>
    </form>
  );
}

export function FindBookingForm({ expired }: { expired: boolean }) {
  const [email, setEmail] = useState("");
  const [reference, setReference] = useState("");
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = findBookingSchema.safeParse({ email, reference, turnstileToken: token });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    const res = await fetch("/api/booking-access/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErrors(data.fields ?? { form: data.error ?? "Something went wrong. Try again." });
      setReset((n) => n + 1);
      return;
    }
    setDone(data.message);
  };

  if (done) {
    return (
      <div role="status" className="rounded-sm border border-gold-deep p-6 md:p-8">
        <p className="display text-[28px] text-gold-deep">Check your inbox</p>
        <p className="mt-3">{done}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-xl space-y-5">
      {expired && (
        <p role="alert" className="text-gold-deep">
          That link has expired or was already used. Request a new one below.
        </p>
      )}
      <Field label="Email used for the booking" name="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={setEmail} error={errors.email} />
      <Field label="Booking reference" name="reference" autoComplete="off" hint="Starts with BTL26-, e.g. BTL26-7F3K9Q" value={reference} onChange={(v) => setReference(v.toUpperCase())} error={errors.reference} />
      <Turnstile onToken={setToken} resetKey={reset} error={errors.turnstileToken} />
      {errors.form && (
        <p role="alert" className="text-gold-deep">
          {errors.form}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn btn-leaf">
        {busy ? "Sending…" : "Email me a link"}
      </button>
    </form>
  );
}
