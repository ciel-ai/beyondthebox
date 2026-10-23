import { verifyPaymentSchema } from "@/lib/schemas";
import { clientKey, forbidden, isSameOrigin, json, rateLimit, tooMany, validationError } from "@/server/http";
import { verifyCheckout } from "@/server/payments/flow";
import { errorResponse, kickJobs } from "@/server/routes";

/**
 * The browser's Checkout callback. This never confirms a booking by itself: it checks the
 * signature, fetches the payment from the gateway, secures seats and schedules the capture.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbidden();
  if (!(await rateLimit("verify", clientKey(req).key))) return tooMany();
  const parsed = verifyPaymentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { reference } = await verifyCheckout({
      orderId: parsed.data.razorpay_order_id,
      paymentId: parsed.data.razorpay_payment_id,
      signature: parsed.data.razorpay_signature,
    });
    kickJobs();
    return json({ reference });
  } catch (e) {
    return errorResponse(e);
  }
}
