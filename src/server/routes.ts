import "server-only";
import { after } from "next/server";
import { json } from "./http";
import { BookingError } from "./inventory";
import { PaymentRejected } from "./payments/flow";
import { GoLiveBlocked } from "./settings";
import { runJobs } from "./worker";

/** Runs due jobs (capture, emails) right after the response; the per-minute cron is the safety net. */
export function kickJobs() {
  after(async () => {
    try {
      await runJobs({ max: 10, deadlineMs: 8_000 });
    } catch {
      // The cron will pick the jobs up.
    }
  });
}

/** Maps domain errors to clear responses. Unknown errors never leak details. */
export function errorResponse(e: unknown) {
  if (e instanceof BookingError) {
    const status = e.code === "NOT_FOUND" ? 404 : e.code === "TOO_MANY" ? 422 : 409;
    return json({ error: e.message, code: e.code, available: e.available }, status);
  }
  if (e instanceof GoLiveBlocked) return json({ error: "Ticket sales are paused. Please try again shortly.", code: "PAUSED" }, 503);
  if (e instanceof PaymentRejected) return json({ error: "We couldn't verify this payment. You have not been charged.", code: "REJECTED" }, 400);
  // Message only (no request data): safe for logs.
  console.error("Unhandled route error:", e instanceof Error ? e.message : "unknown");
  return json({ error: "Something went wrong on our side. Please try again.", code: "SERVER" }, 500);
}
