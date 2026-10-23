import "server-only";
import { randomUUID } from "node:crypto";
import type { Tx } from "./db";

export type EmailTemplate =
  | "booking_confirmed"
  | "payment_failed"
  | "payment_not_taken"
  | "payment_refunded"
  | "booking_access_link"
  | "cancellation_received";

/** Payloads carry IDs only. Personal data is read (and decrypted) when the job runs. */
export type JobPayload =
  | { kind: "EMAIL"; template: EmailTemplate; bookingId: string; paymentId?: string; requestId?: string }
  | { kind: "CAPTURE"; paymentId: string }
  | { kind: "REFUND"; paymentId: string; reason: string }
  | { kind: "ADMIN_ALERT"; subject: string; lines: string[] };

/**
 * Writes a job in the caller's transaction (transactional outbox). If the transaction
 * commits, the job exists; if the process dies after commit, the worker still runs it.
 * dedupeKey makes enqueueing idempotent.
 */
export async function enqueue(tx: Tx, payload: JobPayload, dedupeKey: string, delaySeconds = 0) {
  // Times come from the database clock only, the same clock the worker compares against.
  await tx.$executeRaw`
    INSERT INTO "Job" (id, kind, payload, "dedupeKey", "runAt", attempts, "createdAt")
    VALUES (${randomUUID()}, ${payload.kind}::"JobKind", ${JSON.stringify(payload)}::jsonb, ${dedupeKey},
            now() + make_interval(secs => ${delaySeconds}), 0, now())
    ON CONFLICT ("dedupeKey") DO NOTHING`;
}
