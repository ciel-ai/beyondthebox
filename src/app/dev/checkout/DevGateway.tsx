"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPaise } from "@/lib/pricing";

export function DevGateway({ orderId, reference, amountPaise }: { orderId: string; reference: string; amountPaise: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const act = async (action: "pay" | "fail") => {
    setBusy(true);
    const res = await fetch("/api/dev/fake-gateway", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, action }) });
    const data = await res.json();
    if (action === "pay") {
      await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    }
    router.push(`/booking/${reference}`);
  };
  return (
    <main id="main" className="wrap flex min-h-screen flex-col items-center justify-center text-center">
      <p className="ui text-gold-deep">Local test gateway</p>
      <h1 className="display display-l mt-4">{formatPaise(amountPaise)}</h1>
      <p className="mt-3 text-muted">Simulates Razorpay Checkout for {reference}. Never available outside local development.</p>
      <div className="mt-8 flex gap-3">
        <button className="btn btn-leaf" disabled={busy} onClick={() => act("pay")}>Authorise payment</button>
        <button className="btn btn-dark" disabled={busy} onClick={() => act("fail")}>Fail payment</button>
      </div>
    </main>
  );
}
