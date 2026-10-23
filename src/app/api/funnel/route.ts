import { db } from "@/server/db";
import { bumpFunnel } from "@/server/funnel";
import { isSameOrigin } from "@/server/http";

/** Cookieless visit counter (one per browser session). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return new Response(null, { status: 204 });
  await bumpFunnel(db, "VISIT").catch(() => {});
  return new Response(null, { status: 204 });
}
