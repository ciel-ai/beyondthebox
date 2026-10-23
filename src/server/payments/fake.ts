import "server-only";
import { hmacHex, randomToken, safeEqual } from "../crypto";
import { ProviderError, type NormalizedPayment, type PaymentProvider } from "./types";

/**
 * In-process stand-in for Razorpay with the same rules that matter to us: manual capture,
 * capture amount must equal the authorised amount, already-captured errors, refunds, and
 * real HMAC signatures. Used by the test suite and local development only (never production).
 */

export const FAKE_KEY_ID = "rzp_fake_local";
export const FAKE_KEY_SECRET = "fake_key_secret_for_tests_only";
export const FAKE_WEBHOOK_SECRET = "fake_webhook_secret_for_tests_only";

type FakeOrder = { id: string; amount: number; status: "created" | "attempted" | "paid" };
type FakePayment = NormalizedPayment & { refunded: number };

type Store = {
  orders: Map<string, FakeOrder>;
  payments: Map<string, FakePayment>;
  captureCalls: number;
  refundCalls: number;
  /** Simulates a gateway outage on capture (payment stays authorised). */
  failCaptures: boolean;
};

const g = globalThis as unknown as { __fakeGateway?: Store };
export const fakeStore: Store = (g.__fakeGateway ??= { orders: new Map(), payments: new Map(), captureCalls: 0, refundCalls: 0, failCaptures: false });

export function resetFakeGateway() {
  fakeStore.orders.clear();
  fakeStore.payments.clear();
  fakeStore.captureCalls = 0;
  fakeStore.refundCalls = 0;
  fakeStore.failCaptures = false;
}

const id = (prefix: string) => `${prefix}_FAKE${randomToken(9).replace(/[-_]/g, "x")}`;

/** Simulates the buyer completing Checkout: returns what Razorpay hands the browser. */
export function fakeAuthorize(orderId: string, opts: { amountPaise?: number } = {}) {
  const order = fakeStore.orders.get(orderId);
  if (!order) throw new ProviderError("Order not found", 404);
  const payment: FakePayment = {
    id: id("pay"),
    orderId,
    amountPaise: opts.amountPaise ?? order.amount,
    currency: "INR",
    status: "authorized",
    method: "upi",
    refunded: 0,
  };
  fakeStore.payments.set(payment.id, payment);
  order.status = "attempted";
  return {
    razorpay_order_id: orderId,
    razorpay_payment_id: payment.id,
    razorpay_signature: hmacHex(FAKE_KEY_SECRET, `${orderId}|${payment.id}`),
  };
}

export function fakeFail(orderId: string) {
  const order = fakeStore.orders.get(orderId);
  if (!order) throw new ProviderError("Order not found", 404);
  const payment: FakePayment = { id: id("pay"), orderId, amountPaise: order.amount, currency: "INR", status: "failed", method: "card", refunded: 0 };
  fakeStore.payments.set(payment.id, payment);
  return payment.id;
}

/** Simulates Razorpay auto-refunding an uncaptured payment after the capture window. */
export function fakeLapse(paymentId: string) {
  const p = fakeStore.payments.get(paymentId);
  if (p && p.status === "authorized") p.status = "refunded";
}

/** Builds a signed webhook body exactly as Razorpay would send it. */
export function fakeWebhook(event: string, paymentId: string, extra: { refundId?: string; eventId?: string } = {}) {
  const p = fakeStore.payments.get(paymentId);
  if (!p) throw new Error("Unknown fake payment");
  const body = JSON.stringify({
    entity: "event",
    event,
    payload: {
      payment: { entity: { id: p.id, order_id: p.orderId, amount: p.amountPaise, currency: "INR", status: p.status, method: p.method } },
      ...(extra.refundId
        ? { refund: { entity: { id: extra.refundId, payment_id: p.id, amount: p.refunded || p.amountPaise, status: "processed" } } }
        : {}),
    },
  });
  const headers = new Headers({
    "x-razorpay-signature": hmacHex(FAKE_WEBHOOK_SECRET, body),
    "x-razorpay-event-id": extra.eventId ?? id("evt"),
    "content-type": "application/json",
  });
  return { body, headers };
}

export const fakeProvider: PaymentProvider = {
  id: "fake",

  async createOrder({ amountPaise }) {
    const order: FakeOrder = { id: id("order"), amount: amountPaise, status: "created" };
    fakeStore.orders.set(order.id, order);
    return { orderId: order.id };
  },

  checkoutParams(i) {
    return { ...i, provider: "fake", key: FAKE_KEY_ID, currency: "INR" };
  },

  verifyCheckout({ orderId, paymentId, signature }) {
    return safeEqual(hmacHex(FAKE_KEY_SECRET, `${orderId}|${paymentId}`), signature);
  },

  verifyWebhook(rawBody, signature) {
    return !!signature && safeEqual(hmacHex(FAKE_WEBHOOK_SECRET, rawBody), signature);
  },

  parseWebhook(rawBody, headers) {
    const body = JSON.parse(rawBody);
    const payment = body.payload?.payment?.entity;
    const refund = body.payload?.refund?.entity;
    return {
      eventId: headers.get("x-razorpay-event-id"),
      type: body.event,
      paymentId: payment?.id ?? refund?.payment_id ?? null,
      orderId: payment?.order_id ?? null,
      amountPaise: payment?.amount ?? null,
      refundId: refund?.id ?? null,
      refundStatus: refund?.status ?? null,
    };
  },

  async fetchPayment(paymentId) {
    const p = fakeStore.payments.get(paymentId);
    if (!p) throw new ProviderError("The id provided does not exist", 400, "BAD_REQUEST_ERROR");
    const { refunded: _r, ...rest } = p;
    return { ...rest };
  },

  async capture(paymentId, amountPaise) {
    fakeStore.captureCalls++;
    if (fakeStore.failCaptures) throw new ProviderError("Gateway timeout", 504);
    const p = fakeStore.payments.get(paymentId);
    if (!p) throw new ProviderError("The id provided does not exist", 400);
    if (p.status !== "authorized") throw new ProviderError("The payment has already been either captured or voided.", 400);
    if (amountPaise !== p.amountPaise) throw new ProviderError("Capture amount must be equal to the amount authorized", 400);
    p.status = "captured";
    const order = fakeStore.orders.get(p.orderId);
    if (order) order.status = "paid";
    const { refunded: _r, ...rest } = p;
    return { ...rest };
  },

  async refundedTotal(paymentId) {
    return fakeStore.payments.get(paymentId)?.refunded ?? 0;
  },

  async refund({ paymentId, amountPaise }) {
    fakeStore.refundCalls++;
    const p = fakeStore.payments.get(paymentId);
    if (!p || p.status !== "captured") throw new ProviderError("Payment cannot be refunded", 400);
    p.refunded += amountPaise;
    if (p.refunded >= p.amountPaise) p.status = "refunded";
    return { refundId: id("rfnd"), status: "processed" };
  },
};
