import "server-only";
import type { Job } from "@/generated/prisma/client";
import { db } from "./db";
import { sendAdminAlert, sendTemplate } from "./email/send";
import { enqueue, type JobPayload } from "./outbox";
import { reconcileCapture, runCapture, runRefund } from "./payments/flow";

const MAX_ATTEMPTS = 8;
const STALE_LOCK_MS = 2 * 60_000;

/** Claims one due job. SKIP LOCKED lets several workers run without stepping on each other. */
async function claim(): Promise<Job | null> {
  const rows = await db.$queryRaw<Job[]>`
    UPDATE "Job" SET "lockedAt" = now(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM "Job"
      -- runAt is TIMESTAMP(3) and Postgres rounds now() to the nearest millisecond on store,
      -- so a job due "now" can sit up to 0.5ms in the future. The 1ms tolerance claims it.
      WHERE "doneAt" IS NULL AND "failedAt" IS NULL AND "runAt" <= now() + interval '1 millisecond'
        AND ("lockedAt" IS NULL OR "lockedAt" < now() - ${`${STALE_LOCK_MS} milliseconds`}::interval)
      ORDER BY "runAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
  return rows[0] ?? null;
}

async function execute(payload: JobPayload, jobId: string) {
  switch (payload.kind) {
    case "CAPTURE":
      return runCapture(payload.paymentId);
    case "REFUND":
      return runRefund(payload.paymentId, payload.reason);
    case "EMAIL":
      return sendTemplate(payload, jobId);
    case "ADMIN_ALERT":
      return sendAdminAlert(payload.subject, payload.lines, jobId);
  }
}

/** Error text without personal data: gateway/provider messages and our own codes only. */
function safeError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/[^\s@]+@[^\s@]+/g, "[email]").replace(/\+?\d[\d\s-]{8,}\d/g, "[number]").slice(0, 500);
}

export const STALE_CAPTURE_MINUTES = 10;

/** One admin alert per capture job still pending 10 minutes after it was created. */
export async function alertStaleCaptures() {
  const stale = await db.$queryRaw<{ id: string; payload: { paymentId: string }; attempts: number; lastError: string | null }[]>`
    SELECT id, payload, attempts, "lastError" FROM "Job"
    WHERE kind = 'CAPTURE' AND "doneAt" IS NULL AND "failedAt" IS NULL
      AND "createdAt" < now() - make_interval(mins => ${STALE_CAPTURE_MINUTES})`;
  for (const j of stale) {
    const p = await db.payment.findUnique({ where: { id: j.payload.paymentId }, select: { providerPaymentId: true, booking: { select: { reference: true } } } });
    await enqueue(
      db,
      {
        kind: "ADMIN_ALERT",
        subject: `Capture pending over ${STALE_CAPTURE_MINUTES} minutes: ${p?.booking.reference ?? j.id}`,
        lines: [
          `Payment ${p?.providerPaymentId ?? "unknown"}`,
          `Attempts so far: ${j.attempts}`,
          `Last error: ${j.lastError ?? "none"}`,
          "Seats are held for this booking until the capture succeeds or fails. Razorpay auto-refunds uncaptured payments after 60 minutes.",
        ],
      },
      `alert:capture-stale:${j.id}`,
    );
  }
  return stale.length;
}

export async function runJobs({ max = 25, deadlineMs = 20_000 } = {}) {
  await alertStaleCaptures().catch(() => {});
  const until = Date.now() + deadlineMs;
  let processed = 0;
  while (processed < max && Date.now() < until) {
    const job = await claim();
    if (!job) break;
    processed++;
    try {
      await execute(job.payload as JobPayload, job.id);
      await db.$executeRaw`UPDATE "Job" SET "doneAt" = now(), "lockedAt" = NULL, "lastError" = NULL WHERE id = ${job.id}`;
    } catch (e) {
      const error = safeError(e);
      if (job.attempts >= MAX_ATTEMPTS) {
        // A capture that can't be completed must not keep seats: reconcile against the gateway.
        if (job.kind === "CAPTURE") {
          await reconcileCapture((job.payload as { paymentId: string }).paymentId).catch(() => {});
        }
        await db.$transaction(async (tx) => {
          await tx.$executeRaw`UPDATE "Job" SET "failedAt" = now(), "lockedAt" = NULL, "lastError" = ${error} WHERE id = ${job.id}`;
          if (job.kind !== "ADMIN_ALERT") {
            await enqueue(
              tx,
              { kind: "ADMIN_ALERT", subject: `Job failed after ${MAX_ATTEMPTS} attempts: ${job.kind}`, lines: [`Job ${job.id}`, error] },
              `alert:job-failed:${job.id}`,
            );
          }
        });
      } else {
        const backoffSecs = Math.min(30 * 2 ** (job.attempts - 1), 15 * 60);
        await db.$executeRaw`
          UPDATE "Job" SET "lockedAt" = NULL, "lastError" = ${error}, "runAt" = now() + make_interval(secs => ${backoffSecs})
          WHERE id = ${job.id}`;
      }
    }
  }
  return processed;
}

/** Drains the queue completely (tests and the cron route). */
export async function drainJobs() {
  let total = 0;
  for (;;) {
    const n = await runJobs({ max: 100 });
    total += n;
    if (n === 0) return total;
  }
}
