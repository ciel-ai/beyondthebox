import "server-only";
import type { PaymentsMode } from "@/generated/prisma/client";
import { financialYear, invoiceNumber, splitTax } from "@/lib/gst";
import { decrypt, decryptOpt, encrypt } from "../crypto";
import { db, transaction, type Tx } from "../db";
import { bumpFunnel } from "../funnel";
import { BookingError, liveHold, lockTier, availableSeats, reacquireHold, releaseHolds } from "../inventory";
import { enqueue } from "../outbox";
import { getSettings } from "../settings";
import { getProvider, webhookCandidates } from "./index";
import { ProviderError, type CheckoutParams, type NormalizedPayment } from "./types";

/*
 * Payment state machine (see docs/technical-plan.md §4).
 *
 *  startPayment ─▶ Razorpay order (manual capture)
 *  verify / payment.authorized ─▶ securePayment: seats + CAPTURE job in ONE transaction
 *  CAPTURE job ─▶ runCapture ─▶ confirmBooking: CONFIRMED + tickets + invoice + EMAIL job in ONE transaction
 *  payment.captured / order.paid ─▶ confirmBooking (self-heals a worker that died after capturing)
 *
 * Every entry point is idempotent: Payment.providerPaymentId and PaymentEvent.providerEventId
 * are unique, Ticket.attendeeId is unique, and jobs are deduplicated by key.
 */

export class PaymentRejected extends Error {
  constructor(public reason: string) {
    super(`Payment rejected: ${reason}`);
  }
}

type LockedBooking = {
  id: string;
  reference: string;
  status: string;
  tierId: string;
  quantity: number;
  totalPaise: number;
  paymentsMode: PaymentsMode;
};

async function lockBooking(tx: Tx, where: { id: string } | { reference: string }): Promise<LockedBooking> {
  const rows =
    "id" in where
      ? await tx.$queryRaw<LockedBooking[]>`
          SELECT id, reference, status::text AS status, "tierId", quantity, "totalPaise", "paymentsMode"
          FROM "Booking" WHERE id = ${where.id} FOR UPDATE`
      : await tx.$queryRaw<LockedBooking[]>`
          SELECT id, reference, status::text AS status, "tierId", quantity, "totalPaise", "paymentsMode"
          FROM "Booking" WHERE reference = ${where.reference} FOR UPDATE`;
  const b = rows[0];
  if (!b) throw new BookingError("NOT_FOUND", "Booking not found.");
  return b;
}

async function logEvent(data: {
  provider: string;
  source: string;
  type: string;
  bookingId?: string | null;
  providerPaymentId?: string | null;
  providerOrderId?: string | null;
  amountPaise?: number | null;
  signatureValid: boolean;
  outcome?: string;
  payload?: string;
}) {
  const { payload, ...rest } = data;
  await db.paymentEvent.create({ data: { ...rest, payloadEnc: payload ? encrypt(payload) : null } });
}

/* ---------- 1. start (or retry) payment ---------- */

