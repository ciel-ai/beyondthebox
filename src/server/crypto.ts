import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/* ---------- field encryption (AES-256-GCM, rotatable keys) ---------- */

type Keyring = { active: string; keys: Map<string, Buffer> };
let keyring: Keyring | null = null;

function getKeyring(): Keyring {
  if (keyring) return keyring;
  const e = env();
  const keys = new Map<string, Buffer>();
  for (const pair of e.PII_ENC_KEYS.split(",")) {
    const [id, b64] = pair.split(":");
    if (!id || !b64) throw new Error("PII_ENC_KEYS must look like 'k1:<base64>,k0:<base64>'");
    const key = Buffer.from(b64, "base64");
    if (key.length !== 32) throw new Error(`PII key ${id} must be 32 bytes`);
    keys.set(id, key);
  }
  if (!keys.has(e.PII_ENC_ACTIVE_KEY)) throw new Error("PII_ENC_ACTIVE_KEY is not in PII_ENC_KEYS");
  keyring = { active: e.PII_ENC_ACTIVE_KEY, keys };
  return keyring;
}

/** Output: v1.<keyId>.<iv>.<ciphertext>.<tag> (base64url). */
export function encrypt(plaintext: string): string {
  const { active, keys } = getKeyring();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keys.get(active)!, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", active, iv.toString("base64url"), ct.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}

export function decrypt(value: string): string {
  const [v, keyId, iv, ct, tag] = value.split(".");
  if (v !== "v1" || !keyId || !iv || ct === undefined || !tag) throw new Error("Unrecognised ciphertext");
  const key = getKeyring().keys.get(keyId);
  if (!key) throw new Error(`Unknown key id ${keyId}`);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

export const encryptOpt = (v: string | null | undefined) => (v ? encrypt(v) : null);
export const decryptOpt = (v: string | null | undefined) => (v ? decrypt(v) : null);

/* ---------- blind indexes (searchable encrypted fields) ---------- */

export function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Normalises to E.164. Bare 10-digit numbers are treated as Indian (+91). */
export function normalisePhone(phone: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

export function blindIndex(kind: "email" | "phone", value: string) {
  const normalised = kind === "email" ? normaliseEmail(value) : normalisePhone(value);
  return createHmac("sha256", env().PII_INDEX_KEY).update(`${kind}:${normalised}`).digest("hex");
}

/* ---------- identifiers ---------- */

/** No 0/O, 1/I/L. 31 symbols → 31^6 ≈ 887M references. */
const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function bookingReference() {
  let s = "";
  for (let i = 0; i < 6; i++) s += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `BTL26-${s}`;
}

export function isBookingReference(v: string) {
  return /^BTL26-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(v);
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacHex(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/* ---------- QR tokens: ticket ID + HMAC, no personal data ---------- */

export function qrToken(ticketId: string) {
  const mac = createHmac("sha256", env().QR_SECRET).update(`v1.${ticketId}`).digest("base64url").slice(0, 22);
  return `v1.${ticketId}.${mac}`;
}

export function verifyQrToken(token: string): string | null {
  const [v, ticketId, mac] = token.split(".");
  if (v !== "v1" || !ticketId || !mac) return null;
  return safeEqual(qrToken(ticketId), token) ? ticketId : null;
}
