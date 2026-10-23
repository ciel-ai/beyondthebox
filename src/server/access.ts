import "server-only";
import { cookies } from "next/headers";
import { hmacHex, randomToken, safeEqual, sha256 } from "./crypto";
import { db } from "./db";
import { env } from "./env";

/*
 * Booking pages need proof that the visitor is the buyer:
 *  - after checkout, the browser gets an HttpOnly signed cookie listing its booking references;
 *  - otherwise, a link emailed to the buyer (Find my booking, or the confirmation email).
 * URLs never carry personal data: only the reference or an opaque token (stored hashed).
 */

export const ACCESS_COOKIE = "btl_access";
const COOKIE_DAYS = 30;
const MAX_REFS = 10;

type Grant = { r: string[]; e: number };

function sign(payload: string) {
  return hmacHex(env().ACCESS_COOKIE_SECRET, payload);
}

export function readGrant(value: string | undefined): string[] {
  if (!value) return [];
  const [payload, mac] = value.split(".");
  if (!payload || !mac || !safeEqual(sign(payload), mac)) return [];
  try {
    const g = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Grant;
    return g.e > Date.now() && Array.isArray(g.r) ? g.r : [];
  } catch {
    return [];
  }
}

export function grantValue(existing: string | undefined, reference: string) {
  const refs = [reference, ...readGrant(existing).filter((r) => r !== reference)].slice(0, MAX_REFS);
  const payload = Buffer.from(JSON.stringify({ r: refs, e: Date.now() + COOKIE_DAYS * 86_400_000 } satisfies Grant)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export const accessCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: COOKIE_DAYS * 86_400,
};

/** Adds a booking to this browser's grant (route handlers and server actions). */
export async function grantBookingAccess(reference: string) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, grantValue(jar.get(ACCESS_COOKIE)?.value, reference), accessCookieOptions);
}

export async function hasBookingAccess(reference: string) {
  const jar = await cookies();
  return readGrant(jar.get(ACCESS_COOKIE)?.value).includes(reference);
}

/* ---------- emailed links ---------- */

export async function createAccessToken(bookingId: string, opts: { minutes: number; multiUse: boolean }) {
  const token = randomToken(32);
  await db.bookingAccessToken.create({
    data: { tokenHash: sha256(token), bookingId, multiUse: opts.multiUse, expiresAt: new Date(Date.now() + opts.minutes * 60_000) },
  });
  return token;
}

export function accessUrl(token: string) {
  return `${env().APP_URL}/booking/access/${token}`;
}

/** Returns the booking reference if the token is valid. Single-use tokens are consumed atomically. */
export async function redeemAccessToken(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{30,64}$/.test(token)) return null;
  const hash = sha256(token);
  const now = new Date();
  const row = await db.bookingAccessToken.findUnique({ where: { tokenHash: hash }, include: { booking: { select: { reference: true } } } });
  if (!row || row.expiresAt <= now) return null;
  if (!row.multiUse) {
    const consumed = await db.bookingAccessToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
    if (consumed.count === 0) return null;
  }
  return row.booking.reference;
}