export async function startPayment(reference: string, termsVersion: string): Promise<CheckoutParams> {
  const settings = await getSettings();

  const prepared = await transaction(async (tx) => {
    const now = new Date();
    const booking = await lockBooking(tx, { reference });
    if (booking.status === "CONFIRMED") throw new BookingError("INVALID_STATE", "This booking is already paid.");
    if (!["PENDING", "FAILED", "EXPIRED"].includes(booking.status)) {
      throw new BookingError("INVALID_STATE", "This booking can no longer be paid for.");
    }
    const secured = await tx.payment.findFirst({ where: { bookingId: booking.id, decision: "CAPTURE" } });
    if (secured) throw new BookingError("INVALID_STATE", "A payment for this booking is already being confirmed.");

    let hold = booking.status === "PENDING" ? await liveHold(tx, booking.id, now) : null;
    if (!hold) {
      // Retry path: same booking, fresh hold, only if seats remain.
      hold = await reacquireHold(tx, booking, settings.holdMinutes, now);
      await tx.booking.update({ where: { id: booking.id }, data: { status: "PENDING", failedAt: null, expiredAt: null } });
    }

    const latest = await tx.paymentAttempt.findFirst({ where: { bookingId: booking.id }, orderBy: { createdAt: "desc" } });
    if (
      latest &&
      latest.status === "CREATED" &&
      latest.amountPaise === booking.totalPaise &&
      latest.createdAt >= hold.createdAt
    ) {
      if (latest.providerOrderId) return { booking, attemptId: latest.id, orderId: latest.providerOrderId };
      if (now.getTime() - latest.createdAt.getTime() < 30_000) {
        throw new BookingError("INVALID_STATE", "Your payment is being prepared. Try again in a moment.");
      }
    }
    await tx.paymentAttempt.updateMany({ where: { bookingId: booking.id, status: "CREATED" }, data: { status: "ABANDONED" } });
    const count = await tx.paymentAttempt.count({ where: { bookingId: booking.id } });
    const attempt = await tx.paymentAttempt.create({
      data: {
        bookingId: booking.id,
        provider: getProvider(booking.paymentsMode).id,
        idempotencyKey: `${booking.id}:${count + 1}`,
        amountPaise: booking.totalPaise,
      },
    });
    await tx.booking.update({ where: { id: booking.id }, data: { termsAcceptedAt: now, termsVersion } });
    return { booking, attemptId: attempt.id, orderId: null as string | null, attemptNo: count + 1 };
  });

  const provider = getProvider(prepared.booking.paymentsMode);
  let orderId = prepared.orderId;
  if (!orderId) {
    try {
      const order = await provider.createOrder({
        amountPaise: prepared.booking.totalPaise,
        receipt: `${prepared.booking.reference}-${"attemptNo" in prepared ? prepared.attemptNo : 1}`,
        notes: { booking: prepared.booking.reference },
        captureWindowMins: settings.captureWindowMins,
        refundSpeed: settings.refundSpeed,
      });
      orderId = order.orderId;
      await db.paymentAttempt.update({ where: { id: prepared.attemptId }, data: { providerOrderId: orderId } });
      await logEvent({
        provider: provider.id,
        source: "api",
        type: "order.created",
        bookingId: prepared.booking.id,
        providerOrderId: orderId,
        amountPaise: prepared.booking.totalPaise,
        signatureValid: true,
        outcome: "ok",
      });
    } catch (e) {
      await db.paymentAttempt.update({ where: { id: prepared.attemptId }, data: { status: "FAILED" } });
      throw e;
    }
  }

  const b = await db.booking.findUniqueOrThrow({ where: { id: prepared.booking.id }, include: { tier: true } });
  return provider.checkoutParams({
    orderId,
    amountPaise: b.totalPaise,
    name: "Beyond the Limits",
    description: `${b.tier.name} × ${b.quantity} · ${b.reference}`,
    prefill: { name: decrypt(b.buyerNameEnc), email: decrypt(b.buyerEmailEnc), contact: decrypt(b.buyerPhoneEnc) },
  });
}

/* ---------- 2. verify (browser callback) ---------- */

export async function verifyCheckout(i: { orderId: string; paymentId: string; signature: string }) {
  const attempt = await db.paymentAttempt.findUnique({ where: { providerOrderId: i.orderId }, include: { booking: true } });
  if (!attempt) {
    await logEvent({ provider: "unknown", source: "verify", type: "checkout.verify", providerOrderId: i.orderId, signatureValid: false, outcome: "unknown_order" });
    throw new PaymentRejected("unknown_order");
  }
  const provider = getProvider(attempt.booking.paymentsMode);
  const valid = provider.verifyCheckout(i);
  await logEvent({
    provider: provider.id,
    source: "verify",
    type: "checkout.verify",
    bookingId: attempt.bookingId,
    providerOrderId: i.orderId,
    providerPaymentId: i.paymentId,
    signatureValid: valid,
    outcome: valid ? "ok" : "bad_signature",
  });
  if (!valid) throw new PaymentRejected("bad_signature");
  await securePayment({ paymentId: i.paymentId, orderId: i.orderId, via: "verify" });
  return { reference: attempt.booking.reference };
}

