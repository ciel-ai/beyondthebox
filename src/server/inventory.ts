import "server-only";
import type { TierCode } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { computePrice } from "@/lib/pricing";
import type { CreateBookingInput } from "@/lib/schemas";
import { blindIndex, bookingReference, encrypt, encryptOpt } from "./crypto";
import { db, transaction, type Tx } from "./db";
import { bumpFunnel } from "./funnel";
import { activePaymentsMode, getSettings, pricingConfig } from "./settings";

export class BookingError extends Error {
  constructor(
    public code: "SOLD_OUT" | "SALES_CLOSED" | "TOO_MANY" | "NOT_FOUND" | "INVALID_STATE",
    message: string,
    public available?: number,
  ) {
    super(message);
  }
}

type LockedTier = { id: string; pricePaise: number; capacity: number; soldCount: number; salesOpen: boolean; name: string };

/** Every writer that changes seat counts locks the tier row first, so checks are serialised. */
export async function lockTier(tx: Tx, where: { code: TierCode } | { id: string }): Promise<LockedTier> {
  const rows =
    "code" in where
      ? await tx.$queryRaw<LockedTier[]>`
          SELECT id, "pricePaise", capacity, "soldCount", "salesOpen", name
          FROM "TicketTier" WHERE code = ${where.code}::"TierCode" FOR UPDATE`
      : await tx.$queryRaw<LockedTier[]>`
          SELECT id, "pricePaise", capacity, "soldCount", "salesOpen", name
          FROM "TicketTier" WHERE id = ${where.id} FOR UPDATE`;
  const tier = rows[0];
  if (!tier) throw new BookingError("NOT_FOUND", "That pass doesn't exist.");
  return tier;
}

/** Seats held by live, unconverted holds. Expired holds don't count, so correctness never waits on cleanup. */
export async function activeHeldSeats(tx: Tx, tierId: string, now: Date, excludeBookingId?: string) {
  const rows = await tx.$queryRaw<{ held: bigint | null }[]>`
    SELECT COALESCE(SUM(quantity), 0) AS held FROM "SeatHold"
    WHERE "tierId" = ${tierId} AND "releasedAt" IS NULL AND "convertedAt" IS NULL
      AND "expiresAt" > ${now}
      AND (${excludeBookingId ?? null}::text IS NULL OR "bookingId" <> ${excludeBookingId ?? null})`;
  return Number(rows[0]?.held ?? 0);
}

export async function availableSeats(tx: Tx, tier: LockedTier, now: Date, excludeBookingId?: string) {
  return tier.capacity - tier.soldCount - (await activeHeldSeats(tx, tier.id, now, excludeBookingId));
}

