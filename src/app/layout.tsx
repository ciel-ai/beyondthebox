import type { Metadata, Viewport } from "next";
import { Anton, Manrope } from "next/font/google";
import "./globals.css";

// adjustFontFallback: a metric-matched fallback so the marquee doesn't shift when Anton arrives.
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton", display: "swap", adjustFontFallback: true });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

const url = process.env.APP_URL ?? "http://localhost:3000";
const title = "Beyond the Limits — A Business Conclave 2026";
const description =
  "Where ambition meets opportunity. A business conclave of keynotes, industry recognition awards, networking, exhibitions and entertainment. 20 December 2026.";

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: { default: title, template: "%s · Beyond the Limits 2026" },
  description,
  openGraph: { type: "website", siteName: "Beyond the Limits", title, description, url: "/", locale: "en_IN" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${anton.variable} ${manrope.variable}`}>
      <body>
        <a
          href="#main"
          className="btn btn-leaf fixed left-4 top-3 z-[100] -translate-y-24 focus-visible:translate-y-0"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
