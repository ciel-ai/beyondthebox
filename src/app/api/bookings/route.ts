import { createBookingSchema } from "@/lib/schemas";
import { grantBookingAccess } from "@/server/access";
import { clientKey, forbidden, isSameOrigin, json, rateLimit, tooMany, validationError, verifyTurnstile } from "@/server/http";
import { createBooking } from "@/server/inventory";
import { errorResponse } from "@/server/routes";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbidden();
  const { ip, key } = clientKey(req);
  if (!(await rateLimit("createBooking", key))) return tooMany();

  const parsed = createBookingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  if (!(await verifyTurnstile(parsed.data.turnstileToken, ip))) {
    return json({ error: "The security check failed. Refresh it and try again.", fields: { turnstileToken: "Complete the security check again." } }, 422);
  }

  try {
    // Only tier, quantity and people are taken from the client. Prices come from the database.
    const booking = await createBooking(parsed.data);
    await grantBookingAccess(booking.reference);
    return json({ reference: booking.reference }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
