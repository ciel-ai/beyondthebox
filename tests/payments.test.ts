import { beforeEach, describe, expect, it } from "vitest";
import { createBooking, expireStaleBookings } from "@/server/inventory";
import { fakeAuthorize, fakeLapse, fakeWebhook } from "@/server/payments/fake";
import { PaymentRejected, handleWebhook, startPayment, verifyCheckout } from "@/server/payments/flow";
import { bookAndAuthorize, bookingInput, db, drainJobs, fakeStore, resetDb, sentMail, tierState, verify, webhook } from "./support/helpers";

beforeEach(resetDb);

const checkoutPaymentId = (orderId: string) => [...fakeStore.payments.values()].find((p) => p.orderId === orderId)!.id;

const counts = async (bookingId: string) => ({
  payments: await db.payment.count({ where: { bookingId } }),
  captured: await db.payment.count({ where: { bookingId, status: "CAPTURED" } }),
  tickets: await db.ticket.count({ where: { bookingId } }),
  invoices: await db.invoice.count({ where: { bookingId } }),
  confirmEmails: await db.job.count({ where: { dedupeKey: `email:confirmed:${bookingId}` } }),
});

describe("happy path", () => {
  it("verifies, captures from the server, and confirms with tickets, invoice and email", async () => {
    const { booking, checkout, callback } = await bookAndAuthorize("PREMIUM", 3);
    expect(checkout.amountPaise).toBe(3 * 499_900 + Math.round(3 * 499_900 * 0.18)); // GST-exclusive default

    await verify(callback);
    // Seats are secured before capture; nothing is captured until the worker runs.
    expect(fakeStore.captureCalls).toBe(0);
    expect((await tierState("PREMIUM")).soldCount).toBe(3);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("PENDING");

    await drainJobs();
    const b = await db.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { invoice: true } });
    expect(b.status).toBe("CONFIRMED");
    expect(fakeStore.captureCalls).toBe(1);
    expect(await counts(booking.id)).toEqual({ payments: 1, captured: 1, tickets: 3, invoices: 1, confirmEmails: 1 });
    expect(b.invoice!.number).toMatch(/^TST\/\d{2}-\d{2}\/00001$/);
    expect(b.invoice!.number.length).toBeLessThanOrEqual(16);

    const mail = sentMail.filter((m) => m.tag === "booking_confirmed");
    expect(mail).toHaveLength(1);
    expect(mail[0]!.attachments).toHaveLength(4); // 3 tickets + 1 invoice
    expect(mail[0]!.attachments!.every((a) => a.content.subarray(0, 4).toString() === "%PDF")).toBe(true);
  });
});

