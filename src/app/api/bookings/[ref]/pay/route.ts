import { payBookingSchema } from "@/lib/schemas";
import { hasBookingAccess } from "@/server/access";
import { isBookingReference } from "@/server/crypto";
import { db } from "@/server/db";
import { clientKey, forbidden, isSameOrigin, json, rateLimit, tooMany, validationError } from "@/server/http";
import { startPayment } from "@/server/payments/flow";
import { errorResponse } from "@/server/routes";

/** Creates (or reuses) the gateway order for this booking. Also the "Try payment again" path. */
export async function POST(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  if (!isSameOrigin(req)) return forbidden();
  const { ref } = await params;
  if (!isBookingReference(ref) || !(await hasBookingAccess(ref))) return json({ error: "Not found" }, 404);
  if (!(await rateLimit("pay", clientKey(req).key))) return tooMany();

  const parsed = payBookingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);

  try {
    const terms = await db.legalDocument.findFirst({ where: { kind: "TERMS" }, orderBy: { createdAt: "desc" } });
    const checkout = await startPayment(ref, terms?.version ?? "unversioned");
    return json({ checkout });
  } catch (e) {
    return errorResponse(e);
  }
}
