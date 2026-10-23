// Composes test-results/hero/*.png into one labelled contact sheet for review.
import sharp from "sharp";
const names = ["phone-360x800", "phone-375x667", "phone-390x844", "phone-430x932", "landscape-844x390", "tablet-768x1024", "tablet-1024x768", "desktop-1280x720", "desktop-1366x768", "desktop-1440x900", "desktop-1920x1080", "desktop-2560x1440"];
const H = 360, PAD = 16, LABEL = 28, COLS = 4;
const tiles = [];
for (const n of names) {
  const img = sharp(`test-results/hero/${n}.png`).resize({ height: H });
  const { data, info } = await img.png().toBuffer({ resolveWithObject: true });
  tiles.push({ n, data, w: info.width });
}
const colW = Math.max(...tiles.map((t) => t.w));
const rows = Math.ceil(tiles.length / COLS);
const W = COLS * (colW + PAD) + PAD, HH = rows * (H + LABEL + PAD) + PAD;
const composites = [];
tiles.forEach((t, i) => {
  const x = PAD + (i % COLS) * (colW + PAD), y = PAD + Math.floor(i / COLS) * (H + LABEL + PAD);
  composites.push({ input: t.data, left: x + Math.round((colW - t.w) / 2), top: y + LABEL });
  composites.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${colW}" height="${LABEL}"><text x="0" y="20" font-family="Helvetica" font-size="18" fill="#DDBB4B">${t.n}</text></svg>`), left: x, top: y });
});
await sharp({ create: { width: W, height: HH, channels: 3, background: "#222" } }).composite(composites).png().toFile("test-results/hero/contact-sheet.png");
console.log("test-results/hero/contact-sheet.png", W, "x", HH);
