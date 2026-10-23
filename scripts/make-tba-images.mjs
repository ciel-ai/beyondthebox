// Generates the "to be announced" speaker images: 3:4, 1080px tall, black, soft gold silhouette, no text.
// Usage: node scripts/make-tba-images.mjs
import sharp from "sharp";

const W = 810, H = 1080;
// Six slightly different poses so the row doesn't look copy-pasted.
const poses = [
  { cx: 405, head: 128, shoulder: 300, tilt: 0 },
  { cx: 395, head: 122, shoulder: 290, tilt: -3 },
  { cx: 415, head: 132, shoulder: 310, tilt: 2 },
  { cx: 400, head: 126, shoulder: 296, tilt: 4 },
  { cx: 410, head: 130, shoulder: 305, tilt: -2 },
  { cx: 405, head: 124, shoulder: 292, tilt: 1 },
];

for (const [i, p] of poses.entries()) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <radialGradient id="g" cx="50%" cy="38%" r="65%">
        <stop offset="0%" stop-color="#EFDA72" stop-opacity="0.34"/>
        <stop offset="55%" stop-color="#DDBB4B" stop-opacity="0.16"/>
        <stop offset="100%" stop-color="#A8872B" stop-opacity="0.04"/>
      </radialGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="10"/></filter>
    </defs>
    <rect width="100%" height="100%" fill="#000"/>
    <g filter="url(#soft)" transform="rotate(${p.tilt} ${p.cx} 600)" fill="url(#g)">
      <circle cx="${p.cx}" cy="420" r="${p.head}"/>
      <path d="M${p.cx - p.shoulder} ${H + 40} C ${p.cx - p.shoulder} 690, ${p.cx - 130} 600, ${p.cx} 600 C ${p.cx + 130} 600, ${p.cx + p.shoulder} 690, ${p.cx + p.shoulder} ${H + 40} Z"/>
    </g>
  </svg>`;
  const out = `public/speakers/tba-0${i + 1}.webp`;
  const info = await sharp(Buffer.from(svg)).webp({ quality: 78 }).toFile(out);
  console.log(out, `${Math.round(info.size / 1024)} KB`);
}
