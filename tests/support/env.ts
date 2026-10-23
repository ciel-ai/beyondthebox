// Test environment: isolated database, fake gateway with real HMAC, Turnstile always-pass key.
const TEST_DB = "postgresql://btl:btl_local_only@localhost:5544/btl_test";

Object.assign(process.env, {
  DEPLOY_ENV: "local",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: TEST_DB,
  DB_POOL_MAX: "40",
  PII_ENC_KEYS: `k1:${Buffer.alloc(32, 7).toString("base64")}`,
  PII_ENC_ACTIVE_KEY: "k1",
  PII_INDEX_KEY: "test-index-key-test-index-key-0000000000",
  QR_SECRET: "test-qr-secret-test-qr-secret-00000000000",
  ACCESS_COOKIE_SECRET: "test-cookie-secret-test-cookie-0000000000",
  CRON_SECRET: "test-cron-secret-000000000000",
  PAYMENT_PROVIDER: "fake",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  EMAIL_FROM: "Beyond the Limits <tickets@test.local>",
  ADMIN_ALERT_EMAIL: "alerts@test.local",
});
