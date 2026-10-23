import "server-only";
import type { Job } from "@/generated/prisma/client";
import { db } from "./db";
import { sendAdminAlert, sendTemplate } from "./email/send";
import { enqueue, type JobPayload } from "./outbox";
import { runCapture, runRefund } from "./payments/flow";

const MAX_ATTEMPTS = 8;
const STALE_LOCK_MS = 2 * 60_000;

/** Claims one due job. SKIP LOCKED lets several workers run without stepping on each other. */
async function claim(): Promise<Job | null> {
  const rows = await db.$queryRaw<Job[]>`
    UPDATE "Job" SET "lockedAt" = now(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM "Job"
      WHERE "doneAt" IS NULL AND "failedAt" IS NULL AND "runAt" <= now()
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

export async function runJobs({ max = 25, deadlineMs = 20_000 } = {}) {
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
