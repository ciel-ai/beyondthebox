import { handleWebhook } from "@/server/payments/flow";
import { kickJobs } from "@/server/routes";

/** Razorpay webhooks: signature checked against the raw body; replays are ignored by event ID. */
export async function POST(req: Request) {
  const raw = await req.text();
  try {
    const result = await handleWebhook(raw, req.headers);
    if (result.status === 200) kickJobs();
    return Response.json(result.body, { status: result.status });
  } catch {
    return Response.json({ error: "processing failed" }, { status: 500 });
  }
}
