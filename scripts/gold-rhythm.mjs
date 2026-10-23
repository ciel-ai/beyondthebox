// Full-page screenshots at 1440x900 and 390x844, a rhythm contact sheet, and the gold share.
// Usage: BASE_URL=http://localhost:3000 node scripts/gold-rhythm.mjs
import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "test-results/gold";
mkdirSync(OUT, { recursive: true });
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });

const surfaceOf = (rgb) => {
  const [r, g, bl] = rgb.match(/\d+/g).map(Number);
  if (r > 150 && g > 110 && r - bl > 70) return "gold";
  if (r + g + bl > 0) return "dark";
  return "black";
};
const results = [];
for (const [w, h, mobile] of [[1440, 900, false], [390, 844, true]]) {
  const p = await b.newPage();
  await p.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await p.goto(BASE + "/", { waitUntil: "networkidle0" });
  await p.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 1500));
  const sections = await p.evaluate(() => {
    const els = [...document.querySelectorAll("main > *, body > footer")];
    return els.map((e) => {
      const r = e.getBoundingClientRect();
      const label = e.id || e.getAttribute("aria-labelledby")?.replace("-title", "") || e.className.split(" ")[0] || e.tagName;
      let bg = getComputedStyle(e).backgroundColor;
      if (getComputedStyle(e).backgroundImage.includes("gradient") && !e.id.includes("tickets")) bg = "rgb(235, 201, 93)"; // leaf band
      return { label, top: r.top + scrollY, height: r.height, bg };
    });
  });
  // Full-page capture paints fixed elements at the first viewport's bottom edge, which would show
  // the mobile sticky booking bar over the ticker. It's hidden at that scroll position in a real
  // browser (asserted by tests/e2e/sticky-bar.spec.ts), so it's excluded from the stitched image.
  await p.addStyleTag({ content: "div.fixed.bottom-0{display:none!important}" });
  const file = `${OUT}/home-${w}x${h}-full.png`;
  await p.screenshot({ path: file, fullPage: true });
  // Pixel count: gold = warm yellow pixels (gold-deep text/lines, gold surfaces, leaf, foil).
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let gold = 0;
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i], g = data[i + 1], bl = data[i + 2];
    if (r > 150 && g > 110 && r - bl > 70) gold++;
  }
  const total = info.width * info.height;
  const pageH = sections.reduce((m, s) => Math.max(m, s.top + s.height), 0);
  const goldSections = sections.filter((s) => surfaceOf(s.bg) === "gold");
  const darkSections = sections.filter((s) => surfaceOf(s.bg) === "dark");
  results.push({ w, h, file, sections, pageH, goldPixels: gold / total, goldHeight: goldSections.reduce((a, s) => a + s.height, 0) / pageH, darkHeight: darkSections.reduce((a, s) => a + s.height, 0) / pageH });
  await p.close();
}
await b.close();

// Contact sheet: each full page scaled to 2400px tall, with a rhythm strip (surface per section, to scale).
const H = 2400, STRIP = 70, PAD = 24;
const composites = [];
let x = PAD;
for (const r of results) {
  const img = await sharp(r.file).resize({ height: H }).png().toBuffer({ resolveWithObject: true });
  const scale = H / r.pageH;
  const rects = r.sections
    .map((s) => {
      const kind = surfaceOf(s.bg);
      const fill = kind === "gold" ? "#EBC95D" : kind === "dark" ? "#2a2416" : "#000";
      const y = Math.round(s.top * scale), hh = Math.max(1, Math.round(s.height * scale));
      return `<rect x="0" y="${y}" width="${STRIP}" height="${hh}" fill="${fill}" stroke="#444"/><text x="${STRIP + 6}" y="${y + 18}" font-family="Helvetica" font-size="15" fill="#DDBB4B">${s.label}</text>`;
    })
    .join("");
  composites.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${STRIP + 150}" height="${H + 40}"><text x="0" y="24" font-family="Helvetica" font-size="18" fill="#fff">${r.w}x${r.h}</text><g transform="translate(0,40)">${rects}</g></svg>`), left: x, top: PAD });
  x += STRIP + 150;
  composites.push({ input: img.data, left: x, top: PAD + 40 });
  x += img.info.width + PAD * 2;
}
await sharp({ create: { width: x, height: H + PAD * 2 + 40, channels: 3, background: "#1b1b1b" } }).composite(composites).png().toFile(`${OUT}/rhythm-contact-sheet.png`);

for (const r of results) {
  console.log(`\n${r.w}x${r.h}: page ${Math.round(r.pageH)}px · gold by section height ${(r.goldHeight * 100).toFixed(1)}% · dark surfaces ${(r.darkHeight * 100).toFixed(1)}% · gold pixels (all gold incl. text, lines, foil) ${(r.goldPixels * 100).toFixed(1)}%`);
  console.log("  " + r.sections.map((s) => `${s.label}:${surfaceOf(s.bg)}`).join(" → "));
}
console.log(`\n${OUT}/rhythm-contact-sheet.png`);
