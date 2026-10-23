import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  // PDF rendering runs in Node; keep it out of the bundler.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Fonts read at runtime by the PDF and share-image routes.
  outputFileTracingIncludes: {
    "/api/**": ["./assets/fonts/**"],
    "/opengraph-image": ["./assets/fonts/**"],
    "/twitter-image": ["./assets/fonts/**"],
  },
  poweredByHeader: false,
};

export default nextConfig;
