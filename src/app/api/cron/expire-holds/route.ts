import { safeEqual } from "@/server/crypto";
import { env } from "@/server/env";
import { expireStaleBookings } from "@/server/inventory";

/** Status hygiene only: availability already ignores expired holds. */
export async function GET(req: Request) {
  if (!safeEqual(req.headers.get("authorization") ?? "", `Bearer ${env().CRON_SECRET}`)) return new Response("Unauthorized", { status: 401 });
  return Response.json({ expired: await expireStaleBookings() });
}
