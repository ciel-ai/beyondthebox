"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useEffect, useId, useState } from "react";
import { FieldError } from "./forms";

type CheckoutParams = {
  provider: "razorpay" | "fake";
  key: string;
  orderId: string;
  amountPaise: number;
  currency: "INR";
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
};

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, cb: (r: unknown) => void) => void };
  }
}

/** Terms consent + "Pay". The success callback only asks the server to verify; it never confirms anything. */
export function PayButton({ reference, label = "Pay securely" }: { reference: string; label?: string }) {
  const router = useRouter();
  const id = useId();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sdk, setSdk] = useState(false);

  useEffect(() => setSdk(!!window.Razorpay), []);

  const verify = async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
    const res = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "We couldn't verify the payment. You have not been charged.");
      setBusy(false);
      return;
    }
    router.push(`/booking/${reference}`);
  };

  const pay = async () => {
    setError(null);
    if (!agreed) {
      setConsentError("Tick the box to agree to the Terms and the Refund Policy.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/bookings/${reference}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ termsAccepted: true }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "We couldn't start the payment. Try again.");
      setBusy(false);
      if (res.status === 409) router.refresh();
      return;
    }
    const c = data.checkout as CheckoutParams;
    if (c.provider === "fake") {
      router.push(`/dev/checkout?order=${encodeURIComponent(c.orderId)}&ref=${reference}&amount=${c.amountPaise}`);
      return;
    }
    if (!window.Razorpay) {
      setError("The payment window didn't load. Check your connection and try again.");
      setBusy(false);
      return;
    }
    const rzp = new window.Razorpay({
      key: c.key,
      order_id: c.orderId,
      amount: c.amountPaise,
      currency: c.currency,
      name: c.name,
      description: c.description,
      prefill: c.prefill,
      theme: { color: "#DDBB4B" },
      handler: verify,
      modal: {
        ondismiss: () => {
          setBusy(false);
          setError("Payment window closed. Your seats stay held until the timer runs out, so you can try again.");
        },
      },
    });
    rzp.on("payment.failed", () => setError("That payment didn't go through. You can try again or use another method."));
    rzp.open();
  };

  return (
    <div>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" onReady={() => setSdk(true)} />
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => {
            setAgreed(e.target.checked);
            if (e.target.checked) setConsentError(null);
          }}
          aria-invalid={consentError ? true : undefined}
          aria-describedby={consentError ? `${id}-err` : undefined}
          className="mt-1 h-5 w-5 shrink-0 accent-[#DDBB4B]"
        />
        <span className="text-[15px]">
          I agree to the{" "}
          <Link href="/terms" target="_blank" className="link-u">
            Terms and Conditions
          </Link>{" "}
          and the{" "}
          <Link href="/refund-policy" target="_blank" className="link-u">
            Refund and Cancellation Policy
          </Link>
          .
        </span>
      </label>
      {consentError && <FieldError id={`${id}-err`}>{consentError}</FieldError>}
      {error && (
        <p role="alert" className="mt-4 text-[15px] text-gold-deep">
          {error}
        </p>
      )}
      <button type="button" onClick={pay} disabled={busy} className="btn btn-leaf mt-6 w-full">
        {busy ? "Opening secure payment…" : label}
      </button>
      <p className="meta mt-3 text-muted">{sdk ? "Payments are processed by Razorpay. We never see your card or UPI details." : "Loading secure payment…"}</p>
    </div>
  );
}

export function HoldTimer({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const end = new Date(expiresAt).getTime();
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (left === null) return null;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <p className="ui text-white" role="timer" aria-live="off">
      {left > 0 ? (
        <>
          Seats held for <span className="tnum text-gold-deep">{mm}:{ss}</span>
        </>
      ) : (
        "Your hold has ended. Paying now re-checks availability."
      )}
    </p>
  );
}

/** Polls while the server confirms a payment, then refreshes the page. */
export function StatusPoller() {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      n++;
      router.refresh();
      if (n > 30) clearInterval(t);
    }, 2000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
