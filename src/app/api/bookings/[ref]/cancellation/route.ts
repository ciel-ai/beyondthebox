import { cancellationSchema } from "@/lib/schemas";
import { hasBookingAccess } from "@/server/access";
import { encrypt, isBookingReference } from "@/server/crypto";
import { transaction } from "@/server/db";
import { clientKey, forbidden, isSameOrigin, json, rateLimit, tooMany, validationError } from "@/server/http";
import { enqueue } from "@/server/outbox";
import { kickJobs } from "@/server/routes";

/** A request only. Nothing is refunded automatically; the organiser decides under the policy. */
export async function POST(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  if (!isSameOrigin(req)) return forbidden();
  const { ref } = await params;
  if (!isBookingReference(ref) || !(await hasBookingAccess(ref))) return json({ error: "Not found" }, 404);
  if (!(await rateLimit("cancellation", clientKey(req).key))) return tooMany();
  const parsed = cancellationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);

  const result = await transaction(async (tx) => {
    const b = await tx.booking.findUnique({ where: { reference: ref }, include: { cancellations: { where: { status: "REQUESTED" } } } });
    if (!b) return "missing" as const;
    if (b.status !== "CONFIRMED") return "not_confirmed" as const;
    if (b.cancellations.length) return "already" as const;
    const r = await tx.cancellationRequest.create({ data: { bookingId: b.id, reasonEnc: encrypt(parsed.data.reason) } });
    await enqueue(tx, { kind: "EMAIL", template: "cancellation_received", bookingId: b.id }, `email:cancel:${r.id}`);
    await enqueue(tx, { kind: "ADMIN_ALERT", subject: `Cancellation requested: ${b.reference}`, lines: [`Booking ${b.reference}`, "Review it in the admin (Phase 2)."] }, `alert:cancel:${r.id}`);
    return "ok" as const;
  });
  if (result === "missing") return json({ error: "Not found" }, 404);
  if (result === "not_confirmed") return json({ error: "Only confirmed bookings can be cancelled." }, 409);
  if (result === "already") return json({ error: "You've already asked to cancel this booking. We'll email you with the outcome." }, 409);
  kickJobs();
  return json({ ok: true });
}
