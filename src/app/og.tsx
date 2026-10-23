import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/** Shared Open Graph / Twitter card: black, Anton wordmark, solid gold rule (no gradient). */
export async function shareImage() {
  const dir = path.join(process.cwd(), "assets", "fonts");
  const [anton, manrope] = await Promise.all([readFile(path.join(dir, "Anton-400.ttf")), readFile(path.join(dir, "Manrope-600.ttf"))]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#000", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72 }}>
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "Anton", fontSize: 150, lineHeight: 0.9, textTransform: "uppercase" }}>
          <span>Beyond</span>
          <span style={{ display: "flex" }}>
            <span style={{ color: "#DDBB4B", marginRight: 28 }}>The</span>Limits
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "Manrope" }}>
          <div style={{ width: 160, height: 4, background: "#DDBB4B", marginBottom: 28 }} />
          <span style={{ fontSize: 40 }}>A Business Conclave 2026</span>
          <span style={{ fontSize: 28, color: "#A6A6A6", marginTop: 8 }}>20 December 2026 · Where ambition meets opportunity.</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Anton", data: anton, weight: 400 },
        { name: "Manrope", data: manrope, weight: 600 },
      ],
    },
  );
}

export async function monogram(size: number) {
  const anton = await readFile(path.join(process.cwd(), "assets", "fonts", "Anton-400.ttf"));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Anton", fontSize: size * 0.5, color: "#DDBB4B", letterSpacing: size * 0.01 }}>
        BTL
      </div>
    ),
    { width: size, height: size, fonts: [{ name: "Anton", data: anton, weight: 400 }] },
  );
}
