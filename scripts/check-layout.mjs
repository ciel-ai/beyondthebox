// Layout acceptance: no horizontal overflow and no clipped text at 390, 768, 1024 and 1440px,
// and with reduced motion the hero loops stop. Usage: BASE_URL=http://localhost:3000 npm run test:layout
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTHS = [390, 768, 1024, 1440];
const PAGES = ["/", "/speakers", "/speakers/abdul-nabeel", "/tickets", "/checkout/details?tier=STANDARD&qty=2", "/booking/find", "/privacy", "/terms", "/refund-policy"];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
let failures = 0;
for (const w of WIDTHS) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: 900 });
  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: "networkidle0" });
    const r = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      clipped: [...document.querySelectorAll("h1,h2,h3,p,a,button,li,dd,dt,label")]
        .filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).display !== "inline" && !e.closest("[aria-hidden=true],.sr-only,[role=list],[role=region]"))
        .map((e) => `${e.tagName}:${e.textContent.trim().slice(0, 40)}`),
    }));
    const ok = r.overflow <= 0 && r.clipped.length === 0;
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"} ${String(w).padStart(4)} ${path}${r.overflow > 0 ? ` overflow=${r.overflow}px` : ""}${r.clipped.length ? ` clipped=${r.clipped.slice(0, 3).join(" | ")}` : ""}`);
  }
  await page.close();
}

const rm = await browser.newPage();
await rm.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await rm.goto(BASE + "/", { waitUntil: "networkidle0" });
const anims = await rm.evaluate(() => [...document.querySelectorAll(".loop-left,.loop-right")].map((e) => getComputedStyle(e).animationName));
const still = anims.every((a) => a === "none");
if (!still) failures++;
console.log(`${still ? "PASS" : "FAIL"} reduced motion stops hero loops (${anims.join(", ")})`);

await browser.close();
if (failures) {
  console.error(`\n${failures} layout check(s) failed`);
  process.exit(1);
}
console.log("\nAll layout checks passed");
