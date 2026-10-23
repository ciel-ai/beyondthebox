// Layout acceptance at the 12 change-request viewports: no horizontal overflow, no clipped text,
// touch targets ≥ 44px, inputs ≥ 16px;
// and with reduced motion the hero loops stop. Usage: BASE_URL=http://localhost:3000 npm run test:layout
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// Change request §6 test viewports.
const VIEWPORTS = [[360, 800], [375, 667], [390, 844], [430, 932], [844, 390], [768, 1024], [1024, 768], [1280, 720], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440]];
const PAGES = ["/", "/speakers", "/speakers/abdul-nabeel", "/tickets", "/checkout/details?tier=STANDARD&qty=2", "/booking/find", "/privacy", "/terms", "/refund-policy"];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
let failures = 0;
for (const [w, h] of VIEWPORTS) {
  const page = await browser.newPage();
  const mobile = w < 1280;
  await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: "networkidle0" });
    const r = await page.evaluate(() => ({
      // Touch targets ≥ 44×44 (visible links/buttons/inputs), inputs ≥ 16px text (no iOS zoom).
      small: [...document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, summary")]
        .filter((e) => {
          // A checkbox/radio's target is its wrapping label.
          const t = (e.type === "checkbox" || e.type === "radio") && e.closest("label") ? e.closest("label") : e;
          const b = t.getBoundingClientRect();
          const cs = getComputedStyle(e);
          return b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && !e.closest(".sr-only,[aria-hidden=true],.prose-legal,p") && (b.height < 43.5 || b.width < 43.5);
        })
        .map((e) => `${e.tagName}:${(e.textContent || e.getAttribute("aria-label") || e.name || "").trim().slice(0, 24)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`),
      tinyInputs: [...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea")].filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => e.name),
      // Display type (incl. decorative aria-hidden text) must fit its box; the scrolling marquee
      // and ticker are meant to run off screen and are exempt.
      displayOverflow: [...document.querySelectorAll(".display")]
        .filter((e) => !e.closest(".hero__marquee, .ticker, [role=list], [role=region], .sr-only"))
        .filter((e) => { const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect().right > e.getBoundingClientRect().right + 1; })
        .map((e) => e.textContent.trim().slice(0, 30)),
      overflow: document.documentElement.scrollWidth - innerWidth,
      clipped: [...document.querySelectorAll("h1,h2,h3,p,a,button,li,dd,dt,label")]
        .filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).display !== "inline" && !e.closest("[aria-hidden=true],.sr-only,[role=list],[role=region]"))
        .map((e) => `${e.tagName}:${e.textContent.trim().slice(0, 40)}`),
    }));
    const ok = r.overflow <= 0 && r.clipped.length === 0 && r.small.length === 0 && r.tinyInputs.length === 0 && r.displayOverflow.length === 0;
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"} ${w}x${h} ${path}${r.overflow > 0 ? ` overflow=${r.overflow}px` : ""}${r.clipped.length ? ` clipped=${r.clipped.slice(0, 3).join(" | ")}` : ""}${r.small.length ? ` small-targets=${r.small.slice(0, 4).join(" | ")}` : ""}${r.tinyInputs.length ? ` inputs<16px=${r.tinyInputs.join(",")}` : ""}${r.displayOverflow.length ? ` display-overflow=${r.displayOverflow.join(" | ")}` : ""}`);
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