/* ---------- 3. secure seats + schedule capture ---------- */

export async function securePayment({ paymentId, orderId, via }: { paymentId: string; orderId: string; via: string }) {
  const attempt = await db.paymentAttempt.findUnique({ where: { providerOrderId: orderId }, include: { booking: true } });
  if (!attempt) throw new PaymentRejected("unknown_order");
  const provider = getProvider(attempt.booking.paymentsMode);

  // Never trust the browser: confirm the payment with the gateway.
  const remote: NormalizedPayment = await provider.fetchPayment(paymentId);
  const problem =
    remote.orderId !== orderId
      ? "order_mismatch"
      : remote.currency !== "INR"
        ? "currency_mismatch"
        : remote.amountPaise !== attempt.amountPaise
          ? "amount_mismatch"
          : !["authorized", "captured"].includes(remote.status)
            ? `status_${remote.status}`
            : null;
  if (problem) {
    await logEvent({
      provider: provider.id,
      source: via,
      type: "payment.check",
      bookingId: attempt.bookingId,
      providerOrderId: orderId,
      providerPaymentId: paymentId,
      amountPaise: remote.amountPaise,
      signatureValid: true,
      outcome: `rejected:${problem}`,
    });
    // Not captured, so an authorised payment simply lapses back to the buyer.
    throw new PaymentRejected(problem);
  }

  const settings = await getSettings();
  const result = await transaction(async (tx) => {
    const now = new Date();
    const inserted = await tx.payment.createManyAndReturn({
      data: [
        {
          bookingId: attempt.bookingId,
          attemptId: attempt.id,
          provider: provider.id,
          providerPaymentId: remote.id,
          providerOrderId: orderId,
          amountPaise: remote.amountPaise,
          currency: remote.currency,
          method: remote.method,
          status: remote.status === "captured" ? "CAPTURED" : "AUTHORIZED",
        },
      ],
      skipDuplicates: true,
    });
    if (!inserted.length) {
      const existing = await tx.payment.findUniqueOrThrow({ where: { providerPaymentId: remote.id } });
      return { decision: existing.decision, duplicateCall: true };
    }
    const payment = inserted[0]!;
    const booking = await lockBooking(tx, { id: attempt.bookingId });

    const otherSecured = await tx.payment.findFirst({
      where: { bookingId: booking.id, decision: "CAPTURE", id: { not: payment.id } },
    });

    let canCapture = false;
    let reason = "";
    if (otherSecured || ["CONFIRMED", "CANCELLED", "REFUND_PENDING", "REFUNDED"].includes(booking.status)) {
      reason = "duplicate_payment";
    } else {
      const hold = booking.status === "PENDING" ? await liveHold(tx, booking.id, now) : null;
      const tier = await lockTier(tx, { id: booking.tierId });
      if (hold) {
        await tx.seatHold.update({ where: { id: hold.id }, data: { convertedAt: now } });
        canCapture = true;
      } else if ((await availableSeats(tx, tier, now, booking.id)) >= booking.quantity) {
        // Late payment, seats still available: take them directly.
        await releaseHolds(tx, booking.id, now);
        await tx.seatHold.create({
          data: { bookingId: booking.id, tierId: tier.id, quantity: booking.quantity, expiresAt: now, convertedAt: now },
        });
        canCapture = true;
      } else {
        reason = "sold_out_after_hold_expired";
      }
      if (canCapture) {
        // The CHECK constraint (soldCount <= capacity) is the last line of defence.
        await tx.$executeRaw`UPDATE "TicketTier" SET "soldCount" = "soldCount" + ${booking.quantity} WHERE id = ${tier.id}`;
      }
    }

    if (canCapture) {
      await tx.payment.update({ where: { id: payment.id }, data: { decision: "CAPTURE", seatsSecuredAt: now } });
      await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "PAID" } });
      if (booking.status !== "PENDING") {
        await tx.booking.update({ where: { id: booking.id }, data: { status: "PENDING", failedAt: null, expiredAt: null } });
      }
      await enqueue(tx, { kind: "CAPTURE", paymentId: payment.id }, `capture:${payment.id}`);
      return { decision: "CAPTURE" as const, duplicateCall: false };
    }

    const alreadyCaptured = remote.status === "captured";
    await tx.payment.update({
      where: { id: payment.id },
      data: { decision: alreadyCaptured ? "REFUND" : "DO_NOT_CAPTURE", decisionReason: reason },
    });
    if (alreadyCaptured) {
      await enqueue(tx, { kind: "REFUND", paymentId: payment.id, reason }, `refund:${payment.id}`);
    }
    await enqueue(
      tx,
      { kind: "EMAIL", template: alreadyCaptured ? "payment_refunded" : "payment_not_taken", bookingId: booking.id, paymentId: payment.id },
      `email:not-taken:${payment.id}`,
    );
    await enqueue(
      tx,
      {
        kind: "ADMIN_ALERT",
        subject: alreadyCaptured ? `Automatic refund: ${booking.reference}` : `Payment not captured: ${booking.reference}`,
        lines: [
          `Booking ${booking.reference}`,
          `Payment ${remote.id} (${(remote.amountPaise / 100).toFixed(2)} INR)`,
          `Reason: ${reason}`,
          alreadyCaptured
            ? "The payment was captured outside our flow, so a full refund has been queued."
            : `Not captured. Razorpay returns it to the buyer automatically within ${settings.captureWindowMins} minutes.`,
        ],
      },
      `alert:not-taken:${payment.id}`,
    );
    return { decision: alreadyCaptured ? ("REFUND" as const) : ("DO_NOT_CAPTURE" as const), duplicateCall: false };
  });

  return { bookingId: attempt.bookingId, reference: attempt.booking.reference, ...result };
}