export async function liveHold(tx: Tx, bookingId: string, now: Date) {
  return tx.seatHold.findFirst({
    where: { bookingId, releasedAt: null, convertedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
}

export async function releaseHolds(tx: Tx, bookingId: string, now: Date) {
  await tx.seatHold.updateMany({ where: { bookingId, releasedAt: null, convertedAt: null }, data: { releasedAt: now } });
}

/* ---------- create booking + hold ---------- */

export async function createBooking(input: CreateBookingInput) {
  const settings = await getSettings();
  const mode = await activePaymentsMode();
  if (input.quantity > settings.maxTicketsPerOrder) {
    throw new BookingError("TOO_MANY", `You can book up to ${settings.maxTicketsPerOrder} tickets per order.`);
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = bookingReference();
    try {
      const result = await transaction(async (tx) => {
        const now = new Date();
        const tier = await lockTier(tx, { code: input.tier });
        if (!tier.salesOpen) throw new BookingError("SALES_CLOSED", `${tier.name} sales are closed.`);
        const available = await availableSeats(tx, tier, now);
        if (input.quantity > available) {
          throw new BookingError(
            "SOLD_OUT",
            available > 0
              ? `Only ${available} ${tier.name} ${available === 1 ? "seat is" : "seats are"} left.`
              : `${tier.name} is sold out.`,
            Math.max(0, available),
          );
        }

        const price = computePrice(tier.pricePaise, input.quantity, pricingConfig(settings));
        const b = input.buyer;
        const booking = await tx.booking.create({
          data: {
            reference,
            tierId: tier.id,
            quantity: input.quantity,
            buyerNameEnc: encrypt(b.name),
            buyerEmailEnc: encrypt(b.email.trim()),
            buyerEmailIdx: blindIndex("email", b.email),
            buyerPhoneEnc: encrypt(b.phone.trim()),
            buyerPhoneIdx: blindIndex("phone", b.phone),
            buyerCompanyEnc: encryptOpt(b.company || null),
            buyerGstinEnc: encryptOpt(b.gstin ? b.gstin.toUpperCase() : null),
            unitPricePaise: price.unitPricePaise,
            subtotalPaise: price.subtotalPaise,
            discountPaise: price.discountPaise,
            taxablePaise: price.taxablePaise,
            taxPaise: price.taxPaise,
            feePaise: price.feePaise,
            feeTaxPaise: price.feeTaxPaise,
            totalPaise: price.totalPaise,
            gstRateBps: settings.gstRateBps,
            pricesIncludeGst: settings.pricesIncludeGst,
            paymentsMode: mode,
            attendees: {
              create: input.attendees.map((a, i) => ({
                position: i + 1,
                nameEnc: encrypt(a.name),
                emailEnc: encrypt(a.email.trim()),
                emailIdx: blindIndex("email", a.email),
                phoneEnc: encrypt(a.phone.trim()),
                phoneIdx: blindIndex("phone", a.phone),
              })),
            },
            holds: {
              create: {
                tierId: tier.id,
                quantity: input.quantity,
                expiresAt: new Date(now.getTime() + settings.holdMinutes * 60_000),
              },
            },
          },
          select: { id: true, reference: true },
        });
        return booking;
      });
      // Outside the transaction: a shared counter row must not serialise bookings across tiers.
      await bumpFunnel(db, "CHECKOUT_STARTED").catch(() => {});
      return result;
    } catch (e) {
      // A reference collision is astronomically rare; regenerate and retry.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 2) continue;
      throw e;
    }
  }
  throw new Error("Could not allocate a booking reference");
}

/**
 * For a retry after FAILED/EXPIRED: place a fresh hold on the same booking if seats remain.
 * Caller must hold the booking row lock.
 */
export async function reacquireHold(tx: Tx, booking: { id: string; tierId: string; quantity: number }, holdMinutes: number, now: Date) {
  const tier = await lockTier(tx, { id: booking.tierId });
  if (!tier.salesOpen) throw new BookingError("SALES_CLOSED", `${tier.name} sales are closed.`);
  const available = await availableSeats(tx, tier, now, booking.id);
  if (booking.quantity > available) {
    throw new BookingError("SOLD_OUT", `There aren't enough ${tier.name} seats left for this booking.`, Math.max(0, available));
  }
  await releaseHolds(tx, booking.id, now);
  return tx.seatHold.create({
    data: { bookingId: booking.id, tierId: tier.id, quantity: booking.quantity, expiresAt: new Date(now.getTime() + holdMinutes * 60_000) },
  });
}

/** Cleanup only (statuses + emails). Availability already ignores expired holds. */
export async function expireStaleBookings(now = new Date()) {
  return transaction(async (tx) => {
    const stale = await tx.$queryRaw<{ id: string }[]>`
      SELECT b.id FROM "Booking" b
      WHERE b.status = 'PENDING'
        AND NOT EXISTS (SELECT 1 FROM "SeatHold" h WHERE h."bookingId" = b.id AND h."releasedAt" IS NULL
                        AND (h."convertedAt" IS NOT NULL OR h."expiresAt" > ${now}))
        AND NOT EXISTS (SELECT 1 FROM "Payment" p WHERE p."bookingId" = b.id AND p.decision = 'CAPTURE')
      FOR UPDATE SKIP LOCKED`;
    if (!stale.length) return 0;
    const ids = stale.map((r) => r.id);
    await tx.seatHold.updateMany({ where: { bookingId: { in: ids }, releasedAt: null, convertedAt: null }, data: { releasedAt: now } });
    await tx.booking.updateMany({ where: { id: { in: ids }, status: "PENDING" }, data: { status: "EXPIRED", expiredAt: now } });
    await tx.paymentAttempt.updateMany({ where: { bookingId: { in: ids }, status: "CREATED" }, data: { status: "ABANDONED" } });
    return ids.length;
  });
}
