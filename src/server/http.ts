import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { fieldErrors } from "@/lib/schemas";
import { sha256 } from "./crypto";
import { env } from "./env";

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function validationError(error: ZodError) {
  return json({ error: "Please fix the highlighted fields.", fields: fieldErrors(error) }, 422);
}

/**
 * CSRF guard for cookie-bearing, state-changing routes: the request must come from our own
 * pages. Webhooks and cron routes are exempt and authenticate by signature or secret instead.
 */
export function isSameOrigin(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(env().APP_URL).host;
  } catch {
    return false;
  }
}

export function forbidden() {
  return json({ error: "Request blocked." }, 403);
}

/** IPs are hashed before they're used as rate-limit keys, never stored raw. */
export function clientKey(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return { ip, key: sha256(`ip:${ip}`).slice(0, 32) };
}

/* ---------- rate limiting ---------- */

type Rule = { limit: number; windowSec: number };
export const RULES = {
  createBooking: { limit: 8, windowSec: 600 },
  pay: { limit: 20, windowSec: 600 },
  verify: { limit: 30, windowSec: 600 },
  findBooking: { limit: 5, windowSec: 900 },
  cancellation: { limit: 5, windowSec: 3600 },
  bookingStatus: { limit: 120, windowSec: 600 },
} satisfies Record<string, Rule>;

const memory = new Map<string, { count: number; reset: number }>();
const limiters = new Map<string, Ratelimit>();

export async function rateLimit(name: keyof typeof RULES, key: string) {
  const rule = RULES[name];
  const e = env();
  if (e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN) {
    let rl = limiters.get(name);
    if (!rl) {
      rl = new Ratelimit({
        redis: new Redis({ url: e.UPSTASH_REDIS_REST_URL, token: e.UPSTASH_REDIS_REST_TOKEN }),
        limiter: Ratelimit.slidingWindow(rule.limit, `${rule.windowSec} s`),
        prefix: `btl:${e.DEPLOY_ENV}:${name}`,
      });
      limiters.set(name, rl);
    }
    return (await rl.limit(key)).success;
  }
  // Local development and tests only (env validation requires Upstash elsewhere).
  if (e.NODE_ENV === "test") return true;
  const k = `${name}:${key}`;
  const now = Date.now();
  const entry = memory.get(k);
  if (!entry || entry.reset < now) {
    memory.set(k, { count: 1, reset: now + rule.windowSec * 1000 });
    return true;
  }
  entry.count++;
  return entry.count <= rule.limit;
}

export function tooMany() {
  return json({ error: "Too many attempts. Wait a few minutes and try again." }, 429);
}

/* ---------- Cloudflare Turnstile ---------- */

// Cloudflare's documented dummy secrets: always pass / always fail. Used locally and in tests.
const DUMMY_PASS = "1x0000000000000000000000000000000AA";
const DUMMY_FAIL = "2x0000000000000000000000000000000AA";

export async function verifyTurnstile(token: string, ip: string) {
  const secret = env().TURNSTILE_SECRET_KEY;
  if (secret === DUMMY_PASS) return true;
  if (secret === DUMMY_FAIL) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    signal: AbortSignal.timeout(8_000),
  });
  const data = (await res.json().catch(() => ({ success: false }))) as { success: boolean };
  return data.success === true;
}
