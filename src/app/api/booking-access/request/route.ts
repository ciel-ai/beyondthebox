import { randomUUID } from "node:crypto";
import { findBookingSchema } from "@/lib/schemas";
import { blindIndex } from "@/server/crypto";
import { db } from "@/server/db";
import { clientKey, forbidden, isSameOrigin, json, rateLimit, tooMany, validationError, verifyTurnstile } from "@/server/http";
import { enqueue } from "@/server/outbox";
import { kickJobs } from "@/server/routes";

/** Find my booking. The response is identical whether or not the details match (no enumeration). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbidden();
  const { ip, key } = clientKey(req);
  if (!(await rateLimit("findBooking", key))) return tooMany();
  const parsed = findBookingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  if (!(await verifyTurnstile(parsed.data.turnstileToken, ip))) {
    return json({ error: "The security check failed. Refresh it and try again.", fields: { turnstileToken: "Complete the security check again." } }, 422);
  }

  const booking = await db.booking.findFirst({
    where: { reference: parsed.data.reference, buyerEmailIdx: blindIndex("email", parsed.data.email) },
    select: { id: true },
  });
  if (booking) {
    const requestId = randomUUID();
    await enqueue(db, { kind: "EMAIL", template: "booking_access_link", bookingId: booking.id, requestId }, `email:access:${requestId}`);
    kickJobs();
  }
  return json({ ok: true, message: "If those details match a booking, we've emailed a link to it. It works once and expires in 30 minutes." });
}