describe("idempotency: paying twice or replaying webhooks issues exactly one set of tickets", () => {
  it("verify + authorized/captured webhooks, replayed and concurrent, act once", async () => {
    const { booking, callback } = await bookAndAuthorize("STANDARD", 2);
    const pid = callback.razorpay_payment_id;

    const authorized = fakeWebhook("payment.authorized", pid, { eventId: "evt_same_1" });
    await Promise.all([
      verify(callback),
      verify(callback),
      handleWebhook(authorized.body, authorized.headers),
      handleWebhook(authorized.body, authorized.headers),
      webhook("payment.authorized", pid), // same payment, new event id
    ]);
    for (let i = 0; i < 5; i++) await handleWebhook(authorized.body, authorized.headers); // exact replays

    await drainJobs();
    await Promise.all([webhook("payment.captured", pid), webhook("order.paid", pid), webhook("payment.captured", pid), verify(callback)]);
    await drainJobs();

    expect(fakeStore.captureCalls).toBe(1);
    expect(await counts(booking.id)).toEqual({ payments: 1, captured: 1, tickets: 2, invoices: 1, confirmEmails: 1 });
    expect(sentMail.filter((m) => m.tag === "booking_confirmed")).toHaveLength(1);
    expect((await tierState("STANDARD")).soldCount).toBe(2);
    // Replays were recorded once and ignored.
    expect(await db.paymentEvent.count({ where: { providerEventId: "evt_same_1" } })).toBe(1);
  });

  it("a second, different payment for the same booking is never captured", async () => {
    const { booking, checkout, callback } = await bookAndAuthorize("VIP", 1);
    const second = fakeAuthorize(checkout.orderId); // buyer paid again in another tab
    await Promise.all([verify(callback), verify(second)]);
    await drainJobs();

    const payments = await db.payment.findMany({ where: { bookingId: booking.id } });
    expect(payments.map((p) => p.decision).sort()).toEqual(["CAPTURE", "DO_NOT_CAPTURE"]);
    expect(fakeStore.captureCalls).toBe(1);
    expect(await db.ticket.count({ where: { bookingId: booking.id } })).toBe(1);
    expect((await tierState("VIP")).soldCount).toBe(1);
    expect(sentMail.filter((m) => m.tag === "payment_not_taken")).toHaveLength(1);
    expect(sentMail.filter((m) => m.tag === "admin_alert")).toHaveLength(1);
  });

  it("a duplicate that was captured anyway (e.g. from the dashboard) is refunded automatically", async () => {
    const { booking, checkout, callback } = await bookAndAuthorize("STANDARD", 1);
    await verify(callback);
    await drainJobs();
    const dup = fakeAuthorize(checkout.orderId);
    fakeStore.payments.get(dup.razorpay_payment_id)!.status = "captured";
    await webhook("payment.captured", dup.razorpay_payment_id);
    await drainJobs();

    const p = await db.payment.findUniqueOrThrow({ where: { providerPaymentId: dup.razorpay_payment_id } });
    expect(p.decision).toBe("REFUND");
    expect(fakeStore.refundCalls).toBe(1);
    expect(await db.refund.count({ where: { paymentId: p.id, automatic: true } })).toBe(1);
    expect(await db.ticket.count({ where: { bookingId: booking.id } })).toBe(1);
    expect(sentMail.filter((m) => m.tag === "payment_refunded")).toHaveLength(1);
    // Re-running the refund job never refunds twice.
    await webhook("payment.captured", dup.razorpay_payment_id);
    await drainJobs();
    expect(fakeStore.refundCalls).toBe(1);
  });
});

describe("tampering is rejected", () => {
  it("bad signature", async () => {
    const { booking, callback } = await bookAndAuthorize();
    await expect(verify({ ...callback, razorpay_signature: callback.razorpay_signature.replace(/.$/, (c) => (c === "a" ? "b" : "a")) })).rejects.toBeInstanceOf(PaymentRejected);
    expect(await db.payment.count({ where: { bookingId: booking.id } })).toBe(0);
    expect(await db.paymentEvent.count({ where: { signatureValid: false } })).toBe(1);
  });

  it("signature for a different order", async () => {
    const a = await bookAndAuthorize();
    const b = await bookAndAuthorize();
    await expect(
      verifyCheckout({ orderId: b.callback.razorpay_order_id, paymentId: a.callback.razorpay_payment_id, signature: a.callback.razorpay_signature }),
    ).rejects.toBeInstanceOf(PaymentRejected);
    expect(await db.payment.count()).toBe(0);
  });

  it("tampered amount: a payment for less than the order is never captured", async () => {
    const booking = await createBooking(bookingInput("VIP", 2));
    const checkout = await startPayment(booking.reference, "0.1");
    const cheap = fakeAuthorize(checkout.orderId, { amountPaise: 100 }); // validly signed, wrong amount
    await expect(verify(cheap)).rejects.toMatchObject({ reason: "amount_mismatch" });
    await drainJobs();
    expect(fakeStore.captureCalls).toBe(0);
    expect((await tierState("VIP")).soldCount).toBe(0);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("PENDING");
  });

  it("webhook with a modified body", async () => {
    const { booking, callback } = await bookAndAuthorize();
    const { body, headers } = fakeWebhook("payment.authorized", callback.razorpay_payment_id);
    const res = await handleWebhook(body.replace('"amount":', '"amount":1'), headers);
    expect(res.status).toBe(400);
    expect(await db.payment.count({ where: { bookingId: booking.id } })).toBe(0);
  });
});

