import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once on first use. Every variable is documented in
 * .env.example. Staging must never hold live Razorpay keys, and the fake payment
 * provider can never run in production.
 */
const optional = z.string().trim().min(1).optional();

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DEPLOY_ENV: z.enum(["local", "staging", "production"]).default("local"),
    APP_URL: z.string().url(),
    DATABASE_URL: z.string().min(1),

    PII_ENC_KEYS: z.string().min(1),
    PII_ENC_ACTIVE_KEY: z.string().min(1),
    PII_INDEX_KEY: z.string().min(32),
    QR_SECRET: z.string().min(32),
    ACCESS_COOKIE_SECRET: z.string().min(32),
    CRON_SECRET: z.string().min(24),

    PAYMENT_PROVIDER: z.enum(["razorpay", "fake"]).default("razorpay"),
    RAZORPAY_TEST_KEY_ID: optional,
    RAZORPAY_TEST_KEY_SECRET: optional,
    RAZORPAY_TEST_WEBHOOK_SECRET: optional,
    RAZORPAY_LIVE_KEY_ID: optional,
    RAZORPAY_LIVE_KEY_SECRET: optional,
    RAZORPAY_LIVE_WEBHOOK_SECRET: optional,

    RESEND_API_KEY: optional,
    EMAIL_FROM: z.string().min(3).default("Beyond the Limits <tickets@example.com>"),
    ADMIN_ALERT_EMAIL: optional,

    TURNSTILE_SECRET_KEY: z.string().min(1),
    UPSTASH_REDIS_REST_URL: optional,
    UPSTASH_REDIS_REST_TOKEN: optional,
  })
  .superRefine((e, ctx) => {
    const live = e.RAZORPAY_LIVE_KEY_ID || e.RAZORPAY_LIVE_KEY_SECRET || e.RAZORPAY_LIVE_WEBHOOK_SECRET;
    if (live && e.DEPLOY_ENV !== "production") {
      ctx.addIssue({ code: "custom", message: "Live Razorpay keys are only allowed when DEPLOY_ENV=production." });
    }
    if (e.PAYMENT_PROVIDER === "fake" && e.DEPLOY_ENV === "production") {
      ctx.addIssue({ code: "custom", message: "PAYMENT_PROVIDER=fake is not allowed in production." });
    }
    if (e.DEPLOY_ENV !== "local") {
      for (const k of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "RESEND_API_KEY", "ADMIN_ALERT_EMAIL"] as const) {
        if (!e[k]) ctx.addIssue({ code: "custom", message: `${k} is required outside local development.` });
      }
      if (e.PAYMENT_PROVIDER === "razorpay" && !(e.RAZORPAY_TEST_KEY_ID && e.RAZORPAY_TEST_KEY_SECRET && e.RAZORPAY_TEST_WEBHOOK_SECRET)) {
        ctx.addIssue({ code: "custom", message: "Razorpay test keys are required on staging and production." });
      }
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Names only — never print values.
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "env"}: ${i.message}`).join("; ");
    throw new Error(`Invalid server environment: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** For tests that change process.env between cases. */
export function resetEnvCache() {
  cached = null;
}
