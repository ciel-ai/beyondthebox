import { safeEqual } from "@/server/crypto";
import { env } from "@/server/env";
import { runJobs } from "@/server/worker";

export const maxDuration = 60;

export async function GET(req: Request) {
  if (!safeEqual(req.headers.get("authorization") ?? "", `Bearer ${env().CRON_SECRET}`)) return new Response("Unauthorized", { status: 401 });
  const processed = await runJobs({ max: 50, deadlineMs: 50_000 });
  return Response.json({ processed });
}
