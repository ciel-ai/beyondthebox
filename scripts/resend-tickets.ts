/**
 * Resends the confirmation email (tickets + invoice) for a booking.
 * Usage: npm run resend-tickets -- BTL26-XXXXXX
 * (The admin gets a button for this in Phase 2.)
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const ref = process.argv[2]?.toUpperCase();
if (!ref || !/^BTL26-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(ref)) {
  console.error("Usage: npm run resend-tickets -- BTL26-XXXXXX");
  process.exit(1);
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const booking = await db.booking.findUnique({ where: { reference: ref }, select: { id: true, status: true } });
if (!booking || booking.status !== "CONFIRMED") {
  console.error(`${ref}: not found or not confirmed`);
  process.exit(1);
}
const requestId = randomUUID();
await db.$executeRaw`
  INSERT INTO "Job" (id, kind, payload, "dedupeKey", "runAt", attempts, "createdAt")
  VALUES (${randomUUID()}, 'EMAIL'::"JobKind",
          ${JSON.stringify({ kind: "EMAIL", template: "booking_confirmed", bookingId: booking.id, requestId })}::jsonb,
          ${`email:resend:${requestId}`}, now(), 0, now())`;
console.log(`${ref}: resend queued. The job worker (cron, every minute) sends it.`);
await db.$disconnect();
