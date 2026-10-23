import { beforeEach, describe, expect, it } from "vitest";
import { BookingError, createBooking } from "@/server/inventory";
import { bookingInput, db, resetDb, tierState } from "./support/helpers";

beforeEach(resetDb);

async function invariant(code: "STANDARD" | "PREMIUM" | "VIP") {
  const tier = await tierState(code);
  const [held] = await db.$queryRaw<{ held: bigint }[]>`
    SELECT COALESCE(SUM(quantity),0) AS held FROM "SeatHold"
    WHERE "tierId" = ${tier.id} AND "releasedAt" IS NULL AND "convertedAt" IS NULL AND "expiresAt" > now()`;
  return { capacity: tier.capacity, sold: tier.soldCount, held: Number(held!.held) };
}

describe("inventory under load", () => {
  it("1,000 concurrent requests for the last 10 seats never oversell", async () => {
    // 590 of 600 Standard seats already sold → 10 left.
    await db.ticketTier.update({ where: { code: "STANDARD" }, data: { soldCount: 590 } });

    const results = await Promise.allSettled(Array.from({ length: 1000 }, () => createBooking(bookingInput("STANDARD", 1))));

    const ok = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    const soldOut = rejected.filter((r) => r.reason instanceof BookingError && r.reason.code === "SOLD_OUT");
    const other = rejected.filter((r) => !(r.reason instanceof BookingError && r.reason.code === "SOLD_OUT"));

    expect(other.map((r) => String(r.reason))).toEqual([]);
    expect(ok).toHaveLength(10);
    expect(soldOut).toHaveLength(990);

    const s = await invariant("STANDARD");
    expect(s.sold + s.held).toBe(600);
    expect(s.sold + s.held).toBeLessThanOrEqual(s.capacity);
  });

  it("mixed quantities can't oversell either", async () => {
    await db.ticketTier.update({ where: { code: "VIP" }, data: { soldCount: 93 } }); // 7 left
    const qtys = Array.from({ length: 300 }, (_, i) => (i % 3) + 1);
    await Promise.allSettled(qtys.map((q) => createBooking(bookingInput("VIP", q))));
    const s = await invariant("VIP");
    expect(s.sold + s.held).toBeLessThanOrEqual(100);
    expect(s.sold + s.held).toBeGreaterThanOrEqual(98); // nearly full: only leftovers too small for a request
  });

  it("the database refuses soldCount above capacity even if code is wrong", async () => {
    const tier = await tierState("VIP");
    await expect(db.$executeRaw`UPDATE "TicketTier" SET "soldCount" = ${tier.capacity + 1} WHERE id = ${tier.id}`).rejects.toThrow();
  });

  it("enforces the per-order maximum", async () => {
    await expect(createBooking(bookingInput("STANDARD", 11))).rejects.toMatchObject({ code: "TOO_MANY" });
  });
});
