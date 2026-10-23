import type { TierCodeValue } from "@/lib/schemas";
import { db } from "@/server/db";
import { sentMail } from "@/server/email/mailer";
import { createBooking } from "@/server/inventory";
import { fakeAuthorize, fakeStore, fakeWebhook, resetFakeGateway } from "@/server/payments/fake";
import { handleWebhook, startPayment, verifyCheckout } from "@/server/payments/flow";
import { drainJobs } from "@/server/worker";

export async function resetDb() {
  await db.$executeRawUnsafe(`
    TRUNCATE "Ticket", "Invoice", "Refund", "Payment", "PaymentAttempt", "SeatHold", "Attendee",
      "BookingAccessToken", "CancellationRequest", "Booking", "Job", "PaymentEvent", "InvoiceCounter", "FunnelCount" CASCADE`);
  await db.$executeRawUnsafe(`UPDATE "TicketTier" SET "soldCount" = 0, "lastSerial" = 0, "salesOpen" = true`);
  await db.$executeRawUnsafe(`UPDATE "TicketTier" SET capacity = CASE code WHEN 'STANDARD' THEN 600 WHEN 'PREMIUM' THEN 300 ELSE 100 END`);
  await db.eventSettings.update({
    where: { id: 1 },
    data: {
      paymentsMode: "TEST",
      holdMinutes: 15,
      maxTicketsPerOrder: 10,
      organiserLegalName: null,
      organiserGstin: null,
      organiserStateCode: null,
      sacCode: null,
      capacityConfirmed: false,
    },
  });
  await db.legalDocument.updateMany({ data: { approvedAt: null } });
  await db.ticketTier.updateMany({ data: { inclusions: [] } });
  resetFakeGateway();
  sentMail.length = 0;
}

let n = 0;
export function bookingInput(tier: TierCodeValue = "STANDARD", quantity = 2) {
  n++;
  const person = (i: number) => ({ name: `Test Attendee ${n}-${i}`, email: `attendee${n}.${i}@example.com`, phone: "+91 98765 43210" });
  return {
    tier,
    quantity,
    buyer: { name: `Test Buyer ${n}`, email: `buyer${n}@example.com`, phone: "9876543210", company: "", gstin: "" },
    attendees: Array.from({ length: quantity }, (_, i) => person(i + 1)),
    turnstileToken: "test",
  };
}

/** Booking → order → buyer completes Checkout. Returns what the browser would send to /verify. */
export async function bookAndAuthorize(tier: TierCodeValue = "STANDARD", quantity = 2) {
  const booking = await createBooking(bookingInput(tier, quantity));
  const checkout = await startPayment(booking.reference, "0.1");
  const callback = fakeAuthorize(checkout.orderId);
  return { booking, checkout, callback };
}

export function verify(cb: ReturnType<typeof fakeAuthorize>) {
  return verifyCheckout({ orderId: cb.razorpay_order_id, paymentId: cb.razorpay_payment_id, signature: cb.razorpay_signature });
}

export async function webhook(event: string, paymentId: string, opts: { eventId?: string; refundId?: string } = {}) {
  const { body, headers } = fakeWebhook(event, paymentId, opts);
  return handleWebhook(body, headers);
}

export async function tierState(code: TierCodeValue) {
  return db.ticketTier.findUniqueOrThrow({ where: { code } });
}

export { db, drainJobs, fakeStore, sentMail };
