import { z } from "zod";
import { env } from "@/server/env";
import { fakeAuthorize, fakeFail, fakeWebhook } from "@/server/payments/fake";
import { handleWebhook } from "@/server/payments/flow";
import { kickJobs } from "@/server/routes";

/**
 * LOCAL DEVELOPMENT ONLY: stands in for the Razorpay Checkout modal. Refuses to run unless
 * DEPLOY_ENV=local and PAYMENT_PROVIDER=fake (both enforced by env validation elsewhere).
 */
export async function POST(req: Request) {
  const e = env();
  if (e.DEPLOY_ENV !== "local" || e.PAYMENT_PROVIDER !== "fake") return new Response("Not found", { status: 404 });
  const body = z.object({ orderId: z.string(), action: z.enum(["pay", "fail"]) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad request" }, { status: 400 });
  if (body.data.action === "pay") return Response.json(fakeAuthorize(body.data.orderId));
  const paymentId = fakeFail(body.data.orderId);
  const hook = fakeWebhook("payment.failed", paymentId);
  await handleWebhook(hook.body, hook.headers);
  kickJobs();
  return Response.json({ failed: true });
}
