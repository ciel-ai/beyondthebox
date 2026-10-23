import "server-only";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

let registered = false;

/** Static TTF instances in assets/fonts (OFL). Traced into serverless bundles via next.config. */
export function registerPdfFonts() {
  if (registered) return;
  const dir = path.join(process.cwd(), "assets", "fonts");
  Font.register({ family: "Anton", src: path.join(dir, "Anton-400.ttf") });
  Font.register({
    family: "Manrope",
    fonts: [
      { src: path.join(dir, "Manrope-400.ttf"), fontWeight: 400 },
      { src: path.join(dir, "Manrope-600.ttf"), fontWeight: 600 },
      { src: path.join(dir, "Manrope-700.ttf"), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

/** "INR 2,999.00": the PDF fonts don't carry the rupee glyph. */
export function pdfMoney(paise: number) {
  return `INR ${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
