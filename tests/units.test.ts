import { beforeEach, describe, expect, it } from "vitest";
import { financialYear, invoiceNumber, isValidGstin, splitTax } from "@/lib/gst";
import { computePrice } from "@/lib/pricing";
import { createBookingSchema } from "@/lib/schemas";
import { createAccessToken, grantValue, readGrant, redeemAccessToken } from "@/server/access";
import { blindIndex, bookingReference, decrypt, encrypt, isBookingReference, qrToken, verifyQrToken } from "@/server/crypto";
import { resetEnvCache, env } from "@/server/env";
import { createBooking } from "@/server/inventory";
import { GoLiveBlocked, activePaymentsMode, loadGoLiveChecklist, setPaymentsMode } from "@/server/settings";
import { bookingInput, db, resetDb } from "./support/helpers";

const base = { gstRateBps: 1800, pricesIncludeGst: false, feeMode: "NONE" as const, feeValue: 0, feeTaxable: true };

describe("pricing (integer paise)", () => {
  it("GST-exclusive default", () => {
    const p = computePrice(299_900, 2, base);
    expect(p).toMatchObject({ subtotalPaise: 599_800, taxablePaise: 599_800, taxPaise: 107_964, totalPaise: 707_764 });
  });
  it("GST-inclusive", () => {
    const p = computePrice(299_900, 1, { ...base, pricesIncludeGst: true });
    expect(p.taxablePaise + p.taxPaise).toBe(299_900);
    expect(p.taxablePaise).toBe(254_153); // 299900 / 1.18 = 254152.54 → half-up
  });
  it("fixed and percent fees, with GST on the fee", () => {
    expect(computePrice(499_900, 2, { ...base, feeMode: "FIXED_PER_TICKET", feeValue: 5_000 })).toMatchObject({ feePaise: 10_000, feeTaxPaise: 1_800 });
    const pct = computePrice(699_900, 1, { ...base, feeMode: "PERCENT", feeValue: 200 });
    expect(pct.feePaise).toBe(Math.floor((2 * (699_900 + 125_982) * 200 + 10_000) / 20_000));
  });
  it("never produces fractions", () => {
    for (let q = 1; q <= 10; q++) for (const price of [299_900, 499_900, 699_900]) {
      const p = computePrice(price, q, { ...base, pricesIncludeGst: q % 2 === 0, feeMode: "PERCENT", feeValue: 237 });
      for (const v of Object.values(p)) expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe("GST", () => {
  it("validates GSTIN checksum", () => {
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
    expect(isValidGstin("27AAPFU0939F1ZW")).toBe(false);
    expect(isValidGstin("27AAPFU0939F1Z")).toBe(false);
  });
  it("financial year resets in April (IST)", () => {
    expect(financialYear(new Date("2026-12-20T10:00:00+05:30"))).toBe("26-27");
    expect(financialYear(new Date("2027-03-31T23:59:00+05:30"))).toBe("26-27");
    expect(financialYear(new Date("2027-04-01T00:01:00+05:30"))).toBe("27-28");
    expect(financialYear(new Date("2027-03-31T19:00:00Z"))).toBe("27-28"); // already 1 April in India
  });
  it("invoice numbers fit the 16-character limit", () => {
    expect(invoiceNumber("BTL", "26-27", 1)).toBe("BTL/26-27/00001");
    expect(invoiceNumber("BTL", "26-27", 99_999)).toHaveLength(15);
    expect(() => invoiceNumber("BTL", "26-27", 1_000_000)).toThrow();
  });
  it("splits tax with odd paise to SGST", () => {
    expect(splitTax(107_965, true)).toEqual({ cgstPaise: 53_982, sgstPaise: 53_983, igstPaise: 0 });
    expect(splitTax(100, false)).toEqual({ cgstPaise: 0, sgstPaise: 0, igstPaise: 100 });
  });
});

describe("crypto and identifiers", () => {
  it("encrypts with a random IV and decrypts", () => {
    const a = encrypt("Priya Sharma");
    expect(a).not.toBe(encrypt("Priya Sharma"));
    expect(decrypt(a)).toBe("Priya Sharma");
    // Flip one byte of the ciphertext body: GCM authentication must fail.
    const parts = a.split(".");
    const ct = Buffer.from(parts[3]!, "base64url");
    ct[0] = ct[0]! ^ 0xff;
    parts[3] = ct.toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });
  it("blind indexes match across formats", () => {
    expect(blindIndex("email", " Priya@Example.com ")).toBe(blindIndex("email", "priya@example.com"));
    expect(blindIndex("phone", "98765 43210")).toBe(blindIndex("phone", "+91-98765-43210"));
    expect(blindIndex("phone", "098765 43210")).toBe(blindIndex("phone", "919876543210"));
  });
  it("references avoid ambiguous characters", () => {
    for (let i = 0; i < 500; i++) {
      const r = bookingReference();
      expect(isBookingReference(r)).toBe(true);
      expect(r.slice(6)).not.toMatch(/[01OIL]/);
    }
  });
  it("QR tokens carry no personal data and reject tampering", () => {
    const t = qrToken("ckticket123");
    expect(t.split(".")).toHaveLength(3);
    expect(verifyQrToken(t)).toBe("ckticket123");
    expect(verifyQrToken(t.replace("ckticket123", "ckticket124"))).toBeNull();
  });
});

describe("booking access", () => {
  beforeEach(resetDb);
  it("signed cookie grants only listed bookings and rejects tampering", () => {
    const v = grantValue(undefined, "BTL26-ABCDEF");
    expect(readGrant(v)).toEqual(["BTL26-ABCDEF"]);
    const [payload, mac] = v.split(".");
    const forged = Buffer.from(JSON.stringify({ r: ["BTL26-ZZZZZZ"], e: Date.now() + 1e6 })).toString("base64url");
    expect(readGrant(`${forged}.${mac}`)).toEqual([]);
    expect(readGrant(`${payload}.x${mac!.slice(1)}`)).toEqual([]);
  });
  it("find-my-booking links work once", async () => {
    const b = await createBooking(bookingInput());
    const token = await createAccessToken(b.id, { minutes: 30, multiUse: false });
    const stored = await db.bookingAccessToken.findFirstOrThrow();
    expect(stored.tokenHash).not.toContain(token);
    expect(await redeemAccessToken(token)).toBe(b.reference);
    expect(await redeemAccessToken(token)).toBeNull();
  });
});

describe("go-live gate", () => {
  beforeEach(resetDb);
  it("refuses LIVE until every checklist item is set", async () => {
    const missing = (await loadGoLiveChecklist()).filter((i) => !i.ok).map((i) => i.key);
    expect(missing).toEqual(["legalName", "gstin", "state", "sac", "privacy", "terms", "refund", "inclusions", "seats"]);
    await expect(setPaymentsMode("LIVE")).rejects.toBeInstanceOf(GoLiveBlocked);

    await db.eventSettings.update({
      where: { id: 1 },
      data: { organiserLegalName: "Example Events LLP", organiserGstin: "27AAPFU0939F1ZV", organiserStateCode: "27", sacCode: "998554", capacityConfirmed: true },
    });
    await db.legalDocument.updateMany({ data: { approvedAt: new Date() } });
    await expect(setPaymentsMode("LIVE")).rejects.toBeInstanceOf(GoLiveBlocked); // inclusions still empty
    await db.ticketTier.updateMany({ data: { inclusions: ["Example inclusion"] } });
    await setPaymentsMode("LIVE");
    expect(await activePaymentsMode()).toBe("LIVE");

    // Reset for other tests.
    await db.eventSettings.update({ where: { id: 1 }, data: { paymentsMode: "TEST", organiserGstin: null, capacityConfirmed: false } });
    await db.legalDocument.updateMany({ data: { approvedAt: null } });
    await db.ticketTier.updateMany({ data: { inclusions: [] } });
  });

  it("staging can never hold live keys; production can never use the fake gateway", () => {
    const saved = { ...process.env };
    try {
      Object.assign(process.env, { DEPLOY_ENV: "staging", RAZORPAY_LIVE_KEY_ID: "rzp_live_x" });
      resetEnvCache();
      expect(() => env()).toThrow(/Live Razorpay keys/);
      Object.assign(process.env, { DEPLOY_ENV: "production", PAYMENT_PROVIDER: "fake" });
      resetEnvCache();
      expect(() => env()).toThrow(/fake is not allowed/);
    } finally {
      process.env = saved;
      resetEnvCache();
    }
  });
});

describe("input validation", () => {
  it("names the exact fix", () => {
    const r = createBookingSchema.safeParse({ ...bookingInput("STANDARD", 1), buyer: { name: "A", email: "nope", phone: "12", gstin: "BAD" } });
    expect(r.success).toBe(false);
    const msgs = r.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    expect(msgs).toContain("buyer.email: Enter an email address in the format name@example.com.");
    expect(msgs.some((m) => m.startsWith("buyer.gstin: Enter a valid 15-character GSTIN"))).toBe(true);
  });
});