/* ---------- 4. capture worker ---------- */

export async function runCapture(paymentRowId: string) {
  const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentRowId }, include: { booking: true } });
  if (payment.decision !== "CAPTURE") return "skipped";
  if (payment.status !== "CAPTURED") {
    const provider = getProvider(payment.booking.paymentsMode);
    try {
      await provider.capture(payment.providerPaymentId, payment.amountPaise);
      await logEvent({
        provider: provider.id,
        source: "worker",
        type: "payment.capture",
        bookingId: payment.bookingId,
        providerPaymentId: payment.providerPaymentId,
        amountPaise: payment.amountPaise,
        signatureValid: true,
        outcome: "ok",
      });
    } catch (e) {
      // No idempotency key on Capture: the payment's real state decides what happened.
      const remote = await provider.fetchPayment(payment.providerPaymentId);
      if (remote.status !== "captured") {
        if (remote.status === "authorized") throw e; // transient: retry with backoff
        await returnSeats(payment.id, `capture_failed_${remote.status}`);
        return "lapsed";
      }
    }
  }
  await confirmBooking({ paymentId: payment.providerPaymentId, orderId: payment.providerOrderId });
  return "confirmed";
}

/** Capture became impossible after seats were secured: give the seats back. */
async function returnSeats(paymentRowId: string, reason: string) {
  await transaction(async (tx) => {
    const now = new Date();
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentRowId } });
    const booking = await lockBooking(tx, { id: payment.bookingId });
    if (payment.decision !== "CAPTURE" || payment.status === "CAPTURED") return;
    await lockTier(tx, { id: booking.tierId });
    await tx.$executeRaw`UPDATE "TicketTier" SET "soldCount" = "soldCount" - ${booking.quantity} WHERE id = ${booking.tierId}`;
    await tx.seatHold.updateMany({ where: { bookingId: booking.id, convertedAt: { not: null }, returnedAt: null }, data: { returnedAt: now } });
    await tx.payment.update({ where: { id: payment.id }, data: { status: "LAPSED", decision: "DO_NOT_CAPTURE", decisionReason: reason } });
    if (booking.status === "PENDING") {
      await tx.booking.update({ where: { id: booking.id }, data: { status: "FAILED", failedAt: now } });
    }
    await enqueue(tx, { kind: "EMAIL", template: "payment_failed", bookingId: booking.id, paymentId: payment.id }, `email:failed:${payment.id}`);
    await enqueue(
      tx,
      { kind: "ADMIN_ALERT", subject: `Capture failed: ${booking.reference}`, lines: [`Payment ${payment.providerPaymentId}`, `Reason: ${reason}`, "Seats returned to inventory."] },
      `alert:capture-failed:${payment.id}`,
    );
  });
}

