// Lighthouse accessibility ≥ 95 on key pages, mobile and desktop.
// Usage: BASE_URL=http://localhost:3000 npm run test:a11y
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PAGES = ["/", "/speakers", "/tickets", "/checkout/details?tier=STANDARD&qty=2", "/booking/find", "/privacy"];
const MIN = 95;

const chrome = await launch({ chromePath: process.env.CHROME_PATH, chromeFlags: ["--headless=new"] });
let failures = 0;
for (const path of PAGES) {
  for (const formFactor of ["mobile", "desktop"]) {
    const config = formFactor === "desktop" ? (await import("lighthouse/core/config/desktop-config.js")).default : undefined;
    const { lhr } = await lighthouse(BASE + path, { port: chrome.port, onlyCategories: ["accessibility"], output: "json", logLevel: "error" }, config);
    const score = Math.round(lhr.categories.accessibility.score * 100);
    const ok = score >= MIN;
    if (!ok) failures++;
    const issues = Object.values(lhr.audits).filter((a) => a.score === 0).map((a) => a.id);
    console.log(`${ok ? "PASS" : "FAIL"} ${score} ${formFactor.padEnd(7)} ${path}${issues.length ? `  (${issues.join(", ")})` : ""}`);
  }
}
await chrome.kill();
if (failures) {
  console.error(`\n${failures} page(s) below ${MIN}`);
  process.exit(1);
}
console.log(`\nAll pages ≥ ${MIN}`);
