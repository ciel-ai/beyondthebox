import { hasBookingAccess } from "@/server/access";
import { isBookingReference } from "@/server/crypto";
import { db } from "@/server/db";
import { clientKey, json, rateLimit, tooMany } from "@/server/http";

/** Status for polling. No personal data in the response. */
export async function GET(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  if (!isBookingReference(ref) || !(await hasBookingAccess(ref))) return json({ error: "Not found" }, 404);
  if (!(await rateLimit("bookingStatus", clientKey(req).key))) return tooMany();
  const b = await db.booking.findUnique({
    where: { reference: ref },
    select: { status: true, payments: { where: { decision: "CAPTURE" }, select: { status: true } } },
  });
  if (!b) return json({ error: "Not found" }, 404);
  return json({ status: b.status, confirming: b.status === "PENDING" && b.payments.length > 0 });
}