/* ---------- 5. confirm ---------- */

export async function confirmBooking({ paymentId, orderId }: { paymentId: string; orderId: string }) {
  let payment = await db.payment.findUnique({ where: { providerPaymentId: paymentId } });
  if (!payment) {
    // payment.captured arrived before verify / payment.authorized: secure first.
    await securePayment({ paymentId, orderId, via: "confirm" });
    payment = await db.payment.findUniqueOrThrow({ where: { providerPaymentId: paymentId } });
  }
  const settings = await getSettings();

  const confirmed = await transaction(async (tx) => {
    const now = new Date();
    const booking = await lockBooking(tx, { id: payment.bookingId });
    const p = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });

    if (p.decision === "DO_NOT_CAPTURE") {
      // Captured outside our flow (e.g. from the dashboard): refund it automatically.
      await tx.payment.update({ where: { id: p.id }, data: { status: "CAPTURED", capturedAt: now, decision: "REFUND" } });
      await enqueue(tx, { kind: "REFUND", paymentId: p.id, reason: p.decisionReason ?? "duplicate_payment" }, `refund:${p.id}`);
      await enqueue(tx, { kind: "EMAIL", template: "payment_refunded", bookingId: booking.id, paymentId: p.id }, `email:refunded:${p.id}`);
      await enqueue(
        tx,
        { kind: "ADMIN_ALERT", subject: `Automatic refund: ${booking.reference}`, lines: [`Payment ${p.providerPaymentId} was captured but not needed.`, "A full refund has been queued."] },
        `alert:refunded:${p.id}`,
      );
      return false;
    }
    if (p.decision !== "CAPTURE") return false;
    if (p.status !== "CAPTURED") await tx.payment.update({ where: { id: p.id }, data: { status: "CAPTURED", capturedAt: now } });
    if (booking.status === "CONFIRMED") return false;

    await tx.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED", confirmedAt: now, failedAt: null, expiredAt: null } });

    // Tickets: only if none exist (Ticket.attendeeId is unique as a second guard).
    if ((await tx.ticket.count({ where: { bookingId: booking.id } })) === 0) {
      const attendees = await tx.attendee.findMany({ where: { bookingId: booking.id }, orderBy: { position: "asc" } });
      const [serial] = await tx.$queryRaw<{ lastSerial: number; serialPrefix: string }[]>`
        UPDATE "TicketTier" SET "lastSerial" = "lastSerial" + ${attendees.length}
        WHERE id = ${booking.tierId} RETURNING "lastSerial", "serialPrefix"`;
      const first = serial!.lastSerial - attendees.length + 1;
      await tx.ticket.createMany({
        data: attendees.map((a, i) => ({
          bookingId: booking.id,
          attendeeId: a.id,
          tierId: booking.tierId,
          serial: `${serial!.serialPrefix}-${String(first + i).padStart(4, "0")}`,
        })),
      });
    }

    // GST invoice: consecutive per financial year; the counter row is locked by the upsert.
    if (!(await tx.invoice.findUnique({ where: { bookingId: booking.id } }))) {
      const full = await tx.booking.findUniqueOrThrow({ where: { id: booking.id } });
      const isTest = booking.paymentsMode !== "LIVE";
      const series = isTest ? "TST" : "BTL";
      const fy = financialYear(now);
      const [counter] = await tx.$queryRaw<{ last: number }[]>`
        INSERT INTO "InvoiceCounter" (series, "financialYear", last) VALUES (${series}, ${fy}, 1)
        ON CONFLICT (series, "financialYear") DO UPDATE SET last = "InvoiceCounter".last + 1
        RETURNING last`;
      const seq = counter!.last;
      const tax = splitTax(full.taxPaise + full.feeTaxPaise, true);
      await tx.invoice.create({
        data: {
          number: invoiceNumber(series, fy, seq),
          series,
          financialYear: fy,
          seq,
          bookingId: booking.id,
          issuedAt: now,
          isTest,
          partiesEnc: encrypt(
            JSON.stringify({
              seller: {
                legalName: settings.organiserLegalName ?? "[Organiser legal name]",
                gstin: settings.organiserGstin ?? "[GSTIN]",
                address: settings.organiserAddress ?? "[Registered address]",
                stateCode: settings.organiserStateCode ?? "[State code]",
                sac: settings.sacCode ?? "[SAC]",
              },
              buyer: {
                name: decrypt(full.buyerNameEnc),
                email: decrypt(full.buyerEmailEnc),
                company: decryptOpt(full.buyerCompanyEnc),
                gstin: decryptOpt(full.buyerGstinEnc),
              },
            }),
          ),
          taxablePaise: full.taxablePaise,
          ...tax,
          feePaise: full.feePaise,
          feeTaxPaise: full.feeTaxPaise,
          totalPaise: full.totalPaise,
        },
      });
    }

    // Same transaction as the confirmation (approved addition A).
    await enqueue(tx, { kind: "EMAIL", template: "booking_confirmed", bookingId: booking.id }, `email:confirmed:${booking.id}`);
    return true;
  });

  if (confirmed) await bumpFunnel(db, "PAID").catch(() => {});
  return confirmed;
}

