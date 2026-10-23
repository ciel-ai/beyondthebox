// Lighthouse mobile performance budgets for the home page (change request §6):
// Performance ≥ 85, LCP ≤ 2.5s, CLS ≤ 0.05, TBT ≤ 200ms.
// Runs (1) Lighthouse's default mobile emulation (simulated throttling) and (2) DevTools
// throttling with 4× CPU slowdown, and records both. Each is run RUNS times (default 5) and the
// MEDIAN is judged, as Lighthouse recommends for its run-to-run variance; the spread is printed.
// Usage: BASE_URL=... npm run test:perf
import { writeFileSync, mkdirSync } from "node:fs";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const BUDGET = { performance: 85, lcpMs: 2500, cls: 0.05, tbtMs: 200 };

const runs = [
  { name: "mobile (simulated)", settings: { formFactor: "mobile", throttlingMethod: "simulate" } },
  { name: "mobile, devtools 4x CPU", settings: { formFactor: "mobile", throttlingMethod: "devtools", throttling: { cpuSlowdownMultiplier: 4, requestLatencyMs: 150, downloadThroughputKbps: 1638.4, uploadThroughputKbps: 675 } } },
];

mkdirSync("test-results/lighthouse", { recursive: true });
const chrome = await launch({ chromePath: process.env.CHROME_PATH, chromeFlags: ["--headless=new"] });
let failed = false;
const N = Number(process.env.RUNS ?? 5);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const run of runs) {
  const samples = [];
  let lastReport = "";
  for (let i = 0; i < N; i++) {
  const { lhr, report } = await lighthouse(BASE + "/", { port: chrome.port, onlyCategories: ["performance"], output: "html", logLevel: "error" }, {
    extends: "lighthouse:default",
    settings: { ...run.settings, screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false } },
  });
  lastReport = report;
  samples.push({
    performance: Math.round(lhr.categories.performance.score * 100),
    lcpMs: Math.round(lhr.audits["largest-contentful-paint"].numericValue),
    cls: Number(lhr.audits["cumulative-layout-shift"].numericValue.toFixed(3)),
    tbtMs: Math.round(lhr.audits["total-blocking-time"].numericValue),
    fcpMs: Math.round(lhr.audits["first-contentful-paint"].numericValue),
  });
  }
  const pick = (k) => median(samples.map((x) => x[k]));
  const m = { performance: pick("performance"), lcpMs: pick("lcpMs"), cls: pick("cls"), tbtMs: pick("tbtMs"), fcpMs: pick("fcpMs") };
  const spread = (k) => `${Math.min(...samples.map((x) => x[k]))}–${Math.max(...samples.map((x) => x[k]))}`;
  const ok = m.performance >= BUDGET.performance && m.lcpMs <= BUDGET.lcpMs && m.cls <= BUDGET.cls && m.tbtMs <= BUDGET.tbtMs;
  // The budget is enforced on the standard mobile run; the 4x CPU run is recorded.
  if (run === runs[0] && !ok) failed = true;
  const file = `test-results/lighthouse/home-${run === runs[0] ? "mobile" : "mobile-4x-cpu"}.html`;
  writeFileSync(file, lastReport);
  console.log(`${ok ? "PASS" : "FAIL"} ${run.name} (median of ${N}): perf ${m.performance} · LCP ${m.lcpMs}ms · CLS ${m.cls} · TBT ${m.tbtMs}ms · FCP ${m.fcpMs}ms`);
  console.log(`     spread: perf ${spread("performance")} · LCP ${spread("lcpMs")}ms · CLS ${spread("cls")} · TBT ${spread("tbtMs")}ms  (last report: ${file})`);
}
await chrome.kill();
process.exit(failed ? 1 : 0);
