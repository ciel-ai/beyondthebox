import "server-only";
import { hmacHex, safeEqual } from "../crypto";
import { ProviderError, type NormalizedEvent, type NormalizedPayment, type PaymentProvider } from "./types";

const API = "https://api.razorpay.com/v1";

type Keys = { keyId: string; keySecret: string; webhookSecret: string };

type RzpPayment = { id: string; order_id: string; amount: number; currency: string; status: string; method?: string | null };

function normalise(p: RzpPayment): NormalizedPayment {
  return { id: p.id, orderId: p.order_id, amountPaise: p.amount, currency: p.currency, status: p.status, method: p.method ?? null };
}

export function razorpayProvider(keys: Keys): PaymentProvider {
  const auth = `Basic ${Buffer.from(`${keys.keyId}:${keys.keySecret}`).toString("base64")}`;

  async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: { description?: string; code?: string } } & T;
    if (!res.ok) {
      // Gateway messages contain no card data; keep them, never the request body.
      throw new ProviderError(json.error?.description ?? `Razorpay ${res.status}`, res.status, json.error?.code);
    }
    return json;
  }

  return {
    id: "razorpay",

    async createOrder({ amountPaise, receipt, notes, captureWindowMins, refundSpeed }) {
      const order = await call<{ id: string }>("POST", "/orders", {
        amount: amountPaise,
        currency: "INR",
        receipt: receipt.slice(0, 40),
        notes,
        // Manual capture overrides the dashboard auto-capture setting. Uncaptured
        // payments are auto-refunded by Razorpay after manual_expiry_period.
        payment: {
          capture: "manual",
          capture_options: { manual_expiry_period: captureWindowMins, refund_speed: refundSpeed },
        },
      });
      return { orderId: order.id };
    },

    checkoutParams(i) {
      return { ...i, provider: "razorpay", key: keys.keyId, currency: "INR" };
    },

    verifyCheckout({ orderId, paymentId, signature }) {
      return safeEqual(hmacHex(keys.keySecret, `${orderId}|${paymentId}`), signature);
    },

    verifyWebhook(rawBody, signature) {
      return !!signature && safeEqual(hmacHex(keys.webhookSecret, rawBody), signature);
    },

    parseWebhook(rawBody, headers): NormalizedEvent {
      const body = JSON.parse(rawBody) as {
        event: string;
        payload?: {
          payment?: { entity?: RzpPayment };
          order?: { entity?: { id: string } };
          refund?: { entity?: { id: string; payment_id: string; amount: number; status: string } };
        };
      };
      const payment = body.payload?.payment?.entity;
      const refund = body.payload?.refund?.entity;
      return {
        eventId: headers.get("x-razorpay-event-id"),
        type: body.event,
        paymentId: payment?.id ?? refund?.payment_id ?? null,
        orderId: payment?.order_id ?? body.payload?.order?.entity?.id ?? null,
        amountPaise: payment?.amount ?? refund?.amount ?? null,
        refundId: refund?.id ?? null,
        refundStatus: refund?.status ?? null,
      };
    },

    async fetchPayment(paymentId) {
      return normalise(await call<RzpPayment>("GET", `/payments/${encodeURIComponent(paymentId)}`));
    },

    async capture(paymentId, amountPaise) {
      return normalise(
        await call<RzpPayment>("POST", `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: amountPaise, currency: "INR" }),
      );
    },

    async refundedTotal(paymentId) {
      const list = await call<{ items: { amount: number; status: string }[] }>(
        "GET",
        `/payments/${encodeURIComponent(paymentId)}/refunds?count=100`,
      );
      return list.items.filter((r) => r.status !== "failed").reduce((sum, r) => sum + r.amount, 0);
    },

    async refund({ paymentId, amountPaise, reason, speed }) {
      const r = await call<{ id: string; status: string }>("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, {
        amount: amountPaise,
        speed,
        notes: { reason: reason.slice(0, 250) },
      });
      return { refundId: r.id, status: r.status };
    },
  };
}