/* ---------- 6. failures, refunds, webhooks ---------- */

export async function handlePaymentFailed({ paymentId, orderId }: { paymentId: string | null; orderId: string }) {
  const attempt = await db.paymentAttempt.findUnique({ where: { providerOrderId: orderId } });
  if (!attempt) return;
  await transaction(async (tx) => {
    const now = new Date();
    const booking = await lockBooking(tx, { id: attempt.bookingId });
    if (paymentId) {
      await tx.payment.createMany({
        data: [
          {
            bookingId: booking.id,
            attemptId: attempt.id,
            provider: attempt.provider,
            providerPaymentId: paymentId,
            providerOrderId: orderId,
            amountPaise: attempt.amountPaise,
            currency: "INR",
            status: "FAILED",
            decision: "DO_NOT_CAPTURE",
            decisionReason: "payment_failed",
          },
        ],
        skipDuplicates: true,
      });
    }
    if (attempt.status === "CREATED") await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "FAILED" } });
    const secured = await tx.payment.findFirst({ where: { bookingId: booking.id, decision: "CAPTURE" } });
    if (booking.status !== "PENDING" || secured) return;
    await releaseHolds(tx, booking.id, now);
    await tx.booking.update({ where: { id: booking.id }, data: { status: "FAILED", failedAt: now } });
    await enqueue(tx, { kind: "EMAIL", template: "payment_failed", bookingId: booking.id }, `email:failed:${attempt.id}`);
  });
}

export async function runRefund(paymentRowId: string, reason: string) {
  const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentRowId }, include: { booking: true } });
  const provider = getProvider(payment.booking.paymentsMode);
  const settings = await getSettings();
  const remaining = payment.amountPaise - (await provider.refundedTotal(payment.providerPaymentId));
  if (remaining <= 0) return "already_refunded";
  const r = await provider.refund({ paymentId: payment.providerPaymentId, amountPaise: remaining, reason, speed: settings.refundSpeed });
  await db.refund.createMany({
    data: [{ paymentId: payment.id, providerRefundId: r.refundId, amountPaise: remaining, reason, status: r.status, automatic: true }],
    skipDuplicates: true,
  });
  await logEvent({
    provider: provider.id,
    source: "worker",
    type: "refund.create",
    bookingId: payment.bookingId,
    providerPaymentId: payment.providerPaymentId,
    amountPaise: remaining,
    signatureValid: true,
    outcome: r.status,
  });
  return "refunded";
}

