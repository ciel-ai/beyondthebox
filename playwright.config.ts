import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3457);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results/playwright",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    // System Chrome: no browser download needed. Set PW_CHANNEL=chromium to use Playwright's build.
    channel: process.env.PW_CHANNEL ?? "chrome",
    // Staging previews are behind Vercel protection: send the automation bypass when provided.
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET, "x-vercel-set-bypass-cookie": "true" }
      : undefined,
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 60_000,
        env: { APP_URL: BASE_URL },
      },
});
