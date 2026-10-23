/** Gateway-neutral payment types. Razorpay is the first adapter; Cashfree can be added behind the same interface. */

export type ProviderId = "razorpay" | "fake";

export type NormalizedPayment = {
  id: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  /** created | authorized | captured | refunded | failed (gateway vocabulary, lower-case) */
  status: string;
  method: string | null;
};

export type NormalizedEvent = {
  eventId: string | null;
  type: string;
  paymentId: string | null;
  orderId: string | null;
  amountPaise: number | null;
  refundId: string | null;
  refundStatus: string | null;
};

export type CheckoutParams = {
  provider: ProviderId;
  key: string;
  orderId: string;
  amountPaise: number;
  currency: "INR";
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
};

export class ProviderError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
  }
}

export interface PaymentProvider {
  id: ProviderId;
  createOrder(i: {
    amountPaise: number;
    receipt: string;
    notes: Record<string, string>;
    captureWindowMins: number;
    refundSpeed: string;
  }): Promise<{ orderId: string }>;
  checkoutParams(i: Omit<CheckoutParams, "provider" | "key" | "currency">): CheckoutParams;
  verifyCheckout(i: { orderId: string; paymentId: string; signature: string }): boolean;
  verifyWebhook(rawBody: string, signature: string | null): boolean;
  parseWebhook(rawBody: string, headers: Headers): NormalizedEvent;
  fetchPayment(paymentId: string): Promise<NormalizedPayment>;
  capture(paymentId: string, amountPaise: number): Promise<NormalizedPayment>;
  /** Total already refunded, so a retried refund job never refunds twice. */
  refundedTotal(paymentId: string): Promise<number>;
  refund(i: { paymentId: string; amountPaise: number; reason: string; speed: string }): Promise<{ refundId: string; status: string }>;
}