async function handleRefundEvent(paymentId: string, refundId: string | null, status: string | null) {
  if (refundId && status) await db.refund.updateMany({ where: { providerRefundId: refundId }, data: { status } });
  if (status !== "processed") return;
  const payment = await db.payment.findUnique({ where: { providerPaymentId: paymentId }, include: { refunds: true } });
  if (!payment) return;
  const refunded = payment.refunds.filter((r) => r.status === "processed").reduce((s, r) => s + r.amountPaise, 0);
  if (refunded >= payment.amountPaise) await db.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
  // Admin-initiated refunds of a booking's own payment (tickets invalidated) arrive in Phase 2.
}

export async function handleWebhook(rawBody: string, headers: Headers): Promise<{ status: number; body: Record<string, unknown> }> {
  const signature = headers.get("x-razorpay-signature");
  const match = webhookCandidates().find((c) => c.provider.verifyWebhook(rawBody, signature));
  if (!match) {
    await logEvent({ provider: "razorpay", source: "webhook", type: "unverified", signatureValid: false, outcome: "bad_signature", payload: rawBody });
    return { status: 400, body: { error: "invalid signature" } };
  }

  const ev = match.provider.parseWebhook(rawBody, headers);
  const recorded = await db.paymentEvent.createManyAndReturn({
    data: [
      {
        provider: match.provider.id,
        source: "webhook",
        type: ev.type,
        providerEventId: ev.eventId,
        providerPaymentId: ev.paymentId,
        providerOrderId: ev.orderId,
        amountPaise: ev.amountPaise,
        signatureValid: true,
        payloadEnc: encrypt(rawBody),
      },
    ],
    skipDuplicates: true,
  });
  let eventRowId = recorded[0]?.id;
  if (!eventRowId) {
    const prior = await db.paymentEvent.findUnique({ where: { providerEventId: ev.eventId! } });
    if (prior?.outcome && prior.outcome !== "error") return { status: 200, body: { duplicate: true } };
    eventRowId = prior?.id; // a previous delivery errored: process again (handlers are idempotent)
  }

  try {
    let outcome = "ignored";
    if (ev.paymentId && ev.orderId) {
      if (ev.type === "payment.authorized") {
        outcome = (await securePayment({ paymentId: ev.paymentId, orderId: ev.orderId, via: "webhook" })).decision;
      } else if (ev.type === "payment.captured" || ev.type === "order.paid") {
        outcome = (await confirmBooking({ paymentId: ev.paymentId, orderId: ev.orderId })) ? "confirmed" : "noop";
      } else if (ev.type === "payment.failed") {
        await handlePaymentFailed({ paymentId: ev.paymentId, orderId: ev.orderId });
        outcome = "failed_recorded";
      }
    }
    if (ev.paymentId && (ev.type === "refund.processed" || ev.type === "refund.failed")) {
      await handleRefundEvent(ev.paymentId, ev.refundId, ev.refundStatus ?? (ev.type === "refund.processed" ? "processed" : "failed"));
      outcome = ev.type;
    }
    if (eventRowId) {
      const booking = ev.orderId ? await db.paymentAttempt.findUnique({ where: { providerOrderId: ev.orderId }, select: { bookingId: true } }) : null;
      await db.paymentEvent.update({ where: { id: eventRowId }, data: { outcome, bookingId: booking?.bookingId ?? null } });
    }
    return { status: 200, body: { ok: true } };
  } catch (e) {
    if (eventRowId) await db.paymentEvent.update({ where: { id: eventRowId }, data: { outcome: e instanceof PaymentRejected ? `rejected:${e.reason}` : "error" } });
    // Rejections are final (2xx so Razorpay stops retrying); other errors ask for a retry.
    if (e instanceof PaymentRejected) return { status: 200, body: { rejected: e.reason } };
    if (e instanceof ProviderError || e instanceof Error) return { status: 500, body: { error: "processing failed" } };
    throw e;
  }
}