describe("failures release the hold and allow a retry", () => {
  it("payment.failed → FAILED + hold released → retry with a fresh order → confirmed", async () => {
    const { booking, checkout } = await bookAndAuthorize("VIP", 2);
    const failedId = checkoutPaymentId(checkout.orderId);
    fakeStore.payments.get(failedId)!.status = "failed";
    await webhook("payment.failed", failedId);
    await drainJobs();

    let b = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(b.status).toBe("FAILED");
    expect(await db.seatHold.count({ where: { bookingId: booking.id, releasedAt: null, convertedAt: null } })).toBe(0);
    expect(sentMail.filter((m) => m.tag === "payment_failed")).toHaveLength(1);

    const retry = await startPayment(booking.reference, "0.1");
    expect(retry.orderId).not.toBe(checkout.orderId);
    await verify(fakeAuthorize(retry.orderId));
    await drainJobs();
    b = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(b.status).toBe("CONFIRMED");
    expect(await db.ticket.count({ where: { bookingId: booking.id } })).toBe(2);
  });

  it("retry is refused when the seats have gone", async () => {
    await db.ticketTier.update({ where: { code: "VIP" }, data: { capacity: 2 } });
    const first = await bookAndAuthorize("VIP", 2);
    await webhook("payment.failed", (fakeStore.payments.get(first.callback.razorpay_payment_id)!.status = "failed", first.callback.razorpay_payment_id));
    const other = await bookAndAuthorize("VIP", 2); // takes the released seats
    await verify(other.callback);
    await expect(startPayment(first.booking.reference, "0.1")).rejects.toMatchObject({ code: "SOLD_OUT" });
  });

  it("expired hold, late payment, seats still free → captured and confirmed", async () => {
    const { booking, callback } = await bookAndAuthorize("STANDARD", 1);
    await db.seatHold.updateMany({ where: { bookingId: booking.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await expireStaleBookings()).toBe(1);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("EXPIRED");

    await verify(callback);
    await drainJobs();
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CONFIRMED");
    expect((await tierState("STANDARD")).soldCount).toBe(1);
  });

  it("expired hold, late payment, sold out → never captured; buyer and admins told", async () => {
    await db.ticketTier.update({ where: { code: "VIP" }, data: { capacity: 1 } });
    const late = await bookAndAuthorize("VIP", 1);
    await db.seatHold.updateMany({ where: { bookingId: late.booking.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expireStaleBookings();
    const winner = await bookAndAuthorize("VIP", 1);
    await verify(winner.callback);

    await verify(late.callback);
    await drainJobs();
    const p = await db.payment.findUniqueOrThrow({ where: { providerPaymentId: late.callback.razorpay_payment_id } });
    expect(p.decision).toBe("DO_NOT_CAPTURE");
    expect(p.decisionReason).toBe("sold_out_after_hold_expired");
    expect(fakeStore.payments.get(late.callback.razorpay_payment_id)!.status).toBe("authorized"); // lapses back to buyer
    expect((await db.booking.findUniqueOrThrow({ where: { id: late.booking.id } })).status).toBe("EXPIRED");
    expect((await tierState("VIP")).soldCount).toBe(1);
    expect(sentMail.filter((m) => m.tag === "payment_not_taken")).toHaveLength(1);
    expect(sentMail.some((m) => m.tag === "admin_alert" && m.subject.includes("Payment not captured"))).toBe(true);
  });

  it("capture window lapses after seats were secured → seats returned, booking FAILED", async () => {
    const { booking, callback } = await bookAndAuthorize("PREMIUM", 2);
    await verify(callback);
    expect((await tierState("PREMIUM")).soldCount).toBe(2);
    fakeLapse(callback.razorpay_payment_id);
    await drainJobs();
    expect((await tierState("PREMIUM")).soldCount).toBe(0);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("FAILED");
    expect(await db.ticket.count({ where: { bookingId: booking.id } })).toBe(0);
  });
});

describe("invoices", () => {
  it("numbers are consecutive with no gaps", async () => {
    const refs = [];
    for (let i = 0; i < 4; i++) {
      const { callback } = await bookAndAuthorize("STANDARD", 1);
      refs.push(callback);
    }
    await Promise.all(refs.map((cb) => verify(cb)));
    await drainJobs();
    const seqs = (await db.invoice.findMany({ orderBy: { seq: "asc" } })).map((i) => i.seq);
    expect(seqs).toEqual([1, 2, 3, 4]);
  });
});
