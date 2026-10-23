import "server-only";
import type { PaymentsMode } from "@/generated/prisma/client";
import { env } from "../env";
import { fakeProvider } from "./fake";
import { razorpayProvider } from "./razorpay";
import type { PaymentProvider } from "./types";

/**
 * Provider for a booking's payment mode. Live keys are only read for LIVE bookings, and a
 * booking can only be created in LIVE mode after the go-live gate passes (settings.ts).
 */
export function getProvider(mode: PaymentsMode): PaymentProvider {
  const e = env();
  if (e.PAYMENT_PROVIDER === "fake") return fakeProvider;
  if (mode === "LIVE") {
    if (!e.RAZORPAY_LIVE_KEY_ID || !e.RAZORPAY_LIVE_KEY_SECRET || !e.RAZORPAY_LIVE_WEBHOOK_SECRET) {
      throw new Error("Live mode requested but live Razorpay keys are not configured.");
    }
    return razorpayProvider({ keyId: e.RAZORPAY_LIVE_KEY_ID, keySecret: e.RAZORPAY_LIVE_KEY_SECRET, webhookSecret: e.RAZORPAY_LIVE_WEBHOOK_SECRET });
  }
  if (!e.RAZORPAY_TEST_KEY_ID || !e.RAZORPAY_TEST_KEY_SECRET || !e.RAZORPAY_TEST_WEBHOOK_SECRET) {
    throw new Error("Razorpay test keys are not configured.");
  }
  return razorpayProvider({ keyId: e.RAZORPAY_TEST_KEY_ID, keySecret: e.RAZORPAY_TEST_KEY_SECRET, webhookSecret: e.RAZORPAY_TEST_WEBHOOK_SECRET });
}

/** Webhooks arrive from either dashboard; the matching secret tells us which mode sent it. */
export function webhookCandidates(): { mode: PaymentsMode; provider: PaymentProvider }[] {
  const e = env();
  if (e.PAYMENT_PROVIDER === "fake") return [{ mode: "TEST", provider: fakeProvider }];
  const out: { mode: PaymentsMode; provider: PaymentProvider }[] = [];
  if (e.RAZORPAY_TEST_KEY_ID) out.push({ mode: "TEST", provider: getProvider("TEST") });
  if (e.RAZORPAY_LIVE_KEY_ID) out.push({ mode: "LIVE", provider: getProvider("LIVE") });
  return out;
}

export * from "./types";
